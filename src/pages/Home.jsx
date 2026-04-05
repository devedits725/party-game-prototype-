import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getPublicRooms } from '../lib/ably.js'

const GAMES = [
  { id: 'fighter',  name: 'Low-Poly Brawl', desc: 'Fast 2D platform fighter. Knock players off the stage!',   emoji: '🥊', color: '#ef4444', bg: 'rgba(239,68,68,0.08)',  border: 'rgba(239,68,68,0.25)',  players: '2–4', tags: ['Real-time','Controller'] },
  { id: 'quiz',     name: 'Blitz Quiz',      desc: 'AI trivia. Buzz in first, answer right, win points!',      emoji: '🧠', color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.25)', players: '2–8', tags: ['Gemini AI','Buzzer'] },
  { id: 'scribble', name: 'Scribble Rush',   desc: 'Draw it, guess it. One draws, everyone else races.',       emoji: '🎨', color: '#10b981', bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.25)', players: '3–8', tags: ['Drawing','Guessing'] },
];

const GAME_META = { fighter: GAMES[0], quiz: GAMES[1], scribble: GAMES[2] };

function getGeminiKey() { return localStorage.getItem('gemini_key') || ''; }
function saveGeminiKey(k) { localStorage.setItem('gemini_key', k); }

export default function Home() {
  const navigate = useNavigate();
  const [showSettings, setShowSettings] = useState(false);
  const [geminiKey, setGeminiKey] = useState(getGeminiKey);
  const [saved, setSaved] = useState(false);
  const [publicRooms, setPublicRooms] = useState({});
  const [tab, setTab] = useState('games'); // games | browse

  // Refresh public room list every 5s
  useEffect(() => {
    const refresh = () => setPublicRooms(getPublicRooms());
    refresh();
    const t = setInterval(refresh, 5000);
    return () => clearInterval(t);
  }, []);

  function handleSave() {
    saveGeminiKey(geminiKey);
    setSaved(true);
    setTimeout(() => { setSaved(false); setShowSettings(false); }, 1000);
  }

  const roomList = Object.values(publicRooms);

  return (
    <div style={{ minHeight: '100vh', padding: '24px 16px' }}>
      <div style={{ maxWidth: 820, margin: '0 auto' }}>

        {/* Header */}
        <div className="flex items-center justify-between" style={{ marginBottom: 36 }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 34, fontWeight: 600, letterSpacing: '-0.5px' }}>
              🎮 Party Games
            </h1>
            <p style={{ color: 'var(--muted)', marginTop: 4, fontSize: 14 }}>
              P2P multiplayer · No server · No API key
            </p>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowSettings(!showSettings)}>
            ⚙️ Settings
          </button>
        </div>

        {/* Settings panel */}
        {showSettings && (
          <div className="card animate-fade-in" style={{ marginBottom: 28 }}>
            <h3 style={{ fontFamily: 'var(--font-display)', marginBottom: 4 }}>Settings</h3>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 14 }}>
              Only needed for the Quiz game — all other games are completely keyless.
            </p>
            <label style={{ fontSize: 13, color: 'var(--muted)', display: 'block', marginBottom: 6 }}>
              Gemini API Key
              <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer"
                style={{ color: 'var(--purple-light)', marginLeft: 8, fontSize: 11 }}>
                Get free key →
              </a>
            </label>
            <input type="password" placeholder="AIza..." value={geminiKey}
              onChange={e => setGeminiKey(e.target.value)} style={{ marginBottom: 12 }} />
            <button className="btn btn-primary" onClick={handleSave} style={{ width: 'fit-content' }}>
              {saved ? '✓ Saved!' : 'Save'}
            </button>
          </div>
        )}

        {/* Tab switcher */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: 'var(--surface)', borderRadius: 12, padding: 4, width: 'fit-content' }}>
          {[['games', '🕹️ Host a Game'], ['browse', `🌐 Browse Rooms ${roomList.length > 0 ? `(${roomList.length})` : ''}`]].map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)} style={{
              padding: '8px 20px', borderRadius: 9, border: 'none', cursor: 'pointer',
              fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 500,
              background: tab === id ? 'var(--purple)' : 'transparent',
              color: tab === id ? 'white' : 'var(--muted)',
              transition: 'all 0.15s',
            }}>
              {label}
            </button>
          ))}
        </div>

        {/* ── HOST TAB ── */}
        {tab === 'games' && (
          <div>
            {/* Join box */}
            <div className="card" style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 180 }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, marginBottom: 3 }}>Join an existing game</div>
                <div style={{ fontSize: 13, color: 'var(--muted)' }}>Have a room code? Open <strong style={{ color: 'var(--purple-light)' }}>{window.location.origin}/join</strong> on your phone</div>
              </div>
              <button className="btn btn-ghost" onClick={() => navigate('/join')}>Join with code →</button>
            </div>

            {/* Game cards */}
            <div style={{ display: 'grid', gap: 14 }}>
              {GAMES.map(game => (
                <div key={game.id} className="card" style={{
                  background: game.bg, borderColor: game.border,
                  display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap',
                  transition: 'transform 0.15s',
                }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                  onMouseLeave={e => e.currentTarget.style.transform = ''}
                >
                  <div style={{ fontSize: 44, flexShrink: 0 }}>{game.emoji}</div>
                  <div style={{ flex: 1, minWidth: 180 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5, flexWrap: 'wrap' }}>
                      <h2 style={{ fontSize: 20, fontWeight: 600, color: game.color }}>{game.name}</h2>
                      <span style={{ fontSize: 11, color: 'var(--muted)', background: 'rgba(0,0,0,0.3)', padding: '2px 8px', borderRadius: 20 }}>{game.players}p</span>
                    </div>
                    <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.5, marginBottom: 8 }}>{game.desc}</p>
                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                      {game.tags.map(t => (
                        <span key={t} className="badge" style={{ background: 'rgba(0,0,0,0.3)', color: game.color, border: `1px solid ${game.border}`, fontSize: 11 }}>{t}</span>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
                    <button
                      className="btn"
                      style={{ background: game.color, color: 'white', padding: '10px 20px', fontSize: 14 }}
                      onClick={() => navigate(`/host/${game.id}/public`)}
                    >
                      🌐 Public
                    </button>
                    <button
                      className="btn btn-ghost"
                      style={{ padding: '10px 20px', fontSize: 14 }}
                      onClick={() => navigate(`/host/${game.id}/private`)}
                    >
                      🔒 Private
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <p style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 12, marginTop: 28 }}>
              🌐 Public — visible to anyone on same network &nbsp;·&nbsp; 🔒 Private — room code required
            </p>
          </div>
        )}

        {/* ── BROWSE TAB ── */}
        {tab === 'browse' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <p style={{ color: 'var(--muted)', fontSize: 13 }}>
                Public rooms hosted on this network right now
              </p>
              <button className="btn btn-ghost btn-sm" onClick={() => setPublicRooms(getPublicRooms())}>
                ↻ Refresh
              </button>
            </div>

            {roomList.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: '48px 24px' }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>🏜️</div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, marginBottom: 8 }}>No public rooms</div>
                <div style={{ color: 'var(--muted)', fontSize: 14 }}>Host a public game from the "Host a Game" tab to appear here.</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {roomList.map(room => {
                  const g = GAME_META[room.game] || {};
                  const ago = Math.round((Date.now() - room.ts) / 60000);
                  return (
                    <div key={room.roomCode} className="card animate-fade-in" style={{
                      display: 'flex', alignItems: 'center', gap: 16,
                      background: g.bg || 'var(--surface)', borderColor: g.border || 'var(--border)',
                    }}>
                      <div style={{ fontSize: 36, flexShrink: 0 }}>{g.emoji || '🎮'}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, color: g.color || 'var(--text)' }}>
                          {room.hostName}'s room
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>
                          {g.name || room.game} · {ago < 1 ? 'just now' : `${ago}m ago`}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 600, letterSpacing: 4, color: g.color || 'var(--purple)' }}>
                          {room.roomCode}
                        </div>
                        <button
                          className="btn btn-sm"
                          style={{ background: g.color || 'var(--purple)', color: 'white', marginTop: 6 }}
                          onClick={() => navigate(`/join/${room.roomCode}`)}
                        >
                          Join →
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
