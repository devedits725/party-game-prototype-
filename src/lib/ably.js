/**
 * PeerJS P2P drop-in replacement for ably.js
 *
<<<<<<< HEAD
 * KEY FIXES in this version:
 *  - Removed serialization:'raw' — caused player→host messages to be
 *    received as ArrayBuffer instead of string, breaking JSON.parse
 *  - sendQueue now stores {type,data} objects not raw strings,
 *    flushed correctly via _send() after channel opens
 *  - Public room discovery via PeerJS peer ID convention + localStorage
 *    (rooms register themselves under a well-known key so JoinPage can list them)
=======
 * Architecture (star topology):
 *   HOST  → creates Peer ID "party-ROOMCODE", accepts all connections
 *   PLAYER → creates Peer with random ID, connects to "party-ROOMCODE"
 *   HOST fans out every game message to all connected players
 *   Presence is simulated via protocol messages over DataChannels
 *
 * All exported function signatures identical to original ably.js.
 * Nothing else in the codebase needs to change.
>>>>>>> 229d39f7510f794d97ecf01b8a41be9139875e08
 */

import Peer from 'peerjs';

<<<<<<< HEAD
// ─── Client ID ─────────────────────────────────────────────────────────────
function getClientId() {
  let id = sessionStorage.getItem('p2p_cid');
  if (!id) {
    id = 'p' + Math.random().toString(36).slice(2, 10);
    sessionStorage.setItem('p2p_cid', id);
=======
// ─── Client ID ────────────────────────────────────────────────────────────

function getClientId() {
  let id = sessionStorage.getItem('p2p_client_id');
  if (!id) {
    id = 'p' + Math.random().toString(36).slice(2, 10);
    sessionStorage.setItem('p2p_client_id', id);
>>>>>>> 229d39f7510f794d97ecf01b8a41be9139875e08
  }
  return id;
}

<<<<<<< HEAD
// ─── Public room registry (localStorage, same-origin = same deployed app) ──
const PUB_KEY = 'party_public_rooms';

export function registerPublicRoom(roomCode, hostName, game) {
  try {
    const rooms = _getRaw();
    rooms[roomCode] = { roomCode, hostName, game, ts: Date.now() };
    localStorage.setItem(PUB_KEY, JSON.stringify(rooms));
  } catch(_) {}
}

export function unregisterPublicRoom(roomCode) {
  try {
    const rooms = _getRaw();
    delete rooms[roomCode];
    localStorage.setItem(PUB_KEY, JSON.stringify(rooms));
  } catch(_) {}
}

export function getPublicRooms() {
  const rooms = _getRaw();
  const now = Date.now();
  // Prune rooms older than 15 minutes
  Object.keys(rooms).forEach(k => {
    if (now - rooms[k].ts > 15 * 60 * 1000) delete rooms[k];
  });
  return rooms;
}

function _getRaw() {
  try { return JSON.parse(localStorage.getItem(PUB_KEY) || '{}'); } catch { return {}; }
}

// ─── Channel factory ───────────────────────────────────────────────────────
=======
// ─── Channel factory ──────────────────────────────────────────────────────

>>>>>>> 229d39f7510f794d97ecf01b8a41be9139875e08
function makeChannel(roomCode) {
  const ch = {
    roomCode,
    isHost: false,
    peer: null,
    myClientId: getClientId(),
    myPresenceData: null,
    _game: null,
    _reconnectAttempts: 0,

    // HOST only
<<<<<<< HEAD
    playerConns: {},   // peerId → DataConnection
    presenceMap: {},   // peerId → { clientId, data }

    // PLAYER only — store as {type,data} objects, NOT raw strings
    hostConn: null,
    sendQueue: [],     // [{type, data}] flushed on open

    // Subscriptions
    _msgSubs: {},      // eventName → [fn]
    _allSubs: [],      // [fn(type,data)]
    _presenceSubs: [], // [fn(event)]
  };
  // Attach .publish() so game files can call channel.publish(type, data)
  ch.publish = (type, data) => _publish(ch, type, data);
  return ch;
}

// ─── Internal emitters ─────────────────────────────────────────────────────
function _emitMsg(ch, type, data) {
  (ch._msgSubs[type] || []).forEach(cb => { try { cb(data); } catch(e) { console.error('[P2P] msg cb error:', e); } });
  ch._allSubs.forEach(cb => { try { cb(type, data); } catch(e) { console.error('[P2P] allsub cb error:', e); } });
=======
    playerConns: {},     // peerId -> DataConnection
    presenceMap: {},     // peerId -> { clientId, data }

    // PLAYER only
    hostConn: null,
    sendQueue: [],

    // Subscriptions
    _msgSubs: {},        // eventName -> [callbacks]
    _allSubs: [],
    _presenceSubs: [],
  };

  // Attach publish so game files can call channel.publish()
  ch.publish = (type, data) => _publish(ch, type, data);

  return ch;
}

// ─── Internal emit helpers ─────────────────────────────────────────────────

function _emitMsg(ch, type, data) {
  const subs = ch._msgSubs[type];
  if (subs) subs.forEach(cb => { try { cb(data); } catch(e) { console.error(e); } });
  ch._allSubs.forEach(cb => { try { cb(type, data); } catch(e) { console.error(e); } });
>>>>>>> 229d39f7510f794d97ecf01b8a41be9139875e08
}

function _emitPresence(ch, action, member) {
  ch._presenceSubs.forEach(cb => {
    try { cb({ action, clientId: member.clientId, data: member.data }); } catch(e) {}
  });
}

// ─── Send helpers ──────────────────────────────────────────────────────────
<<<<<<< HEAD
// IMPORTANT: always use default PeerJS serialization (json-like).
// Do NOT use serialization:'raw' — it sends as binary/Buffer which breaks JSON.parse on receiver.
function _send(conn, type, data) {
  if (conn?.open) {
    try {
      conn.send(JSON.stringify({ type, data }));
    } catch(e) {
      console.warn('[P2P] _send failed:', e);
    }
=======

function _send(conn, type, data) {
  if (conn?.open) {
    try { conn.send(JSON.stringify({ type, data })); } catch(e) {}
>>>>>>> 229d39f7510f794d97ecf01b8a41be9139875e08
  }
}

function _broadcastAll(ch, type, data, skipId = null) {
  Object.entries(ch.playerConns).forEach(([id, conn]) => {
    if (id !== skipId) _send(conn, type, data);
  });
}

function _sendToHost(ch, type, data) {
<<<<<<< HEAD
  if (ch.hostConn?.open) {
    _send(ch.hostConn, type, data);
  } else {
    // Queue as object — will be flushed via _send() when connection opens
    ch.sendQueue.push({ type, data });
    console.log(`[P2P PLAYER] Queued "${type}" (not connected yet)`);
  }
}

// ─── Core publish ──────────────────────────────────────────────────────────
function _publish(ch, type, data) {
  if (ch.isHost) {
    _emitMsg(ch, type, data);      // fire locally on host
    _broadcastAll(ch, type, data); // fan out to all players
  } else {
    _sendToHost(ch, type, data);   // send to host, host fans out
  }
}

// ─── HOST: handle incoming player connection ───────────────────────────────
=======
  const msg = JSON.stringify({ type, data });
  if (ch.hostConn?.open) {
    try { ch.hostConn.send(msg); } catch(e) {}
  } else {
    ch.sendQueue.push(msg);
  }
}

// ─── Publish (the main send function) ─────────────────────────────────────

function _publish(ch, type, data) {
  if (ch.isHost) {
    _emitMsg(ch, type, data);       // fire on host itself
    _broadcastAll(ch, type, data);  // fan out to all players
  } else {
    _sendToHost(ch, type, data);    // send to host, host fans out
  }
}

// ─── HOST: wire incoming player connection ─────────────────────────────────

>>>>>>> 229d39f7510f794d97ecf01b8a41be9139875e08
function _wirePlayerConn(ch, conn) {
  const pid = conn.peer;
  ch.playerConns[pid] = conn;
  console.log(`[P2P HOST] Player connected: ${pid}`);

  conn.on('data', raw => {
    let msg;
<<<<<<< HEAD
    try {
      // PeerJS default serialization may deliver string or already-parsed object
      msg = typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch(e) {
      console.warn('[P2P HOST] Bad message from', pid, raw);
      return;
    }
=======
    try { msg = JSON.parse(raw); } catch { return; }
>>>>>>> 229d39f7510f794d97ecf01b8a41be9139875e08
    const { type, data } = msg;

    if (type === 'presence:enter') {
      const member = { clientId: pid, data };
      ch.presenceMap[pid] = member;
      _emitPresence(ch, 'enter', member);
<<<<<<< HEAD
      // Send full snapshot back so player's JoinPage knows what game it's in
=======
      // Ack: send full snapshot + room info so JoinPage knows it's connected
>>>>>>> 229d39f7510f794d97ecf01b8a41be9139875e08
      _send(conn, 'presence:snapshot', {
        members: Object.values(ch.presenceMap),
        roomInfo: { game: ch._game, roomCode: ch.roomCode },
      });
<<<<<<< HEAD
      // Tell all other players about the joiner
=======
      // Tell other players about the new joiner
>>>>>>> 229d39f7510f794d97ecf01b8a41be9139875e08
      _broadcastAll(ch, 'presence:enter', { clientId: pid, data }, pid);

    } else if (type === 'presence:update') {
      if (ch.presenceMap[pid]) {
        ch.presenceMap[pid].data = data;
        _emitPresence(ch, 'update', { clientId: pid, data });
        _broadcastAll(ch, 'presence:update', { clientId: pid, data }, pid);
      }

    } else if (type === 'presence:leave') {
<<<<<<< HEAD
      _playerLeave(ch, pid);

    } else {
      // Game message from player → emit on host + fan out to all others
=======
      _handlePlayerLeave(ch, pid);

    } else {
      // Game message: emit on host + fan out to everyone else
>>>>>>> 229d39f7510f794d97ecf01b8a41be9139875e08
      _emitMsg(ch, type, data);
      _broadcastAll(ch, type, data, pid);
    }
  });

  conn.on('close', () => {
    console.log(`[P2P HOST] Player disconnected: ${pid}`);
<<<<<<< HEAD
    _playerLeave(ch, pid);
  });

  conn.on('error', err => console.error(`[P2P HOST] conn error ${pid}:`, err.type));
}

function _playerLeave(ch, pid) {
=======
    _handlePlayerLeave(ch, pid);
  });

  conn.on('error', err => console.error(`[P2P HOST] Conn error ${pid}:`, err));
}

function _handlePlayerLeave(ch, pid) {
>>>>>>> 229d39f7510f794d97ecf01b8a41be9139875e08
  const member = ch.presenceMap[pid];
  if (member) {
    delete ch.presenceMap[pid];
    _emitPresence(ch, 'leave', member);
    _broadcastAll(ch, 'presence:leave', { clientId: pid });
  }
  delete ch.playerConns[pid];
}

<<<<<<< HEAD
// ─── PLAYER: connect to host ───────────────────────────────────────────────
=======
// ─── PLAYER: wire connection to host ──────────────────────────────────────

>>>>>>> 229d39f7510f794d97ecf01b8a41be9139875e08
function _wireHostConn(ch, conn) {
  ch.hostConn = conn;

  conn.on('open', () => {
<<<<<<< HEAD
    console.log('[P2P PLAYER] DataChannel open!');
    ch._reconnectAttempts = 0;

    // Flush queued messages — use _send so serialization is consistent
    const q = [...ch.sendQueue];
    ch.sendQueue = [];
    q.forEach(({ type, data }) => _send(conn, type, data));

    // Announce presence immediately
=======
    console.log('[P2P PLAYER] Connected to host, flushing queue...');
    // Flush queued messages
    ch.sendQueue.forEach(msg => { try { conn.send(msg); } catch(e) {} });
    ch.sendQueue = [];
    // Immediately announce presence
>>>>>>> 229d39f7510f794d97ecf01b8a41be9139875e08
    if (ch.myPresenceData) {
      _send(conn, 'presence:enter', ch.myPresenceData);
    }
  });

  conn.on('data', raw => {
    let msg;
<<<<<<< HEAD
    try {
      msg = typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch(e) {
      console.warn('[P2P PLAYER] Bad message from host:', raw);
      return;
    }
    const { type, data } = msg;

    if (type === 'presence:snapshot') {
=======
    try { msg = JSON.parse(raw); } catch { return; }
    const { type, data } = msg;

    if (type === 'presence:snapshot') {
      // Sync local presence from host snapshot
>>>>>>> 229d39f7510f794d97ecf01b8a41be9139875e08
      data.members.forEach(m => {
        if (!ch.presenceMap[m.clientId]) {
          ch.presenceMap[m.clientId] = m;
          _emitPresence(ch, 'enter', m);
        }
      });
<<<<<<< HEAD
=======
      // Emit room:info so JoinPage switches to lobby state
>>>>>>> 229d39f7510f794d97ecf01b8a41be9139875e08
      if (data.roomInfo) {
        _emitMsg(ch, 'room:info', { ...data.roomInfo, phase: 'lobby' });
      }

    } else if (type === 'presence:enter') {
      const member = { clientId: data.clientId, data: data.data };
      ch.presenceMap[data.clientId] = member;
      _emitPresence(ch, 'enter', member);

    } else if (type === 'presence:update') {
      if (ch.presenceMap[data.clientId]) {
        ch.presenceMap[data.clientId].data = data.data;
        _emitPresence(ch, 'update', { clientId: data.clientId, data: data.data });
      }

    } else if (type === 'presence:leave') {
      const member = ch.presenceMap[data.clientId];
      if (member) {
        delete ch.presenceMap[data.clientId];
        _emitPresence(ch, 'leave', member);
      }

    } else {
<<<<<<< HEAD
      // Regular game message from host
=======
>>>>>>> 229d39f7510f794d97ecf01b8a41be9139875e08
      _emitMsg(ch, type, data);
    }
  });

  conn.on('close', () => {
<<<<<<< HEAD
    console.log('[P2P PLAYER] Host connection closed');
    ch.hostConn = null;
    ch._reconnectAttempts++;
    if (ch._reconnectAttempts <= 5) {
      const delay = Math.min(500 * ch._reconnectAttempts, 5000);
      console.log(`[P2P PLAYER] Reconnecting in ${delay}ms (attempt ${ch._reconnectAttempts})...`);
      setTimeout(() => {
        if (!ch.hostConn?.open && ch.peer) {
=======
    console.log('[P2P PLAYER] Host connection closed, reconnecting...');
    ch.hostConn = null;
    ch._reconnectAttempts++;
    if (ch._reconnectAttempts <= 5) {
      const delay = Math.min(1000 * ch._reconnectAttempts, 8000);
      setTimeout(() => {
        if (!ch.hostConn && ch.peer) {
>>>>>>> 229d39f7510f794d97ecf01b8a41be9139875e08
          const newConn = ch.peer.connect('party-' + ch.roomCode, { reliable: true });
          _wireHostConn(ch, newConn);
        }
      }, delay);
    }
  });

<<<<<<< HEAD
  conn.on('error', err => console.error('[P2P PLAYER] host conn error:', err.type));
}

// ─── Channel registry ──────────────────────────────────────────────────────
const _channels = {};

const ICE = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

// ─── Public API (identical signatures to original ably.js) ─────────────────

export function getAblyClient(_apiKey) {
=======
  conn.on('error', err => console.error('[P2P PLAYER] Host conn error:', err));
}

// ─── Channel registry ──────────────────────────────────────────────────────

const _channels = {};

// ─── Public API ───────────────────────────────────────────────────────────

export function getAblyClient(_apiKey) {
  // No API key needed for P2P — argument kept for drop-in compatibility
>>>>>>> 229d39f7510f794d97ecf01b8a41be9139875e08
  return { clientId: getClientId() };
}

export function getRoomChannel(_client, roomCode) {
<<<<<<< HEAD
  if (!_channels[roomCode]) _channels[roomCode] = makeChannel(roomCode);
=======
  if (!_channels[roomCode]) {
    _channels[roomCode] = makeChannel(roomCode);
  }
>>>>>>> 229d39f7510f794d97ecf01b8a41be9139875e08
  return _channels[roomCode];
}

export async function enterPresence(channel, playerData) {
  const ch = channel;
  ch.myPresenceData = playerData;

  if (playerData.role === 'host') {
<<<<<<< HEAD
    // ── HOST ────────────────────────────────────────────────────────────
=======
    // ── HOST setup ──────────────────────────────────────────────────────
>>>>>>> 229d39f7510f794d97ecf01b8a41be9139875e08
    ch.isHost = true;
    ch._game = playerData.game;
    const hostId = 'party-' + ch.roomCode;
    ch.myClientId = hostId;
<<<<<<< HEAD
    ch.presenceMap[hostId] = { clientId: hostId, data: playerData };

    const tryCreate = (id) => {
      console.log(`[P2P HOST] Creating peer: ${id}`);
      const peer = new Peer(id, { debug: 1, config: ICE });
      ch.peer = peer;

      peer.on('open', pid => console.log(`[P2P HOST] Peer ready: ${pid}`));

      peer.on('connection', conn => {
        // Wire after DataChannel is fully open
=======

    // Add host itself to presence
    const hostMember = { clientId: hostId, data: playerData };
    ch.presenceMap[hostId] = hostMember;

    const tryCreate = (id) => {
      console.log(`[P2P HOST] Creating peer: ${id}`);
      const peer = new Peer(id, {
        debug: 1,
        config: { iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ]},
      });
      ch.peer = peer;

      peer.on('open', pid => console.log(`[P2P HOST] Peer open: ${pid}`));

      peer.on('connection', conn => {
        // Wire after open fires on the incoming side
>>>>>>> 229d39f7510f794d97ecf01b8a41be9139875e08
        conn.on('open', () => _wirePlayerConn(ch, conn));
      });

      peer.on('error', err => {
        if (err.type === 'unavailable-id') {
<<<<<<< HEAD
          console.warn('[P2P HOST] Peer ID taken, retrying with suffix...');
          peer.destroy();
          tryCreate(id + Math.random().toString(36).slice(2, 3));
        } else {
          console.error('[P2P HOST] Peer error:', err.type, err.message);
=======
          console.warn('[P2P HOST] ID taken, retrying...');
          peer.destroy();
          tryCreate(id + Math.random().toString(36).slice(2, 3));
        } else {
          console.error('[P2P HOST] Peer error:', err);
>>>>>>> 229d39f7510f794d97ecf01b8a41be9139875e08
        }
      });
    };

    tryCreate(hostId);

  } else {
<<<<<<< HEAD
    // ── PLAYER ──────────────────────────────────────────────────────────
=======
    // ── PLAYER setup ────────────────────────────────────────────────────
>>>>>>> 229d39f7510f794d97ecf01b8a41be9139875e08
    ch.isHost = false;
    const pid = ch.myClientId;
    console.log(`[P2P PLAYER] Creating peer: ${pid}`);

<<<<<<< HEAD
    const peer = new Peer(pid, { debug: 1, config: ICE });
    ch.peer = peer;

    peer.on('open', () => {
      console.log(`[P2P PLAYER] Peer ready, connecting to host party-${ch.roomCode}...`);
      // No serialization option — use PeerJS default (handles string/object correctly)
=======
    const peer = new Peer(pid, {
      debug: 1,
      config: { iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ]},
    });
    ch.peer = peer;

    peer.on('open', () => {
      console.log(`[P2P PLAYER] Peer open, connecting to host...`);
>>>>>>> 229d39f7510f794d97ecf01b8a41be9139875e08
      const conn = peer.connect('party-' + ch.roomCode, { reliable: true });
      _wireHostConn(ch, conn);
    });

<<<<<<< HEAD
    peer.on('error', err => {
      console.error('[P2P PLAYER] Peer error:', err.type, err.message);
    });
=======
    peer.on('error', err => console.error('[P2P PLAYER] Peer error:', err));
>>>>>>> 229d39f7510f794d97ecf01b8a41be9139875e08
  }
}

export async function updatePresence(channel, playerData) {
  const ch = channel;
  ch.myPresenceData = { ...ch.myPresenceData, ...playerData };
  if (ch.isHost) {
    const m = ch.presenceMap[ch.myClientId];
    if (m) {
      m.data = ch.myPresenceData;
      _emitPresence(ch, 'update', m);
      _broadcastAll(ch, 'presence:update', { clientId: ch.myClientId, data: ch.myPresenceData });
    }
  } else {
    _sendToHost(ch, 'presence:update', ch.myPresenceData);
  }
}

export async function getPresenceMembers(channel) {
  return Object.values(channel.presenceMap);
}

export function subscribePresence(channel, callback) {
  channel._presenceSubs.push(callback);
<<<<<<< HEAD
  return () => { channel._presenceSubs = channel._presenceSubs.filter(c => c !== callback); };
=======
  return () => {
    channel._presenceSubs = channel._presenceSubs.filter(c => c !== callback);
  };
>>>>>>> 229d39f7510f794d97ecf01b8a41be9139875e08
}

export function subscribeChannel(channel, eventName, callback) {
  if (!channel._msgSubs[eventName]) channel._msgSubs[eventName] = [];
  channel._msgSubs[eventName].push(callback);
  return () => {
<<<<<<< HEAD
    if (channel._msgSubs[eventName])
      channel._msgSubs[eventName] = channel._msgSubs[eventName].filter(c => c !== callback);
=======
    channel._msgSubs[eventName] = channel._msgSubs[eventName]?.filter(c => c !== callback);
>>>>>>> 229d39f7510f794d97ecf01b8a41be9139875e08
  };
}

export function subscribeAll(channel, callback) {
  channel._allSubs.push(callback);
<<<<<<< HEAD
  return () => { channel._allSubs = channel._allSubs.filter(c => c !== callback); };
=======
  return () => {
    channel._allSubs = channel._allSubs.filter(c => c !== callback);
  };
>>>>>>> 229d39f7510f794d97ecf01b8a41be9139875e08
}

export async function publishToChannel(channel, type, data) {
  _publish(channel, type, data);
}

export function disconnectAbly() {
<<<<<<< HEAD
  Object.values(_channels).forEach(ch => { try { ch.peer?.destroy(); } catch(_) {} });
  Object.keys(_channels).forEach(k => delete _channels[k]);
  sessionStorage.removeItem('p2p_cid');
=======
  Object.values(_channels).forEach(ch => {
    try { ch.peer?.destroy(); } catch (_) {}
  });
  Object.keys(_channels).forEach(k => delete _channels[k]);
  sessionStorage.removeItem('p2p_client_id');
>>>>>>> 229d39f7510f794d97ecf01b8a41be9139875e08
}
