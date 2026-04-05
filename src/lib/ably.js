import Peer from 'peerjs';

// Minimal Ably-like wrapper for P2P rooms
// This uses PeerJS directly but exposes Ably-like helpers
// so the rest of the codebase works unchanged.

export function getAblyClient() {
  return {};
}

const peers = {};

export function getRoomChannel(client, roomCode) {
  if (!peers[roomCode]) {
    peers[roomCode] = createPeerChannel(roomCode);
  }
  return peers[roomCode];
}

function createPeerChannel(roomCode) {
  const peer = new Peer(roomCode, {
    debug: 0,
    config: {
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    },
  });

  const channel = {
    peer,
    presenceMap: {},
    publish(type, data) {
      Object.values(connections).forEach(conn => {
        if (conn.open) conn.send({ type, data });
      });
    },
  };

  const connections = {};

  peer.on('connection', conn => {
    connections[conn.peer] = conn;

    conn.on('data', msg => {
      if (msg && msg.__presence) {
        const { action, clientId, data } = msg.__presence;
        channel.presenceMap[clientId] = { clientId, data };
        presenceSubscribers.forEach(fn => fn({ action, clientId, data }));
        return;
      }

      subscribers.forEach(fn => fn(msg.type, msg.data));
    });

    conn.on('close', () => {
      delete connections[conn.peer];
      delete channel.presenceMap[conn.peer];
    });
  });

  let subscribers = [];
  let presenceSubscribers = [];

  channel._connectToHost = function (hostId) {
    const conn = peer.connect(hostId);
    connections[hostId] = conn;

    conn.on('data', msg => {
      if (msg && msg.__presence) {
        const { action, clientId, data } = msg.__presence;
        channel.presenceMap[clientId] = { clientId, data };
        presenceSubscribers.forEach(fn => fn({ action, clientId, data }));
        return;
      }
      subscribers.forEach(fn => fn(msg.type, msg.data));
    });

    conn.on('close', () => {
      delete connections[hostId];
    });
  };

  channel._broadcastPresence = function (action, clientId, data) {
    const presenceMsg = {
      __presence: { action, clientId, data }
    };
    Object.values(connections).forEach(c => c.send(presenceMsg));
  };

  channel.subscribe = (fn) => {
    subscribers.push(fn);
    return () => {
      subscribers = subscribers.filter(x => x !== fn);
    };
  };

  channel.subscribePresence = (fn) => {
    presenceSubscribers.push(fn);
    return () => {
      presenceSubscribers = presenceSubscribers.filter(x => x !== fn);
    };
  };

  return channel;
}

export function subscribeAll(channel, callback) {
  return channel.subscribe(callback);
}

export async function enterPresence(channel, data) {
  const clientId = channel.peer.id;
  channel.presenceMap[clientId] = { clientId, data };
  channel._broadcastPresence('enter', clientId, data);
  return clientId;
}

export function subscribePresence(channel, callback) {
  return channel.subscribePresence(callback);
}