# Kingdom-Building System Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a kingdom-building subsystem with population management, resource gathering via lumberjacks, castle upgrades, and archer defense.

**Architecture:** Three new modules (`kingdom.js`, `castle.js`, `resources.js`) manage population, jobs, resources, and castle state. The castle becomes a defensive asset with archer firepower scaling with population. Residents are active entities on the map that gather wood from trees, flee enemies, and can be killed. Game loop integration via `main.js`, rendering via `renderer.js`, UI via `ui.js`.

**Tech Stack:** Vanilla JS (no build tools), canvas rendering, BFS pathfinding (reusing existing `Game.Map` functions), configurable via `config.js`.

---

## File Structure

### New Files
- `js/kingdom.js` — Population tracking, resident entity lifecycle, job assignment
- `js/castle.js` — Castle levels, upgrades, HP, archer mechanics
- `js/resources.js` — Resource inventory (wood, stone, etc.)
- `tests/kingdom.test.js` — Tests for population and resident behavior
- `tests/castle.test.js` — Tests for castle upgrades and archer mechanics
- `tests/resources.test.js` — Tests for resource inventory

### Modified Files
- `js/config.js` — Add all kingdom-related constants (timings, costs, job definitions)
- `js/main.js` — Initialize kingdom/castle/resources state, integrate into game loop, handle wave timing
- `js/renderer.js` — Draw residents, trees, archer visuals
- `js/ui.js` — Add top bar HUD (resources, population, castle info), population management panel
- `index.html` — Load new scripts in correct order

---

## Chunk 1: Configuration & State Initialization

### Task 1: Add Kingdom Configuration to config.js

**Files:**
- Modify: `js/config.js` (add new config block)

- [ ] **Step 1: Open config.js and locate the end of existing config**

Check the file to understand current structure.

- [ ] **Step 2: Add kingdom configuration constants**

After the existing config, add:

```javascript
// === KINGDOM-BUILDING (Phase 1) ===

// Population & Residents
Game.Config.RESIDENT_HP = 10;
Game.Config.RESIDENT_COMBAT_DMG = 5;
Game.Config.RESIDENT_THREAT_RANGE = 250;  // pixels; flee if enemy within this
Game.Config.RESIDENT_SPEED = 80;           // pixels/sec

// Lumberjack Job
Game.Config.LUMBERJACK_WORK_TIME = 15000;  // ms to chop one tree
Game.Config.LUMBERJACK_RESOURCE_GAIN = 10; // wood per tree
Game.Config.SEEK_TIMEOUT = 30000;          // ms; if no tree found, give up

// Tree Spawning
Game.Config.TREE_SPAWN_INTERVAL = 60000;   // 1 tree per minute
Game.Config.TREE_SPAWN_REJECTION_SAMPLES = 10; // rejection sampling attempts

// Castle & Archers
Game.Config.ARCHER_FIRE_RATE = 5000;  // ms between archer volleys

// Wave Timing
Game.Config.AUTO_WAVE_DELAY = 45000;  // ms before auto-starting next wave

// Job Definitions
Game.Config.JOBS = {
  lumberjack: {
    name: 'Lumberjack',
    description: 'Gathers wood from trees',
    resourceType: 'wood',
    resourcePerCompletion: Game.Config.LUMBERJACK_RESOURCE_GAIN,
    workTime: Game.Config.LUMBERJACK_WORK_TIME,
    seekTimeout: Game.Config.SEEK_TIMEOUT,
    speed: Game.Config.RESIDENT_SPEED
  }
};

// Castle Upgrade Definitions (Phase 1: levels 1-3 only)
Game.Config.CASTLE_UPGRADES = [
  {
    level: 1,
    name: 'Stockade',
    description: 'A simple perimeter of sharpened wooden stakes.',
    popCapacity: 5,
    hp: 500,
    archerDamage: 10,
    archerRange: 300,
    cost: {}  // Starting level, no cost
  },
  {
    level: 2,
    name: 'Palisade',
    description: 'Taller, more deliberate wooden wall construction.',
    popCapacity: 8,
    hp: 700,
    archerDamage: 12,
    archerRange: 320,
    cost: { wood: 100 }
  },
  {
    level: 3,
    name: 'Motte',
    description: 'An earthen mound with a timber tower on top.',
    popCapacity: 12,
    hp: 950,
    archerDamage: 15,
    archerRange: 350,
    cost: { wood: 150 }
  }
];
```

- [ ] **Step 3: Verify no syntax errors**

Open `index.html` in browser, check console for errors.

- [ ] **Step 4: Commit**

```bash
git add js/config.js
git commit -m "config: add kingdom-building constants and job definitions"
```

---

### Task 2: Initialize Kingdom State in main.js

**Files:**
- Modify: `js/main.js` (startMap function)

- [ ] **Step 1: Locate startMap() in main.js**

Find the function around line 50.

- [ ] **Step 2: Add kingdom state initialization**

After `Game.state = { ... }` block and before `Game.Particles.clear()`, add:

```javascript
    // Kingdom-building state
    kingdom: {
      resources: {
        wood: 0
        // stone: 0 (Phase 2)
      },
      population: {
        current: 5,      // free residents
        capacity: 5,     // max population
        residents: [],   // array of resident objects
        jobs: {
          lumberjack: 0  // count of residents assigned to lumberjack
        }
      },
      castle: {
        level: 1,
        hp: 500,
        maxHp: 500,
        lastArcherFireTime: 0  // for 5-second archer cooldown
      },
      waves: {
        lastWaveEndTime: 0,
        autoStartDelay: Game.Config.AUTO_WAVE_DELAY,
        canStartWaveManually: true
      },
      nextTreeSpawnTime: Game.Config.TREE_SPAWN_INTERVAL,
      trees: []  // array of tree objects on map
    }
```

