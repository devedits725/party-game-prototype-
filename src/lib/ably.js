/**
 * PeerJS P2P drop-in replacement for ably.js
 *
 * KEY FIXES in this version:
 *  - Removed serialization:'raw' — caused player→host messages to be
 *    received as ArrayBuffer instead of string, breaking JSON.parse
 *  - sendQueue now stores {type,data} objects not raw strings,
 *    flushed correctly via _send() after channel opens
 *  - Public room discovery via PeerJS peer ID convention + localStorage
 *    (rooms register themselves under a well-known key so JoinPage can list them)
 */

import Peer from 'peerjs';

// ─── Client ID ─────────────────────────────────────────────────────────────
function getClientId() {
  let id = sessionStorage.getItem('p2p_cid');
  if (!id) {
    id = 'p' + Math.random().toString(36).slice(2, 10);
    sessionStorage.setItem('p2p_cid', id);
  }
  return id;
}

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
}

function _emitPresence(ch, action, member) {
  ch._presenceSubs.forEach(cb => {
    try { cb({ action, clientId: member.clientId, data: member.data }); } catch(e) {}
  });
}

// ─── Send helpers ──────────────────────────────────────────────────────────
// IMPORTANT: always use default PeerJS serialization (json-like).
// Do NOT use serialization:'raw' — it sends as binary/Buffer which breaks JSON.parse on receiver.
function _send(conn, type, data) {
  if (conn?.open) {
    try {
      conn.send(JSON.stringify({ type, data }));
    } catch(e) {
      console.warn('[P2P] _send failed:', e);
    }
  }
}

function _broadcastAll(ch, type, data, skipId = null) {
  Object.entries(ch.playerConns).forEach(([id, conn]) => {
    if (id !== skipId) _send(conn, type, data);
  });
}

