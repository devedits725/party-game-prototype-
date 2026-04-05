import { useState, useEffect, useRef } from 'react'
import { subscribeAll } from '../../lib/ably.js'
import { getSettings, fetchGeminiQuestions, QUIZ_CATEGORIES, PLAYER_COLORS_CSS } from '../../lib/utils.js'

const BUZZ_WINDOW_MS = 10000;
const ANSWER_TIME_MS = 15000;
const FREEZE_TIME_MS = 8000;
const POINTS_CORRECT = 100;
const POINTS_WRONG = -25;
const SPEED_BONUS_MAX = 50;

export default function QuizHost({ channel, players, onEnd }) {
  const [phase, setPhase] = useState('category'); // category | loading | question | buzzed | reveal | scores | ended
  const [questions, setQuestions] = useState([]);
  const [qIndex, setQIndex] = useState(0);
  const [scores, setScores] = useState(() => Object.fromEntries(players.map(p => [p.id, 0])));
  const [buzzOrder, setBuzzOrder] = useState([]); // order players buzzed in
  const [buzzWinner, setBuzzWinner] = useState(null);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const [timerPct, setTimerPct] = useState(100);
  const [category, setCategory] = useState(null);
  const [loading, setLoading] = useState(false);
  const [frozen, setFrozen] = useState({}); // playerId -> true if frozen
  const [lastResult, setLastResult] = useState(null); // 'correct' | 'wrong' | null
  const timerRef = useRef(null);
  const buzzTimeRef = useRef(null);
  const { geminiKey } = getSettings();

  useEffect(() => {
    const unsub = subscribeAll(channel, (type, data) => {
      if (type === 'quiz:buzz') {
        handleBuzz(data.playerId, data.timestamp);
      }
      if (type === 'quiz:answer') {
        handleAnswer(data.playerId, data.answerIndex);
      }
    });
    return unsub;
  }, [phase, buzzOrder, questions, qIndex]);

  async function loadQuestions(cat) {
    setCategory(cat);
    setLoading(true);
    setPhase('loading');
    try {
      const qs = await fetchGeminiQuestions(geminiKey, cat.label, 8);
      setQuestions(qs);
      setLoading(false);
      startQuestion(0, qs);
    } catch (e) {
      alert('Failed to load questions: ' + e.message);
      setPhase('category');
      setLoading(false);
    }
  }

  function startQuestion(idx, qs) {
    const allQs = qs || questions;
    if (idx >= allQs.length) { endGame(); return; }
    setQIndex(idx);
    setBuzzOrder([]);
    setBuzzWinner(null);
    setSelectedAnswer(null);
    setRevealed(false);
    setLastResult(null);
    setPhase('question');
    buzzTimeRef.current = Date.now();

    channel.publish('quiz:question', {
      questionIndex: idx,
      question: allQs[idx].q,
      options: allQs[idx].options,
      timeLimit: BUZZ_WINDOW_MS,
    });

    startTimer(BUZZ_WINDOW_MS, () => {
      // Time out — no one buzzed or answering
      if (phase !== 'buzzed') {
        revealAnswer(idx, allQs, null);
      }
    });
  }

  function startTimer(ms, onDone) {
    clearInterval(timerRef.current);
    const start = Date.now();
    setTimerPct(100);
    timerRef.current = setInterval(() => {
      const pct = Math.max(0, 100 - ((Date.now() - start) / ms) * 100);
      setTimerPct(pct);
      if (pct <= 0) { clearInterval(timerRef.current); onDone(); }
    }, 50);
  }

  function handleBuzz(playerId, ts) {
    if (phase !== 'question') return;
    if (frozen[playerId]) return;
    setBuzzOrder(prev => {
      if (prev.includes(playerId)) return prev;
      const next = [...prev, playerId];
      if (next.length === 1) {
        // First buzz wins
        clearInterval(timerRef.current);
        setBuzzWinner(playerId);
        setPhase('buzzed');
        channel.publish('quiz:buzzed', { playerId, playerName: players.find(p => p.id === playerId)?.name });
        startTimer(ANSWER_TIME_MS, () => {
          // Didn't answer in time — wrong
          handleAnswer(playerId, -1);
        });
      }
      return next;
    });
  }

  function handleAnswer(playerId, answerIndex) {
    if (phase !== 'buzzed') return;
    clearInterval(timerRef.current);
    const q = questions[qIndex];
    if (!q) return;
    const isCorrect = answerIndex === q.correct;

    setSelectedAnswer(answerIndex);
    setRevealed(true);
    setLastResult(isCorrect ? 'correct' : 'wrong');

    const speedBonus = isCorrect
      ? Math.round((1 - Math.min(1, (Date.now() - buzzTimeRef.current) / ANSWER_TIME_MS)) * SPEED_BONUS_MAX)
      : 0;
    const delta = isCorrect ? POINTS_CORRECT + speedBonus : POINTS_WRONG;

    setScores(prev => ({ ...prev, [playerId]: (prev[playerId] || 0) + delta }));

    if (!isCorrect) {
      setFrozen(prev => ({ ...prev, [playerId]: true }));
      setTimeout(() => setFrozen(prev => { const n = {...prev}; delete n[playerId]; return n; }), FREEZE_TIME_MS);
    }

    channel.publish('quiz:result', {
      playerId, answerIndex, correct: q.correct, isCorrect, delta,
      scores: { ...scores, [playerId]: (scores[playerId] || 0) + delta }
    });

    setPhase('reveal');
    setTimeout(() => {
      startQuestion(qIndex + 1);
    }, 3000);
  }

  function endGame() {
    setPhase('ended');
    clearInterval(timerRef.current);
    channel.publish('quiz:end', { scores });
  }

  const currentQ = questions[qIndex];
  const sorted = [...players].sort((a, b) => (scores[b.id] || 0) - (scores[a.id] || 0));

  // CATEGORY SELECTION
  if (phase === 'category') {
    return (
      <div style={{ minHeight: '100vh', padding: 32, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 32, color: '#f59e0b', marginBottom: 8 }}>🧠 Blitz Quiz</h1>
        {!geminiKey && (
          <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: 12, marginBottom: 24, maxWidth: 500, textAlign: 'center', color: '#ef4444' }}>
            ⚠️ Add your Gemini API key in Settings on the Home page to use AI-generated questions.
          </div>
        )}
        <p style={{ color: 'var(--muted)', marginBottom: 32 }}>Pick a category to start</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, width: '100%', maxWidth: 700 }}>
          {QUIZ_CATEGORIES.map(cat => (
            <button key={cat.id} onClick={() => loadQuestions(cat)} className="card" style={{ cursor: 'pointer', textAlign: 'center', border: '1px solid rgba(245,158,11,0.3)', transition: 'all 0.15s', background: 'rgba(245,158,11,0.05)' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = '#f59e0b'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(245,158,11,0.3)'}
            >
              <div style={{ fontSize: 32, marginBottom: 8 }}>{cat.emoji}</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, color: '#f59e0b' }}>{cat.label}</div>
            </button>
          ))}
        </div>
        <button className="btn btn-ghost" style={{ marginTop: 32 }} onClick={onEnd}>← Back to lobby</button>
      </div>
    );
  }

  if (phase === 'loading') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
        <div style={{ width: 48, height: 48, border: '3px solid var(--border)', borderTopColor: '#f59e0b', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <p style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: '#f59e0b' }}>Generating questions with Gemini...</p>
      </div>
    );
  }

  if (phase === 'ended') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <div style={{ fontSize: 64 }}>🏆</div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 36, color: '#f59e0b', marginBottom: 32 }}>Final Scores!</h1>
        <div style={{ width: '100%', maxWidth: 500, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {sorted.map((p, i) => (
            <div key={p.id} className="card animate-fade-in" style={{
              display: 'flex', alignItems: 'center', gap: 16,
              background: i === 0 ? 'rgba(245,158,11,0.15)' : 'var(--surface)',
              borderColor: i === 0 ? '#f59e0b' : 'var(--border)',
            }}>
              <div style={{ fontSize: 24, width: 32, textAlign: 'center' }}>{['🥇','🥈','🥉'][i] || `${i+1}.`}</div>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: PLAYER_COLORS_CSS[players.indexOf(p) % 4] || '#8b5cf6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 16, color: 'white' }}>
                {p.name[0]}
              </div>
              <div style={{ flex: 1, fontFamily: 'var(--font-display)', fontSize: 18 }}>{p.name}</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, color: '#f59e0b' }}>{scores[p.id] || 0}</div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 32 }}>
          <button className="btn btn-primary btn-lg" onClick={() => setPhase('category')}>Play Again</button>
          <button className="btn btn-ghost btn-lg" onClick={onEnd}>Back to Lobby</button>
        </div>
      </div>
    );
  }

  // Main game view
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Timer bar */}
      <div style={{ height: 6, background: 'var(--surface)' }}>
        <div style={{ height: '100%', background: timerPct > 40 ? '#10b981' : timerPct > 20 ? '#f59e0b' : '#ef4444', width: `${timerPct}%`, transition: 'width 0.1s linear' }} />
      </div>

      <div style={{ flex: 1, padding: 24, display: 'flex', gap: 24, maxWidth: 1100, margin: '0 auto', width: '100%', flexWrap: 'wrap' }}>
        {/* Question area */}
        <div style={{ flex: 2, minWidth: 300 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <span className="badge" style={{ background: 'rgba(245,158,11,0.2)', color: '#f59e0b' }}>
              Q {qIndex + 1} / {questions.length}
            </span>
            {category && <span style={{ color: 'var(--muted)', fontSize: 13 }}>{category.emoji} {category.label}</span>}
          </div>

          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 26, lineHeight: 1.4, marginBottom: 32, color: 'white' }}>
            {currentQ?.q || '...'}
          </h2>

          {/* Options */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {currentQ?.options?.map((opt, i) => {
              let bg = 'var(--surface2)';
              let border = 'var(--border)';
              let color = 'white';
              if (revealed) {
                if (i === currentQ.correct) { bg = 'rgba(16,185,129,0.25)'; border = '#10b981'; color = '#10b981'; }
                else if (i === selectedAnswer && i !== currentQ.correct) { bg = 'rgba(239,68,68,0.2)'; border = '#ef4444'; color = '#ef4444'; }
              }
              return (
                <div key={i} style={{ background: bg, border: `1px solid ${border}`, borderRadius: 12, padding: '16px 20px', color, fontFamily: 'var(--font-display)', fontSize: 16, transition: 'all 0.3s' }}>
                  <span style={{ color: 'var(--muted)', marginRight: 10 }}>{['A','B','C','D'][i]}.</span>
                  {opt}
                  {revealed && i === currentQ.correct && ' ✓'}
                  {revealed && i === selectedAnswer && i !== currentQ.correct && ' ✗'}
                </div>
              );
            })}
          </div>

          {/* Buzz winner */}
          {buzzWinner && (
            <div className="animate-pop" style={{ marginTop: 24, background: 'rgba(245,158,11,0.15)', border: '1px solid #f59e0b', borderRadius: 12, padding: 16, textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: '#f59e0b' }}>
                🔔 {players.find(p => p.id === buzzWinner)?.name} buzzed in!
              </div>
              {lastResult && (
                <div style={{ fontSize: 24, marginTop: 8 }}>{lastResult === 'correct' ? '✅ Correct! +' + (POINTS_CORRECT) : '❌ Wrong!'}</div>
              )}
            </div>
          )}

          {phase === 'question' && !buzzWinner && (
            <div className="animate-pulse" style={{ marginTop: 24, color: 'var(--muted)', textAlign: 'center', fontSize: 16, fontFamily: 'var(--font-display)' }}>
              🔔 Waiting for players to buzz in...
            </div>
          )}
        </div>

        {/* Scoreboard */}
        <div style={{ width: 220, flexShrink: 0 }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, color: 'var(--muted)', marginBottom: 12 }}>Scores</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {sorted.map((p, i) => (
              <div key={p.id} className="card" style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                borderColor: frozen[p.id] ? '#ef4444' : 'var(--border)',
                background: frozen[p.id] ? 'rgba(239,68,68,0.1)' : 'var(--surface)',
              }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: PLAYER_COLORS_CSS[players.indexOf(p) % 4] || '#8b5cf6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'white', flexShrink: 0 }}>
                  {p.name[0]}
                </div>
                <div style={{ flex: 1, fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {p.name}
                  {frozen[p.id] && <span style={{ color: '#ef4444', fontSize: 11, display: 'block' }}>⏸ frozen</span>}
                </div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: '#f59e0b', flexShrink: 0 }}>
                  {scores[p.id] || 0}
                </div>
              </div>
            ))}
          </div>
          <button className="btn btn-ghost btn-sm w-full" style={{ marginTop: 16 }} onClick={endGame}>
            End Quiz
          </button>
        </div>
      </div>
    </div>
  );
}
