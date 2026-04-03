import Phaser from 'phaser';

export const PLAYER_COLORS_HEX = [0xef4444, 0x3b82f6, 0x10b981, 0xf59e0b];
export const PLAYER_COLORS_CSS = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b'];
export const CHAR_NAMES = ['Blaze', 'Frost', 'Storm', 'Spark'];

const W = 900, H = 540;
const GRAVITY = 2200;
const SPEED = 280;
const JUMP_VEL = -720;
const ATTACK_DURATION = 200;
const HITSTUN_DURATION = 250;
const RESPAWN_DELAY = 2000;
const STOCKS = 3;
const ATTACK_RANGE = 60;
const ATTACK_HEIGHT = 40;

export class FighterScene extends Phaser.Scene {
  constructor() {
    super('FighterScene');
    this.playerObjs = {};
    this.inputState = {};
    this.prevInput = {};
    this.broadcastCallback = null;
    this.onPlayerDied = null;
    this.onGameOver = null;
    this.stocks = {};
    this.dead = {};
    this.respawnTimers = {};
    this.attackBoxes = {};
    this.hitCooldowns = {};
    this.jumpFlags = {};
    this.airJumps = {};
    this.hitstun = {};
    this.gameActive = false;
    this.tick = 0;
  }

  setCallbacks(broadcast, onDied, onGameOver) {
    this.broadcastCallback = broadcast;
    this.onPlayerDied = onDied;
    this.onGameOver = onGameOver;
  }

  setInput(playerId, input) {
    this.inputState[playerId] = input;
  }

  preload() {
    // All graphics drawn programmatically
  }

  create() {
    this.gameActive = true;

    // Background
    this.add.rectangle(W/2, H/2, W, H, 0x07071a);

    // Background decoration - mountains
    const bg = this.add.graphics();
    bg.fillStyle(0x0f0f2d, 1);
    bg.fillTriangle(0, H-80, 180, 200, 360, H-80);
    bg.fillTriangle(200, H-80, 450, 160, 700, H-80);
    bg.fillTriangle(500, H-80, 750, 220, 900, H-80);

    // Grid lines subtle
    const grid = this.add.graphics();
    grid.lineStyle(0.5, 0x8b5cf6, 0.08);
    for (let x = 0; x < W; x += 60) { grid.moveTo(x, 0); grid.lineTo(x, H); }
    for (let y = 0; y < H; y += 60) { grid.moveTo(0, y); grid.lineTo(W, y); }
    grid.strokePath();

    // Platforms
    this.platforms = this.physics.add.staticGroup();
    this._createPlatform(W/2, H-60, 700, 20, 0x4a4a7a);
    this._createPlatform(180, H-160, 200, 14, 0x2d4a6a);
    this._createPlatform(720, H-160, 200, 14, 0x2d4a6a);
    this._createPlatform(W/2, H-260, 180, 14, 0x4a2d6a);

    // Respawn zones (top center)
    this.spawnPoints = [
      { x: 200, y: H-200 },
      { x: 700, y: H-200 },
      { x: 350, y: H-300 },
      { x: 550, y: H-300 },
    ];

    // Generate player textures
    PLAYER_COLORS_HEX.forEach((color, i) => {
      this._generatePlayerTexture(color, i);
    });

    // Kill zone
    this.killZone = this.add.rectangle(W/2, H+100, W*3, 50);
    this.physics.add.existing(this.killZone, true);
  }

  _createPlatform(x, y, w, h, color) {
    const g = this.add.graphics();
    g.fillStyle(color, 1);
    g.fillRect(0, 0, w, h);
    // Highlight top edge
    g.fillStyle(0xffffff, 0.15);
    g.fillRect(0, 0, w, 3);
    g.generateTexture(`platform_${x}_${y}`, w, h);
    g.destroy();
    const p = this.platforms.create(x, y, `platform_${x}_${y}`);
    p.setOrigin(0.5, 0.5);
    p.refreshBody();
    return p;
  }

