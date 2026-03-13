window.Game = window.Game || {};
Game.Maps = Game.Maps || {};

// Crossroads - Two paths converge
(function() {
  const T = Game.Config.TILE;
  const _ = T.BLOCKED;
  const B = T.BUILDABLE;
  const P = T.PATH;
  const I = T.ENTRY;
  const O = T.EXIT;
  const ts = Game.Config.TILE_SIZE;

  function c(col, row) {
    return { x: col * ts + ts / 2, y: row * ts + ts / 2 };
  }

  Game.Maps.crossroads = {
    name: 'Crossroads',
    description: 'Two paths converge. Spread your defenses wisely.',
    difficulty: 2,
    grid: [
      //0  1  2  3  4  5  6  7  8  9 10 11 12 13 14 15 16 17 18 19
      [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _], // 0
      [I, P, P, P, _, _, _, _, _, _, _, _, B, B, _, B, B, _, _, _], // 1
      [_, _, _, P, _, B, B, _, _, _, _, _, B, B, _, B, B, _, _, _], // 2
      [_, B, _, P, _, B, B, _, B, B, _, _, _, _, _, _, _, _, _, _], // 3
      [_, B, _, P, P, P, P, P, P, P, P, _, _, _, _, _, _, _, _, _], // 4
      [_, _, _, _, _, _, _, _, _, _, P, _, B, B, _, _, _, _, _, _], // 5
      [_, _, _, _, B, B, _, _, _, _, P, P, P, P, P, P, P, _, _, _], // 6
      [_, _, _, _, B, B, _, B, B, _, _, _, _, _, _, _, P, _, _, _], // 7
      [_, _, _, _, _, _, _, B, B, _, _, B, B, _, _, _, P, _, _, _], // 8
      [_, _, _, _, _, _, _, _, _, _, _, B, B, _, B, _, P, P, P, O], // 9
      [I, P, P, P, P, _, _, _, _, B, _, _, _, _, B, _, _, _, _, _], // 10
      [_, _, _, _, P, _, B, B, _, B, _, _, _, _, _, _, _, _, _, _], // 11
      [_, B, B, _, P, P, P, P, P, P, P, P, P, P, P, P, P, _, _, _], // 12
      [_, B, B, _, _, _, _, _, _, _, _, _, _, _, _, _, P, _, _, _], // 13
    ],
    paths: [
      // Top path: enters row 1, goes down, right, then down to join at exit
      [
        c(0, 1), c(3, 1), c(3, 4), c(10, 4), c(10, 6), c(16, 6),
        c(16, 9), c(19, 9),
      ],
      // Bottom path: enters row 10, goes right, down, right, then up to exit
      [
        c(0, 10), c(4, 10), c(4, 12), c(16, 12), c(16, 9), c(19, 9),
      ],
    ],
    waves: generateCrossroadsWaves(),
  };

  function generateCrossroadsWaves() {
    return [
      // Wave 1
      [{ enemyType: 'goblin', count: 6, interval: 0.7, delay: 0, pathIndex: 0 }],
      // Wave 2
      [{ enemyType: 'goblin', count: 6, interval: 0.7, delay: 0, pathIndex: 1 }],
      // Wave 3: Both paths
      [
        { enemyType: 'goblin', count: 5, interval: 0.6, delay: 0, pathIndex: 0 },
        { enemyType: 'goblin', count: 5, interval: 0.6, delay: 0, pathIndex: 1 },
      ],
      // Wave 4
      [
        { enemyType: 'soldier', count: 4, interval: 0.8, delay: 0, pathIndex: 0 },
        { enemyType: 'wolf_rider', count: 4, interval: 0.5, delay: 0, pathIndex: 1 },
      ],
      // Wave 5: Boss on one path, swarm on other
      [
        { enemyType: 'boss', count: 1, interval: 1, delay: 0, pathIndex: 0 },
        { enemyType: 'goblin', count: 10, interval: 0.4, delay: 0, pathIndex: 1 },
      ],
      // Wave 6
      [
        { enemyType: 'soldier', count: 5, interval: 0.7, delay: 0, pathIndex: 0 },
        { enemyType: 'soldier', count: 5, interval: 0.7, delay: 0, pathIndex: 1 },
      ],
      // Wave 7
      [
        { enemyType: 'knight', count: 3, interval: 1.5, delay: 0, pathIndex: 0 },
        { enemyType: 'wolf_rider', count: 8, interval: 0.4, delay: 0, pathIndex: 1 },
      ],
      // Wave 8: Healer support
      [
        { enemyType: 'soldier', count: 6, interval: 0.6, delay: 0, pathIndex: 0 },
        { enemyType: 'healer', count: 2, interval: 2.0, delay: 1, pathIndex: 0 },
        { enemyType: 'soldier', count: 6, interval: 0.6, delay: 0, pathIndex: 1 },
        { enemyType: 'healer', count: 2, interval: 2.0, delay: 1, pathIndex: 1 },
      ],
      // Wave 9: Flyers
      [
        { enemyType: 'flyer', count: 8, interval: 0.5, delay: 0, pathIndex: 0 },
        { enemyType: 'shielded', count: 4, interval: 1.0, delay: 0, pathIndex: 1 },
      ],
      // Wave 10: Double boss
      [
        { enemyType: 'boss', count: 1, interval: 1, delay: 0, pathIndex: 0 },
        { enemyType: 'boss', count: 1, interval: 1, delay: 0, pathIndex: 1 },
        { enemyType: 'healer', count: 2, interval: 2, delay: 2, pathIndex: 0 },
      ],
      // Wave 11-15: Escalating
      [
        { enemyType: 'knight', count: 5, interval: 1.0, delay: 0, pathIndex: 0 },
        { enemyType: 'knight', count: 5, interval: 1.0, delay: 0, pathIndex: 1 },
      ],
      [
        { enemyType: 'wolf_rider', count: 15, interval: 0.25, delay: 0, pathIndex: 0 },
        { enemyType: 'flyer', count: 8, interval: 0.5, delay: 0, pathIndex: 1 },
      ],
      [
        { enemyType: 'shielded', count: 6, interval: 0.8, delay: 0, pathIndex: 0 },
        { enemyType: 'knight', count: 4, interval: 1.2, delay: 0, pathIndex: 1 },
        { enemyType: 'healer', count: 3, interval: 1.5, delay: 2, pathIndex: 1 },
      ],
      [
        { enemyType: 'flyer', count: 12, interval: 0.4, delay: 0, pathIndex: 0 },
        { enemyType: 'goblin', count: 15, interval: 0.2, delay: 0, pathIndex: 1 },
      ],
      // Wave 15: Boss rush
      [
        { enemyType: 'boss', count: 2, interval: 4, delay: 0, pathIndex: 0 },
        { enemyType: 'boss', count: 2, interval: 4, delay: 0, pathIndex: 1 },
        { enemyType: 'healer', count: 4, interval: 1.5, delay: 1, pathIndex: 0 },
      ],
      // 16-20: Endgame
      [
        { enemyType: 'knight', count: 8, interval: 0.8, delay: 0, pathIndex: 0 },
        { enemyType: 'shielded', count: 6, interval: 0.8, delay: 0, pathIndex: 1 },
        { enemyType: 'healer', count: 4, interval: 1.0, delay: 2, pathIndex: 0 },
      ],
      [
        { enemyType: 'wolf_rider', count: 20, interval: 0.2, delay: 0, pathIndex: 0 },
        { enemyType: 'wolf_rider', count: 20, interval: 0.2, delay: 0, pathIndex: 1 },
      ],
      [
        { enemyType: 'flyer', count: 10, interval: 0.4, delay: 0, pathIndex: 0 },
        { enemyType: 'knight', count: 6, interval: 1.0, delay: 0, pathIndex: 1 },
        { enemyType: 'healer', count: 5, interval: 1.2, delay: 2, pathIndex: 1 },
      ],
      [
        { enemyType: 'knight', count: 10, interval: 0.6, delay: 0, pathIndex: 0 },
        { enemyType: 'shielded', count: 8, interval: 0.6, delay: 0, pathIndex: 1 },
        { enemyType: 'flyer', count: 10, interval: 0.4, delay: 2, pathIndex: 0 },
      ],
      // Wave 20: Final
      [
        { enemyType: 'boss', count: 3, interval: 3, delay: 0, pathIndex: 0 },
        { enemyType: 'boss', count: 3, interval: 3, delay: 0, pathIndex: 1 },
        { enemyType: 'healer', count: 5, interval: 1.0, delay: 2, pathIndex: 0 },
        { enemyType: 'healer', count: 5, interval: 1.0, delay: 2, pathIndex: 1 },
      ],
    ];
  }
})();
