window.Game = window.Game || {};

Game.WaveSpawner = {
  waveIndex: 0,
  groups: [],
  activeGroups: [],
  waveTimer: 0,
  betweenWaves: true,
  betweenWaveTimer: 0,
  allWavesDone: false,

  init(waves) {
    this.waves = waves;
    this.waveIndex = 0;
    this.groups = [];
    this.activeGroups = [];
    this.waveTimer = 0;
    this.betweenWaves = true;
    this.betweenWaveTimer = 3;
    this.allWavesDone = false;
  },

  startWave() {
    if (this.waveIndex >= this.waves.length) {
      this.allWavesDone = true;
      return;
    }

    const waveDef = this.waves[this.waveIndex];
    this.groups = waveDef.map((g) => ({
      enemyType: g.enemyType,
      count: g.count,
      interval: g.interval,
      delay: g.delay,
      spawned: 0,
      timer: g.delay,
      entryIndex: g.entryIndex || 0,
    }));
    this.activeGroups = [...this.groups];
    this.waveTimer = 0;
    this.betweenWaves = false;
    this.waveIndex++;
  },

  startNextWave() {
    this.startWave();
  },

  startEarly() {
    if (!this.betweenWaves) return 0;
    const bonus = Math.round(this.betweenWaveTimer * 2);
    this.betweenWaveTimer = 0;
    return bonus;
  },

  isWaveComplete(enemies) {
    if (this.betweenWaves) return false;
    if (this.activeGroups.length > 0) return false;
    return enemies.every((e) => e.dead || e.escaped);
  },

  update(dt, state) {
    if (this.allWavesDone) return;

    if (this.betweenWaves) {
      this.betweenWaveTimer -= dt;
      if (this.betweenWaveTimer <= 0) {
        this.startWave();
      }
      return;
    }

    this.waveTimer += dt;

    for (let i = this.activeGroups.length - 1; i >= 0; i--) {
      const g = this.activeGroups[i];
      g.timer -= dt;

      if (g.timer <= 0 && g.spawned < g.count) {
        this.spawnEnemy(g, state);
        g.spawned++;
        g.timer = g.interval;

        if (g.spawned >= g.count) {
          this.activeGroups.splice(i, 1);
        }
      }
    }
  },

  spawnEnemy(group, state) {
    const entries = Game.Map.entries;
    if (entries.length === 0) return;
    const entry = entries[group.entryIndex % entries.length];
    const enemy = new Game.Enemy(group.enemyType, entry.col, entry.row, this.waveIndex);
    state.enemies.push(enemy);
  },

  startBetweenWaves() {
    this.betweenWaves = true;
    this.betweenWaveTimer = Game.Config.BETWEEN_WAVE_TIME;
    // Mark wave completion time for auto-start handling
    if (Game.state && Game.state.kingdom && Game.state.kingdom.waves) {
      Game.state.kingdom.waves.lastWaveEndTime = performance.now();
    }
  },

  getCurrentWave() {
    return this.waveIndex;
  },

  getTotalWaves() {
    return this.waves ? this.waves.length : 0;
  },
};
