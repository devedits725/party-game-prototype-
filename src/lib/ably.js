import { SERVER_URL, getOrCreatePlayerId } from './utils.js';

let socket = null;
let clientId = getOrCreatePlayerId();
let messageQueue = [];
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const channels = new Map();

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
        sendCommand({ type: 'presence_enter', room: this.roomCode, data, clientId });
      },
      update: async (data) => {
        sendCommand({ type: 'presence_update', room: this.roomCode, data, clientId });
      },
      leave: async () => {
        // Leave is handled on disconnect, but could be explicit
      },
      get: () => {
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
    return Promise.resolve();
  }

  async publish(type, data) {
    sendCommand({ type: 'publish', room: this.roomCode, event: type, data });
  }
}

function connect() {
  return new Promise((resolve) => {
    console.log(`Connecting to WebSocket at ${SERVER_URL}...`);
    socket = new WebSocket(SERVER_URL);

    socket.onopen = () => {
      console.log('WebSocket connected');
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
            // Ably expectations: callback({ action, clientId, data })
            const { action, clientId: memberId, data } = msg;
            channel.presenceSubscribers.forEach(cb => cb({ action, clientId: memberId, data }));
          }
        } else if (msg.type === 'presence_members') {
          const channel = channels.get(msg.room);
          if (channel) {
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
      console.log('WebSocket closed');
      if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 10000);
        reconnectAttempts++;
        console.log(`Reconnecting in ${delay}ms... (Attempt ${reconnectAttempts})`);
        setTimeout(connect, delay);
      }
    };

    socket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  });
}

function sendCommand(cmd) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(cmd));
  } else {
    messageQueue.push(cmd);
  }
}

export function getAblyClient(apiKey, overrideClientId) {
  if (overrideClientId) clientId = overrideClientId;
  if (!socket) {
    connect();
  }
  return {
    channels: {
      get: (name) => {
        const roomCode = name.startsWith('party:') ? name.split(':')[1] : name;
        if (!channels.has(roomCode)) {
          const channel = new Channel(null, roomCode);
          channels.set(roomCode, channel);
          sendCommand({ type: 'subscribe', room: roomCode, clientId });
        }
        return channels.get(roomCode);
      }
    },
    close: () => {
      if (socket) {
        socket.close();
        socket = null;
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
    channels.clear();
  }
}
