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
<<<<<<< HEAD
  const [connStatus, setConnStatus] = useState('idle');
  const [step2, setStep2] = useState('lobby');
=======
  const [connStatus, setConnStatus] = useState('idle'); // idle | connecting | connected | error
>>>>>>> 229d39f7510f794d97ecf01b8a41be9139875e08
  const channelRef = useRef(null);
  const playerId = getOrCreatePlayerId();

  async function handleJoin(e) {
    e.preventDefault();
    if (!name.trim()) return;
<<<<<<< HEAD
    setConnStatus('connecting');
    setStep('playing-lobby');
=======

    setConnStatus('connecting');
    setStep('lobby');
>>>>>>> 229d39f7510f794d97ecf01b8a41be9139875e08

    const client = getAblyClient('');
    const channel = getRoomChannel(client, roomCode);
    channelRef.current = channel;

<<<<<<< HEAD
=======
    // Listen for game start and room info
>>>>>>> 229d39f7510f794d97ecf01b8a41be9139875e08
    const unsub = subscribeAll(channel, (type, data) => {
      if (type === 'room:info') {
        setGame(data.game);
        setConnStatus('connected');
      }
      if (type === 'room:start') {
<<<<<<< HEAD
        const ps = data.players || [];
        setGame(data.game);
=======
        setGame(data.game);
        const ps = data.players || [];
>>>>>>> 229d39f7510f794d97ecf01b8a41be9139875e08
        setPlayers(ps);
        const idx = ps.findIndex(p => p.id === playerId);
        setMyIndex(idx >= 0 ? idx : 0);
        setConnStatus('connected');
<<<<<<< HEAD
        setStep2('playing');
      }
      if (type === 'room:end') {
        setStep2('lobby');
=======
        setStep('playing');
      }
      if (type === 'room:end') {
        setStep('lobby');
>>>>>>> 229d39f7510f794d97ecf01b8a41be9139875e08
        setGame(null);
      }
    });

<<<<<<< HEAD
    // Create player peer + connect to host
    await enterPresence(channel, { role: 'player', name: name.trim() });

    // Request room info in case host already in lobby
    setTimeout(() => {
      channel.publish('player:request-info', { playerId });
    }, 1800);
=======
    // Enter as player — P2P DataChannel opens → presence:enter fires → host sees player
    await enterPresence(channel, { role: 'player', name: name.trim() });

    // Request room info in case host is already in lobby
    setTimeout(() => {
      channel.publish('player:request-info', { playerId });
    }, 1500);

    return () => { unsub(); try { channel.peer?.destroy(); } catch (_) {} };
>>>>>>> 229d39f7510f794d97ecf01b8a41be9139875e08
  }

  const GAME_META = {
    fighter: { name: 'Low-Poly Brawl', emoji: '🥊', color: '#ef4444' },
    quiz:    { name: 'Blitz Quiz',     emoji: '🧠', color: '#f59e0b' },
    scribble:{ name: 'Scribble Rush',  emoji: '🎨', color: '#10b981' },
  };
