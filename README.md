# 🎮 Party Games

Three local multiplayer party games built with React + Phaser + Ably.

## Games
- **🥊 Low-Poly Brawl** — 2D platform fighter. Knock players off the stage!
- **🧠 Blitz Quiz** — AI-generated trivia. Buzz in first, answer right!
- **🎨 Scribble Rush** — Draw it, guess it. Scribble.io-style party fun!

## Setup (iOS/Mobile + Vercel)

### 1. Set up API Keys
You need two API keys for all features to work:
- **Ably API Key**: [Get one free at ably.com](https://ably.com) (Required for all games)
- **Gemini API Key**: [Get one free at aistudio.google.com](https://aistudio.google.com/apikey) (Required for Blitz Quiz)

### 2. Deploy to Vercel (from Mobile)
1. **Push your code** to a GitHub repository.
2. Go to **[vercel.com](https://vercel.com)** in Safari/Chrome.
3. Tap **"Add New..."** → **"Project"**.
4. Import your GitHub repository.
5. **Before clicking Deploy**, expand the **"Environment Variables"** section:
   - **Key**: `VITE_ABLY_API_KEY` | **Value**: (your Ably key)
   - **Key**: `VITE_GEMINI_API_KEY` | **Value**: (your Gemini key)
   - Tap **"Add"** after each one.
6. Tap **"Deploy"**.

### 3. Alternative: In-Game Setup
If you don't want to use Vercel environment variables:
1. Open your deployed app.
2. Tap **Settings** ⚙️ on the home screen.
3. Paste your keys directly into the fields and tap **Save Keys**.
*Note: This saves keys to your phone's browser only.*

### 4. Local Development (Optional)
If you have a terminal on iOS (e.g. iSH, a-Shell):
```bash
npm install
npm run dev
```

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
