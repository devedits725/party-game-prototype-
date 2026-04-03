const gamepadState = {};
let animFrameId = null;

const BUTTON_MAP = {
  jump:    [0, 2],  // A / X
  attack:  [2, 1],  // X / B  
  heavy:   [3, 0],  // Y / A
  start:   [9],     // Start
};

const AXIS_DEADZONE = 0.25;

export function startGamepadPolling(onInput) {
  function poll() {
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (let i = 0; i < gamepads.length; i++) {
      const gp = gamepads[i];
      if (!gp) continue;
      const prev = gamepadState[i] || {};
      const state = {
        left:   gp.axes[0] < -AXIS_DEADZONE || gp.buttons[14]?.pressed,
        right:  gp.axes[0] >  AXIS_DEADZONE || gp.buttons[15]?.pressed,
        up:     gp.axes[1] < -AXIS_DEADZONE || gp.buttons[12]?.pressed,
        down:   gp.axes[1] >  AXIS_DEADZONE || gp.buttons[13]?.pressed,
        jump:   BUTTON_MAP.jump.some(b => gp.buttons[b]?.pressed),
        attack: BUTTON_MAP.attack.some(b => gp.buttons[b]?.pressed),
        heavy:  BUTTON_MAP.heavy.some(b => gp.buttons[b]?.pressed),
      };
      const changed = Object.keys(state).some(k => state[k] !== prev[k]);
      if (changed) {
        gamepadState[i] = state;
        onInput(i, state);
      }
    }
    animFrameId = requestAnimationFrame(poll);
  }
  animFrameId = requestAnimationFrame(poll);
  return () => { if (animFrameId) cancelAnimationFrame(animFrameId); };
}

export function getKeyboardState(keysDown) {
  return {
    left:   keysDown.has('ArrowLeft')  || keysDown.has('a') || keysDown.has('A'),
    right:  keysDown.has('ArrowRight') || keysDown.has('d') || keysDown.has('D'),
    up:     keysDown.has('ArrowUp')    || keysDown.has('w') || keysDown.has('W'),
    jump:   keysDown.has('ArrowUp')    || keysDown.has('w') || keysDown.has('W'),
    attack: keysDown.has('z') || keysDown.has('Z') || keysDown.has('j') || keysDown.has('J'),
    heavy:  keysDown.has('x') || keysDown.has('X') || keysDown.has('k') || keysDown.has('K'),
  };
}
