# Kingdom-Building System Design

**Date:** 2026-03-15
**Status:** Design Review
**Scope:** Phase 1 — Population, jobs (lumberjack), resources, and castle upgrades

---

## 1. Overview

KINGSHIT is a tower defense game. This design adds a kingdom-building layer: players manage a population of workers, assign them to jobs to gather resources, and spend those resources to upgrade their castle. The castle itself becomes a defensive asset with resident archers.

### Design Principles

- **Simple first:** Start with population + 1 job (lumberjack) + 1 resource (wood). Expand later.
- **Configuration-driven:** All timings, costs, job mechanics live in `config.js` for easy balancing.
- **Resource immersion:** Workers are active entities on the map with movement, state, and vulnerability. Not abstract income.
- **Castle as nexus:** The castle is where workers live, where resources go, where archers spawn, and what you defend.

---

## 2. Architecture

### New Modules

| Module | Responsibility |
|--------|-----------------|
| `kingdom.js` | Population tracking, job assignment, resident lifecycle |
| `castle.js` | Castle levels, HP, upgrades, archer mechanics |
| `resources.js` | Resource inventory, gathering, spending |

These integrate with existing modules:
- `main.js` — Adds castle/population state to `Game.state`
- `config.js` — Defines timings, costs, job mechanics
- `renderer.js` — Draws residents, trees, HUD elements
- `ui.js` — Population panel, upgrade buttons, resource/castle displays in top bar

### State Structure

`Game.state` gains:

```javascript
{
  // ... existing state ...

  resources: {
    wood: 0,
    stone: 0,
    // future resources here
  },

  population: {
    current: 5,      // free residents
    capacity: 5,     // max population
    residents: [
      // { id, assignedJob: 'lumberjack', state: 'seeking', ... }
    ]
  },

  castle: {
    level: 1,        // Stockade to Castle (1-10)
    hp: 500,
    maxHp: 500,
    archers: 5,      // number of residents with bows
    lastArcherTime: 0 // for 5-second fire rate
  },

  waves: {
    lastWaveEndTime: 0,
    autoStartDelay: 45000 // ms (configurable)
  }
}
```

---

## 3. Population & Job System

### Job Definition (in config.js)

Each job is a template:

```javascript
Game.Config.JOBS = {
  lumberjack: {
    name: 'Lumberjack',
    description: 'Gathers wood from trees',
    resourceType: 'wood',
    resourcePerCompletion: 10,
    seekTime: 5000,      // max time to find a target
    workTime: 15000,     // time to complete work (chop)
    returnTime: 5000,    // estimate for pathfinding
    speed: 80,           // pixels/sec
    combatDamage: 5,     // damage dealt to enemies
  }
}
```

### Resident Instance

Each resident has:

```javascript
{
  id: unique,
  assignedJob: 'lumberjack' | null,
  gridPos: { col, row },
  state: 'idle' | 'seeking' | 'moving' | 'working' | 'returning' | 'fleeing' | 'dead',
  target: { col, row } | null,
  progress: 0-1,          // work completion fraction
  hp: 10,
  maxHp: 10,
  path: [ {col, row}, ...] // current pathfinding plan
}
```

### Population Management UI

Player clicks "Pop: 3/5" in top bar → opens overlay panel:

```
POPULATION MANAGEMENT
Current: 3/5

Lumberjack: 1  [-] [+]
  Idle: 1/1

[Free Workers: 2]
```

- `[+]` assigns a free worker to that job
- `[-]` unassigns, making them free
- Only display jobs where there are workers or free slots available
- Click outside to close

---

## 4. Lumberjack Mechanics (Job #1)

### Tree Spawning

- **Spawn rate:** 1 tree per minute of gameplay (configurable in config as `TREE_SPAWN_INTERVAL`)
- **Spawn location:** Random empty cell on buildable or grass terrain (no buildings, rocks, enemies, other trees)
- **Map limit:** No hard cap yet (can revisit if trees overwhelm the map)

### Resident Work Loop

1. **Idle → Seeking:**
   - If assigned and on map, search map for nearest tree within visibility range
   - If found, set target to tree; state = 'moving'
   - If not found within timeout, stay idle (retry next frame)

2. **Moving → Working:**
   - Pathfind to tree using BFS (same as enemies)
   - On arrival, state = 'working', start progress timer (15s)
   - Cannot be interrupted (unless killed or forced to flee)

3. **Working → Returning:**
   - After 15s, mark tree as "chopped" (remove from map or mark as harvested)
   - State = 'returning', target = castle position
   - Pathfind back to castle

4. **Returning → Idle:**
   - On arrival at castle (within 1 tile), add resource to inventory
   - State = 'idle', target = null
   - Go back to step 1

