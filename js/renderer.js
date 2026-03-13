window.Game = window.Game || {};

Game.Renderer = {
  canvas: null,
  ctx: null,
  screenShake: 0,
  shakeIntensity: 0,

  init(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
  },

  shake(intensity, duration) {
    this.shakeIntensity = intensity;
    this.screenShake = duration;
  },

  draw(state, dt) {
    const ctx = this.ctx;
    const C = Game.Config.COLORS;
    const ts = Game.Config.TILE_SIZE;

    // Screen shake
    ctx.save();
    if (this.screenShake > 0) {
      this.screenShake -= dt;
      const sx = (Math.random() - 0.5) * this.shakeIntensity * 2;
      const sy = (Math.random() - 0.5) * this.shakeIntensity * 2;
      ctx.translate(sx, sy);
    }

    // Clear
    ctx.fillStyle = C.background;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw map
    this.drawMap(ctx, ts, C);

    // Tower range preview
    if (state.placingTower) {
      this.drawPlacementPreview(ctx, state, ts, C);
    }
    if (state.selectedTower) {
      this.drawRangeCircle(ctx, state.selectedTower.x, state.selectedTower.y,
        state.selectedTower.range, C.rangeCircle);
    }

    // Towers
    for (const tower of state.towers) {
      this.drawTower(ctx, tower, ts);
    }

    // Ground enemies (behind flying)
    for (const e of state.enemies) {
      if (!e.dead && !e.escaped && !e.flying) {
        this.drawEnemy(ctx, e);
      }
    }

    // Flying enemies
    for (const e of state.enemies) {
      if (!e.dead && !e.escaped && e.flying) {
        this.drawEnemy(ctx, e, true);
      }
    }

    // Projectiles
    for (const p of state.projectiles) {
      if (!p.dead) this.drawProjectile(ctx, p);
    }

    // Particles
    Game.Particles.draw(ctx);

    ctx.restore();
  },

  drawMap(ctx, ts, C) {
    const map = Game.Map.current;
    if (!map) return;

    for (let row = 0; row < map.grid.length; row++) {
      for (let col = 0; col < map.grid[row].length; col++) {
        const tile = map.grid[row][col];
        const x = col * ts;
        const y = row * ts;

        switch (tile) {
          case Game.Config.TILE.PATH:
          case Game.Config.TILE.ENTRY:
          case Game.Config.TILE.EXIT:
            ctx.fillStyle = C.path;
            ctx.fillRect(x, y, ts, ts);
            // Path border
            ctx.strokeStyle = C.pathBorder;
            ctx.lineWidth = 1;
            ctx.strokeRect(x + 0.5, y + 0.5, ts - 1, ts - 1);
            // Entry/exit markers
            if (tile === Game.Config.TILE.ENTRY) {
              ctx.fillStyle = C.entry;
              ctx.globalAlpha = 0.3;
              ctx.fillRect(x, y, ts, ts);
              ctx.globalAlpha = 1;
            } else if (tile === Game.Config.TILE.EXIT) {
              ctx.fillStyle = C.exit;
              ctx.globalAlpha = 0.3;
              ctx.fillRect(x, y, ts, ts);
              ctx.globalAlpha = 1;
            }
            break;

          case Game.Config.TILE.BUILDABLE:
            ctx.fillStyle = C.buildable;
            ctx.fillRect(x, y, ts, ts);
            // Subtle grid lines
            ctx.strokeStyle = 'rgba(255,255,255,0.05)';
            ctx.lineWidth = 1;
            ctx.strokeRect(x + 0.5, y + 0.5, ts - 1, ts - 1);
            break;

          default:
            ctx.fillStyle = C.blocked;
            ctx.fillRect(x, y, ts, ts);
            break;
        }
      }
    }

    // Hover highlight on buildable tiles
    const grid = Game.Input.getGridPos();
    if (grid.col >= 0 && grid.col < Game.Config.GRID_COLS &&
        grid.row >= 0 && grid.row < Game.Config.GRID_ROWS) {
      if (Game.Map.isBuildable(grid.col, grid.row)) {
        ctx.fillStyle = C.buildableHover;
        ctx.fillRect(grid.col * ts, grid.row * ts, ts, ts);
      }
    }
  },

  drawPlacementPreview(ctx, state, ts, C) {
    const grid = Game.Input.getGridPos();
    const col = grid.col;
    const row = grid.row;
    const def = Game.Config.TOWERS[state.placingTower];
    const canPlace = Game.Map.canPlace(col, row, state.towers);

    // Highlight tile
    ctx.fillStyle = canPlace ? C.placementValid : C.placementInvalid;
    ctx.fillRect(col * ts, row * ts, ts, ts);

    // Range circle
    const cx = col * ts + ts / 2;
    const cy = row * ts + ts / 2;
    this.drawRangeCircle(ctx, cx, cy, def.range,
      canPlace ? C.rangeCircle : C.rangeCircleInvalid);

    // Ghost tower
    ctx.globalAlpha = 0.5;
    this.drawTowerShape(ctx, cx, cy, def.color, ts, 0);
    ctx.globalAlpha = 1;
  },

  drawRangeCircle(ctx, x, y, range, color) {
    ctx.beginPath();
    ctx.arc(x, y, range, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1;
    ctx.stroke();
  },

  drawTower(ctx, tower, ts) {
    this.drawTowerShape(ctx, tower.x, tower.y, tower.color, ts, tower.facing);

    // Level indicator
    if (tower.level > 1) {
      ctx.fillStyle = '#FFD700';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('★'.repeat(tower.level - 1), tower.x, tower.y - ts / 2 + 4);
    }

    // Flame cone visual
    if (tower.special === 'cone' && tower.target) {
      ctx.save();
      ctx.translate(tower.x, tower.y);
      ctx.rotate(tower.facing);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, tower.range, -tower.coneAngle / 2, tower.coneAngle / 2);
      ctx.closePath();
      ctx.fillStyle = 'rgba(255, 100, 0, 0.15)';
      ctx.fill();
      ctx.restore();
    }
  },

  drawTowerShape(ctx, x, y, color, ts, facing) {
    const size = ts * 0.35;

    // Base (octagon)
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2 - Math.PI / 8;
      const px = x + Math.cos(angle) * size;
      const py = y + Math.sin(angle) * size;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Barrel
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(facing);
    ctx.fillStyle = '#333';
    ctx.fillRect(size * 0.5, -2, size * 0.6, 4);
    ctx.restore();
  },

  drawEnemy(ctx, enemy, isFlying) {
    const r = enemy.radius;

    // Shadow for flying enemies
    if (isFlying) {
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.ellipse(enemy.x + 4, enemy.y + 8, r * 0.8, r * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    const drawY = isFlying ? enemy.y - 10 : enemy.y;

    // Hit flash
    const flashColor = enemy.hitFlash > 0 ? '#FFFFFF' : null;
    const color = flashColor || enemy.color;

    // Shield bubble
    if (enemy.shieldHp > 0) {
      ctx.beginPath();
      ctx.arc(enemy.x, drawY, r + 4, 0, Math.PI * 2);
      ctx.strokeStyle = Game.Config.COLORS.shieldBar;
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.5 + 0.5 * (enemy.shieldHp / enemy.maxShieldHp);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // Body
    if (enemy.shape === 'diamond') {
      ctx.save();
      ctx.translate(enemy.x, drawY);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = color;
      ctx.fillRect(-r * 0.7, -r * 0.7, r * 1.4, r * 1.4);
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1;
      ctx.strokeRect(-r * 0.7, -r * 0.7, r * 1.4, r * 1.4);
      ctx.restore();
    } else {
      ctx.beginPath();
      ctx.arc(enemy.x, drawY, r, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Wings for flyers
    if (isFlying) {
      ctx.save();
      ctx.translate(enemy.x, drawY);
      ctx.strokeStyle = enemy.color;
      ctx.lineWidth = 2;
      // Left wing
      ctx.beginPath();
      ctx.moveTo(-r * 0.5, 0);
      ctx.quadraticCurveTo(-r * 1.5, -r * 1.2, -r * 0.3, -r * 0.3);
      ctx.stroke();
      // Right wing
      ctx.beginPath();
      ctx.moveTo(r * 0.5, 0);
      ctx.quadraticCurveTo(r * 1.5, -r * 1.2, r * 0.3, -r * 0.3);
      ctx.stroke();
      ctx.restore();
    }

    // Healer cross
    if (enemy.special === 'heal') {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(enemy.x - 2, drawY - r * 0.5, 4, r);
      ctx.fillRect(enemy.x - r * 0.5, drawY - 2, r, 4);
    }

    // Boss marker
    if (enemy.type === 'boss') {
      ctx.fillStyle = '#FFD700';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('♛', enemy.x, drawY - r - 4);
    }

    // Health bar
    if (enemy.hp < enemy.maxHp) {
      const barW = r * 2.5;
      const barH = 3;
      const barX = enemy.x - barW / 2;
      const barY = drawY - r - 8;
      const hpRatio = enemy.hp / enemy.maxHp;

      ctx.fillStyle = Game.Config.COLORS.healthBarBg;
      ctx.fillRect(barX, barY, barW, barH);
      ctx.fillStyle = hpRatio > 0.3 ? Game.Config.COLORS.healthBarFg : Game.Config.COLORS.healthBarLow;
      ctx.fillRect(barX, barY, barW * hpRatio, barH);
    }

    // Stun indicator
    if (enemy.stunned) {
      ctx.fillStyle = '#FFFF00';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('✦', enemy.x, drawY - r - 12);
    }

    // Slow indicator
    const slowed = enemy.statusEffects.some(e => e.type === 'slow');
    if (slowed) {
      ctx.strokeStyle = '#88CCEE';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.arc(enemy.x, drawY, r + 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  },

  drawProjectile(ctx, proj) {
    if (proj.type === 'lightning') {
      this.drawLightning(ctx, proj);
      return;
    }

    // Trail
    if (proj.trail) {
      for (let i = 0; i < proj.trail.length; i++) {
        const t = proj.trail[i];
        ctx.globalAlpha = (i / proj.trail.length) * 0.3;
        ctx.fillStyle = proj.color;
        ctx.fillRect(t.x - 1, t.y - 1, 2, 2);
      }
      ctx.globalAlpha = 1;
    }

    // Projectile body
    ctx.fillStyle = proj.color;
    if (proj.towerType === 'cannon') {
      // Cannonball
      ctx.beginPath();
      ctx.arc(proj.x, proj.y, 4, 0, Math.PI * 2);
      ctx.fill();
    } else if (proj.towerType === 'frost') {
      // Diamond
      ctx.save();
      ctx.translate(proj.x, proj.y);
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-3, -3, 6, 6);
      ctx.restore();
    } else {
      // Arrow/default - small triangle
      const angle = Math.atan2(proj.ty - proj.y, proj.tx - proj.x);
      ctx.save();
      ctx.translate(proj.x, proj.y);
      ctx.rotate(angle);
      ctx.beginPath();
      ctx.moveTo(5, 0);
      ctx.lineTo(-3, -3);
      ctx.lineTo(-3, 3);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  },

  drawLightning(ctx, proj) {
    ctx.globalAlpha = proj.life / proj.maxLife;
    ctx.strokeStyle = proj.color;
    ctx.lineWidth = 2;
    ctx.shadowColor = proj.color;
    ctx.shadowBlur = 10;

    // Draw jagged lines between targets
    let sx = proj.sourceX;
    let sy = proj.sourceY;
    for (const t of proj.targets) {
      this.drawJaggedLine(ctx, sx, sy, t.x, t.y);
      sx = t.x;
      sy = t.y;
    }

    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  },

  drawJaggedLine(ctx, x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const segments = Math.max(3, Math.floor(dist / 15));
    const perpX = -dy / dist;
    const perpY = dx / dist;

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    for (let i = 1; i < segments; i++) {
      const t = i / segments;
      const jitter = (Math.random() - 0.5) * 12;
      ctx.lineTo(
        x1 + dx * t + perpX * jitter,
        y1 + dy * t + perpY * jitter
      );
    }
    ctx.lineTo(x2, y2);
    ctx.stroke();
  },
};
