import { describe, it, expect, beforeEach } from 'vitest';

// Load Config and Resources modules
const { Config } = require('../js/config.js');
require('../js/resources.js');

let mockState;

beforeEach(() => {
  mockState = {
    kingdom: {
      resources: { wood: 0 }
    }
  };
  global.Game = {
    state: mockState,
    Resources: Game.Resources
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
    expect(Game.state.kingdom.resources.wood).toBe(10);
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
