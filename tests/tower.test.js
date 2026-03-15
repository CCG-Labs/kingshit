import { describe, it, expect, beforeEach } from 'vitest';

// Config and Tower are loaded in setup.js
const { Config } = require('../js/config.js');
const { Tower } = require('../js/tower.js');

describe('Game.Tower', () => {
  let tower;

  beforeEach(() => {
    tower = new Game.Tower('arrow', 0, 0);
  });

  describe('upgrade mechanics', () => {
    it('getUpgradeCost should return correct cost at level 1', () => {
      const cost = tower.getUpgradeCost();
      const expected = Math.round(50 * Config.UPGRADE_COST_MULT);
      expect(cost).toBe(expected);
    });

    it('getSellValue should return refund value at level 1', () => {
      const value = tower.getSellValue();
      const expected = Math.round(50 * Config.SELL_REFUND_RATE);
      expect(value).toBe(expected);
    });

    it('upgrade should increment level and increase totalInvested', () => {
      const initialLevel = tower.level;
      const initialInvested = tower.totalInvested;
      tower.upgrade();
      expect(tower.level).toBe(initialLevel + 1);
      expect(tower.totalInvested).toBeGreaterThan(initialInvested);
    });

    it('frost tower level 3 upgrade should set slowAmount to 0.60', () => {
      const frostTower = new Game.Tower('frost', 75, 75);
      // Upgrade twice: level 1 -> 2, then level 2 -> 3
      frostTower.upgrade(); // Now level 2
      frostTower.upgrade(); // Now level 3, which triggers applyL3Upgrade()
      expect(frostTower.slowAmount).toBe(0.60);
    });
  });

  describe('targeting modes', () => {
    const mockEnemy = (hp, progress, x = 0, y = 0) => ({
      dead: false,
      escaped: false,
      flying: false,
      hp,
      progress,
      x,
      y,
      distTo(tx, ty) {
        return Math.sqrt((this.x - tx) ** 2 + (this.y - ty) ** 2);
      },
    });

    it('findTarget with empty enemy list should return null', () => {
      const result = tower.findTarget([]);
      expect(result).toBeNull();
    });

    it('findTarget with strongest mode should return enemy with highest HP', () => {
      tower.targetMode = 'strongest';
      // Tower is at (24, 24), create enemies within range (150)
      const enemies = [
        mockEnemy(50, 0.5, 50, 50),
        mockEnemy(100, 0.5, 60, 60),
        mockEnemy(75, 0.5, 40, 40),
      ];
      const target = tower.findTarget(enemies);
      expect(target).not.toBeNull();
      expect(target.hp).toBe(100);
    });

    it('findTarget with nearest mode should return closest enemy', () => {
      tower.targetMode = 'nearest';
      // Tower is at (24, 24), create enemies within range
      const enemies = [
        mockEnemy(50, 0.5, 100, 100),
        mockEnemy(50, 0.5, 30, 30),
        mockEnemy(50, 0.5, 50, 50),
      ];
      const target = tower.findTarget(enemies);
      expect(target).not.toBeNull();
      // Enemy at (30, 30) is closest to tower at (24, 24)
      const dist = target.distTo(tower.x, tower.y);
      expect(dist).toBeLessThan(20);
    });

    it('findTarget with first mode should return enemy with highest progress', () => {
      tower.targetMode = 'first';
      // Tower is at (24, 24), create enemies within range
      const enemies = [
        mockEnemy(50, 0.3, 30, 30),
        mockEnemy(50, 0.8, 40, 40),
        mockEnemy(50, 0.5, 50, 50),
      ];
      const target = tower.findTarget(enemies);
      expect(target).not.toBeNull();
      expect(target.progress).toBe(0.8);
    });

    it('findTarget should ignore dead and escaped enemies', () => {
      tower.targetMode = 'strongest';
      // Tower is at (24, 24), create enemies within range
      const enemies = [
        { ...mockEnemy(100, 0.5, 30, 30), dead: true },
        { ...mockEnemy(80, 0.5, 40, 40), escaped: true },
        mockEnemy(60, 0.5, 50, 50),
      ];
      const target = tower.findTarget(enemies);
      expect(target).not.toBeNull();
      expect(target.hp).toBe(60);
    });

    it('findTarget should check canHitFlying for flying enemies', () => {
      tower.canHitFlying = false;
      // Tower is at (24, 24), create enemies within range
      const enemies = [
        { ...mockEnemy(50, 0.5, 30, 30), flying: true },
        mockEnemy(40, 0.5, 40, 40),
      ];
      const target = tower.findTarget(enemies);
      expect(target).not.toBeNull();
      expect(target.flying).toBe(false);
    });
  });
});
