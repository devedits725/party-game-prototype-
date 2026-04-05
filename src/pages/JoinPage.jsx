import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getAblyClient, getRoomChannel, subscribeAll, enterPresence } from '../lib/ably.js'
import { getOrCreatePlayerId } from '../lib/utils.js'
import FighterController from '../games/fighter/FighterController.jsx'
import QuizController from '../games/quiz/QuizController.jsx'
import ScribbleController from '../games/scribble/ScribbleController.jsx'

export default function JoinPage() {
  const { code } = useParams();
  const navigate = useNavigate();
  const [step, setStep] = useState(code ? 'enter-name' : 'enter-code');
  const [roomCode, setRoomCode] = useState(code?.toUpperCase() || '');
  const [name, setName] = useState('');
  const [game, setGame] = useState(null);
  const [players, setPlayers] = useState([]);
  const [myIndex, setMyIndex] = useState(0);
  const [connStatus, setConnStatus] = useState('idle'); // idle | connecting | connected | error
  const channelRef = useRef(null);
  const playerId = getOrCreatePlayerId();

  async function handleJoin(e) {
    e.preventDefault();
    if (!name.trim()) return;

    setConnStatus('connecting');
    setStep('lobby');

    const client = getAblyClient('');
    const channel = getRoomChannel(client, roomCode);
    channelRef.current = channel;

    // Listen for game start and room info
    const unsub = subscribeAll(channel, (type, data) => {
      if (type === 'room:info') {
        setGame(data.game);
        setConnStatus('connected');
      }
      if (type === 'room:start') {
        setGame(data.game);
        const ps = data.players || [];
        setPlayers(ps);
        const idx = ps.findIndex(p => p.id === playerId);
        setMyIndex(idx >= 0 ? idx : 0);
        setConnStatus('connected');
        setStep('playing');
      }
      if (type === 'room:end') {
        setStep('lobby');
        setGame(null);
      }
    });

    // Enter as player — P2P DataChannel opens → presence:enter fires → host sees player
    await enterPresence(channel, { role: 'player', name: name.trim() });

    // Request room info in case host is already in lobby
    setTimeout(() => {
      channel.publish('player:request-info', { playerId });
    }, 1500);

    return () => { unsub(); try { channel.peer?.destroy(); } catch (_) {} };
  }

  const GAME_META = {
    fighter: { name: 'Low-Poly Brawl', emoji: '🥊', color: '#ef4444' },
    quiz:    { name: 'Blitz Quiz',     emoji: '🧠', color: '#f59e0b' },
    scribble:{ name: 'Scribble Rush',  emoji: '🎨', color: '#10b981' },
  };
  const meta = GAME_META[game] || {};

  if (step === 'playing' && channelRef.current) {
    const props = { channel: channelRef.current, playerId, playerIndex: myIndex, players, name };
    if (game === 'fighter') return <FighterController {...props} />;
    if (game === 'quiz')    return <QuizController    {...props} />;
    if (game === 'scribble')return <ScribbleController {...props} />;
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 380 }}>

        {step === 'enter-code' && (
          <div className="animate-fade-in">
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 32, marginBottom: 8, textAlign: 'center' }}>
              Join Game
            </h1>
            <p style={{ color: 'var(--muted)', textAlign: 'center', marginBottom: 32 }}>
              Enter the 4-letter room code
            </p>
            <form onSubmit={e => { e.preventDefault(); if (roomCode.length === 4) setStep('enter-name'); }}>
              <input
                type="text" maxLength={4} autoFocus
                value={roomCode}
                onChange={e => setRoomCode(e.target.value.toUpperCase())}
                placeholder="ABCD"
                style={{ fontSize: 32, textAlign: 'center', letterSpacing: 12, fontFamily: 'var(--font-display)', marginBottom: 16 }}
              />
              <button type="submit" className="btn btn-primary btn-lg w-full" disabled={roomCode.length !== 4}>
                Continue →
              </button>
            </form>
          </div>
        )}

        {step === 'enter-name' && (
          <div className="animate-fade-in">
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, marginBottom: 8, textAlign: 'center' }}>
              What's your name?
            </h1>
            <p style={{ color: 'var(--muted)', textAlign: 'center', marginBottom: 32 }}>
              Room: <strong>{roomCode}</strong>
            </p>
            <form onSubmit={handleJoin}>
              <input
                type="text" maxLength={16} autoFocus autoCapitalize="words"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Enter your name..."
                style={{ fontSize: 20, textAlign: 'center', marginBottom: 16 }}
              />
              <button type="submit" className="btn btn-primary btn-lg w-full" disabled={!name.trim()}>
                Join! 🎮
              </button>
            </form>
          </div>
        )}

        {step === 'lobby' && (
          <div className="animate-fade-in" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>{meta.emoji || '🎮'}</div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, color: meta.color || 'var(--purple)' }}>
              {meta.name || 'Connecting...'}
            </h2>

            {/* Connection status */}
            <div style={{ margin: '16px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 13, color: 'var(--muted)' }}>
              <div style={{
                width: 8, height: 8, borderRadius: '50%',
                background: connStatus === 'connected' ? '#10b981' : connStatus === 'error' ? '#ef4444' : '#f59e0b',
                animation: connStatus === 'connecting' ? 'pulse 1.5s infinite' : 'none',
              }} />
              {connStatus === 'connecting' ? 'Connecting via P2P...' :
               connStatus === 'connected' ? 'Connected!' :
               connStatus === 'error' ? 'Connection failed' : ''}
            </div>

            <div style={{ background: 'var(--surface)', borderRadius: 12, padding: 16, display: 'inline-block', marginBottom: 24 }}>
              <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 4 }}>Playing as</div>
              <div style={{ fontSize: 24, fontFamily: 'var(--font-display)', fontWeight: 600 }}>{name}</div>
            </div>

            <div className="animate-pulse" style={{ color: 'var(--muted)', fontSize: 14 }}>
              Waiting for host to start the game...
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
