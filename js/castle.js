window.Game = window.Game || {};

Game.Castle = {
  /**
   * Get current castle level
   * @returns {number}
   */
  getLevel() {
    return Game.state.kingdom.castle.level;
  },

  /**
   * Get current castle HP
   * @returns {number}
   */
  getHP() {
    return Game.state.kingdom.castle.hp;
  },

  /**
   * Get upgrade definition for current level
   * @returns {Object|null}
   */
  getCurrentUpgrade() {
    return Game.Config.CASTLE_UPGRADES.find((u) => u.level === this.getLevel());
  },

  /**
   * Get next upgrade definition
   * @returns {Object|null}
   */
  getNextUpgrade() {
    const nextLevel = this.getLevel() + 1;
    return Game.Config.CASTLE_UPGRADES.find((u) => u.level === nextLevel) || null;
  },

  /**
   * Upgrade castle to next level
   * @returns {boolean} - true if upgraded, false if insufficient resources
   */
  upgrade() {
    const next = this.getNextUpgrade();
    if (!next) return false;

    // Check if we have resources
    if (!Game.Resources.has(next.cost)) {
      return false;
    }

    // Spend resources
    Game.Resources.spend(next.cost);

    // Update castle stats
    Game.state.kingdom.castle.level = next.level;
    Game.state.kingdom.castle.hp = next.hp;
    Game.state.kingdom.castle.maxHp = next.hp;

    // Update population capacity
    const oldCapacity = Game.state.kingdom.population.capacity;
    Game.state.kingdom.population.capacity = next.popCapacity;

    // Grant new free residents
    const newResidents = next.popCapacity - oldCapacity;
    for (let i = 0; i < newResidents; i++) {
      Game.state.kingdom.population.residents.push({
        id: Math.max(...Game.state.kingdom.population.residents.map((r) => r.id || 0)) + 1,
        assignedJob: null,
        gridPos: { col: Game.Config.GRID_COLS / 2, row: Game.Config.GRID_ROWS / 2 },
        state: 'idle',
        target: null,
        progress: 0,
        hp: Game.Config.RESIDENT_HP,
        maxHp: Game.Config.RESIDENT_HP,
        path: [],
      });
    }
    Game.state.kingdom.population.current += newResidents;

    return true;
  },

  /**
   * Castle takes damage
   * @param {number} amount
   */
  takeDamage(amount) {
    Game.state.kingdom.castle.hp = Math.max(0, Game.state.kingdom.castle.hp - amount);
  },

  /**
   * Check if castle is destroyed
   * @returns {boolean}
   */
  isDestroyed() {
    return Game.state.kingdom.castle.hp <= 0;
  },

  /**
   * Get archer damage for current castle level
   * @returns {number}
   */
  getArcherDamage() {
    const upgrade = this.getCurrentUpgrade();
    return upgrade ? upgrade.archerDamage : 0;
  },

  /**
   * Get archer range for current castle level
   * @returns {number}
   */
  getArcherRange() {
    const upgrade = this.getCurrentUpgrade();
    return upgrade ? upgrade.archerRange : 0;
  },

  /**
   * Get number of archers (equals population in castle)
   * @returns {number}
   */
  getArcherCount() {
    return Game.state.kingdom.population.residents.length;
  },

  /**
   * Fire archer volley at enemies
   * @param {number} currentTime - current game time in ms
   */
  fireArchers(currentTime) {
    if (Game.state.kingdom.castle.lastArcherFireTime === 0) {
      Game.state.kingdom.castle.lastArcherFireTime = currentTime;
      return;
    }

    const timeSinceLastFire = currentTime - Game.state.kingdom.castle.lastArcherFireTime;
    if (timeSinceLastFire < Game.Config.ARCHER_FIRE_RATE) {
      return;
    }

    const archerCount = this.getArcherCount();
    const damage = this.getArcherDamage();
    const range = this.getArcherRange();

    if (!Game.state.enemies || Game.state.enemies.length === 0) {
      Game.state.kingdom.castle.lastArcherFireTime = currentTime;
      return;
    }

    for (let i = 0; i < archerCount; i++) {
      const enemy = this._findNearestEnemy(range);
      if (enemy) {
        if (Game.Projectile) {
          Game.Projectile.create({
            x: (Game.Config.GRID_COLS / 2) * Game.Config.TILE_SIZE,
            y: (Game.Config.GRID_ROWS / 2) * Game.Config.TILE_SIZE,
            targetX: enemy.x,
            targetY: enemy.y,
            damage: damage,
            speed: 400,
            sourceType: 'castle',
          });
        }
      }
    }

    Game.state.kingdom.castle.lastArcherFireTime = currentTime;
  },

  /**
   * Find nearest enemy within range
   * @private
   */
  _findNearestEnemy(range) {
    if (!Game.state.enemies || Game.state.enemies.length === 0) {
      return null;
    }

    const castleX = (Game.Config.GRID_COLS / 2) * Game.Config.TILE_SIZE;
    const castleY = (Game.Config.GRID_ROWS / 2) * Game.Config.TILE_SIZE;

    let nearest = null;
    let nearestDist = Infinity;

    for (const enemy of Game.state.enemies) {
      const dist = Math.hypot(enemy.x - castleX, enemy.y - castleY);
      if (dist < range && dist < nearestDist) {
        nearest = enemy;
        nearestDist = dist;
      }
    }

    return nearest;
  },
};
