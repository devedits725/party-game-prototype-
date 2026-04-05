import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import QRCode from 'qrcode'
<<<<<<< HEAD
import { getAblyClient, getRoomChannel, subscribeAll, enterPresence, subscribePresence, registerPublicRoom, unregisterPublicRoom } from '../lib/ably.js'
=======
import { getAblyClient, getRoomChannel, subscribeAll, enterPresence, subscribePresence } from '../lib/ably.js'
>>>>>>> 229d39f7510f794d97ecf01b8a41be9139875e08
import { generateRoomCode, getJoinUrl, PLAYER_COLORS } from '../lib/utils.js'
import FighterHost from '../games/fighter/FighterHost.jsx'
import QuizHost from '../games/quiz/QuizHost.jsx'
import ScribbleHost from '../games/scribble/ScribbleHost.jsx'

export default function HostLobby() {
<<<<<<< HEAD
  const { game, mode } = useParams(); // mode = 'public' | 'private'
=======
  const { game } = useParams();
>>>>>>> 229d39f7510f794d97ecf01b8a41be9139875e08
  const navigate = useNavigate();
  const [phase, setPhase] = useState('lobby');
  const [roomCode] = useState(() => generateRoomCode());
  const [players, setPlayers] = useState([]);
  const [qrUrl, setQrUrl] = useState('');
  const [peerStatus, setPeerStatus] = useState('starting');
<<<<<<< HEAD
  const [hostName] = useState(() => 'Host');
  const channelRef = useRef(null);
  const playersRef = useRef([]);
  const isPublic = mode !== 'private';
  const joinUrl = getJoinUrl(roomCode);

  const GAME_META = {
    fighter: { name: 'Low-Poly Brawl', color: '#ef4444', emoji: '🥊', min: 2 },
    quiz:    { name: 'Blitz Quiz',     color: '#f59e0b', emoji: '🧠', min: 2 },
    scribble:{ name: 'Scribble Rush',  color: '#10b981', emoji: '🎨', min: 3 },
  };
  const meta = GAME_META[game] || {};

=======
  const channelRef = useRef(null);
  const playersRef = useRef([]);
  const joinUrl = getJoinUrl(roomCode);

>>>>>>> 229d39f7510f794d97ecf01b8a41be9139875e08
  useEffect(() => {
    QRCode.toDataURL(joinUrl, {
      width: 200, margin: 1,
      color: { dark: '#f1f5f9', light: '#0f0f2d' },
    }).then(setQrUrl);

    const client = getAblyClient('');
    const channel = getRoomChannel(client, roomCode);
    channelRef.current = channel;

<<<<<<< HEAD
    // Register as public room so Browse tab can show it
    if (isPublic) {
      registerPublicRoom(roomCode, hostName, game);
      // Keep registration fresh every 2 minutes
      const heartbeat = setInterval(() => registerPublicRoom(roomCode, hostName, game), 2 * 60 * 1000);
      return () => {
        clearInterval(heartbeat);
        unregisterPublicRoom(roomCode);
      };
    }
  }, []);

  useEffect(() => {
    const client = getAblyClient('');
    const channel = getRoomChannel(client, roomCode);
    channelRef.current = channel;

    // Rebuild player list from presenceMap — fires instantly on every presence event
    function rebuildPlayers() {
      const ps = Object.values(channel.presenceMap)
        .filter(m => m.data?.role === 'player')
        .map((m, i) => ({
          id: m.clientId,
          name: m.data.name || `Player ${i + 1}`,
          color: PLAYER_COLORS[i % PLAYER_COLORS.length],
          index: i,
        }));
=======
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
>>>>>>> 229d39f7510f794d97ecf01b8a41be9139875e08
      playersRef.current = ps;
      setPlayers([...ps]);
    }

<<<<<<< HEAD
    const unsubPresence = subscribePresence(channel, event => {
      console.log('[Lobby] Presence:', event.action, event.data?.name);
      rebuildPlayers();
    });

    const unsubAll = subscribeAll(channel, (type) => {
=======
    const unsubPresence = subscribePresence(channel, (event) => {
      console.log('[Lobby] Presence:', event.action, event.clientId);
      rebuildPlayers();
    });

    const unsubAll = subscribeAll(channel, (type, data) => {
>>>>>>> 229d39f7510f794d97ecf01b8a41be9139875e08
      if (type === 'player:request-info') {
        channel.publish('room:info', { game, phase: 'lobby', roomCode });
      }
    });

<<<<<<< HEAD
    // Start host peer
    enterPresence(channel, { role: 'host', game });

    // Poll until PeerJS peer is ready
    const interval = setInterval(() => {
      if (channel.peer) { setPeerStatus('ready'); clearInterval(interval); }
    }, 300);
=======
    enterPresence(channel, { role: 'host', game });

    // Poll peer open state to update status indicator
    const interval = setInterval(() => {
      if (channel.peer) {
        setPeerStatus('ready');
        clearInterval(interval);
      }
    }, 400);
>>>>>>> 229d39f7510f794d97ecf01b8a41be9139875e08

    return () => {
      clearInterval(interval);
      unsubPresence();
      unsubAll();
<<<<<<< HEAD
      try { channel.peer?.destroy(); } catch(_) {}
=======
      try { channel.peer?.destroy(); } catch (_) {}
>>>>>>> 229d39f7510f794d97ecf01b8a41be9139875e08
    };
  }, []);

  function startGame() {
    const ps = playersRef.current;
    if (ps.length === 0) return;
<<<<<<< HEAD
    if (isPublic) unregisterPublicRoom(roomCode); // remove from browse list
    channelRef.current?.publish('room:start', {
      game, players: ps, playerColors: ps.map(p => p.color),
=======
    channelRef.current?.publish('room:start', {
      game, players: ps,
      playerColors: ps.map(p => p.color),
>>>>>>> 229d39f7510f794d97ecf01b8a41be9139875e08
    });
    setPhase('playing');
  }

  function endGame() {
    channelRef.current?.publish('room:end', {});
    setPhase('lobby');
  }

<<<<<<< HEAD
=======
  const GAME_META = {
    fighter: { name: 'Low-Poly Brawl', color: '#ef4444', emoji: '🥊', min: 2 },
    quiz:    { name: 'Blitz Quiz',     color: '#f59e0b', emoji: '🧠', min: 2 },
    scribble:{ name: 'Scribble Rush',  color: '#10b981', emoji: '🎨', min: 3 },
  };
  const meta = GAME_META[game] || {};

>>>>>>> 229d39f7510f794d97ecf01b8a41be9139875e08
  if (phase === 'playing') {
    const props = { channel: channelRef.current, players, roomCode, onEnd: endGame };
    if (game === 'fighter') return <FighterHost {...props} />;
    if (game === 'quiz')    return <QuizHost    {...props} />;
    if (game === 'scribble')return <ScribbleHost {...props} />;
  }

  return (
    <div style={{ minHeight: '100vh', padding: '24px 16px' }}>
<<<<<<< HEAD
      <div style={{ maxWidth: 720, margin: '0 auto' }}>

        {/* Header */}
        <div className="flex items-center gap-3" style={{ marginBottom: 28, flexWrap: 'wrap' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/')}>← Back</button>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26 }}>
            {meta.emoji} {meta.name}
          </h1>

          {/* Public / Private badge */}
          <span style={{
            padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 500,
            background: isPublic ? 'rgba(16,185,129,0.15)' : 'rgba(139,92,246,0.15)',
            color: isPublic ? '#10b981' : '#a78bfa',
            border: `1px solid ${isPublic ? 'rgba(16,185,129,0.3)' : 'rgba(139,92,246,0.3)'}`,
          }}>
            {isPublic ? '🌐 Public' : '🔒 Private'}
          </span>

          {/* Peer status dot */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--muted)', marginLeft: 'auto' }}>
            <div style={{
              width: 7, height: 7, borderRadius: '50%',
              background: peerStatus === 'ready' ? '#10b981' : '#f59e0b',
              animation: peerStatus !== 'ready' ? 'pulse 1.5s infinite' : 'none',
=======
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
>>>>>>> 229d39f7510f794d97ecf01b8a41be9139875e08
            }} />
            {peerStatus === 'ready' ? 'P2P ready' : 'Connecting...'}
          </div>
        </div>

<<<<<<< HEAD
        {/* Public room notice */}
        {isPublic && (
          <div style={{
            background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)',
            borderRadius: 12, padding: '10px 16px', marginBottom: 18,
            fontSize: 13, color: '#10b981', display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span>🌐</span>
            <span>This room is <strong>publicly listed</strong> — anyone on your network can find and join it from the Browse tab.</span>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 20, alignItems: 'start' }}>

          {/* Left */}
          <div>
            {/* Player list */}
            <div className="card" style={{ marginBottom: 14, borderColor: `${meta.color}44` }}>
              <div className="flex justify-between items-center" style={{ marginBottom: 14 }}>
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 17 }}>
                  Players ({players.length})
                </h2>
                <span className="badge" style={{ background: `${meta.color}22`, color: meta.color, fontSize: 11 }}>
=======
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 24, alignItems: 'start' }}>
          <div>
            <div className="card" style={{ marginBottom: 16, borderColor: `${meta.color}44` }}>
              <div className="flex justify-between items-center" style={{ marginBottom: 16 }}>
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18 }}>
                  Players ({players.length})
                </h2>
                <span className="badge" style={{ background: `${meta.color}22`, color: meta.color }}>
>>>>>>> 229d39f7510f794d97ecf01b8a41be9139875e08
                  min {meta.min}
                </span>
              </div>

              {players.length === 0 ? (
<<<<<<< HEAD
                <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--muted)' }}>
                  <div className="animate-pulse" style={{ fontSize: 14 }}>Waiting for players to join...</div>
                  <div style={{ fontSize: 12, marginTop: 6 }}>
                    {isPublic ? 'Players can find you in the Browse tab or use the room code' : 'Share the room code or QR code'}
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {players.map((p, i) => (
                    <div key={p.id} className="animate-fade-in" style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      background: 'var(--surface2)', borderRadius: 9, padding: '9px 12px',
                    }}>
                      <div style={{
                        width: 30, height: 30, borderRadius: '50%', background: p.color,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 700, color: 'white', fontSize: 13, flexShrink: 0,
                      }}>
                        {p.name[0].toUpperCase()}
                      </div>
                      <span style={{ fontWeight: 500, fontSize: 14 }}>{p.name}</span>
                      <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--muted)' }}>P{i + 1}</span>
=======
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
>>>>>>> 229d39f7510f794d97ecf01b8a41be9139875e08
                    </div>
                  ))}
                </div>
              )}
            </div>

