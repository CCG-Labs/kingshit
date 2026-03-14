window.Game = window.Game || {};

Game.Enemy = class Enemy {
  constructor(type, entryCol, entryRow, waveNum) {
    const def = Game.Config.ENEMIES[type];
    const scaling = Math.pow(Game.Config.WAVE_HP_SCALING, waveNum - 1);
    const goldScaling = Math.pow(Game.Config.WAVE_GOLD_SCALING, waveNum - 1);

    this.type = type;
    this.maxHp = Math.round(def.hp * scaling);
    this.hp = this.maxHp;
    this.baseSpeed = def.speed;
    this.armor = def.armor;
    this.gold = Math.round(def.gold * goldScaling);
    this.color = def.color;
    this.radius = def.radius;
    this.flying = def.flying;
    this.shape = def.shape || 'circle';
    this.special = def.special || null;
    this.dead = false;
    this.escaped = false;

    // Shield
    if (def.special === 'shield') {
      this.shieldHp = Math.round(def.shieldHp * scaling);
      this.maxShieldHp = this.shieldHp;
    } else {
      this.shieldHp = 0;
      this.maxShieldHp = 0;
    }

    // Healer
    this.healRate = def.healRate || 0;
    this.healRange = def.healRange || 0;

    // Position (world pixels)
    const ts = Game.Config.TILE_SIZE;
    this.x = entryCol * ts + ts / 2;
    this.y = entryRow * ts + ts / 2;

    // Grid-based movement (flow field)
    this.currentCol = entryCol;
    this.currentRow = entryRow;
    this.nextCol = -1;
    this.nextRow = -1;

    // Flying: direct path to castle
    this.flyStartX = this.x;
    this.flyStartY = this.y;
    this.flyProgress = 0;

    // Progress toward castle (0 = just spawned, 1 = at castle)
    this.progress = 0;

    // Status effects
    this.statusEffects = [];
    this.stunned = false;

    // Visual
    this.hitFlash = 0;
    this.facing = 0;
  }

  update(dt, enemies) {
    this.updateStatusEffects(dt);

    if (this.stunned) return;

    // Calculate effective speed
    let speed = this.baseSpeed;
    let slowMult = 1;
    for (const effect of this.statusEffects) {
      if (effect.type === 'slow') {
        slowMult = Math.min(slowMult, 1 - effect.amount);
      }
    }
    speed *= slowMult;

    // Movement
    if (this.flying) {
      this.updateFlying(dt, speed);
    } else {
      this.updateGroundMovement(dt, speed);
    }

    // Healer ability
    if (this.special === 'heal' && enemies) {
      this.healNearby(dt, enemies);
    }

    // Hit flash decay
    if (this.hitFlash > 0) this.hitFlash -= dt * 5;

    // DoT
    for (const effect of this.statusEffects) {
      if (effect.type === 'dot') {
        this.takeDamage(effect.damage * dt, true);
      }
    }
  }

  updateFlying(dt, speed) {
    const ts = Game.Config.TILE_SIZE;
    const castleX = Game.Map.castleCol * ts + ts / 2;
    const castleY = Game.Map.castleRow * ts + ts / 2;
    const dx = castleX - this.flyStartX;
    const dy = castleY - this.flyStartY;
    const totalDist = Math.sqrt(dx * dx + dy * dy) || 1;

    this.flyProgress += (speed / totalDist) * dt;
    this.progress = this.flyProgress;

    if (this.flyProgress >= 1) {
      this.escaped = true;
      return;
    }

    this.x = this.flyStartX + dx * this.flyProgress;
    this.y = this.flyStartY + dy * this.flyProgress;
    this.facing = Math.atan2(dy, dx);
  }

  updateGroundMovement(dt, speed) {
    const ts = Game.Config.TILE_SIZE;
    const field = Game.Map.flowField;

    // Look up next tile if needed
    if (this.nextCol < 0) {
      if (!field || !field[this.currentRow] || !field[this.currentRow][this.currentCol]) {
        // No path available - stuck
        return;
      }
      const dir = field[this.currentRow][this.currentCol];
      if (dir.dx === 0 && dir.dy === 0) {
        // At castle
        this.escaped = true;
        return;
      }
      this.nextCol = this.currentCol + dir.dx;
      this.nextRow = this.currentRow + dir.dy;
    }

    // Move toward next tile center
    const targetX = this.nextCol * ts + ts / 2;
    const targetY = this.nextRow * ts + ts / 2;
    const dx = targetX - this.x;
    const dy = targetY - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    this.facing = Math.atan2(dy, dx);

    if (dist < speed * dt) {
      this.x = targetX;
      this.y = targetY;
      this.currentCol = this.nextCol;
      this.currentRow = this.nextRow;
      this.nextCol = -1; // look up next direction on next frame
    } else {
      this.x += (dx / dist) * speed * dt;
      this.y += (dy / dist) * speed * dt;
    }

    // Update progress based on flow field distance
    if (field && field[this.currentRow] && field[this.currentRow][this.currentCol]) {
      const maxDist = Game.Map.getMaxDist();
      this.progress = 1 - (field[this.currentRow][this.currentCol].dist / maxDist);
    }
  }

  updateStatusEffects(dt) {
    this.stunned = false;
    for (let i = this.statusEffects.length - 1; i >= 0; i--) {
      const effect = this.statusEffects[i];
      effect.duration -= dt;
      if (effect.type === 'stun') this.stunned = true;
      if (effect.duration <= 0) {
        this.statusEffects.splice(i, 1);
      }
    }
  }

  healNearby(dt, enemies) {
    for (const e of enemies) {
      if (e === this || e.dead) continue;
      const dx = e.x - this.x;
      const dy = e.y - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= this.healRange) {
        e.hp = Math.min(e.maxHp, e.hp + this.healRate * dt);
      }
    }
  }

  takeDamage(amount, ignoreArmor = false) {
    if (this.dead) return;

    if (!ignoreArmor) {
      amount = Math.max(1, amount - this.armor);
    }

    if (this.shieldHp > 0) {
      if (amount <= this.shieldHp) {
        this.shieldHp -= amount;
        this.hitFlash = 1;
        return;
      }
      amount -= this.shieldHp;
      this.shieldHp = 0;
    }

    this.hp -= amount;
    this.hitFlash = 1;

    if (this.hp <= 0) {
      this.hp = 0;
      this.dead = true;
    }
  }

  applySlow(amount, duration) {
    const existing = this.statusEffects.find(e => e.type === 'slow');
    if (existing) {
      if (amount >= existing.amount) {
        existing.amount = amount;
        existing.duration = Math.max(existing.duration, duration);
      }
    } else {
      this.statusEffects.push({ type: 'slow', amount, duration });
    }
  }

  applyStun(duration) {
    const existing = this.statusEffects.find(e => e.type === 'stun');
    if (existing) {
      existing.duration = Math.max(existing.duration, duration);
    } else {
      this.statusEffects.push({ type: 'stun', duration });
    }
  }

  applyDot(damage, duration) {
    this.statusEffects.push({ type: 'dot', damage, duration });
  }

  distTo(x, y) {
    const dx = this.x - x;
    const dy = this.y - y;
    return Math.sqrt(dx * dx + dy * dy);
  }
};
