window.Game = window.Game || {};
Game.Maps = Game.Maps || {};

// Forest Path - Tutorial map
// Single winding S-shaped path, 20 waves
(function() {
  const T = Game.Config.TILE;
  const _ = T.BLOCKED;
  const B = T.BUILDABLE;
  const P = T.PATH;
  const I = T.ENTRY;
  const O = T.EXIT;
  const ts = Game.Config.TILE_SIZE;

  // Helper to get center of tile
  function c(col, row) {
    return { x: col * ts + ts / 2, y: row * ts + ts / 2 };
  }

  Game.Maps.forest = {
    name: 'Forest Path',
    description: 'A winding path through the woods. Good for learning the basics.',
    difficulty: 1,
    grid: [
      //0  1  2  3  4  5  6  7  8  9 10 11 12 13 14 15 16 17 18 19
      [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _], // 0
      [_, _, _, B, B, _, _, _, _, B, B, B, _, _, _, _, B, B, _, _], // 1
      [I, P, P, P, P, P, P, _, B, P, P, P, P, P, P, _, B, B, _, _], // 2
      [_, _, _, B, B, _, P, _, _, B, B, _, _, _, P, _, _, _, _, _], // 3
      [_, _, _, _, _, _, P, _, _, _, _, _, B, B, P, _, _, _, _, _], // 4
      [_, _, B, B, _, _, P, P, P, P, P, _, B, B, P, _, _, B, B, _], // 5
      [_, _, B, B, _, _, _, _, _, _, P, _, _, _, P, _, _, B, B, _], // 6
      [_, _, _, _, _, _, _, B, B, _, P, _, B, _, P, _, _, _, _, _], // 7
      [_, _, _, _, B, B, _, B, B, _, P, P, P, _, P, P, P, _, _, _], // 8
      [_, _, B, _, B, B, _, _, _, _, _, _, B, _, _, _, P, _, _, _], // 9
      [_, _, B, _, _, _, _, _, B, B, _, _, B, _, _, _, P, _, B, _], // 10
      [_, _, _, _, _, B, B, _, B, B, _, _, _, _, B, _, P, P, P, O], // 11
      [_, _, _, _, _, B, B, _, _, _, _, _, _, _, B, _, _, _, _, _], // 12
      [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _], // 13
    ],
    paths: [
      [
        c(0, 2), c(1, 2), c(2, 2), c(3, 2), c(4, 2), c(5, 2), c(6, 2),
        c(6, 3), c(6, 4), c(6, 5), c(7, 5), c(8, 5), c(9, 5), c(10, 5),
        c(10, 6), c(10, 7), c(10, 8), c(11, 8), c(12, 8),
        c(12, 7), c(12, 6), c(12, 5),
        // Nah let me redo - just make it follow the P tiles
        // Actually let me trace the path properly:
      ]
    ],
    waves: [],
  };

  // Re-trace path from entry to exit following P tiles
  // Entry: (0,2) -> right along row 2 to (6,2) -> down to (6,5) -> right to (10,5)
  // -> down to (10,8) -> right to (12,8) -> (actually let me just carefully trace)

  // Let me simplify and redo the grid to make path tracing clean
  Game.Maps.forest.grid = [
    //0  1  2  3  4  5  6  7  8  9 10 11 12 13 14 15 16 17 18 19
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _], // 0
    [_, B, B, B, B, B, _, _, B, B, B, B, B, _, _, B, B, B, B, _], // 1
    [I, P, P, P, P, P, P, _, B, B, B, B, B, _, _, B, B, B, B, _], // 2
    [_, B, B, B, _, _, P, _, _, _, _, _, _, _, _, _, _, _, _, _], // 3
    [_, _, _, _, _, B, P, B, _, B, B, B, B, _, _, _, _, _, _, _], // 4
    [_, _, _, _, _, B, P, P, P, P, P, P, P, P, _, _, _, _, _, _], // 5
    [_, _, _, B, B, _, _, _, _, _, _, _, _, P, _, _, _, _, _, _], // 6
    [_, _, _, B, B, _, _, _, _, B, B, _, _, P, _, B, B, _, _, _], // 7
    [_, _, _, _, _, _, B, B, _, B, B, _, _, P, P, P, P, P, _, _], // 8
    [_, _, _, _, _, _, B, B, _, _, _, _, B, _, _, _, _, P, _, _], // 9
    [_, B, B, _, _, _, _, _, _, _, B, _, B, _, B, B, _, P, _, _], // 10
    [_, B, B, _, B, B, _, _, _, _, B, _, _, _, B, B, _, P, P, O], // 11
    [_, _, _, _, B, B, _, _, _, _, _, _, _, _, _, _, _, _, _, _], // 12
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _], // 13
  ];

  Game.Maps.forest.paths = [
    [
      c(0, 2), c(5, 2), c(6, 2), c(6, 5), c(13, 5), c(13, 8), c(17, 8),
      c(17, 11), c(19, 11),
    ]
  ];

  // 20 waves
  Game.Maps.forest.waves = [
    // Wave 1: Basic goblins
    [{ enemyType: 'goblin', count: 5, interval: 0.8, delay: 0 }],
    // Wave 2: More goblins
    [{ enemyType: 'goblin', count: 8, interval: 0.6, delay: 0 }],
    // Wave 3: Soldiers intro
    [
      { enemyType: 'goblin', count: 5, interval: 0.7, delay: 0 },
      { enemyType: 'soldier', count: 3, interval: 1.0, delay: 3 },
    ],
    // Wave 4: Fast wolves
    [{ enemyType: 'wolf_rider', count: 6, interval: 0.5, delay: 0 }],
    // Wave 5: Boss wave
    [
      { enemyType: 'soldier', count: 4, interval: 0.8, delay: 0 },
      { enemyType: 'boss', count: 1, interval: 1, delay: 4 },
    ],
    // Wave 6: Mixed
    [
      { enemyType: 'goblin', count: 8, interval: 0.5, delay: 0 },
      { enemyType: 'soldier', count: 4, interval: 0.8, delay: 2 },
    ],
    // Wave 7: Knights intro
    [
      { enemyType: 'goblin', count: 5, interval: 0.6, delay: 0 },
      { enemyType: 'knight', count: 2, interval: 2.0, delay: 3 },
    ],
    // Wave 8: Wolf rush
    [{ enemyType: 'wolf_rider', count: 12, interval: 0.35, delay: 0 }],
    // Wave 9: Shielded intro
    [
      { enemyType: 'shielded', count: 4, interval: 1.0, delay: 0 },
      { enemyType: 'goblin', count: 6, interval: 0.5, delay: 2 },
    ],
    // Wave 10: Boss + flyers
    [
      { enemyType: 'flyer', count: 5, interval: 0.8, delay: 0 },
      { enemyType: 'boss', count: 1, interval: 1, delay: 3 },
    ],
    // Wave 11: Healers intro
    [
      { enemyType: 'soldier', count: 6, interval: 0.6, delay: 0 },
      { enemyType: 'healer', count: 2, interval: 2.0, delay: 1 },
    ],
    // Wave 12: Mixed swarm
    [
      { enemyType: 'goblin', count: 10, interval: 0.3, delay: 0 },
      { enemyType: 'wolf_rider', count: 5, interval: 0.5, delay: 2 },
      { enemyType: 'soldier', count: 3, interval: 1.0, delay: 4 },
    ],
    // Wave 13: Heavy armor
    [
      { enemyType: 'knight', count: 5, interval: 1.5, delay: 0 },
      { enemyType: 'shielded', count: 3, interval: 1.2, delay: 3 },
    ],
    // Wave 14: Air assault
    [
      { enemyType: 'flyer', count: 10, interval: 0.5, delay: 0 },
    ],
    // Wave 15: Boss with support
    [
      { enemyType: 'healer', count: 3, interval: 1.5, delay: 0 },
      { enemyType: 'knight', count: 3, interval: 1.5, delay: 1 },
      { enemyType: 'boss', count: 1, interval: 1, delay: 5 },
    ],
    // Wave 16: Speed rush
    [
      { enemyType: 'wolf_rider', count: 15, interval: 0.25, delay: 0 },
      { enemyType: 'flyer', count: 5, interval: 0.6, delay: 2 },
    ],
    // Wave 17: Tank line
    [
      { enemyType: 'knight', count: 8, interval: 1.0, delay: 0 },
      { enemyType: 'healer', count: 4, interval: 1.5, delay: 2 },
    ],
    // Wave 18: Everything
    [
      { enemyType: 'goblin', count: 10, interval: 0.3, delay: 0 },
      { enemyType: 'soldier', count: 5, interval: 0.6, delay: 1 },
      { enemyType: 'knight', count: 3, interval: 1.5, delay: 3 },
      { enemyType: 'flyer', count: 5, interval: 0.7, delay: 4 },
      { enemyType: 'shielded', count: 3, interval: 1.0, delay: 5 },
    ],
    // Wave 19: Chaos
    [
      { enemyType: 'wolf_rider', count: 10, interval: 0.3, delay: 0 },
      { enemyType: 'knight', count: 5, interval: 1.0, delay: 2 },
      { enemyType: 'healer', count: 4, interval: 1.0, delay: 3 },
      { enemyType: 'flyer', count: 8, interval: 0.5, delay: 4 },
    ],
    // Wave 20: Final boss
    [
      { enemyType: 'knight', count: 6, interval: 0.8, delay: 0 },
      { enemyType: 'shielded', count: 4, interval: 1.0, delay: 2 },
      { enemyType: 'healer', count: 3, interval: 1.5, delay: 3 },
      { enemyType: 'boss', count: 2, interval: 5.0, delay: 5 },
    ],
  ];
})();
