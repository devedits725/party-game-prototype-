import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getAblyClient, getRoomChannel, subscribeAll, enterPresence, updatePresence } from '../lib/ably.js'
import { getSettings, getOrCreatePlayerId } from '../lib/utils.js'
import FighterController from '../games/fighter/FighterController.jsx'
import QuizController from '../games/quiz/QuizController.jsx'
import ScribbleController from '../games/scribble/ScribbleController.jsx'

export default function JoinPage() {
  const { code } = useParams();
  const navigate = useNavigate();
  const [step, setStep] = useState('enter-code'); // enter-code | enter-name | lobby | playing
  const [roomCode, setRoomCode] = useState(code?.toUpperCase() || '');
  const [name, setName] = useState('');
  const [game, setGame] = useState(null);
  const [players, setPlayers] = useState([]);
  const [myIndex, setMyIndex] = useState(0);
  const channelRef = useRef(null);
  const { ablyKey } = getSettings();
  const playerId = getOrCreatePlayerId();

  // If code in URL, skip to name entry
  useEffect(() => {
    if (code) setStep('enter-name');
  }, [code]);

  function handleCodeSubmit(e) {
    e.preventDefault();
    if (roomCode.length === 4) setStep('enter-name');
  }

  async function handleJoin(e) {
    e.preventDefault();
    if (!name.trim() || !ablyKey) return;
    if (!ablyKey) {
      alert('Please set your Ably API key in the host settings first, then rejoin.');
      return;
    }

    const client = getAblyClient(ablyKey);
    const channel = getRoomChannel(client, roomCode);
    channelRef.current = channel;

    await enterPresence(channel, { role: 'player', name: name.trim() });

    // Ask host for room info
    channel.publish('player:request-info', { playerId });

    const unsub = subscribeAll(channel, (type, data) => {
      if (type === 'room:info' || type === 'room:start') {
        setGame(data.game);
        if (data.players) {
          setPlayers(data.players);
          const idx = data.players.findIndex(p => p.id === playerId);
          setMyIndex(idx >= 0 ? idx : 0);
        }
        setStep(type === 'room:start' ? 'playing' : 'lobby');
      }
      if (type === 'room:start') {
        setGame(data.game);
        setPlayers(data.players || []);
        const idx = (data.players || []).findIndex(p => p.id === playerId);
        setMyIndex(idx >= 0 ? idx : 0);
        setStep('playing');
      }
      if (type === 'room:end') {
        setStep('lobby');
      }
    });

    setStep('lobby');
    return () => { unsub(); channel.presence.leave(); };
  }

  const GAME_META = {
    fighter: { name: 'Low-Poly Brawl', emoji: '🥊', color: '#ef4444' },
    quiz:    { name: 'Blitz Quiz',     emoji: '🧠', color: '#f59e0b' },
    scribble:{ name: 'Scribble Rush',  emoji: '🎨', color: '#10b981' },
  };

  if (step === 'playing' && channelRef.current) {
    const props = { channel: channelRef.current, playerId, playerIndex: myIndex, players, name };
    if (game === 'fighter') return <FighterController {...props} />;
    if (game === 'quiz')    return <QuizController    {...props} />;
    if (game === 'scribble')return <ScribbleController {...props} />;
  }

  const meta = GAME_META[game] || {};

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 380 }}>

        {step === 'enter-code' && (
          <div className="animate-fade-in">
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 32, marginBottom: 8, textAlign: 'center' }}>Join Game</h1>
            <p style={{ color: 'var(--muted)', textAlign: 'center', marginBottom: 32 }}>Enter the 4-letter room code</p>
            <form onSubmit={handleCodeSubmit}>
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
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, marginBottom: 8, textAlign: 'center' }}>What's your name?</h1>
            <p style={{ color: 'var(--muted)', textAlign: 'center', marginBottom: 32 }}>Room: <strong>{roomCode}</strong></p>
            {!ablyKey && (
              <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: 12, marginBottom: 16, fontSize: 13, color: '#ef4444' }}>
                ⚠️ No Ably API key found. Ask the host to set their key first, then share the join link.
              </div>
            )}
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
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, color: meta.color }}>
              {meta.name || 'Waiting...'}
            </h2>
            <p style={{ color: 'var(--muted)', marginTop: 8, marginBottom: 32 }}>
              You're in! Waiting for the host to start...
            </p>
            <div style={{ background: 'var(--surface)', borderRadius: 12, padding: 16, display: 'inline-block' }}>
              <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 4 }}>Playing as</div>
              <div style={{ fontSize: 24, fontFamily: 'var(--font-display)', fontWeight: 600 }}>{name}</div>
            </div>
            <div className="animate-pulse" style={{ marginTop: 32, color: 'var(--muted)', fontSize: 14 }}>
              ● Waiting for host...
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
