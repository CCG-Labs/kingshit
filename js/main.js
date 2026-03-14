window.Game = window.Game || {};

Game.state = null;

Game.Main = {
  canvas: null,
  ctx: null,
  lastFrame: 0,
  menuState: 'menu', // 'menu', 'playing'
  menuTime: 0,
  menuParticles: [],

  init() {
    this.canvas = document.getElementById('game');
    // Compute isometric canvas dimensions
    const cols = Game.Config.GRID_COLS;
    const rows = Game.Config.GRID_ROWS;
    const tw = Game.Config.ISO_TILE_W;
    const th = Game.Config.ISO_TILE_H;
    this.canvas.width = (cols + rows) * tw / 2 + 24;
    this.canvas.height = (cols + rows) * th / 2 + 130;
    this.ctx = this.canvas.getContext('2d');

    Game.Input.init(this.canvas);
    Game.Renderer.init(this.canvas);

    this.showMenu();
    this.lastFrame = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  },

  showMenu() {
    this.menuState = 'menu';
    Game.state = null;
    Game.Particles.clear();
    this.menuTime = 0;
    this._initMenuParticles();
  },

  _initMenuParticles() {
    this.menuParticles = [];
    for (let i = 0; i < 40; i++) {
      this.menuParticles.push({
        x: Math.random() * this.canvas.width,
        y: Math.random() * this.canvas.height,
        vx: (Math.random() - 0.5) * 15,
        vy: -10 - Math.random() * 20,
        size: 1 + Math.random() * 2,
        alpha: 0.2 + Math.random() * 0.4,
        color: Math.random() < 0.5 ? '#FFD700' : '#FF8800',
      });
    }
  },

  startMap(mapData) {
    Game.Map.load(mapData);
    Game.WaveSpawner.init(mapData.waves);

    Game.state = {
      gameState: 'playing',
      towers: [],
      enemies: [],
      projectiles: [],
      gold: Game.Config.STARTING_GOLD,
      lives: Game.Config.STARTING_LIVES,
      placingTower: null,
      selectedTower: null,
      paused: false,
      gameSpeed: 1,
    };

    Game.Particles.clear();
    Game.Renderer.mapCache = null; // Force map rebuild
    this.menuState = 'playing';
  },

  loop(now) {
    let dt = (now - this.lastFrame) / 1000;
    this.lastFrame = now;
    dt = Math.min(dt, 0.05);

    if (this.menuState === 'menu') {
      this.updateMenu(dt);
      this.drawMenu(dt);
    } else {
      this.updateGame(dt);
      this.drawGame(dt);
    }

    Game.Input.consume();
    requestAnimationFrame((t) => this.loop(t));
  },

  updateMenu(dt) {
    this.menuTime += dt;

    // Update floating particles
    for (const p of this.menuParticles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.y < -10) { p.y = this.canvas.height + 10; p.x = Math.random() * this.canvas.width; }
      if (p.x < -10) p.x = this.canvas.width + 10;
      if (p.x > this.canvas.width + 10) p.x = -10;
    }

    const input = Game.Input;
    if (input.clicked && input.clickPos) {
      const x = input.clickPos.x;
      const y = input.clickPos.y;
      if (this.mapButtons) {
        for (const btn of this.mapButtons) {
          if (x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h) {
            this.startMap(btn.mapData);
            return;
          }
        }
      }
    }
  },

  drawMenu(dt) {
    const ctx = this.ctx;
    const canvas = this.canvas;
    const t = this.menuTime;

    // Background gradient
    const bg = ctx.createLinearGradient(0, 0, 0, canvas.height);
    bg.addColorStop(0, '#0a0a1e');
    bg.addColorStop(0.4, '#121228');
    bg.addColorStop(1, '#0a0a16');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Subtle grid pattern
    ctx.strokeStyle = 'rgba(255,255,255,0.02)';
    ctx.lineWidth = 1;
    for (let x = 0; x < canvas.width; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y); ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // Floating particles
    for (const p of this.menuParticles) {
      ctx.globalAlpha = p.alpha * (0.5 + Math.sin(t * 2 + p.x * 0.01) * 0.5);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Radial glow behind title
    const titleY = 72;
    const glow = ctx.createRadialGradient(
      canvas.width / 2, titleY, 0,
      canvas.width / 2, titleY, 200
    );
    glow.addColorStop(0, 'rgba(255,180,0,0.08)');
    glow.addColorStop(0.5, 'rgba(255,140,0,0.03)');
    glow.addColorStop(1, 'rgba(255,100,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, canvas.width, 200);

    // Title with glow
    ctx.save();
    ctx.shadowColor = '#FFD700';
    ctx.shadowBlur = 20 + Math.sin(t * 1.5) * 8;
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 48px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('KINGSHIT', canvas.width / 2, titleY);
    ctx.restore();

    // Subtitle
    ctx.fillStyle = '#666688';
    ctx.font = '13px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Tower Defense \u2014 No Bullshit Edition', canvas.width / 2, titleY + 30);

    // Decorative line under subtitle
    const lineW = 200;
    const lineY = titleY + 44;
    const lineGrad = ctx.createLinearGradient(canvas.width / 2 - lineW / 2, lineY, canvas.width / 2 + lineW / 2, lineY);
    lineGrad.addColorStop(0, 'rgba(255,215,0,0)');
    lineGrad.addColorStop(0.3, 'rgba(255,215,0,0.3)');
    lineGrad.addColorStop(0.5, 'rgba(255,215,0,0.5)');
    lineGrad.addColorStop(0.7, 'rgba(255,215,0,0.3)');
    lineGrad.addColorStop(1, 'rgba(255,215,0,0)');
    ctx.fillStyle = lineGrad;
    ctx.fillRect(canvas.width / 2 - lineW / 2, lineY, lineW, 1);

    // Map selection cards
    const maps = [
      { key: 'forest', data: Game.Maps.forest },
      { key: 'crossroads', data: Game.Maps.crossroads },
      { key: 'castle', data: Game.Maps.castle },
    ];

    this.mapButtons = [];
    const cardW = 400;
    const cardH = 82;
    const startY = titleY + 65;
    const gap = 10;

    for (let i = 0; i < maps.length; i++) {
      const map = maps[i].data;
      const bx = (canvas.width - cardW) / 2;
      const by = startY + i * (cardH + gap);

      this.mapButtons.push({ x: bx, y: by, w: cardW, h: cardH, mapData: map });

      const mx = Game.Input.mouse.x;
      const my = Game.Input.mouse.y;
      const hovered = mx >= bx && mx <= bx + cardW && my >= by && my <= by + cardH;

      // Card background
      const cardBg = hovered ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.02)';
      const cardBorder = hovered ? 'rgba(255,215,0,0.5)' : 'rgba(100,100,120,0.25)';

      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      this._roundRect(ctx, bx + 2, by + 2, cardW, cardH, 6);
      ctx.fill();

      // Background
      ctx.fillStyle = cardBg;
      this._roundRect(ctx, bx, by, cardW, cardH, 6);
      ctx.fill();

      // Border
      ctx.strokeStyle = cardBorder;
      ctx.lineWidth = hovered ? 2 : 1;
      this._roundRect(ctx, bx, by, cardW, cardH, 6);
      ctx.stroke();

      // Hover glow
      if (hovered) {
        const hg = ctx.createLinearGradient(bx, by, bx, by + cardH);
        hg.addColorStop(0, 'rgba(255,215,0,0.06)');
        hg.addColorStop(1, 'rgba(255,215,0,0)');
        ctx.fillStyle = hg;
        this._roundRect(ctx, bx, by, cardW, cardH, 6);
        ctx.fill();
      }

      // Difficulty indicator (left accent bar)
      const diffColors = ['#44AA44', '#DDAA00', '#DD4444'];
      const diffColor = diffColors[map.difficulty - 1] || '#888';
      ctx.fillStyle = diffColor;
      this._roundRect(ctx, bx, by, 4, cardH, 2);
      ctx.fill();

      // Clip text content to card bounds
      ctx.save();
      ctx.beginPath();
      ctx.rect(bx, by, cardW, cardH);
      ctx.clip();

      // Map name
      ctx.fillStyle = hovered ? '#FFFFFF' : '#DDDDDD';
      ctx.font = 'bold 15px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(map.name, bx + 16, by + 24);

      // Difficulty stars + label on same line
      const diffLabels = ['Easy', 'Medium', 'Hard'];
      ctx.fillStyle = '#FFD700';
      ctx.font = '11px monospace';
      ctx.fillText('\u2605'.repeat(map.difficulty) + '\u2606'.repeat(3 - map.difficulty), bx + 16, by + 40);
      ctx.fillStyle = diffColor;
      ctx.font = '10px monospace';
      ctx.fillText(diffLabels[map.difficulty - 1] || '???', bx + 76, by + 40);

      // Description
      ctx.fillStyle = '#888899';
      ctx.font = '11px monospace';
      ctx.fillText(map.description, bx + 16, by + 58);

      // Wave count badge
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      this._roundRect(ctx, bx + cardW - 72, by + 10, 58, 20, 3);
      ctx.fill();
      ctx.fillStyle = '#888899';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(map.waves.length + ' waves', bx + cardW - 43, by + 24);

      ctx.restore();
    }

    // Controls help at bottom
    ctx.textAlign = 'center';
    ctx.font = '10px monospace';
    ctx.fillStyle = '#444466';
    const helpY = canvas.height - 50;
    ctx.fillText('1-6 select tower | Click to place | Right-click to cancel', canvas.width / 2, helpY);
    ctx.fillText('U=Upgrade | S=Sell | T=Target mode | Space=Pause | Enter=Start wave early', canvas.width / 2, helpY + 14);
    ctx.fillText('+/- for game speed', canvas.width / 2, helpY + 28);

    ctx.textAlign = 'left';
  },

  _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  },

  updateGame(dt) {
    const state = Game.state;
    if (!state) return;

    this.handleGameInput();

    if (state.paused) return;
    if (state.gameState !== 'playing') return;

    const gameDt = dt * state.gameSpeed;

    Game.WaveSpawner.update(gameDt, state);

    for (const enemy of state.enemies) {
      if (!enemy.dead && !enemy.escaped) {
        enemy.update(gameDt, state.enemies);
      }
    }

    for (const tower of state.towers) {
      tower.update(gameDt, state.enemies, state.projectiles);
    }

    for (const proj of state.projectiles) {
      if (!proj.dead) proj.update(gameDt);
    }

    Game.Particles.update(gameDt);

    for (const enemy of state.enemies) {
      if (enemy.dead && !enemy._processed) {
        enemy._processed = true;
        state.gold += enemy.gold;
        const esp = Game.Renderer.worldToScreen(enemy.x, enemy.y);
        Game.Particles.goldPopup(esp.x, esp.y, enemy.gold);
        Game.Particles.spawn(esp.x, esp.y, 10, enemy.color, {
          speed: 100, life: 0.5, size: 3, glow: true,
        });
        if (enemy.type === 'boss') {
          Game.Renderer.shake(6, 0.3);
          Game.Particles.explosion(esp.x, esp.y, 40, '#FF4400');
        }
      }
      if (enemy.escaped && !enemy._processed) {
        enemy._processed = true;
        const lifeCost = enemy.type === 'boss' ? Game.Config.BOSS_LIFE_COST : 1;
        state.lives -= lifeCost;
        Game.Renderer.shake(3, 0.15);
        if (state.lives <= 0) {
          state.lives = 0;
          state.gameState = 'gameover';
        }
      }
    }

    const waveComplete = Game.WaveSpawner.isWaveComplete(state.enemies);

    state.enemies = state.enemies.filter(e => !e.dead && !e.escaped);
    state.projectiles = state.projectiles.filter(p => !p.dead);

    if (waveComplete) {
      if (Game.WaveSpawner.allWavesDone || Game.WaveSpawner.getCurrentWave() >= Game.WaveSpawner.getTotalWaves()) {
        if (state.enemies.length === 0) {
          state.gameState = 'victory';
        }
      } else {
        const interest = Math.min(
          Math.round(state.gold * Game.Config.INTEREST_RATE),
          Game.Config.INTEREST_CAP
        );
        if (interest > 0) {
          state.gold += interest;
          Game.Particles.goldPopup(this.canvas.width / 2, 60, interest);
        }
        Game.WaveSpawner.startBetweenWaves();
      }
    }
  },

  handleGameInput() {
    const state = Game.state;
    const input = Game.Input;

    if (input.isKeyPressed(' ')) {
      state.paused = !state.paused;
    }

    if (input.isKeyPressed('+') || input.isKeyPressed('=')) {
      const speeds = Game.Config.GAME_SPEEDS;
      const idx = speeds.indexOf(state.gameSpeed);
      state.gameSpeed = speeds[Math.min(idx + 1, speeds.length - 1)];
    }
    if (input.isKeyPressed('-') || input.isKeyPressed('_')) {
      const speeds = Game.Config.GAME_SPEEDS;
      const idx = speeds.indexOf(state.gameSpeed);
      state.gameSpeed = speeds[Math.max(idx - 1, 0)];
    }

    const towerOrder = Game.Config.TOWER_ORDER;
    for (let i = 0; i < towerOrder.length; i++) {
      if (input.isKeyPressed(String(i + 1))) {
        const type = towerOrder[i];
        const def = Game.Config.TOWERS[type];
        if (state.gold >= def.cost) {
          state.placingTower = state.placingTower === type ? null : type;
          state.selectedTower = null;
        }
      }
    }

    if (input.isKeyPressed('Escape') || input.rightClicked) {
      if (state.placingTower) {
        state.placingTower = null;
      } else if (state.selectedTower) {
        state.selectedTower = null;
      }
    }

    if (input.isKeyPressed('u') || input.isKeyPressed('U')) {
      if (state.selectedTower) {
        const cost = state.selectedTower.getUpgradeCost();
        if (state.gold >= cost) {
          state.gold -= cost;
          state.selectedTower.upgrade();
        }
      }
    }

    if (input.isKeyPressed('s') || input.isKeyPressed('S')) {
      if (state.selectedTower) {
        state.gold += state.selectedTower.getSellValue();
        const idx = state.towers.indexOf(state.selectedTower);
        if (idx >= 0) state.towers.splice(idx, 1);
        state.selectedTower = null;
      }
    }

    if (input.isKeyPressed('t') || input.isKeyPressed('T')) {
      if (state.selectedTower) {
        const modes = Game.Config.TARGET_MODES;
        const idx = modes.indexOf(state.selectedTower.targetMode);
        state.selectedTower.targetMode = modes[(idx + 1) % modes.length];
      }
    }

    if (input.isKeyPressed('Enter') && Game.WaveSpawner.betweenWaves) {
      const bonus = Game.WaveSpawner.startEarly();
      state.gold += bonus;
      if (bonus > 0) {
        Game.Particles.goldPopup(this.canvas.width / 2, this.canvas.height / 2, bonus);
      }
    }

    if (input.clicked && input.clickPos) {
      const x = input.clickPos.x;
      const y = input.clickPos.y;

      if (Game.UI.handleClick(state, x, y, this.canvas)) {
        return;
      }

      const grid = Game.Renderer.screenToGrid(x, y);
      const col = grid.col;
      const row = grid.row;

      if (state.placingTower) {
        if (Game.Map.canPlace(col, row, state.towers)) {
          const def = Game.Config.TOWERS[state.placingTower];
          if (state.gold >= def.cost) {
            state.gold -= def.cost;
            const tower = new Game.Tower(state.placingTower, col, row);
            state.towers.push(tower);
            // Placement particle burst
            const tsp = Game.Renderer.worldToScreen(tower.x, tower.y);
            Game.Particles.spawn(tsp.x, tsp.y, 6, def.color, {
              speed: 60, life: 0.3, size: 2, glow: true,
            });
            if (state.gold < def.cost) {
              state.placingTower = null;
            }
          }
        }
      } else {
        const clickedTower = state.towers.find(t => t.col === col && t.row === row);
        state.selectedTower = clickedTower || null;
      }
    }
  },

  drawGame(dt) {
    Game.Renderer.draw(Game.state, dt);
    Game.UI.draw(this.ctx, Game.state, this.canvas);
  },
};

// Boot
window.addEventListener('DOMContentLoaded', () => {
  Game.Main.init();
});
