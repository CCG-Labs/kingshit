window.Game = window.Game || {};
Game.Maps = Game.Maps || {};

// Forest Path - Large 100x100 map with winding path
(function() {
  const T = Game.Config.TILE;
  const ts = Game.Config.TILE_SIZE;
  const COLS = 100;
  const ROWS = 100;

  function c(col, row) {
    return { x: col * ts + ts / 2, y: row * ts + ts / 2 };
  }

  // Generate a 100x100 grid filled with BLOCKED by default
  const grid = [];
  for (let r = 0; r < ROWS; r++) {
    grid[r] = [];
    for (let col = 0; col < COLS; col++) {
      grid[r][col] = T.BLOCKED;
    }
  }

  // Define a winding path through the map as a series of waypoints
  // Path goes: entry on left edge, winds across the map, exits on right edge
  const pathWaypoints = [
    [2, 10],   // entry
    [8, 10],
    [8, 20],
    [18, 20],
    [18, 12],
    [28, 12],
    [28, 28],
    [15, 28],
    [15, 38],
    [30, 38],
    [30, 32],
    [42, 32],
    [42, 45],
    [28, 45],
    [28, 55],
    [40, 55],
    [40, 50],
    [55, 50],
    [55, 60],
    [42, 60],
    [42, 70],
    [55, 70],
    [55, 65],
    [68, 65],
    [68, 75],
    [55, 75],
    [55, 85],
    [70, 85],
    [70, 78],
    [82, 78],
    [82, 88],
    [92, 88],
    [92, 80],
    [97, 80],  // exit
  ];

  // Carve path tiles along the waypoints
  function carvePath(grid, waypoints) {
    for (let i = 0; i < waypoints.length - 1; i++) {
      const [c0, r0] = waypoints[i];
      const [c1, r1] = waypoints[i + 1];
      // Carve horizontal or vertical segments
      if (r0 === r1) {
        // Horizontal
        const minC = Math.min(c0, c1);
        const maxC = Math.max(c0, c1);
        for (let col = minC; col <= maxC; col++) {
          grid[r0][col] = T.PATH;
          // Widen path to 2 tiles
          if (r0 + 1 < ROWS) grid[r0 + 1][col] = T.PATH;
        }
      } else {
        // Vertical
        const minR = Math.min(r0, r1);
        const maxR = Math.max(r0, r1);
        for (let row = minR; row <= maxR; row++) {
          grid[row][c0] = T.PATH;
          if (c0 + 1 < COLS) grid[row][c0 + 1] = T.PATH;
        }
      }
    }
  }

  carvePath(grid, pathWaypoints);

  // Mark entry and exit
  const entryWp = pathWaypoints[0];
  const exitWp = pathWaypoints[pathWaypoints.length - 1];
  grid[entryWp[1]][entryWp[0]] = T.ENTRY;
  grid[exitWp[1]][exitWp[0]] = T.EXIT;

  // Place buildable tiles adjacent to path
  function placeBuildable(grid) {
    const dirs = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1],
                  [-2,0],[2,0],[0,-2],[0,2]];
    // Mark tiles adjacent to path as buildable
    const buildable = [];
    for (let r = 0; r < ROWS; r++) {
      for (let col = 0; col < COLS; col++) {
        if (grid[r][col] !== T.PATH && grid[r][col] !== T.ENTRY && grid[r][col] !== T.EXIT) continue;
        for (const [dc, dr] of dirs) {
          const nc = col + dc;
          const nr = r + dr;
          if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && grid[nr][nc] === T.BLOCKED) {
            buildable.push([nr, nc]);
          }
        }
      }
    }
    for (const [r, col] of buildable) {
      grid[r][col] = T.BUILDABLE;
    }
  }

  placeBuildable(grid);

  // Build the path waypoints for enemy pathfinding (world coordinates)
  // Follow the center of the carved path
  const enemyPath = [];
  for (const [col, row] of pathWaypoints) {
    enemyPath.push(c(col, row));
  }

  Game.Maps.forest = {
    name: 'Forest Path',
    description: 'A winding path through the woods.',
    difficulty: 1,
    grid: grid,
    paths: [enemyPath],
    waves: generateWaves(),
  };

  function generateWaves() {
    return [
      // Wave 1: Basic goblins
      [{ enemyType: 'goblin', count: 6, interval: 0.8, delay: 0 }],
      // Wave 2: More goblins
      [{ enemyType: 'goblin', count: 10, interval: 0.6, delay: 0 }],
      // Wave 3: Soldiers intro
      [
        { enemyType: 'goblin', count: 6, interval: 0.7, delay: 0 },
        { enemyType: 'soldier', count: 3, interval: 1.0, delay: 3 },
      ],
      // Wave 4: Fast wolves
      [{ enemyType: 'wolf_rider', count: 8, interval: 0.5, delay: 0 }],
      // Wave 5: Boss wave
      [
        { enemyType: 'soldier', count: 5, interval: 0.8, delay: 0 },
        { enemyType: 'boss', count: 1, interval: 1, delay: 4 },
      ],
      // Wave 6: Mixed
      [
        { enemyType: 'goblin', count: 10, interval: 0.5, delay: 0 },
        { enemyType: 'soldier', count: 5, interval: 0.8, delay: 2 },
      ],
      // Wave 7: Knights intro
      [
        { enemyType: 'goblin', count: 6, interval: 0.6, delay: 0 },
        { enemyType: 'knight', count: 3, interval: 2.0, delay: 3 },
      ],
      // Wave 8: Wolf rush
      [{ enemyType: 'wolf_rider', count: 15, interval: 0.3, delay: 0 }],
      // Wave 9: Shielded intro
      [
        { enemyType: 'shielded', count: 5, interval: 1.0, delay: 0 },
        { enemyType: 'goblin', count: 8, interval: 0.5, delay: 2 },
      ],
      // Wave 10: Boss + flyers
      [
        { enemyType: 'flyer', count: 6, interval: 0.8, delay: 0 },
        { enemyType: 'boss', count: 1, interval: 1, delay: 3 },
      ],
      // Wave 11: Healers intro
      [
        { enemyType: 'soldier', count: 8, interval: 0.6, delay: 0 },
        { enemyType: 'healer', count: 3, interval: 2.0, delay: 1 },
      ],
      // Wave 12: Mixed swarm
      [
        { enemyType: 'goblin', count: 12, interval: 0.3, delay: 0 },
        { enemyType: 'wolf_rider', count: 6, interval: 0.5, delay: 2 },
        { enemyType: 'soldier', count: 4, interval: 1.0, delay: 4 },
      ],
      // Wave 13: Heavy armor
      [
        { enemyType: 'knight', count: 6, interval: 1.5, delay: 0 },
        { enemyType: 'shielded', count: 4, interval: 1.2, delay: 3 },
      ],
      // Wave 14: Air assault
      [{ enemyType: 'flyer', count: 12, interval: 0.5, delay: 0 }],
      // Wave 15: Boss with support
      [
        { enemyType: 'healer', count: 4, interval: 1.5, delay: 0 },
        { enemyType: 'knight', count: 4, interval: 1.5, delay: 1 },
        { enemyType: 'boss', count: 1, interval: 1, delay: 5 },
      ],
      // Wave 16: Speed rush
      [
        { enemyType: 'wolf_rider', count: 18, interval: 0.25, delay: 0 },
        { enemyType: 'flyer', count: 6, interval: 0.6, delay: 2 },
      ],
      // Wave 17: Tank line
      [
        { enemyType: 'knight', count: 10, interval: 1.0, delay: 0 },
        { enemyType: 'healer', count: 5, interval: 1.5, delay: 2 },
      ],
      // Wave 18: Everything
      [
        { enemyType: 'goblin', count: 12, interval: 0.3, delay: 0 },
        { enemyType: 'soldier', count: 6, interval: 0.6, delay: 1 },
        { enemyType: 'knight', count: 4, interval: 1.5, delay: 3 },
        { enemyType: 'flyer', count: 6, interval: 0.7, delay: 4 },
        { enemyType: 'shielded', count: 4, interval: 1.0, delay: 5 },
      ],
      // Wave 19: Chaos
      [
        { enemyType: 'wolf_rider', count: 12, interval: 0.3, delay: 0 },
        { enemyType: 'knight', count: 6, interval: 1.0, delay: 2 },
        { enemyType: 'healer', count: 5, interval: 1.0, delay: 3 },
        { enemyType: 'flyer', count: 10, interval: 0.5, delay: 4 },
      ],
      // Wave 20: Final boss
      [
        { enemyType: 'knight', count: 8, interval: 0.8, delay: 0 },
        { enemyType: 'shielded', count: 5, interval: 1.0, delay: 2 },
        { enemyType: 'healer', count: 4, interval: 1.5, delay: 3 },
        { enemyType: 'boss', count: 3, interval: 5.0, delay: 5 },
      ],
    ];
  }
})();
