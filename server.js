import { WebSocketServer, WebSocket } from 'ws';

const wss = new WebSocketServer({ port: 3001, host: '0.0.0.0' });

// rooms map: roomCode -> Set of clients
const rooms = new Map();
// presence map: roomCode -> Map(clientId -> playerData)
const presence = new Map();

console.log('WebSocket server started on ws://0.0.0.0:3001');

wss.on('connection', (ws) => {
  // Track all rooms this client has joined
  const joinedRooms = new Set();
  let clientId = null;

  console.log('New client connected');

  ws.on('message', (message) => {
    try {
      const { type, room, data, event, clientId: id } = JSON.parse(message.toString());

      switch (type) {
        case 'subscribe':
          clientId = id;
          joinedRooms.add(room);
          if (!rooms.has(room)) rooms.set(room, new Set());
          rooms.get(room).add(ws);
          console.log(`Client ${clientId} subscribed to room ${room}`);
          break;

        case 'publish':
          if (rooms.has(room)) {
            const msg = JSON.stringify({ type: 'message', room, event, data });
            rooms.get(room).forEach(client => {
              if (client !== ws && client.readyState === WebSocket.OPEN) {
                client.send(msg);
              }
            });
          }
          break;

        case 'presence_enter':
        case 'presence_update':
          if (!presence.has(room)) presence.set(room, new Map());
          presence.get(room).set(clientId, data);
          broadcastPresenceEvent(room, type === 'presence_enter' ? 'enter' : 'update', clientId, data);
          console.log(`Presence ${type} for ${clientId} in ${room}`);
          break;

        case 'presence_get':
          const members = presence.has(room)
            ? Array.from(presence.get(room).entries()).map(([id, data]) => ({ clientId: id, data }))
            : [];
          ws.send(JSON.stringify({ type: 'presence_members', room, members }));
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
      joinedRooms.forEach(room => {
        if (rooms.has(room)) {
          rooms.get(room).delete(ws);
          if (rooms.get(room).size === 0) rooms.delete(room);
        }
        if (presence.has(room)) {
          const data = presence.get(room).get(clientId);
          presence.get(room).delete(clientId);
          broadcastPresenceEvent(room, 'leave', clientId, data);
          if (presence.get(room).size === 0) presence.delete(room);
        }
      });
      console.log(`Client ${clientId} disconnected from rooms: ${Array.from(joinedRooms).join(', ')}`);
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
