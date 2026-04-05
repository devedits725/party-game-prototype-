import { SERVER_URL, getOrCreatePlayerId } from './utils.js';

let socket = null;
let clientId = getOrCreatePlayerId();
let messageQueue = [];
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const channels = new Map();
let connectionPromise = null;

class Channel {
  constructor(client, roomCode) {
    this.client = client;
    this.roomCode = roomCode;
    this.subscribers = new Set();
    this.presenceSubscribers = new Set();
    this.allSubscribers = new Set();
    this.presenceMembers = [];
    this.pendingPresenceRequests = [];
  }

  // Ably-like interface
  subscribe(...args) {
    if (args.length === 2) {
      const [eventName, callback] = args;
      const sub = { eventName, callback };
      this.subscribers.add(sub);
      return () => this.subscribers.delete(sub);
    } else {
      const [callback] = args;
      this.allSubscribers.add(callback);
      return () => this.allSubscribers.delete(callback);
    }
  }

  unsubscribe(...args) {
    if (args.length === 2) {
      const [eventName, callback] = args;
      for (let sub of this.subscribers) {
        if (sub.eventName === eventName && sub.callback === callback) {
          this.subscribers.delete(sub);
          break;
        }
      }
    } else if (args.length === 1) {
       const [callback] = args;
       this.allSubscribers.delete(callback);
       for (let sub of this.subscribers) {
         if (sub.callback === callback) {
           this.subscribers.delete(sub);
         }
       }
    }
  }

  get presence() {
    return {
      enter: async (data) => {
        console.log(`[CLIENT PRESENCE] Enter room: ${this.roomCode}`, data);
        await sendCommand({ type: 'presence_enter', room: this.roomCode, data, clientId });
      },
      update: async (data) => {
        console.log(`[CLIENT PRESENCE] Update room: ${this.roomCode}`, data);
        await sendCommand({ type: 'presence_update', room: this.roomCode, data, clientId });
      },
      leave: async () => {
        console.log(`[CLIENT PRESENCE] Leave room: ${this.roomCode}`);
        await sendCommand({ type: 'presence_leave', room: this.roomCode, clientId });
      },
      get: () => {
        console.log(`[CLIENT PRESENCE] Get members for room: ${this.roomCode}`);
        return new Promise((resolve) => {
          this.pendingPresenceRequests.push(resolve);
          sendCommand({ type: 'presence_get', room: this.roomCode });
        });
      },
      subscribe: (callback) => {
        this.presenceSubscribers.add(callback);
        return () => this.presenceSubscribers.delete(callback);
      },
      unsubscribe: (callback) => {
        this.presenceSubscribers.delete(callback);
      }
    };
  }

  async attach() {
    console.log(`[CLIENT CHANNEL] Attaching to room: ${this.roomCode}`);
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      await connect();
    }
    await sendCommand({ type: 'subscribe', room: this.roomCode, clientId });
    console.log(`[CLIENT CHANNEL] Attached to room: ${this.roomCode}`);
    return Promise.resolve();
  }

  async publish(type, data) {
    console.log(`[CLIENT PUBLISH] Room: ${this.roomCode} Type: ${type}`, data);
    await sendCommand({ type: 'publish', room: this.roomCode, event: type, data });
  }
}

