import { useState, useEffect, useRef } from 'react'
import { subscribeAll } from '../../lib/ably.js'
import { PLAYER_COLORS_CSS } from '../../lib/utils.js'

export default function QuizController({ channel, playerId, playerIndex, players, name }) {
  const [phase, setPhase] = useState('waiting'); // waiting | buzz | buzzed-me | buzzed-other | answering | result
  const [question, setQuestion] = useState(null);
  const [options, setOptions] = useState([]);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [correctAnswer, setCorrectAnswer] = useState(null);
  const [myScore, setMyScore] = useState(0);
  const [frozen, setFrozen] = useState(false);
  const [buzzedPlayer, setBuzzedPlayer] = useState(null);
  const [gameEnded, setGameEnded] = useState(false);
  const [finalScores, setFinalScores] = useState(null);
  const [timerPct, setTimerPct] = useState(100);
  const timerRef = useRef(null);
  const myColor = PLAYER_COLORS_CSS[playerIndex % 4] || '#f59e0b';

  useEffect(() => {
    const unsub = subscribeAll(channel, (type, data) => {
      if (type === 'quiz:question') {
        setQuestion(data.question);
        setOptions(data.options || []);
        setSelectedAnswer(null);
        setCorrectAnswer(null);
        setBuzzedPlayer(null);
        setPhase('buzz');
        startTimer(data.timeLimit || 10000);
      }
      if (type === 'quiz:buzzed') {
        clearInterval(timerRef.current);
        if (data.playerId === playerId) {
          setPhase('answering');
          startTimer(15000);
        } else {
          setBuzzedPlayer(data.playerName);
          setPhase('buzzed-other');
        }
      }
      if (type === 'quiz:result') {
        clearInterval(timerRef.current);
        setCorrectAnswer(data.correct);
        setSelectedAnswer(data.answerIndex);
        if (data.playerId === playerId) {
          setMyScore(prev => prev + (data.delta || 0));
          if (!data.isCorrect) {
            setFrozen(true);
            setTimeout(() => setFrozen(false), 8000);
          }
        }
        setPhase('result');
        setTimeout(() => {
          setPhase('waiting');
          setQuestion(null);
        }, 2800);
      }
      if (type === 'quiz:end') {
        clearInterval(timerRef.current);
        setFinalScores(data.scores);
        setGameEnded(true);
      }
    });
    return () => { unsub(); clearInterval(timerRef.current); };
  }, []);

  function startTimer(ms) {
    clearInterval(timerRef.current);
    const start = Date.now();
    setTimerPct(100);
    timerRef.current = setInterval(() => {
      const pct = Math.max(0, 100 - ((Date.now() - start) / ms) * 100);
      setTimerPct(pct);
      if (pct <= 0) clearInterval(timerRef.current);
    }, 50);
  }

  function buzz() {
    if (phase !== 'buzz' || frozen) return;
    channel.publish('quiz:buzz', { playerId, timestamp: Date.now() });
    setPhase('buzzed-me');
  }

  function submitAnswer(i) {
    if (phase !== 'answering') return;
    setSelectedAnswer(i);
    clearInterval(timerRef.current);
    channel.publish('quiz:answer', { playerId, answerIndex: i });
    setPhase('result');
  }

  if (gameEnded) {
    const sorted = players.slice().sort((a, b) => (finalScores?.[b.id] || 0) - (finalScores?.[a.id] || 0));
    const myRank = sorted.findIndex(p => p.id === playerId) + 1;
    return (
      <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, gap: 20 }}>
        <div style={{ fontSize: 56 }}>{myRank === 1 ? '🏆' : myRank === 2 ? '🥈' : myRank === 3 ? '🥉' : '🎮'}</div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 28, color: '#f59e0b', textAlign: 'center' }}>
          {myRank === 1 ? 'You Won!' : `You came ${myRank}${['st','nd','rd'][myRank-1]||'th'}!`}
        </h2>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 36, color: myColor }}>{myScore} pts</div>
        <div style={{ width: '100%', maxWidth: 300 }}>
          {sorted.map((p, i) => (
            <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)', color: p.id === playerId ? myColor : 'var(--text)' }}>
              <span>{['🥇','🥈','🥉'][i] || `${i+1}.`} {p.name}</span>
              <span style={{ fontFamily: 'var(--font-display)' }}>{finalScores?.[p.id] || 0}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      {/* Timer */}
      <div style={{ height: 5, background: 'var(--surface)' }}>
        <div style={{ height: '100%', background: timerPct > 40 ? '#10b981' : timerPct > 20 ? '#f59e0b' : '#ef4444', width: `${timerPct}%`, transition: 'width 0.1s linear' }} />
      </div>

      {/* Header */}
      <div style={{ padding: '10px 16px', display: 'flex', justifyContent: 'space-between', background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ color: myColor, fontFamily: 'var(--font-display)', fontSize: 16 }}>{name}</div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: '#f59e0b' }}>{myScore} pts</div>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20, gap: 20 }}>

        {/* Question text */}
        {question && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '16px 20px', maxWidth: 400, width: '100%', textAlign: 'center', fontFamily: 'var(--font-display)', fontSize: 17, lineHeight: 1.5 }}>
            {question}
          </div>
        )}

        {/* BUZZ phase */}
        {phase === 'buzz' && (
          <div
            className="touch-btn"
            style={{ width: 180, height: 180, borderRadius: '50%', background: frozen ? '#444' : '#ef4444', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: frozen ? 'not-allowed' : 'pointer', boxShadow: frozen ? 'none' : '0 8px 0 #991b1b', transition: 'all 0.1s' }}
            onPointerDown={(e) => {
              e.preventDefault();
              if (!frozen) { e.currentTarget.style.transform = 'translateY(4px)'; e.currentTarget.style.boxShadow = '0 4px 0 #991b1b'; buzz(); }
            }}
            onPointerUp={(e) => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = frozen ? 'none' : '0 8px 0 #991b1b'; }}
          >
            <div style={{ fontSize: 40 }}>{frozen ? '⏸' : '🔔'}</div>
            <div style={{ fontFamily: 'var(--font-display)', color: 'white', fontSize: 20, marginTop: 8 }}>
              {frozen ? 'Frozen!' : 'BUZZ!'}
            </div>
          </div>
        )}

        {phase === 'buzzed-me' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 48 }}>⏳</div>
            <p style={{ fontFamily: 'var(--font-display)', color: '#f59e0b', fontSize: 20 }}>You buzzed! Waiting...</p>
          </div>
        )}

        {phase === 'buzzed-other' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 48 }}>🔔</div>
            <p style={{ fontFamily: 'var(--font-display)', color: 'var(--muted)', fontSize: 18 }}>{buzzedPlayer} is answering...</p>
          </div>
        )}

        {/* ANSWER phase */}
        {phase === 'answering' && (
          <div style={{ width: '100%', maxWidth: 400 }}>
            <p style={{ color: '#f59e0b', fontFamily: 'var(--font-display)', textAlign: 'center', marginBottom: 16, fontSize: 16 }}>
              You're up! Choose your answer:
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {options.map((opt, i) => (
                <button key={i} onClick={() => submitAnswer(i)} style={{
                  background: 'var(--surface2)', border: '2px solid var(--border2)',
                  borderRadius: 12, padding: '16px 12px', color: 'white',
                  fontFamily: 'var(--font-display)', fontSize: 14, cursor: 'pointer',
                  transition: 'all 0.1s', textAlign: 'center', lineHeight: 1.3,
                }}
                  onPointerDown={e => e.currentTarget.style.transform = 'scale(0.95)'}
                  onPointerUp={e => e.currentTarget.style.transform = ''}
                >
                  <div style={{ color: 'var(--muted)', fontSize: 11, marginBottom: 4 }}>{['A','B','C','D'][i]}</div>
                  {opt}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* RESULT phase */}
        {phase === 'result' && correctAnswer !== null && (
          <div className="animate-pop" style={{ textAlign: 'center' }}>
            {selectedAnswer === correctAnswer
              ? <><div style={{ fontSize: 64 }}>✅</div><p style={{ fontFamily: 'var(--font-display)', color: '#10b981', fontSize: 24 }}>Correct! +100</p></>
              : selectedAnswer !== null
                ? <><div style={{ fontSize: 64 }}>❌</div><p style={{ fontFamily: 'var(--font-display)', color: '#ef4444', fontSize: 24 }}>Wrong! -25</p></>
                : <><div style={{ fontSize: 64 }}>⏱️</div><p style={{ fontFamily: 'var(--font-display)', color: 'var(--muted)', fontSize: 18 }}>Answer was {['A','B','C','D'][correctAnswer]}</p></>
            }
          </div>
        )}

        {/* Waiting */}
        {phase === 'waiting' && (
          <div style={{ textAlign: 'center', color: 'var(--muted)' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🧠</div>
            <p className="animate-pulse" style={{ fontFamily: 'var(--font-display)', fontSize: 18 }}>
              Waiting for next question...
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
