# 🎮 Party Games

Three local multiplayer party games built with React + Phaser + Ably.

## Games
- **🥊 Low-Poly Brawl** — 2D platform fighter. Knock players off the stage!
- **🧠 Blitz Quiz** — AI-generated trivia. Buzz in first, answer right!
- **🎨 Scribble Rush** — Draw it, guess it. Scribble.io-style party fun!

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Get API keys
- **Ably** (required for all games): Free at https://ably.com — grab a root API key
- **Gemini** (required for Quiz): Free at https://aistudio.google.com/apikey

### 3. Run dev server
```bash
npm run dev
```

Open `http://localhost:5173` on your host screen (TV/monitor).

### 4. Host a game
1. Click **Settings** → paste your Ably key (+ Gemini key for Quiz)
2. Click **Host Game** on any game card
3. Players scan the QR code or go to `/join` on their phones
4. Hit **Start** when everyone is in!

## Controls

### 🥊 Fighter
| Player | Move | Jump | Attack | Heavy |
|--------|------|------|--------|-------|
| P1 | WASD | W | Z | X |
| P2 | Arrow keys | ↑ | J | K |
| Gamepad | Left stick / D-pad | A button | X button | Y button |
| Phone | D-pad buttons | Jump btn | Attack btn | Heavy btn |

### 🧠 Quiz
- Players use their phones as buzzers
- First to buzz and answer correctly wins points
- Wrong answer = 3 second freeze penalty
- Speed bonus for fast correct answers

### 🎨 Scribble
- Drawer gets 3 word choices on their phone
- Draw with touch canvas on phone
- Others type guesses — faster = more points
- Hint letters revealed over time

## Architecture

```
Host browser (game authority)
    ↕ Ably pub/sub
Players' phones (controllers)
```

- **No backend required** — host browser runs all game logic
- **Ably** handles all real-time messaging with <50ms latency
- **Phaser 3** powers the fighter game physics & rendering
- **Gemini API** generates fresh quiz questions per session

## Deploy
```bash
npm run build
# Deploy /dist to Vercel, Netlify, or any static host
```
