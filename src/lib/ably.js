import Peer from 'peerjs';

// Minimal P2P wrapper that mimics Ably-like behavior
// but using PeerJS to create a mesh (host <-> players only).

export function getAblyClient() {
  return {};
}

export function getRoomChannel(client, roomCode) {
  return createPeerChannel(roomCode);
}

function createPeerChannel(roomCode) {
  const peer = new Peer(roomCode, {
    debug: 0,
    config: {
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    }
  });

  const channel = {
    peer,
    presenceMap: {},
    connections: {},
    subscribeCallbacks: [],
    presenceCallbacks: [],
  };

  // HOST accepts incoming player connections
  peer.on("connection", (conn) => {
    channel.connections[conn.peer] = conn;

    conn.on("data", (msg) => handleIncoming(channel, msg));
    conn.on("close", () => {
      delete channel.connections[conn.peer];
      delete channel.presenceMap[conn.peer];
    });
  });

  // PLAYER connects to host by ID
  channel._connectToHost = function(hostId) {
    const conn = peer.connect(hostId);
    channel.connections[hostId] = conn;

    conn.on("data", (msg) => handleIncoming(channel, msg));
    conn.on("close", () => {
      delete channel.connections[hostId];
    });
  };

  channel.publish = function(type, data) {
    const msg = { type, data };
    Object.values(channel.connections).forEach((c) => {
      if (c.open) c.send(msg);
    });
  };

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
function handleIncoming(channel, msg) {
  if (msg.__presence) {
    const { action, clientId, data } = msg.__presence;
    channel.presenceMap[clientId] = { clientId, data };
    channel.presenceCallbacks.forEach(cb =>
      cb({ action, clientId, data })
    );
    return;
  }

  channel.subscribeCallbacks.forEach(cb =>
    cb(msg.type, msg.data)
  );
}

export async function enterPresence(channel, data) {
  const clientId = channel.peer.id;
  channel.presenceMap[clientId] = { clientId, data };

  const p = { action: "enter", clientId, data };

  Object.values(channel.connections).forEach((c) =>
    c.send({ __presence: p })
  );

  return clientId;
}

export function subscribeAll(channel, fn) {
  return channel.subscribe(fn);
}

export function subscribePresence(channel, fn) {
  return channel.subscribePresence(fn);
}