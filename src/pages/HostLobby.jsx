import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import QRCode from 'qrcode'
import { getAblyClient, getRoomChannel, subscribeAll, enterPresence, subscribePresence } from '../lib/ably.js'
import { generateRoomCode, getJoinUrl, PLAYER_COLORS } from '../lib/utils.js'
import FighterHost from '../games/fighter/FighterHost.jsx'
import QuizHost from '../games/quiz/QuizHost.jsx'
import ScribbleHost from '../games/scribble/ScribbleHost.jsx'

export default function HostLobby() {
  const { game } = useParams();
  const navigate = useNavigate();
  const [phase, setPhase] = useState('lobby');
  const [roomCode] = useState(() => generateRoomCode());
  const [players, setPlayers] = useState([]);
  const [qrUrl, setQrUrl] = useState('');
  const [peerStatus, setPeerStatus] = useState('starting');
  const channelRef = useRef(null);
  const playersRef = useRef([]);
  const joinUrl = getJoinUrl(roomCode);

  useEffect(() => {
    QRCode.toDataURL(joinUrl, {
      width: 200, margin: 1,
      color: { dark: '#f1f5f9', light: '#0f0f2d' },
    }).then(setQrUrl);

    const client = getAblyClient('');
    const channel = getRoomChannel(client, roomCode);
    channelRef.current = channel;

    // Rebuild player list directly from presenceMap on every presence event.
    // This is the fix for the "players not showing" bug — fully event-driven,
    // no async polling, fires instantly when a player's DataChannel opens.
    function rebuildPlayers() {
      const members = Object.values(channel.presenceMap)
        .filter(m => m.data?.role === 'player');
      const ps = members.map((m, i) => ({
        id: m.clientId,
        name: m.data.name || `Player ${i + 1}`,
        color: PLAYER_COLORS[i % PLAYER_COLORS.length],
        index: i,
      }));
      playersRef.current = ps;
      setPlayers([...ps]);
    }

    const unsubPresence = subscribePresence(channel, (event) => {
      console.log('[Lobby] Presence:', event.action, event.clientId);
      rebuildPlayers();
    });

    const unsubAll = subscribeAll(channel, (type, data) => {
      if (type === 'player:request-info') {
        channel.publish('room:info', { game, phase: 'lobby', roomCode });
      }
    });

    enterPresence(channel, { role: 'host', game });

    // Poll peer open state to update status indicator
    const interval = setInterval(() => {
      if (channel.peer) {
        setPeerStatus('ready');
        clearInterval(interval);
      }
    }, 400);

    return () => {
      clearInterval(interval);
      unsubPresence();
      unsubAll();
      try { channel.peer?.destroy(); } catch (_) {}
    };
  }, []);

  function startGame() {
    const ps = playersRef.current;
    if (ps.length === 0) return;
    channelRef.current?.publish('room:start', {
      game, players: ps,
      playerColors: ps.map(p => p.color),
    });
    setPhase('playing');
  }

  function endGame() {
    channelRef.current?.publish('room:end', {});
    setPhase('lobby');
  }

  const GAME_META = {
    fighter: { name: 'Low-Poly Brawl', color: '#ef4444', emoji: '🥊', min: 2 },
    quiz:    { name: 'Blitz Quiz',     color: '#f59e0b', emoji: '🧠', min: 2 },
    scribble:{ name: 'Scribble Rush',  color: '#10b981', emoji: '🎨', min: 3 },
  };
  const meta = GAME_META[game] || {};

  if (phase === 'playing') {
    const props = { channel: channelRef.current, players, roomCode, onEnd: endGame };
    if (game === 'fighter') return <FighterHost {...props} />;
    if (game === 'quiz')    return <QuizHost    {...props} />;
    if (game === 'scribble')return <ScribbleHost {...props} />;
  }

  return (
    <div style={{ minHeight: '100vh', padding: '24px 16px' }}>
      <div style={{ maxWidth: 700, margin: '0 auto' }}>

        <div className="flex items-center gap-3" style={{ marginBottom: 32 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/')}>← Back</button>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28 }}>
            {meta.emoji} {meta.name}
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--muted)', marginLeft: 8 }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%',
              background: peerStatus === 'ready' ? '#10b981' : '#f59e0b',
              animation: peerStatus === 'starting' ? 'pulse 1.5s infinite' : 'none',
            }} />
            {peerStatus === 'ready' ? 'P2P ready' : 'Connecting...'}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 24, alignItems: 'start' }}>
          <div>
            <div className="card" style={{ marginBottom: 16, borderColor: `${meta.color}44` }}>
              <div className="flex justify-between items-center" style={{ marginBottom: 16 }}>
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18 }}>
                  Players ({players.length})
                </h2>
                <span className="badge" style={{ background: `${meta.color}22`, color: meta.color }}>
                  min {meta.min}
                </span>
              </div>

              {players.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--muted)' }}>
                  <div className="animate-pulse">Waiting for players to join...</div>
                  <div style={{ fontSize: 12, marginTop: 8 }}>Share the QR code or room code</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {players.map((p, i) => (
                    <div key={p.id} className="flex items-center gap-3 animate-fade-in"
                      style={{ background: 'var(--surface2)', borderRadius: 10, padding: '10px 14px' }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: '50%', background: p.color,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 600, color: 'white', fontSize: 14, flexShrink: 0,
                      }}>
                        {p.name[0].toUpperCase()}
                      </div>
                      <span style={{ fontWeight: 500 }}>{p.name}</span>
                      <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--muted)' }}>Player {i + 1}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="card" style={{ marginBottom: 16, fontSize: 13, color: 'var(--muted)' }}>
              <div style={{ fontWeight: 500, color: 'var(--text)', marginBottom: 8 }}>⌨️ Keyboard / Controller</div>
              {game === 'fighter' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                  <span>P1: WASD + Z/X</span><span>P2: Arrows + J/K</span>
                  <span>Jump: W / Up</span><span>Attack: Z/J · Heavy: X/K</span>
                </div>
              )}
              {game !== 'fighter' && <span>Players use their phones to interact</span>}
              <div style={{ marginTop: 8 }}>Gamepad: Xbox, PS, Switch Pro — all supported</div>
            </div>

            <button
              className="btn btn-lg w-full"
              style={{ background: meta.color, color: 'white', opacity: players.length < meta.min ? 0.5 : 1 }}
              disabled={players.length < meta.min}
              onClick={startGame}
            >
              {players.length < meta.min
                ? `Need ${meta.min - players.length} more player${meta.min - players.length !== 1 ? 's' : ''}`
                : `Start ${meta.name}! 🚀`}
            </button>
          </div>

          <div className="card" style={{ textAlign: 'center', borderColor: `${meta.color}44` }}>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>Scan to join</div>
            {qrUrl && (
              <div style={{ background: '#0f0f2d', borderRadius: 12, padding: 8, display: 'inline-block', border: `2px solid ${meta.color}44` }}>
                <img src={qrUrl} alt="QR Code" style={{ display: 'block', width: 160, height: 160 }} />
              </div>
            )}
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>Room code</div>
              <div style={{
                fontSize: 36, fontFamily: 'var(--font-display)', fontWeight: 600, letterSpacing: 8,
                color: meta.color, background: `${meta.color}15`, borderRadius: 12, padding: '8px 16px',
              }}>
                {roomCode}
              </div>
            </div>
            <div style={{ marginTop: 12, fontSize: 11, color: 'var(--muted)' }}>
              {window.location.origin}/join/{roomCode}
            </div>
            <div style={{ marginTop: 10, fontSize: 11, color: '#10b981', background: 'rgba(16,185,129,0.1)', borderRadius: 8, padding: '5px 10px' }}>
              ⚡ Direct P2P — no server latency
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