- [ ] **Step 3: Add kingdom initialization after state creation**

After `Game.state` is created, call:

```javascript
    // Initialize kingdom with 5 free residents
    for (let i = 0; i < 5; i++) {
      Game.state.kingdom.population.residents.push({
        id: i,
        assignedJob: null,
        gridPos: { col: Game.Config.GRID_COLS / 2, row: Game.Config.GRID_ROWS / 2 },
        state: 'idle',
        target: null,
        progress: 0,
        hp: Game.Config.RESIDENT_HP,
        maxHp: Game.Config.RESIDENT_HP,
        path: []
      });
    }
```

- [ ] **Step 4: Commit**

```bash
git add js/main.js
git commit -m "feat: initialize kingdom state in startMap()"
```

---

## Chunk 2: Resources Module

### Task 3: Create resources.js

**Files:**
- Create: `js/resources.js`
- Test: `tests/resources.test.js`

- [ ] **Step 1: Write failing test for resource inventory**

Create `tests/resources.test.js`:

```javascript
import { describe, it, expect, beforeEach } from 'vitest';

// Mock Game.state for testing
let mockState;

beforeEach(() => {
  mockState = {
    kingdom: {
      resources: { wood: 0 }
    }
  };
  global.Game = {
    state: mockState
  };
});

describe('Game.Resources', () => {
  it('adds wood to inventory', () => {
    Game.Resources.add('wood', 10);
    expect(Game.state.kingdom.resources.wood).toBe(10);
  });

  it('adds to existing wood', () => {
    Game.state.kingdom.resources.wood = 5;
    Game.Resources.add('wood', 15);
    expect(Game.state.kingdom.resources.wood).toBe(20);
  });

  it('spends wood if available', () => {
    Game.state.kingdom.resources.wood = 100;
    const success = Game.Resources.spend({ wood: 30 });
    expect(success).toBe(true);
    expect(Game.state.kingdom.resources.wood).toBe(70);
  });

  it('fails to spend if insufficient resources', () => {
    Game.state.kingdom.resources.wood = 10;
    const success = Game.Resources.spend({ wood: 30 });
    expect(success).toBe(false);
    expect(Game.state.kingdom.resources.wood).toBe(10);  // unchanged
  });

  it('checks if has resources', () => {
    Game.state.kingdom.resources.wood = 50;
    expect(Game.Resources.has({ wood: 30 })).toBe(true);
    expect(Game.Resources.has({ wood: 60 })).toBe(false);
  });

  it('gets current resource amount', () => {
    Game.state.kingdom.resources.wood = 42;
    expect(Game.Resources.get('wood')).toBe(42);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test tests/resources.test.js
```

Expected output: All tests FAIL (Game.Resources not defined).

- [ ] **Step 3: Implement resources.js**

Create `js/resources.js`:

```javascript
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
      if (!Game.state.kingdom.resources[resourceType] ||
          Game.state.kingdom.resources[resourceType] < amount) {
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
      if (!Game.state.kingdom.resources[resourceType] ||
          Game.state.kingdom.resources[resourceType] < amount) {
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
  }
};
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test tests/resources.test.js
```

Expected: All tests PASS.

- [ ] **Step 5: Update index.html script load order**

Add to `<head>` in `index.html` after `config.js`:

```html
<script src="js/resources.js"></script>
```

Insert in order: `config.js`, `resources.js`, `input.js`, etc. (resources should load early since castle/kingdom depend on it).

- [ ] **Step 6: Commit**

```bash
git add js/resources.js tests/resources.test.js index.html
git commit -m "feat: implement resources module with add/spend/has methods"
```

---

## Chunk 3: Castle Module

### Task 4: Create castle.js with upgrade mechanics

**Files:**
- Create: `js/castle.js`
- Test: `tests/castle.test.js`

- [ ] **Step 1: Write failing tests for castle upgrades**

Create `tests/castle.test.js`:

```javascript
import { describe, it, expect, beforeEach } from 'vitest';

let mockState;

beforeEach(() => {
  mockState = {
    kingdom: {
      resources: { wood: 500 },
      population: { capacity: 5, current: 5, residents: Array(5).fill(null) },
      castle: { level: 1, hp: 500, maxHp: 500, lastArcherFireTime: 0 }
    }
  };
  global.Game = {
    state: mockState,
    Config: {
      CASTLE_UPGRADES: [
        { level: 1, popCapacity: 5, hp: 500, cost: {} },
        { level: 2, popCapacity: 8, hp: 700, cost: { wood: 100 } },
        { level: 3, popCapacity: 12, hp: 950, cost: { wood: 150 } }
      ],
      RESIDENT_HP: 10
    },
    Resources: {
      has: (cost) => Game.state.kingdom.resources.wood >= (cost.wood || 0),
      spend: (cost) => {
        if (Game.state.kingdom.resources.wood >= cost.wood) {
          Game.state.kingdom.resources.wood -= cost.wood;
          return true;
        }
        return false;
      }
    }
  };
});

describe('Game.Castle', () => {
  it('gets current castle level', () => {
    expect(Game.Castle.getLevel()).toBe(1);
  });

  it('gets castle HP', () => {
    expect(Game.Castle.getHP()).toBe(500);
  });

  it('gets next upgrade info', () => {
    const next = Game.Castle.getNextUpgrade();
    expect(next.level).toBe(2);
    expect(next.cost.wood).toBe(100);
  });

  it('upgrades castle if resources available', () => {
    Game.state.kingdom.resources.wood = 100;
    const success = Game.Castle.upgrade();
    expect(success).toBe(true);
    expect(Game.state.kingdom.castle.level).toBe(2);
    expect(Game.state.kingdom.castle.hp).toBe(700);
    expect(Game.state.kingdom.castle.maxHp).toBe(700);
    expect(Game.state.kingdom.population.capacity).toBe(8);
    expect(Game.state.kingdom.resources.wood).toBe(0);
  });

  it('grants new residents on upgrade', () => {
    Game.state.kingdom.resources.wood = 100;
    Game.state.kingdom.population.residents = Array(5).fill({ id: 0 });
    Game.Castle.upgrade();
    expect(Game.state.kingdom.population.residents.length).toBe(8);
  });

  it('fails to upgrade if insufficient resources', () => {
    Game.state.kingdom.resources.wood = 50;
    const success = Game.Castle.upgrade();
    expect(success).toBe(false);
    expect(Game.state.kingdom.castle.level).toBe(1);
  });

  it('takes damage', () => {
    Game.Castle.takeDamage(100);
    expect(Game.state.kingdom.castle.hp).toBe(400);
  });

  it('dies at 0 HP', () => {
    Game.Castle.takeDamage(500);
    expect(Game.state.kingdom.castle.hp).toBe(0);
  });

  it('gets archer damage for current level', () => {
    const dmg = Game.Castle.getArcherDamage();
    expect(dmg).toBe(10);
  });

  it('gets archer range for current level', () => {
    const range = Game.Castle.getArcherRange();
    expect(range).toBe(300);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test tests/castle.test.js
```

Expected: All tests FAIL (Game.Castle not defined).

- [ ] **Step 3: Implement castle.js**

Create `js/castle.js`:

```javascript
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
    return Game.Config.CASTLE_UPGRADES.find(u => u.level === this.getLevel());
  },

  /**
   * Get next upgrade definition
   * @returns {Object|null}
   */
  getNextUpgrade() {
    const nextLevel = this.getLevel() + 1;
    return Game.Config.CASTLE_UPGRADES.find(u => u.level === nextLevel) || null;
  },

  /**
   * Upgrade castle to next level
   * @returns {boolean} - true if upgraded, false if insufficient resources
   */
  upgrade() {
    const next = this.getNextUpgrade();
    if (!next) return false;  // Already at max level or no next level defined

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
        id: Math.max(...Game.state.kingdom.population.residents.map(r => r.id || 0)) + 1,
        assignedJob: null,
        gridPos: { col: Game.Config.GRID_COLS / 2, row: Game.Config.GRID_ROWS / 2 },
        state: 'idle',
        target: null,
        progress: 0,
        hp: Game.Config.RESIDENT_HP,
        maxHp: Game.Config.RESIDENT_HP,
        path: []
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
  }
};
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test tests/castle.test.js
```

Expected: All tests PASS.

- [ ] **Step 5: Add to index.html**

Add `<script src="js/castle.js"></script>` after `resources.js` in `index.html`.

- [ ] **Step 6: Commit**

```bash
git add js/castle.js tests/castle.test.js index.html
git commit -m "feat: implement castle module with upgrade mechanics and archer stats"
```

---

## Chunk 4: Kingdom Module (Residents & Jobs)

### Task 5: Create kingdom.js with resident lifecycle

**Files:**
- Create: `js/kingdom.js`
- Test: `tests/kingdom.test.js`

- [ ] **Step 1: Write failing tests for population and residents**

Create `tests/kingdom.test.js`:

```javascript
import { describe, it, expect, beforeEach } from 'vitest';

let mockState;

beforeEach(() => {
  mockState = {
    kingdom: {
      population: {
        current: 5,
        capacity: 5,
        residents: [
          { id: 0, assignedJob: null, state: 'idle', hp: 10 },
          { id: 1, assignedJob: null, state: 'idle', hp: 10 },
          { id: 2, assignedJob: null, state: 'idle', hp: 10 },
          { id: 3, assignedJob: null, state: 'idle', hp: 10 },
          { id: 4, assignedJob: null, state: 'idle', hp: 10 }
        ],
        jobs: { lumberjack: 0 }
      },
      resources: { wood: 0 },
      trees: []
    }
  };
  global.Game = {
    state: mockState,
    Config: {
      JOBS: {
        lumberjack: { name: 'Lumberjack', resourceType: 'wood' }
      }
    }
  };
});

describe('Game.Kingdom', () => {
  it('gets current population count', () => {
    expect(Game.Kingdom.getPopulation()).toBe(5);
  });

  it('gets population capacity', () => {
    expect(Game.Kingdom.getCapacity()).toBe(5);
  });

  it('gets free resident count', () => {
    Game.state.kingdom.population.residents[0].assignedJob = 'lumberjack';
    expect(Game.Kingdom.getFreeResidents()).toBe(4);
  });

  it('assigns resident to job', () => {
    const success = Game.Kingdom.assignJob(0, 'lumberjack');
    expect(success).toBe(true);
    expect(Game.state.kingdom.population.residents[0].assignedJob).toBe('lumberjack');
    expect(Game.state.kingdom.population.jobs.lumberjack).toBe(1);
  });

  it('fails to assign if resident already has job', () => {
    Game.state.kingdom.population.residents[0].assignedJob = 'lumberjack';
    const success = Game.Kingdom.assignJob(0, 'lumberjack');
    expect(success).toBe(false);
  });

  it('unassigns resident from job', () => {
    Game.state.kingdom.population.residents[0].assignedJob = 'lumberjack';
    Game.state.kingdom.population.jobs.lumberjack = 1;
    const success = Game.Kingdom.unassignJob(0);
    expect(success).toBe(true);
    expect(Game.state.kingdom.population.residents[0].assignedJob).toBeNull();
    expect(Game.state.kingdom.population.jobs.lumberjack).toBe(0);
  });

  it('kills resident', () => {
    const resident = Game.state.kingdom.population.residents[0];
    Game.Kingdom.killResident(0);
    expect(resident.state).toBe('dead');
  });

  it('gets resident by id', () => {
    const resident = Game.Kingdom.getResident(2);
    expect(resident.id).toBe(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test tests/kingdom.test.js
```