function connect() {
  if (connectionPromise && socket && socket.readyState !== WebSocket.CLOSED) {
    return connectionPromise;
  }

  connectionPromise = new Promise((resolve, reject) => {
    console.log(`[CLIENT] Connecting to WebSocket at ${SERVER_URL}...`);
    socket = new WebSocket(SERVER_URL);

    socket.onopen = () => {
      console.log('[CLIENT] WebSocket connected successfully');
      reconnectAttempts = 0;
      // Re-subscribe to all active channels
      channels.forEach((channel, roomCode) => {
        socket.send(JSON.stringify({ type: 'subscribe', room: roomCode, clientId }));
      });
      // Flush queue
      while (messageQueue.length > 0) {
        const msg = messageQueue.shift();
        socket.send(JSON.stringify(msg));
      }
      resolve(socket);
    };

    socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'message') {
          const channel = channels.get(msg.room);
          if (channel) {
            channel.allSubscribers.forEach(cb => cb(msg.event, msg.data));
            channel.subscribers.forEach(sub => {
              if (sub.eventName === msg.event) sub.callback(msg.data);
            });
          }
        } else if (msg.type === 'presence_change') {
          const channel = channels.get(msg.room);
          if (channel) {
            const { action, clientId: memberId, data } = msg;
            console.log(`[CLIENT] Presence change in ${msg.room}: ${action} for ${memberId}`);
            channel.presenceSubscribers.forEach(cb => cb({ action, clientId: memberId, data }));
          }
        } else if (msg.type === 'presence_members') {
          const channel = channels.get(msg.room);
          if (channel) {
            console.log(`[CLIENT] Received ${msg.members.length} members for ${msg.room}`);
            channel.presenceMembers = msg.members;
            while (channel.pendingPresenceRequests.length > 0) {
              const resolve = channel.pendingPresenceRequests.shift();
              resolve(msg.members);
            }
          }
        }
      } catch (e) {
        // Ignore non-JSON messages (like pings)
      }
    };

    socket.onclose = () => {
      console.log('[CLIENT] WebSocket closed');
      connectionPromise = null;
      if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 10000);
        reconnectAttempts++;
        console.log(`[CLIENT] Reconnecting in ${delay}ms... (Attempt ${reconnectAttempts})`);
        setTimeout(connect, delay);
      }
    };

    socket.onerror = (error) => {
      console.error('[CLIENT] WebSocket error:', error);
      reject(error);
    };
  });

  return connectionPromise;
}

async function sendCommand(cmd) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(cmd));
  } else {
    console.log('[CLIENT] Socket not ready, queueing command:', cmd.type);
    messageQueue.push(cmd);
    if (!socket || socket.readyState === WebSocket.CLOSED) {
      await connect();
    }
  }
}

export function getAblyClient(apiKey, overrideClientId) {
  if (overrideClientId) {
    clientId = overrideClientId;
    console.log(`[CLIENT] Using clientId: ${clientId}`);
  }
  if (!socket || socket.readyState === WebSocket.CLOSED) {
    connect();
  }
  return {
    channels: {
      get: (name) => {
        const roomCode = name.startsWith('party:') ? name.split(':')[1] : name;
        if (!channels.has(roomCode)) {
          const channel = new Channel(null, roomCode);
          channels.set(roomCode, channel);
          // Auto-attach or send initial subscribe
          sendCommand({ type: 'subscribe', room: roomCode, clientId });
        }
        return channels.get(roomCode);
      }
    },
    close: () => {
      if (socket) {
        socket.close();
        socket = null;
        connectionPromise = null;
      }
    }
  };
}

export function getRoomChannel(client, roomCode) {
  return client.channels.get(`party:${roomCode}`);
}

export async function publishToChannel(channel, type, data) {
  await channel.publish(type, data);
}

export async function enterPresence(channel, playerData) {
  await channel.presence.enter(playerData);
}

export async function updatePresence(channel, playerData) {
  await channel.presence.update(playerData);
}

export async function getPresenceMembers(channel) {
  return channel.presence.get();
}

export function subscribePresence(channel, callback) {
  return channel.presence.subscribe(callback);
}

export function subscribeChannel(channel, eventName, callback) {
  return channel.subscribe(eventName, (data) => callback(data));
}

export function subscribeAll(channel, callback) {
  return channel.subscribe((eventName, data) => callback(eventName, data));
}

export function disconnectAbly() {
  if (socket) {
    socket.close();
    socket = null;
    connectionPromise = null;
    channels.clear();
  }
}
