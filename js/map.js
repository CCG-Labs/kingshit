window.Game = window.Game || {};

Game.Map = {
  current: null,
  castleCol: -1,
  castleRow: -1,
  flowField: null,
  entries: [],

  load(mapData) {
    this.current = mapData;
    this.castleCol = -1;
    this.castleRow = -1;
    this.flowField = null;
    this.entries = this._findEntries();
  },

  _findEntries() {
    const entries = [];
    if (!this.current) return entries;
    const grid = this.current.grid;
    for (let r = 0; r < grid.length; r++) {
      for (let c = 0; c < grid[r].length; c++) {
        if (grid[r][c] === Game.Config.TILE.ENTRY) {
          entries.push({ col: c, row: r });
        }
      }
    }
    return entries;
  },

  placeCastle(col, row) {
    this.castleCol = col;
    this.castleRow = row;
  },

  getTile(col, row) {
    if (!this.current) return Game.Config.TILE.BLOCKED;
    if (row < 0 || row >= this.current.grid.length) return Game.Config.TILE.BLOCKED;
    if (col < 0 || col >= this.current.grid[0].length) return Game.Config.TILE.BLOCKED;
    return this.current.grid[row][col];
  },

  // Can the player build here?
  isBuildable(col, row) {
    return this.getTile(col, row) === Game.Config.TILE.BUILDABLE;
  },

  hasTowerAt(col, row, towers) {
    return towers.some(t => t.col === col && t.row === row);
  },

  isCastleAt(col, row) {
    return col === this.castleCol && row === this.castleRow;
  },

  // Quick check for hover preview (no pathfinding)
  canPlaceBasic(col, row, towers) {
    return this.isBuildable(col, row) &&
           !this.hasTowerAt(col, row, towers) &&
           !this.isCastleAt(col, row);
  },

  // Full check including path validation
  canPlace(col, row, towers) {
    if (!this.canPlaceBasic(col, row, towers)) return false;
    // Check that placement doesn't block all paths from any entry to castle
    const fakeTowers = towers.concat([{ col, row }]);
    const testField = this._computeFlowFieldInternal(fakeTowers);
    if (!testField) return false;
    for (const entry of this.entries) {
      if (!testField[entry.row] || !testField[entry.row][entry.col]) {
        return false;
      }
    }
    return true;
  },

  canPlaceCastle(col, row) {
    return this.isBuildable(col, row);
  },

  // Recompute flow field (call after tower changes)
  _cachedMaxDist: 1,
  computeFlowField(towers) {
    this.flowField = this._computeFlowFieldInternal(towers);
    // Cache max distance so getMaxDist() is O(1)
    let max = 0;
    if (this.flowField) {
      for (const entry of this.entries) {
        const f = this.flowField[entry.row] && this.flowField[entry.row][entry.col];
        if (f) max = Math.max(max, f.dist);
      }
    }
    this._cachedMaxDist = max || 1;
  },

  _computeFlowFieldInternal(towers) {
    if (this.castleCol < 0 || this.castleRow < 0) return null;
    if (!this.current) return null;

    const grid = this.current.grid;
    const rows = grid.length;
    const cols = grid[0].length;

    // Build field
    const field = [];
    for (let r = 0; r < rows; r++) {
      field[r] = new Array(cols).fill(null);
    }

    // Tower lookup set
    const towerSet = new Set();
    for (const t of towers) towerSet.add(t.row * cols + t.col);

    // BFS from castle outward
    field[this.castleRow][this.castleCol] = { dx: 0, dy: 0, dist: 0 };
    const queue = [[this.castleCol, this.castleRow]];
    let head = 0;

    const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];

    while (head < queue.length) {
      const [col, row] = queue[head++];
      const dist = field[row][col].dist;

      for (const [dc, dr] of dirs) {
        const nc = col + dc;
        const nr = row + dr;
        if (nc < 0 || nc >= cols || nr < 0 || nr >= rows) continue;
        if (field[nr][nc] !== null) continue;

        const tile = grid[nr][nc];
        if (tile === Game.Config.TILE.BLOCKED) continue;
        if (towerSet.has(nr * cols + nc)) continue;

        // Direction points toward castle (back toward the cell we came from)
        field[nr][nc] = { dx: -dc, dy: -dr, dist: dist + 1 };
        queue.push([nc, nr]);
      }
    }

    return field;
  },

  getMaxDist() {
    return this._cachedMaxDist;
  },
};