function _sendToHost(ch, type, data) {
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
function _wirePlayerConn(ch, conn) {
  const pid = conn.peer;
  ch.playerConns[pid] = conn;
  console.log(`[P2P HOST] Player connected: ${pid}`);

  conn.on('data', raw => {
    let msg;
    try {
      // PeerJS default serialization may deliver string or already-parsed object
      msg = typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch(e) {
      console.warn('[P2P HOST] Bad message from', pid, raw);
      return;
    }
    const { type, data } = msg;

    if (type === 'presence:enter') {
      const member = { clientId: pid, data };
      ch.presenceMap[pid] = member;
      _emitPresence(ch, 'enter', member);
      // Send full snapshot back so player's JoinPage knows what game it's in
      _send(conn, 'presence:snapshot', {
        members: Object.values(ch.presenceMap),
        roomInfo: { game: ch._game, roomCode: ch.roomCode },
      });
      // Tell all other players about the joiner
      _broadcastAll(ch, 'presence:enter', { clientId: pid, data }, pid);

    } else if (type === 'presence:update') {
      if (ch.presenceMap[pid]) {
        ch.presenceMap[pid].data = data;
        _emitPresence(ch, 'update', { clientId: pid, data });
        _broadcastAll(ch, 'presence:update', { clientId: pid, data }, pid);
      }

    } else if (type === 'presence:leave') {
      _playerLeave(ch, pid);

    } else {
      // Game message from player → emit on host + fan out to all others
      _emitMsg(ch, type, data);
      _broadcastAll(ch, type, data, pid);
    }
  });

  conn.on('close', () => {
    console.log(`[P2P HOST] Player disconnected: ${pid}`);
    _playerLeave(ch, pid);
  });

  conn.on('error', err => console.error(`[P2P HOST] conn error ${pid}:`, err.type));
}

function _playerLeave(ch, pid) {
  const member = ch.presenceMap[pid];
  if (member) {
    delete ch.presenceMap[pid];
    _emitPresence(ch, 'leave', member);
    _broadcastAll(ch, 'presence:leave', { clientId: pid });
  }
  delete ch.playerConns[pid];
}

// ─── PLAYER: connect to host ───────────────────────────────────────────────
function _wireHostConn(ch, conn) {
  ch.hostConn = conn;

  conn.on('open', () => {
    console.log('[P2P PLAYER] DataChannel open!');
    ch._reconnectAttempts = 0;

    // Flush queued messages — use _send so serialization is consistent
    const q = [...ch.sendQueue];
    ch.sendQueue = [];
    q.forEach(({ type, data }) => _send(conn, type, data));

    // Announce presence immediately
    if (ch.myPresenceData) {
      _send(conn, 'presence:enter', ch.myPresenceData);
    }
  });

  conn.on('data', raw => {
    let msg;
    try {
      msg = typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch(e) {
      console.warn('[P2P PLAYER] Bad message from host:', raw);
      return;
    }
    const { type, data } = msg;

    if (type === 'presence:snapshot') {
      data.members.forEach(m => {
        if (!ch.presenceMap[m.clientId]) {
          ch.presenceMap[m.clientId] = m;
          _emitPresence(ch, 'enter', m);
        }
      });
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
      // Regular game message from host
      _emitMsg(ch, type, data);
    }
  });

  conn.on('close', () => {
    console.log('[P2P PLAYER] Host connection closed');
    ch.hostConn = null;
    ch._reconnectAttempts++;
    if (ch._reconnectAttempts <= 5) {
      const delay = Math.min(500 * ch._reconnectAttempts, 5000);
      console.log(`[P2P PLAYER] Reconnecting in ${delay}ms (attempt ${ch._reconnectAttempts})...`);
      setTimeout(() => {
        if (!ch.hostConn?.open && ch.peer) {
          const newConn = ch.peer.connect('party-' + ch.roomCode, { reliable: true });
          _wireHostConn(ch, newConn);
        }
      }, delay);
    }
  });

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
  return { clientId: getClientId() };
}

export function getRoomChannel(_client, roomCode) {
  if (!_channels[roomCode]) _channels[roomCode] = makeChannel(roomCode);
  return _channels[roomCode];
}

export async function enterPresence(channel, playerData) {
  const ch = channel;
  ch.myPresenceData = playerData;

  if (playerData.role === 'host') {
    // ── HOST ────────────────────────────────────────────────────────────
    ch.isHost = true;
    ch._game = playerData.game;
    const hostId = 'party-' + ch.roomCode;
    ch.myClientId = hostId;
    ch.presenceMap[hostId] = { clientId: hostId, data: playerData };

    const tryCreate = (id) => {
      console.log(`[P2P HOST] Creating peer: ${id}`);
      const peer = new Peer(id, { debug: 1, config: ICE });
      ch.peer = peer;

      peer.on('open', pid => console.log(`[P2P HOST] Peer ready: ${pid}`));

      peer.on('connection', conn => {
        // Wire after DataChannel is fully open
        conn.on('open', () => _wirePlayerConn(ch, conn));
      });

      peer.on('error', err => {
        if (err.type === 'unavailable-id') {
          console.warn('[P2P HOST] Peer ID taken, retrying with suffix...');
          peer.destroy();
          tryCreate(id + Math.random().toString(36).slice(2, 3));
        } else {
          console.error('[P2P HOST] Peer error:', err.type, err.message);
        }
      });
    };

    tryCreate(hostId);

  } else {
    // ── PLAYER ──────────────────────────────────────────────────────────
    ch.isHost = false;
    const pid = ch.myClientId;
    console.log(`[P2P PLAYER] Creating peer: ${pid}`);

    const peer = new Peer(pid, { debug: 1, config: ICE });
    ch.peer = peer;

    peer.on('open', () => {
      console.log(`[P2P PLAYER] Peer ready, connecting to host party-${ch.roomCode}...`);
      // No serialization option — use PeerJS default (handles string/object correctly)
      const conn = peer.connect('party-' + ch.roomCode, { reliable: true });
      _wireHostConn(ch, conn);
    });

    peer.on('error', err => {
      console.error('[P2P PLAYER] Peer error:', err.type, err.message);
    });
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
  return () => { channel._presenceSubs = channel._presenceSubs.filter(c => c !== callback); };
}

export function subscribeChannel(channel, eventName, callback) {
  if (!channel._msgSubs[eventName]) channel._msgSubs[eventName] = [];
  channel._msgSubs[eventName].push(callback);
  return () => {
    if (channel._msgSubs[eventName])
      channel._msgSubs[eventName] = channel._msgSubs[eventName].filter(c => c !== callback);
  };
}

export function subscribeAll(channel, callback) {
  channel._allSubs.push(callback);
  return () => { channel._allSubs = channel._allSubs.filter(c => c !== callback); };
}

export async function publishToChannel(channel, type, data) {
  _publish(channel, type, data);
}

export function disconnectAbly() {
  Object.values(_channels).forEach(ch => { try { ch.peer?.destroy(); } catch(_) {} });
  Object.keys(_channels).forEach(k => delete _channels[k]);
  sessionStorage.removeItem('p2p_cid');
}