Expected: All tests FAIL.

- [ ] **Step 3: Implement kingdom.js**

Create `js/kingdom.js`:

```javascript
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
    return Game.state.kingdom.population.residents.filter(r => !r.assignedJob && r.state !== 'dead').length;
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
    return Game.state.kingdom.population.residents.find(r => r.id === id) || null;
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
    return Game.state.kingdom.population.residents.filter(r => r.state !== 'dead');
  }
};
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test tests/kingdom.test.js
```

Expected: All tests PASS.

- [ ] **Step 5: Add to index.html**

Add `<script src="js/kingdom.js"></script>` after `castle.js`.

- [ ] **Step 6: Commit**

```bash
git add js/kingdom.js tests/kingdom.test.js index.html
git commit -m "feat: implement kingdom module with population and job management"
```

---

## Chunk 5: Resident Behavior (Lumberjack AI)

### Task 6: Implement resident state machine and lumberjack gathering

**Files:**
- Modify: `js/kingdom.js` (add resident update logic)
- Test: `tests/kingdom.test.js` (add behavior tests)

- [ ] **Step 1: Add resident behavior tests**

Add to `tests/kingdom.test.js`:

```javascript
  it('resident seeks tree when assigned to lumberjack', () => {
    Game.state.kingdom.trees = [
      { col: 10, row: 10, harvested: false },
      { col: 20, row: 20, harvested: false }
    ];
    Game.state.kingdom.population.residents[0].gridPos = { col: 0, row: 0 };
    Game.Kingdom.assignJob(0, 'lumberjack');
    Game.Kingdom.updateResident(0, 0);  // time step
    const resident = Game.state.kingdom.population.residents[0];
    expect(resident.state).toBe('moving');
    expect(resident.target).not.toBeNull();
  });

  it('resident transitions to working when at tree', () => {
    const tree = { col: 5, row: 5, harvested: false };
    Game.state.kingdom.trees = [tree];
    const resident = Game.state.kingdom.population.residents[0];
    resident.gridPos = { col: 5, row: 5 };
    resident.state = 'moving';
    resident.target = { col: 5, row: 5 };
    resident.assignedJob = 'lumberjack';
    Game.Kingdom.updateResident(0, 0);
    expect(resident.state).toBe('working');
  });
```

- [ ] **Step 2: Extend kingdom.js with resident update logic**

Add to `js/kingdom.js` after existing methods:

