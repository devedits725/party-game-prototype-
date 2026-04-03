import { useState, useEffect, useRef } from 'react'
import { subscribeAll } from '../../lib/ably.js'
import { PLAYER_COLORS_CSS } from '../../lib/utils.js'

const COLORS = ['#ffffff', '#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#000000', '#1a1a3e'];
const SIZES = [3, 6, 12, 20];

export default function ScribbleController({ channel, playerId, playerIndex, players, name }) {
  const canvasRef = useRef(null);
  const [isDrawer, setIsDrawer] = useState(false);
  const [myWord, setMyWord] = useState('');
  const [wordChoices, setWordChoices] = useState([]);
  const [phase, setPhase] = useState('waiting'); // waiting | pick-word | drawing | guessing | reveal | ended
  const [drawerName, setDrawerName] = useState('');
  const [hint, setHint] = useState('');
  const [wordLength, setWordLength] = useState(0);
  const [guessText, setGuessText] = useState('');
  const [guessed, setGuessed] = useState(false);
  const [round, setRound] = useState(1);
  const [totalRounds, setTotalRounds] = useState(3);
  const [timeLeft, setTimeLeft] = useState(80);
  const [myScore, setMyScore] = useState(0);
  const [chat, setChat] = useState([]);
  const [revealWord, setRevealWord] = useState('');
  const [finalScores, setFinalScores] = useState(null);
  // Drawing state
  const [color, setColor] = useState('#ffffff');
  const [size, setSize] = useState(6);
  const [tool, setTool] = useState('pen'); // pen | eraser
  const isDrawingRef = useRef(false);
  const lastPosRef = useRef(null);
  const timerRef = useRef(null);
  const myColor = PLAYER_COLORS_CSS[playerIndex % 4] || '#10b981';

  useEffect(() => {
    const unsub = subscribeAll(channel, (type, data) => {
      if (type === 'scribble:pick-word') {
        setGuessed(false);
        setRevealWord('');
        setChat([]);
        if (data.drawerId === playerId) {
          setIsDrawer(true);
          setWordChoices(data.choices);
          setPhase('pick-word');
        } else {
          setIsDrawer(false);
          setDrawerName(data.drawerName);
          setPhase('waiting');
        }
      }
      if (type === 'scribble:game-state') {
        setRound(data.round);
        setTotalRounds(data.totalRounds);
        setDrawerName(data.drawerName);
        setWordLength(data.wordLength);
        setTimeLeft(data.timeLeft);
        if (data.drawerId === playerId) {
          setPhase('drawing');
          startTimer(data.timeLeft);
        } else {
          setPhase('guessing');
          setHint('_ '.repeat(data.wordLength).trim());
          startTimer(data.timeLeft);
        }
      }
      if (type === 'scribble:hint') {
        setHint(data.hint);
      }
      if (type === 'scribble:correct' && data.playerId === playerId) {
        setGuessed(true);
        setMyScore(prev => prev + (data.pts || 0));
        setChat(c => [...c, { text: `You guessed it! +${data.pts}`, correct: true }]);
      }
      if (type === 'scribble:chat') {
        setChat(c => [...c, { text: `${data.playerName}: ${data.text}`, correct: false }]);
      }
      if (type === 'scribble:reveal') {
        clearInterval(timerRef.current);
        setRevealWord(data.word);
        setPhase('reveal');
      }
      if (type === 'scribble:stroke' && !isDrawer) {
        // Replay strokes on viewer canvas
        replayStroke(data);
      }
      if (type === 'scribble:clear') {
        clearCanvas();
      }
      if (type === 'scribble:end') {
        clearInterval(timerRef.current);
        setFinalScores(data.scores);
        setPhase('ended');
      }
    });
    return () => { unsub(); clearInterval(timerRef.current); };
  }, [isDrawer]);

  function startTimer(secs) {
    clearInterval(timerRef.current);
    setTimeLeft(secs);
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { clearInterval(timerRef.current); return 0; }
        return prev - 1;
      });
    }, 1000);
  }

  function replayStroke(stroke) {
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

  useEffect(() => { clearCanvas(); }, [phase]);

  function getPos(e, canvas) {
    const rect = canvas.getBoundingClientRect();
    const pt = e.touches ? e.touches[0] : e;
    return {
      x: (pt.clientX - rect.left) / rect.width,
      y: (pt.clientY - rect.top) / rect.height,
    };
  }

  function onDrawStart(e) {
    if (!isDrawer || phase !== 'drawing') return;
    e.preventDefault();
    isDrawingRef.current = true;
    const pos = getPos(e, canvasRef.current);
    lastPosRef.current = pos;
    const stroke = { type: 'start', x: pos.x, y: pos.y, color: tool === 'eraser' ? '#1a1a3e' : color, size: tool === 'eraser' ? size * 3 : size };
    // Draw locally
    const ctx = canvasRef.current.getContext('2d');
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(pos.x * canvasRef.current.width, pos.y * canvasRef.current.height);
    channel.publish('scribble:stroke', stroke);
  }

  function onDrawMove(e) {
    if (!isDrawingRef.current || !isDrawer || phase !== 'drawing') return;
    e.preventDefault();
    const pos = getPos(e, canvasRef.current);
    const stroke = { type: 'move', x: pos.x, y: pos.y, color: tool === 'eraser' ? '#1a1a3e' : color, size: tool === 'eraser' ? size * 3 : size };
    const ctx = canvasRef.current.getContext('2d');
    ctx.lineTo(pos.x * canvasRef.current.width, pos.y * canvasRef.current.height);
    ctx.stroke();
    channel.publish('scribble:stroke', stroke);
    lastPosRef.current = pos;
  }

  function onDrawEnd(e) {
    isDrawingRef.current = false;
  }

  function sendGuess(e) {
    e.preventDefault();
    if (!guessText.trim() || guessed) return;
    channel.publish('scribble:guess', { playerId, text: guessText.trim() });
    setGuessText('');
  }

  function chooseWord(word) {
    setMyWord(word);
    setPhase('drawing');
    channel.publish('scribble:word-chosen', { word });
  }

  function doClear() {
    clearCanvas();
    channel.publish('scribble:clear', {});
  }

  // Final scores
  if (phase === 'ended' && finalScores) {
    const sorted = players.slice().sort((a, b) => (finalScores[b.id] || 0) - (finalScores[a.id] || 0));
    const myRank = sorted.findIndex(p => p.id === playerId) + 1;
    return (
      <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 }}>
        <div style={{ fontSize: 56 }}>{myRank === 1 ? '🏆' : '🎨'}</div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 28, color: '#10b981', textAlign: 'center' }}>
          {myRank === 1 ? 'You Won!' : `${myRank}${['st','nd','rd'][myRank-1]||'th'} Place`}
        </h2>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 32, color: myColor }}>{finalScores[playerId] || 0} pts</div>
        <div style={{ width: '100%', maxWidth: 300, marginTop: 8 }}>
          {sorted.map((p, i) => (
            <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)', color: p.id === playerId ? myColor : 'var(--text)' }}>
              <span>{['🥇','🥈','🥉'][i] || `${i+1}.`} {p.name}</span>
              <span style={{ fontFamily: 'var(--font-display)' }}>{finalScores[p.id] || 0}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Pick word
  if (phase === 'pick-word') {
    return (
      <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, gap: 20 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, color: '#10b981', textAlign: 'center' }}>Pick a word to draw!</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', maxWidth: 320 }}>
          {wordChoices.map(word => (
            <button key={word} onClick={() => chooseWord(word)} style={{
              background: 'var(--surface2)', border: '2px solid var(--border2)', borderRadius: 14,
              padding: '18px 24px', color: 'white', fontFamily: 'var(--font-display)', fontSize: 22,
              cursor: 'pointer', transition: 'all 0.1s', letterSpacing: 1,
            }}
              onPointerDown={e => e.currentTarget.style.transform = 'scale(0.97)'}
              onPointerUp={e => e.currentTarget.style.transform = ''}
            >
              {word}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Waiting (non-drawer, between rounds)
  if (phase === 'waiting') {
    return (
      <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 }}>
        <div style={{ fontSize: 48 }}>🎨</div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: '#10b981', textAlign: 'center' }}>
          {drawerName ? `${drawerName} is picking a word...` : 'Waiting for next round...'}
        </h2>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: myColor }}>{myScore} pts</div>
      </div>
    );
  }

  // Reveal
  if (phase === 'reveal') {
    return (
      <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 }}>
        <div style={{ fontSize: 48 }}>🎉</div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, textAlign: 'center' }}>
          The word was:
        </h2>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 36, color: '#10b981', letterSpacing: 2 }}>{revealWord}</div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: myColor }}>{myScore} pts</div>
      </div>
    );
  }

  // Drawing or Guessing phase
  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--bg)', touchAction: 'none', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '8px 14px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, color: isDrawer ? '#10b981' : 'var(--muted)' }}>
          {isDrawer ? `Draw: "${myWord}"` : `${drawerName} is drawing`}
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, color: myColor }}>{myScore}</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: timeLeft <= 15 ? '#ef4444' : 'white' }}>{timeLeft}s</div>
        </div>
      </div>

      {/* Hint bar (for guessers) */}
      {!isDrawer && (
        <div style={{ padding: '6px 14px', background: 'var(--surface2)', textAlign: 'center', fontFamily: 'var(--font-display)', fontSize: 18, letterSpacing: 4, color: guessed ? '#10b981' : 'white' }}>
          {guessed ? '✓ You guessed it!' : hint || '_ '.repeat(wordLength).trim()}
        </div>
      )}

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        width={400} height={isDrawer ? 280 : 320}
        style={{ width: '100%', flex: isDrawer ? undefined : 1, background: '#1a1a3e', display: 'block', cursor: isDrawer ? (tool === 'eraser' ? 'cell' : 'crosshair') : 'default', maxHeight: isDrawer ? 280 : undefined }}
        onPointerDown={onDrawStart}
        onPointerMove={onDrawMove}
        onPointerUp={onDrawEnd}
        onPointerLeave={onDrawEnd}
        onTouchStart={onDrawStart}
        onTouchMove={onDrawMove}
        onTouchEnd={onDrawEnd}
      />

      {/* Drawing tools */}
      {isDrawer && (
        <div style={{ background: 'var(--surface)', borderTop: '1px solid var(--border)', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Color palette */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            {COLORS.map(c => (
              <div key={c} onClick={() => { setColor(c); setTool('pen'); }}
                style={{ width: 28, height: 28, borderRadius: '50%', background: c, border: color === c && tool === 'pen' ? '3px solid white' : '2px solid rgba(255,255,255,0.2)', cursor: 'pointer', flexShrink: 0 }}
              />
            ))}
            {/* Eraser */}
            <div onClick={() => setTool('eraser')}
              style={{ width: 28, height: 28, borderRadius: '50%', background: '#1a1a3e', border: tool === 'eraser' ? '3px solid white' : '2px solid rgba(255,255,255,0.3)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>
              🧹
            </div>
          </div>
          {/* Brush sizes + clear */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {SIZES.map(s => (
              <div key={s} onClick={() => setSize(s)}
                style={{ width: s + 16, height: s + 16, borderRadius: '50%', background: size === s ? 'white' : 'rgba(255,255,255,0.3)', cursor: 'pointer', flexShrink: 0, minWidth: 20, minHeight: 20 }}
              />
            ))}
            <button onClick={doClear} style={{ marginLeft: 'auto', background: 'rgba(239,68,68,0.2)', border: '1px solid #ef4444', color: '#ef4444', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontFamily: 'var(--font-display)', fontSize: 13 }}>
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Guess input for non-drawers */}
      {!isDrawer && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {/* Chat */}
          <div style={{ flex: 1, padding: '8px 12px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {chat.map((c, i) => (
              <div key={i} style={{ fontSize: 13, padding: '4px 8px', borderRadius: 6, background: c.correct ? 'rgba(16,185,129,0.15)' : 'var(--surface)', color: c.correct ? '#10b981' : 'var(--text)' }}>
                {c.text}
              </div>
            ))}
          </div>
          <form onSubmit={sendGuess} style={{ padding: '8px 12px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}>
            <input
              value={guessText}
              onChange={e => setGuessText(e.target.value)}
              placeholder={guessed ? 'You already guessed!' : 'Type your guess...'}
              disabled={guessed}
              autoComplete="off"
              style={{ flex: 1, fontSize: 15 }}
            />
            <button type="submit" disabled={guessed || !guessText.trim()} className="btn btn-primary" style={{ padding: '8px 16px', flexShrink: 0 }}>
              →
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