<<<<<<< HEAD
            {/* Controls info */}
            <div className="card" style={{ marginBottom: 14, fontSize: 12, color: 'var(--muted)' }}>
              <div style={{ fontWeight: 500, color: 'var(--text)', marginBottom: 6, fontSize: 13 }}>⌨️ Controls</div>
              {game === 'fighter' ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3 }}>
                  <span>P1: WASD + Z(atk) X(heavy)</span>
                  <span>P2: Arrows + J(atk) K(heavy)</span>
                  <span>Gamepad: all controllers work</span>
                  <span>Phone: touch D-pad + buttons</span>
                </div>
              ) : (
                <span>Players use their phones — no keyboard needed</span>
              )}
=======
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
>>>>>>> 229d39f7510f794d97ecf01b8a41be9139875e08
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

<<<<<<< HEAD
          {/* Right: QR + code */}
          <div className="card" style={{ textAlign: 'center', borderColor: `${meta.color}44`, minWidth: 190 }}>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>Scan to join</div>
            {qrUrl && (
              <div style={{ background: '#0f0f2d', borderRadius: 10, padding: 6, display: 'inline-block', border: `2px solid ${meta.color}44` }}>
                <img src={qrUrl} alt="QR" style={{ display: 'block', width: 150, height: 150 }} />
              </div>
            )}
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 5 }}>Room code</div>
              <div style={{
                fontSize: 32, fontFamily: 'var(--font-display)', fontWeight: 600, letterSpacing: 7,
                color: meta.color, background: `${meta.color}15`, borderRadius: 10, padding: '7px 14px',
=======
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
>>>>>>> 229d39f7510f794d97ecf01b8a41be9139875e08
              }}>
                {roomCode}
              </div>
            </div>
<<<<<<< HEAD
            <div style={{ marginTop: 10, fontSize: 10, color: 'var(--muted)', wordBreak: 'break-all' }}>
              {window.location.origin}/join/{roomCode}
            </div>
            {isPublic && (
              <div style={{ marginTop: 10, fontSize: 11, color: '#10b981', background: 'rgba(16,185,129,0.1)', borderRadius: 7, padding: '5px 8px' }}>
                🌐 Listed in Browse tab
              </div>
            )}
=======
            <div style={{ marginTop: 12, fontSize: 11, color: 'var(--muted)' }}>
              {window.location.origin}/join/{roomCode}
            </div>
            <div style={{ marginTop: 10, fontSize: 11, color: '#10b981', background: 'rgba(16,185,129,0.1)', borderRadius: 8, padding: '5px 10px' }}>
              ⚡ Direct P2P — no server latency
            </div>
>>>>>>> 229d39f7510f794d97ecf01b8a41be9139875e08
          </div>
        </div>
      </div>
    </div>
  );
}
