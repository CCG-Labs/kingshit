window.Game = window.Game || {};

Game.Kingdom = {
  /**
   * Get total population (all residents)
   * @returns {number}
   */
  getPopulation() {
    return Game.state.kingdom.population.residents.length;
  },

  /**
   * Get population capacity
   * @returns {number}
   */
  getCapacity() {
    return Game.state.kingdom.population.capacity;
  },

  /**
   * Get count of free (unassigned) residents
   * @returns {number}
   */
  getFreeResidents() {
    return Game.state.kingdom.population.residents.filter(
      (r) => !r.assignedJob && r.state !== 'dead'
    ).length;
  },

  /**
   * Get count of residents assigned to a job
   * @param {string} jobType
   * @returns {number}
   */
  getJobCount(jobType) {
    return Game.state.kingdom.population.jobs[jobType] || 0;
  },

  /**
   * Assign a resident to a job
   * @param {number} residentId
   * @param {string} jobType
   * @returns {boolean}
   */
  assignJob(residentId, jobType) {
    const resident = this.getResident(residentId);
    if (!resident || resident.assignedJob) {
      return false;
    }
    resident.assignedJob = jobType;
    resident.state = 'idle';
    if (!Game.state.kingdom.population.jobs[jobType]) {
      Game.state.kingdom.population.jobs[jobType] = 0;
    }
    Game.state.kingdom.population.jobs[jobType]++;
    return true;
  },

  /**
   * Unassign a resident from their job
   * @param {number} residentId
   * @returns {boolean}
   */
  unassignJob(residentId) {
    const resident = this.getResident(residentId);
    if (!resident || !resident.assignedJob) {
      return false;
    }
    const jobType = resident.assignedJob;
    resident.assignedJob = null;
    resident.state = 'idle';
    if (Game.state.kingdom.population.jobs[jobType]) {
      Game.state.kingdom.population.jobs[jobType]--;
    }
    return true;
  },

  /**
   * Get resident by ID
   * @param {number} id
   * @returns {Object|null}
   */
  getResident(id) {
    return Game.state.kingdom.population.residents.find((r) => r.id === id) || null;
  },

  /**
   * Kill a resident (remove from active workforce)
   * @param {number} residentId
   */
  killResident(residentId) {
    const resident = this.getResident(residentId);
    if (!resident) return;
    resident.state = 'dead';
    resident.hp = 0;
    // Unassign from job
    if (resident.assignedJob) {
      this.unassignJob(residentId);
    }
  },

  /**
   * Get all active residents (not dead)
   * @returns {Array}
   */
  getActiveResidents() {
    return Game.state.kingdom.population.residents.filter((r) => r.state !== 'dead');
  },

  /**
   * Update a single resident's state machine (called once per game frame)
   * @param {number} residentId
   * @param {number} deltaTime - elapsed time in seconds since last frame
   */
  updateResident(residentId, deltaTime) {
    const resident = this.getResident(residentId);
    if (!resident || resident.state === 'dead') {
      return;
    }

    // If enemy is nearby and not already fleeing, switch to fleeing
    if (resident.state !== 'fleeing' && this._isEnemyNearby(resident)) {
      resident.state = 'fleeing';
      resident.target = Game.Map
        ? { col: Game.Config.GRID_COLS / 2, row: Game.Config.GRID_ROWS / 2 }
        : null;
      return;
    }

    // If fleeing, keep moving toward castle
    if (resident.state === 'fleeing') {
      this._moveResidentTowardTarget(resident, deltaTime);
      // Check if reached castle
      if (this._isAtCastle(resident)) {
        resident.state = 'idle';
        resident.target = null;
      }
      return;
    }

    // If no job assigned, stay idle
    if (!resident.assignedJob) {
      resident.state = 'idle';
      return;
    }

    // Job-specific behavior
    if (resident.assignedJob === 'lumberjack') {
      this._updateLumberjack(resident, deltaTime);
    }
  },

  /**
   * Update lumberjack resident behavior
   * @private
   */
  _updateLumberjack(resident, deltaTime) {
    const WORK_TIME = Game.Config.LUMBERJACK_WORK_TIME / 1000;
    const SEEK_TIMEOUT = Game.Config.SEEK_TIMEOUT / 1000;

    switch (resident.state) {
      case 'idle': {
        // Find nearest unharvested tree
        const tree = this._findNearestTree();
        if (tree) {
          resident.target = { col: tree.col, row: tree.row };
          resident.state = 'moving';
          resident.seekStartTime = Date.now() / 1000;
        } else {
          if (!resident.seekStartTime) {
            resident.seekStartTime = Date.now() / 1000;
          } else if (Date.now() / 1000 - resident.seekStartTime > SEEK_TIMEOUT) {
            resident.seekStartTime = null;
          }
        }
        break;
      }

      case 'moving': {
        this._moveResidentTowardTarget(resident, deltaTime);
        if (resident.target && this._isAtGridPos(resident, resident.target)) {
          resident.state = 'working';
          resident.progress = 0;
        }
        break;
      }

      case 'working': {
        resident.progress += deltaTime / WORK_TIME;
        if (resident.progress >= 1.0) {
          Game.Resources.add(
            Game.Config.JOBS.lumberjack.resourceType,
            Game.Config.LUMBERJACK_RESOURCE_GAIN
          );
          const tree = this._findTreeAt(resident.target);
          if (tree) tree.harvested = true;
          resident.state = 'returning';
          resident.progress = 0;
          resident.target = { col: Game.Config.GRID_COLS / 2, row: Game.Config.GRID_ROWS / 2 };
        }
        break;
      }

      case 'returning': {
        this._moveResidentTowardTarget(resident, deltaTime);
        if (this._isAtCastle(resident)) {
          resident.state = 'idle';
          resident.target = null;
          resident.progress = 0;
        }
        break;
      }
    }
  },

  /**
   * Check if resident is near castle (within 2 tiles)
   * @private
   */
  _isAtCastle(resident) {
    const castleCol = Game.Config.GRID_COLS / 2;
    const castleRow = Game.Config.GRID_ROWS / 2;
    return (
      Math.abs(resident.gridPos.col - castleCol) <= 2 &&
      Math.abs(resident.gridPos.row - castleRow) <= 2
    );
  },

  /**
   * Check if resident is at a grid position (within 1 tile)
   * @private
   */
  _isAtGridPos(resident, target) {
    return (
      Math.abs(resident.gridPos.col - target.col) <= 1 &&
      Math.abs(resident.gridPos.row - target.row) <= 1
    );
  },

  /**
   * Check if any enemy is within threat range of resident
   * @private
   */
  _isEnemyNearby(resident) {
    if (!Game.state.enemies || Game.state.enemies.length === 0) {
      return false;
    }
    const THREAT_RANGE = Game.Config.RESIDENT_THREAT_RANGE;
    const residentScreenPos = Game.Renderer
      ? Game.Renderer.worldToScreen(
          resident.gridPos.col * Game.Config.TILE_SIZE,
          resident.gridPos.row * Game.Config.TILE_SIZE
        )
      : null;
    if (!residentScreenPos) return false;

    for (const enemy of Game.state.enemies) {
      const enemyScreenPos = Game.Renderer ? Game.Renderer.worldToScreen(enemy.x, enemy.y) : null;
      if (!enemyScreenPos) continue;
      const dist = Math.hypot(
        residentScreenPos.x - enemyScreenPos.x,
        residentScreenPos.y - enemyScreenPos.y
      );
      if (dist < THREAT_RANGE) {
        return true;
      }
    }
    return false;
  },

  /**
   * Move resident toward target, using simple pathfinding
   * @private
   */
  _moveResidentTowardTarget(resident, deltaTime) {
    if (!resident.target) return;
    const speed = Game.Config.RESIDENT_SPEED / Game.Config.TILE_SIZE;
    const distance = Math.hypot(
      resident.gridPos.col - resident.target.col,
      resident.gridPos.row - resident.target.row
    );
    if (distance < 0.1) return;

    const moveSpeed = Math.min(distance, speed * deltaTime);
    const ratio = moveSpeed / distance;
    resident.gridPos.col += (resident.target.col - resident.gridPos.col) * ratio;
    resident.gridPos.row += (resident.target.row - resident.gridPos.row) * ratio;
  },

  /**
   * Find nearest unharvested tree
   * @private
   * @returns {Object|null}
   */
  _findNearestTree() {
    if (!Game.state.kingdom.trees || Game.state.kingdom.trees.length === 0) {
      return null;
    }
    return Game.state.kingdom.trees.find((t) => !t.harvested) || null;
  },

  /**
   * Find tree at specific grid position
   * @private
   */
  _findTreeAt(gridPos) {
    if (!Game.state.kingdom.trees) return null;
    return (
      Game.state.kingdom.trees.find((t) => t.col === gridPos.col && t.row === gridPos.row) || null
    );
  },
};