```javascript
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
      resident.target = Game.Map ? { col: Game.Config.GRID_COLS / 2, row: Game.Config.GRID_ROWS / 2 } : null;
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
    const WORK_TIME = Game.Config.LUMBERJACK_WORK_TIME / 1000;  // convert to seconds
    const SEEK_TIMEOUT = Game.Config.SEEK_TIMEOUT / 1000;

    switch (resident.state) {
      case 'idle':
        // Find nearest unharvested tree
        const tree = this._findNearestTree();
        if (tree) {
          resident.target = { col: tree.col, row: tree.row };
          resident.state = 'moving';
          resident.seekStartTime = Date.now() / 1000;
        } else {
          // No tree found, try again next frame
          if (!resident.seekStartTime) {
            resident.seekStartTime = Date.now() / 1000;
          } else if ((Date.now() / 1000) - resident.seekStartTime > SEEK_TIMEOUT) {
            // Seek timeout, reset
            resident.seekStartTime = null;
          }
        }
        break;

      case 'moving':
        // Move toward target tree
        this._moveResidentTowardTarget(resident, deltaTime);
        // Check if at tree
        if (resident.target && this._isAtGridPos(resident, resident.target)) {
          resident.state = 'working';
          resident.progress = 0;
        }
        break;

      case 'working':
        // Chop tree
        resident.progress += deltaTime / WORK_TIME;
        if (resident.progress >= 1.0) {
          // Tree chopped, get resources
          Game.Resources.add(Game.Config.JOBS.lumberjack.resourceType,
                           Game.Config.LUMBERJACK_RESOURCE_GAIN);
          // Mark tree as harvested
          const tree = this._findTreeAt(resident.target);
          if (tree) tree.harvested = true;
          // Move to returning
          resident.state = 'returning';
          resident.progress = 0;
          resident.target = { col: Game.Config.GRID_COLS / 2, row: Game.Config.GRID_ROWS / 2 };
        }
        break;

      case 'returning':
        // Move back to castle
        this._moveResidentTowardTarget(resident, deltaTime);
        // Check if at castle
        if (this._isAtCastle(resident)) {
          resident.state = 'idle';
          resident.target = null;
          resident.progress = 0;
          // Loop back to seeking
        }
        break;
    }
  },

  /**
   * Check if resident is near castle (within 2 tiles)
   * @private
   */
  _isAtCastle(resident) {
    const castleCol = Game.Config.GRID_COLS / 2;
    const castleRow = Game.Config.GRID_ROWS / 2;
    return Math.abs(resident.gridPos.col - castleCol) <= 2 &&
           Math.abs(resident.gridPos.row - castleRow) <= 2;
  },

  /**
   * Check if resident is at a grid position (within 1 tile)
   * @private
   */
  _isAtGridPos(resident, target) {
    return Math.abs(resident.gridPos.col - target.col) <= 1 &&
           Math.abs(resident.gridPos.row - target.row) <= 1;
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
    const residentScreenPos = Game.Renderer ? Game.Renderer.worldToScreen(resident.gridPos.col * Game.Config.TILE_SIZE, resident.gridPos.row * Game.Config.TILE_SIZE) : null;
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
    const speed = Game.Config.RESIDENT_SPEED / Game.Config.TILE_SIZE;  // tiles per second
    const distance = Math.hypot(
      resident.gridPos.col - resident.target.col,
      resident.gridPos.row - resident.target.row
    );
    if (distance < 0.1) return;  // Already there

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
    // Find first unharvested tree (simplified; could use distance sorting)
    return Game.state.kingdom.trees.find(t => !t.harvested) || null;
  },

  /**
   * Find tree at specific grid position
   * @private
   */
  _findTreeAt(gridPos) {
    if (!Game.state.kingdom.trees) return null;
    return Game.state.kingdom.trees.find(t => t.col === gridPos.col && t.row === gridPos.row) || null;
  }
};
```

- [ ] **Step 3: Run tests to verify they pass**

```bash
npm test tests/kingdom.test.js
```

Expected: New tests PASS (basic behavior verified).

- [ ] **Step 4: Add resident update loop to main.js game loop**

In `main.js` loop() function, after tower/enemy/projectile updates, add:

```javascript
    // Update residents
    if (Game.Kingdom && Game.state.kingdom) {
      const activeResidents = Game.Kingdom.getActiveResidents();
      for (const resident of activeResidents) {
        Game.Kingdom.updateResident(resident.id, dt);
      }
    }
```

- [ ] **Step 5: Commit**

```bash
git add js/kingdom.js js/main.js tests/kingdom.test.js
git commit -m "feat: implement resident state machine and lumberjack gathering"
```

---

## Chunk 6: Tree Spawning & Game Loop Integration

### Task 7: Implement tree spawning system

**Files:**
- Modify: `js/main.js` (add tree spawn logic)
- Modify: `js/kingdom.js` (add tree helper methods)

- [ ] **Step 1: Add tree spawning method to kingdom.js**

Add to `js/kingdom.js`:

```javascript
  /**
   * Spawn a new tree if timer allows
   * @param {number} deltaTime - elapsed time in seconds
   */
  spawnTree(deltaTime) {
    if (!Game.state.kingdom) return;

    Game.state.kingdom.nextTreeSpawnTime -= deltaTime;
    if (Game.state.kingdom.nextTreeSpawnTime <= 0) {
      const tree = this._spawnTreeAtRandomLocation();
      if (tree) {
        Game.state.kingdom.trees.push(tree);
      }
      Game.state.kingdom.nextTreeSpawnTime = Game.Config.TREE_SPAWN_INTERVAL / 1000;
    }
  },

  /**
   * Spawn a tree at a random empty location
   * @private
   */
  _spawnTreeAtRandomLocation() {
    const attempts = Game.Config.TREE_SPAWN_REJECTION_SAMPLES;
    for (let i = 0; i < attempts; i++) {
      const col = Math.floor(Math.random() * Game.Config.GRID_COLS);
      const row = Math.floor(Math.random() * Game.Config.GRID_ROWS);

      // Check if tile is empty (buildable and not occupied)
      if (Game.Map && Game.Map.tiles) {
        const tile = Game.Map.tiles[row] && Game.Map.tiles[row][col];
        if (!tile || tile.tileType === Game.Config.TILE.BLOCKED) {
          continue;  // Not buildable
        }
      }

      // Check if no tree already here
      if (this._findTreeAt({ col, row })) {
        continue;
      }

      // Check if tower here
      if (Game.state.towers && Game.state.towers.some(t => t.col === col && t.row === row)) {
        continue;
      }

      // Valid location
      return { col, row, harvested: false };
    }
    return null;  // Couldn't find valid spot
  }
};
```

- [ ] **Step 2: Call tree spawning in main.js game loop**

In `main.js` loop() function, add after resident updates:

```javascript
    // Spawn trees periodically
    if (Game.Kingdom && Game.state.kingdom) {
      Game.Kingdom.spawnTree(dt);
    }
```

- [ ] **Step 3: Initialize trees array in startMap**

In `main.js` startMap(), update initialization to include:

