window.Game = window.Game || {};

Game.Resources = {
  /**
   * Add amount of resource to inventory
   * @param {string} resourceType - 'wood', 'stone', etc.
   * @param {number} amount - amount to add
   */
  add(resourceType, amount) {
    if (!Game.state.kingdom.resources[resourceType]) {
      Game.state.kingdom.resources[resourceType] = 0;
    }
    Game.state.kingdom.resources[resourceType] += amount;
  },

  /**
   * Spend resources if available
   * @param {Object} cost - e.g., { wood: 50, stone: 10 }
   * @returns {boolean} - true if spent, false if insufficient
   */
  spend(cost) {
    // Check if we have enough
    for (const [resourceType, amount] of Object.entries(cost)) {
      if (
        !Game.state.kingdom.resources[resourceType] ||
        Game.state.kingdom.resources[resourceType] < amount
      ) {
        return false;
      }
    }
    // Deduct resources
    for (const [resourceType, amount] of Object.entries(cost)) {
      Game.state.kingdom.resources[resourceType] -= amount;
    }
    return true;
  },

  /**
   * Check if we have enough resources
   * @param {Object} cost - e.g., { wood: 50 }
   * @returns {boolean}
   */
  has(cost) {
    for (const [resourceType, amount] of Object.entries(cost)) {
      if (
        !Game.state.kingdom.resources[resourceType] ||
        Game.state.kingdom.resources[resourceType] < amount
      ) {
        return false;
      }
    }
    return true;
  },

  /**
   * Get current amount of a resource
   * @param {string} resourceType
   * @returns {number}
   */
  get(resourceType) {
    return Game.state.kingdom.resources[resourceType] || 0;
  },
};
