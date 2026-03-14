window.Game = window.Game || {};

Game.Renderer = {
  canvas: null,
  ctx: null,
  screenShake: 0,
  shakeIntensity: 0,
  time: 0,

  // Cached assets
  mapCache: null,
  lastMapRef: null,
  treeSprites: [],
  rockSprites: [],

  init(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.time = 0;
    this.mapCache = null;
    this.lastMapRef = null;
    this.generateDecoSprites();
  },

  shake(intensity, duration) {
    this.shakeIntensity = intensity;
    this.screenShake = duration;
  },

  // Deterministic random for procedural generation
  _seed: 42,
  seedRng(s) { this._seed = s; },
  rng() {
    this._seed = (this._seed * 16807 + 0) % 2147483647;
    return (this._seed - 1) / 2147483646;
  },

  // ── Decoration sprite generation ────────────────────────────

  generateDecoSprites() {
    const ts = Game.Config.TILE_SIZE;
    this.treeSprites = [];
    for (let v = 0; v < 5; v++) this.treeSprites.push(this._mkTree(ts, v));
    this.rockSprites = [];
    for (let v = 0; v < 4; v++) this.rockSprites.push(this._mkRock(ts, v));
  },

  _mkTree(ts, variant) {
    const off = document.createElement('canvas');
    off.width = ts; off.height = ts;
    const c = off.getContext('2d');
    const cx = ts / 2, cy = ts / 2;
    this.seedRng(variant * 137 + 7);

    // Shadow
    c.fillStyle = 'rgba(0,0,0,0.18)';
    c.beginPath();
    c.ellipse(cx + 1, cy + ts * 0.32, ts * 0.28, ts * 0.09, 0, 0, Math.PI * 2);
    c.fill();

    // Trunk
    const tw = 3 + this.rng() * 2;
    const tg = c.createLinearGradient(cx - tw, cy, cx + tw, cy);
    tg.addColorStop(0, '#4E342E');
    tg.addColorStop(0.5, '#6D4C41');
    tg.addColorStop(1, '#3E2723');
    c.fillStyle = tg;
    c.fillRect(cx - tw, cy + 2, tw * 2, ts * 0.28);

    // Foliage layers
    const greens = ['#1B5E20', '#2E7D32', '#388E3C', '#43A047', '#4CAF50'];
    const layers = [
      { r: ts * 0.36, y: cy + 4 },
      { r: ts * 0.30, y: cy - 3 },
      { r: ts * 0.22, y: cy - 9 },
    ];
    for (let i = 0; i < layers.length; i++) {
      const l = layers[i];
      const g = c.createRadialGradient(cx - 3, l.y - 3, 0, cx, l.y, l.r);
      g.addColorStop(0, greens[(variant + i + 1) % greens.length]);
      g.addColorStop(0.6, greens[(variant + i) % greens.length]);
      g.addColorStop(1, '#0D3B10');
      c.beginPath();
      c.arc(cx + (this.rng() - 0.5) * 4, l.y, l.r, 0, Math.PI * 2);
      c.fillStyle = g;
      c.fill();
    }

    // Highlight specks
    for (let i = 0; i < 4; i++) {
      c.fillStyle = `rgba(200,255,200,${0.15 + this.rng() * 0.15})`;
      c.beginPath();
      c.arc(cx + (this.rng() - 0.5) * ts * 0.4, cy - 6 + (this.rng() - 0.5) * ts * 0.3, 1.5, 0, Math.PI * 2);
      c.fill();
    }
    return off;
  },

  _mkRock(ts, variant) {
    const off = document.createElement('canvas');
    off.width = ts; off.height = ts;
    const c = off.getContext('2d');
    const cx = ts / 2, cy = ts / 2 + 4;
    this.seedRng(variant * 251 + 13);

    // Shadow
    c.fillStyle = 'rgba(0,0,0,0.15)';
    c.beginPath();
    c.ellipse(cx + 1, cy + ts * 0.15, ts * 0.22, ts * 0.06, 0, 0, Math.PI * 2);
    c.fill();

    // Rock body
    const pts = 7 + Math.floor(this.rng() * 3);
    const baseR = ts * (0.14 + this.rng() * 0.1);
    c.beginPath();
    for (let i = 0; i < pts; i++) {
      const a = (i / pts) * Math.PI * 2;
      const r = baseR + (this.rng() - 0.5) * ts * 0.06;
      const px = cx + Math.cos(a) * r;
      const py = cy + Math.sin(a) * r * 0.7;
      if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
    }
    c.closePath();
    const g = c.createLinearGradient(cx - baseR, cy - baseR, cx + baseR, cy + baseR);
    g.addColorStop(0, '#9E9E9E');
    g.addColorStop(0.4, '#757575');
    g.addColorStop(1, '#4E4E4E');
    c.fillStyle = g;
    c.fill();
    c.strokeStyle = '#37474F';
    c.lineWidth = 1;
    c.stroke();

    // Specular highlight
    c.fillStyle = 'rgba(255,255,255,0.18)';
    c.beginPath();
    c.ellipse(cx - baseR * 0.3, cy - baseR * 0.3, baseR * 0.25, baseR * 0.15, -0.4, 0, Math.PI * 2);
    c.fill();

    return off;
  },

  // ── Map cache building ──────────────────────────────────────

  buildMapCache() {
    const map = Game.Map.current;
    if (!map) return;
    const ts = Game.Config.TILE_SIZE;
    const off = document.createElement('canvas');
    off.width = this.canvas.width;
    off.height = this.canvas.height;
    const c = off.getContext('2d');
    this.seedRng(42);

    // Pass 1: terrain
    for (let row = 0; row < map.grid.length; row++) {
      for (let col = 0; col < map.grid[row].length; col++) {
        const x = col * ts, y = row * ts;
        const t = map.grid[row][col];
        if (t === Game.Config.TILE.PATH || t === Game.Config.TILE.ENTRY || t === Game.Config.TILE.EXIT) {
          this._drawPathTile(c, x, y, ts, col, row, map);
        } else if (t === Game.Config.TILE.BUILDABLE) {
          this._drawGrassTile(c, x, y, ts, true);
        } else {
          this._drawGrassTile(c, x, y, ts, false);
        }
      }
    }

    // Pass 2: decorations on blocked tiles
    this.seedRng(99);
    for (let row = 0; row < map.grid.length; row++) {
      for (let col = 0; col < map.grid[row].length; col++) {
        if (map.grid[row][col] !== Game.Config.TILE.BLOCKED) continue;
        const r = this.rng();
        if (r < 0.32) {
          c.drawImage(this.treeSprites[Math.floor(this.rng() * this.treeSprites.length)], col * ts, row * ts);
        } else if (r < 0.45) {
          c.drawImage(this.rockSprites[Math.floor(this.rng() * this.rockSprites.length)], col * ts, row * ts);
        }
      }
    }

    // Pass 3: buildable tile corner brackets
    for (let row = 0; row < map.grid.length; row++) {
      for (let col = 0; col < map.grid[row].length; col++) {
        if (map.grid[row][col] !== Game.Config.TILE.BUILDABLE) continue;
        const x = col * ts, y = row * ts;
        c.strokeStyle = 'rgba(255,255,255,0.10)';
        c.lineWidth = 1;
        const m = 5;
        // 4 corners
        c.beginPath();
        c.moveTo(x + 1, y + m); c.lineTo(x + 1, y + 1); c.lineTo(x + m, y + 1);
        c.moveTo(x + ts - m, y + 1); c.lineTo(x + ts - 1, y + 1); c.lineTo(x + ts - 1, y + m);
        c.moveTo(x + 1, y + ts - m); c.lineTo(x + 1, y + ts - 1); c.lineTo(x + m, y + ts - 1);
        c.moveTo(x + ts - m, y + ts - 1); c.lineTo(x + ts - 1, y + ts - 1); c.lineTo(x + ts - 1, y + ts - m);
        c.stroke();
      }
    }

    // Pass 4: entry/exit static markers
    for (let row = 0; row < map.grid.length; row++) {
      for (let col = 0; col < map.grid[row].length; col++) {
        const t = map.grid[row][col];
        const x = col * ts, y = row * ts;
        if (t === Game.Config.TILE.ENTRY) {
          c.fillStyle = 'rgba(255,60,60,0.12)';
          c.fillRect(x, y, ts, ts);
          // Arrow
          c.fillStyle = 'rgba(255,80,80,0.35)';
          c.beginPath();
          c.moveTo(x + ts * 0.65, y + ts / 2);
          c.lineTo(x + ts * 0.3, y + ts * 0.3);
          c.lineTo(x + ts * 0.3, y + ts * 0.7);
          c.closePath();
          c.fill();
        } else if (t === Game.Config.TILE.EXIT) {
          c.fillStyle = 'rgba(60,60,255,0.12)';
          c.fillRect(x, y, ts, ts);
          c.strokeStyle = 'rgba(100,100,255,0.35)';
          c.lineWidth = 2;
          c.beginPath(); c.arc(x + ts / 2, y + ts / 2, ts * 0.25, 0, Math.PI * 2); c.stroke();
          c.beginPath(); c.arc(x + ts / 2, y + ts / 2, ts * 0.12, 0, Math.PI * 2); c.stroke();
          c.fillStyle = 'rgba(100,100,255,0.4)';
          c.beginPath(); c.arc(x + ts / 2, y + ts / 2, 3, 0, Math.PI * 2); c.fill();
        }
      }
    }

    this.mapCache = off;
  },

  _drawGrassTile(c, x, y, ts, buildable) {
    const h = buildable ? 118 : 125;
    const s = buildable ? 52 : 42;
    const l = buildable ? 30 : 25;
    const hv = (this.rng() - 0.5) * 12;
    const lv = (this.rng() - 0.5) * 6;
    c.fillStyle = `hsl(${h + hv}, ${s}%, ${l + lv}%)`;
    c.fillRect(x, y, ts, ts);

    // Grass blade details
    const n = 3 + Math.floor(this.rng() * 5);
    for (let i = 0; i < n; i++) {
      const bx = x + this.rng() * ts;
      const by = y + this.rng() * ts;
      const bh = 3 + this.rng() * 6;
      c.strokeStyle = `hsla(${108 + this.rng() * 24}, 45%, ${22 + this.rng() * 16}%, 0.7)`;
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(bx, by);
      c.lineTo(bx + (this.rng() - 0.5) * 5, by - bh);
      c.stroke();
    }

    // Occasional tiny flowers
    if (this.rng() < 0.12) {
      const fx = x + 4 + this.rng() * (ts - 8);
      const fy = y + 4 + this.rng() * (ts - 8);
      const colors = ['#FFEB3B', '#E8F5E9', '#CE93D8', '#EF9A9A'];
      c.fillStyle = colors[Math.floor(this.rng() * colors.length)];
      c.beginPath();
      c.arc(fx, fy, 1.5, 0, Math.PI * 2);
      c.fill();
    }
  },

  _drawPathTile(c, x, y, ts, col, row, map) {
    // Base dirt with gradient
    const g = c.createLinearGradient(x, y, x + ts, y + ts);
    g.addColorStop(0, '#8D6E4C');
    g.addColorStop(0.5, '#7A5B3A');
    g.addColorStop(1, '#6B4C2E');
    c.fillStyle = g;
    c.fillRect(x, y, ts, ts);

    // Pebble texture
    const n = 2 + Math.floor(this.rng() * 4);
    for (let i = 0; i < n; i++) {
      const px = x + 3 + this.rng() * (ts - 6);
      const py = y + 3 + this.rng() * (ts - 6);
      const pr = 1.2 + this.rng() * 2;
      c.fillStyle = `rgba(${90 + this.rng() * 50}, ${75 + this.rng() * 35}, ${45 + this.rng() * 25}, 0.35)`;
      c.beginPath();
      c.ellipse(px, py, pr, pr * 0.65, this.rng() * Math.PI, 0, Math.PI * 2);
      c.fill();
    }

    // Edge blending with grass where path borders non-path
    const dirs = [[0, -1, 'top'], [0, 1, 'bottom'], [-1, 0, 'left'], [1, 0, 'right']];
    for (const [dc, dr, side] of dirs) {
      const nt = this._tileAt(map, col + dc, row + dr);
      if (nt === Game.Config.TILE.PATH || nt === Game.Config.TILE.ENTRY || nt === Game.Config.TILE.EXIT) continue;
      // Grass encroachment gradient
      let eg;
      if (side === 'left') {
        eg = c.createLinearGradient(x, y, x + 8, y);
        eg.addColorStop(0, 'rgba(35,85,22,0.55)'); eg.addColorStop(1, 'rgba(35,85,22,0)');
        c.fillStyle = eg; c.fillRect(x, y, 8, ts);
      } else if (side === 'right') {
        eg = c.createLinearGradient(x + ts - 8, y, x + ts, y);
        eg.addColorStop(0, 'rgba(35,85,22,0)'); eg.addColorStop(1, 'rgba(35,85,22,0.55)');
        c.fillStyle = eg; c.fillRect(x + ts - 8, y, 8, ts);
      } else if (side === 'top') {
        eg = c.createLinearGradient(x, y, x, y + 8);
        eg.addColorStop(0, 'rgba(35,85,22,0.55)'); eg.addColorStop(1, 'rgba(35,85,22,0)');
        c.fillStyle = eg; c.fillRect(x, y, ts, 8);
      } else {
        eg = c.createLinearGradient(x, y + ts - 8, x, y + ts);
        eg.addColorStop(0, 'rgba(35,85,22,0)'); eg.addColorStop(1, 'rgba(35,85,22,0.55)');
        c.fillStyle = eg; c.fillRect(x, y + ts - 8, ts, 8);
      }
    }
  },

  _tileAt(map, col, row) {
    if (row < 0 || row >= map.grid.length) return Game.Config.TILE.BLOCKED;
    if (col < 0 || col >= map.grid[0].length) return Game.Config.TILE.BLOCKED;
    return map.grid[row][col];
  },

  // ── Main draw ───────────────────────────────────────────────

  draw(state, dt) {
    const ctx = this.ctx;
    const ts = Game.Config.TILE_SIZE;
    this.time += dt;

    ctx.save();
    if (this.screenShake > 0) {
      this.screenShake -= dt;
      ctx.translate(
        (Math.random() - 0.5) * this.shakeIntensity * 2,
        (Math.random() - 0.5) * this.shakeIntensity * 2
      );
    }

    // Map (cached)
    if (!this.mapCache || this.lastMapRef !== Game.Map.current) {
      this.buildMapCache();
      this.lastMapRef = Game.Map.current;
    }
    ctx.drawImage(this.mapCache, 0, 0);

    // Dynamic overlays (hover, pulse)
    this._drawOverlays(ctx, ts, state);

    // Placement preview
    if (state.placingTower) this.drawPlacementPreview(ctx, state, ts);
    if (state.selectedTower) {
      this.drawRangeCircle(ctx, state.selectedTower.x, state.selectedTower.y, state.selectedTower.range, 'select');
    }

    // Tower shadows
    for (const t of state.towers) {
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.beginPath();
      ctx.ellipse(t.x + 2, t.y + ts * 0.32, ts * 0.3, ts * 0.1, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Ground enemies
    for (const e of state.enemies) {
      if (!e.dead && !e.escaped && !e.flying) this.drawEnemy(ctx, e);
    }

    // Towers
    for (const t of state.towers) this.drawTower(ctx, t, ts);

    // Flying enemies (above towers)
    for (const e of state.enemies) {
      if (!e.dead && !e.escaped && e.flying) this.drawEnemy(ctx, e, true);
    }

    // Projectiles
    for (const p of state.projectiles) {
      if (!p.dead) this.drawProjectile(ctx, p);
    }

    // Particles
    Game.Particles.draw(ctx);

    ctx.restore();
  },

  _drawOverlays(ctx, ts) {
    const map = Game.Map.current;
    if (!map) return;

    // Hover highlight
    const grid = Game.Input.getGridPos();
    if (grid.col >= 0 && grid.col < Game.Config.GRID_COLS &&
        grid.row >= 0 && grid.row < Game.Config.GRID_ROWS &&
        Game.Map.isBuildable(grid.col, grid.row)) {
      const x = grid.col * ts, y = grid.row * ts;
      ctx.fillStyle = 'rgba(255,255,255,0.10)';
      ctx.fillRect(x, y, ts, ts);
      ctx.strokeStyle = 'rgba(255,255,255,0.28)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x + 1, y + 1, ts - 2, ts - 2);
    }

    // Entry/exit animated pulse
    const pulse = 0.08 + Math.sin(this.time * 2.5) * 0.06;
    for (let row = 0; row < map.grid.length; row++) {
      for (let col = 0; col < map.grid[row].length; col++) {
        const t = map.grid[row][col];
        if (t === Game.Config.TILE.ENTRY) {
          ctx.fillStyle = `rgba(255,80,80,${pulse})`;
          ctx.fillRect(col * ts, row * ts, ts, ts);
        } else if (t === Game.Config.TILE.EXIT) {
          ctx.fillStyle = `rgba(80,80,255,${pulse})`;
          ctx.fillRect(col * ts, row * ts, ts, ts);
        }
      }
    }
  },

  // ── Placement preview ───────────────────────────────────────

  drawPlacementPreview(ctx, state, ts) {
    const grid = Game.Input.getGridPos();
    const col = grid.col, row = grid.row;
    const def = Game.Config.TOWERS[state.placingTower];
    const ok = Game.Map.canPlace(col, row, state.towers);
    const x = col * ts, y = row * ts;

    ctx.fillStyle = ok ? 'rgba(0,255,0,0.2)' : 'rgba(255,0,0,0.2)';
    ctx.fillRect(x, y, ts, ts);
    ctx.strokeStyle = ok ? 'rgba(0,255,0,0.5)' : 'rgba(255,0,0,0.5)';
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, ts - 2, ts - 2);

    const cx = x + ts / 2, cy = y + ts / 2;
    this.drawRangeCircle(ctx, cx, cy, def.range, ok ? 'valid' : 'invalid');

    ctx.globalAlpha = 0.45;
    this._drawTowerBody(ctx, cx, cy, state.placingTower, def, ts, 0, 1);
    ctx.globalAlpha = 1;
  },

  drawRangeCircle(ctx, x, y, range, mode) {
    ctx.beginPath();
    ctx.arc(x, y, range, 0, Math.PI * 2);
    if (mode === 'valid' || mode === 'select') {
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    } else {
      ctx.fillStyle = 'rgba(255,0,0,0.08)';
      ctx.strokeStyle = 'rgba(255,0,0,0.2)';
    }
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
  },

  // ── Tower drawing ───────────────────────────────────────────

  drawTower(ctx, tower, ts) {
    const def = Game.Config.TOWERS[tower.type];
    this._drawTowerBody(ctx, tower.x, tower.y, tower.type, def, ts, tower.facing, tower.level);

    // Level stars
    if (tower.level > 1) {
      ctx.save();
      ctx.shadowColor = '#FFD700';
      ctx.shadowBlur = 4;
      ctx.fillStyle = '#FFD700';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('\u2605'.repeat(tower.level - 1), tower.x, tower.y - ts * 0.42);
      ctx.restore();
    }

    // Flame cone visual
    if (tower.special === 'cone' && tower.target) {
      ctx.save();
      ctx.translate(tower.x, tower.y);
      ctx.rotate(tower.facing);
      const fg = ctx.createRadialGradient(0, 0, 0, 0, 0, tower.range);
      fg.addColorStop(0, 'rgba(255,120,0,0.25)');
      fg.addColorStop(0.5, 'rgba(255,60,0,0.12)');
      fg.addColorStop(1, 'rgba(255,30,0,0)');
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, tower.range, -tower.coneAngle / 2, tower.coneAngle / 2);
      ctx.closePath();
      ctx.fillStyle = fg;
      ctx.fill();
      ctx.restore();
    }
  },

  // Public helper for UI tower icons
  drawTowerShape(ctx, x, y, color, ts, facing) {
    // Find tower type by color
    const types = Game.Config.TOWER_ORDER;
    for (const t of types) {
      if (Game.Config.TOWERS[t].color === color) {
        this._drawTowerBody(ctx, x, y, t, Game.Config.TOWERS[t], ts, facing, 1);
        return;
      }
    }
    // Fallback
    this._drawTowerBody(ctx, x, y, 'arrow', Game.Config.TOWERS.arrow, ts, facing, 1);
  },

  _drawTowerBody(ctx, x, y, type, def, ts, facing, level) {
    const size = ts * 0.36;

    // Base platform (shadow ring)
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath();
    ctx.ellipse(x, y + size * 0.15, size * 1.1, size * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();

    // Type-specific rendering
    switch (type) {
      case 'arrow': this._drawArrowTower(ctx, x, y, size, facing, level); break;
      case 'cannon': this._drawCannonTower(ctx, x, y, size, facing, level); break;
      case 'frost': this._drawFrostTower(ctx, x, y, size, facing, level); break;
      case 'lightning': this._drawLightningTower(ctx, x, y, size, facing, level); break;
      case 'sniper': this._drawSniperTower(ctx, x, y, size, facing, level); break;
      case 'flame': this._drawFlameTower(ctx, x, y, size, facing, level); break;
      default: this._drawGenericTower(ctx, x, y, size, def.color, facing); break;
    }
  },

  _drawArrowTower(ctx, x, y, size, facing, level) {
    // Wooden base
    const bg = ctx.createRadialGradient(x - 3, y - 3, 0, x, y, size);
    bg.addColorStop(0, '#A0855A');
    bg.addColorStop(0.6, '#8B6914');
    bg.addColorStop(1, '#5D4310');
    this._drawOctagon(ctx, x, y, size, bg, '#3E2E0A');

    // Wooden planks texture
    ctx.strokeStyle = 'rgba(93,67,16,0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - size * 0.5, y); ctx.lineTo(x + size * 0.5, y);
    ctx.moveTo(x, y - size * 0.5); ctx.lineTo(x, y + size * 0.5);
    ctx.stroke();

    // Crossbow barrel
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(facing);
    // Main beam
    const bGrad = ctx.createLinearGradient(0, -3, 0, 3);
    bGrad.addColorStop(0, '#6D4C10');
    bGrad.addColorStop(1, '#3E2C08');
    ctx.fillStyle = bGrad;
    ctx.fillRect(size * 0.3, -2.5, size * 0.9, 5);
    // Cross bow arms
    ctx.strokeStyle = '#5D4310';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(size * 0.5, -size * 0.4);
    ctx.quadraticCurveTo(size * 0.7, 0, size * 0.5, size * 0.4);
    ctx.stroke();
    // String
    ctx.strokeStyle = 'rgba(200,180,140,0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(size * 0.5, -size * 0.38);
    ctx.lineTo(size * 0.3, 0);
    ctx.lineTo(size * 0.5, size * 0.38);
    ctx.stroke();
    ctx.restore();
  },

  _drawCannonTower(ctx, x, y, size, facing, level) {
    // Metal base
    const bg = ctx.createRadialGradient(x - 2, y - 2, 0, x, y, size);
    bg.addColorStop(0, '#888888');
    bg.addColorStop(0.5, '#555555');
    bg.addColorStop(1, '#333333');
    this._drawOctagon(ctx, x, y, size, bg, '#222222');

    // Rivets
    const rivetAngles = [0, Math.PI / 2, Math.PI, Math.PI * 1.5];
    for (const a of rivetAngles) {
      ctx.fillStyle = '#777';
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * size * 0.65, y + Math.sin(a) * size * 0.65, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Cannon barrel
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(facing);
    const bGrad = ctx.createLinearGradient(0, -5, 0, 5);
    bGrad.addColorStop(0, '#666');
    bGrad.addColorStop(0.5, '#444');
    bGrad.addColorStop(1, '#333');
    ctx.fillStyle = bGrad;
    // Barrel body (tapered)
    ctx.beginPath();
    ctx.moveTo(size * 0.3, -4);
    ctx.lineTo(size * 1.1, -3);
    ctx.lineTo(size * 1.1, 3);
    ctx.lineTo(size * 0.3, 4);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 1;
    ctx.stroke();
    // Barrel end ring
    ctx.fillStyle = '#555';
    ctx.fillRect(size * 1.0, -4.5, 4, 9);
    ctx.restore();
  },

  _drawFrostTower(ctx, x, y, size, facing, level) {
    // Frost aura glow
    ctx.save();
    ctx.shadowColor = '#88DDFF';
    ctx.shadowBlur = 12;
    // Crystal base
    const bg = ctx.createRadialGradient(x - 2, y - 2, 0, x, y, size);
    bg.addColorStop(0, '#BBDDFF');
    bg.addColorStop(0.4, '#88CCEE');
    bg.addColorStop(1, '#4488AA');
    this._drawOctagon(ctx, x, y, size, bg, '#336688');
    ctx.restore();

    // Crystal facets
    ctx.strokeStyle = 'rgba(200,230,255,0.4)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * size * 0.7, y + Math.sin(a) * size * 0.7);
      ctx.stroke();
    }

    // Ice crystal barrel
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(facing);
    ctx.fillStyle = '#AADDFF';
    ctx.beginPath();
    ctx.moveTo(size * 0.4, 0);
    ctx.lineTo(size * 1.0, -4);
    ctx.lineTo(size * 1.2, 0);
    ctx.lineTo(size * 1.0, 4);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#77BBDD';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();

    // Floating ice particles
    const t = this.time;
    for (let i = 0; i < 3; i++) {
      const a = t * 1.5 + i * (Math.PI * 2 / 3);
      const r = size * 0.9;
      const px = x + Math.cos(a) * r;
      const py = y + Math.sin(a) * r;
      ctx.fillStyle = 'rgba(180,220,255,0.5)';
      ctx.beginPath();
      ctx.arc(px, py, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  _drawLightningTower(ctx, x, y, size, facing, level) {
    // Electric glow
    ctx.save();
    ctx.shadowColor = '#FFD700';
    ctx.shadowBlur = 10 + Math.sin(this.time * 8) * 4;
    const bg = ctx.createRadialGradient(x - 2, y - 2, 0, x, y, size);
    bg.addColorStop(0, '#FFE066');
    bg.addColorStop(0.5, '#FFD700');
    bg.addColorStop(1, '#B8860B');
    this._drawOctagon(ctx, x, y, size, bg, '#8B6508');
    ctx.restore();

    // Lightning bolt symbol on top
    ctx.fillStyle = '#FFFF88';
    ctx.beginPath();
    ctx.moveTo(x + 2, y - size * 0.5);
    ctx.lineTo(x - 3, y + 1);
    ctx.lineTo(x + 1, y + 1);
    ctx.lineTo(x - 2, y + size * 0.5);
    ctx.lineTo(x + 4, y - 2);
    ctx.lineTo(x, y - 2);
    ctx.closePath();
    ctx.fill();

    // Spire / rod
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(facing);
    ctx.fillStyle = '#DAA520';
    ctx.fillRect(size * 0.4, -1.5, size * 0.7, 3);
    // Tip orb
    ctx.fillStyle = '#FFFF44';
    ctx.beginPath();
    ctx.arc(size * 1.15, 0, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Random mini arcs
    if (Math.random() < 0.3) {
      ctx.strokeStyle = 'rgba(255,255,100,0.4)';
      ctx.lineWidth = 1;
      const a = Math.random() * Math.PI * 2;
      const r1 = size * 0.6;
      const r2 = size * 1.0;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1);
      ctx.lineTo(x + Math.cos(a + 0.3) * r2, y + Math.sin(a + 0.3) * r2);
      ctx.stroke();
    }
  },

  _drawSniperTower(ctx, x, y, size, facing, level) {
    // Dark red base
    const bg = ctx.createRadialGradient(x - 2, y - 2, 0, x, y, size);
    bg.addColorStop(0, '#CC3333');
    bg.addColorStop(0.5, '#8B0000');
    bg.addColorStop(1, '#550000');
    this._drawOctagon(ctx, x, y, size, bg, '#330000');

    // Scope crosshair on base
    ctx.strokeStyle = 'rgba(255,100,100,0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - size * 0.4, y); ctx.lineTo(x + size * 0.4, y);
    ctx.moveTo(x, y - size * 0.4); ctx.lineTo(x, y + size * 0.4);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, size * 0.3, 0, Math.PI * 2);
    ctx.stroke();

    // Long barrel
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(facing);
    const bGrad = ctx.createLinearGradient(0, -2, 0, 2);
    bGrad.addColorStop(0, '#555');
    bGrad.addColorStop(1, '#222');
    ctx.fillStyle = bGrad;
    ctx.fillRect(size * 0.3, -2, size * 1.3, 4);
    // Scope
    ctx.fillStyle = '#444';
    ctx.fillRect(size * 0.7, -6, 6, 4);
    // Scope lens
    ctx.fillStyle = '#FF4444';
    ctx.globalAlpha = 0.6 + Math.sin(this.time * 3) * 0.2;
    ctx.beginPath();
    ctx.arc(size * 0.73 + 3, -6, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    // Muzzle
    ctx.fillStyle = '#333';
    ctx.fillRect(size * 1.5, -3, 4, 6);
    ctx.restore();
  },

  _drawFlameTower(ctx, x, y, size, facing, level) {
    // Fiery glow
    ctx.save();
    ctx.shadowColor = '#FF4400';
    ctx.shadowBlur = 8 + Math.sin(this.time * 6) * 3;
    const bg = ctx.createRadialGradient(x - 2, y - 2, 0, x, y, size);
    bg.addColorStop(0, '#FF8833');
    bg.addColorStop(0.5, '#FF6600');
    bg.addColorStop(1, '#993300');
    this._drawOctagon(ctx, x, y, size, bg, '#662200');
    ctx.restore();

    // Inner fire pattern
    for (let i = 0; i < 3; i++) {
      const a = this.time * 2 + i * (Math.PI * 2 / 3);
      const r = size * 0.35;
      ctx.fillStyle = `rgba(255,${200 + Math.floor(Math.sin(a) * 55)},0,0.4)`;
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * r * 0.3, y + Math.sin(a) * r * 0.3, r * 0.35, 0, Math.PI * 2);
      ctx.fill();
    }

    // Nozzle
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(facing);
    ctx.fillStyle = '#555';
    ctx.beginPath();
    ctx.moveTo(size * 0.3, -4);
    ctx.lineTo(size * 0.8, -6);
    ctx.lineTo(size * 0.9, -3);
    ctx.lineTo(size * 0.9, 3);
    ctx.lineTo(size * 0.8, 6);
    ctx.lineTo(size * 0.3, 4);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  },

  _drawGenericTower(ctx, x, y, size, color, facing) {
    this._drawOctagon(ctx, x, y, size, color, '#000');
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(facing);
    ctx.fillStyle = '#333';
    ctx.fillRect(size * 0.5, -2, size * 0.6, 4);
    ctx.restore();
  },

  _drawOctagon(ctx, x, y, size, fillStyle, strokeColor) {
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 - Math.PI / 8;
      const px = x + Math.cos(a) * size;
      const py = y + Math.sin(a) * size;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = fillStyle;
    ctx.fill();
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  },

  // ── Enemy drawing ───────────────────────────────────────────

  drawEnemy(ctx, enemy, isFlying) {
    const r = enemy.radius;
    const drawY = isFlying ? enemy.y - 12 : enemy.y;

    // Flying shadow
    if (isFlying) {
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.ellipse(enemy.x + 3, enemy.y + 6, r * 0.75, r * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    const flashColor = enemy.hitFlash > 0 ? '#FFFFFF' : null;
    const baseColor = flashColor || enemy.color;

    // Shield bubble
    if (enemy.shieldHp > 0) {
      const shieldAlpha = 0.3 + 0.4 * (enemy.shieldHp / enemy.maxShieldHp);
      ctx.save();
      ctx.shadowColor = '#4488FF';
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(enemy.x, drawY, r + 5, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(68,136,255,${shieldAlpha})`;
      ctx.lineWidth = 2;
      ctx.stroke();
      // Shield fill
      ctx.fillStyle = `rgba(68,136,255,${shieldAlpha * 0.15})`;
      ctx.fill();
      ctx.restore();
    }

    // Body
    ctx.save();
    if (enemy.shape === 'diamond') {
      ctx.translate(enemy.x, drawY);
      ctx.rotate(Math.PI / 4);
      const dSize = r * 0.7;
      const dg = ctx.createRadialGradient(-2, -2, 0, 0, 0, dSize * 1.5);
      dg.addColorStop(0, this._lighten(baseColor, 30));
      dg.addColorStop(0.7, baseColor);
      dg.addColorStop(1, this._darken(baseColor, 30));
      ctx.fillStyle = dg;
      ctx.fillRect(-dSize, -dSize, dSize * 2, dSize * 2);
      ctx.strokeStyle = this._darken(baseColor, 50);
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-dSize, -dSize, dSize * 2, dSize * 2);
      ctx.restore();
    } else {
      // Circle body with gradient
      const eg = ctx.createRadialGradient(enemy.x - r * 0.3, drawY - r * 0.3, 0, enemy.x, drawY, r);
      eg.addColorStop(0, this._lighten(baseColor, 40));
      eg.addColorStop(0.6, baseColor);
      eg.addColorStop(1, this._darken(baseColor, 40));
      ctx.beginPath();
      ctx.arc(enemy.x, drawY, r, 0, Math.PI * 2);
      ctx.fillStyle = eg;
      ctx.fill();
      ctx.strokeStyle = this._darken(baseColor, 60);
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
    }

    // Wings for flyers
    if (isFlying) {
      const wingFlap = Math.sin(this.time * 12) * 0.3;
      ctx.save();
      ctx.translate(enemy.x, drawY);
      ctx.strokeStyle = enemy.color;
      ctx.lineWidth = 2;
      ctx.fillStyle = `rgba(${this._hexToRgb(enemy.color)},0.3)`;
      // Left wing
      ctx.beginPath();
      ctx.moveTo(-r * 0.4, 0);
      ctx.quadraticCurveTo(-r * 1.6, -r * (1.2 + wingFlap), -r * 0.2, -r * 0.2);
      ctx.fill();
      ctx.stroke();
      // Right wing
      ctx.beginPath();
      ctx.moveTo(r * 0.4, 0);
      ctx.quadraticCurveTo(r * 1.6, -r * (1.2 + wingFlap), r * 0.2, -r * 0.2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // Healer cross with glow
    if (enemy.special === 'heal') {
      ctx.save();
      ctx.shadowColor = '#44FF44';
      ctx.shadowBlur = 6;
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(enemy.x - 2, drawY - r * 0.45, 4, r * 0.9);
      ctx.fillRect(enemy.x - r * 0.45, drawY - 2, r * 0.9, 4);
      ctx.restore();
    }

    // Boss crown with glow
    if (enemy.type === 'boss') {
      ctx.save();
      ctx.shadowColor = '#FFD700';
      ctx.shadowBlur = 6;
      ctx.fillStyle = '#FFD700';
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('\u265B', enemy.x, drawY - r - 5);
      ctx.restore();
    }

    // Health bar (enhanced)
    if (enemy.hp < enemy.maxHp) {
      const barW = r * 2.5;
      const barH = 4;
      const barX = enemy.x - barW / 2;
      const barY = drawY - r - 9;
      const hpRatio = enemy.hp / enemy.maxHp;

      // Background
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);
      // Fill
      let barColor;
      if (hpRatio > 0.6) barColor = '#44cc44';
      else if (hpRatio > 0.3) barColor = '#cccc44';
      else barColor = '#cc4444';
      const barGrad = ctx.createLinearGradient(barX, barY, barX, barY + barH);
      barGrad.addColorStop(0, this._lighten(barColor, 20));
      barGrad.addColorStop(1, barColor);
      ctx.fillStyle = barGrad;
      ctx.fillRect(barX, barY, barW * hpRatio, barH);
      // Border
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(barX - 0.5, barY - 0.5, barW + 1, barH + 1);
    }

    // Shield bar (below health bar)
    if (enemy.shieldHp > 0 && enemy.shieldHp < enemy.maxShieldHp) {
      const barW = r * 2.5;
      const barH = 2;
      const barX = enemy.x - barW / 2;
      const barY = drawY - r - 4;
      const ratio = enemy.shieldHp / enemy.maxShieldHp;
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(barX, barY, barW, barH);
      ctx.fillStyle = '#4488FF';
      ctx.fillRect(barX, barY, barW * ratio, barH);
    }

    // Stun indicator
    if (enemy.stunned) {
      ctx.save();
      ctx.shadowColor = '#FFFF00';
      ctx.shadowBlur = 4;
      ctx.fillStyle = '#FFFF00';
      ctx.font = '11px monospace';
      ctx.textAlign = 'center';
      const stunY = drawY - r - (enemy.hp < enemy.maxHp ? 15 : 8);
      ctx.fillText('\u2726', enemy.x, stunY);
      ctx.restore();
    }

    // Slow indicator (ice ring)
    const slowed = enemy.statusEffects.some(e => e.type === 'slow');
    if (slowed) {
      ctx.strokeStyle = 'rgba(136,204,238,0.6)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.arc(enemy.x, drawY, r + 3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      // Ice crystals
      for (let i = 0; i < 4; i++) {
        const a = this.time * 2 + i * Math.PI / 2;
        ctx.fillStyle = 'rgba(180,220,255,0.6)';
        ctx.beginPath();
        ctx.arc(enemy.x + Math.cos(a) * (r + 3), drawY + Math.sin(a) * (r + 3), 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // DoT indicator (fire particles)
    const burning = enemy.statusEffects.some(e => e.type === 'dot');
    if (burning) {
      for (let i = 0; i < 2; i++) {
        const fx = enemy.x + (Math.random() - 0.5) * r * 1.5;
        const fy = drawY + (Math.random() - 0.5) * r * 1.5;
        ctx.fillStyle = `rgba(255,${Math.floor(100 + Math.random() * 100)},0,0.6)`;
        ctx.beginPath();
        ctx.arc(fx, fy, 1.5 + Math.random(), 0, Math.PI * 2);
        ctx.fill();
      }
    }
  },

  // ── Projectile drawing ──────────────────────────────────────

  drawProjectile(ctx, proj) {
    if (proj.type === 'lightning') {
      this.drawLightning(ctx, proj);
      return;
    }

    // Glow trail
    if (proj.trail && proj.trail.length > 1) {
      for (let i = 1; i < proj.trail.length; i++) {
        const t = proj.trail[i];
        const alpha = (i / proj.trail.length) * 0.4;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = proj.color;
        ctx.beginPath();
        ctx.arc(t.x, t.y, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // Projectile body with glow
    ctx.save();
    ctx.shadowColor = proj.color;
    ctx.shadowBlur = 6;

    if (proj.towerType === 'cannon') {
      // Cannonball with metallic gradient
      const cg = ctx.createRadialGradient(proj.x - 1, proj.y - 1, 0, proj.x, proj.y, 5);
      cg.addColorStop(0, '#666');
      cg.addColorStop(0.7, '#333');
      cg.addColorStop(1, '#111');
      ctx.fillStyle = cg;
      ctx.beginPath();
      ctx.arc(proj.x, proj.y, 5, 0, Math.PI * 2);
      ctx.fill();
    } else if (proj.towerType === 'frost') {
      // Ice crystal (diamond with glow)
      ctx.shadowColor = '#88DDFF';
      ctx.shadowBlur = 8;
      ctx.fillStyle = '#AADDFF';
      ctx.translate(proj.x, proj.y);
      ctx.rotate(this.time * 4);
      ctx.beginPath();
      ctx.moveTo(0, -4); ctx.lineTo(3, 0); ctx.lineTo(0, 4); ctx.lineTo(-3, 0);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#77BBDD';
      ctx.lineWidth = 0.5;
      ctx.stroke();
    } else if (proj.towerType === 'sniper') {
      // Sniper tracer
      ctx.shadowColor = '#FF4444';
      ctx.shadowBlur = 10;
      const angle = Math.atan2(proj.ty - proj.y, proj.tx - proj.x);
      ctx.translate(proj.x, proj.y);
      ctx.rotate(angle);
      ctx.fillStyle = '#FF4444';
      ctx.fillRect(-8, -1.5, 16, 3);
      // Bright core
      ctx.fillStyle = '#FFAAAA';
      ctx.fillRect(-6, -0.5, 12, 1);
    } else {
      // Arrow
      const angle = Math.atan2(proj.ty - proj.y, proj.tx - proj.x);
      ctx.translate(proj.x, proj.y);
      ctx.rotate(angle);
      // Shaft
      ctx.fillStyle = '#8B6914';
      ctx.fillRect(-6, -0.7, 10, 1.4);
      // Head
      ctx.fillStyle = proj.color;
      ctx.beginPath();
      ctx.moveTo(6, 0);
      ctx.lineTo(2, -3);
      ctx.lineTo(3, 0);
      ctx.lineTo(2, 3);
      ctx.closePath();
      ctx.fill();
      // Fletching
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.beginPath();
      ctx.moveTo(-5, -2); ctx.lineTo(-6, 0); ctx.lineTo(-5, 2); ctx.lineTo(-4, 0);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  },

  drawLightning(ctx, proj) {
    ctx.save();
    ctx.globalAlpha = proj.life / proj.maxLife;
    ctx.shadowColor = proj.color;
    ctx.shadowBlur = 15;

    // Outer glow line
    ctx.strokeStyle = 'rgba(255,255,100,0.3)';
    ctx.lineWidth = 6;
    let sx = proj.sourceX, sy = proj.sourceY;
    for (const t of proj.targets) {
      this._drawJagged(ctx, sx, sy, t.x, t.y);
      sx = t.x; sy = t.y;
    }

    // Inner bright line
    ctx.strokeStyle = proj.color;
    ctx.lineWidth = 2;
    sx = proj.sourceX; sy = proj.sourceY;
    for (const t of proj.targets) {
      this._drawJagged(ctx, sx, sy, t.x, t.y);
      sx = t.x; sy = t.y;
    }

    // Core white line
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1;
    sx = proj.sourceX; sy = proj.sourceY;
    for (const t of proj.targets) {
      this._drawJagged(ctx, sx, sy, t.x, t.y);
      sx = t.x; sy = t.y;
    }

    // Impact flashes
    for (const t of proj.targets) {
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(t.x, t.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  },

  _drawJagged(ctx, x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const segs = Math.max(3, Math.floor(dist / 12));
    const px = -dy / dist, py = dx / dist;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    for (let i = 1; i < segs; i++) {
      const t = i / segs;
      const j = (Math.random() - 0.5) * 14;
      ctx.lineTo(x1 + dx * t + px * j, y1 + dy * t + py * j);
    }
    ctx.lineTo(x2, y2);
    ctx.stroke();
  },

  // ── Color utilities ─────────────────────────────────────────

  _lighten(hex, amount) {
    const rgb = this._parseHex(hex);
    return `rgb(${Math.min(255, rgb[0] + amount)},${Math.min(255, rgb[1] + amount)},${Math.min(255, rgb[2] + amount)})`;
  },

  _darken(hex, amount) {
    const rgb = this._parseHex(hex);
    return `rgb(${Math.max(0, rgb[0] - amount)},${Math.max(0, rgb[1] - amount)},${Math.max(0, rgb[2] - amount)})`;
  },

  _parseHex(hex) {
    if (hex.startsWith('rgb')) {
      const m = hex.match(/\d+/g);
      return m ? [+m[0], +m[1], +m[2]] : [128, 128, 128];
    }
    hex = hex.replace('#', '');
    if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    return [parseInt(hex.substr(0, 2), 16), parseInt(hex.substr(2, 2), 16), parseInt(hex.substr(4, 2), 16)];
  },

  _hexToRgb(hex) {
    const rgb = this._parseHex(hex);
    return `${rgb[0]},${rgb[1]},${rgb[2]}`;
  },
};
