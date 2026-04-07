import Peer from 'peerjs';

// Minimal P2P wrapper that mimics Ably-like behavior
// but using PeerJS to create a mesh (host <-> players only).

export function getAblyClient() {
  return {};
}

export function getRoomChannel(client, roomCode, { isHost = false, clientId = null } = {}) {
  return createPeerChannel(roomCode, isHost, clientId);
}

function createPeerChannel(roomCode, isHost, clientId) {
  // If host, we use the roomCode as our Peer ID.
  // If player, we use our clientId as Peer ID to be consistent.
  const myPeerId = isHost ? roomCode : (clientId || null);

  const peer = new Peer(myPeerId, {
    debug: 1,
    config: {
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    }
  });

  const channel = {
    peer,
    isHost,
    roomCode,
    presenceMap: {},
    connections: {}, // PeerID -> DataConnection
    subscribeCallbacks: [],
    presenceCallbacks: [],
    _status: 'connecting',
    _queuedMessages: [],
  };

  const readyPromise = new Promise((resolve, reject) => {
    peer.on("open", (id) => {
      console.log(`[P2P] Peer opened with ID: ${id}`);
      channel._status = 'open';
      resolve(id);
    });
    peer.on("error", (err) => {
      console.error("[P2P] Peer error:", err);
      channel._status = 'error';
      reject(err);
    });
  });

  channel.whenReady = () => readyPromise;

  // HOST accepts incoming player connections
  peer.on("connection", (conn) => {
    console.log(`[P2P] Incoming connection from: ${conn.peer}`);
    setupConnection(channel, conn);
  });

  function setupConnection(channel, conn) {
    channel.connections[conn.peer] = conn;

    conn.on("open", () => {
      console.log(`[P2P] Connection open with: ${conn.peer}`);
      // Send any queued messages for this specific peer if needed, 
      // but usually publish sends to all.
      // For simplicity, we just trigger a flush of all queued messages if it's the first connection or something?
      // Actually, publish() should check each connection.
      flushQueuedMessages(channel);
    });

    conn.on("data", (msg) => handleIncoming(channel, msg, conn.peer));
    
    conn.on("close", () => {
      console.log(`[P2P] Connection closed with: ${conn.peer}`);
      delete channel.connections[conn.peer];
      delete channel.presenceMap[conn.peer];
      // Trigger presence leave
      channel.presenceCallbacks.forEach(cb => 
        cb({ action: 'leave', clientId: conn.peer })
      );
    });

    conn.on("error", (err) => {
      console.error(`[P2P] Connection error with ${conn.peer}:`, err);
    });
  }

  // PLAYER connects to host by ID
  channel._connectToHost = function(hostId) {
    return new Promise((resolve, reject) => {
      console.log(`[P2P] Connecting to host: ${hostId}`);
      const conn = peer.connect(hostId, {
        reliable: true
      });
      
      setupConnection(channel, conn);

      const timeout = setTimeout(() => {
        reject(new Error("Connection timeout to host"));
      }, 10000);

      conn.on("open", () => {
        clearTimeout(timeout);
        resolve(conn);
      });

      conn.on("error", (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
  };

  channel.publish = function(type, data) {
    const msg = { type, data };
    const conns = Object.values(channel.connections);
    
    let sentCount = 0;
    conns.forEach((c) => {
      if (c.open) {
        c.send(msg);
        sentCount++;
      }
    });

    if (sentCount === 0 && !isHost) {
      // If we are a player and have no open connections, queue it
      channel._queuedMessages.push(msg);
    }
  };

  function flushQueuedMessages(channel) {
    if (channel._queuedMessages.length === 0) return;
    
    const conns = Object.values(channel.connections).filter(c => c.open);
    if (conns.length > 0) {
      channel._queuedMessages.forEach(msg => {
        conns.forEach(c => c.send(msg));
      });
      channel._queuedMessages = [];
    }
  }

  channel.subscribe = function(fn) {
    channel.subscribeCallbacks.push(fn);
    return () => {
      channel.subscribeCallbacks =
        channel.subscribeCallbacks.filter((x) => x !== fn);
    };
  };

  channel.subscribePresence = function(fn) {
    channel.presenceCallbacks.push(fn);
    return () => {
      channel.presenceCallbacks =
        channel.presenceCallbacks.filter((x) => x !== fn);
    };
  };

  return channel;
}

// Handle all incoming messages
function handleIncoming(channel, msg, fromPeerId) {
  if (msg.__presence) {
    const { action, clientId, data } = msg.__presence;
    const effectiveClientId = clientId || fromPeerId;
    
    if (action === 'enter' || action === 'update') {
      channel.presenceMap[effectiveClientId] = { clientId: effectiveClientId, data };
    } else if (action === 'leave') {
      delete channel.presenceMap[effectiveClientId];
    }

    channel.presenceCallbacks.forEach(cb =>
      cb({ action, clientId: effectiveClientId, data })
    );
    return;
  }

  channel.subscribeCallbacks.forEach(cb =>
    cb(msg.type, msg.data)
  );
}

export async function enterPresence(channel, data) {
  await channel.whenReady();
  const clientId = channel.peer.id;
  channel.presenceMap[clientId] = { clientId, data };

  const p = { action: "enter", clientId, data };

  // Use a special internal publish for presence to ensure it's wrapped
  const msg = { __presence: p };
  const conns = Object.values(channel.connections);
  
  let sent = false;
  conns.forEach((c) => {
    if (c.open) {
      c.send(msg);
      sent = true;
    }
  });

  if (!sent && !channel.isHost) {
    channel._queuedMessages.push(msg);
  }

  return clientId;
}

export function subscribeAll(channel, fn) {
  return channel.subscribe(fn);
}

export function subscribePresence(channel, fn) {
  return channel.subscribePresence(fn);
}