```javascript
    // Initialize tree array (empty at start, spawns during play)
    Game.state.kingdom.trees = [];
```

- [ ] **Step 4: Commit**

```bash
git add js/kingdom.js js/main.js
git commit -m "feat: implement tree spawning system"
```

---

## Chunk 7: Castle Archer Defense & Game State Integration

### Task 8: Implement archer firing in game loop

**Files:**
- Modify: `js/main.js` (add archer fire logic)
- Modify: `js/castle.js` (add fire method)

- [ ] **Step 1: Add archer fire method to castle.js**

Add to `js/castle.js`:

```javascript
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
      return;  // Not time to fire yet
    }

    // Fire volley
    const archerCount = this.getArcherCount();
    const damage = this.getArcherDamage();
    const range = this.getArcherRange();

    if (!Game.state.enemies || Game.state.enemies.length === 0) {
      Game.state.kingdom.castle.lastArcherFireTime = currentTime;
      return;
    }

    // For each archer, fire at nearest enemy in range
    for (let i = 0; i < archerCount; i++) {
      const enemy = this._findNearestEnemy(range);
      if (enemy) {
        // Create projectile from castle to enemy
        if (Game.Projectile) {
          Game.Projectile.create({
            x: Game.Config.GRID_COLS / 2 * Game.Config.TILE_SIZE,
            y: Game.Config.GRID_ROWS / 2 * Game.Config.TILE_SIZE,
            targetX: enemy.x,
            targetY: enemy.y,
            damage: damage,
            speed: 400,
            sourceType: 'castle'
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

    const castleX = Game.Config.GRID_COLS / 2 * Game.Config.TILE_SIZE;
    const castleY = Game.Config.GRID_ROWS / 2 * Game.Config.TILE_SIZE;

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
  }
};
```

- [ ] **Step 2: Call archer fire in main.js game loop**

In `main.js` loop(), add after projectile updates:

```javascript
    // Castle archers fire
    if (Game.Castle && Game.state.kingdom.castle) {
      Game.Castle.fireArchers(now);
    }
```

- [ ] **Step 3: Add castle game-over check**

In `main.js` loop(), after main update logic, add:

```javascript
    // Check if castle is destroyed
    if (Game.Castle && Game.Castle.isDestroyed()) {
      this.menuState = 'playing';
      Game.state.gameState = 'gameover';
    }
```

- [ ] **Step 4: Commit**

```bash
git add js/castle.js js/main.js
git commit -m "feat: implement castle archer defense system"
```

---

## Chunk 8: Wave Timing System

### Task 9: Implement manual + auto-start wave system

**Files:**
- Modify: `js/main.js` (wave timing logic)
- Modify: `js/wave.js` (add startWave method if needed)

- [ ] **Step 1: Add wave timing logic to main.js**

In `main.js` loop(), add between-wave check:

```javascript
    // Handle wave timing
    if (Game.state.gameState === 'between_waves' || !Game.state.gameState) {
      if (!Game.state.kingdom.waves.lastWaveEndTime) {
        Game.state.kingdom.waves.lastWaveEndTime = now;
      }
      const timeSinceWaveEnd = (now - Game.state.kingdom.waves.lastWaveEndTime) / 1000;
      if (timeSinceWaveEnd > (Game.Config.AUTO_WAVE_DELAY / 1000)) {
        // Auto-start wave
        if (Game.WaveSpawner) {
          Game.WaveSpawner.startNextWave();
          Game.state.kingdom.waves.lastWaveEndTime = 0;
        }
      }
    }
```

- [ ] **Step 2: Update Game.state structure in startMap**

In `main.js` startMap(), ensure kingdom.waves is initialized:

```javascript
    waves: {
      lastWaveEndTime: 0,
      autoStartDelay: Game.Config.AUTO_WAVE_DELAY
    }
```

- [ ] **Step 3: Add manual wave start button event**

In `ui.js` (or a new keyboard input handler), add ability to start waves:

```javascript
// In game loop or input handler
if (Game.Input.isKeyPressed('Space')) {
  if (Game.state.gameState !== 'playing' && Game.WaveSpawner) {
    Game.WaveSpawner.startNextWave();
    Game.state.kingdom.waves.lastWaveEndTime = 0;
  }
}
```

- [ ] **Step 4: Update wave spawner end logic**

Modify `js/wave.js` onWaveEnd to set `lastWaveEndTime`:

```javascript
// In existing wave.js, at end of wave:
if (Game.state.kingdom && Game.state.kingdom.waves) {
  Game.state.kingdom.waves.lastWaveEndTime = performance.now();
}
```

- [ ] **Step 5: Commit**

```bash
git add js/main.js js/wave.js js/ui.js
git commit -m "feat: implement manual and auto-start wave timing system"
```

---

## Chunk 9: Rendering & UI Integration

### Task 10: Add HUD top bar and renderer updates

**Files:**
- Modify: `js/renderer.js` (draw residents, trees, HUD)
- Modify: `js/ui.js` (top bar display)
- Modify: `index.html` (add UI canvas or HUD overlay)

This is a substantial task. Breaking into smaller pieces:

### Task 10a: Render residents and trees

- [ ] **Step 1: Add resident rendering to renderer.js**

In `renderer.js` draw() function (after drawing towers/enemies), add:

