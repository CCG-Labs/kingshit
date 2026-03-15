import { describe, it, expect, beforeEach } from 'vitest';

// Config and Enemy are loaded in setup.js
const { Config } = require('../js/config.js');
const { Enemy } = require('../js/enemy.js');

describe('Game.Enemy', () => {
  let enemy;

  beforeEach(() => {
    enemy = new Game.Enemy('goblin', 0, 0, 1);
  });

  // Helper to create mock enemies for testing
  const createMockEnemy = (type, waveNum) => {
    return new Game.Enemy(type, 0, 0, waveNum);
  };

  describe('constructor and wave scaling', () => {
    it('should apply wave HP scaling', () => {
      const baseHp = Config.ENEMIES.goblin.hp;
      const wave2Enemy = new Game.Enemy('goblin', 0, 0, 2);
      const expectedHp = Math.round(baseHp * Math.pow(Config.WAVE_HP_SCALING, 2 - 1));
      expect(wave2Enemy.hp).toBe(expectedHp);
    });

    it('should have correct max HP after scaling', () => {
      const enemy2 = new Game.Enemy('soldier', 0, 0, 1);
      expect(enemy2.maxHp).toBe(enemy2.hp);
    });
  });

  describe('damage and armor', () => {
    it('takeDamage should reduce HP correctly', () => {
      const initialHp = enemy.hp;
      enemy.takeDamage(10);
      expect(enemy.hp).toBe(initialHp - 10);
    });

    it('takeDamage should not reduce HP below 0', () => {
      enemy.hp = 5;
      enemy.takeDamage(100);
      expect(enemy.hp).toBe(0);
    });

    it('takeDamage should respect armor', () => {
      const armored = new Game.Enemy('soldier', 0, 0, 1);
      const initialHp = armored.hp;
      armored.takeDamage(10);
      // Armor reduces damage, so HP reduction should be less than 10
      expect(armored.hp).toBeGreaterThan(initialHp - 10);
    });

    it('armor should have minimum damage of 1', () => {
      const armored = new Game.Enemy('knight', 0, 0, 1);
      const initialHp = armored.hp;
      armored.takeDamage(1);
      expect(armored.hp).toBeLessThan(initialHp);
    });
  });

  describe('shield mechanics', () => {
    it('shield should absorb damage before HP', () => {
      const shielded = createMockEnemy('shielded', 1);
      const shieldBefore = shielded.shieldHp;
      const hpBefore = shielded.hp;
      shielded.takeDamage(50);
      const shieldAfter = shielded.shieldHp;
      expect(shieldAfter).toBe(Math.max(0, shieldBefore - 50));
      if (shieldBefore >= 50) {
        expect(shielded.hp).toBe(hpBefore);
      }
    });

    it('shield overflow should reduce HP', () => {
      const shielded = createMockEnemy('shielded', 1);
      const totalHp = shielded.shieldHp + shielded.hp;
      shielded.takeDamage(totalHp + 10);
      expect(shielded.shieldHp).toBe(0);
      expect(shielded.hp).toBe(0);
    });
  });

  describe('status effects', () => {
    it('applySlow should add slow effect', () => {
      const slowEffect = enemy.statusEffects.find(e => e.type === 'slow');
      expect(slowEffect).toBeUndefined();
      enemy.applySlow(0.5, 2.0);
      const slowAfter = enemy.statusEffects.find(e => e.type === 'slow');
      expect(slowAfter).toBeDefined();
      expect(slowAfter.amount).toBe(0.5);
    });

    it('stronger slow should replace weaker slow', () => {
      enemy.applySlow(0.3, 2.0);
      enemy.applySlow(0.6, 2.0);
      const slowEffect = enemy.statusEffects.find(e => e.type === 'slow');
      expect(slowEffect.amount).toBe(0.6);
    });

    it('applyStun should add stun effect', () => {
      enemy.applyStun(1.0);
      const stunEffect = enemy.statusEffects.find(e => e.type === 'stun');
      expect(stunEffect).toBeDefined();
      expect(stunEffect.duration).toBe(1.0);
    });

    it('applyDot should stack multiple effects', () => {
      const initialDotCount = enemy.statusEffects.filter(e => e.type === 'dot').length;
      enemy.applyDot(5, 3.0);
      enemy.applyDot(3, 2.0);
      const dotCount = enemy.statusEffects.filter(e => e.type === 'dot').length;
      expect(dotCount).toBeGreaterThan(initialDotCount);
    });

    it('updateStatusEffects should remove expired effects', () => {
      enemy.applyDot(5, 0.5);
      const dotBefore = enemy.statusEffects.filter(e => e.type === 'dot').length;
      enemy.updateStatusEffects(1.0); // Time > duration
      const dotAfter = enemy.statusEffects.filter(e => e.type === 'dot').length;
      expect(dotAfter).toBeLessThan(dotBefore);
    });
  });
});
