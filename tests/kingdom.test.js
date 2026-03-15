import { describe, it, expect, beforeEach } from 'vitest';

// Load Kingdom module
require('../js/kingdom.js');

let mockState;

beforeEach(() => {
  mockState = {
    kingdom: {
      population: {
        current: 5,
        capacity: 5,
        residents: [
          { id: 0, assignedJob: null, state: 'idle', hp: 10 },
          { id: 1, assignedJob: null, state: 'idle', hp: 10 },
          { id: 2, assignedJob: null, state: 'idle', hp: 10 },
          { id: 3, assignedJob: null, state: 'idle', hp: 10 },
          { id: 4, assignedJob: null, state: 'idle', hp: 10 }
        ],
        jobs: { lumberjack: 0 }
      }
    }
  };
  global.Game = {
    state: mockState,
    Config: {
      JOBS: {
        lumberjack: { name: 'Lumberjack', resourceType: 'wood' }
      }
    },
    Kingdom: {
      getPopulation() {
        return Game.state.kingdom.population.residents.length;
      },
      getCapacity() {
        return Game.state.kingdom.population.capacity;
      },
      getFreeResidents() {
        return Game.state.kingdom.population.residents.filter(r => !r.assignedJob && r.state !== 'dead').length;
      },
      getJobCount(jobType) {
        return Game.state.kingdom.population.jobs[jobType] || 0;
      },
      assignJob(residentId, jobType) {
        const resident = this.getResident(residentId);
        if (!resident || resident.assignedJob) {
          return false;
        }
        resident.assignedJob = jobType;
        resident.state = 'idle';
        if (!Game.state.kingdom.population.jobs[jobType]) {
          Game.state.kingdom.population.jobs[jobType] = 0;
        }
        Game.state.kingdom.population.jobs[jobType]++;
        return true;
      },
      unassignJob(residentId) {
        const resident = this.getResident(residentId);
        if (!resident || !resident.assignedJob) {
          return false;
        }
        const jobType = resident.assignedJob;
        resident.assignedJob = null;
        resident.state = 'idle';
        if (Game.state.kingdom.population.jobs[jobType]) {
          Game.state.kingdom.population.jobs[jobType]--;
        }
        return true;
      },
      getResident(id) {
        return Game.state.kingdom.population.residents.find(r => r.id === id) || null;
      },
      killResident(residentId) {
        const resident = this.getResident(residentId);
        if (!resident) return;
        resident.state = 'dead';
        resident.hp = 0;
        if (resident.assignedJob) {
          this.unassignJob(residentId);
        }
      },
      getActiveResidents() {
        return Game.state.kingdom.population.residents.filter(r => r.state !== 'dead');
      }
    }
  };
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
});
