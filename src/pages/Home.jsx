import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getSettings, saveSettings } from '../lib/utils.js'

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
    tags: ['Real-time', 'Controller'],
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
    tags: ['Gemini AI', 'Buzzer'],
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
    tags: ['Drawing', 'Guessing'],
  },
];

export default function Home() {
  const navigate = useNavigate();
  const [showSettings, setShowSettings] = useState(false);
  const s = getSettings();
  const [ablyKey, setAblyKey] = useState(s.userAblyKey);
  const [geminiKey, setGeminiKey] = useState(s.userGeminiKey);
  const [saved, setSaved] = useState(false);

  const envAblyKey = s.systemAblyKey;
  const envGeminiKey = s.systemGeminiKey;

  const hasAbly = !!(ablyKey || envAblyKey);
  const hasGemini = !!(geminiKey || envGeminiKey);

  function handleHost(gameId) {
    if (!hasAbly) { setShowSettings(true); return; }
    navigate(`/host/${gameId}`);
  }

  function handleSave() {
    saveSettings(ablyKey, geminiKey);
    setSaved(true);
    setTimeout(() => { setSaved(false); setShowSettings(false); }, 1000);
  }

  function clearUserKeys() {
    setAblyKey('');
    setGeminiKey('');
    saveSettings('', '');
    setSaved(true);
    setTimeout(() => { setSaved(false); }, 1000);
  }

  return (
    <div style={{ minHeight: '100vh', padding: '24px 16px' }}>
      {/* Header */}
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 48 }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 36, fontWeight: 600, letterSpacing: '-0.5px' }}>
              🎮 Party Games
            </h1>
            <p style={{ color: 'var(--muted)', marginTop: 4 }}>Local multiplayer for any device</p>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowSettings(!showSettings)}>
            ⚙️ Settings
          </button>
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <div className="card animate-fade-in" style={{ marginBottom: 32, borderColor: 'var(--border2)' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', marginBottom: 16 }}>API Keys</h3>
            {(envAblyKey || envGeminiKey) && (
              <div style={{ fontSize: 12, color: 'var(--purple-light)', marginBottom: 16, background: 'rgba(168, 85, 247, 0.1)', padding: '8px 12px', borderRadius: 8 }}>
                ✨ System keys are active. You can still override them below if needed.
              </div>
            )}
            <div style={{ display: 'grid', gap: 12 }}>
              <div>
                <label style={{ fontSize: 13, color: 'var(--muted)', display: 'block', marginBottom: 6 }}>
                  Ably API Key {!envAblyKey && <span style={{ color: 'var(--red)' }}>*</span>}
                  <span style={{ marginLeft: 8, fontSize: 11 }}>
                    — <a href="https://ably.com" target="_blank" rel="noreferrer" style={{ color: 'var(--purple-light)' }}>Get free key at ably.com</a>
                  </span>
                </label>
                <input
                  type="password"
                  placeholder={envAblyKey ? "System Managed Key Active" : "xxxxx.xxxxxx:xxxxxxxxxxxxxxxx"}
                  value={ablyKey}
                  onChange={e => setAblyKey(e.target.value)}
                />
              </div>
              <div>
                <label style={{ fontSize: 13, color: 'var(--muted)', display: 'block', marginBottom: 6 }}>
                  Gemini API Key <span style={{ color: 'var(--muted)', fontSize: 11 }}>(required for Quiz game)</span>
                </label>
                <input
                  type="password"
                  placeholder={envGeminiKey ? "System Managed Key Active" : "AIza..."}
                  value={geminiKey}
                  onChange={e => setGeminiKey(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <button className="btn btn-primary" onClick={handleSave} style={{ width: 'fit-content' }}>
                  {saved ? '✓ Saved!' : 'Save Keys'}
                </button>
                {(ablyKey || geminiKey) && (
                  <button className="btn btn-ghost" onClick={clearUserKeys} style={{ width: 'fit-content', borderColor: 'rgba(239,68,68,0.3)', color: 'var(--red)' }}>
                    Use System Keys
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Join existing game */}
        <div className="card" style={{ marginBottom: 32, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, marginBottom: 4 }}>Join a game</div>
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>Have a room code? Enter it on your phone at <strong style={{ color: 'var(--purple-light)' }}>{window.location.origin}/join</strong></div>
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
                background: game.bg,
                borderColor: game.border,
                display: 'flex', gap: 20, alignItems: 'center',
                flexWrap: 'wrap',
                transition: 'transform 0.15s, box-shadow 0.15s',
                cursor: 'default',
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button
                  className="btn btn-lg"
                  style={{
                    background: game.color,
                    color: 'white',
                    whiteSpace: 'nowrap',
                    opacity: (game.id === 'quiz' && !hasGemini) || !hasAbly ? 0.6 : 1
                  }}
                  onClick={() => handleHost(game.id)}
                >
                  {(game.id === 'quiz' && !hasGemini) ? 'Requires Gemini' : !hasAbly ? 'Setup Required' : 'Host Game'}
                </button>
              </div>
            </div>
          ))}
        </div>

        <p style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 12, marginTop: 32 }}>
          Works on any browser · No app download needed · Players join with QR code
        </p>
      </div>
    </div>
  );
}