### Enemy Interaction

**Fleeing:**
- If any enemy exists on the map, all active residents switch to state = 'fleeing'
- They pathfind directly to castle (shortest path, ignore job state)
- On castle arrival, state = 'idle', can resume work next cycle

**Combat:**
- If an enemy attacks a resident, they deal ~5 damage back (configurable)
- Residents have 10 HP (configurable), can be killed
- On death: remove resident from game, lose any in-transit resources
- Weak combat doesn't prevent enemy victory, just provides minor friction

### Rendering

- Draw residents as small sprites (16x16 or similar) with a distinct color (green for lumberjacks)
- Show state via overlay indicator: ⊙ (idle), → (moving), ✕ (working), ← (returning), ! (fleeing)
- Draw trees as map decoration (procedurally textured in terrain splatting system or simple sprites)

---

## 5. Castle Progression (10 Levels)

All values scale per level. Population capacity and archer stats increase. Costs are cumulative (upgrading from level 1→2 costs resources; upgrading 2→3 costs additional resources, etc.).

| Lvl | Name | Pop Cap | HP | Archer Dmg | Archer Range | Resource Cost |
|-----|------|---------|----|-----------|--------------| --------------|
| 1 | Stockade | 5 | 500 | 10 | 300 | — (starting) |
| 2 | Palisade | 8 | 700 | 12 | 320 | 100 wood |
| 3 | Motte | 12 | 950 | 15 | 350 | 150 wood |
| 4 | Motte-and-Bailey | 18 | 1300 | 18 | 380 | 100 wood + 75 stone |
| 5 | Ringwork | 25 | 1750 | 22 | 420 | 150 stone |
| 6 | Keep | 35 | 2400 | 26 | 460 | 200 stone + 50 wood |
| 7 | Tower House | 48 | 3200 | 31 | 500 | 300 stone |
| 8 | Fortress | 65 | 4200 | 37 | 550 | 400 stone |
| 9 | Citadel | 85 | 5400 | 44 | 600 | 500 stone |
| 10 | Castle | 110 | 6800 | 52 | 650 | 600 stone |

### Upgrade Mechanics

- **Instant:** Upgrading happens immediately when resources are available (no build timer)
- **Anytime:** Player can upgrade during active waves or between waves
- **Checks:** Before upgrade:
  - Do we have enough resources?
  - If yes: deduct, increment castle level, update HP/archers, increase population capacity
  - If no: show feedback ("Need 100 wood" in red text or sound effect)

### Castle as Archer Defense

- Each resident in the castle gets a bow
- Castle fires 1 arrow per resident every 5 seconds (configurable as `ARCHER_FIRE_RATE`)
- Arrows target the nearest enemy in range
- Arrow damage scales with castle level (see table)
- Arrow range scales with castle level (see table)
- Independent from towers (towers still exist and fire normally)

---

## 6. Resource System

### Resources (Phase 1)

- **Wood:** Gathered by lumberjacks from trees
- **Stone:** Gathered by stone miners (future job)
- Expandable to food, ore, gold, etc.

### Inventory

Stored in `Game.state.resources: { wood: 0, stone: 0 }`. No cap for now (unlimited storage).

### Resource Uses (Phase 1)

- **Castle upgrades only** — Resources are spent on upgrading the castle (see section 5)
- Future phases may add building construction, unit training, trade, etc.

---

## 7. Wave & Attack Timing

### Manual + Auto-Start System

- Player can click "Start Wave" button anytime between waves
- If player doesn't start within `AUTO_WAVE_DELAY` (default 45s, configurable), next wave auto-starts
- Timer is per-wave (resets after each wave completes)
- HUD shows countdown: "Next wave in: 30s" or interactive button "Start Wave Now"

### Implementation

In `main.js` loop:
```javascript
if (Game.state.gameState === 'between_waves') {
  const timeSinceWaveEnd = now - Game.state.lastWaveEndTime;
  if (timeSinceWaveEnd > Game.Config.AUTO_WAVE_DELAY) {
    // Auto-start
    Game.WaveSpawner.startWave();
  }
}
```

Player can click button to call `Game.WaveSpawner.startWave()` manually anytime.

---

## 8. HUD (Top Bar)

The top bar (horizontal, full-width) displays:

```
[Resources] | [Population] | [Castle] | [Game Controls]
```

### Resources Section

```
Wood: 245    Stone: 0
```
Updates every frame as resources are gathered/spent.

### Population Section (Clickable)

```
Pop: 3/5  [Click to manage]
```
Clicking opens the population management panel (section 3).

### Castle Section (Clickable)

