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
  // ... existing state (towers, enemies, projectiles, gold, lives, etc.) ...

  resources: {
    wood: 0,
    // stone added in Phase 2 when miners are implemented
  },

  population: {
    current: 5,      // unassigned residents
    capacity: 5,     // max population (increases with castle level)
    residents: [
      // Array of resident objects, see section 3
    ],
    jobs: {
      lumberjack: 0   // number of residents assigned to lumberjack
    }
  },

  castle: {
    level: 1,           // 1-10 (Stockade to Castle)
    hp: 500,
    maxHp: 500,
    lastArcherFireTime: 0  // for 5-second global archer fire rate
  },

  waves: {
    lastWaveEndTime: 0,
    autoStartDelay: 45000, // ms (configurable in config.js)
    canStartWaveManually: true
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

- **Spawn rate:** 1 tree per minute of gameplay (configurable in config as `TREE_SPAWN_INTERVAL = 60000` ms)
- **Spawn location:** Randomly select an empty cell on buildable or grass terrain (reject cells with buildings, rocks, enemies, residents, or existing trees)
- **Spawn algorithm:** Rejection sampling — try up to 10 random cells; if none are empty, skip this spawn cycle
- **Tree depletion:** Trees respawn naturally. When a lumberjack completes chopping, the tree is removed from the map but re-enters the spawn pool. No tree is permanently consumed.
- **Map balance:** On a 100×100 map with ~50% buildable terrain, with 1 spawn per minute, expect 3-5 active trees at equilibrium (limited by lumberjack count and island clustering)

### Resident Work Loop

**State Machine Diagram:**
```
idle → seeking → moving → working → returning → idle
                                         ↓
                    [enemy threat] → fleeing → [safe] → idle
```

#### 1. Idle → Seeking
- If assigned to job, resident checks for available target (tree)
- **Search algorithm:** Scan all trees on map, find nearest by grid distance
- **Visibility range:** No hard limit; use all trees on map
- **Timeout:** If no tree found after 30 seconds (configurable as `SEEK_TIMEOUT = 30000`), go back to idle and retry next cycle
- **Outcome:** If tree found → set target → state = 'moving'

#### 2. Moving → Working
- Pathfind to tree using BFS (same flow field system as enemies; see `Game.Map.computeFlowField()`)
- **Path recalculation:** Recalculate every 5 frames (or on target change) to handle dynamic obstacles
- **Arrival check:** If within 1 grid tile of target, state = 'working'
- **Stuck detection:** If same position for >10 seconds, pathfinding failed → reset to seeking
- **Outcome:** On arrival → state = 'working', start progress timer (15s, configurable as `LUMBERJACK_WORK_TIME = 15000`)

#### 3. Working → Returning
- Hold state = 'working' for 15 seconds (timer display: chop animation)
- **Completion:** After timer elapses, mark tree as harvested (remove from map)
- **New target:** Set target = castle grid position
- **Outcome:** state = 'returning'

#### 4. Returning → Idle
- Pathfind to castle (same BFS as seeking)
- **Arrival check:** If within 2 grid tiles of castle, resident has "arrived home"
- **Resource transfer:** Instantly add gathered resource to `Game.state.resources.wood` (no delay)
- **Outcome:** state = 'idle', target = null, can be reassigned or loop to seeking if still assigned

### Enemy Interaction

**Fleeing (Threat-Based, not Global):**
- Residents continuously check if any enemy is within `RESIDENT_THREAT_RANGE` (configurable, suggest 250 pixels)
- If an enemy enters threat range, that resident immediately switches to state = 'fleeing'
- Fleeing residents pathfind directly to castle (shortest path, abandon job)
- On castle arrival, state = 'idle', can resume work if no threats remain
- **Design rationale:** This allows workers to gather during early waves if threats are elsewhere, and creates spatial risk/reward. It's not all-or-nothing like "any enemy anywhere."

**Combat (Passive Counter):**
- When an enemy moves onto/adjacent to a resident (~1 tile range), combat occurs
- Resident takes damage (varies by enemy type; not specified in this doc, use existing enemy stats)
- Resident deals **5 damage back** (configurable as `RESIDENT_COMBAT_DMG`)
- This counter-attack happens once per engagement; resident doesn't actively chase/pursue enemy
- Residents have **10 HP** (configurable as `RESIDENT_HP`); reaching 0 = death
- On death: remove resident from game, lose any gathered resources the resident was carrying back to castle
- **Design rationale:** Weak combat provides minor friction (slows enemy advance slightly, trades worker HP) without making workers viable soldiers. Fleeing is the correct survival strategy.

### Rendering

- Draw residents as small sprites (16x16 or similar) with a distinct color (green for lumberjacks)
- Show state via overlay indicator: ⊙ (idle), → (moving), ✕ (working), ← (returning), ! (fleeing)
- Draw trees as map decoration (procedurally textured in terrain splatting system or simple sprites)

---

## 5. Castle Progression (10 Levels)

**Phase 1 Scope:** Levels 1-3 (wood only). Levels 4-10 deferred to Phase 2 when stone miners are implemented.

All values scale per level. Population capacity and archer stats increase. Each upgrade is independent (you don't need to unlock in order, but you need resources).

| Lvl | Name | Pop Cap | HP | Archer Dmg | Archer Range | Resource Cost (Phase 1) |
|-----|------|---------|----|-----------|--------------| --------------|
| 1 | Stockade | 5 | 500 | 10 | 300 | — (starting) |
| 2 | Palisade | 8 | 700 | 12 | 320 | 100 wood |
| 3 | Motte | 12 | 950 | 15 | 350 | 150 wood |
| 4–10 | (Deferred to Phase 2) | — | — | — | — | (requires stone) |

**Population Scaling:** When the player upgrades the castle, population capacity increases and new free residents are granted automatically. For example, upgrading from Level 1 (capacity 5) to Level 2 (capacity 8) grants 3 new free residents.

### Upgrade Mechanics

- **Instant:** Upgrading happens immediately when resources are available (no build timer)
- **Anytime:** Player can upgrade during active waves or between waves
- **Checks:** Before upgrade:
  - Do we have enough resources?
  - If yes: deduct, increment castle level, update HP/archers, increase population capacity
  - If no: show feedback ("Need 100 wood" in red text or sound effect)

### Castle as Archer Defense

- Each resident in the castle gets a bow (so population size = archer count)
- **Fire Mechanic:** The castle has a global archer cooldown of 5 seconds (configurable as `Game.Config.ARCHER_FIRE_RATE`). Every 5 seconds, the castle fires **one arrow per available archer** (so 5 archers = 5 arrows per volley)
- Volley fires simultaneously; each arrow targets the nearest enemy to that archer's vantage point (or a simple targeting system like "nearest enemy overall")
- Arrow damage scales with castle level (see table)
- Arrow range scales with castle level (see table)
- Independent from towers (towers still exist and fire normally)
- **Important:** Number of archers = current population in castle (whether assigned to jobs or free)

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

All these must be definable in `Game.Config` for easy tuning. **KEY DECISION:** All timings and balance numbers live in config, not hardcoded in behavior modules.

```javascript
// === POPULATION & JOBS ===
Game.Config.RESIDENT_HP = 10;
Game.Config.RESIDENT_COMBAT_DMG = 5;
Game.Config.RESIDENT_THREAT_RANGE = 250;  // pixels; if enemy within this, flee
Game.Config.RESIDENT_SPEED = 80;          // pixels/sec during pathfinding

// === LUMBERJACK JOB ===
Game.Config.LUMBERJACK_WORK_TIME = 15000;  // ms to chop one tree
Game.Config.LUMBERJACK_RESOURCE_GAIN = 10; // wood per tree
Game.Config.SEEK_TIMEOUT = 30000;          // ms; if no tree found, go idle and retry

// === TREE SPAWNING ===
Game.Config.TREE_SPAWN_INTERVAL = 60000;   // 1 tree per minute
Game.Config.TREE_SPAWN_REJECTION_SAMPLES = 10; // try up to 10 cells per spawn attempt

// === CASTLE DEFENSE ===
Game.Config.ARCHER_FIRE_RATE = 5000;  // ms between archer volleys (all archers fire together)
Game.Config.ARCHER_FIRE_INTERVAL = 0.5; // (alternative) fire rate in volleys/second if preferred

// === CASTLE UPGRADES (Phase 1 only) ===
Game.Config.CASTLE_UPGRADES = [
  {
    level: 1,
    name: 'Stockade',
    description: 'A simple perimeter of sharpened wooden stakes.',
    popCapacity: 5,
    hp: 500,
    archerDamage: 10,
    archerRange: 300,
    cost: {}  // starting level, no cost
  },
  {
    level: 2,
    name: 'Palisade',
    description: 'Taller, more deliberate wooden wall construction.',
    popCapacity: 8,
    hp: 700,
    archerDamage: 12,
    archerRange: 320,
    cost: { wood: 100 }
  },
  {
    level: 3,
    name: 'Motte',
    description: 'An earthen mound with a timber tower on top.',
    popCapacity: 12,
    hp: 950,
    archerDamage: 15,
    archerRange: 350,
    cost: { wood: 150 }
  }
  // Levels 4-10 deferred to Phase 2
];

// === WAVES ===
Game.Config.AUTO_WAVE_DELAY = 45000;  // ms before auto-starting next wave if player doesn't
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

## 14. Castle Destruction & Game Over

If castle HP reaches 0:
- **Game state:** Transition to 'gameover' (existing game-over flow)
- **Residents:** All active residents are immediately removed from the map
- **Resources:** Any resources in-transit (held by residents returning) are lost
- **Design rationale:** Keeps game-over clean. Prevents orphaned workers or resource exploitation at game end.

---

## 15. Open Questions (For Later Phases)

- When stone miners are added (Phase 2), how should their work time compare to lumberjacks? (Longer/shorter?)
- Should there be a limit to maximum population (e.g., 200 at Castle level 10)?
- Should upgraded castles have visual changes (taller walls, more elaborate gates) for player feedback?
- Should lumberjacks have visual variations (different colored sprites per job type)?
- Can residents be reassigned to different jobs, or locked until unassigned?
- Should residents have names/individual identity in future phases?

