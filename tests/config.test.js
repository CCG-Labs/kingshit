import { describe, it, expect } from 'vitest';

// Config is loaded in setup.js
const { Config } = require('../js/config.js');

describe('Config', () => {
  describe('Tower definitions', () => {
    it('should have exactly 6 tower types', () => {
      const towers = Object.keys(Config.TOWERS);
      expect(towers).toHaveLength(6);
    });

    it('should have all required tower types', () => {
      const required = ['arrow', 'cannon', 'frost', 'lightning', 'sniper', 'flame'];
      const towers = Object.keys(Config.TOWERS);
      required.forEach(type => {
        expect(towers).toContain(type);
      });
    });

    it('all towers should have required fields', () => {
      const required = ['cost', 'hp', 'range', 'damage', 'fireRate'];
      Object.values(Config.TOWERS).forEach(tower => {
        required.forEach(field => {
          expect(tower).toHaveProperty(field);
          expect(typeof tower[field]).not.toBe('undefined');
        });
      });
    });

    it('no tower should have cost <= 0', () => {
      Object.values(Config.TOWERS).forEach(tower => {
        expect(tower.cost).toBeGreaterThan(0);
      });
    });
  });

  describe('Enemy definitions', () => {
    it('should have exactly 8 enemy types', () => {
      const enemies = Object.keys(Config.ENEMIES);
      expect(enemies).toHaveLength(8);
    });

    it('should have all required enemy types', () => {
      const required = [
        'goblin',
        'soldier',
        'wolf_rider',
        'knight',
        'healer',
        'flyer',
        'shielded',
        'boss',
      ];
      const enemies = Object.keys(Config.ENEMIES);
      required.forEach(type => {
        expect(enemies).toContain(type);
      });
    });

    it('all enemies should have required fields', () => {
      const required = ['hp', 'speed', 'gold'];
      Object.values(Config.ENEMIES).forEach(enemy => {
        required.forEach(field => {
          expect(enemy).toHaveProperty(field);
          expect(typeof enemy[field]).not.toBe('undefined');
        });
      });
    });
  });

  describe('Game balance constants', () => {
    it('SELL_REFUND_RATE should be between 0 and 1', () => {
      expect(Config.SELL_REFUND_RATE).toBeGreaterThan(0);
      expect(Config.SELL_REFUND_RATE).toBeLessThan(1);
    });

    it('UPGRADE_COST_MULT should be between 0 and 1', () => {
      expect(Config.UPGRADE_COST_MULT).toBeGreaterThan(0);
      expect(Config.UPGRADE_COST_MULT).toBeLessThan(1);
    });

    it('WAVE_HP_SCALING should be > 1', () => {
      expect(Config.WAVE_HP_SCALING).toBeGreaterThan(1);
    });
  });
});