<<<<<<< HEAD
  const meta = game ? GAME_META[game] || {} : {};

  // Render game controller
  if (step === 'playing-lobby' && step2 === 'playing' && channelRef.current) {
=======
  const meta = GAME_META[game] || {};

  if (step === 'playing' && channelRef.current) {
>>>>>>> 229d39f7510f794d97ecf01b8a41be9139875e08
    const props = { channel: channelRef.current, playerId, playerIndex: myIndex, players, name };
    if (game === 'fighter') return <FighterController {...props} />;
    if (game === 'quiz')    return <QuizController    {...props} />;
    if (game === 'scribble')return <ScribbleController {...props} />;
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
<<<<<<< HEAD
      <div style={{ width: '100%', maxWidth: 360 }}>

        {step === 'enter-code' && (
          <div className="animate-fade-in">
            <div style={{ textAlign: 'center', marginBottom: 32 }}>
              <div style={{ fontSize: 52, marginBottom: 10 }}>🎮</div>
              <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 30 }}>Join Game</h1>
              <p style={{ color: 'var(--muted)', marginTop: 6 }}>Enter the 4-letter room code</p>
            </div>
            <form onSubmit={e => { e.preventDefault(); if (roomCode.length === 4) setStep('enter-name'); }}>
              <input
                type="text" maxLength={4} autoFocus
                value={roomCode} onChange={e => setRoomCode(e.target.value.toUpperCase())}
                placeholder="ABCD"
                style={{ fontSize: 30, textAlign: 'center', letterSpacing: 10, fontFamily: 'var(--font-display)', marginBottom: 14 }}
=======
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
>>>>>>> 229d39f7510f794d97ecf01b8a41be9139875e08
              />
              <button type="submit" className="btn btn-primary btn-lg w-full" disabled={roomCode.length !== 4}>
                Continue →
              </button>
<<<<<<< HEAD
              <button type="button" className="btn btn-ghost w-full" style={{ marginTop: 10 }} onClick={() => navigate('/')}>
                ← Back
              </button>
=======
>>>>>>> 229d39f7510f794d97ecf01b8a41be9139875e08
            </form>
          </div>
        )}

        {step === 'enter-name' && (
          <div className="animate-fade-in">
<<<<<<< HEAD
            <div style={{ textAlign: 'center', marginBottom: 28 }}>
              <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28 }}>What's your name?</h1>
              <div style={{ marginTop: 8, display: 'inline-block', background: 'var(--surface)', borderRadius: 10, padding: '4px 14px', fontFamily: 'var(--font-display)', fontSize: 18, letterSpacing: 4, color: 'var(--purple-light)' }}>
                {roomCode}
              </div>
            </div>
            <form onSubmit={handleJoin}>
              <input
                type="text" maxLength={16} autoFocus autoCapitalize="words"
                value={name} onChange={e => setName(e.target.value)}
                placeholder="Enter your name..."
                style={{ fontSize: 20, textAlign: 'center', marginBottom: 14 }}
=======
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
>>>>>>> 229d39f7510f794d97ecf01b8a41be9139875e08
              />
              <button type="submit" className="btn btn-primary btn-lg w-full" disabled={!name.trim()}>
                Join! 🎮
              </button>
<<<<<<< HEAD
              <button type="button" className="btn btn-ghost w-full" style={{ marginTop: 10 }} onClick={() => setStep('enter-code')}>
                ← Change code
              </button>
=======
>>>>>>> 229d39f7510f794d97ecf01b8a41be9139875e08
            </form>
          </div>
        )}

<<<<<<< HEAD
        {step === 'playing-lobby' && step2 !== 'playing' && (
          <div className="animate-fade-in" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 60, marginBottom: 14 }}>{meta.emoji || '🎮'}</div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: meta.color || 'var(--purple)' }}>
=======
        {step === 'lobby' && (
          <div className="animate-fade-in" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>{meta.emoji || '🎮'}</div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, color: meta.color || 'var(--purple)' }}>
>>>>>>> 229d39f7510f794d97ecf01b8a41be9139875e08
              {meta.name || 'Connecting...'}
            </h2>

            {/* Connection status */}
<<<<<<< HEAD
            <div style={{ margin: '14px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, fontSize: 13, color: 'var(--muted)' }}>
              <div style={{
                width: 8, height: 8, borderRadius: '50%',
                background: connStatus === 'connected' ? '#10b981' : '#f59e0b',
                animation: connStatus !== 'connected' ? 'pulse 1.5s infinite' : 'none',
              }} />
              {connStatus === 'connecting' ? 'Connecting via P2P...' : connStatus === 'connected' ? 'Connected!' : ''}
            </div>

            <div style={{ background: 'var(--surface)', borderRadius: 12, padding: '14px 20px', display: 'inline-block', marginBottom: 20 }}>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>Playing as</div>
              <div style={{ fontSize: 22, fontFamily: 'var(--font-display)', fontWeight: 600 }}>{name}</div>
            </div>

            <div className="animate-pulse" style={{ color: 'var(--muted)', fontSize: 13 }}>
              Waiting for host to start...
=======
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
>>>>>>> 229d39f7510f794d97ecf01b8a41be9139875e08
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
