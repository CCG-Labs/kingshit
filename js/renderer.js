window.Game = window.Game || {};

Game.Renderer = {
  canvas: null,
  ctx: null,
  screenShake: 0,
  shakeIntensity: 0,
  time: 0,

  // Iso projection
  isoTileW: 0,
  isoTileH: 0,
  isoOriginX: 0,
  isoOriginY: 0,

  // Cache
  mapCache: null,
  lastMapRef: null,

  init(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.time = 0;
    this.mapCache = null;
    this.lastMapRef = null;

    this.isoTileW = Game.Config.ISO_TILE_W;
    this.isoTileH = Game.Config.ISO_TILE_H;
    this.isoOriginX = Game.Config.GRID_ROWS * this.isoTileW / 2 + 12;
    this.isoOriginY = 38;
  },

  shake(intensity, duration) {
    this.shakeIntensity = intensity;
    this.screenShake = duration;
  },

  // ── Isometric projection ─────────────────────────────────

  gridToScreen(col, row) {
    return {
      x: this.isoOriginX + (col - row) * this.isoTileW / 2,
      y: this.isoOriginY + (col + row) * this.isoTileH / 2,
    };
  },

  worldToScreen(wx, wy) {
    const ts = Game.Config.TILE_SIZE;
    return this.gridToScreen(wx / ts, wy / ts);
  },

  screenToGrid(sx, sy) {
    const hw = this.isoTileW / 2;
    const hh = this.isoTileH / 2;
    const dx = sx - this.isoOriginX;
    const dy = sy - this.isoOriginY;
    return {
      col: Math.floor((dx / hw + dy / hh) / 2),
      row: Math.floor((dy / hh - dx / hw) / 2),
    };
  },

  // ── Iso diamond / block primitives ───────────────────────

  _tileDiamond(ctx, col, row) {
    const t = this.gridToScreen(col, row);
    const r = this.gridToScreen(col + 1, row);
    const b = this.gridToScreen(col + 1, row + 1);
    const l = this.gridToScreen(col, row + 1);
    ctx.beginPath();
    ctx.moveTo(t.x, t.y);
    ctx.lineTo(r.x, r.y);
    ctx.lineTo(b.x, b.y);
    ctx.lineTo(l.x, l.y);
    ctx.closePath();
  },

  _drawBlock(ctx, col, row, h, topFill, rightFill, leftFill) {
    const t = this.gridToScreen(col, row);
    const r = this.gridToScreen(col + 1, row);
    const b = this.gridToScreen(col + 1, row + 1);
    const l = this.gridToScreen(col, row + 1);

    // Right side
    ctx.beginPath();
    ctx.moveTo(r.x, r.y - h); ctx.lineTo(b.x, b.y - h);
    ctx.lineTo(b.x, b.y); ctx.lineTo(r.x, r.y);
    ctx.closePath();
    ctx.fillStyle = rightFill; ctx.fill();

    // Left side
    ctx.beginPath();
    ctx.moveTo(l.x, l.y - h); ctx.lineTo(b.x, b.y - h);
    ctx.lineTo(b.x, b.y); ctx.lineTo(l.x, l.y);
    ctx.closePath();
    ctx.fillStyle = leftFill; ctx.fill();

    // Top face
    ctx.beginPath();
    ctx.moveTo(t.x, t.y - h); ctx.lineTo(r.x, r.y - h);
    ctx.lineTo(b.x, b.y - h); ctx.lineTo(l.x, l.y - h);
    ctx.closePath();
    ctx.fillStyle = topFill; ctx.fill();
  },

  // ── Seeded RNG ───────────────────────────────────────────

  _seed: 42,
  seedRng(s) { this._seed = s; },
  rng() {
    this._seed = (this._seed * 16807) % 2147483647;
    return (this._seed - 1) / 2147483646;
  },

  // ── Map cache ────────────────────────────────────────────

  buildMapCache() {
    const map = Game.Map.current;
    if (!map) return;
    const off = document.createElement('canvas');
    off.width = this.canvas.width;
    off.height = this.canvas.height;
    const c = off.getContext('2d');

    // Clear
    c.clearRect(0, 0, off.width, off.height);

    // Draw tiles back-to-front
    this.seedRng(42);
    for (let row = 0; row < map.grid.length; row++) {
      for (let col = 0; col < map.grid[row].length; col++) {
        const tile = map.grid[row][col];
        this._drawCachedTile(c, col, row, tile, map);
      }
    }

    // Decorations on blocked tiles
    this.seedRng(99);
    for (let row = 0; row < map.grid.length; row++) {
      for (let col = 0; col < map.grid[row].length; col++) {
        if (map.grid[row][col] !== Game.Config.TILE.BLOCKED) continue;
        const r = this.rng();
        const center = this.gridToScreen(col + 0.5, row + 0.5);
        if (r < 0.30) {
          this._drawIsoTree(c, center.x, center.y);
        } else if (r < 0.42) {
          this._drawIsoRock(c, center.x, center.y);
        }
      }
    }

    this.mapCache = off;
  },

  _drawCachedTile(c, col, row, tile, map) {
    const T = Game.Config.TILE;
    const center = this.gridToScreen(col + 0.5, row + 0.5);

    switch (tile) {
      case T.PATH:
      case T.ENTRY:
      case T.EXIT:
        this._drawPathDiamond(c, col, row, tile);
        break;
      case T.BUILDABLE:
        this._drawGrassDiamond(c, col, row, true);
        this._drawBuildableMarkers(c, col, row);
        break;
      default: // BLOCKED
        this._drawGrassDiamond(c, col, row, false);
        break;
    }
  },

  _drawGrassDiamond(c, col, row, buildable) {
    const hue = buildable ? 118 : 125;
    const sat = buildable ? 52 : 42;
    const lit = buildable ? 30 : 25;
    const hv = (this.rng() - 0.5) * 12;
    const lv = (this.rng() - 0.5) * 6;

    this._tileDiamond(c, col, row);
    c.fillStyle = `hsl(${hue + hv}, ${sat}%, ${lit + lv}%)`;
    c.fill();
    // Subtle edge
    c.strokeStyle = `hsla(${hue}, ${sat}%, ${lit - 8}%, 0.3)`;
    c.lineWidth = 0.5;
    c.stroke();

    // Grass texture detail
    const center = this.gridToScreen(col + 0.5, row + 0.5);
    const hw = this.isoTileW * 0.3;
    const hh = this.isoTileH * 0.3;
    const n = 2 + Math.floor(this.rng() * 3);
    for (let i = 0; i < n; i++) {
      const ox = (this.rng() - 0.5) * hw * 2;
      const oy = (this.rng() - 0.5) * hh * 2;
      c.strokeStyle = `hsla(${110 + this.rng() * 20}, 45%, ${22 + this.rng() * 14}%, 0.5)`;
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(center.x + ox, center.y + oy);
      c.lineTo(center.x + ox + (this.rng() - 0.5) * 3, center.y + oy - 3 - this.rng() * 3);
      c.stroke();
    }
  },

  _drawPathDiamond(c, col, row, tile) {
    const T = Game.Config.TILE;

    // Slight block elevation for path
    this._drawBlock(c, col, row, 3, '#7A5B3A', '#6B4C2E', '#5D4025');

    // Pebble texture on top face
    const center = this.gridToScreen(col + 0.5, row + 0.5);
    const n = 2 + Math.floor(this.rng() * 3);
    for (let i = 0; i < n; i++) {
      const ox = (this.rng() - 0.5) * this.isoTileW * 0.35;
      const oy = (this.rng() - 0.5) * this.isoTileH * 0.35;
      c.fillStyle = `rgba(${90 + this.rng() * 40}, ${75 + this.rng() * 30}, ${50 + this.rng() * 20}, 0.3)`;
      c.beginPath();
      c.ellipse(center.x + ox, center.y - 3 + oy, 1.5 + this.rng(), 1, 0, 0, Math.PI * 2);
      c.fill();
    }

    // Entry/exit markers
    if (tile === T.ENTRY) {
      this._tileDiamond(c, col, row);
      c.fillStyle = 'rgba(255,60,60,0.2)';
      c.fill();
      // Arrow
      c.fillStyle = 'rgba(255,80,80,0.5)';
      c.beginPath();
      const cx = center.x, cy = center.y - 3;
      c.moveTo(cx + 8, cy); c.lineTo(cx - 4, cy - 5); c.lineTo(cx - 4, cy + 5);
      c.closePath();
      c.fill();
    } else if (tile === T.EXIT) {
      this._tileDiamond(c, col, row);
      c.fillStyle = 'rgba(60,60,255,0.2)';
      c.fill();
      // Target
      c.strokeStyle = 'rgba(100,100,255,0.5)';
      c.lineWidth = 1.5;
      c.beginPath();
      c.arc(center.x, center.y - 3, 6, 0, Math.PI * 2);
      c.stroke();
      c.beginPath();
      c.arc(center.x, center.y - 3, 2.5, 0, Math.PI * 2);
      c.stroke();
    }
  },

  _drawBuildableMarkers(c, col, row) {
    const t = this.gridToScreen(col, row);
    const r = this.gridToScreen(col + 1, row);
    const b = this.gridToScreen(col + 1, row + 1);
    const l = this.gridToScreen(col, row + 1);
    const m = 0.12; // fraction of edge to mark

    c.strokeStyle = 'rgba(255,255,255,0.12)';
    c.lineWidth = 1;

    // Small marks at each corner of diamond
    const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    const corners = [
      [lerp(t, l, m), t, lerp(t, r, m)],
      [lerp(r, t, m), r, lerp(r, b, m)],
      [lerp(b, r, m), b, lerp(b, l, m)],
      [lerp(l, b, m), l, lerp(l, t, m)],
    ];
    for (const [a, mid, b2] of corners) {
      c.beginPath();
      c.moveTo(a.x, a.y); c.lineTo(mid.x, mid.y); c.lineTo(b2.x, b2.y);
      c.stroke();
    }
  },

  // ── Iso decoration sprites (drawn inline) ────────────────

  _drawIsoTree(c, sx, sy) {
    // Shadow on ground
    c.fillStyle = 'rgba(0,0,0,0.15)';
    c.beginPath();
    c.ellipse(sx + 1, sy + 3, 11, 4, 0, 0, Math.PI * 2);
    c.fill();

    // Trunk
    c.fillStyle = '#5D4037';
    c.fillRect(sx - 2, sy - 18, 4, 20);
    c.fillStyle = '#4E342E';
    c.fillRect(sx - 2, sy - 18, 2, 20);

    // Foliage (2 layers)
    const greens = ['#2E7D32', '#388E3C', '#43A047'];
    const v = Math.floor(this.rng() * greens.length);
    for (let i = 1; i >= 0; i--) {
      const ly = sy - 20 - i * 8;
      const r = 13 - i * 3;
      const g = c.createRadialGradient(sx - 2, ly - 2, 0, sx, ly, r);
      g.addColorStop(0, greens[(v + i) % greens.length]);
      g.addColorStop(0.7, greens[(v + i + 1) % greens.length]);
      g.addColorStop(1, '#1B5E20');
      c.fillStyle = g;
      c.beginPath();
      c.arc(sx + (this.rng() - 0.5) * 3, ly, r, 0, Math.PI * 2);
      c.fill();
    }
  },

  _drawIsoRock(c, sx, sy) {
    c.fillStyle = 'rgba(0,0,0,0.12)';
    c.beginPath();
    c.ellipse(sx + 1, sy + 2, 8, 3, 0, 0, Math.PI * 2);
    c.fill();

    const g = c.createLinearGradient(sx - 7, sy - 6, sx + 7, sy + 2);
    g.addColorStop(0, '#9E9E9E');
    g.addColorStop(0.5, '#757575');
    g.addColorStop(1, '#555555');
    c.fillStyle = g;
    c.beginPath();
    c.ellipse(sx, sy - 3, 8, 5, 0, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = '#444';
    c.lineWidth = 0.5;
    c.stroke();

    // Highlight
    c.fillStyle = 'rgba(255,255,255,0.15)';
    c.beginPath();
    c.ellipse(sx - 3, sy - 5, 3, 2, -0.3, 0, Math.PI * 2);
    c.fill();
  },

  // ── Main draw ────────────────────────────────────────────

  draw(state, dt) {
    const ctx = this.ctx;
    this.time += dt;

    ctx.save();
    if (this.screenShake > 0) {
      this.screenShake -= dt;
      ctx.translate(
        (Math.random() - 0.5) * this.shakeIntensity * 2,
        (Math.random() - 0.5) * this.shakeIntensity * 2
      );
    }

    // Background
    ctx.fillStyle = '#1a2a10';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Map (cached)
    if (!this.mapCache || this.lastMapRef !== Game.Map.current) {
      this.buildMapCache();
      this.lastMapRef = Game.Map.current;
    }
    ctx.drawImage(this.mapCache, 0, 0);

    // Dynamic overlays
    this._drawOverlays(ctx, state);

    // Placement preview
    if (state.placingTower) this._drawPlacementPreview(ctx, state);
    if (state.selectedTower) {
      const sp = this.worldToScreen(state.selectedTower.x, state.selectedTower.y);
      this._drawRangeEllipse(ctx, sp.x, sp.y - 6, state.selectedTower.range, 'rgba(255,255,255,0.08)', 'rgba(255,255,255,0.2)');
    }

    // Collect & depth-sort drawable entities
    const drawables = [];

    for (const t of state.towers) {
      drawables.push({ type: 'tower', entity: t, depth: t.x + t.y });
    }
    for (const e of state.enemies) {
      if (!e.dead && !e.escaped && !e.flying) {
        drawables.push({ type: 'enemy', entity: e, depth: e.x + e.y });
      }
    }

    drawables.sort((a, b) => a.depth - b.depth);

    for (const d of drawables) {
      if (d.type === 'tower') this._drawTowerIso(ctx, d.entity);
      else this._drawEnemyIso(ctx, d.entity, false);
    }

    // Flying enemies (always on top)
    for (const e of state.enemies) {
      if (!e.dead && !e.escaped && e.flying) {
        this._drawEnemyIso(ctx, e, true);
      }
    }

    // Projectiles
    for (const p of state.projectiles) {
      if (!p.dead) this._drawProjectileIso(ctx, p);
    }

    // Particles
    Game.Particles.draw(ctx);

    ctx.restore();
  },

  // ── Dynamic overlays ────────────────────────────────────

  _drawOverlays(ctx, state) {
    const map = Game.Map.current;
    if (!map) return;

    // Hover highlight on buildable
    const grid = Game.Input.getGridPos();
    if (grid.col >= 0 && grid.col < Game.Config.GRID_COLS &&
        grid.row >= 0 && grid.row < Game.Config.GRID_ROWS &&
        Game.Map.isBuildable(grid.col, grid.row)) {
      this._tileDiamond(ctx, grid.col, grid.row);
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Entry/exit pulse
    const pulse = 0.06 + Math.sin(this.time * 2.5) * 0.04;
    for (let row = 0; row < map.grid.length; row++) {
      for (let col = 0; col < map.grid[row].length; col++) {
        const t = map.grid[row][col];
        if (t === Game.Config.TILE.ENTRY) {
          this._tileDiamond(ctx, col, row);
          ctx.fillStyle = `rgba(255,80,80,${pulse})`;
          ctx.fill();
        } else if (t === Game.Config.TILE.EXIT) {
          this._tileDiamond(ctx, col, row);
          ctx.fillStyle = `rgba(80,80,255,${pulse})`;
          ctx.fill();
        }
      }
    }
  },

  // ── Placement preview ───────────────────────────────────

  _drawPlacementPreview(ctx, state) {
    const grid = Game.Input.getGridPos();
    const col = grid.col, row = grid.row;
    const def = Game.Config.TOWERS[state.placingTower];
    const ok = Game.Map.canPlace(col, row, state.towers);

    this._tileDiamond(ctx, col, row);
    ctx.fillStyle = ok ? 'rgba(0,255,0,0.2)' : 'rgba(255,0,0,0.2)';
    ctx.fill();
    ctx.strokeStyle = ok ? 'rgba(0,255,0,0.5)' : 'rgba(255,0,0,0.5)';
    ctx.lineWidth = 2;
    ctx.stroke();

    const center = this.gridToScreen(col + 0.5, row + 0.5);
    const fillCol = ok ? 'rgba(255,255,255,0.08)' : 'rgba(255,0,0,0.08)';
    const strokeCol = ok ? 'rgba(255,255,255,0.2)' : 'rgba(255,0,0,0.2)';
    this._drawRangeEllipse(ctx, center.x, center.y - 6, def.range, fillCol, strokeCol);

    ctx.globalAlpha = 0.45;
    this._drawTowerBody(ctx, center.x, center.y - 6, state.placingTower, def, 0, 1);
    ctx.globalAlpha = 1;
  },

  // ── Range ellipse (iso-projected circle) ────────────────

  _drawRangeEllipse(ctx, sx, sy, range, fill, stroke) {
    const ts = Game.Config.TILE_SIZE;
    const rx = range * Math.SQRT2 * this.isoTileW / (2 * ts);
    const ry = range * Math.SQRT2 * this.isoTileH / (2 * ts);
    ctx.beginPath();
    ctx.ellipse(sx, sy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
  },

  // ── Tower drawing (iso) ─────────────────────────────────

  _drawTowerIso(ctx, tower) {
    const sp = this.worldToScreen(tower.x, tower.y);
    const tx = sp.x;
    const ty = sp.y - 6; // slight elevation
    const def = Game.Config.TOWERS[tower.type];

    // Platform block
    this._drawBlock(ctx, tower.col, tower.row, 6,
      'rgba(80,80,80,0.5)', 'rgba(50,50,50,0.5)', 'rgba(35,35,35,0.5)');

    // Tower body
    this._drawTowerBody(ctx, tx, ty, tower.type, def, tower.facing, tower.level);

    // Level stars
    if (tower.level > 1) {
      ctx.save();
      ctx.shadowColor = '#FFD700';
      ctx.shadowBlur = 4;
      ctx.fillStyle = '#FFD700';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('\u2605'.repeat(tower.level - 1), tx, ty - 18);
      ctx.restore();
    }

    // Flame cone
    if (tower.special === 'cone' && tower.target) {
      ctx.save();
      ctx.translate(tx, ty);
      ctx.rotate(tower.facing);
      const fg = ctx.createRadialGradient(0, 0, 0, 0, 0, tower.range * 0.5);
      fg.addColorStop(0, 'rgba(255,120,0,0.2)');
      fg.addColorStop(0.5, 'rgba(255,60,0,0.1)');
      fg.addColorStop(1, 'rgba(255,30,0,0)');
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, tower.range * 0.5, -tower.coneAngle / 2, tower.coneAngle / 2);
      ctx.closePath();
      ctx.fillStyle = fg;
      ctx.fill();
      ctx.restore();
    }
  },

  _drawTowerBody(ctx, x, y, type, def, facing, level) {
    const size = 14;

    switch (type) {
      case 'arrow': this._tArrow(ctx, x, y, size, facing); break;
      case 'cannon': this._tCannon(ctx, x, y, size, facing); break;
      case 'frost': this._tFrost(ctx, x, y, size, facing); break;
      case 'lightning': this._tLightning(ctx, x, y, size, facing); break;
      case 'sniper': this._tSniper(ctx, x, y, size, facing); break;
      case 'flame': this._tFlame(ctx, x, y, size, facing); break;
      default: this._tGeneric(ctx, x, y, size, def.color, facing); break;
    }
  },

  _tArrow(ctx, x, y, s, f) {
    const bg = ctx.createRadialGradient(x - 2, y - 2, 0, x, y, s);
    bg.addColorStop(0, '#A0855A'); bg.addColorStop(0.6, '#8B6914'); bg.addColorStop(1, '#5D4310');
    this._octagon(ctx, x, y, s, bg, '#3E2E0A');
    ctx.save(); ctx.translate(x, y); ctx.rotate(f);
    ctx.fillStyle = '#6D4C10';
    ctx.fillRect(s * 0.3, -2, s * 0.9, 4);
    ctx.strokeStyle = '#5D4310'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(s * 0.5, -s * 0.35);
    ctx.quadraticCurveTo(s * 0.65, 0, s * 0.5, s * 0.35);
    ctx.stroke();
    ctx.restore();
  },

  _tCannon(ctx, x, y, s, f) {
    const bg = ctx.createRadialGradient(x - 2, y - 2, 0, x, y, s);
    bg.addColorStop(0, '#888'); bg.addColorStop(0.5, '#555'); bg.addColorStop(1, '#333');
    this._octagon(ctx, x, y, s, bg, '#222');
    ctx.save(); ctx.translate(x, y); ctx.rotate(f);
    ctx.fillStyle = '#444';
    ctx.beginPath();
    ctx.moveTo(s * 0.3, -3.5); ctx.lineTo(s * 1.1, -2.5);
    ctx.lineTo(s * 1.1, 2.5); ctx.lineTo(s * 0.3, 3.5);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#222'; ctx.lineWidth = 0.5; ctx.stroke();
    ctx.fillStyle = '#555'; ctx.fillRect(s * 1.0, -4, 3, 8);
    ctx.restore();
  },

  _tFrost(ctx, x, y, s, f) {
    ctx.save();
    ctx.shadowColor = '#88DDFF'; ctx.shadowBlur = 10;
    const bg = ctx.createRadialGradient(x - 2, y - 2, 0, x, y, s);
    bg.addColorStop(0, '#BBDDFF'); bg.addColorStop(0.4, '#88CCEE'); bg.addColorStop(1, '#4488AA');
    this._octagon(ctx, x, y, s, bg, '#336688');
    ctx.restore();
    ctx.save(); ctx.translate(x, y); ctx.rotate(f);
    ctx.fillStyle = '#AADDFF';
    ctx.beginPath();
    ctx.moveTo(s * 0.4, 0); ctx.lineTo(s, -3); ctx.lineTo(s * 1.15, 0); ctx.lineTo(s, 3);
    ctx.closePath(); ctx.fill();
    ctx.restore();
    // Orbiting ice
    for (let i = 0; i < 3; i++) {
      const a = this.time * 1.5 + i * Math.PI * 2 / 3;
      ctx.fillStyle = 'rgba(180,220,255,0.5)';
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * s * 0.85, y + Math.sin(a) * s * 0.85, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  _tLightning(ctx, x, y, s, f) {
    ctx.save();
    ctx.shadowColor = '#FFD700'; ctx.shadowBlur = 8 + Math.sin(this.time * 8) * 3;
    const bg = ctx.createRadialGradient(x - 2, y - 2, 0, x, y, s);
    bg.addColorStop(0, '#FFE066'); bg.addColorStop(0.5, '#FFD700'); bg.addColorStop(1, '#B8860B');
    this._octagon(ctx, x, y, s, bg, '#8B6508');
    ctx.restore();
    // Bolt symbol
    ctx.fillStyle = '#FFFF88';
    ctx.beginPath();
    ctx.moveTo(x + 1, y - s * 0.4); ctx.lineTo(x - 2, y + 1);
    ctx.lineTo(x + 1, y + 1); ctx.lineTo(x - 1, y + s * 0.4);
    ctx.lineTo(x + 3, y - 1); ctx.lineTo(x, y - 1);
    ctx.closePath(); ctx.fill();
    ctx.save(); ctx.translate(x, y); ctx.rotate(f);
    ctx.fillStyle = '#DAA520'; ctx.fillRect(s * 0.4, -1.5, s * 0.6, 3);
    ctx.fillStyle = '#FFFF44';
    ctx.beginPath(); ctx.arc(s * 1.05, 0, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  },

  _tSniper(ctx, x, y, s, f) {
    const bg = ctx.createRadialGradient(x - 2, y - 2, 0, x, y, s);
    bg.addColorStop(0, '#CC3333'); bg.addColorStop(0.5, '#8B0000'); bg.addColorStop(1, '#550000');
    this._octagon(ctx, x, y, s, bg, '#330000');
    ctx.save(); ctx.translate(x, y); ctx.rotate(f);
    ctx.fillStyle = '#333'; ctx.fillRect(s * 0.3, -1.5, s * 1.3, 3);
    ctx.fillStyle = '#444'; ctx.fillRect(s * 0.7, -5, 5, 3.5);
    ctx.fillStyle = '#FF4444';
    ctx.globalAlpha = 0.6 + Math.sin(this.time * 3) * 0.2;
    ctx.beginPath(); ctx.arc(s * 0.72 + 2.5, -5, 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#333'; ctx.fillRect(s * 1.5, -2.5, 3, 5);
    ctx.restore();
  },

  _tFlame(ctx, x, y, s, f) {
    ctx.save();
    ctx.shadowColor = '#FF4400'; ctx.shadowBlur = 7 + Math.sin(this.time * 6) * 2;
    const bg = ctx.createRadialGradient(x - 2, y - 2, 0, x, y, s);
    bg.addColorStop(0, '#FF8833'); bg.addColorStop(0.5, '#FF6600'); bg.addColorStop(1, '#993300');
    this._octagon(ctx, x, y, s, bg, '#662200');
    ctx.restore();
    ctx.save(); ctx.translate(x, y); ctx.rotate(f);
    ctx.fillStyle = '#555';
    ctx.beginPath();
    ctx.moveTo(s * 0.3, -3); ctx.lineTo(s * 0.75, -5);
    ctx.lineTo(s * 0.85, -2); ctx.lineTo(s * 0.85, 2);
    ctx.lineTo(s * 0.75, 5); ctx.lineTo(s * 0.3, 3);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  },

  _tGeneric(ctx, x, y, s, color, f) {
    this._octagon(ctx, x, y, s, color, '#000');
    ctx.save(); ctx.translate(x, y); ctx.rotate(f);
    ctx.fillStyle = '#333'; ctx.fillRect(s * 0.5, -2, s * 0.6, 4);
    ctx.restore();
  },

  _octagon(ctx, x, y, s, fill, stroke) {
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 - Math.PI / 8;
      const px = x + Math.cos(a) * s, py = y + Math.sin(a) * s;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = fill; ctx.fill();
    ctx.strokeStyle = stroke; ctx.lineWidth = 1.5; ctx.stroke();
  },

  // Public helper for UI tower icons (non-iso, screen space)
  drawTowerShape(ctx, x, y, color, ts, facing) {
    const types = Game.Config.TOWER_ORDER;
    for (const t of types) {
      if (Game.Config.TOWERS[t].color === color) {
        this._drawTowerBody(ctx, x, y, t, Game.Config.TOWERS[t], facing, 1);
        return;
      }
    }
    this._tGeneric(ctx, x, y, ts * 0.3, color, facing);
  },

  // ── Enemy drawing (iso) ─────────────────────────────────

  _drawEnemyIso(ctx, enemy, isFlying) {
    const sp = this.worldToScreen(enemy.x, enemy.y);
    const sx = sp.x;
    const baseSy = sp.y;
    const drawY = isFlying ? baseSy - 18 : baseSy;
    const r = enemy.radius;

    // Flying shadow
    if (isFlying) {
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.beginPath();
      ctx.ellipse(sx + 2, baseSy + 3, r * 0.6, r * 0.25, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    const flashColor = enemy.hitFlash > 0 ? '#FFFFFF' : null;
    const baseColor = flashColor || enemy.color;

    // Shield
    if (enemy.shieldHp > 0) {
      const sa = 0.3 + 0.4 * (enemy.shieldHp / enemy.maxShieldHp);
      ctx.save();
      ctx.shadowColor = '#4488FF'; ctx.shadowBlur = 5;
      ctx.beginPath();
      ctx.arc(sx, drawY, r + 4, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(68,136,255,${sa})`; ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = `rgba(68,136,255,${sa * 0.12})`; ctx.fill();
      ctx.restore();
    }

    // Body
    ctx.save();
    if (enemy.shape === 'diamond') {
      ctx.translate(sx, drawY);
      ctx.rotate(Math.PI / 4);
      const d = r * 0.7;
      const dg = ctx.createRadialGradient(-1, -1, 0, 0, 0, d * 1.5);
      dg.addColorStop(0, this._lighten(baseColor, 30));
      dg.addColorStop(0.7, baseColor);
      dg.addColorStop(1, this._darken(baseColor, 30));
      ctx.fillStyle = dg;
      ctx.fillRect(-d, -d, d * 2, d * 2);
      ctx.strokeStyle = this._darken(baseColor, 50);
      ctx.lineWidth = 1; ctx.strokeRect(-d, -d, d * 2, d * 2);
      ctx.restore();
    } else {
      const eg = ctx.createRadialGradient(sx - r * 0.25, drawY - r * 0.25, 0, sx, drawY, r);
      eg.addColorStop(0, this._lighten(baseColor, 40));
      eg.addColorStop(0.6, baseColor);
      eg.addColorStop(1, this._darken(baseColor, 40));
      ctx.beginPath();
      ctx.arc(sx, drawY, r, 0, Math.PI * 2);
      ctx.fillStyle = eg; ctx.fill();
      ctx.strokeStyle = this._darken(baseColor, 60);
      ctx.lineWidth = 1.5; ctx.stroke();
      ctx.restore();
    }

    // Wings
    if (isFlying) {
      const wf = Math.sin(this.time * 12) * 0.3;
      ctx.save(); ctx.translate(sx, drawY);
      ctx.strokeStyle = enemy.color; ctx.lineWidth = 2;
      ctx.fillStyle = `rgba(${this._hexToRgb(enemy.color)},0.3)`;
      ctx.beginPath(); ctx.moveTo(-r * 0.4, 0);
      ctx.quadraticCurveTo(-r * 1.5, -r * (1.2 + wf), -r * 0.2, -r * 0.2);
      ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(r * 0.4, 0);
      ctx.quadraticCurveTo(r * 1.5, -r * (1.2 + wf), r * 0.2, -r * 0.2);
      ctx.fill(); ctx.stroke();
      ctx.restore();
    }

    // Healer cross
    if (enemy.special === 'heal') {
      ctx.save(); ctx.shadowColor = '#44FF44'; ctx.shadowBlur = 5;
      ctx.fillStyle = '#FFF';
      ctx.fillRect(sx - 1.5, drawY - r * 0.4, 3, r * 0.8);
      ctx.fillRect(sx - r * 0.4, drawY - 1.5, r * 0.8, 3);
      ctx.restore();
    }

    // Boss crown
    if (enemy.type === 'boss') {
      ctx.save(); ctx.shadowColor = '#FFD700'; ctx.shadowBlur = 5;
      ctx.fillStyle = '#FFD700'; ctx.font = 'bold 12px monospace'; ctx.textAlign = 'center';
      ctx.fillText('\u265B', sx, drawY - r - 4);
      ctx.restore();
    }

    // Health bar
    if (enemy.hp < enemy.maxHp) {
      const bw = r * 2.2, bh = 3;
      const bx = sx - bw / 2, by = drawY - r - 8;
      const ratio = enemy.hp / enemy.maxHp;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(bx - 1, by - 1, bw + 2, bh + 2);
      let bc = ratio > 0.6 ? '#44cc44' : (ratio > 0.3 ? '#cccc44' : '#cc4444');
      ctx.fillStyle = bc;
      ctx.fillRect(bx, by, bw * ratio, bh);
    }

    // Stun
    if (enemy.stunned) {
      ctx.fillStyle = '#FFFF00'; ctx.font = '10px monospace'; ctx.textAlign = 'center';
      ctx.fillText('\u2726', sx, drawY - r - 12);
    }

    // Slow ring
    if (enemy.statusEffects.some(e => e.type === 'slow')) {
      ctx.strokeStyle = 'rgba(136,204,238,0.5)'; ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.arc(sx, drawY, r + 3, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
    }

    // DoT fire
    if (enemy.statusEffects.some(e => e.type === 'dot')) {
      for (let i = 0; i < 2; i++) {
        ctx.fillStyle = `rgba(255,${100 + Math.floor(Math.random() * 100)},0,0.6)`;
        ctx.beginPath();
        ctx.arc(sx + (Math.random() - 0.5) * r * 1.4, drawY + (Math.random() - 0.5) * r * 1.4,
          1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  },

  // ── Projectile drawing (iso) ────────────────────────────

  _drawProjectileIso(ctx, proj) {
    if (proj.type === 'lightning') {
      this._drawLightningIso(ctx, proj);
      return;
    }

    const sp = this.worldToScreen(proj.x, proj.y);
    const sx = sp.x, sy = sp.y;

    // Trail
    if (proj.trail && proj.trail.length > 1) {
      for (let i = 1; i < proj.trail.length; i++) {
        const tp = this.worldToScreen(proj.trail[i].x, proj.trail[i].y);
        ctx.globalAlpha = (i / proj.trail.length) * 0.35;
        ctx.fillStyle = proj.color;
        ctx.beginPath();
        ctx.arc(tp.x, tp.y, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    ctx.save();
    ctx.shadowColor = proj.color;
    ctx.shadowBlur = 5;

    if (proj.towerType === 'cannon') {
      const cg = ctx.createRadialGradient(sx - 1, sy - 1, 0, sx, sy, 4);
      cg.addColorStop(0, '#666'); cg.addColorStop(0.7, '#333'); cg.addColorStop(1, '#111');
      ctx.fillStyle = cg;
      ctx.beginPath(); ctx.arc(sx, sy, 4, 0, Math.PI * 2); ctx.fill();
    } else if (proj.towerType === 'frost') {
      ctx.shadowColor = '#88DDFF'; ctx.shadowBlur = 7;
      ctx.fillStyle = '#AADDFF';
      ctx.translate(sx, sy);
      ctx.rotate(this.time * 4);
      ctx.beginPath();
      ctx.moveTo(0, -3); ctx.lineTo(2.5, 0); ctx.lineTo(0, 3); ctx.lineTo(-2.5, 0);
      ctx.closePath(); ctx.fill();
    } else if (proj.towerType === 'sniper') {
      ctx.shadowColor = '#FF4444'; ctx.shadowBlur = 8;
      const tsp = this.worldToScreen(proj.tx, proj.ty);
      const angle = Math.atan2(tsp.y - sy, tsp.x - sx);
      ctx.translate(sx, sy); ctx.rotate(angle);
      ctx.fillStyle = '#FF4444'; ctx.fillRect(-6, -1, 12, 2);
      ctx.fillStyle = '#FFAAAA'; ctx.fillRect(-4, -0.5, 8, 1);
    } else {
      // Arrow
      const tsp = this.worldToScreen(proj.tx, proj.ty);
      const angle = Math.atan2(tsp.y - sy, tsp.x - sx);
      ctx.translate(sx, sy); ctx.rotate(angle);
      ctx.fillStyle = '#8B6914'; ctx.fillRect(-5, -0.5, 8, 1);
      ctx.fillStyle = proj.color;
      ctx.beginPath();
      ctx.moveTo(5, 0); ctx.lineTo(1, -2.5); ctx.lineTo(2, 0); ctx.lineTo(1, 2.5);
      ctx.closePath(); ctx.fill();
    }

    ctx.restore();
  },

  _drawLightningIso(ctx, proj) {
    ctx.save();
    ctx.globalAlpha = proj.life / proj.maxLife;
    ctx.shadowColor = proj.color;
    ctx.shadowBlur = 12;

    const srcSp = this.worldToScreen(proj.sourceX, proj.sourceY);
    const targetSps = proj.targets.map(t => this.worldToScreen(t.x, t.y));

    // Glow layer
    ctx.strokeStyle = 'rgba(255,255,100,0.3)'; ctx.lineWidth = 5;
    let lx = srcSp.x, ly = srcSp.y;
    for (const t of targetSps) {
      this._drawJagged(ctx, lx, ly, t.x, t.y);
      lx = t.x; ly = t.y;
    }

    // Main
    ctx.strokeStyle = proj.color; ctx.lineWidth = 2;
    lx = srcSp.x; ly = srcSp.y;
    for (const t of targetSps) {
      this._drawJagged(ctx, lx, ly, t.x, t.y);
      lx = t.x; ly = t.y;
    }

    // Core
    ctx.strokeStyle = '#FFF'; ctx.lineWidth = 1;
    lx = srcSp.x; ly = srcSp.y;
    for (const t of targetSps) {
      this._drawJagged(ctx, lx, ly, t.x, t.y);
      lx = t.x; ly = t.y;
    }

    // Impact dots
    for (const t of targetSps) {
      ctx.fillStyle = '#FFF';
      ctx.beginPath(); ctx.arc(t.x, t.y, 3, 0, Math.PI * 2); ctx.fill();
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
      const j = (Math.random() - 0.5) * 12;
      ctx.lineTo(x1 + dx * t + px * j, y1 + dy * t + py * j);
    }
    ctx.lineTo(x2, y2);
    ctx.stroke();
  },

  // ── Color utilities ─────────────────────────────────────

  _lighten(hex, amt) {
    const c = this._parseHex(hex);
    return `rgb(${Math.min(255, c[0] + amt)},${Math.min(255, c[1] + amt)},${Math.min(255, c[2] + amt)})`;
  },
  _darken(hex, amt) {
    const c = this._parseHex(hex);
    return `rgb(${Math.max(0, c[0] - amt)},${Math.max(0, c[1] - amt)},${Math.max(0, c[2] - amt)})`;
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
    const c = this._parseHex(hex);
    return `${c[0]},${c[1]},${c[2]}`;
  },
};
