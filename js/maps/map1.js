window.Game = window.Game || {};
Game.Maps = Game.Maps || {};

// Forest Path - 100x100 open terrain with scattered obstacles
(function() {
  const T = Game.Config.TILE;
  const COLS = 100;
  const ROWS = 100;

  // Simple seeded random for deterministic terrain
  let _seed = 12345;
  function rng() {
    _seed = (_seed * 16807) % 2147483647;
    return (_seed - 1) / 2147483646;
  }

  // Generate grid: mostly BUILDABLE (walkable ground), with obstacle clusters
  const grid = [];
  for (let r = 0; r < ROWS; r++) {
    grid[r] = [];
    for (let c = 0; c < COLS; c++) {
      grid[r][c] = T.BUILDABLE;
    }
  }

  // Place obstacle clusters (mountains, forests, lakes)
  const obstacles = [
    // Mountains (large blocky clusters)
    { cx: 25, cy: 25, w: 8, h: 6 },
    { cx: 60, cy: 15, w: 10, h: 5 },
    { cx: 15, cy: 55, w: 6, h: 8 },
    { cx: 75, cy: 35, w: 7, h: 7 },
    { cx: 40, cy: 70, w: 9, h: 5 },
    { cx: 85, cy: 60, w: 6, h: 6 },
    { cx: 50, cy: 45, w: 5, h: 5 },
    { cx: 30, cy: 85, w: 8, h: 4 },
    { cx: 70, cy: 80, w: 5, h: 7 },
    { cx: 10, cy: 30, w: 4, h: 6 },
    { cx: 90, cy: 15, w: 5, h: 5 },
    { cx: 55, cy: 90, w: 7, h: 4 },
    { cx: 20, cy: 70, w: 5, h: 5 },
    { cx: 80, cy: 50, w: 4, h: 8 },
    { cx: 45, cy: 20, w: 6, h: 4 },
  ];

  for (const obs of obstacles) {
    for (let r = obs.cy - Math.floor(obs.h / 2); r < obs.cy + Math.ceil(obs.h / 2); r++) {
      for (let c = obs.cx - Math.floor(obs.w / 2); c < obs.cx + Math.ceil(obs.w / 2); c++) {
        if (r >= 0 && r < ROWS && c >= 0 && c < COLS) {
          grid[r][c] = T.BLOCKED;
        }
      }
    }
  }

  // Scatter some individual blocked tiles for variety
  _seed = 54321;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (grid[r][c] !== T.BUILDABLE) continue;
      if (rng() < 0.03) {
        grid[r][c] = T.BLOCKED;
      }
    }
  }

  // Clear areas around entry points (ensure they're walkable)
  function clearArea(cx, cy, radius) {
    for (let r = cy - radius; r <= cy + radius; r++) {
      for (let c = cx - radius; c <= cx + radius; c++) {
        if (r >= 0 && r < ROWS && c >= 0 && c < COLS) {
          grid[r][c] = T.BUILDABLE;
        }
      }
    }
  }

  // Entry points on 4 edges
  const entryPoints = [
    { col: 0, row: 50 },    // West
    { col: 99, row: 50 },   // East
    { col: 50, row: 0 },    // North
    { col: 50, row: 99 },   // South
  ];

  for (const ep of entryPoints) {
    clearArea(ep.col, ep.row, 3);
    grid[ep.row][ep.col] = T.ENTRY;
  }

  // Also clear the center area (likely castle placement zone)
  clearArea(50, 50, 5);

  Game.Maps.forest = {
    name: 'Forest Path',
    description: 'An open battlefield. Place your castle and defend it.',
    difficulty: 1,
    grid: grid,
    waves: generateWaves(),
  };

  function generateWaves() {
    return [
      // Wave 1: Goblins from west
      [{ enemyType: 'goblin', count: 6, interval: 0.8, delay: 0, entryIndex: 0 }],
      // Wave 2: Goblins from east
      [{ enemyType: 'goblin', count: 8, interval: 0.6, delay: 0, entryIndex: 1 }],
      // Wave 3: Two sides
      [
        { enemyType: 'goblin', count: 5, interval: 0.7, delay: 0, entryIndex: 0 },
        { enemyType: 'soldier', count: 3, interval: 1.0, delay: 2, entryIndex: 2 },
      ],
      // Wave 4: Wolf riders from south
      [{ enemyType: 'wolf_rider', count: 8, interval: 0.5, delay: 0, entryIndex: 3 }],
      // Wave 5: Boss from west + support from east
      [
        { enemyType: 'soldier', count: 5, interval: 0.8, delay: 0, entryIndex: 1 },
        { enemyType: 'boss', count: 1, interval: 1, delay: 3, entryIndex: 0 },
      ],
      // Wave 6: All sides
      [
        { enemyType: 'goblin', count: 5, interval: 0.5, delay: 0, entryIndex: 0 },
        { enemyType: 'goblin', count: 5, interval: 0.5, delay: 0, entryIndex: 1 },
        { enemyType: 'goblin', count: 5, interval: 0.5, delay: 0, entryIndex: 2 },
        { enemyType: 'goblin', count: 5, interval: 0.5, delay: 0, entryIndex: 3 },
      ],
      // Wave 7: Knights from north
      [
        { enemyType: 'knight', count: 4, interval: 1.5, delay: 0, entryIndex: 2 },
        { enemyType: 'goblin', count: 6, interval: 0.5, delay: 1, entryIndex: 0 },
      ],
      // Wave 8: Wolf rush from multiple sides
      [
        { enemyType: 'wolf_rider', count: 8, interval: 0.3, delay: 0, entryIndex: 0 },
        { enemyType: 'wolf_rider', count: 8, interval: 0.3, delay: 0, entryIndex: 1 },
      ],
      // Wave 9: Shielded + soldiers
      [
        { enemyType: 'shielded', count: 5, interval: 1.0, delay: 0, entryIndex: 2 },
        { enemyType: 'soldier', count: 6, interval: 0.6, delay: 1, entryIndex: 3 },
      ],
      // Wave 10: Boss + flyers
      [
        { enemyType: 'flyer', count: 6, interval: 0.8, delay: 0, entryIndex: 0 },
        { enemyType: 'boss', count: 1, interval: 1, delay: 3, entryIndex: 2 },
      ],
      // Wave 11: Healers + soldiers from all sides
      [
        { enemyType: 'soldier', count: 4, interval: 0.6, delay: 0, entryIndex: 0 },
        { enemyType: 'soldier', count: 4, interval: 0.6, delay: 0, entryIndex: 1 },
        { enemyType: 'healer', count: 2, interval: 2.0, delay: 1, entryIndex: 2 },
        { enemyType: 'healer', count: 2, interval: 2.0, delay: 1, entryIndex: 3 },
      ],
      // Wave 12: Mixed swarm
      [
        { enemyType: 'goblin', count: 10, interval: 0.3, delay: 0, entryIndex: 0 },
        { enemyType: 'wolf_rider', count: 6, interval: 0.4, delay: 1, entryIndex: 1 },
        { enemyType: 'soldier', count: 4, interval: 0.8, delay: 2, entryIndex: 2 },
      ],
      // Wave 13: Heavy armor from two sides
      [
        { enemyType: 'knight', count: 5, interval: 1.2, delay: 0, entryIndex: 0 },
        { enemyType: 'shielded', count: 4, interval: 1.0, delay: 0, entryIndex: 1 },
        { enemyType: 'healer', count: 3, interval: 1.5, delay: 2, entryIndex: 3 },
      ],
      // Wave 14: Air assault from all sides
      [
        { enemyType: 'flyer', count: 4, interval: 0.6, delay: 0, entryIndex: 0 },
        { enemyType: 'flyer', count: 4, interval: 0.6, delay: 0, entryIndex: 1 },
        { enemyType: 'flyer', count: 4, interval: 0.6, delay: 0, entryIndex: 2 },
        { enemyType: 'flyer', count: 4, interval: 0.6, delay: 0, entryIndex: 3 },
      ],
      // Wave 15: Boss with healer escort
      [
        { enemyType: 'healer', count: 3, interval: 1.5, delay: 0, entryIndex: 0 },
        { enemyType: 'knight', count: 4, interval: 1.2, delay: 1, entryIndex: 1 },
        { enemyType: 'boss', count: 1, interval: 1, delay: 4, entryIndex: 0 },
      ],
      // Wave 16: Speed rush from all directions
      [
        { enemyType: 'wolf_rider', count: 8, interval: 0.25, delay: 0, entryIndex: 0 },
        { enemyType: 'wolf_rider', count: 8, interval: 0.25, delay: 0, entryIndex: 1 },
        { enemyType: 'flyer', count: 5, interval: 0.5, delay: 1, entryIndex: 2 },
        { enemyType: 'flyer', count: 5, interval: 0.5, delay: 1, entryIndex: 3 },
      ],
      // Wave 17: Tank line from north and south
      [
        { enemyType: 'knight', count: 8, interval: 0.8, delay: 0, entryIndex: 2 },
        { enemyType: 'knight', count: 8, interval: 0.8, delay: 0, entryIndex: 3 },
        { enemyType: 'healer', count: 4, interval: 1.2, delay: 2, entryIndex: 0 },
      ],
      // Wave 18: Everything everywhere
      [
        { enemyType: 'goblin', count: 8, interval: 0.3, delay: 0, entryIndex: 0 },
        { enemyType: 'soldier', count: 5, interval: 0.6, delay: 1, entryIndex: 1 },
        { enemyType: 'knight', count: 3, interval: 1.5, delay: 2, entryIndex: 2 },
        { enemyType: 'shielded', count: 3, interval: 1.0, delay: 3, entryIndex: 3 },
        { enemyType: 'flyer', count: 5, interval: 0.6, delay: 4, entryIndex: 0 },
      ],
      // Wave 19: Chaos - all sides, all types
      [
        { enemyType: 'wolf_rider', count: 10, interval: 0.25, delay: 0, entryIndex: 0 },
        { enemyType: 'knight', count: 6, interval: 0.8, delay: 1, entryIndex: 1 },
        { enemyType: 'healer', count: 4, interval: 1.0, delay: 2, entryIndex: 2 },
        { enemyType: 'flyer', count: 8, interval: 0.4, delay: 3, entryIndex: 3 },
      ],
      // Wave 20: Final - bosses from all sides
      [
        { enemyType: 'knight', count: 6, interval: 0.6, delay: 0, entryIndex: 0 },
        { enemyType: 'shielded', count: 4, interval: 0.8, delay: 0, entryIndex: 1 },
        { enemyType: 'healer', count: 4, interval: 1.0, delay: 1, entryIndex: 2 },
        { enemyType: 'boss', count: 1, interval: 1, delay: 4, entryIndex: 0 },
        { enemyType: 'boss', count: 1, interval: 1, delay: 5, entryIndex: 1 },
        { enemyType: 'boss', count: 1, interval: 1, delay: 6, entryIndex: 2 },
        { enemyType: 'boss', count: 1, interval: 1, delay: 7, entryIndex: 3 },
      ],
    ];
  }
})();
