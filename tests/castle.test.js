import { describe, it, expect, beforeEach } from 'vitest';

// Load Castle module
require('../js/castle.js');

let mockState;

beforeEach(() => {
  const residents = [];
  for (let i = 0; i < 5; i++) {
    residents.push({ id: i });
  }
  mockState = {
    kingdom: {
      resources: { wood: 500 },
      population: { capacity: 5, current: 5, residents },
      castle: { level: 1, hp: 500, maxHp: 500, lastArcherFireTime: 0 }
    }
  };
  global.Game = {
    state: mockState,
    Config: {
      GRID_COLS: 100,
      GRID_ROWS: 100,
      RESIDENT_HP: 10,
      CASTLE_UPGRADES: [
        { level: 1, popCapacity: 5, hp: 500, cost: {}, archerDamage: 10, archerRange: 300 },
        { level: 2, popCapacity: 8, hp: 700, cost: { wood: 100 }, archerDamage: 15, archerRange: 350 },
        { level: 3, popCapacity: 12, hp: 950, cost: { wood: 150 }, archerDamage: 20, archerRange: 400 }
      ]
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
    },
    Castle: Game.Castle
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
