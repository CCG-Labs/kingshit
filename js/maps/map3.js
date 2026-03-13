window.Game = window.Game || {};
Game.Maps = Game.Maps || {};

// Castle Siege - Three entry points
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

  Game.Maps.castle = {
    name: 'Castle Siege',
    description: 'Three entrances, one castle to defend. Hold the line.',
    difficulty: 3,
    grid: [
      //0  1  2  3  4  5  6  7  8  9 10 11 12 13 14 15 16 17 18 19
      [_, _, _, _, _, _, _, _, _, I, _, _, _, _, _, _, _, _, _, _], // 0
      [_, B, B, _, _, B, B, _, _, P, _, _, B, B, _, _, B, B, _, _], // 1
      [_, B, B, _, _, B, B, _, _, P, _, _, B, B, _, _, B, B, _, _], // 2
      [_, _, _, _, _, _, _, _, _, P, _, _, _, _, _, _, _, _, _, _], // 3
      [I, P, P, P, P, P, _, B, B, P, B, B, _, P, P, P, P, P, P, I], // 4
      [_, _, _, _, _, P, _, B, B, P, B, B, _, P, _, _, _, _, _, _], // 5
      [_, B, B, _, _, P, P, P, P, P, P, P, P, P, _, _, B, B, _, _], // 6
      [_, B, B, _, _, _, _, B, B, P, B, B, _, _, _, _, B, B, _, _], // 7
      [_, _, _, _, B, B, _, B, B, P, B, B, _, B, B, _, _, _, _, _], // 8
      [_, _, _, _, B, B, _, _, _, P, _, _, _, B, B, _, _, _, _, _], // 9
      [_, _, B, _, _, _, _, _, _, P, _, _, _, _, _, _, B, _, _, _], // 10
      [_, _, B, _, _, B, B, _, _, P, _, _, B, B, _, _, B, _, _, _], // 11
      [_, _, _, _, _, B, B, _, _, O, _, _, B, B, _, _, _, _, _, _], // 12
      [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _], // 13
    ],
    paths: [
      // Top entrance
      [c(9, 0), c(9, 6), c(9, 12)],
      // Left entrance
      [c(0, 4), c(5, 4), c(5, 6), c(9, 6), c(9, 12)],
      // Right entrance
      [c(19, 4), c(13, 4), c(13, 6), c(9, 6), c(9, 12)],
    ],
    waves: generateCastleWaves(),
  };

  function generateCastleWaves() {
    const waves = [];
    // 25 waves
    // Wave 1: Single path
    waves.push([{ enemyType: 'goblin', count: 6, interval: 0.7, delay: 0, pathIndex: 0 }]);
    // Wave 2: Two paths
    waves.push([
      { enemyType: 'goblin', count: 5, interval: 0.6, delay: 0, pathIndex: 1 },
      { enemyType: 'goblin', count: 5, interval: 0.6, delay: 0, pathIndex: 2 },
    ]);
    // Wave 3: All three
    waves.push([
      { enemyType: 'goblin', count: 4, interval: 0.6, delay: 0, pathIndex: 0 },
      { enemyType: 'goblin', count: 4, interval: 0.6, delay: 0, pathIndex: 1 },
      { enemyType: 'goblin', count: 4, interval: 0.6, delay: 0, pathIndex: 2 },
    ]);
    // Wave 4
    waves.push([
      { enemyType: 'soldier', count: 4, interval: 0.8, delay: 0, pathIndex: 0 },
      { enemyType: 'wolf_rider', count: 6, interval: 0.4, delay: 0, pathIndex: 1 },
      { enemyType: 'soldier', count: 4, interval: 0.8, delay: 0, pathIndex: 2 },
    ]);
    // Wave 5: Boss
    waves.push([
      { enemyType: 'boss', count: 1, interval: 1, delay: 0, pathIndex: 0 },
      { enemyType: 'goblin', count: 6, interval: 0.5, delay: 0, pathIndex: 1 },
      { enemyType: 'goblin', count: 6, interval: 0.5, delay: 0, pathIndex: 2 },
    ]);

    // Waves 6-10: Introduce all types
    waves.push([
      { enemyType: 'knight', count: 3, interval: 1.5, delay: 0, pathIndex: 0 },
      { enemyType: 'soldier', count: 5, interval: 0.7, delay: 0, pathIndex: 1 },
      { enemyType: 'wolf_rider', count: 8, interval: 0.4, delay: 0, pathIndex: 2 },
    ]);
    waves.push([
      { enemyType: 'flyer', count: 6, interval: 0.6, delay: 0, pathIndex: 0 },
      { enemyType: 'shielded', count: 4, interval: 1.0, delay: 0, pathIndex: 1 },
      { enemyType: 'healer', count: 2, interval: 2.0, delay: 1, pathIndex: 1 },
    ]);
    waves.push([
      { enemyType: 'wolf_rider', count: 10, interval: 0.3, delay: 0, pathIndex: 0 },
      { enemyType: 'wolf_rider', count: 10, interval: 0.3, delay: 0, pathIndex: 2 },
    ]);
    waves.push([
      { enemyType: 'knight', count: 4, interval: 1.2, delay: 0, pathIndex: 0 },
      { enemyType: 'knight', count: 4, interval: 1.2, delay: 0, pathIndex: 1 },
      { enemyType: 'knight', count: 4, interval: 1.2, delay: 0, pathIndex: 2 },
      { enemyType: 'healer', count: 3, interval: 1.5, delay: 2, pathIndex: 1 },
    ]);
    // Wave 10: Multi boss
    waves.push([
      { enemyType: 'boss', count: 1, interval: 1, delay: 0, pathIndex: 0 },
      { enemyType: 'boss', count: 1, interval: 1, delay: 0, pathIndex: 1 },
      { enemyType: 'boss', count: 1, interval: 1, delay: 0, pathIndex: 2 },
    ]);

    // Waves 11-15: Escalation
    for (let i = 0; i < 5; i++) {
      const types = ['soldier', 'knight', 'shielded', 'wolf_rider', 'flyer'];
      const wave = [];
      for (let p = 0; p < 3; p++) {
        const type = types[(i + p) % types.length];
        wave.push({
          enemyType: type,
          count: 6 + i * 2,
          interval: 0.5,
          delay: 0,
          pathIndex: p,
        });
      }
      if (i >= 2) {
        wave.push({ enemyType: 'healer', count: 3, interval: 1.5, delay: 2, pathIndex: i % 3 });
      }
      if (i === 4) {
        wave.push({ enemyType: 'boss', count: 2, interval: 4, delay: 3, pathIndex: 1 });
      }
      waves.push(wave);
    }

    // Waves 16-20: Hard
    for (let i = 0; i < 5; i++) {
      const wave = [
        { enemyType: 'knight', count: 5 + i, interval: 0.6, delay: 0, pathIndex: 0 },
        { enemyType: 'shielded', count: 4 + i, interval: 0.7, delay: 0, pathIndex: 1 },
        { enemyType: 'flyer', count: 6 + i, interval: 0.5, delay: 0, pathIndex: 2 },
        { enemyType: 'healer', count: 2 + i, interval: 1.0, delay: 2, pathIndex: i % 3 },
      ];
      if (i % 2 === 0) {
        wave.push({ enemyType: 'boss', count: 1 + Math.floor(i / 2), interval: 4, delay: 4, pathIndex: 1 });
      }
      waves.push(wave);
    }

    // Waves 21-25: Endgame
    for (let i = 0; i < 5; i++) {
      const wave = [];
      for (let p = 0; p < 3; p++) {
        wave.push({ enemyType: 'knight', count: 8 + i * 2, interval: 0.4, delay: 0, pathIndex: p });
        wave.push({ enemyType: 'healer', count: 3 + i, interval: 1.0, delay: 2, pathIndex: p });
      }
      wave.push({ enemyType: 'boss', count: 1 + i, interval: 3, delay: 5, pathIndex: i % 3 });
      waves.push(wave);
    }

    return waves;
  }
})();
