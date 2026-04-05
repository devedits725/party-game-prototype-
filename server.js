import { WebSocketServer, WebSocket } from 'ws';

const wss = new WebSocketServer({ port: 3001, host: '0.0.0.0' });

// rooms map: roomCode -> Set of clients
const rooms = new Map();
// presence map: roomCode -> Map(clientId -> playerData)
const presence = new Map();

console.log('WebSocket server started on ws://0.0.0.0:3001');

wss.on('connection', (ws) => {
  // Track all rooms this client has joined in this connection
  const joinedRooms = new Set();
  let clientId = null;

  console.log('New client connected');

  ws.on('message', (message) => {
    try {
      const msgStr = message.toString();
      const msg = JSON.parse(msgStr);
      const { type, room, data, event, clientId: id } = msg;

      switch (type) {
        case 'subscribe':
          if (id) clientId = id;
          if (room) {
            joinedRooms.add(room);
            if (!rooms.has(room)) rooms.set(room, new Set());
            rooms.get(room).add(ws);
            console.log(`[SUBSCRIBE] Client ${clientId} joined room ${room}`);
          }
          break;

        case 'publish':
          if (room && rooms.has(room)) {
            const broadcastMsg = JSON.stringify({ type: 'message', room, event, data });
            console.log(`[PUBLISH] Room ${room} event ${event}`);
            rooms.get(room).forEach(client => {
              if (client !== ws && client.readyState === WebSocket.OPEN) {
                client.send(broadcastMsg);
              }
            });
          }
          break;

        case 'presence_enter':
        case 'presence_update':
          if (id) clientId = id;
          if (room && clientId) {
            if (!presence.has(room)) presence.set(room, new Map());
            presence.get(room).set(clientId, data);
            broadcastPresenceEvent(room, type === 'presence_enter' ? 'enter' : 'update', clientId, data);
            console.log(`[PRESENCE] ${type} for ${clientId} in ${room}`);
          }
          break;

        case 'presence_leave':
          if (room && clientId && presence.has(room)) {
            const oldData = presence.get(room).get(clientId);
            presence.get(room).delete(clientId);
            broadcastPresenceEvent(room, 'leave', clientId, oldData);
            console.log(`[PRESENCE] leave for ${clientId} in ${room}`);
          }
          break;

        case 'presence_get':
          if (room) {
            const members = presence.has(room)
              ? Array.from(presence.get(room).entries()).map(([id, data]) => ({ clientId: id, data }))
              : [];
            ws.send(JSON.stringify({ type: 'presence_members', room, members }));
            console.log(`[PRESENCE] get for ${room} (returning ${members.length} members)`);
          }
          break;

        case 'ping':
          ws.send(JSON.stringify({ type: 'pong' }));
          break;
      }
    } catch (err) {
      console.error('Error handling message:', err);
    }
  });

  ws.on('close', () => {
    if (clientId) {
      console.log(`Client ${clientId} connection closing. Cleaning up ${joinedRooms.size} rooms.`);
      joinedRooms.forEach(room => {
        if (rooms.has(room)) {
          rooms.get(room).delete(ws);
          if (rooms.get(room).size === 0) rooms.delete(room);
        }
        if (presence.has(room) && presence.get(room).has(clientId)) {
          const data = presence.get(room).get(clientId);
          presence.get(room).delete(clientId);
          broadcastPresenceEvent(room, 'leave', clientId, data);
          if (presence.get(room).size === 0) presence.delete(room);
        }
      });
      console.log(`Client ${clientId} fully disconnected`);
    } else {
      console.log('Anonymous client disconnected');
    }
  });
});

function broadcastPresenceEvent(room, action, clientId, data) {
  if (!rooms.has(room)) return;
  const msg = JSON.stringify({ type: 'presence_change', room, action, clientId, data });
  rooms.get(room).forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  });
}

// Heartbeat ping every 30s
setInterval(() => {
  wss.clients.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.ping();
    }
  });
}, 30000);
