export const PLAYER_COLORS = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b'];
export const PLAYER_COLORS_CSS = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b'];
export const PLAYER_NAMES_FALLBACK = ['Red', 'Blue', 'Green', 'Yellow'];

export function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export function generatePlayerId() {
  return Math.random().toString(36).slice(2, 10);
}

export function getJoinUrl(roomCode) {
  return `${window.location.origin}/join/${roomCode}`;
}

export function getSettings() {
  return {
    ablyKey: import.meta.env.VITE_ABLY_API_KEY || localStorage.getItem('ably_key') || '',
    geminiKey: import.meta.env.VITE_GEMINI_API_KEY || localStorage.getItem('gemini_key') || '',
  };
}

export function saveSettings(ablyKey, geminiKey) {
  localStorage.setItem('ably_key', ablyKey);
  localStorage.setItem('gemini_key', geminiKey);
}

export function getOrCreatePlayerId() {
  let id = sessionStorage.getItem('player_id');
  if (!id) { id = generatePlayerId(); sessionStorage.setItem('player_id', id); }
  return id;
}

export const SCRIBBLE_WORDS = [
  'apple','banana','cat','dog','elephant','fire','guitar','house',
  'ice cream','jungle','kite','lion','mountain','ninja','ocean',
  'pizza','queen','robot','sun','tree','umbrella','volcano','whale',
  'airplane','beach','castle','diamond','emoji','forest','ghost',
  'helicopter','island','jellyfish','key','lamp','moon','noodle',
  'owl','penguin','rainbow','sandwich','star','tornado','waterfall',
  'crown','rocket','dragon','pirate','burger','cactus','tornado',
  'spaceship','wizard','zombie','dinosaur','mermaid','ninja star',
  'hot dog','rainbow','trophy','camera','glasses','lightning bolt',
];

export const QUIZ_CATEGORIES = [
  { id: 'general', label: 'General Knowledge', emoji: '🌍' },
  { id: 'science', label: 'Science & Nature', emoji: '🔬' },
  { id: 'sports', label: 'Sports', emoji: '⚽' },
  { id: 'movies', label: 'Movies & TV', emoji: '🎬' },
  { id: 'music', label: 'Music', emoji: '🎵' },
  { id: 'history', label: 'History', emoji: '📜' },
  { id: 'food', label: 'Food & Drink', emoji: '🍕' },
  { id: 'technology', label: 'Technology', emoji: '💻' },
];

export async function fetchGeminiQuestions(apiKey, category, count = 8) {
  const prompt = `Generate ${count} fun trivia questions for a party game about "${category}".
Return ONLY a JSON array, no markdown, no explanation. Format:
[{"q":"question text","options":["A","B","C","D"],"correct":0}]
Where correct is the index (0-3) of the right answer.
Make questions fun, varied in difficulty, engaging for a mixed audience.`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.8, maxOutputTokens: 2048 }
      })
    }
  );
  if (!res.ok) throw new Error('Gemini API error: ' + res.status);
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
  const clean = text.replace(/```json|```/g, '').trim();
  return JSON.parse(clean);
}
