window.Game = window.Game || {};

Game.Config = {
  // Grid (world-space logic grid)
  TILE_SIZE: 48,
  GRID_COLS: 100,
  GRID_ROWS: 100,

  // Viewport
  VIEWPORT_W: 1100,
  VIEWPORT_H: 670,
  EDGE_SCROLL_MARGIN: 40,
  EDGE_SCROLL_SPEED: 400,

  // Isometric projection
  ISO_TILE_W: 64,
  ISO_TILE_H: 32,

  // Tile types
  TILE: {
    BLOCKED: 0,
    BUILDABLE: 1,
    PATH: 2,
    ENTRY: 3,
    EXIT: 4,
  },

  // Terrain types for splatting
  TERRAIN: {
    GRASS: 0,
    FOREST: 1,
    MOUNTAIN: 2,
    WATER: 3,
  },

  // Game balance
  STARTING_GOLD: 200,
  STARTING_LIVES: 20,
  INTEREST_RATE: 0.02,
  INTEREST_CAP: 20,
  EARLY_START_BONUS: 0.1,
  SELL_REFUND_RATE: 0.6,
  WAVE_HP_SCALING: 1.08,
  WAVE_GOLD_SCALING: 1.03,
  WAVE_ATTACK_SCALING: 1.04,

  // Structure HP
  CASTLE_HP: 500,
  UPGRADE_HP_MULT: 1.4,
  TOWER_REGEN_RATE: 0.25, // fraction of maxHP per second between waves
  BETWEEN_WAVE_TIME: 15,
  BOSS_LIFE_COST: 5,

  // Upgrade scaling per level
  UPGRADE_DAMAGE_MULT: 1.4,
  UPGRADE_RANGE_MULT: 1.15,
  UPGRADE_RATE_MULT: 0.8, // lower is faster
  UPGRADE_COST_MULT: 0.6, // fraction of cumulative cost
  MAX_TOWER_LEVEL: 3,

  // Tower definitions
  TOWERS: {
    arrow: {
      name: 'Arrow Tower',
      cost: 50,
      hp: 100,
      range: 150,
      fireRate: 0.4,
      damage: 8,
      color: '#8B6914',
      projectileSpeed: 500,
      projectileColor: '#8B6914',
      canHitFlying: true,
      special: null,
      description: 'Fast, reliable damage',
      l3: 'Double shot',
    },
    cannon: {
      name: 'Cannon Tower',
      cost: 100,
      hp: 180,
      range: 120,
      fireRate: 1.5,
      damage: 40,
      color: '#555555',
      projectileSpeed: 350,
      projectileColor: '#333333',
      canHitFlying: false,
      special: 'splash',
      splashRadius: 60,
      description: 'Slow, AoE splash damage',
      l3: 'Stun 0.5s on hit',
    },
    frost: {
      name: 'Frost Tower',
      cost: 75,
      hp: 120,
      range: 130,
      fireRate: 0.8,
      damage: 5,
      color: '#88CCEE',
      projectileSpeed: 400,
      projectileColor: '#AADDFF',
      canHitFlying: false,
      special: 'slow',
      slowAmount: 0.4,
      slowDuration: 2.0,
      description: 'Slows enemies',
      l3: '60% slow, 3s duration',
    },
    lightning: {
      name: 'Lightning Tower',
      cost: 125,
      hp: 160,
      range: 160,
      fireRate: 1.0,
      damage: 25,
      color: '#FFD700',
      projectileSpeed: Infinity,
      projectileColor: '#FFFF44',
      canHitFlying: true,
      special: 'chain',
      chainCount: 3,
      chainRange: 80,
      description: 'Chains to nearby enemies',
      l3: 'Chains to 5 enemies',
    },
    sniper: {
      name: 'Sniper Tower',
      cost: 150,
      hp: 140,
      range: 250,
      fireRate: 2.5,
      damage: 80,
      color: '#8B0000',
      projectileSpeed: 800,
      projectileColor: '#FF4444',
      canHitFlying: true,
      special: 'pierceArmor',
      description: 'Long range, ignores armor',
      l3: '25% crit chance (2x)',
    },
    flame: {
      name: 'Flame Tower',
      cost: 100,
      hp: 150,
      range: 90,
      fireRate: 0.1,
      damage: 1.5,
      color: '#FF6600',
      projectileSpeed: 0,
      projectileColor: '#FF4400',
      canHitFlying: false,
      special: 'cone',
      coneAngle: Math.PI / 3,
      dotDamage: 3,
      dotDuration: 3.0,
      description: 'Continuous AoE cone, burn DoT',
      l3: 'Increasing damage over time',
    },
  },

  // Tower build order for UI
  TOWER_ORDER: ['arrow', 'cannon', 'frost', 'lightning', 'sniper', 'flame'],

  // Enemy definitions
  ENEMIES: {
    goblin: {
      name: 'Goblin',
      hp: 30,
      speed: 80,
      armor: 0,
      gold: 5,
      color: '#44AA44',
      radius: 8,
      flying: false,
      attackMin: 2,
      attackMax: 4,
      attackRate: 1.5,
      aggression: 0.0,
    },
    soldier: {
      name: 'Soldier',
      hp: 80,
      speed: 50,
      armor: 3,
      gold: 10,
      color: '#888888',
      radius: 10,
      flying: false,
      attackMin: 5,
      attackMax: 10,
      attackRate: 1.2,
      aggression: 0.3,
    },
    wolf_rider: {
      name: 'Wolf Rider',
      hp: 50,
      speed: 130,
      armor: 0,
      gold: 12,
      color: '#8B5A2B',
      radius: 9,
      flying: false,
      shape: 'diamond',
      attackMin: 3,
      attackMax: 5,
      attackRate: 1.0,
      aggression: 0.0,
    },
    knight: {
      name: 'Knight',
      hp: 200,
      speed: 40,
      armor: 8,
      gold: 20,
      color: '#C0C0C0',
      radius: 13,
      flying: false,
      attackMin: 10,
      attackMax: 18,
      attackRate: 1.5,
      aggression: 0.8,
    },
    healer: {
      name: 'Healer',
      hp: 60,
      speed: 55,
      armor: 0,
      gold: 15,
      color: '#44CC44',
      radius: 9,
      flying: false,
      special: 'heal',
      healRate: 5,
      healRange: 60,
      attackMin: 1,
      attackMax: 3,
      attackRate: 2.0,
      aggression: 0.0,
    },
    flyer: {
      name: 'Flyer',
      hp: 70,
      speed: 70,
      armor: 0,
      gold: 18,
      color: '#9966CC',
      radius: 9,
      flying: true,
      attackMin: 0,
      attackMax: 0,
      attackRate: 0,
      aggression: 0.0,
    },
    shielded: {
      name: 'Shielded',
      hp: 100,
      speed: 50,
      armor: 0,
      gold: 15,
      color: '#4488CC',
      radius: 11,
      flying: false,
      special: 'shield',
      shieldHp: 80,
      attackMin: 4,
      attackMax: 8,
      attackRate: 1.3,
      aggression: 0.2,
    },
    boss: {
      name: 'Boss',
      hp: 1500,
      speed: 30,
      armor: 15,
      gold: 100,
      color: '#CC2222',
      radius: 20,
      flying: false,
      attackMin: 20,
      attackMax: 35,
      attackRate: 2.0,
      aggression: 1.0,
    },
  },

  // Targeting modes
  TARGET_MODES: ['first', 'last', 'strongest', 'weakest', 'nearest'],

  // Game speeds
  GAME_SPEEDS: [1, 2, 3],

  // Visual
  COLORS: {
    background: '#2d5a1b',
    path: '#8b7355',
    pathBorder: '#6b5335',
    buildable: '#3a6b24',
    buildableHover: 'rgba(255,255,255,0.15)',
    blocked: '#2d5a1b',
    entry: '#cc4444',
    exit: '#4444cc',
    healthBarBg: '#333333',
    healthBarFg: '#44cc44',
    healthBarLow: '#cc4444',
    shieldBar: '#4488FF',
    goldText: '#FFD700',
    uiBg: 'rgba(0,0,0,0.75)',
    uiBorder: '#666666',
    uiText: '#FFFFFF',
    uiTextDim: '#AAAAAA',
    rangeCircle: 'rgba(255,255,255,0.15)',
    rangeCircleInvalid: 'rgba(255,0,0,0.15)',
    placementValid: 'rgba(0,255,0,0.3)',
    placementInvalid: 'rgba(255,0,0,0.3)',
  },

  // === KINGDOM-BUILDING (Phase 1) ===

  // Population & Residents
  RESIDENT_HP: 10,
  RESIDENT_COMBAT_DMG: 5,
  RESIDENT_THREAT_RANGE: 250, // pixels; flee if enemy within this
  RESIDENT_SPEED: 80, // pixels/sec

  // Lumberjack Job
  LUMBERJACK_WORK_TIME: 15000, // ms to chop one tree
  LUMBERJACK_RESOURCE_GAIN: 10, // wood per tree
  SEEK_TIMEOUT: 30000, // ms; if no tree found, give up

  // Tree Spawning
  TREE_SPAWN_INTERVAL: 60000, // 1 tree per minute
  TREE_SPAWN_REJECTION_SAMPLES: 10, // rejection sampling attempts

  // Castle & Archers
  ARCHER_FIRE_RATE: 5000, // ms between archer volleys

  // Wave Timing
  AUTO_WAVE_DELAY: 45000, // ms before auto-starting next wave

  // Job Definitions
  JOBS: {
    lumberjack: {
      name: 'Lumberjack',
      description: 'Gathers wood from trees',
      resourceType: 'wood',
      resourcePerCompletion: 10, // LUMBERJACK_RESOURCE_GAIN
      workTime: 15000, // LUMBERJACK_WORK_TIME
      seekTimeout: 30000, // SEEK_TIMEOUT
      speed: 80, // RESIDENT_SPEED
    },
  },

  // Castle Upgrade Definitions (Phase 1: levels 1-3 only)
  CASTLE_UPGRADES: [
    {
      level: 1,
      name: 'Stockade',
      description: 'A simple perimeter of sharpened wooden stakes.',
      popCapacity: 5,
      hp: 500,
      archerDamage: 10,
      archerRange: 300,
      cost: {}, // Starting level, no cost
    },
    {
      level: 2,
      name: 'Palisade',
      description: 'Taller, more deliberate wooden wall construction.',
      popCapacity: 8,
      hp: 700,
      archerDamage: 12,
      archerRange: 320,
      cost: { wood: 100 },
    },
    {
      level: 3,
      name: 'Motte',
      description: 'An earthen mound with a timber tower on top.',
      popCapacity: 12,
      hp: 950,
      archerDamage: 15,
      archerRange: 350,
      cost: { wood: 150 },
    },
  ],
};

if (typeof module !== 'undefined') module.exports = { Config: Game.Config };
