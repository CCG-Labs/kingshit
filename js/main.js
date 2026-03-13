window.Game = window.Game || {};

Game.state = null;

Game.Main = {
  canvas: null,
  ctx: null,
  lastFrame: 0,
  menuState: 'menu', // 'menu', 'playing'

  init() {
    this.canvas = document.getElementById('game');
    this.canvas.width = Game.Config.GRID_COLS * Game.Config.TILE_SIZE;
    this.canvas.height = Game.Config.GRID_ROWS * Game.Config.TILE_SIZE;
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
    this.menuState = 'playing';
  },

  loop(now) {
    let dt = (now - this.lastFrame) / 1000;
    this.lastFrame = now;

    // Cap dt to prevent tunneling on tab-switch
    dt = Math.min(dt, 0.05);

    if (this.menuState === 'menu') {
      this.updateMenu(dt);
      this.drawMenu();
    } else {
      this.updateGame(dt);
      this.drawGame(dt);
    }

    Game.Input.consume();
    requestAnimationFrame((t) => this.loop(t));
  },

  updateMenu(dt) {
    const input = Game.Input;

    if (input.clicked && input.clickPos) {
      const x = input.clickPos.x;
      const y = input.clickPos.y;

      // Check map buttons
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

  drawMenu() {
    const ctx = this.ctx;
    const canvas = this.canvas;
    const C = Game.Config.COLORS;

    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Title
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 42px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('KINGSHIT', canvas.width / 2, 80);

    ctx.fillStyle = '#AAAAAA';
    ctx.font = '14px monospace';
    ctx.fillText('Tower Defense - No Bullshit Edition', canvas.width / 2, 110);

    // Map selection
    const maps = [
      { key: 'forest', data: Game.Maps.forest },
      { key: 'crossroads', data: Game.Maps.crossroads },
      { key: 'castle', data: Game.Maps.castle },
    ];

    this.mapButtons = [];
    const btnW = 280;
    const btnH = 80;
    const startY = 160;
    const gap = 15;

    for (let i = 0; i < maps.length; i++) {
      const map = maps[i].data;
      const bx = (canvas.width - btnW) / 2;
      const by = startY + i * (btnH + gap);

      this.mapButtons.push({ x: bx, y: by, w: btnW, h: btnH, mapData: map });

      // Hover check
      const mx = Game.Input.mouse.x;
      const my = Game.Input.mouse.y;
      const hovered = mx >= bx && mx <= bx + btnW && my >= by && my <= by + btnH;

      ctx.fillStyle = hovered ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.05)';
      ctx.fillRect(bx, by, btnW, btnH);
      ctx.strokeStyle = hovered ? '#FFD700' : '#666666';
      ctx.lineWidth = hovered ? 2 : 1;
      ctx.strokeRect(bx, by, btnW, btnH);

      // Map name
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 16px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(map.name, bx + 12, by + 24);

      // Difficulty
      ctx.fillStyle = '#FFD700';
      ctx.font = '12px monospace';
      ctx.fillText('★'.repeat(map.difficulty) + '☆'.repeat(3 - map.difficulty), bx + 12, by + 42);

      // Description
      ctx.fillStyle = '#AAAAAA';
      ctx.font = '11px monospace';
      ctx.fillText(map.description, bx + 12, by + 60);

      // Wave count
      ctx.fillStyle = '#888888';
      ctx.textAlign = 'right';
      ctx.fillText(`${map.waves.length} waves`, bx + btnW - 12, by + 24);
    }

    // Controls help
    ctx.textAlign = 'center';
    ctx.fillStyle = '#666666';
    ctx.font = '11px monospace';
    const helpY = canvas.height - 60;
    ctx.fillText('Controls: 1-6 select tower | Click to place | Right-click to cancel', canvas.width / 2, helpY);
    ctx.fillText('U=Upgrade | S=Sell | T=Target mode | Space=Pause | Enter=Start wave early', canvas.width / 2, helpY + 16);
    ctx.fillText('Mouse wheel or +/- for game speed', canvas.width / 2, helpY + 32);

    ctx.textAlign = 'left';
  },

  updateGame(dt) {
    const state = Game.state;
    if (!state) return;

    // Handle input
    this.handleGameInput();

    if (state.paused) return;
    if (state.gameState !== 'playing') return;

    // Apply game speed
    const gameDt = dt * state.gameSpeed;

    // Update wave spawner
    Game.WaveSpawner.update(gameDt, state);

    // Update enemies
    for (const enemy of state.enemies) {
      if (!enemy.dead && !enemy.escaped) {
        enemy.update(gameDt, state.enemies);
      }
    }

    // Update towers
    for (const tower of state.towers) {
      tower.update(gameDt, state.enemies, state.projectiles);
    }

    // Update projectiles
    for (const proj of state.projectiles) {
      if (!proj.dead) proj.update(gameDt);
    }

    // Update particles
    Game.Particles.update(gameDt);

    // Process dead enemies (gold, lives)
    for (const enemy of state.enemies) {
      if (enemy.dead && !enemy._processed) {
        enemy._processed = true;
        state.gold += enemy.gold;
        Game.Particles.goldPopup(enemy.x, enemy.y, enemy.gold);
        Game.Particles.spawn(enemy.x, enemy.y, 8, enemy.color, {
          speed: 80, life: 0.4, size: 3,
        });
        if (enemy.type === 'boss') {
          Game.Renderer.shake(6, 0.3);
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

    // Check wave completion (before cleanup so isWaveComplete sees all enemies)
    const waveComplete = Game.WaveSpawner.isWaveComplete(state.enemies);

    // Cleanup dead entities
    state.enemies = state.enemies.filter(e => !e.dead && !e.escaped);
    state.projectiles = state.projectiles.filter(p => !p.dead);

    if (waveComplete) {
      if (Game.WaveSpawner.allWavesDone || Game.WaveSpawner.getCurrentWave() >= Game.WaveSpawner.getTotalWaves()) {
        if (state.enemies.length === 0) {
          state.gameState = 'victory';
        }
      } else {
        // Interest
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

    // Pause
    if (input.isKeyPressed(' ')) {
      state.paused = !state.paused;
    }

    // Game speed
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

    // Tower hotkeys
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

    // Escape / right-click cancel
    if (input.isKeyPressed('Escape') || input.rightClicked) {
      if (state.placingTower) {
        state.placingTower = null;
      } else if (state.selectedTower) {
        state.selectedTower = null;
      }
    }

    // Upgrade hotkey
    if (input.isKeyPressed('u') || input.isKeyPressed('U')) {
      if (state.selectedTower) {
        const cost = state.selectedTower.getUpgradeCost();
        if (state.gold >= cost) {
          state.gold -= cost;
          state.selectedTower.upgrade();
        }
      }
    }

    // Sell hotkey
    if (input.isKeyPressed('s') || input.isKeyPressed('S')) {
      if (state.selectedTower) {
        state.gold += state.selectedTower.getSellValue();
        const idx = state.towers.indexOf(state.selectedTower);
        if (idx >= 0) state.towers.splice(idx, 1);
        state.selectedTower = null;
      }
    }

    // Target mode cycle
    if (input.isKeyPressed('t') || input.isKeyPressed('T')) {
      if (state.selectedTower) {
        const modes = Game.Config.TARGET_MODES;
        const idx = modes.indexOf(state.selectedTower.targetMode);
        state.selectedTower.targetMode = modes[(idx + 1) % modes.length];
      }
    }

    // Start early
    if (input.isKeyPressed('Enter') && Game.WaveSpawner.betweenWaves) {
      const bonus = Game.WaveSpawner.startEarly();
      state.gold += bonus;
      if (bonus > 0) {
        Game.Particles.goldPopup(this.canvas.width / 2, this.canvas.height / 2, bonus);
      }
    }

    // Click handling
    if (input.clicked && input.clickPos) {
      const x = input.clickPos.x;
      const y = input.clickPos.y;

      // UI gets first crack
      if (Game.UI.handleClick(state, x, y, this.canvas)) {
        return;
      }

      // Game area click
      const ts = Game.Config.TILE_SIZE;
      const col = Math.floor(x / ts);
      const row = Math.floor(y / ts);

      if (state.placingTower) {
        // Place tower
        if (Game.Map.canPlace(col, row, state.towers)) {
          const def = Game.Config.TOWERS[state.placingTower];
          if (state.gold >= def.cost) {
            state.gold -= def.cost;
            const tower = new Game.Tower(state.placingTower, col, row);
            state.towers.push(tower);
            // Don't clear placingTower so user can place multiple
            // Unless they can't afford another
            if (state.gold < def.cost) {
              state.placingTower = null;
            }
          }
        }
      } else {
        // Select/deselect tower
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