  _generatePlayerTexture(color, index) {
    const key = `player_${index}`;
    const g = this.add.graphics();
    const w = 36, h = 48;
    // Body (diamond/polygon shape)
    g.fillStyle(color, 1);
    g.fillTriangle(w/2, 2, w-4, h/2, w/2, h-4);     // top-right
    g.fillTriangle(w/2, 2, 4, h/2, w/2, h-4);       // top-left
    // Darker bottom half
    g.fillStyle(Phaser.Display.Color.IntegerToColor(color).darken(30).color, 1);
    g.fillTriangle(4, h/2, w-4, h/2, w/2, h-4);
    // Eyes
    g.fillStyle(0xffffff, 1);
    g.fillCircle(w/2 - 7, h/2 - 6, 5);
    g.fillCircle(w/2 + 7, h/2 - 6, 5);
    g.fillStyle(0x000000, 1);
    g.fillCircle(w/2 - 6, h/2 - 6, 3);
    g.fillCircle(w/2 + 8, h/2 - 6, 3);
    g.generateTexture(key, w, h);
    g.destroy();
  }

  spawnPlayer(playerId, index) {
    const sp = this.spawnPoints[index % this.spawnPoints.length];
    const color = PLAYER_COLORS_HEX[index % PLAYER_COLORS_HEX.length];
    const key = `player_${index % 4}`;

    if (this.playerObjs[playerId]) {
      this.playerObjs[playerId].sprite?.destroy();
      this.playerObjs[playerId].nameText?.destroy();
      this.playerObjs[playerId].healthText?.destroy();
    }

    const sprite = this.physics.add.sprite(sp.x, sp.y, key);
    sprite.setBounce(0.1);
    sprite.setCollideWorldBounds(false);
    sprite.setGravityY(0);
    sprite.body.setMaxVelocityY(1200);

    this.physics.add.collider(sprite, this.platforms);

    const nameText = this.add.text(sp.x, sp.y - 35, CHAR_NAMES[index] || `P${index+1}`, {
      fontFamily: 'Fredoka', fontSize: '14px', color: PLAYER_COLORS_CSS[index % 4],
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5);

    const healthText = this.add.text(sp.x, sp.y - 55, '0%', {
      fontFamily: 'Fredoka', fontSize: '16px', color: '#ffffff',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5);

    this.playerObjs[playerId] = {
      sprite, nameText, healthText,
      health: 0, facing: 1, state: 'idle',
      index, color,
    };
    this.stocks[playerId] = this.stocks[playerId] ?? STOCKS;
    this.dead[playerId] = false;
    this.airJumps[playerId] = 1;
    this.jumpFlags[playerId] = false;
    this.hitstun[playerId] = 0;
    this.hitCooldowns[playerId] = {};
  }

  update(time, delta) {
    if (!this.gameActive) return;
    const dt = delta / 1000;
    this.tick++;

    const ids = Object.keys(this.playerObjs);

    ids.forEach(pid => {
      const obj = this.playerObjs[pid];
      if (!obj || this.dead[pid]) return;
      const sprite = obj.sprite;
      const input = this.inputState[pid] || {};
      const prev = this.prevInput[pid] || {};

      // Hitstun
      if (this.hitstun[pid] > 0) {
        this.hitstun[pid] -= delta;
        this._updateLabels(obj);
        return;
      }

      // Check if attacking
      if (obj.state === 'attacking') {
        this._updateLabels(obj);
        return;
      }

      const onGround = sprite.body.blocked.down;
      if (onGround) this.airJumps[pid] = 1;

      // Movement
      if (input.left) {
        sprite.setVelocityX(-SPEED);
        obj.facing = -1;
        sprite.setFlipX(true);
        obj.state = 'running';
      } else if (input.right) {
        sprite.setVelocityX(SPEED);
        obj.facing = 1;
        sprite.setFlipX(false);
        obj.state = 'running';
      } else {
        sprite.setVelocityX(sprite.body.velocity.x * 0.7);
        obj.state = onGround ? 'idle' : 'jumping';
      }

      // Jump (edge triggered)
      const jumpPressed = input.jump && !prev.jump;
      if (jumpPressed) {
        if (onGround) {
          sprite.setVelocityY(JUMP_VEL);
          obj.state = 'jumping';
        } else if (this.airJumps[pid] > 0) {
          sprite.setVelocityY(JUMP_VEL * 0.85);
          this.airJumps[pid]--;
          obj.state = 'jumping';
        }
      }

      // Gravity
      if (!onGround) {
        sprite.body.velocity.y += GRAVITY * dt;
        sprite.body.velocity.y = Math.min(sprite.body.velocity.y, 1200);
      }

      // Attacks
      const attackPressed = input.attack && !prev.attack;
      const heavyPressed  = input.heavy  && !prev.heavy;
      if ((attackPressed || heavyPressed) && obj.state !== 'attacking') {
        this._doAttack(pid, obj, heavyPressed);
      }

      // Off-screen death
      if (sprite.x < -200 || sprite.x > W+200 || sprite.y > H+100) {
        this._playerDied(pid);
        return;
      }

      // Update sprite scale for "breathing"
      this._updateLabels(obj);
    });

    this.prevInput = JSON.parse(JSON.stringify(this.inputState));

    // Broadcast state every 3 ticks (~20fps)
    if (this.tick % 3 === 0 && this.broadcastCallback) {
      const state = {};
      ids.forEach(pid => {
        const obj = this.playerObjs[pid];
        if (!obj) return;
        const s = obj.sprite;
        state[pid] = {
          x: Math.round(s.x), y: Math.round(s.y),
          vx: Math.round(s.body.velocity.x), vy: Math.round(s.body.velocity.y),
          health: obj.health, stocks: this.stocks[pid],
          facing: obj.facing, state: obj.state, dead: this.dead[pid],
          index: obj.index,
        };
      });
      this.broadcastCallback(state);
    }
  }

  _doAttack(pid, obj, isHeavy) {
    obj.state = 'attacking';
    const duration = isHeavy ? 500 : ATTACK_DURATION;
    const dmg = isHeavy ? 18 : 8;
    const kbX = isHeavy ? 500 : 280;
    const kbY = isHeavy ? -420 : -280;

    // Visual attack indicator
    const g = this.add.graphics();
    const ax = obj.sprite.x + obj.facing * 30;
    const ay = obj.sprite.y;
    g.fillStyle(isHeavy ? 0xff6600 : 0xffffff, 0.7);
    g.fillRect(ax - 20, ay - ATTACK_HEIGHT/2, ATTACK_RANGE, ATTACK_HEIGHT);
    this.time.delayedCall(120, () => g.destroy());

    // Hit detection
    Object.keys(this.playerObjs).forEach(targetId => {
      if (targetId === pid || this.dead[targetId]) return;
      const coolKey = `${pid}_${targetId}`;
      if (this.hitCooldowns[pid]?.[coolKey]) return;

      const target = this.playerObjs[targetId];
      const dx = target.sprite.x - obj.sprite.x;
      const dy = Math.abs(target.sprite.y - obj.sprite.y);

      const inRange = Math.abs(dx) < ATTACK_RANGE && Math.abs(dx) > 0 && dy < ATTACK_HEIGHT;
      const correctDir = obj.facing * dx > 0;

      if (inRange && correctDir) {
        // Hit!
        target.health += dmg;
        const scaledKbX = kbX * (1 + target.health / 60);
        const scaledKbY = kbY * (1 + target.health / 80);
        target.sprite.setVelocityX(obj.facing * scaledKbX);
        target.sprite.setVelocityY(scaledKbY);
        this.hitstun[targetId] = HITSTUN_DURATION;

        // Hit flash
        target.sprite.setTint(0xffffff);
        this.time.delayedCall(100, () => {
          if (target.sprite) target.sprite.clearTint();
        });

        // Cooldown
        if (!this.hitCooldowns[pid]) this.hitCooldowns[pid] = {};
        this.hitCooldowns[pid][coolKey] = true;
        this.time.delayedCall(600, () => {
          if (this.hitCooldowns[pid]) delete this.hitCooldowns[pid][coolKey];
        });
      }
    });

    this.time.delayedCall(duration, () => {
      if (obj) obj.state = 'idle';
    });
  }

  _updateLabels(obj) {
    obj.nameText?.setPosition(obj.sprite.x, obj.sprite.y - 35);
    const healthColor = obj.health < 60 ? '#ffffff' : obj.health < 120 ? '#f59e0b' : '#ef4444';
    obj.healthText?.setPosition(obj.sprite.x, obj.sprite.y - 55).setText(`${obj.health}%`).setStyle({ color: healthColor, stroke: '#000000', strokeThickness: 3 });
  }

  _playerDied(pid) {
    if (this.dead[pid]) return;
    this.dead[pid] = true;
    this.stocks[pid] = (this.stocks[pid] || 1) - 1;

    const obj = this.playerObjs[pid];
    if (obj) {
      // Explosion effect
      const blast = this.add.graphics();
      blast.fillStyle(PLAYER_COLORS_HEX[obj.index % 4], 0.6);
      blast.fillCircle(obj.sprite.x, obj.sprite.y, 30);
      this.tweens.add({ targets: blast, alpha: 0, scaleX: 3, scaleY: 3, duration: 400, onComplete: () => blast.destroy() });
      obj.sprite.setVisible(false);
      obj.nameText?.setVisible(false);
      obj.healthText?.setVisible(false);
    }

    if (this.onPlayerDied) this.onPlayerDied(pid, this.stocks[pid]);

    // Check game over
    const alive = Object.keys(this.stocks).filter(p => (this.stocks[p] || 0) > 0);
    if (alive.length <= 1) {
      this.gameActive = false;
      this.time.delayedCall(1000, () => {
        if (this.onGameOver) this.onGameOver(alive[0] || null, this.stocks);
      });
      return;
    }

    // Respawn if stocks remain
    if ((this.stocks[pid] || 0) > 0) {
      this.time.delayedCall(RESPAWN_DELAY, () => {
        this.dead[pid] = false;
        const obj2 = this.playerObjs[pid];
        if (!obj2) return;
        const sp = this.spawnPoints[obj2.index % this.spawnPoints.length];
        obj2.sprite.setPosition(sp.x, sp.y - 100);
        obj2.sprite.setVelocity(0, 0);
        obj2.sprite.setVisible(true);
        obj2.nameText?.setVisible(true);
        obj2.healthText?.setVisible(true);
        obj2.health = 0;
        // Brief invincibility flash
        let flashing = true;
        const flashInterval = setInterval(() => {
          obj2.sprite?.setAlpha(obj2.sprite.alpha > 0.5 ? 0.2 : 1);
        }, 150);
        this.time.delayedCall(1500, () => { clearInterval(flashInterval); obj2.sprite?.setAlpha(1); });
      });
    }
  }

  destroy() {
    this.gameActive = false;
    super.destroy();
  }
}

export function createFighterGame(containerId, players, onStateUpdate, onPlayerDied, onGameOver) {
  const config = {
    type: Phaser.AUTO,
    width: W, height: H,
    parent: containerId,
    backgroundColor: '#07071a',
    physics: {
      default: 'arcade',
      arcade: { gravity: { y: 0 }, debug: false }
    },
    scene: [FighterScene],
  };

  const game = new Phaser.Game(config);

  game.events.once('ready', () => {
    const scene = game.scene.getScene('FighterScene');
    scene.setCallbacks(onStateUpdate, onPlayerDied, onGameOver);
    players.forEach((p, i) => {
      scene.spawnPlayer(p.id, i);
    });
  });

  return game;
}
