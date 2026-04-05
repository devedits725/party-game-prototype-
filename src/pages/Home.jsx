import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const GAMES = [
  {
    id: 'fighter',
    name: 'Low-Poly Brawl',
    desc: 'Beat your friends in this fast-paced 2D fighter. Knock them off the stage!',
    emoji: '🥊',
    color: '#ef4444',
    bg: 'rgba(239,68,68,0.1)',
    border: 'rgba(239,68,68,0.3)',
    players: '2–4 players',
    tags: ['Real-time', 'Controller', 'P2P'],
  },
  {
    id: 'quiz',
    name: 'Blitz Quiz',
    desc: 'AI-generated trivia questions. Buzz in first, answer right, win points!',
    emoji: '🧠',
    color: '#f59e0b',
    bg: 'rgba(245,158,11,0.1)',
    border: 'rgba(245,158,11,0.3)',
    players: '2–8 players',
    tags: ['Gemini AI', 'Buzzer', 'P2P'],
  },
  {
    id: 'scribble',
    name: 'Scribble Rush',
    desc: 'Draw it, guess it. One player draws while everyone else races to guess.',
    emoji: '🎨',
    color: '#10b981',
    bg: 'rgba(16,185,129,0.1)',
    border: 'rgba(16,185,129,0.3)',
    players: '3–8 players',
    tags: ['Drawing', 'Guessing', 'P2P'],
  },
];

function getGeminiKey() { return localStorage.getItem('gemini_key') || ''; }
function saveGeminiKey(k) { localStorage.setItem('gemini_key', k); }

export default function Home() {
  const navigate = useNavigate();
  const [showSettings, setShowSettings] = useState(false);
  const [geminiKey, setGeminiKey] = useState(getGeminiKey);
  const [saved, setSaved] = useState(false);

  function handleSave() {
    saveGeminiKey(geminiKey);
    setSaved(true);
    setTimeout(() => { setSaved(false); setShowSettings(false); }, 1000);
  }

  return (
    <div style={{ minHeight: '100vh', padding: '24px 16px' }}>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>

        {/* Header */}
        <div className="flex items-center justify-between" style={{ marginBottom: 48 }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 36, fontWeight: 600, letterSpacing: '-0.5px' }}>
              🎮 Party Games
            </h1>
            <p style={{ color: 'var(--muted)', marginTop: 4 }}>
              Local multiplayer · Direct P2P · No server needed
            </p>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowSettings(!showSettings)}>
            ⚙️ Settings
          </button>
        </div>

        {/* Settings */}
        {showSettings && (
          <div className="card animate-fade-in" style={{ marginBottom: 32, borderColor: 'var(--border2)' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', marginBottom: 4 }}>Settings</h3>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>
              No Ably key needed — games use direct P2P (WebRTC). Only Quiz needs a Gemini key.
            </p>
            <div>
              <label style={{ fontSize: 13, color: 'var(--muted)', display: 'block', marginBottom: 6 }}>
                Gemini API Key
                <span style={{ marginLeft: 8, fontSize: 11 }}>
                  — <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" style={{ color: 'var(--purple-light)' }}>
                    Get free at aistudio.google.com
                  </a>
                </span>
              </label>
              <input
                type="password" placeholder="AIza..."
                value={geminiKey} onChange={e => setGeminiKey(e.target.value)}
                style={{ marginBottom: 12 }}
              />
              <button className="btn btn-primary" onClick={handleSave} style={{ width: 'fit-content' }}>
                {saved ? '✓ Saved!' : 'Save'}
              </button>
            </div>
          </div>
        )}

        {/* Join existing */}
        <div className="card" style={{ marginBottom: 32, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, marginBottom: 4 }}>Join a game</div>
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>
              Have a room code? Go to <strong style={{ color: 'var(--purple-light)' }}>{window.location.origin}/join</strong>
            </div>
          </div>
          <button className="btn btn-ghost" onClick={() => navigate('/join')}>
            Join with code →
          </button>
        </div>

        {/* Game Cards */}
        <div style={{ display: 'grid', gap: 16 }}>
          {GAMES.map(game => (
            <div
              key={game.id}
              className="card"
              style={{
                background: game.bg, borderColor: game.border,
                display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap',
                transition: 'transform 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
              onMouseLeave={e => e.currentTarget.style.transform = ''}
            >
              <div style={{ fontSize: 48, flexShrink: 0 }}>{game.emoji}</div>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
                  <h2 style={{ fontSize: 22, fontWeight: 600, color: game.color }}>{game.name}</h2>
                  <span style={{ fontSize: 12, color: 'var(--muted)', background: 'rgba(0,0,0,0.3)', padding: '2px 8px', borderRadius: 20 }}>
                    {game.players}
                  </span>
                </div>
                <p style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.5, marginBottom: 10 }}>{game.desc}</p>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {game.tags.map(t => (
                    <span key={t} className="badge" style={{ background: 'rgba(0,0,0,0.3)', color: game.color, border: `1px solid ${game.border}` }}>
                      {t}
                    </span>
                  ))}
                </div>
              </div>
              <button
                className="btn btn-lg"
                style={{ background: game.color, color: 'white', whiteSpace: 'nowrap', flexShrink: 0 }}
                onClick={() => navigate(`/host/${game.id}`)}
              >
                Host Game
              </button>
            </div>
          ))}
        </div>

        <p style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 12, marginTop: 32 }}>
          ⚡ WebRTC P2P · No API keys · Works on any browser · Players join via QR code
        </p>
      </div>
    </div>
  );
}