```
Level: 1 (Stockade) | HP: 500/500 | [Info/Upgrade]
```
Clicking shows:
- Current level name and description
- Next upgrade cost
- "Upgrade" button (greyed if can't afford)
- Maybe current archer stats

### Game Controls

```
[Start Wave] [Speed ▼] [Pause]
```
(Already exists, just relocated/restyled for top bar)

---

## 9. Data Flow & Integration Points

### When a Resident is Assigned

1. Remove from free worker pool
2. Create resident instance with `assignedJob`
3. Next frame, job loop begins

### When Resources are Gathered

1. Resident reaches castle in 'returning' state
2. Call `Game.Resources.add('wood', 10)`
3. Inventory updated, HUD reflects change

### When Castle is Upgraded

1. Player clicks "Upgrade"
2. Check `Game.Resources.has(cost)`
3. If yes:
   - `Game.Resources.spend(cost)`
   - `Game.Castle.upgrade()`
   - `Game.Population.setCapacity(newCap)`
   - HUD updates HP, level, pop cap, archers
4. If no: show feedback

### When Enemy Spawns

1. Set all residents to state = 'fleeing'
2. They pathfind to castle (shortest path)
3. HUD can show warning: "Enemies approaching!"

---

## 10. Configuration Examples (config.js)

All these should be definable in `Game.Config`:

```javascript
Game.Config.TREE_SPAWN_INTERVAL = 60000;  // 1 tree per minute
Game.Config.ARCHER_FIRE_RATE = 5000;      // 1 arrow per resident per 5s
Game.Config.AUTO_WAVE_DELAY = 45000;      // 45s before auto-start
Game.Config.RESIDENT_HP = 10;
Game.Config.RESIDENT_COMBAT_DMG = 5;

Game.Config.JOBS = {
  lumberjack: {
    workTime: 15000,
    speed: 80,
    // ...
  }
};

Game.Config.CASTLE_UPGRADES = [
  { level: 1, name: 'Stockade', popCap: 5, hp: 500, ... },
  { level: 2, name: 'Palisade', popCap: 8, hp: 700, ... },
  // ...
];
```

---

## 11. Testing & Validation

### Unit Tests (Vitest)

- `resident.test.js`: Job state machine, pathfinding, combat
- `castle.test.js`: Upgrade progression, archer mechanics
- `resources.test.js`: Inventory add/remove, spending
- `kingdom.test.js`: Population assignment, job switching

### Integration Tests

- Can assign/unassign residents
- Residents find and chop trees
- Trees respawn at correct rate
- Residents flee when enemies appear
- Castle upgrades correctly
- Archers fire at correct rate and damage

### Manual Play Testing

- Start game, assign a lumberjack, watch them work
- Enemies appear → workers flee home
- Collect enough wood, upgrade castle
- Castle HP increases, archers fire more frequently
- Population capacity increases, assign more workers

---

## 12. Future Expansions (Out of Scope)

- Stone miners, farmers, soldiers
- Trading between resources
- Building construction (barracks, granaries, markets)
- Unit recruitment and militia
- Siege mechanics (enemies can break gates, burn buildings)
- Diplomacy / tribute / alliances
- Territory expansion

---

## 13. Design Decisions & Rationale

### Why Active Workers, Not Passive Income?

Active residents create moments of tension: workers are vulnerable, can be killed, have to return resources. This ties kingdom management into tower defense strategy (you have to defend your workers). Passive income would be simpler but less engaging.

### Why Instant Upgrades?

Building timers are common in kingdom games but can feel tedious. Instant upgrades keep the pace fast and reward tactical decisions (e.g., "should I upgrade now or wait for more gold?"). Can add timers later if strategic delay is desired.

### Why Castle Fires Arrows?

It makes the castle feel alive and upgradeable beyond just "soak damage." Residents literally defend it. This ties population size to military power (more people = more archers). It's visually satisfying and strategically interesting.

### Why 10 Levels Mapped to Medieval Fortification Progression?

Flavor + progression clarity. Each level looks/feels different (aesthetically in future visual work) and tells a story. Stockade → Castle is an iconic progression that players intuitively understand.

### Why Manual + Auto-Start?

Manual start gives players agency (play at their pace), but auto-start prevents the game from becoming "pause forever and optimize infinitely." It balances engagement with accessibility.

---

## 14. Open Questions (For Later Phases)

- What happens if castle is destroyed while residents are out? (Do they survive? Return home? Die?)
- Can residents carry resources and get attacked (lose resources)?
- Should there be a limit to how many workers gather at once (e.g., only 3 trees per minute)?
- Should upgraded castles have visual changes (taller walls, more elaborate gates)?
- When stone miners are added, how are they balanced vs. lumberjacks?

