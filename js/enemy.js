window.Game = window.Game || {};

Game.Enemy = class Enemy {
  constructor(type, pathIndex, waveNum) {
    const def = Game.Config.ENEMIES[type];
    const scaling = Math.pow(Game.Config.WAVE_HP_SCALING, waveNum - 1);
    const goldScaling = Math.pow(Game.Config.WAVE_GOLD_SCALING, waveNum - 1);

    this.type = type;
    this.maxHp = Math.round(def.hp * scaling);
    this.hp = this.maxHp;
    this.speed = def.speed;
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

    // Path following
    this.pathIndex = pathIndex || 0;
    this.path = null; // set by spawner
    this.waypointIndex = 0;
    this.x = 0;
    this.y = 0;
    this.progress = 0; // 0-1 along total path

    // Status effects
    this.statusEffects = [];
    this.stunned = false;

    // For flying enemies - direct path
    this.flyStart = null;
    this.flyEnd = null;
    this.flyProgress = 0;

    // Visual
    this.hitFlash = 0;
    this.facing = 0;
  }

  setPath(path) {
    this.path = path;
    if (this.flying) {
      this.flyStart = { x: path[0].x, y: path[0].y };
      this.flyEnd = { x: path[path.length - 1].x, y: path[path.length - 1].y };
      this.x = this.flyStart.x;
      this.y = this.flyStart.y;
      this.flyProgress = 0;
      const dx = this.flyEnd.x - this.flyStart.x;
      const dy = this.flyEnd.y - this.flyStart.y;
      this.flyDist = Math.sqrt(dx * dx + dy * dy);
    } else {
      this.x = path[0].x;
      this.y = path[0].y;
      this.waypointIndex = 1;
    }
  }

  update(dt, enemies) {
    // Update status effects
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
    const moveAmount = (speed / this.flyDist) * dt;
    this.flyProgress += moveAmount;
    this.progress = this.flyProgress;

    if (this.flyProgress >= 1) {
      this.escaped = true;
      return;
    }

    this.x = this.flyStart.x + (this.flyEnd.x - this.flyStart.x) * this.flyProgress;
    this.y = this.flyStart.y + (this.flyEnd.y - this.flyStart.y) * this.flyProgress;
    this.facing = Math.atan2(this.flyEnd.y - this.flyStart.y, this.flyEnd.x - this.flyStart.x);
  }

  updateGroundMovement(dt, speed) {
    if (this.waypointIndex >= this.path.length) {
      this.escaped = true;
      return;
    }

    const target = this.path[this.waypointIndex];
    const dx = target.x - this.x;
    const dy = target.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    this.facing = Math.atan2(dy, dx);

    if (dist < speed * dt) {
      this.x = target.x;
      this.y = target.y;
      this.waypointIndex++;
    } else {
      this.x += (dx / dist) * speed * dt;
      this.y += (dy / dist) * speed * dt;
    }

    // Calculate progress along path
    this.progress = (this.waypointIndex - 1 + (1 - dist / this.getSegmentLength())) / (this.path.length - 1);
    this.progress = Math.max(0, Math.min(1, this.progress));
  }

  getSegmentLength() {
    if (this.waypointIndex <= 0 || this.waypointIndex >= this.path.length) return 1;
    const a = this.path[this.waypointIndex - 1];
    const b = this.path[this.waypointIndex];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    return Math.sqrt(dx * dx + dy * dy) || 1;
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

    // Shield absorbs damage first
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
    // Replace existing slow if stronger
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