```javascript
    // Draw residents
    if (Game.state.kingdom && Game.state.kingdom.population.residents) {
      for (const resident of Game.state.kingdom.population.residents) {
        if (resident.state === 'dead') continue;
        const screenPos = this.worldToScreen(
          resident.gridPos.col * Game.Config.TILE_SIZE,
          resident.gridPos.row * Game.Config.TILE_SIZE
        );
        // Draw resident sprite (green circle for now)
        this.ctx.fillStyle = '#00FF00';
        this.ctx.beginPath();
        this.ctx.arc(screenPos.x, screenPos.y, 6, 0, Math.PI * 2);
        this.ctx.fill();
        // Draw state indicator
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.font = '10px monospace';
        const stateChar = {
          'idle': '◯',
          'seeking': '?',
          'moving': '→',
          'working': '✕',
          'returning': '←',
          'fleeing': '!'
        }[resident.state] || '?';
        this.ctx.fillText(stateChar, screenPos.x - 3, screenPos.y + 3);
      }
    }
```

- [ ] **Step 2: Add tree rendering to renderer.js**

In `renderer.js` draw() function (before residents), add:

```javascript
    // Draw trees
    if (Game.state.kingdom && Game.state.kingdom.trees) {
      for (const tree of Game.state.kingdom.trees) {
        if (tree.harvested) continue;
        const screenPos = this.worldToScreen(
          tree.col * Game.Config.TILE_SIZE,
          tree.row * Game.Config.TILE_SIZE
        );
        // Draw tree sprite (brown triangle)
        this.ctx.fillStyle = '#8B4513';
        this.ctx.beginPath();
        this.ctx.moveTo(screenPos.x, screenPos.y - 8);
        this.ctx.lineTo(screenPos.x - 6, screenPos.y + 4);
        this.ctx.lineTo(screenPos.x + 6, screenPos.y + 4);
        this.ctx.closePath();
        this.ctx.fill();
      }
    }
```

- [ ] **Step 3: Commit resident and tree rendering**

```bash
git add js/renderer.js
git commit -m "feat: render residents and trees on map"
```

### Task 10b: Add castle archer visuals

- [ ] **Step 1: Draw archers firing from castle**

In `renderer.js` after enemies/towers drawn:

```javascript
    // Draw castle (if not already in tile layer)
    const castleScreenPos = this.worldToScreen(
      Game.Config.GRID_COLS / 2 * Game.Config.TILE_SIZE,
      Game.Config.GRID_ROWS / 2 * Game.Config.TILE_SIZE
    );
    this.ctx.fillStyle = '#8B0000';
    this.ctx.fillRect(castleScreenPos.x - 16, castleScreenPos.y - 16, 32, 32);
    // Draw archer count indicator
    if (Game.Castle) {
      const archerCount = Game.Castle.getArcherCount();
      this.ctx.fillStyle = '#FFD700';
      this.ctx.font = 'bold 12px monospace';
      this.ctx.fillText(`◆${archerCount}`, castleScreenPos.x - 10, castleScreenPos.y + 5);
    }
```

- [ ] **Step 2: Commit**

```bash
git add js/renderer.js
git commit -m "feat: render castle with archer count indicator"
```

### Task 10c: Add top bar HUD

- [ ] **Step 1: Add HUD rendering to ui.js**

Create or extend `js/ui.js` with:

```javascript
window.Game = window.Game || {};

Game.UI = Game.UI || {};

Game.UI.drawHUD = function(ctx, canvasWidth, canvasHeight) {
  const hudHeight = 30;
  const padding = 5;

  // Draw HUD background
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.fillRect(0, 0, canvasWidth, hudHeight);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = '12px monospace';

  // Resources section
  let x = padding;
  if (Game.state.kingdom) {
    const wood = Game.Resources.get('wood');
    ctx.fillText(`Wood: ${wood}`, x, 20);
    x += 120;
  }

  // Population section
  if (Game.state.kingdom && Game.Kingdom) {
    const pop = Game.Kingdom.getPopulation();
    const cap = Game.Kingdom.getCapacity();
    ctx.fillText(`Pop: ${pop}/${cap}`, x, 20);
    x += 120;
  }

  // Castle section
  if (Game.state.kingdom && Game.Castle) {
    const level = Game.Castle.getLevel();
    const hp = Game.Castle.getHP();
    const maxHp = Game.state.kingdom.castle.maxHp;
    const levelName = Game.Config.CASTLE_UPGRADES.find(u => u.level === level)?.name || 'Unknown';
    ctx.fillText(`${levelName} (L${level}) | HP: ${hp}/${maxHp}`, x, 20);
  }
};

Game.UI.isHUDClicked = function(mouseX, mouseY) {
  // Returns true if click was in HUD area (top 30px)
  return mouseY < 30;
};
```

- [ ] **Step 2: Call HUD rendering in renderer.js**

In `renderer.js` draw() function, at the very end (after all game elements), add:

```javascript
    // Draw HUD on top
    if (Game.UI && Game.UI.drawHUD) {
      Game.UI.drawHUD(this.ctx, this.canvas.width, this.canvas.height);
    }
```

- [ ] **Step 3: Commit**

```bash
git add js/ui.js js/renderer.js
git commit -m "feat: add top bar HUD displaying resources, population, castle"
```

### Task 10d: Add population management panel

- [ ] **Step 1: Add population panel UI to ui.js**

Add to `js/ui.js`:

