window.Game = window.Game || {};

Game.UI = {
  hoveredTowerType: null,
  tooltipTimer: 0,

  draw(ctx, state, canvas) {
    this.drawHUD(ctx, state, canvas);
    this.drawTowerBar(ctx, state, canvas);

    if (state.selectedTower) {
      this.drawTowerInfo(ctx, state, canvas);
    }

    if (state.placingTower) {
      this.drawPlacingInfo(ctx, state, canvas);
    }

    if (Game.WaveSpawner.betweenWaves && state.gameState === 'playing') {
      this.drawWaveCountdown(ctx, state, canvas);
    }

    if (state.gameState === 'gameover') {
      this.drawGameOver(ctx, canvas);
    }

    if (state.gameState === 'victory') {
      this.drawVictory(ctx, state, canvas);
    }
  },

  // ── Panel drawing helpers ─────────────────────────────────

  _drawPanel(ctx, x, y, w, h, opts = {}) {
    const r = opts.radius || 4;
    const bg = opts.bg || 'rgba(10,10,30,0.85)';
    const border = opts.border || 'rgba(100,100,120,0.5)';
    const borderWidth = opts.borderWidth || 1;

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    this._roundRect(ctx, x + 2, y + 2, w, h, r);
    ctx.fill();

    // Background
    ctx.fillStyle = bg;
    this._roundRect(ctx, x, y, w, h, r);
    ctx.fill();

    // Border
    ctx.strokeStyle = border;
    ctx.lineWidth = borderWidth;
    this._roundRect(ctx, x, y, w, h, r);
    ctx.stroke();

    // Top highlight
    if (!opts.noHighlight) {
      const hg = ctx.createLinearGradient(x, y, x, y + 4);
      hg.addColorStop(0, 'rgba(255,255,255,0.08)');
      hg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = hg;
      this._roundRect(ctx, x, y, w, Math.min(4, h), r);
      ctx.fill();
    }
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

  _drawButton(ctx, x, y, w, h, text, opts = {}) {
    const hovered = opts.hovered || false;
    const affordable = opts.affordable !== undefined ? opts.affordable : true;
    const color = opts.color || '#44AA44';
    const darkerColor = opts.darkerColor || '#335533';

    ctx.fillStyle = hovered ? this._lighten(darkerColor) : darkerColor;
    this._roundRect(ctx, x, y, w, h, 3);
    ctx.fill();
    ctx.strokeStyle = affordable ? color : '#666666';
    ctx.lineWidth = hovered ? 2 : 1;
    this._roundRect(ctx, x, y, w, h, 3);
    ctx.stroke();

    if (hovered && affordable) {
      const hg = ctx.createLinearGradient(x, y, x, y + h);
      hg.addColorStop(0, 'rgba(255,255,255,0.08)');
      hg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = hg;
      this._roundRect(ctx, x, y, w, h, 3);
      ctx.fill();
    }

    ctx.fillStyle = affordable ? '#FFFFFF' : '#888888';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(text, x + w / 2, y + h / 2 + 4);
  },

  _lighten(color) {
    // Simple lighten for UI
    return color.replace(/[0-9a-f]{2}/gi, (m) => {
      const v = Math.min(255, parseInt(m, 16) + 20);
      return v.toString(16).padStart(2, '0');
    });
  },

  // ── HUD ───────────────────────────────────────────────────

  drawHUD(ctx, state, canvas) {
    // Top bar
    this._drawPanel(ctx, 0, 0, canvas.width, 32, {
      radius: 0,
      bg: 'rgba(10,10,30,0.88)',
      border: 'rgba(60,60,80,0.4)',
      noHighlight: true,
    });

    // Subtle bottom glow line
    const lg = ctx.createLinearGradient(0, 31, 0, 34);
    lg.addColorStop(0, 'rgba(100,100,150,0.2)');
    lg.addColorStop(1, 'rgba(100,100,150,0)');
    ctx.fillStyle = lg;
    ctx.fillRect(0, 32, canvas.width, 2);

    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'left';
    const y = 21;

    // Gold (with icon)
    ctx.fillStyle = '#FFD700';
    ctx.fillText('\u25C6 ' + state.gold, 12, y);

    // Lives (with icon)
    ctx.fillStyle = state.lives > 5 ? '#FF6666' : '#FF3333';
    ctx.fillText('\u2665 ' + state.lives, 130, y);

    // Wave
    ctx.fillStyle = '#DDDDDD';
    const wave = Game.WaveSpawner.getCurrentWave();
    const total = Game.WaveSpawner.getTotalWaves();
    ctx.fillText('Wave ' + wave + '/' + total, 240, y);

    // Enemies alive
    const alive = state.enemies.filter(e => !e.dead && !e.escaped).length;
    ctx.fillStyle = alive > 0 ? '#AAAAAA' : '#666666';
    ctx.fillText('x' + alive, 390, y);

    // Game speed
    ctx.textAlign = 'right';
    if (state.gameSpeed > 1) {
      ctx.fillStyle = '#FFD700';
      ctx.fillText(state.gameSpeed + 'x', canvas.width - 90, y);
    } else {
      ctx.fillStyle = '#888888';
      ctx.fillText('1x', canvas.width - 90, y);
    }

    // Pause indicator
    if (state.paused) {
      ctx.fillStyle = '#FF6666';
      ctx.fillText('PAUSED', canvas.width - 10, y);
    } else {
      ctx.fillStyle = '#555555';
      ctx.font = '11px monospace';
      ctx.fillText('[Space]', canvas.width - 10, y);
    }

    ctx.textAlign = 'left';
  },

  // ── Tower bar ─────────────────────────────────────────────

  drawTowerBar(ctx, state, canvas) {
    const barH = 74;
    const barY = canvas.height - barH;
    const towerOrder = Game.Config.TOWER_ORDER;
    const btnW = 78;
    const btnH = 58;
    const gap = 6;
    const startX = (canvas.width - towerOrder.length * (btnW + gap) + gap) / 2;

    // Bar background
    this._drawPanel(ctx, 0, barY, canvas.width, barH, {
      radius: 0,
      bg: 'rgba(10,10,30,0.88)',
      border: 'rgba(60,60,80,0.4)',
      noHighlight: true,
    });

    // Top glow line
    const tg = ctx.createLinearGradient(0, barY - 2, 0, barY);
    tg.addColorStop(0, 'rgba(100,100,150,0)');
    tg.addColorStop(1, 'rgba(100,100,150,0.2)');
    ctx.fillStyle = tg;
    ctx.fillRect(0, barY - 2, canvas.width, 2);

    this.towerButtons = [];
    this.hoveredTowerType = null;

    for (let i = 0; i < towerOrder.length; i++) {
      const type = towerOrder[i];
      const def = Game.Config.TOWERS[type];
      const bx = startX + i * (btnW + gap);
      const by = barY + 9;
      const affordable = state.gold >= def.cost;
      const selected = state.placingTower === type;

      this.towerButtons.push({ x: bx, y: by, w: btnW, h: btnH, type });

      // Check hover
      const mx = Game.Input.mouse.x, my = Game.Input.mouse.y;
      const hovered = mx >= bx && mx <= bx + btnW && my >= by && my <= by + btnH;
      if (hovered) this.hoveredTowerType = type;

      // Button panel
      const bg = selected ? 'rgba(255,255,255,0.12)' : (hovered ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.25)');
      const borderColor = selected ? def.color : (hovered ? 'rgba(200,200,200,0.3)' : 'rgba(80,80,80,0.3)');
      this._drawPanel(ctx, bx, by, btnW, btnH, {
        bg, border: borderColor, borderWidth: selected ? 2 : 1,
      });

      // Tower icon
      ctx.globalAlpha = affordable ? 1 : 0.35;
      Game.Renderer.drawTowerShape(ctx, bx + 20, by + 24, def.color, 30, 0);

      // Name
      ctx.fillStyle = '#DDDDDD';
      ctx.font = '9px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(def.name.split(' ')[0], bx + btnW / 2, by + 44);

      // Cost
      ctx.fillStyle = affordable ? '#FFD700' : '#AA4444';
      ctx.font = 'bold 10px monospace';
      ctx.fillText(def.cost + 'g', bx + btnW / 2, by + 55);

      ctx.globalAlpha = 1;

      // Hotkey badge
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.font = '8px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(i + 1, bx + 4, by + 10);
    }

    // Tooltip
    if (this.hoveredTowerType) {
      this.drawTowerTooltip(ctx, canvas);
    }

    ctx.textAlign = 'left';
  },

  drawTowerTooltip(ctx, canvas) {
    const def = Game.Config.TOWERS[this.hoveredTowerType];
    const mx = Game.Input.mouse.x;

    const tipW = 220;
    const tipH = 90;
    let tipX = mx - tipW / 2;
    let tipY = canvas.height - 90 - tipH;
    tipX = Math.max(4, Math.min(canvas.width - tipW - 4, tipX));

    this._drawPanel(ctx, tipX, tipY, tipW, tipH, {
      bg: 'rgba(5,5,20,0.95)',
      border: 'rgba(120,120,150,0.4)',
    });

    let ty = tipY + 18;
    ctx.fillStyle = def.color;
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(def.name, tipX + 10, ty);

    ty += 16;
    ctx.font = '10px monospace';
    ctx.fillStyle = '#AAAAAA';
    ctx.fillText(def.description, tipX + 10, ty);

    ty += 16;
    ctx.fillStyle = '#CCCCCC';
    ctx.fillText('DMG: ' + def.damage + '  RNG: ' + def.range + '  SPD: ' + def.fireRate + 's', tipX + 10, ty);

    ty += 16;
    ctx.fillStyle = '#88CC88';
    ctx.fillText('L3: ' + def.l3, tipX + 10, ty);

    const flags = [];
    if (def.canHitFlying) flags.push('Anti-Air');
    if (def.special === 'splash') flags.push('AoE');
    if (flags.length > 0) {
      ty += 14;
      ctx.fillStyle = '#88AADD';
      ctx.fillText(flags.join(' | '), tipX + 10, ty);
    }
  },

  // ── Tower info panel ──────────────────────────────────────

  drawTowerInfo(ctx, state, canvas) {
    const tower = state.selectedTower;
    const panelW = 225;
    const panelH = 200;
    const panelX = canvas.width - panelW - 10;
    const panelY = 40;

    this._drawPanel(ctx, panelX, panelY, panelW, panelH, {
      bg: 'rgba(5,5,20,0.92)',
      border: 'rgba(120,120,150,0.4)',
    });

    let y = panelY + 20;
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'left';

    // Tower name with color
    ctx.fillStyle = tower.color;
    ctx.fillText(Game.Config.TOWERS[tower.type].name + ' Lv' + tower.level, panelX + 10, y);

    // Stats
    y += 20;
    ctx.font = '11px monospace';
    ctx.fillStyle = '#CCCCCC';
    ctx.fillText('Damage:    ' + tower.damage.toFixed(1), panelX + 10, y);
    y += 16;
    ctx.fillText('Range:     ' + tower.range.toFixed(0), panelX + 10, y);
    y += 16;
    ctx.fillText('Fire Rate: ' + tower.fireRate.toFixed(2) + 's', panelX + 10, y);
    y += 16;
    ctx.fillStyle = '#AAAAAA';
    ctx.fillText('Kills:     ' + tower.kills, panelX + 10, y);
    y += 16;
    ctx.fillStyle = '#888888';
    ctx.fillText('Target: ' + tower.targetMode, panelX + 10, y);
    ctx.fillStyle = '#666666';
    ctx.textAlign = 'right';
    ctx.fillText('[T]', panelX + panelW - 10, y);
    ctx.textAlign = 'left';

    y += 22;

    // Upgrade button
    this.upgradeBtn = null;
    if (tower.level < Game.Config.MAX_TOWER_LEVEL) {
      const cost = tower.getUpgradeCost();
      const affordable = state.gold >= cost;
      const btnX = panelX + 10;
      const btnY = y;
      const btnW = panelW - 20;
      const btnH = 24;
      this.upgradeBtn = { x: btnX, y: btnY, w: btnW, h: btnH };

      const mx = Game.Input.mouse.x, my = Game.Input.mouse.y;
      const hov = mx >= btnX && mx <= btnX + btnW && my >= btnY && my <= btnY + btnH;

      this._drawButton(ctx, btnX, btnY, btnW, btnH, 'Upgrade (' + cost + 'g) [U]', {
        hovered: hov, affordable, color: '#44AA44', darkerColor: '#2A4A2A',
      });
      y += 30;
    }

    // Sell button
    const sellVal = tower.getSellValue();
    const sellX = panelX + 10;
    const sellY = y;
    const sellW = panelW - 20;
    const sellH = 24;
    this.sellBtn = { x: sellX, y: sellY, w: sellW, h: sellH };

    const mx2 = Game.Input.mouse.x, my2 = Game.Input.mouse.y;
    const hov2 = mx2 >= sellX && mx2 <= sellX + sellW && my2 >= sellY && my2 <= sellY + sellH;

    this._drawButton(ctx, sellX, sellY, sellW, sellH, 'Sell (' + sellVal + 'g) [S]', {
      hovered: hov2, color: '#AA4444', darkerColor: '#4A2A2A',
    });

    ctx.textAlign = 'left';
  },

  // ── Placement info ────────────────────────────────────────

  drawPlacingInfo(ctx, state, canvas) {
    const def = Game.Config.TOWERS[state.placingTower];
    const text = 'Placing ' + def.name + ' \u2014 Right-click/Esc to cancel';
    const tw = ctx.measureText(text).width || 350;
    const pw = Math.max(tw + 24, 300);

    this._drawPanel(ctx, (canvas.width - pw) / 2, 36, pw, 22, {
      bg: 'rgba(5,5,20,0.85)',
      border: 'rgba(120,120,150,0.3)',
    });

    ctx.fillStyle = '#CCCCCC';
    ctx.font = '11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(text, canvas.width / 2, 51);
    ctx.textAlign = 'left';
  },

  // ── Wave countdown ────────────────────────────────────────

  drawWaveCountdown(ctx, state, canvas) {
    const timer = Game.WaveSpawner.betweenWaveTimer;
    const nextWave = Game.WaveSpawner.getCurrentWave() + 1;
    const total = Game.WaveSpawner.getTotalWaves();
    if (nextWave > total) return;

    const boxW = 280;
    const boxH = 68;
    const boxX = (canvas.width - boxW) / 2;
    const boxY = canvas.height / 2 - 85;

    this._drawPanel(ctx, boxX, boxY, boxW, boxH, {
      bg: 'rgba(5,5,20,0.92)',
      border: 'rgba(120,120,150,0.4)',
    });

    // Timer bar
    const barW = boxW - 20;
    const barH = 4;
    const barX = boxX + 10;
    const barY = boxY + 30;
    const ratio = timer / Game.Config.BETWEEN_WAVE_TIME;
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(barX, barY, barW, barH);
    const barGrad = ctx.createLinearGradient(barX, barY, barX + barW * ratio, barY);
    barGrad.addColorStop(0, '#FFD700');
    barGrad.addColorStop(1, '#FF8800');
    ctx.fillStyle = barGrad;
    this._roundRect(ctx, barX, barY, barW * ratio, barH, 2);
    ctx.fill();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Wave ' + nextWave + ' in ' + Math.ceil(timer) + 's', canvas.width / 2, boxY + 24);

    // Start early button
    const btnX = boxX + 40, btnY = boxY + 38, btnW = boxW - 80, btnH = 24;
    this.startEarlyBtn = { x: btnX, y: btnY, w: btnW, h: btnH };

    const mx = Game.Input.mouse.x, my = Game.Input.mouse.y;
    const hov = mx >= btnX && mx <= btnX + btnW && my >= btnY && my <= btnY + btnH;
    const bonus = Math.round(timer * 2);

    this._drawButton(ctx, btnX, btnY, btnW, btnH, 'Start Now (+' + bonus + 'g) [Enter]', {
      hovered: hov, color: '#FFD700', darkerColor: '#4A3A10',
    });

    ctx.textAlign = 'left';
  },

  // ── Game over / Victory ───────────────────────────────────

  drawGameOver(ctx, canvas) {
    // Full screen dim
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Vignette
    const vg = ctx.createRadialGradient(
      canvas.width / 2, canvas.height / 2, canvas.height * 0.3,
      canvas.width / 2, canvas.height / 2, canvas.height * 0.8
    );
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.5)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Panel
    const pw = 360, ph = 140;
    const px = (canvas.width - pw) / 2;
    const py = (canvas.height - ph) / 2 - 20;
    this._drawPanel(ctx, px, py, pw, ph, {
      bg: 'rgba(40,10,10,0.9)',
      border: 'rgba(200,50,50,0.5)',
      borderWidth: 2,
    });

    ctx.save();
    ctx.shadowColor = '#CC2222';
    ctx.shadowBlur = 20;
    ctx.fillStyle = '#FF3333';
    ctx.font = 'bold 42px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('GAME OVER', canvas.width / 2, py + 55);
    ctx.restore();

    ctx.fillStyle = '#CCCCCC';
    ctx.font = '16px monospace';
    ctx.fillText('Survived ' + Game.WaveSpawner.getCurrentWave() + ' waves', canvas.width / 2, py + 90);

    ctx.fillStyle = '#888888';
    ctx.font = '13px monospace';
    ctx.fillText('Click to return to menu', canvas.width / 2, py + 120);

    ctx.textAlign = 'left';
  },

  drawVictory(ctx, state, canvas) {
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const pw = 380, ph = 160;
    const px = (canvas.width - pw) / 2;
    const py = (canvas.height - ph) / 2 - 20;
    this._drawPanel(ctx, px, py, pw, ph, {
      bg: 'rgba(20,20,10,0.92)',
      border: 'rgba(200,180,50,0.5)',
      borderWidth: 2,
    });

    ctx.save();
    ctx.shadowColor = '#FFD700';
    ctx.shadowBlur = 25;
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 42px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('VICTORY!', canvas.width / 2, py + 55);
    ctx.restore();

    ctx.fillStyle = '#CCCCCC';
    ctx.font = '16px monospace';
    ctx.fillText('Lives: ' + state.lives + '  Gold: ' + state.gold, canvas.width / 2, py + 90);

    // Rating
    const stars = state.lives >= 15 ? 3 : (state.lives >= 8 ? 2 : 1);
    ctx.fillStyle = '#FFD700';
    ctx.font = '24px monospace';
    ctx.fillText('\u2605'.repeat(stars) + '\u2606'.repeat(3 - stars), canvas.width / 2, py + 120);

    ctx.fillStyle = '#888888';
    ctx.font = '13px monospace';
    ctx.fillText('Click to return to menu', canvas.width / 2, py + 148);

    ctx.textAlign = 'left';
  },

  // ── Click handling ────────────────────────────────────────

  handleClick(state, x, y, canvas) {
    const barY = canvas.height - 74;

    // Tower bar buttons
    if (this.towerButtons) {
      for (const btn of this.towerButtons) {
        if (x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h) {
          const def = Game.Config.TOWERS[btn.type];
          if (state.gold >= def.cost) {
            state.placingTower = state.placingTower === btn.type ? null : btn.type;
            state.selectedTower = null;
          }
          return true;
        }
      }
    }

    // Upgrade button
    if (this.upgradeBtn && state.selectedTower) {
      const btn = this.upgradeBtn;
      if (x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h) {
        const cost = state.selectedTower.getUpgradeCost();
        if (state.gold >= cost) {
          state.gold -= cost;
          state.selectedTower.upgrade();
        }
        return true;
      }
    }

    // Sell button
    if (this.sellBtn && state.selectedTower) {
      const btn = this.sellBtn;
      if (x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h) {
        state.gold += state.selectedTower.getSellValue();
        const idx = state.towers.indexOf(state.selectedTower);
        if (idx >= 0) state.towers.splice(idx, 1);
        state.selectedTower = null;
        return true;
      }
    }

    // Start early button
    if (this.startEarlyBtn && Game.WaveSpawner.betweenWaves) {
      const btn = this.startEarlyBtn;
      if (x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h) {
        const bonus = Game.WaveSpawner.startEarly();
        state.gold += bonus;
        if (bonus > 0) {
          Game.Particles.goldPopup(canvas.width / 2, canvas.height / 2, bonus);
        }
        return true;
      }
    }

    // Game over / victory
    if (state.gameState === 'gameover' || state.gameState === 'victory') {
      Game.Main.showMenu();
      return true;
    }

    return false;
  },
};
