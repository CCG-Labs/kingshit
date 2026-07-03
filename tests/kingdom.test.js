import { describe, it, expect, beforeEach } from 'vitest';

// Setup window for Node/Vitest environment
global.window = global;

// Initialize Game globally once
global.Game = {
  Config: {
    JOBS: {
      lumberjack: { name: 'Lumberjack', resourceType: 'wood' }
    },
    GRID_COLS: 100,
    GRID_ROWS: 100,
    TILE_SIZE: 48,
    LUMBERJACK_WORK_TIME: 15000,
    LUMBERJACK_RESOURCE_GAIN: 10,
    SEEK_TIMEOUT: 30000,
    RESIDENT_THREAT_RANGE: 250,
    RESIDENT_SPEED: 80
  },
  Resources: {
    add(resourceType, amount) {
      // Mock resource addition
    }
  },
  Map: null,
  Renderer: null
};

// Load Kingdom module to populate Game.Kingdom
require('../js/kingdom.js');

let mockState;

beforeEach(() => {
  mockState = {
    kingdom: {
      population: {
        current: 5,
        capacity: 5,
        residents: [
          { id: 0, assignedJob: null, state: 'idle', hp: 10, gridPos: { col: 0, row: 0 }, progress: 0 },
          { id: 1, assignedJob: null, state: 'idle', hp: 10, gridPos: { col: 0, row: 0 }, progress: 0 },
          { id: 2, assignedJob: null, state: 'idle', hp: 10, gridPos: { col: 0, row: 0 }, progress: 0 },
          { id: 3, assignedJob: null, state: 'idle', hp: 10, gridPos: { col: 0, row: 0 }, progress: 0 },
          { id: 4, assignedJob: null, state: 'idle', hp: 10, gridPos: { col: 0, row: 0 }, progress: 0 }
        ],
        jobs: { lumberjack: 0 }
      },
      trees: []
    },
    enemies: []
  };
  // Only update state, don't replace whole Game object
  Game.state = mockState;
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

  it('returns null for nonexistent resident', () => {
    const resident = Game.Kingdom.getResident(999);
    expect(resident).toBeNull();
  });

  it('gets active residents excluding dead', () => {
    Game.Kingdom.killResident(0);
    Game.Kingdom.killResident(1);
    const active = Game.Kingdom.getActiveResidents();
    expect(active.length).toBe(3);
  });

  it('gets job count', () => {
    Game.Kingdom.assignJob(0, 'lumberjack');
    Game.Kingdom.assignJob(1, 'lumberjack');
    expect(Game.Kingdom.getJobCount('lumberjack')).toBe(2);
  });

  it('resident seeks tree when assigned to lumberjack', () => {
    Game.state.kingdom.trees = [
      { col: 10, row: 10, harvested: false },
      { col: 20, row: 20, harvested: false }
    ];
    Game.state.kingdom.population.residents[0].gridPos = { col: 0, row: 0 };
    Game.Kingdom.assignJob(0, 'lumberjack');
    Game.Kingdom.updateResident(0, 0.016);
    const resident = Game.state.kingdom.population.residents[0];
    expect(resident.state).toBe('moving');
    expect(resident.target).not.toBeNull();
  });

  it('resident transitions to working when at tree', () => {
    const tree = { col: 5, row: 5, harvested: false };
    Game.state.kingdom.trees = [tree];
    Game.Config.LUMBERJACK_WORK_TIME = 1000;
    const resident = Game.state.kingdom.population.residents[0];
    resident.gridPos = { col: 5, row: 5 };
    resident.state = 'moving';
    resident.target = { col: 5, row: 5 };
    resident.assignedJob = 'lumberjack';
    Game.Kingdom.updateResident(0, 0.016);
    expect(resident.state).toBe('working');
  });

  it('resident flees when enemy nearby', () => {
    const resident = Game.state.kingdom.population.residents[0];
    resident.gridPos = { col: 50, row: 50 };
    resident.state = 'idle';
    // Mock enemy nearby
    Game.state.enemies = [{ x: 50 * 48, y: 50 * 48 }];
    Game.Renderer = {
      worldToScreen: (x, y) => ({ x, y })
    };
    Game.Config.RESIDENT_THREAT_RANGE = 250;
    Game.Kingdom.updateResident(0, 0.016);
    expect(resident.state).toBe('fleeing');
  });
});
