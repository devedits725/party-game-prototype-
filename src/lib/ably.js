/**
 * PeerJS P2P drop-in replacement for ably.js
 *
 * Architecture (star topology):
 *   HOST  → creates Peer ID "party-ROOMCODE", accepts all connections
 *   PLAYER → creates Peer with random ID, connects to "party-ROOMCODE"
 *   HOST fans out every game message to all connected players
 *   Presence is simulated via protocol messages over DataChannels
 *
 * All exported function signatures identical to original ably.js.
 * Nothing else in the codebase needs to change.
 */

import Peer from 'peerjs';

// ─── Client ID ────────────────────────────────────────────────────────────

function getClientId() {
  let id = sessionStorage.getItem('p2p_client_id');
  if (!id) {
    id = 'p' + Math.random().toString(36).slice(2, 10);
    sessionStorage.setItem('p2p_client_id', id);
  }
  return id;
}

// ─── Channel factory ──────────────────────────────────────────────────────

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
}

function _emitPresence(ch, action, member) {
  ch._presenceSubs.forEach(cb => {
    try { cb({ action, clientId: member.clientId, data: member.data }); } catch(e) {}
  });
}

// ─── Send helpers ──────────────────────────────────────────────────────────

function _send(conn, type, data) {
  if (conn?.open) {
    try { conn.send(JSON.stringify({ type, data })); } catch(e) {}
  }
}

function _broadcastAll(ch, type, data, skipId = null) {
  Object.entries(ch.playerConns).forEach(([id, conn]) => {
    if (id !== skipId) _send(conn, type, data);
  });
}

function _sendToHost(ch, type, data) {
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

function _wirePlayerConn(ch, conn) {
  const pid = conn.peer;
  ch.playerConns[pid] = conn;
  console.log(`[P2P HOST] Player connected: ${pid}`);

  conn.on('data', raw => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    const { type, data } = msg;

    if (type === 'presence:enter') {
      const member = { clientId: pid, data };
      ch.presenceMap[pid] = member;
      _emitPresence(ch, 'enter', member);
      // Ack: send full snapshot + room info so JoinPage knows it's connected
      _send(conn, 'presence:snapshot', {
        members: Object.values(ch.presenceMap),
        roomInfo: { game: ch._game, roomCode: ch.roomCode },
      });
      // Tell other players about the new joiner
      _broadcastAll(ch, 'presence:enter', { clientId: pid, data }, pid);

    } else if (type === 'presence:update') {
      if (ch.presenceMap[pid]) {
        ch.presenceMap[pid].data = data;
        _emitPresence(ch, 'update', { clientId: pid, data });
        _broadcastAll(ch, 'presence:update', { clientId: pid, data }, pid);
      }

    } else if (type === 'presence:leave') {
      _handlePlayerLeave(ch, pid);

    } else {
      // Game message: emit on host + fan out to everyone else
      _emitMsg(ch, type, data);
      _broadcastAll(ch, type, data, pid);
    }
  });

  conn.on('close', () => {
    console.log(`[P2P HOST] Player disconnected: ${pid}`);
    _handlePlayerLeave(ch, pid);
  });

  conn.on('error', err => console.error(`[P2P HOST] Conn error ${pid}:`, err));
}

function _handlePlayerLeave(ch, pid) {
  const member = ch.presenceMap[pid];
  if (member) {
    delete ch.presenceMap[pid];
    _emitPresence(ch, 'leave', member);
    _broadcastAll(ch, 'presence:leave', { clientId: pid });
  }
  delete ch.playerConns[pid];
}

// ─── PLAYER: wire connection to host ──────────────────────────────────────

