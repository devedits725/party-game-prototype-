import { useRef, useCallback, useEffect, useState } from 'react'
import { subscribeAll } from '../../lib/ably.js'
import { PLAYER_COLORS_CSS } from './FighterGame.js'

export default function FighterController({ channel, playerId, playerIndex, players, name }) {
  const inputRef = useRef({ left: false, right: false, jump: false, attack: false, heavy: false });
  const [myStats, setMyStats] = useState({ health: 0, stocks: 3 });
  const [gameOver, setGameOver] = useState(false);
  const [winnerName, setWinnerName] = useState(null);
  const myColor = PLAYER_COLORS_CSS[playerIndex % 4] || '#8b5cf6';

  useEffect(() => {
    const unsub = subscribeAll(channel, (type, data) => {
      if (type === 'fighter:state' && data[playerId]) {
        setMyStats({ health: data[playerId].health, stocks: data[playerId].stocks });
      }
      if (type === 'fighter:event' && data.type === 'gameover') {
        setGameOver(true);
        setWinnerName(data.winnerName);
      }
    });
    return unsub;
  }, []);

  function sendInput() {
    channel.publish('fighter:input', { playerId, input: { ...inputRef.current } });
  }

  function press(key, val) {
    if (inputRef.current[key] === val) return;
    inputRef.current[key] = val;
    sendInput();
  }

  const DpadBtn = ({ dir, label, style }) => {
    return (
      <div
        className="touch-btn"
        style={{
          width: 60, height: 60, borderRadius: 12, background: 'rgba(255,255,255,0.08)',
          border: '1px solid rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', fontSize: 22, cursor: 'pointer', userSelect: 'none',
          ...style
        }}
        onPointerDown={(e) => { e.preventDefault(); press(dir, true); }}
        onPointerUp={(e)   => { e.preventDefault(); press(dir, false); }}
        onPointerLeave={(e)=> { e.preventDefault(); press(dir, false); }}
      >
        {label}
      </div>
    );
  };

  const ActionBtn = ({ action, label, color, size = 70 }) => (
    <div
      className="touch-btn"
      style={{
        width: size, height: size, borderRadius: '50%',
        background: color, border: `3px solid ${color}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size > 65 ? 14 : 12, fontFamily: 'var(--font-display)', fontWeight: 600, color: 'white',
        cursor: 'pointer', userSelect: 'none', flexShrink: 0,
        boxShadow: `0 4px 0 ${color}88`,
        transition: 'transform 0.05s',
      }}
      onPointerDown={(e) => { e.preventDefault(); e.currentTarget.style.transform = 'scale(0.9) translateY(3px)'; press(action, true); }}
      onPointerUp={(e)   => { e.preventDefault(); e.currentTarget.style.transform = ''; press(action, false); }}
      onPointerLeave={(e)=> { e.preventDefault(); e.currentTarget.style.transform = ''; press(action, false); }}
    >
      {label}
    </div>
  );

  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--bg)', touchAction: 'none', overflow: 'hidden' }}>
      {/* Top HUD */}
      <div style={{ padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ color: myColor, fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600 }}>{name}</div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, color: myStats.health > 100 ? '#ef4444' : myStats.health > 60 ? '#f59e0b' : 'white' }}>
            {myStats.health}%
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {Array.from({length: 3}).map((_, i) => (
              <div key={i} style={{ width: 10, height: 10, borderRadius: '50%', background: i < myStats.stocks ? myColor : 'rgba(255,255,255,0.2)' }} />
            ))}
          </div>
        </div>
      </div>

      {/* Controller area */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', gap: 16 }}>

        {/* Left: D-Pad */}
        <div style={{ position: 'relative', width: 180, height: 180, flexShrink: 0 }}>
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', display: 'grid', gridTemplateColumns: '60px 60px 60px', gridTemplateRows: '60px 60px 60px', gap: 4 }}>
            <div />
            <DpadBtn dir="jump" label="▲" />
            <div />
            <DpadBtn dir="left" label="◄" />
            <div style={{ width: 60, height: 60, borderRadius: 12, background: 'rgba(255,255,255,0.04)' }} />
            <DpadBtn dir="right" label="►" />
            <div />
            <div style={{ width: 60, height: 60, borderRadius: 12, background: 'rgba(255,255,255,0.04)' }} />
            <div />
          </div>
        </div>

        {/* Right: Action buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end' }}>
            <div style={{ textAlign: 'center' }}>
              <ActionBtn action="attack" label="ATTACK" color="#8b5cf6" />
              <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>Quick</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <ActionBtn action="heavy" label="HEAVY" color="#ef4444" size={80} />
              <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>Strong</div>
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <ActionBtn action="jump" label="JUMP" color="#3b82f6" size={56} />
          </div>
        </div>
      </div>

      {/* Game over overlay */}
      {gameOver && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(7,7,26,0.92)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <div style={{ fontSize: 56 }}>🏆</div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 28, color: '#f59e0b', textAlign: 'center' }}>
            {winnerName === name ? 'You Win! 🎉' : `${winnerName || 'Nobody'} Wins!`}
          </h2>
        </div>
      )}
    </div>
  );
}
