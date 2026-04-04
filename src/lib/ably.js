import Ably from 'ably';

let client = null;
let lastKey = null;
let lastClientId = null;

export function getAblyClient(apiKey, clientId) {
  if (client && lastKey === apiKey && lastClientId === clientId) return client;

  if (client) {
    client.close();
  }

  lastKey = apiKey;
  lastClientId = clientId;
  client = new Ably.Realtime({ key: apiKey, clientId, echoMessages: false });
  return client;
}

export function getRoomChannel(ablyClient, roomCode) {
  return ablyClient.channels.get(`party:${roomCode}`);
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
  channel.presence.subscribe(callback);
  return () => channel.presence.unsubscribe(callback);
}

export function subscribeChannel(channel, eventName, callback) {
  channel.subscribe(eventName, (msg) => callback(msg.data));
  return () => channel.unsubscribe(eventName, callback);
}

export function subscribeAll(channel, callback) {
  channel.subscribe((msg) => callback(msg.name, msg.data));
  return () => channel.unsubscribe(callback);
}

export function disconnectAbly() {
  if (client) { client.close(); client = null; lastKey = null; lastClientId = null; }
}
