window.Game = window.Game || {};

Game.Projectile = class Projectile {
  constructor(tower, target) {
    this.x = tower.x;
    this.y = tower.y;
    this.targetEnemy = target;
    this.tx = target.x;
    this.ty = target.y;
    this.speed = tower.projectileSpeed;
    this.damage = tower.damage;
    this.color = tower.projectileColor;
    this.towerType = tower.type;
    this.tower = tower;
    this.dead = false;
    this.type = 'projectile';

    // Special effects from tower
    this.splash = tower.special === 'splash';
    this.splashRadius = tower.splashRadius;
    this.slowAmount = tower.slowAmount;
    this.slowDuration = tower.slowDuration;
    this.pierceArmor = tower.special === 'pierceArmor';
    this.canStun = tower.type === 'cannon' && tower.level >= 3;
    this.canCrit = tower.type === 'sniper' && tower.level >= 3;

    // Homing or ballistic
    this.homing = tower.type !== 'cannon';

    // Visual
    this.trail = [];
  }

  update(dt) {
    if (this.dead) return;

    // Update target position if homing
    if (this.homing && this.targetEnemy && !this.targetEnemy.dead && !this.targetEnemy.escaped) {
      this.tx = this.targetEnemy.x;
      this.ty = this.targetEnemy.y;
    }

    const dx = this.tx - this.x;
    const dy = this.ty - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 8) {
      this.hit();
      return;
    }

    const moveSpeed = this.speed * dt;
    if (moveSpeed >= dist) {
      this.x = this.tx;
      this.y = this.ty;
      this.hit();
    } else {
      this.x += (dx / dist) * moveSpeed;
      this.y += (dy / dist) * moveSpeed;
    }

    // Trail
    this.trail.push({ x: this.x, y: this.y, life: 0.15 });
    if (this.trail.length > 8) this.trail.shift();
  }

  hit() {
    this.dead = true;
    const enemies = Game.state ? Game.state.enemies : [];

    // Crit
    let damage = this.damage;
    let didCrit = false;
    if (this.canCrit && Math.random() < 0.25) {
      damage *= 2;
      didCrit = true;
    }

    if (this.splash) {
      // AoE damage
      for (const e of enemies) {
        if (e.dead || e.escaped) continue;
        const d = e.distTo(this.tx, this.ty);
        if (d <= this.splashRadius) {
          const falloff = 1 - (d / this.splashRadius) * 0.5;
          e.takeDamage(damage * falloff);
          if (this.canStun) e.applyStun(0.5);
          if (e.dead) this.tower.kills++;
        }
      }
      Game.Particles.explosion(this.tx, this.ty, this.splashRadius, '#FF6600');
    } else {
      // Single target
      if (this.targetEnemy && !this.targetEnemy.dead) {
        this.targetEnemy.takeDamage(damage, this.pierceArmor);
        if (this.targetEnemy.dead) this.tower.kills++;

        // Slow
        if (this.slowAmount > 0) {
          this.targetEnemy.applySlow(this.slowAmount, this.slowDuration);
        }
      }
    }

    // Hit particles
    Game.Particles.spawn(this.tx, this.ty, 3, this.color, {
      speed: 50, life: 0.2, size: 2,
    });

    if (didCrit) {
      Game.Particles.spawn(this.tx, this.ty, 6, '#FF0000', {
        speed: 80, life: 0.3, size: 3,
      });
    }
  }
};
