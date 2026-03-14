# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

KINGSHIT is a browser-based tower defense game rendered on an HTML5 canvas with isometric projection. No build tools, no bundler, no framework — just vanilla JS loaded via `<script>` tags in `index.html`.

## Running the Game

Open `index.html` in a browser. There is no build step, no test suite, and no linter configured.

## Architecture

### Global Namespace

All modules hang off `window.Game`. Each JS file starts with `window.Game = window.Game || {}` and attaches its module (e.g., `Game.Config`, `Game.Map`, `Game.Tower`).

### Script Load Order (defined in index.html)

`config.js` → `input.js` → `map.js` → `particles.js` → `enemy.js` → `projectile.js` → `tower.js` → `wave.js` → `renderer.js` → `ui.js` → `maps/map1.js` → `main.js`

Order matters — later scripts depend on earlier ones being defined.

### Module Responsibilities

- **config.js** — All constants: tile types, tower/enemy definitions, balance numbers, colors. This is the single source of truth for game tuning.
- **main.js** — Game loop (`requestAnimationFrame`), state machine (`menu` → `placeCastle` → `playing` → `gameover`/`victory`), input dispatch. `Game.state` holds the live game state (towers, enemies, projectiles, gold, lives).
- **map.js** — Grid management, BFS flow field pathfinding from castle outward. `computeFlowField()` rebuilds after tower place/sell. Validates placement won't block all paths.
- **renderer.js** — Isometric rendering, camera system (scroll + edge-scroll + touch-drag), tile drawing, entity drawing. Large file (~700 lines). Caches the static map to an offscreen canvas.
- **tower.js** — `Game.Tower` class. Handles targeting (5 modes), firing, special abilities (splash, chain lightning, cone flame, slow, pierce armor), upgrades up to level 3 with special L3 bonuses, HP/destruction.
- **enemy.js** — `Game.Enemy` class. Follows flow field, has status effects (slow, stun, DoT), shield/heal specials, aggression system where enemies can stop to attack towers/castle.
- **projectile.js** — `Game.Projectile` class. Homing or ballistic, handles hit logic including splash, crits, slow application.
- **wave.js** — `Game.WaveSpawner`. Manages wave progression, spawn timing, between-wave countdown, early-start bonus.
- **ui.js** — HUD, tower bar, tooltips, tower info panel, upgrade/sell buttons, game over/victory screens. All drawn to canvas (no DOM UI).
- **particles.js** — Screen-space particle system (gold popups, explosions, sparks, smoke).
- **maps/map1.js** — Procedurally generates the 100x100 "Forest Path" map with obstacle clusters, 4 entry points (N/S/E/W edges), and 20 wave definitions.

### Key Patterns

- **Coordinate spaces**: Grid coords (col, row) → world pixels (x, y at TILE_SIZE scale) → isometric screen coords (with camera offset). Renderer has conversion functions: `gridToScreen()`, `screenToGrid()`, `worldToScreen()`.
- **Flow field pathfinding**: BFS from castle tile outward. Each cell stores a direction vector pointing toward the castle. Recomputed when towers are placed/sold. Tower placement is rejected if it would block all paths from any entry.
- **Game state lives on `Game.state`** — a plain object created in `startMap()`, passed around or accessed globally. `null` when on the menu.
- **Input is consumed once per frame** — `Game.Input.consume()` clears click/key state at end of each loop iteration. Use `isKeyPressed()` for one-shot keys.
- **Isometric projection** — tiles are diamond-shaped (64x32 default). The renderer draws back-to-front by iterating rows then columns.
