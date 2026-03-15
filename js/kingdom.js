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
};
