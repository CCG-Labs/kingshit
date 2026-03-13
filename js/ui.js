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

  drawHUD(ctx, state, canvas) {
    const C = Game.Config.COLORS;
    const y = 4;

    // Top bar background
    ctx.fillStyle = C.uiBg;
    ctx.fillRect(0, 0, canvas.width, 30);

    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'left';

    // Gold
    ctx.fillStyle = C.goldText;
    ctx.fillText(`Gold: ${state.gold}`, 10, y + 18);

    // Lives
    ctx.fillStyle = state.lives > 5 ? C.uiText : C.healthBarLow;
    ctx.fillText(`Lives: ${state.lives}`, 150, y + 18);

    // Wave
    ctx.fillStyle = C.uiText;
    const wave = Game.WaveSpawner.getCurrentWave();
    const total = Game.WaveSpawner.getTotalWaves();
    ctx.fillText(`Wave: ${wave}/${total}`, 280, y + 18);

    // Enemies alive
    const alive = state.enemies.filter(e => !e.dead && !e.escaped).length;
    ctx.fillStyle = C.uiTextDim;
    ctx.fillText(`Enemies: ${alive}`, 420, y + 18);

    // Game speed
    ctx.textAlign = 'right';
    ctx.fillStyle = state.gameSpeed > 1 ? C.goldText : C.uiText;
    ctx.fillText(`Speed: ${state.gameSpeed}x`, canvas.width - 80, y + 18);

    // Pause
    ctx.fillStyle = state.paused ? C.healthBarLow : C.uiTextDim;
    ctx.fillText(state.paused ? 'PAUSED' : '[Space]', canvas.width - 10, y + 18);

    ctx.textAlign = 'left';
  },

  drawTowerBar(ctx, state, canvas) {
    const C = Game.Config.COLORS;
    const barH = 70;
    const barY = canvas.height - barH;
    const towerOrder = Game.Config.TOWER_ORDER;
    const btnW = 80;
    const btnH = 56;
    const startX = (canvas.width - towerOrder.length * (btnW + 8)) / 2;

    // Bar background
    ctx.fillStyle = C.uiBg;
    ctx.fillRect(0, barY, canvas.width, barH);
    ctx.strokeStyle = C.uiBorder;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, barY);
    ctx.lineTo(canvas.width, barY);
    ctx.stroke();

    this.towerButtons = [];
    this.hoveredTowerType = null;

    for (let i = 0; i < towerOrder.length; i++) {
      const type = towerOrder[i];
      const def = Game.Config.TOWERS[type];
      const bx = startX + i * (btnW + 8);
      const by = barY + 8;
      const affordable = state.gold >= def.cost;
      const selected = state.placingTower === type;

      this.towerButtons.push({ x: bx, y: by, w: btnW, h: btnH, type });

      // Button background
      ctx.fillStyle = selected ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.3)';
      ctx.fillRect(bx, by, btnW, btnH);
      ctx.strokeStyle = selected ? '#FFFFFF' : C.uiBorder;
      ctx.lineWidth = selected ? 2 : 1;
      ctx.strokeRect(bx, by, btnW, btnH);

      // Tower icon
      ctx.globalAlpha = affordable ? 1 : 0.4;
      Game.Renderer.drawTowerShape(ctx, bx + 20, by + 22, def.color, 32, 0);

      // Name
      ctx.fillStyle = C.uiText;
      ctx.font = '9px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(def.name.split(' ')[0], bx + btnW / 2, by + 44);

      // Cost
      ctx.fillStyle = affordable ? C.goldText : C.healthBarLow;
      ctx.font = 'bold 10px monospace';
      ctx.fillText(`${def.cost}g`, bx + btnW / 2, by + 54);

      ctx.globalAlpha = 1;

      // Hotkey
      ctx.fillStyle = C.uiTextDim;
      ctx.font = '9px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`[${i + 1}]`, bx + 2, by + 12);

      // Check hover for tooltip
      const mx = Game.Input.mouse.x;
      const my = Game.Input.mouse.y;
      if (mx >= bx && mx <= bx + btnW && my >= by && my <= by + btnH) {
        this.hoveredTowerType = type;
      }
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
    const C = Game.Config.COLORS;

    const tipW = 200;
    const tipH = 80;
    let tipX = mx - tipW / 2;
    let tipY = canvas.height - 85 - tipH;
    tipX = Math.max(4, Math.min(canvas.width - tipW - 4, tipX));

    ctx.fillStyle = 'rgba(0,0,0,0.9)';
    ctx.fillRect(tipX, tipY, tipW, tipH);
    ctx.strokeStyle = C.uiBorder;
    ctx.lineWidth = 1;
    ctx.strokeRect(tipX, tipY, tipW, tipH);

    ctx.fillStyle = C.uiText;
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(def.name, tipX + 8, tipY + 16);

    ctx.font = '10px monospace';
    ctx.fillStyle = C.uiTextDim;
    ctx.fillText(def.description, tipX + 8, tipY + 32);

    ctx.fillStyle = C.uiText;
    ctx.fillText(`DMG: ${def.damage}  RNG: ${def.range}  SPD: ${def.fireRate}s`, tipX + 8, tipY + 48);

    ctx.fillStyle = '#88CC88';
    ctx.fillText(`L3: ${def.l3}`, tipX + 8, tipY + 64);

    const flags = [];
    if (def.canHitFlying) flags.push('Anti-Air');
    if (def.special === 'splash') flags.push('AoE');
    if (flags.length > 0) {
      ctx.fillStyle = '#AACCFF';
      ctx.fillText(flags.join(' | '), tipX + 8, tipY + 76);
    }
  },

  drawTowerInfo(ctx, state, canvas) {
    const tower = state.selectedTower;
    const C = Game.Config.COLORS;
    const panelW = 220;
    const panelH = 190;
    const panelX = canvas.width - panelW - 8;
    const panelY = 38;

    ctx.fillStyle = C.uiBg;
    ctx.fillRect(panelX, panelY, panelW, panelH);
    ctx.strokeStyle = C.uiBorder;
    ctx.lineWidth = 1;
    ctx.strokeRect(panelX, panelY, panelW, panelH);

    let y = panelY + 18;
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = tower.color;
    ctx.fillText(`${Game.Config.TOWERS[tower.type].name} Lv${tower.level}`, panelX + 8, y);

    y += 18;
    ctx.font = '11px monospace';
    ctx.fillStyle = C.uiText;
    ctx.fillText(`Damage: ${tower.damage.toFixed(1)}`, panelX + 8, y);
    y += 15;
    ctx.fillText(`Range: ${tower.range.toFixed(0)}`, panelX + 8, y);
    y += 15;
    ctx.fillText(`Fire Rate: ${tower.fireRate.toFixed(2)}s`, panelX + 8, y);
    y += 15;
    ctx.fillText(`Kills: ${tower.kills}`, panelX + 8, y);
    y += 15;
    ctx.fillStyle = C.uiTextDim;
    ctx.fillText(`Target: ${tower.targetMode}`, panelX + 8, y);
    ctx.fillText('[T] cycle', panelX + 130, y);

    y += 20;

    // Upgrade button
    this.upgradeBtn = null;
    if (tower.level < Game.Config.MAX_TOWER_LEVEL) {
      const cost = tower.getUpgradeCost();
      const affordable = state.gold >= cost;
      const btnX = panelX + 8;
      const btnY = y;
      const btnW = panelW - 16;
      const btnH = 22;

      this.upgradeBtn = { x: btnX, y: btnY, w: btnW, h: btnH };

      ctx.fillStyle = affordable ? '#335533' : '#333333';
      ctx.fillRect(btnX, btnY, btnW, btnH);
      ctx.strokeStyle = affordable ? '#44AA44' : '#666666';
      ctx.strokeRect(btnX, btnY, btnW, btnH);

      ctx.fillStyle = affordable ? C.uiText : C.uiTextDim;
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`Upgrade (${cost}g) [U]`, btnX + btnW / 2, btnY + 15);
      y += 28;
    }

    // Sell button
    const sellVal = tower.getSellValue();
    const sellBtnX = panelX + 8;
    const sellBtnY = y;
    const sellBtnW = panelW - 16;
    const sellBtnH = 22;

    this.sellBtn = { x: sellBtnX, y: sellBtnY, w: sellBtnW, h: sellBtnH };

    ctx.fillStyle = '#553333';
    ctx.fillRect(sellBtnX, sellBtnY, sellBtnW, sellBtnH);
    ctx.strokeStyle = '#AA4444';
    ctx.strokeRect(sellBtnX, sellBtnY, sellBtnW, sellBtnH);

    ctx.fillStyle = C.uiText;
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`Sell (${sellVal}g) [S]`, sellBtnX + sellBtnW / 2, sellBtnY + 15);

    ctx.textAlign = 'left';
  },

  drawPlacingInfo(ctx, state, canvas) {
    const def = Game.Config.TOWERS[state.placingTower];
    const C = Game.Config.COLORS;

    ctx.fillStyle = C.uiBg;
    ctx.fillRect(canvas.width / 2 - 120, 34, 240, 20);
    ctx.fillStyle = C.uiText;
    ctx.font = '11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`Placing ${def.name} - Click to place, Right-click/Esc to cancel`, canvas.width / 2, 48);
    ctx.textAlign = 'left';
  },

  drawWaveCountdown(ctx, state, canvas) {
    const C = Game.Config.COLORS;
    const timer = Game.WaveSpawner.betweenWaveTimer;
    const nextWave = Game.WaveSpawner.getCurrentWave() + 1;
    const total = Game.WaveSpawner.getTotalWaves();

    if (nextWave > total) return;

    const boxW = 280;
    const boxH = 60;
    const boxX = (canvas.width - boxW) / 2;
    const boxY = canvas.height / 2 - 80;

    ctx.fillStyle = C.uiBg;
    ctx.fillRect(boxX, boxY, boxW, boxH);
    ctx.strokeStyle = C.uiBorder;
    ctx.strokeRect(boxX, boxY, boxW, boxH);

    ctx.fillStyle = C.uiText;
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`Wave ${nextWave} in ${Math.ceil(timer)}s`, canvas.width / 2, boxY + 22);

    // Start early button
    this.startEarlyBtn = { x: boxX + 40, y: boxY + 32, w: boxW - 80, h: 22 };
    ctx.fillStyle = '#335533';
    ctx.fillRect(this.startEarlyBtn.x, this.startEarlyBtn.y, this.startEarlyBtn.w, this.startEarlyBtn.h);
    ctx.strokeStyle = '#44AA44';
    ctx.strokeRect(this.startEarlyBtn.x, this.startEarlyBtn.y, this.startEarlyBtn.w, this.startEarlyBtn.h);

    ctx.fillStyle = C.goldText;
    ctx.font = 'bold 11px monospace';
    const bonus = Math.round(timer * 2);
    ctx.fillText(`Start Now (+${bonus}g bonus) [Enter]`, canvas.width / 2, this.startEarlyBtn.y + 15);

    ctx.textAlign = 'left';
  },

  drawGameOver(ctx, canvas) {
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#CC2222';
    ctx.font = 'bold 48px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('GAME OVER', canvas.width / 2, canvas.height / 2 - 20);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '18px monospace';
    ctx.fillText(`Survived ${Game.WaveSpawner.getCurrentWave()} waves`, canvas.width / 2, canvas.height / 2 + 20);
    ctx.fillText('Click to return to menu', canvas.width / 2, canvas.height / 2 + 50);

    ctx.textAlign = 'left';
  },

  drawVictory(ctx, state, canvas) {
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 48px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('VICTORY!', canvas.width / 2, canvas.height / 2 - 20);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '18px monospace';
    ctx.fillText(`Lives remaining: ${state.lives}  Gold: ${state.gold}`, canvas.width / 2, canvas.height / 2 + 20);
    ctx.fillText('Click to return to menu', canvas.width / 2, canvas.height / 2 + 50);

    ctx.textAlign = 'left';
  },

  handleClick(state, x, y, canvas) {
    const barY = canvas.height - 70;

    // Check tower bar buttons
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

    // Check upgrade button
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

    // Check sell button
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

    // Check start early button
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

    // Check game over / victory click
    if (state.gameState === 'gameover' || state.gameState === 'victory') {
      Game.Main.showMenu();
      return true;
    }

    return false;
  },
};
