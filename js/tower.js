window.Game = window.Game || {};

Game.Tower = class Tower {
  constructor(type, col, row) {
    const def = Game.Config.TOWERS[type];
    this.type = type;
    this.col = col;
    this.row = row;
    const ts = Game.Config.TILE_SIZE;
    this.x = col * ts + ts / 2;
    this.y = row * ts + ts / 2;

    this.level = 1;
    this.baseDamage = def.damage;
    this.baseRange = def.range;
    this.baseFireRate = def.fireRate;
    this.damage = def.damage;
    this.range = def.range;
    this.fireRate = def.fireRate;
    this.color = def.color;
    this.canHitFlying = def.canHitFlying;
    this.special = def.special;
    this.projectileSpeed = def.projectileSpeed;
    this.projectileColor = def.projectileColor;

    // HP
    this.baseHp = def.hp;
    this.maxHp = def.hp;
    this.hp = def.hp;
    this.destroyed = false;
    this.hitFlash = 0;

    this.cooldown = 0;
    this.target = null;
    this.facing = 0;
    this.targetMode = 'first'; // first, last, strongest, weakest, nearest
    this.totalInvested = def.cost;
    this.kills = 0;

    // Special properties
    this.splashRadius = def.splashRadius || 0;
    this.slowAmount = def.slowAmount || 0;
    this.slowDuration = def.slowDuration || 0;
    this.chainCount = def.chainCount || 0;
    this.chainRange = def.chainRange || 0;
    this.coneAngle = def.coneAngle || 0;
    this.dotDamage = def.dotDamage || 0;
    this.dotDuration = def.dotDuration || 0;
  }

  getUpgradeCost() {
    if (this.level >= Game.Config.MAX_TOWER_LEVEL) return Infinity;
    return Math.round(this.totalInvested * Game.Config.UPGRADE_COST_MULT);
  }

  getSellValue() {
    return Math.round(this.totalInvested * Game.Config.SELL_REFUND_RATE);
  }

  upgrade() {
    if (this.level >= Game.Config.MAX_TOWER_LEVEL) return false;
    const cost = this.getUpgradeCost();
    this.level++;
    this.totalInvested += cost;

    this.damage = this.baseDamage * Math.pow(Game.Config.UPGRADE_DAMAGE_MULT, this.level - 1);
    this.range = this.baseRange * Math.pow(Game.Config.UPGRADE_RANGE_MULT, this.level - 1);
    this.fireRate = this.baseFireRate * Math.pow(Game.Config.UPGRADE_RATE_MULT, this.level - 1);
    this.maxHp = Math.round(this.baseHp * Math.pow(Game.Config.UPGRADE_HP_MULT, this.level - 1));
    this.hp = this.maxHp;

    // Level 3 special upgrades
    if (this.level === 3) {
      this.applyL3Upgrade();
    }

    return true;
  }

  applyL3Upgrade() {
    switch (this.type) {
      case 'frost':
        this.slowAmount = 0.6;
        this.slowDuration = 3.0;
        break;
      case 'lightning':
        this.chainCount = 5;
        break;
    }
  }

  getStatsAtNextLevel() {
    if (this.level >= Game.Config.MAX_TOWER_LEVEL) return null;
    const nl = this.level + 1;
    return {
      damage: this.baseDamage * Math.pow(Game.Config.UPGRADE_DAMAGE_MULT, nl - 1),
      range: this.baseRange * Math.pow(Game.Config.UPGRADE_RANGE_MULT, nl - 1),
      fireRate: this.baseFireRate * Math.pow(Game.Config.UPGRADE_RATE_MULT, nl - 1),
      hp: Math.round(this.baseHp * Math.pow(Game.Config.UPGRADE_HP_MULT, nl - 1)),
    };
  }

  takeDamage(amount) {
    if (this.destroyed) return;
    this.hp -= amount;
    this.hitFlash = 1;
    if (this.hp <= 0) {
      this.hp = 0;
      this.destroyed = true;
    }
  }

  regenerate(dt) {
    if (this.destroyed) return;
    if (this.hp < this.maxHp) {
      this.hp = Math.min(this.maxHp, this.hp + this.maxHp * Game.Config.TOWER_REGEN_RATE * dt);
    }
  }

  update(dt, enemies, projectiles) {
    if (this.destroyed) return;
    this.cooldown -= dt;
    if (this.hitFlash > 0) this.hitFlash -= dt * 5;

    // Find target
    this.target = this.findTarget(enemies);

    if (this.target) {
      this.facing = Math.atan2(this.target.y - this.y, this.target.x - this.x);

      // Flame tower - continuous damage
      if (this.special === 'cone') {
        this.handleFlameDamage(dt, enemies);
        return;
      }

      // Fire projectile
      if (this.cooldown <= 0) {
        this.fire(projectiles);
        this.cooldown = this.fireRate;
      }
    }
  }

  findTarget(enemies) {
    const inRange = enemies.filter((e) => {
      if (e.dead || e.escaped) return false;
      if (e.flying && !this.canHitFlying) return false;
      return e.distTo(this.x, this.y) <= this.range;
    });

    if (inRange.length === 0) return null;

    switch (this.targetMode) {
      case 'first':
        return inRange.reduce((a, b) => (b.progress > a.progress ? b : a));
      case 'last':
        return inRange.reduce((a, b) => (b.progress < a.progress ? b : a));
      case 'strongest':
        return inRange.reduce((a, b) => (b.hp > a.hp ? b : a));
      case 'weakest':
        return inRange.reduce((a, b) => (b.hp < a.hp ? b : a));
      case 'nearest':
        return inRange.reduce((a, b) =>
          a.distTo(this.x, this.y) < b.distTo(this.x, this.y) ? a : b
        );
      default:
        return inRange[0];
    }
  }

  fire(projectiles) {
    if (!this.target) return;

    if (this.special === 'chain') {
      // Lightning - instant hit
      this.fireLightning(projectiles);
    } else {
      const doubleShot = this.type === 'arrow' && this.level >= 3;
      projectiles.push(new Game.Projectile(this, this.target));
      if (doubleShot) {
        // Slight offset for visual distinction
        const p2 = new Game.Projectile(this, this.target);
        p2.x += Math.cos(this.facing + Math.PI / 2) * 5;
        p2.y += Math.sin(this.facing + Math.PI / 2) * 5;
        projectiles.push(p2);
      }
    }
  }

  fireLightning(projectiles) {
    const target = this.target;
    const chainTargets = [target];

    // Deal damage to primary
    target.takeDamage(this.damage);
    if (target.dead) this.kills++;

    // Chain to nearby
    const enemies = Game.state ? Game.state.enemies : [];
    let lastTarget = target;
    for (let i = 0; i < this.chainCount; i++) {
      let nearest = null;
      let nearestDist = this.chainRange;
      for (const e of enemies) {
        if (e.dead || e.escaped || chainTargets.includes(e)) continue;
        if (e.flying && !this.canHitFlying) continue;
        const d = e.distTo(lastTarget.x, lastTarget.y);
        if (d < nearestDist) {
          nearest = e;
          nearestDist = d;
        }
      }
      if (nearest) {
        chainTargets.push(nearest);
        nearest.takeDamage(this.damage * 0.7);
        if (nearest.dead) this.kills++;
        lastTarget = nearest;
      } else break;
    }

    // Create lightning visual
    projectiles.push({
      type: 'lightning',
      targets: chainTargets.map((t) => ({ x: t.x, y: t.y })),
      sourceX: this.x,
      sourceY: this.y,
      life: 0.15,
      maxLife: 0.15,
      color: this.projectileColor,
      dead: false,
      update(dt) {
        this.life -= dt;
        if (this.life <= 0) this.dead = true;
      },
    });
  }

  handleFlameDamage(dt, enemies) {
    for (const e of enemies) {
      if (e.dead || e.escaped) continue;
      if (e.flying && !this.canHitFlying) continue;
      const dist = e.distTo(this.x, this.y);
      if (dist > this.range) continue;

      // Check if in cone
      const angle = Math.atan2(e.y - this.y, e.x - this.x);
      let angleDiff = angle - this.facing;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

      if (Math.abs(angleDiff) <= this.coneAngle / 2) {
        e.takeDamage(this.damage * dt);
        // L3: apply increasing DoT
        if (this.level >= 3 && this.dotDamage > 0) {
          e.applyDot(this.dotDamage, this.dotDuration);
        }
      }
    }
  }
};

if (typeof module !== 'undefined') module.exports = { Tower: Game.Tower };
