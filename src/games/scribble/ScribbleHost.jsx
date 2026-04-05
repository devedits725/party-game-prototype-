import { useState, useEffect, useRef } from 'react'
import { subscribeAll } from '../../lib/ably.js'
import { PLAYER_COLORS_CSS, SCRIBBLE_WORDS } from '../../lib/utils.js'

const DRAW_TIME = 80;
const ROUNDS = 3;
const POINTS_GUESS = 100;
const POINTS_DRAWER_PER_GUESS = 30;

function pickWords() {
  const shuffled = [...SCRIBBLE_WORDS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 3);
}

export default function ScribbleHost({ channel, players, onEnd }) {
  const canvasRef = useRef(null);
  const [phase, setPhase] = useState('word-select'); // word-select | drawing | reveal | scores | ended
  const [round, setRound] = useState(1);
  const [drawerIndex, setDrawerIndex] = useState(0);
  const [currentWord, setCurrentWord] = useState('');
  const [wordChoices, setWordChoices] = useState([]);
  const [guesses, setGuesses] = useState([]);
  const [scores, setScores] = useState(() => Object.fromEntries(players.map(p => [p.id, 0])));
  const [timeLeft, setTimeLeft] = useState(DRAW_TIME);
  const [guessedPlayers, setGuessedPlayers] = useState(new Set());
  const [hints, setHints] = useState('');
  const [chat, setChat] = useState([]);
  const timerRef = useRef(null);
  const drawerScoreRef = useRef(0);
  const startTimeRef = useRef(null);

  const drawer = players[drawerIndex % players.length];

  useEffect(() => {
    // Listen for draw strokes from drawer's phone
    const unsub = subscribeAll(channel, (type, data) => {
      if (type === 'scribble:stroke') {
        drawStroke(data);
      }
      if (type === 'scribble:clear') {
        clearCanvas();
      }
      if (type === 'scribble:guess') {
        handleGuess(data.playerId, data.text);
      }
      if (type === 'scribble:word-chosen') {
        startDrawing(data.word);
      }
    });
    startWordSelect();
    return () => { unsub(); clearInterval(timerRef.current); };
  }, [drawerIndex, round]);

  function startWordSelect() {
    setPhase('word-select');
    setGuesses([]);
    setGuessedPlayers(new Set());
    setChat([]);
    drawerScoreRef.current = 0;
    clearCanvas();
    const choices = pickWords();
    setWordChoices(choices);
    channel.publish('scribble:pick-word', {
      drawerId: drawer.id,
      choices,
      round,
      totalRounds: ROUNDS,
      drawerName: drawer.name,
    });
  }

  function startDrawing(word) {
    setCurrentWord(word);
    setHints(word.replace(/[a-zA-Z]/g, '_').split('').join(' '));
    setPhase('drawing');
    setTimeLeft(DRAW_TIME);
    startTimeRef.current = Date.now();
    clearCanvas();

    channel.publish('scribble:game-state', {
      phase: 'drawing',
      drawerName: drawer.name,
      drawerId: drawer.id,
      wordLength: word.length,
      round,
      totalRounds: ROUNDS,
      timeLeft: DRAW_TIME,
    });

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        const next = prev - 1;
        if (next <= 0) {
          clearInterval(timerRef.current);
          endRound();
        }
        // Reveal hint letter every 20s
        if (next === Math.floor(DRAW_TIME * 0.6) || next === Math.floor(DRAW_TIME * 0.3)) {
          revealHintLetter(word);
        }
        return next;
      });
    }, 1000);
  }

  function revealHintLetter(word) {
    setHints(prev => {
      const arr = prev.split(' ');
      const hidden = arr.map((c, i) => c === '_' ? i : -1).filter(i => i >= 0);
      if (hidden.length === 0) return prev;
      const revealIdx = hidden[Math.floor(Math.random() * hidden.length)];
      arr[revealIdx] = word[revealIdx];
      const newHint = arr.join(' ');
      channel.publish('scribble:hint', { hint: newHint });
      return newHint;
    });
  }

  function handleGuess(playerId, text) {
    if (phase !== 'drawing') return;
    if (playerId === drawer.id) return;
    if (guessedPlayers.has(playerId)) return;

    const isCorrect = text.trim().toLowerCase() === currentWord.toLowerCase();
    const playerName = players.find(p => p.id === playerId)?.name || 'Player';

    if (isCorrect) {
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      const speedPct = Math.max(0, 1 - elapsed / DRAW_TIME);
      const pts = Math.round(POINTS_GUESS + speedPct * 50);

      setScores(prev => ({
        ...prev,
        [playerId]: (prev[playerId] || 0) + pts,
        [drawer.id]: (prev[drawer.id] || 0) + POINTS_DRAWER_PER_GUESS,
      }));
      drawerScoreRef.current += POINTS_DRAWER_PER_GUESS;

      setGuessedPlayers(prev => {
        const next = new Set(prev);
        next.add(playerId);
        channel.publish('scribble:correct', { playerId, playerName, pts });
        setChat(c => [...c, { text: `${playerName} guessed it! +${pts}`, type: 'correct' }]);

        // Everyone guessed
        if (next.size >= players.length - 1) {
          clearInterval(timerRef.current);
          setTimeout(endRound, 1500);
        }
        return next;
      });
    } else {
      setChat(c => [...c, { text: `${playerName}: ${text}`, type: 'guess' }]);
      channel.publish('scribble:chat', { playerName, text, correct: false });
    }
  }

  function endRound() {
    clearInterval(timerRef.current);
    setPhase('reveal');
    channel.publish('scribble:reveal', { word: currentWord, scores });

    setTimeout(() => {
      const nextDrawer = drawerIndex + 1;
      const isGameOver = nextDrawer >= players.length * ROUNDS;
      if (isGameOver) {
        setPhase('ended');
        channel.publish('scribble:end', { scores });
      } else {
        if (nextDrawer % players.length === 0) setRound(r => r + 1);
        setDrawerIndex(nextDrawer % players.length);
      }
    }, 4000);
  }

  function drawStroke(stroke) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = stroke.color || '#ffffff';
    ctx.lineWidth = stroke.size || 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (stroke.type === 'start') {
      ctx.beginPath();
      ctx.moveTo(stroke.x * canvas.width, stroke.y * canvas.height);
    } else if (stroke.type === 'move') {
      ctx.lineTo(stroke.x * canvas.width, stroke.y * canvas.height);
      ctx.stroke();
    }
  }

  function clearCanvas() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#1a1a3e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  useEffect(() => { clearCanvas(); }, []);

  const sorted = [...players].sort((a, b) => (scores[b.id] || 0) - (scores[a.id] || 0));

  if (phase === 'ended') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <div style={{ fontSize: 64 }}>🏆</div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 36, color: '#10b981', marginBottom: 32 }}>Game Over!</h1>
        <div style={{ width: '100%', maxWidth: 500, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {sorted.map((p, i) => (
            <div key={p.id} className="card animate-fade-in" style={{
              display: 'flex', alignItems: 'center', gap: 16,
              background: i === 0 ? 'rgba(16,185,129,0.15)' : 'var(--surface)',
              borderColor: i === 0 ? '#10b981' : 'var(--border)',
            }}>
              <div style={{ fontSize: 24 }}>{['🥇','🥈','🥉'][i] || `${i+1}.`}</div>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: PLAYER_COLORS_CSS[players.indexOf(p) % 4], display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: 'white' }}>
                {p.name[0]}
              </div>
              <div style={{ flex: 1, fontFamily: 'var(--font-display)', fontSize: 18 }}>{p.name}</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, color: '#10b981' }}>{scores[p.id] || 0}</div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 32 }}>
          <button className="btn btn-primary btn-lg" onClick={() => window.location.reload()}>Play Again</button>
          <button className="btn btn-ghost btn-lg" onClick={onEnd}>Back to Lobby</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, color: '#10b981' }}>
          Round {round}/{ROUNDS} · {drawer?.name} is drawing
        </div>

        {phase === 'drawing' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, letterSpacing: 4, color: 'white' }}>{hints}</div>
            <div style={{
              width: 44, height: 44, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600,
              background: timeLeft <= 15 ? 'rgba(239,68,68,0.2)' : 'var(--surface2)',
              color: timeLeft <= 15 ? '#ef4444' : 'white',
              border: `2px solid ${timeLeft <= 15 ? '#ef4444' : 'var(--border)'}`,
            }}>
              {timeLeft}
            </div>
          </div>
        )}

        {phase === 'word-select' && (
          <div style={{ fontFamily: 'var(--font-display)', color: '#f59e0b' }}>
            Waiting for {drawer?.name} to pick a word...
          </div>
        )}

        {phase === 'reveal' && (
          <div className="animate-pop" style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: '#10b981' }}>
            The word was: <strong>{currentWord}</strong>!
          </div>
        )}
      </div>

      <div style={{ flex: 1, display: 'flex', gap: 0 }}>
        {/* Canvas */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <canvas
            ref={canvasRef}
            width={700} height={480}
            style={{ borderRadius: 12, border: '1px solid var(--border)', maxWidth: '100%', background: '#1a1a3e', display: 'block' }}
          />
        </div>

        {/* Right panel: scores + chat */}
        <div style={{ width: 220, background: 'var(--surface)', borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
          {/* Scores */}
          <div style={{ padding: 12, borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Scores</div>
            {sorted.map((p, i) => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0' }}>
                <div style={{ width: 24, height: 24, borderRadius: '50%', background: PLAYER_COLORS_CSS[players.indexOf(p) % 4], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'white', flexShrink: 0 }}>
                  {p.name[0]}
                </div>
                <div style={{ flex: 1, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: guessedPlayers.has(p.id) ? '#10b981' : 'var(--text)' }}>
                  {guessedPlayers.has(p.id) ? '✓ ' : ''}{p.name}
                </div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, color: '#10b981', flexShrink: 0 }}>{scores[p.id] || 0}</div>
              </div>
            ))}
          </div>

          {/* Chat log */}
          <div style={{ flex: 1, padding: 12, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {chat.map((c, i) => (
              <div key={i} style={{ fontSize: 12, padding: '4px 8px', borderRadius: 6, background: c.type === 'correct' ? 'rgba(16,185,129,0.15)' : 'var(--surface2)', color: c.type === 'correct' ? '#10b981' : 'var(--text)', lineHeight: 1.4 }}>
                {c.text}
              </div>
            ))}
          </div>

          {/* Host word cheat */}
          {phase === 'drawing' && (
            <div style={{ padding: 10, borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--muted)', textAlign: 'center' }}>
              Host sees: <strong style={{ color: '#f59e0b' }}>{currentWord}</strong>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