```javascript
Game.UI.showPopulationPanel = function() {
  // Create overlay panel (for now, basic text-based)
  Game.UI.populationPanelOpen = true;
};

Game.UI.closePopulationPanel = function() {
  Game.UI.populationPanelOpen = false;
};

Game.UI.drawPopulationPanel = function(ctx, canvasWidth, canvasHeight) {
  if (!Game.UI.populationPanelOpen) return;

  const panelWidth = 300;
  const panelHeight = 200;
  const panelX = canvasWidth / 2 - panelWidth / 2;
  const panelY = canvasHeight / 2 - panelHeight / 2;

  // Draw panel background
  ctx.fillStyle = 'rgba(50, 50, 50, 0.95)';
  ctx.fillRect(panelX, panelY, panelWidth, panelHeight);
  ctx.strokeStyle = '#FFFF00';
  ctx.lineWidth = 2;
  ctx.strokeRect(panelX, panelY, panelWidth, panelHeight);

  // Draw title
  ctx.fillStyle = '#FFFF00';
  ctx.font = 'bold 14px monospace';
  ctx.fillText('POPULATION', panelX + 10, panelY + 20);

  // Draw population info
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '12px monospace';
  let y = panelY + 45;
  if (Game.Kingdom) {
    const pop = Game.Kingdom.getPopulation();
    const cap = Game.Kingdom.getCapacity();
    const free = Game.Kingdom.getFreeResidents();
    ctx.fillText(`Current: ${pop}/${cap}`, panelX + 10, y);
    y += 20;
    ctx.fillText(`Free: ${free}`, panelX + 10, y);
    y += 25;

    // Job assignments
    ctx.fillStyle = '#FFFF00';
    ctx.fillText('Lumberjack: ' + Game.Kingdom.getJobCount('lumberjack'), panelX + 10, y);
    ctx.fillStyle = '#FFFFFF';
    y += 20;

    // Simple buttons (clickable areas for now)
    ctx.fillStyle = '#00FF00';
    ctx.fillText('[+] assign  [-] unassign', panelX + 10, y);
  }

  // Draw close hint
  ctx.fillStyle = '#888888';
  ctx.font = '10px monospace';
  ctx.fillText('Click outside to close', panelX + 10, panelY + panelHeight - 10);
};
```

- [ ] **Step 2: Call panel rendering in renderer.js**

In `renderer.js` draw(), after HUD drawing, add:

```javascript
    // Draw population panel if open
    if (Game.UI && Game.UI.drawPopulationPanel) {
      Game.UI.drawPopulationPanel(this.ctx, this.canvas.width, this.canvas.height);
    }
```

- [ ] **Step 3: Add input handling for HUD clicks**

In `js/input.js` or main.js, add click handler:

```javascript
// When player clicks on "Pop: X/Y" area in HUD
if (Game.Input && Game.Input.clickX !== null && Game.Input.clickY !== null) {
  if (Game.Input.clickY < 30) {
    // Click in HUD area
    if (Game.Input.clickX > 110 && Game.Input.clickX < 210) {
      // Population panel area
      if (Game.UI.populationPanelOpen) {
        Game.UI.closePopulationPanel();
      } else {
        Game.UI.showPopulationPanel();
      }
    }
  } else if (Game.UI.populationPanelOpen) {
    // Click outside panel, close it
    Game.UI.closePopulationPanel();
  }
  // Clear click state
  Game.Input.clickX = null;
  Game.Input.clickY = null;
}
```

- [ ] **Step 4: Commit**

```bash
git add js/ui.js js/renderer.js js/input.js
git commit -m "feat: add population management panel UI"
```

---

## Chunk 10: Testing & Finalization

### Task 11: Run all tests and verify integration

- [ ] **Step 1: Run full test suite**

```bash
npm test
```

Expected: All tests PASS (resources, castle, kingdom modules).

- [ ] **Step 2: Manual play testing**

Open `index.html` in browser and verify:
- [ ] Game starts, castle visible
- [ ] Population shows 5/5
- [ ] Wood count shows 0
- [ ] Can click "Pop" to open panel
- [ ] Can assign a resident to lumberjack
- [ ] Trees appear on map over time
- [ ] Assigned lumberjack moves to nearest tree
- [ ] Lumberjack chops (15 second animation)
- [ ] Wood count increases by 10
- [ ] When upgraded to level 2 (cost 100 wood):
  - [ ] Castle HP increases
  - [ ] Population capacity increases to 8
  - [ ] 3 new free residents appear
- [ ] Castle archers fire at enemies (if enemies approach)
- [ ] If resident takes damage, HP decreases
- [ ] Wave can be started manually or auto-starts after 45s

- [ ] **Step 3: Fix any bugs discovered during testing**

(Will vary based on testing results)

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "test: verify all kingdom-building features and fix bugs"
```

---

## Summary

This plan breaks the kingdom-building feature into 11 manageable tasks:

1. **Config & State** — Add constants and initialize state
2. **Resources Module** — Inventory system (add/spend/check)
3. **Castle Module** — Upgrades, HP, archer mechanics
4. **Kingdom Module** — Population, job assignment, resident management
5. **Resident AI** — State machine for lumberjacks
6. **Tree Spawning** — Procedural tree generation
7. **Archer Defense** — Castle fires at enemies
8. **Wave Timing** — Manual + auto-start system
9. **Rendering** — Draw residents, trees, castle, HUD
10. **Population Panel** — UI for job assignment
11. **Testing** — Integration and manual play testing

Each task is self-contained and produces working code. Tests drive implementation. Frequent commits track progress.
