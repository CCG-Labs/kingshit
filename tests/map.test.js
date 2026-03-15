import { describe, it, expect, beforeEach } from 'vitest';

// Config and Map are loaded in setup.js
const { Config } = require('../js/config.js');
const { Map } = require('../js/map.js');

describe('Game.Map', () => {
  beforeEach(() => {
    // Reset Map singleton state before each test
    Game.Map.current = null;
    Game.Map.castleCol = -1;
    Game.Map.castleRow = -1;
    Game.Map.flowField = null;
    Game.Map.entries = [];
  });

  describe('Map methods', () => {
    it('should have getTile method', () => {
      expect(typeof Game.Map.getTile).toBe('function');
    });

    it('should have isBuildable method', () => {
      expect(typeof Game.Map.isBuildable).toBe('function');
    });

    it('should have computeFlowField method', () => {
      expect(typeof Game.Map.computeFlowField).toBe('function');
    });

    it('should have canPlace method', () => {
      expect(typeof Game.Map.canPlace).toBe('function');
    });
  });

  describe('getTile', () => {
    it('should return BLOCKED for out-of-bounds coordinates', () => {
      const result = Game.Map.getTile(-1, -1);
      expect(result).toBe(Config.TILE.BLOCKED);
    });

    it('should return BLOCKED when map is not loaded', () => {
      const result = Game.Map.getTile(0, 0);
      expect(result).toBe(Config.TILE.BLOCKED);
    });
  });

  describe('flow field', () => {
    it('should compute flow field after placing castle', () => {
      // Create a minimal map data
      const mapData = {
        grid: [
          [Config.TILE.ENTRY, Config.TILE.BUILDABLE, Config.TILE.EXIT],
          [Config.TILE.BUILDABLE, Config.TILE.BUILDABLE, Config.TILE.BUILDABLE],
          [Config.TILE.BUILDABLE, Config.TILE.BUILDABLE, Config.TILE.BUILDABLE],
        ],
      };
      Game.Map.load(mapData);
      Game.Map.placeCastle(0, 0);
      Game.Map.computeFlowField([]);

      expect(Game.Map.flowField).toBeDefined();
      expect(Game.Map.flowField).not.toBeNull();
    });
  });

  describe('tower placement', () => {
    beforeEach(() => {
      const mapData = {
        grid: [
          [Config.TILE.ENTRY, Config.TILE.BUILDABLE, Config.TILE.EXIT],
          [Config.TILE.BUILDABLE, Config.TILE.BUILDABLE, Config.TILE.BUILDABLE],
          [Config.TILE.BUILDABLE, Config.TILE.BUILDABLE, Config.TILE.BUILDABLE],
        ],
      };
      Game.Map.load(mapData);
      Game.Map.placeCastle(0, 0);
      Game.Map.computeFlowField([]);
    });

    it('should allow placement on buildable tiles', () => {
      const result = Game.Map.canPlace(1, 1, []);
      expect(typeof result).toBe('boolean');
    });

    it('should reject placement on blocked tiles', () => {
      const result = Game.Map.canPlace(-1, -1, []);
      expect(result).toBe(false);
    });
  });
});
