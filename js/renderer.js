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
  // World-space origin (top corner of tile 0,0) - fixed, not affected by camera
  isoWorldOriginX: 0,
  isoWorldOriginY: 0,

  // Camera (scroll offset in screen pixels)
  camX: 0,
  camY: 0,

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
    // World origin: the top corner of tile (0,0) in world iso space (before camera)
    this.isoWorldOriginX = Game.Config.GRID_ROWS * this.isoTileW / 2 + 12;
    this.isoWorldOriginY = 40;
    this.camX = 0;
    this.camY = 0;
  },

  shake(intensity, duration) {
    this.shakeIntensity = intensity;
    this.screenShake = duration;
  },

  // Center camera on a world position
  centerOnWorld(wx, wy) {
    const sp = this._worldToIso(wx, wy);
    this.camX = sp.x - this.canvas.width / 2;
    this.camY = sp.y - this.canvas.height / 2;
  },

  // Center camera on a grid cell
  centerOnGrid(col, row) {
    const sp = this._gridToIso(col + 0.5, row + 0.5);
    this.camX = sp.x - this.canvas.width / 2;
    this.camY = sp.y - this.canvas.height / 2;
  },

  // ── Isometric projection ─────────────────────────────────

  // Grid/world to absolute iso coords (before camera)
  _gridToIso(col, row) {
    return {
      x: this.isoWorldOriginX + (col - row) * this.isoTileW / 2,
      y: this.isoWorldOriginY + (col + row) * this.isoTileH / 2,
    };
  },

  _worldToIso(wx, wy) {
    const ts = Game.Config.TILE_SIZE;
    return this._gridToIso(wx / ts, wy / ts);
  },

  // Grid/world to screen coords (with camera offset)
  gridToScreen(col, row) {
    const iso = this._gridToIso(col, row);
    return { x: iso.x - this.camX, y: iso.y - this.camY };
  },

  worldToScreen(wx, wy) {
    const ts = Game.Config.TILE_SIZE;
    return this.gridToScreen(wx / ts, wy / ts);
  },

  // Screen to grid (accounts for camera)
  screenToGrid(sx, sy) {
    const hw = this.isoTileW / 2;
    const hh = this.isoTileH / 2;
    // Convert screen to absolute iso by adding camera offset
    const absX = sx + this.camX;
    const absY = sy + this.camY;
    const dx = absX - this.isoWorldOriginX;
    const dy = absY - this.isoWorldOriginY;
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

  // ── Map rendering (viewport-culled, no full cache) ──────

  // Pre-compute decoration map (which blocked tiles get trees/rocks)
  _decoMap: null,
  _decoMapRef: null,

  _ensureDecoMap() {
    const map = Game.Map.current;
    if (!map || this._decoMapRef === map) return;
    this._decoMapRef = map;
    this._decoMap = [];
    this.seedRng(99);
    for (let row = 0; row < map.grid.length; row++) {
      this._decoMap[row] = [];
      for (let col = 0; col < map.grid[row].length; col++) {
        if (map.grid[row][col] !== Game.Config.TILE.BLOCKED) {
          this._decoMap[row][col] = 0;
          this.rng(); // consume RNG to keep determinism
          continue;
        }
        const r = this.rng();
        if (r < 0.30) this._decoMap[row][col] = 1; // tree
        else if (r < 0.42) this._decoMap[row][col] = 2; // rock
        else this._decoMap[row][col] = 0;
      }
    }
  },

  // Get visible tile range for current camera
  _getVisibleRange() {
    const map = Game.Map.current;
    if (!map) return null;
    const cols = map.grid[0].length;
    const rows = map.grid.length;
    // Sample corners of viewport to find tile range
    const margin = 3; // extra tiles for safety
    const corners = [
      this.screenToGrid(0, 0),
      this.screenToGrid(this.canvas.width, 0),
      this.screenToGrid(0, this.canvas.height),
      this.screenToGrid(this.canvas.width, this.canvas.height),
    ];
    let minCol = Infinity, maxCol = -Infinity;
    let minRow = Infinity, maxRow = -Infinity;
    for (const c of corners) {
      minCol = Math.min(minCol, c.col);
      maxCol = Math.max(maxCol, c.col);
      minRow = Math.min(minRow, c.row);
      maxRow = Math.max(maxRow, c.row);
    }
    return {
      c0: Math.max(0, minCol - margin),
      c1: Math.min(cols - 1, maxCol + margin),
      r0: Math.max(0, minRow - margin),
      r1: Math.min(rows - 1, maxRow + margin),
    };
  },

  _drawVisibleMap(ctx) {
    const map = Game.Map.current;
    if (!map) return;
    this._ensureDecoMap();
    const range = this._getVisibleRange();
    if (!range) return;

    // Draw tiles (back-to-front within visible range)
    for (let row = range.r0; row <= range.r1; row++) {
      for (let col = range.c0; col <= range.c1; col++) {
        // Use deterministic seed per tile for grass variation
        this.seedRng(row * 1000 + col + 42);
        const tile = map.grid[row][col];
        this._drawCachedTile(ctx, col, row, tile, map);
      }
    }

    // Decorations (second pass for draw order)
    for (let row = range.r0; row <= range.r1; row++) {
      for (let col = range.c0; col <= range.c1; col++) {
        const deco = this._decoMap[row] && this._decoMap[row][col];
        if (!deco) continue;
        const center = this.gridToScreen(col + 0.5, row + 0.5);
        this.seedRng(row * 1000 + col + 200); // deterministic per tile
        if (deco === 1) this._drawIsoTree(ctx, center.x, center.y);
        else if (deco === 2) this._drawIsoRock(ctx, center.x, center.y);
      }
    }
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

    // Draw visible map tiles
    this._drawVisibleMap(ctx);

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

    // Entry/exit pulse (only visible tiles)
    const pulse = 0.06 + Math.sin(this.time * 2.5) * 0.04;
    const range = this._getVisibleRange();
    if (range) {
      for (let row = range.r0; row <= range.r1; row++) {
        for (let col = range.c0; col <= range.c1; col++) {
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
    const ty = sp.y - 6;
    const def = Game.Config.TOWERS[tower.type];

    // Stone foundation block
    this._drawBlock(ctx, tower.col, tower.row, 6, '#707060', '#555548', '#45453A');

    // Tower body
    this._drawTowerBody(ctx, tx, ty, tower.type, def, tower.facing, tower.level);

    // Level stars (above the tower)
    if (tower.level > 1) {
      ctx.save();
      ctx.shadowColor = '#FFD700'; ctx.shadowBlur = 4;
      ctx.fillStyle = '#FFD700'; ctx.font = 'bold 10px monospace'; ctx.textAlign = 'center';
      const heights = { arrow: 44, cannon: 34, frost: 48, lightning: 42, sniper: 50, flame: 36 };
      ctx.fillText('\u2605'.repeat(tower.level - 1), tx, ty - (heights[tower.type] || 30));
      ctx.restore();
    }

    // Flame cone
    if (tower.special === 'cone' && tower.target) {
      ctx.save(); ctx.translate(tx, ty); ctx.rotate(tower.facing);
      const fg = ctx.createRadialGradient(0, 0, 0, 0, 0, tower.range * 0.5);
      fg.addColorStop(0, 'rgba(255,120,0,0.2)');
      fg.addColorStop(0.5, 'rgba(255,60,0,0.1)');
      fg.addColorStop(1, 'rgba(255,30,0,0)');
      ctx.beginPath(); ctx.moveTo(0, 0);
      ctx.arc(0, 0, tower.range * 0.5, -tower.coneAngle / 2, tower.coneAngle / 2);
      ctx.closePath(); ctx.fillStyle = fg; ctx.fill();
      ctx.restore();
    }
  },

  _drawTowerBody(ctx, x, y, type, def, facing, level) {
    switch (type) {
      case 'arrow': this._tArrow(ctx, x, y, facing); break;
      case 'cannon': this._tCannon(ctx, x, y, facing); break;
      case 'frost': this._tFrost(ctx, x, y, facing); break;
      case 'lightning': this._tLightning(ctx, x, y, facing); break;
      case 'sniper': this._tSniper(ctx, x, y, facing); break;
      case 'flame': this._tFlame(ctx, x, y, facing); break;
      default: this._tArrow(ctx, x, y, facing); break;
    }
  },

  // Arrow Tower: wooden watchtower with peaked roof and archer
  _tArrow(ctx, x, y, f) {
    // Wooden posts
    ctx.fillStyle = '#5D3A0A';
    ctx.fillRect(x - 8, y - 30, 3, 30);
    ctx.fillRect(x + 5, y - 30, 3, 30);
    // Cross braces
    ctx.fillStyle = '#6D4C10';
    ctx.fillRect(x - 8, y - 15, 16, 2);
    ctx.fillRect(x - 8, y - 8, 16, 2);
    // Platform
    ctx.fillStyle = '#8B6914';
    ctx.fillRect(x - 11, y - 32, 22, 3);
    // Railing posts
    ctx.fillStyle = '#5D3A0A';
    ctx.fillRect(x - 10, y - 38, 2, 6);
    ctx.fillRect(x + 8, y - 38, 2, 6);
    ctx.fillRect(x - 1, y - 38, 2, 6);
    // Railing bar
    ctx.fillStyle = '#6D4C10';
    ctx.fillRect(x - 10, y - 38, 20, 2);
    // Peaked roof
    ctx.fillStyle = '#654321';
    ctx.beginPath();
    ctx.moveTo(x, y - 48); ctx.lineTo(x - 13, y - 36); ctx.lineTo(x + 13, y - 36);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#4A3018'; ctx.lineWidth = 1; ctx.stroke();
    // Roof shingles
    ctx.strokeStyle = '#553315'; ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(x - 10, y - 40); ctx.lineTo(x + 10, y - 40); ctx.stroke();
    // Archer figure
    ctx.fillStyle = '#D4A574'; // skin head
    ctx.beginPath(); ctx.arc(x, y - 42, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2E5A1B'; // green tunic body
    ctx.fillRect(x - 2, y - 39, 4, 5);
    // Bow
    ctx.strokeStyle = '#8B6914'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x + 5, y - 38, 5, -Math.PI * 0.6, Math.PI * 0.6);
    ctx.stroke();
    // Bowstring
    ctx.strokeStyle = '#AAA'; ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(x + 2, y - 42); ctx.lineTo(x + 2, y - 34); ctx.stroke();
  },

  // Cannon Tower: stone keep with battlements and ballista
  _tCannon(ctx, x, y, f) {
    // Stone wall - front face
    const wg = ctx.createLinearGradient(x - 10, y, x + 10, y);
    wg.addColorStop(0, '#777'); wg.addColorStop(0.5, '#888'); wg.addColorStop(1, '#666');
    ctx.fillStyle = wg;
    ctx.fillRect(x - 10, y - 26, 20, 26);
    // Side face (darker)
    ctx.fillStyle = '#555';
    ctx.beginPath();
    ctx.moveTo(x + 10, y - 26); ctx.lineTo(x + 15, y - 29);
    ctx.lineTo(x + 15, y - 3); ctx.lineTo(x + 10, y);
    ctx.closePath(); ctx.fill();
    // Stone block lines
    ctx.strokeStyle = '#5A5A5A'; ctx.lineWidth = 0.5;
    for (let i = 1; i < 5; i++) {
      const ly = y - i * 5;
      ctx.beginPath(); ctx.moveTo(x - 10, ly); ctx.lineTo(x + 10, ly); ctx.stroke();
    }
    // Crenellations (battlements)
    ctx.fillStyle = '#777';
    for (let i = 0; i < 4; i++) {
      const cx = x - 9 + i * 6;
      ctx.fillRect(cx, y - 32, 4, 6);
    }
    // Arrow slit
    ctx.fillStyle = '#222';
    ctx.fillRect(x - 1, y - 18, 2, 6);
    // Ballista on top
    ctx.fillStyle = '#5D3A0A';
    ctx.fillRect(x - 6, y - 30, 12, 3); // base
    ctx.save(); ctx.translate(x, y - 31); ctx.rotate(f);
    // Ballista arms
    ctx.fillStyle = '#4A3018';
    ctx.fillRect(-1.5, -1, 16, 2);
    ctx.fillRect(10, -4, 2, 6);
    ctx.restore();
  },

  // Frost Tower: crystalline ice spire with magical runes
  _tFrost(ctx, x, y, f) {
    ctx.save();
    ctx.shadowColor = '#88DDFF'; ctx.shadowBlur = 12;
    // Base cylinder
    ctx.fillStyle = '#5588AA';
    ctx.fillRect(x - 8, y - 16, 16, 16);
    ctx.fillStyle = '#447799';
    ctx.beginPath();
    ctx.moveTo(x + 8, y - 16); ctx.lineTo(x + 12, y - 18);
    ctx.lineTo(x + 12, y - 2); ctx.lineTo(x + 8, y);
    ctx.closePath(); ctx.fill();
    // Ice crystal spire
    const sg = ctx.createLinearGradient(x, y - 46, x, y - 16);
    sg.addColorStop(0, '#CCEEFF'); sg.addColorStop(0.5, '#88CCEE'); sg.addColorStop(1, '#5599BB');
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.moveTo(x, y - 46); ctx.lineTo(x - 7, y - 16); ctx.lineTo(x + 7, y - 16);
    ctx.closePath(); ctx.fill();
    // Crystal facet line
    ctx.strokeStyle = 'rgba(200,240,255,0.4)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, y - 46); ctx.lineTo(x + 2, y - 16); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, y - 46); ctx.lineTo(x - 3, y - 16); ctx.stroke();
    ctx.restore();
    // Rune on base
    ctx.strokeStyle = 'rgba(150,220,255,0.6)'; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - 3, y - 12); ctx.lineTo(x, y - 6); ctx.lineTo(x + 3, y - 12);
    ctx.stroke();
    // Orbiting ice particles
    for (let i = 0; i < 4; i++) {
      const a = this.time * 1.8 + i * Math.PI / 2;
      const r = 14;
      ctx.fillStyle = 'rgba(180,230,255,0.6)';
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * r, y - 30 + Math.sin(a) * r * 0.4, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  // Lightning Tower: elegant mage tower with glowing orb
  _tLightning(ctx, x, y, f) {
    // Stone base
    const bg = ctx.createLinearGradient(x - 7, y - 20, x + 7, y);
    bg.addColorStop(0, '#998866'); bg.addColorStop(0.5, '#887858'); bg.addColorStop(1, '#776848');
    ctx.fillStyle = bg;
    ctx.fillRect(x - 7, y - 20, 14, 20);
    ctx.fillStyle = '#776848';
    ctx.beginPath();
    ctx.moveTo(x + 7, y - 20); ctx.lineTo(x + 11, y - 22);
    ctx.lineTo(x + 11, y - 2); ctx.lineTo(x + 7, y);
    ctx.closePath(); ctx.fill();
    // Upper tower (narrower)
    ctx.fillStyle = '#998868';
    ctx.fillRect(x - 5, y - 32, 10, 12);
    // Conical roof
    ctx.fillStyle = '#4444AA';
    ctx.beginPath();
    ctx.moveTo(x, y - 42); ctx.lineTo(x - 7, y - 32); ctx.lineTo(x + 7, y - 32);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#333399'; ctx.lineWidth = 0.5; ctx.stroke();
    // Glowing orb on top
    ctx.save();
    ctx.shadowColor = '#FFD700'; ctx.shadowBlur = 10 + Math.sin(this.time * 5) * 4;
    ctx.fillStyle = '#FFE844';
    ctx.beginPath(); ctx.arc(x, y - 42, 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#FFFFAA';
    ctx.beginPath(); ctx.arc(x - 1, y - 43, 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    // Window glow
    ctx.fillStyle = '#FFD700';
    ctx.globalAlpha = 0.5 + Math.sin(this.time * 3) * 0.2;
    ctx.fillRect(x - 2, y - 28, 4, 5);
    ctx.globalAlpha = 1;
    // Magical arcs
    if (Math.random() < 0.25) {
      ctx.strokeStyle = 'rgba(255,255,100,0.5)'; ctx.lineWidth = 1;
      const a = Math.random() * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * 4, y - 42 + Math.sin(a) * 4);
      ctx.lineTo(x + Math.cos(a) * 12, y - 42 + Math.sin(a) * 8);
      ctx.stroke();
    }
  },

  // Sniper Tower: tall dark stone keep with arrow slits and red pennant
  _tSniper(ctx, x, y, f) {
    // Tall stone body
    const wg = ctx.createLinearGradient(x - 6, y, x + 6, y);
    wg.addColorStop(0, '#554444'); wg.addColorStop(0.5, '#665555'); wg.addColorStop(1, '#4A3A3A');
    ctx.fillStyle = wg;
    ctx.fillRect(x - 6, y - 40, 12, 40);
    // Side face
    ctx.fillStyle = '#3A2E2E';
    ctx.beginPath();
    ctx.moveTo(x + 6, y - 40); ctx.lineTo(x + 10, y - 42);
    ctx.lineTo(x + 10, y - 2); ctx.lineTo(x + 6, y);
    ctx.closePath(); ctx.fill();
    // Stone lines
    ctx.strokeStyle = '#3A2E2E'; ctx.lineWidth = 0.5;
    for (let i = 1; i < 8; i++) {
      const ly = y - i * 5;
      ctx.beginPath(); ctx.moveTo(x - 6, ly); ctx.lineTo(x + 6, ly); ctx.stroke();
    }
    // Battlements
    ctx.fillStyle = '#554444';
    ctx.fillRect(x - 7, y - 44, 4, 4);
    ctx.fillRect(x + 3, y - 44, 4, 4);
    // Arrow slits
    ctx.fillStyle = '#111';
    ctx.fillRect(x - 1, y - 16, 2, 5);
    ctx.fillRect(x - 1, y - 30, 2, 5);
    // Crossbow at top
    ctx.save(); ctx.translate(x, y - 42); ctx.rotate(f);
    ctx.fillStyle = '#333'; ctx.fillRect(0, -1, 10, 2);
    ctx.fillRect(6, -4, 1.5, 8);
    ctx.restore();
    // Red pennant/flag
    ctx.fillStyle = '#CC2222';
    ctx.beginPath();
    ctx.moveTo(x + 3, y - 48); ctx.lineTo(x + 12, y - 44);
    ctx.lineTo(x + 3, y - 40); ctx.closePath(); ctx.fill();
    // Flag pole
    ctx.fillStyle = '#444'; ctx.fillRect(x + 2, y - 50, 2, 12);
    // Scope lens glow
    ctx.save();
    ctx.shadowColor = '#FF4444'; ctx.shadowBlur = 4;
    ctx.fillStyle = '#FF4444';
    ctx.globalAlpha = 0.5 + Math.sin(this.time * 2) * 0.3;
    ctx.beginPath(); ctx.arc(x + 10, y - 42, 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();
  },

  // Flame Tower: dark stone forge with fire brazier on top
  _tFlame(ctx, x, y, f) {
    // Dark stone walls
    ctx.fillStyle = '#444';
    ctx.fillRect(x - 9, y - 22, 18, 22);
    ctx.fillStyle = '#333';
    ctx.beginPath();
    ctx.moveTo(x + 9, y - 22); ctx.lineTo(x + 13, y - 24);
    ctx.lineTo(x + 13, y - 2); ctx.lineTo(x + 9, y);
    ctx.closePath(); ctx.fill();
    // Stone lines
    ctx.strokeStyle = '#333'; ctx.lineWidth = 0.5;
    for (let i = 1; i < 4; i++) {
      ctx.beginPath(); ctx.moveTo(x - 9, y - i * 6); ctx.lineTo(x + 9, y - i * 6); ctx.stroke();
    }
    // Iron rim at top
    ctx.fillStyle = '#555';
    ctx.fillRect(x - 10, y - 24, 20, 3);
    // Brazier bowl
    ctx.fillStyle = '#3A3A3A';
    ctx.beginPath();
    ctx.moveTo(x - 7, y - 26); ctx.quadraticCurveTo(x - 8, y - 22, x - 5, y - 22);
    ctx.lineTo(x + 5, y - 22);
    ctx.quadraticCurveTo(x + 8, y - 22, x + 7, y - 26);
    ctx.closePath(); ctx.fill();
    // Hot coals glow
    ctx.fillStyle = '#FF4400';
    ctx.globalAlpha = 0.6;
    ctx.fillRect(x - 5, y - 25, 10, 3);
    ctx.globalAlpha = 1;
    // Animated fire
    ctx.save();
    ctx.shadowColor = '#FF6600'; ctx.shadowBlur = 10 + Math.sin(this.time * 6) * 4;
    for (let i = 0; i < 3; i++) {
      const fx = x - 3 + i * 3 + Math.sin(this.time * 8 + i * 2) * 1.5;
      const fh = 8 + Math.sin(this.time * 10 + i * 3) * 3;
      const fy = y - 26;
      const fg = ctx.createLinearGradient(fx, fy, fx, fy - fh);
      fg.addColorStop(0, '#FF4400');
      fg.addColorStop(0.4, '#FF8800');
      fg.addColorStop(0.7, '#FFCC00');
      fg.addColorStop(1, 'rgba(255,200,0,0)');
      ctx.fillStyle = fg;
      ctx.beginPath();
      ctx.moveTo(fx - 2, fy);
      ctx.quadraticCurveTo(fx - 1.5, fy - fh * 0.6, fx + Math.sin(this.time * 12 + i) * 2, fy - fh);
      ctx.quadraticCurveTo(fx + 1.5, fy - fh * 0.6, fx + 2, fy);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    // Mouth/opening
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.arc(x, y - 8, 3, 0, Math.PI); ctx.fill();
    ctx.fillStyle = '#FF4400';
    ctx.globalAlpha = 0.4 + Math.sin(this.time * 4) * 0.2;
    ctx.beginPath(); ctx.arc(x, y - 8, 2, 0, Math.PI); ctx.fill();
    ctx.globalAlpha = 1;
  },

  // Public helper for UI tower icons (non-iso, screen space)
  drawTowerShape(ctx, x, y, color, ts, facing) {
    const types = Game.Config.TOWER_ORDER;
    for (const t of types) {
      if (Game.Config.TOWERS[t].color === color) {
        ctx.save();
        const s = ts / 48; // scale relative to game size
        ctx.translate(x, y);
        ctx.scale(s, s);
        ctx.translate(-x, -y);
        this._drawTowerBody(ctx, x, y + 6, t, Game.Config.TOWERS[t], facing, 1);
        ctx.restore();
        return;
      }
    }
  },

  // ── Enemy drawing (iso) ─────────────────────────────────

  _drawEnemyIso(ctx, enemy, isFlying) {
    const sp = this.worldToScreen(enemy.x, enemy.y);
    const sx = sp.x;
    const baseSy = sp.y;
    const drawY = isFlying ? baseSy - 18 : baseSy;
    const r = enemy.radius;
    const walk = Math.sin(this.time * 8 + enemy.x * 0.1);

    // Ground shadow
    ctx.fillStyle = isFlying ? 'rgba(0,0,0,0.15)' : 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(sx, baseSy + 2, r * 0.7, r * 0.25, 0, 0, Math.PI * 2);
    ctx.fill();

    // Shield bubble
    if (enemy.shieldHp > 0) {
      const sa = 0.25 + 0.35 * (enemy.shieldHp / enemy.maxShieldHp);
      ctx.save(); ctx.shadowColor = '#4488FF'; ctx.shadowBlur = 5;
      ctx.beginPath(); ctx.arc(sx, drawY - r * 0.3, r + 4, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(68,136,255,${sa})`; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = `rgba(68,136,255,${sa * 0.1})`; ctx.fill();
      ctx.restore();
    }

    // Draw humanoid sprite based on type
    const flash = enemy.hitFlash > 0;
    switch (enemy.type) {
      case 'goblin': this._sprGoblin(ctx, sx, drawY, r, walk, flash); break;
      case 'soldier': this._sprSoldier(ctx, sx, drawY, r, walk, flash); break;
      case 'wolf_rider': this._sprWolfRider(ctx, sx, drawY, r, walk, flash); break;
      case 'knight': this._sprKnight(ctx, sx, drawY, r, walk, flash); break;
      case 'healer': this._sprHealer(ctx, sx, drawY, r, walk, flash); break;
      case 'flyer': this._sprFlyer(ctx, sx, drawY, r, walk, flash); break;
      case 'shielded': this._sprShielded(ctx, sx, drawY, r, walk, flash); break;
      case 'boss': this._sprBoss(ctx, sx, drawY, r, walk, flash); break;
      default: this._sprSoldier(ctx, sx, drawY, r, walk, flash); break;
    }

    // Hit flash overlay
    if (flash) {
      ctx.globalAlpha = enemy.hitFlash * 0.4;
      ctx.fillStyle = '#FFF';
      ctx.beginPath(); ctx.arc(sx, drawY - r * 0.4, r, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }

    // Health bar
    if (enemy.hp < enemy.maxHp) {
      const bw = r * 2.2, bh = 3;
      const bx = sx - bw / 2, by = drawY - r * 1.8 - 6;
      const ratio = enemy.hp / enemy.maxHp;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(bx - 1, by - 1, bw + 2, bh + 2);
      ctx.fillStyle = ratio > 0.6 ? '#44cc44' : (ratio > 0.3 ? '#cccc44' : '#cc4444');
      ctx.fillRect(bx, by, bw * ratio, bh);
    }

    // Status effects
    if (enemy.stunned) {
      ctx.fillStyle = '#FFFF00'; ctx.font = '10px monospace'; ctx.textAlign = 'center';
      ctx.fillText('\u2726', sx, drawY - r * 1.8 - 10);
    }
    if (enemy.statusEffects.some(e => e.type === 'slow')) {
      ctx.strokeStyle = 'rgba(136,204,238,0.5)'; ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.arc(sx, drawY - r * 0.3, r + 2, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
    }
    if (enemy.statusEffects.some(e => e.type === 'dot')) {
      for (let i = 0; i < 2; i++) {
        ctx.fillStyle = `rgba(255,${100 + Math.floor(Math.random() * 100)},0,0.6)`;
        ctx.beginPath();
        ctx.arc(sx + (Math.random() - 0.5) * r, drawY - r * 0.3 + (Math.random() - 0.5) * r,
          1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  },

  // ── Humanoid sprite helpers ────────────────────────────

  // Goblin: small green-skinned raider with dagger
  _sprGoblin(ctx, x, y, r, walk, flash) {
    const s = r / 8; // scale factor (base radius 8)
    // Legs
    ctx.fillStyle = '#336622';
    ctx.fillRect(x - 3 * s, y - 2 * s + walk * 1.5, 2 * s, 5 * s);
    ctx.fillRect(x + 1 * s, y - 2 * s - walk * 1.5, 2 * s, 5 * s);
    // Feet
    ctx.fillStyle = '#554422';
    ctx.fillRect(x - 4 * s, y + 2.5 * s + walk * 1.5, 3 * s, 2 * s);
    ctx.fillRect(x + 0.5 * s, y + 2.5 * s - walk * 1.5, 3 * s, 2 * s);
    // Body (ragged brown tunic)
    ctx.fillStyle = '#7A6030';
    ctx.fillRect(x - 4 * s, y - 7 * s, 8 * s, 6 * s);
    // Arms
    ctx.fillStyle = '#44AA44'; // green skin
    ctx.fillRect(x - 6 * s, y - 6 * s + walk, 2.5 * s, 5 * s);
    ctx.fillRect(x + 3.5 * s, y - 6 * s - walk, 2.5 * s, 5 * s);
    // Head (green)
    ctx.fillStyle = '#44AA44';
    ctx.beginPath(); ctx.arc(x, y - 9 * s, 3.5 * s, 0, Math.PI * 2); ctx.fill();
    // Eyes
    ctx.fillStyle = '#FF0';
    ctx.fillRect(x - 2 * s, y - 10 * s, 1.5 * s, 1.5 * s);
    ctx.fillRect(x + 0.5 * s, y - 10 * s, 1.5 * s, 1.5 * s);
    // Pointed ears
    ctx.fillStyle = '#44AA44';
    ctx.beginPath();
    ctx.moveTo(x - 3.5 * s, y - 10 * s); ctx.lineTo(x - 6 * s, y - 12 * s);
    ctx.lineTo(x - 3 * s, y - 8.5 * s); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + 3.5 * s, y - 10 * s); ctx.lineTo(x + 6 * s, y - 12 * s);
    ctx.lineTo(x + 3 * s, y - 8.5 * s); ctx.fill();
    // Dagger in right hand
    ctx.fillStyle = '#AAA';
    ctx.fillRect(x + 4 * s, y - 8 * s, 1.5 * s, 5 * s);
  },

  // Soldier: viking warrior with helmet, shield, and axe
  _sprSoldier(ctx, x, y, r, walk, flash) {
    const s = r / 10;
    // Legs (gray pants)
    ctx.fillStyle = '#666';
    ctx.fillRect(x - 3 * s, y - 2 * s + walk * 1.5, 2.5 * s, 6 * s);
    ctx.fillRect(x + 0.5 * s, y - 2 * s - walk * 1.5, 2.5 * s, 6 * s);
    // Boots
    ctx.fillStyle = '#4A3A2A';
    ctx.fillRect(x - 4 * s, y + 3 * s + walk * 1.5, 3.5 * s, 2 * s);
    ctx.fillRect(x + 0 * s, y + 3 * s - walk * 1.5, 3.5 * s, 2 * s);
    // Body (chain mail)
    ctx.fillStyle = '#888';
    ctx.fillRect(x - 5 * s, y - 9 * s, 10 * s, 8 * s);
    // Chain mail texture
    ctx.strokeStyle = '#777'; ctx.lineWidth = 0.5;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath(); ctx.moveTo(x - 4 * s, y - (3 + i * 2) * s);
      ctx.lineTo(x + 4 * s, y - (3 + i * 2) * s); ctx.stroke();
    }
    // Shield (left arm) - round wooden shield
    ctx.fillStyle = '#8B5A2B';
    ctx.beginPath(); ctx.arc(x - 6 * s, y - 5 * s, 5 * s, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#666'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(x - 6 * s, y - 5 * s, 5 * s, 0, Math.PI * 2); ctx.stroke();
    // Shield boss (metal center)
    ctx.fillStyle = '#AAA';
    ctx.beginPath(); ctx.arc(x - 6 * s, y - 5 * s, 1.5 * s, 0, Math.PI * 2); ctx.fill();
    // Axe (right arm)
    ctx.fillStyle = '#5A3A1A';
    ctx.fillRect(x + 5 * s, y - 10 * s, 1.5 * s, 9 * s); // handle
    ctx.fillStyle = '#888';
    ctx.beginPath(); // axe head
    ctx.moveTo(x + 5 * s, y - 10 * s); ctx.lineTo(x + 9 * s, y - 12 * s);
    ctx.lineTo(x + 9 * s, y - 8 * s); ctx.lineTo(x + 5 * s, y - 9 * s);
    ctx.closePath(); ctx.fill();
    // Head
    ctx.fillStyle = '#D4A574';
    ctx.beginPath(); ctx.arc(x, y - 12 * s, 3.5 * s, 0, Math.PI * 2); ctx.fill();
    // Viking helmet
    ctx.fillStyle = '#777';
    ctx.beginPath();
    ctx.arc(x, y - 13 * s, 4 * s, Math.PI, 0); ctx.fill();
    // Helmet nasal guard
    ctx.fillStyle = '#666';
    ctx.fillRect(x - 0.8 * s, y - 13 * s, 1.6 * s, 3 * s);
    // Eyes
    ctx.fillStyle = '#222';
    ctx.fillRect(x - 2.5 * s, y - 12 * s, 1.5 * s, 1 * s);
    ctx.fillRect(x + 1 * s, y - 12 * s, 1.5 * s, 1 * s);
    // Beard
    ctx.fillStyle = '#8B6914';
    ctx.fillRect(x - 2 * s, y - 10 * s, 4 * s, 2 * s);
  },

  // Wolf Rider: mounted figure on wolf
  _sprWolfRider(ctx, x, y, r, walk, flash) {
    const s = r / 9;
    // Wolf body
    const wolfY = y + 1 * s;
    ctx.fillStyle = '#6B4A2A';
    ctx.beginPath();
    ctx.ellipse(x, wolfY - 2 * s, 8 * s, 4 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    // Wolf legs (animated)
    ctx.fillStyle = '#5A3A1A';
    const legOff = walk * 2;
    ctx.fillRect(x - 5 * s, wolfY + legOff, 2 * s, 4 * s);
    ctx.fillRect(x - 1 * s, wolfY - legOff, 2 * s, 4 * s);
    ctx.fillRect(x + 3 * s, wolfY + legOff * 0.8, 2 * s, 4 * s);
    ctx.fillRect(x + 6 * s, wolfY - legOff * 0.8, 2 * s, 3.5 * s);
    // Wolf head
    ctx.fillStyle = '#6B4A2A';
    ctx.beginPath();
    ctx.ellipse(x + 8 * s, wolfY - 4 * s, 3 * s, 2.5 * s, -0.3, 0, Math.PI * 2);
    ctx.fill();
    // Wolf ear
    ctx.beginPath();
    ctx.moveTo(x + 7 * s, wolfY - 6 * s); ctx.lineTo(x + 9 * s, wolfY - 8 * s);
    ctx.lineTo(x + 10 * s, wolfY - 5 * s); ctx.fill();
    // Wolf eye
    ctx.fillStyle = '#FF0'; ctx.beginPath();
    ctx.arc(x + 9 * s, wolfY - 4 * s, 0.8 * s, 0, Math.PI * 2); ctx.fill();
    // Wolf tail
    ctx.strokeStyle = '#5A3A1A'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - 7 * s, wolfY - 3 * s);
    ctx.quadraticCurveTo(x - 10 * s, wolfY - 6 * s, x - 9 * s, wolfY - 8 * s);
    ctx.stroke();
    // Rider body
    ctx.fillStyle = '#554433';
    ctx.fillRect(x - 2 * s, wolfY - 11 * s, 5 * s, 6 * s);
    // Rider head
    ctx.fillStyle = '#D4A574';
    ctx.beginPath(); ctx.arc(x + 0.5 * s, wolfY - 13 * s, 2.5 * s, 0, Math.PI * 2); ctx.fill();
    // Fur cap
    ctx.fillStyle = '#6B4A2A';
    ctx.beginPath(); ctx.arc(x + 0.5 * s, wolfY - 14 * s, 3 * s, Math.PI, 0); ctx.fill();
    // Spear
    ctx.fillStyle = '#5A4A2A';
    ctx.fillRect(x + 3 * s, wolfY - 18 * s, 1.5 * s, 14 * s);
    ctx.fillStyle = '#AAA';
    ctx.beginPath();
    ctx.moveTo(x + 3.75 * s, wolfY - 20 * s);
    ctx.lineTo(x + 2 * s, wolfY - 17 * s); ctx.lineTo(x + 5.5 * s, wolfY - 17 * s);
    ctx.closePath(); ctx.fill();
  },

  // Knight: full plate armor with great sword and cape
  _sprKnight(ctx, x, y, r, walk, flash) {
    const s = r / 13;
    // Cape (behind)
    ctx.fillStyle = '#8B0000';
    ctx.beginPath();
    ctx.moveTo(x - 3 * s, y - 12 * s); ctx.lineTo(x + 3 * s, y - 12 * s);
    ctx.lineTo(x + 5 * s, y + 2 * s + Math.sin(this.time * 3) * 2);
    ctx.lineTo(x - 5 * s, y + 2 * s - Math.sin(this.time * 3) * 2);
    ctx.closePath(); ctx.fill();
    // Legs (plate)
    ctx.fillStyle = '#AAAAAA';
    ctx.fillRect(x - 4 * s, y - 2 * s + walk * 2, 3 * s, 7 * s);
    ctx.fillRect(x + 1 * s, y - 2 * s - walk * 2, 3 * s, 7 * s);
    // Boots (metal)
    ctx.fillStyle = '#888';
    ctx.fillRect(x - 5 * s, y + 4 * s + walk * 2, 4 * s, 2.5 * s);
    ctx.fillRect(x + 0.5 * s, y + 4 * s - walk * 2, 4 * s, 2.5 * s);
    // Body (plate armor)
    const ag = ctx.createLinearGradient(x - 6 * s, y - 12 * s, x + 6 * s, y - 3 * s);
    ag.addColorStop(0, '#C0C0C0'); ag.addColorStop(0.5, '#E0E0E0'); ag.addColorStop(1, '#999');
    ctx.fillStyle = ag;
    ctx.fillRect(x - 6 * s, y - 12 * s, 12 * s, 10 * s);
    // Shoulder pauldrons
    ctx.fillStyle = '#B0B0B0';
    ctx.beginPath(); ctx.arc(x - 6 * s, y - 10 * s, 3 * s, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + 6 * s, y - 10 * s, 3 * s, 0, Math.PI * 2); ctx.fill();
    // Great sword
    ctx.fillStyle = '#888';
    ctx.fillRect(x + 7 * s, y - 18 * s, 2 * s, 16 * s);
    ctx.fillStyle = '#5A3A1A'; // crossguard
    ctx.fillRect(x + 5 * s, y - 6 * s, 6 * s, 2 * s);
    ctx.fillStyle = '#AAA'; // blade tip
    ctx.beginPath();
    ctx.moveTo(x + 8 * s, y - 20 * s);
    ctx.lineTo(x + 7 * s, y - 18 * s); ctx.lineTo(x + 9 * s, y - 18 * s);
    ctx.closePath(); ctx.fill();
    // Head (great helm)
    ctx.fillStyle = '#B0B0B0';
    ctx.fillRect(x - 4 * s, y - 18 * s, 8 * s, 7 * s);
    // Helm visor slit
    ctx.fillStyle = '#222';
    ctx.fillRect(x - 3 * s, y - 15 * s, 6 * s, 1.5 * s);
    // Helm plume
    ctx.fillStyle = '#CC2222';
    ctx.fillRect(x - 1 * s, y - 21 * s, 2 * s, 4 * s);
  },

  // Healer: green-robed druid with staff
  _sprHealer(ctx, x, y, r, walk, flash) {
    const s = r / 9;
    // Robe (long, covers legs)
    ctx.fillStyle = '#2E7D32';
    ctx.beginPath();
    ctx.moveTo(x - 5 * s, y - 8 * s); ctx.lineTo(x + 5 * s, y - 8 * s);
    ctx.lineTo(x + 6 * s, y + 4 * s); ctx.lineTo(x - 6 * s, y + 4 * s);
    ctx.closePath(); ctx.fill();
    // Robe trim
    ctx.strokeStyle = '#FFD700'; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - 6 * s, y + 4 * s); ctx.lineTo(x + 6 * s, y + 4 * s); ctx.stroke();
    // Sash
    ctx.fillStyle = '#FFD700';
    ctx.fillRect(x - 1 * s, y - 6 * s, 2 * s, 8 * s);
    // Arms / sleeves
    ctx.fillStyle = '#388E3C';
    ctx.fillRect(x - 7 * s, y - 7 * s + walk, 3 * s, 5 * s);
    ctx.fillRect(x + 4 * s, y - 7 * s - walk, 3 * s, 5 * s);
    // Staff (left hand)
    ctx.fillStyle = '#5A3A1A';
    ctx.fillRect(x - 8 * s, y - 16 * s, 2 * s, 18 * s);
    // Staff orb
    ctx.save();
    ctx.shadowColor = '#44FF44'; ctx.shadowBlur = 6 + Math.sin(this.time * 4) * 3;
    ctx.fillStyle = '#88FF88';
    ctx.beginPath(); ctx.arc(x - 7 * s, y - 17 * s, 2.5 * s, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#CCFFCC';
    ctx.beginPath(); ctx.arc(x - 8 * s, y - 18 * s, 1 * s, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    // Head
    ctx.fillStyle = '#D4A574';
    ctx.beginPath(); ctx.arc(x, y - 11 * s, 3 * s, 0, Math.PI * 2); ctx.fill();
    // Hood
    ctx.fillStyle = '#1B5E20';
    ctx.beginPath();
    ctx.moveTo(x - 4 * s, y - 10 * s);
    ctx.quadraticCurveTo(x, y - 17 * s, x + 4 * s, y - 10 * s);
    ctx.fill();
    // Eyes
    ctx.fillStyle = '#FFF';
    ctx.fillRect(x - 2 * s, y - 12 * s, 1.5 * s, 1 * s);
    ctx.fillRect(x + 0.5 * s, y - 12 * s, 1.5 * s, 1 * s);
    // Heal aura particles
    if (Math.random() < 0.5) {
      ctx.fillStyle = 'rgba(100,255,100,0.5)';
      ctx.beginPath();
      ctx.arc(x + (Math.random() - 0.5) * 12 * s, y - 5 * s + (Math.random() - 0.5) * 8 * s,
        1, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  // Flyer: winged dark figure (gargoyle/demon)
  _sprFlyer(ctx, x, y, r, walk, flash) {
    const s = r / 9;
    const wingFlap = Math.sin(this.time * 12) * 0.35;
    // Wings (behind body)
    ctx.fillStyle = 'rgba(100,60,140,0.5)';
    ctx.strokeStyle = '#6644AA'; ctx.lineWidth = 1.5;
    // Left wing
    ctx.beginPath(); ctx.moveTo(x - 2 * s, y - 5 * s);
    ctx.quadraticCurveTo(x - 14 * s, y - (12 + wingFlap * 8) * s, x - 3 * s, y - 2 * s);
    ctx.fill(); ctx.stroke();
    // Right wing
    ctx.beginPath(); ctx.moveTo(x + 2 * s, y - 5 * s);
    ctx.quadraticCurveTo(x + 14 * s, y - (12 + wingFlap * 8) * s, x + 3 * s, y - 2 * s);
    ctx.fill(); ctx.stroke();
    // Body (dark armor)
    ctx.fillStyle = '#444';
    ctx.fillRect(x - 3.5 * s, y - 8 * s, 7 * s, 8 * s);
    // Legs (dangling)
    ctx.fillStyle = '#333';
    ctx.fillRect(x - 2.5 * s, y - 1 * s, 2 * s, 4 * s);
    ctx.fillRect(x + 0.5 * s, y - 1 * s, 2 * s, 4 * s);
    // Head (dark)
    ctx.fillStyle = '#555';
    ctx.beginPath(); ctx.arc(x, y - 10 * s, 3 * s, 0, Math.PI * 2); ctx.fill();
    // Glowing eyes
    ctx.save(); ctx.shadowColor = '#FF0000'; ctx.shadowBlur = 4;
    ctx.fillStyle = '#FF4444';
    ctx.fillRect(x - 2 * s, y - 11 * s, 1.5 * s, 1 * s);
    ctx.fillRect(x + 0.5 * s, y - 11 * s, 1.5 * s, 1 * s);
    ctx.restore();
    // Horns
    ctx.fillStyle = '#333';
    ctx.beginPath();
    ctx.moveTo(x - 2 * s, y - 12 * s); ctx.lineTo(x - 4 * s, y - 16 * s);
    ctx.lineTo(x - 1 * s, y - 12 * s); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + 2 * s, y - 12 * s); ctx.lineTo(x + 4 * s, y - 16 * s);
    ctx.lineTo(x + 1 * s, y - 12 * s); ctx.fill();
  },

  // Shielded: warrior behind large tower shield
  _sprShielded(ctx, x, y, r, walk, flash) {
    const s = r / 11;
    // Legs
    ctx.fillStyle = '#555';
    ctx.fillRect(x - 3 * s, y - 1 * s + walk * 1.5, 2.5 * s, 6 * s);
    ctx.fillRect(x + 0.5 * s, y - 1 * s - walk * 1.5, 2.5 * s, 6 * s);
    // Boots
    ctx.fillStyle = '#444';
    ctx.fillRect(x - 4 * s, y + 4 * s + walk * 1.5, 3.5 * s, 2 * s);
    ctx.fillRect(x + 0 * s, y + 4 * s - walk * 1.5, 3.5 * s, 2 * s);
    // Body behind shield
    ctx.fillStyle = '#777';
    ctx.fillRect(x - 3 * s, y - 10 * s, 8 * s, 10 * s);
    // Large tower shield (covers most of front)
    const sg = ctx.createLinearGradient(x - 8 * s, y - 12 * s, x + 2 * s, y);
    sg.addColorStop(0, '#5588CC'); sg.addColorStop(0.5, '#4477BB'); sg.addColorStop(1, '#3366AA');
    ctx.fillStyle = sg;
    ctx.fillRect(x - 8 * s, y - 12 * s, 10 * s, 15 * s);
    // Shield border
    ctx.strokeStyle = '#889'; ctx.lineWidth = 1.5;
    ctx.strokeRect(x - 8 * s, y - 12 * s, 10 * s, 15 * s);
    // Shield emblem (cross)
    ctx.strokeStyle = '#AAC'; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - 3 * s, y - 10 * s); ctx.lineTo(x - 3 * s, y + 1 * s);
    ctx.moveTo(x - 7 * s, y - 5 * s); ctx.lineTo(x + 1 * s, y - 5 * s);
    ctx.stroke();
    // Spear (behind shield, poking up)
    ctx.fillStyle = '#5A3A1A';
    ctx.fillRect(x + 3 * s, y - 18 * s, 1.5 * s, 20 * s);
    ctx.fillStyle = '#AAA';
    ctx.beginPath();
    ctx.moveTo(x + 3.75 * s, y - 20 * s);
    ctx.lineTo(x + 2 * s, y - 17 * s); ctx.lineTo(x + 5.5 * s, y - 17 * s);
    ctx.closePath(); ctx.fill();
    // Helmet peek above shield
    ctx.fillStyle = '#888';
    ctx.beginPath(); ctx.arc(x - 2 * s, y - 14 * s, 3.5 * s, Math.PI, 0); ctx.fill();
    // Eyes through helm
    ctx.fillStyle = '#222';
    ctx.fillRect(x - 4 * s, y - 14 * s, 4 * s, 1.5 * s);
  },

  // Boss: massive armored warlord with horned helm and battle axe
  _sprBoss(ctx, x, y, r, walk, flash) {
    const s = r / 20;
    // Cape (behind, flowing)
    ctx.fillStyle = '#8B0000';
    ctx.beginPath();
    ctx.moveTo(x - 6 * s, y - 16 * s); ctx.lineTo(x + 6 * s, y - 16 * s);
    ctx.lineTo(x + 10 * s, y + 6 * s + Math.sin(this.time * 2.5) * 3);
    ctx.lineTo(x - 10 * s, y + 6 * s - Math.sin(this.time * 2.5) * 3);
    ctx.closePath(); ctx.fill();
    // Cape trim
    ctx.strokeStyle = '#FFD700'; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - 10 * s, y + 6 * s); ctx.lineTo(x + 10 * s, y + 6 * s); ctx.stroke();
    // Legs (massive armored)
    ctx.fillStyle = '#888';
    ctx.fillRect(x - 5 * s, y - 2 * s + walk * 2.5, 4 * s, 9 * s);
    ctx.fillRect(x + 1 * s, y - 2 * s - walk * 2.5, 4 * s, 9 * s);
    // Boots
    ctx.fillStyle = '#666';
    ctx.fillRect(x - 6 * s, y + 6 * s + walk * 2.5, 5 * s, 3 * s);
    ctx.fillRect(x + 0 * s, y + 6 * s - walk * 2.5, 5 * s, 3 * s);
    // Body (ornate dark plate)
    const bg = ctx.createLinearGradient(x - 8 * s, y, x + 8 * s, y);
    bg.addColorStop(0, '#555'); bg.addColorStop(0.3, '#777'); bg.addColorStop(0.7, '#777');
    bg.addColorStop(1, '#444');
    ctx.fillStyle = bg;
    ctx.fillRect(x - 8 * s, y - 16 * s, 16 * s, 15 * s);
    // Gold trim on armor
    ctx.strokeStyle = '#DAA520'; ctx.lineWidth = 1;
    ctx.strokeRect(x - 7 * s, y - 15 * s, 14 * s, 13 * s);
    ctx.beginPath(); ctx.moveTo(x, y - 15 * s); ctx.lineTo(x, y - 2 * s); ctx.stroke();
    // Massive shoulder pauldrons with spikes
    ctx.fillStyle = '#666';
    ctx.beginPath(); ctx.arc(x - 9 * s, y - 14 * s, 4 * s, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + 9 * s, y - 14 * s, 4 * s, 0, Math.PI * 2); ctx.fill();
    // Pauldron spikes
    ctx.fillStyle = '#888';
    ctx.beginPath();
    ctx.moveTo(x - 9 * s, y - 18 * s); ctx.lineTo(x - 11 * s, y - 22 * s);
    ctx.lineTo(x - 7 * s, y - 18 * s); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + 9 * s, y - 18 * s); ctx.lineTo(x + 11 * s, y - 22 * s);
    ctx.lineTo(x + 7 * s, y - 18 * s); ctx.fill();
    // Battle axe (massive, right hand)
    ctx.fillStyle = '#5A3A1A';
    ctx.fillRect(x + 10 * s, y - 24 * s, 2.5 * s, 22 * s);
    ctx.fillStyle = '#999';
    ctx.beginPath(); // double-sided axe head
    ctx.moveTo(x + 10 * s, y - 24 * s); ctx.lineTo(x + 18 * s, y - 28 * s);
    ctx.lineTo(x + 18 * s, y - 20 * s); ctx.lineTo(x + 10 * s, y - 22 * s);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + 13 * s, y - 24 * s); ctx.lineTo(x + 5 * s, y - 28 * s);
    ctx.lineTo(x + 5 * s, y - 20 * s); ctx.lineTo(x + 13 * s, y - 22 * s);
    ctx.closePath(); ctx.fill();
    // Head (horned helm)
    ctx.fillStyle = '#555';
    ctx.fillRect(x - 5 * s, y - 24 * s, 10 * s, 9 * s);
    // Visor slit
    ctx.fillStyle = '#CC2222';
    ctx.globalAlpha = 0.7 + Math.sin(this.time * 3) * 0.3;
    ctx.fillRect(x - 4 * s, y - 20 * s, 8 * s, 2 * s);
    ctx.globalAlpha = 1;
    // Horns (large)
    ctx.fillStyle = '#AA9966';
    ctx.beginPath();
    ctx.moveTo(x - 5 * s, y - 22 * s); ctx.quadraticCurveTo(x - 10 * s, y - 30 * s, x - 7 * s, y - 34 * s);
    ctx.lineTo(x - 3 * s, y - 22 * s); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + 5 * s, y - 22 * s); ctx.quadraticCurveTo(x + 10 * s, y - 30 * s, x + 7 * s, y - 34 * s);
    ctx.lineTo(x + 3 * s, y - 22 * s); ctx.fill();
    // Crown/circlet
    ctx.save();
    ctx.shadowColor = '#FFD700'; ctx.shadowBlur = 4;
    ctx.fillStyle = '#FFD700';
    ctx.fillRect(x - 5 * s, y - 24 * s, 10 * s, 2 * s);
    // Crown points
    ctx.beginPath();
    ctx.moveTo(x - 3 * s, y - 24 * s); ctx.lineTo(x - 2 * s, y - 27 * s);
    ctx.lineTo(x - 1 * s, y - 24 * s); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + 1 * s, y - 24 * s); ctx.lineTo(x + 2 * s, y - 27 * s);
    ctx.lineTo(x + 3 * s, y - 24 * s); ctx.fill();
    ctx.restore();
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