function _wireHostConn(ch, conn) {
  ch.hostConn = conn;

  conn.on('open', () => {
    console.log('[P2P PLAYER] Connected to host, flushing queue...');
    // Flush queued messages
    ch.sendQueue.forEach(msg => { try { conn.send(msg); } catch(e) {} });
    ch.sendQueue = [];
    // Immediately announce presence
    if (ch.myPresenceData) {
      _send(conn, 'presence:enter', ch.myPresenceData);
    }
  });

  conn.on('data', raw => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    const { type, data } = msg;

    if (type === 'presence:snapshot') {
      // Sync local presence from host snapshot
      data.members.forEach(m => {
        if (!ch.presenceMap[m.clientId]) {
          ch.presenceMap[m.clientId] = m;
          _emitPresence(ch, 'enter', m);
        }
      });
      // Emit room:info so JoinPage switches to lobby state
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
      _emitMsg(ch, type, data);
    }
  });

  conn.on('close', () => {
    console.log('[P2P PLAYER] Host connection closed, reconnecting...');
    ch.hostConn = null;
    ch._reconnectAttempts++;
    if (ch._reconnectAttempts <= 5) {
      const delay = Math.min(1000 * ch._reconnectAttempts, 8000);
      setTimeout(() => {
        if (!ch.hostConn && ch.peer) {
          const newConn = ch.peer.connect('party-' + ch.roomCode, { reliable: true });
          _wireHostConn(ch, newConn);
        }
      }, delay);
    }
  });

  conn.on('error', err => console.error('[P2P PLAYER] Host conn error:', err));
}

// ─── Channel registry ──────────────────────────────────────────────────────

const _channels = {};

// ─── Public API ───────────────────────────────────────────────────────────

export function getAblyClient(_apiKey) {
  // No API key needed for P2P — argument kept for drop-in compatibility
  return { clientId: getClientId() };
}

export function getRoomChannel(_client, roomCode) {
  if (!_channels[roomCode]) {
    _channels[roomCode] = makeChannel(roomCode);
  }
  return _channels[roomCode];
}

export async function enterPresence(channel, playerData) {
  const ch = channel;
  ch.myPresenceData = playerData;

  if (playerData.role === 'host') {
    // ── HOST setup ──────────────────────────────────────────────────────
    ch.isHost = true;
    ch._game = playerData.game;
    const hostId = 'party-' + ch.roomCode;
    ch.myClientId = hostId;

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
        conn.on('open', () => _wirePlayerConn(ch, conn));
      });

      peer.on('error', err => {
        if (err.type === 'unavailable-id') {
          console.warn('[P2P HOST] ID taken, retrying...');
          peer.destroy();
          tryCreate(id + Math.random().toString(36).slice(2, 3));
        } else {
          console.error('[P2P HOST] Peer error:', err);
        }
      });
    };

    tryCreate(hostId);

  } else {
    // ── PLAYER setup ────────────────────────────────────────────────────
    ch.isHost = false;
    const pid = ch.myClientId;
    console.log(`[P2P PLAYER] Creating peer: ${pid}`);

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
      const conn = peer.connect('party-' + ch.roomCode, { reliable: true });
      _wireHostConn(ch, conn);
    });

    peer.on('error', err => console.error('[P2P PLAYER] Peer error:', err));
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
  return () => {
    channel._presenceSubs = channel._presenceSubs.filter(c => c !== callback);
  };
}

export function subscribeChannel(channel, eventName, callback) {
  if (!channel._msgSubs[eventName]) channel._msgSubs[eventName] = [];
  channel._msgSubs[eventName].push(callback);
  return () => {
    channel._msgSubs[eventName] = channel._msgSubs[eventName]?.filter(c => c !== callback);
  };
}

export function subscribeAll(channel, callback) {
  channel._allSubs.push(callback);
  return () => {
    channel._allSubs = channel._allSubs.filter(c => c !== callback);
  };
}

export async function publishToChannel(channel, type, data) {
  _publish(channel, type, data);
}

export function disconnectAbly() {
  Object.values(_channels).forEach(ch => {
    try { ch.peer?.destroy(); } catch (_) {}
  });
  Object.keys(_channels).forEach(k => delete _channels[k]);
  sessionStorage.removeItem('p2p_client_id');
}
