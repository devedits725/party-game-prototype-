import { useEffect, useRef, useState } from 'react'
import { subscribeAll } from '../../lib/ably.js'
import { PLAYER_COLORS_CSS, CHAR_NAMES, createFighterGame } from './FighterGame.js'
import { startGamepadPolling, getKeyboardState } from '../../lib/gamepad.js'

const STOCKS = 3;

export default function FighterHost({ channel, players, onEnd }) {
  const gameRef = useRef(null);
  const phaserGame = useRef(null);
  const sceneRef = useRef(null);
  const keysDown = useRef(new Set());
  const [playerStats, setPlayerStats] = useState(() =>
    Object.fromEntries(players.map((p, i) => [p.id, { health: 0, stocks: STOCKS, name: p.name, color: PLAYER_COLORS_CSS[i % 4], index: i }]))
  );
  const [winner, setWinner] = useState(null);
  const [gameOver, setGameOver] = useState(false);

  // P1/P2 keyboard mappings
  const KEYBOARD_PLAYERS = [
    { left: ['a','A'], right: ['d','D'], jump: ['w','W'], attack: ['z','Z'], heavy: ['x','X'] },
    { left: ['ArrowLeft'], right: ['ArrowRight'], jump: ['ArrowUp'], attack: ['j','J'], heavy: ['k','K'] },
  ];

  useEffect(() => {
    // Init Phaser
    const game = createFighterGame(
      'phaser-container',
      players,
      (state) => {
        // Update HUD from state
        setPlayerStats(prev => {
          const next = { ...prev };
          Object.entries(state).forEach(([pid, s]) => {
            if (next[pid]) next[pid] = { ...next[pid], health: s.health, stocks: s.stocks };
          });
          return next;
        });
        // Broadcast state to clients
        channel.publish('fighter:state', state);
      },
      (pid, stocks) => {
        channel.publish('fighter:event', { type: 'death', pid, stocks });
      },
      (winnerId, stocks) => {
        const w = players.find(p => p.id === winnerId);
        setWinner(w || null);
        setGameOver(true);
        channel.publish('fighter:event', { type: 'gameover', winnerId, winnerName: w?.name });
      }
    );
    phaserGame.current = game;

    game.events.once('ready', () => {
      sceneRef.current = game.scene.getScene('FighterScene');
    });

    // Keyboard input
    const onKeyDown = (e) => {
      keysDown.current.add(e.key);
      sendKeyboardInput();
    };
    const onKeyUp = (e) => {
      keysDown.current.delete(e.key);
      sendKeyboardInput();
    };

    function sendKeyboardInput() {
      if (!sceneRef.current) return;
      KEYBOARD_PLAYERS.forEach((map, i) => {
        if (i >= players.length) return;
        const pid = players[i].id;
        const ks = keysDown.current;
        sceneRef.current.setInput(pid, {
          left:   map.left.some(k => ks.has(k)),
          right:  map.right.some(k => ks.has(k)),
          jump:   map.jump.some(k => ks.has(k)),
          attack: map.attack.some(k => ks.has(k)),
          heavy:  map.heavy.some(k => ks.has(k)),
        });
      });
    }
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    // Gamepad polling
    const stopGamepad = startGamepadPolling((gpIndex, state) => {
      if (gpIndex >= players.length || !sceneRef.current) return;
      sceneRef.current.setInput(players[gpIndex].id, state);
    });

    // Ably input from phone controllers
    const unsub = subscribeAll(channel, (type, data) => {
      if (type === 'fighter:input' && sceneRef.current) {
        sceneRef.current.setInput(data.playerId, data.input);
      }
    });

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      stopGamepad();
      unsub();
      game.destroy(true);
    };
  }, []);

  const statsArr = Object.values(playerStats);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      {/* HUD */}
      <div style={{ display: 'flex', justifyContent: 'space-around', padding: '12px 16px', background: 'rgba(15,15,45,0.9)', borderBottom: '1px solid var(--border)' }}>
        {statsArr.map((p, i) => (
          <div key={i} style={{ textAlign: 'center', minWidth: 100 }}>
            <div style={{ color: p.color, fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 600 }}>
              {p.name}
            </div>
            <div style={{ fontSize: 22, fontFamily: 'var(--font-display)', color: p.health > 100 ? '#ef4444' : p.health > 60 ? '#f59e0b' : 'white' }}>
              {p.health}%
            </div>
            <div style={{ display: 'flex', gap: 4, justifyContent: 'center', marginTop: 4 }}>
              {Array.from({ length: STOCKS }).map((_, si) => (
                <div key={si} style={{ width: 10, height: 10, borderRadius: '50%', background: si < p.stocks ? p.color : 'rgba(255,255,255,0.15)' }} />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Game canvas */}
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'relative', overflow: 'hidden' }}>
        <div id="phaser-container" ref={gameRef} style={{ maxWidth: '100%' }} />

        {/* Game Over Overlay */}
        {gameOver && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(7,7,26,0.88)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
            <div className="animate-pop">
              <div style={{ fontSize: 48, textAlign: 'center' }}>🏆</div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 36, textAlign: 'center', color: winner ? playerStats[winner.id]?.color || '#f59e0b' : 'white' }}>
                {winner ? `${winner.name} Wins!` : 'Draw!'}
              </h2>
              <div style={{ display: 'flex', gap: 12, marginTop: 24, justifyContent: 'center' }}>
                <button className="btn btn-primary btn-lg" onClick={() => window.location.reload()}>
                  Play Again
                </button>
                <button className="btn btn-ghost btn-lg" onClick={onEnd}>
                  Back to Lobby
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Controls reminder */}
      <div style={{ padding: '8px 16px', background: 'rgba(15,15,45,0.8)', fontSize: 12, color: 'var(--muted)', textAlign: 'center' }}>
        P1: WASD + Z(attack) X(heavy) &nbsp;|&nbsp; P2: Arrows + J(attack) K(heavy) &nbsp;|&nbsp; Phone/Gamepad also supported
      </div>
    </div>
  );
}
