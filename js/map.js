window.Game = window.Game || {};

Game.Map = {
  current: null,

  load(mapData) {
    this.current = mapData;
  },

  getTile(col, row) {
    if (!this.current) return Game.Config.TILE.BLOCKED;
    if (row < 0 || row >= this.current.grid.length) return Game.Config.TILE.BLOCKED;
    if (col < 0 || col >= this.current.grid[0].length) return Game.Config.TILE.BLOCKED;
    return this.current.grid[row][col];
  },

  isBuildable(col, row) {
    return this.getTile(col, row) === Game.Config.TILE.BUILDABLE;
  },

  hasTowerAt(col, row, towers) {
    return towers.some(t => t.col === col && t.row === row);
  },

  canPlace(col, row, towers) {
    return this.isBuildable(col, row) && !this.hasTowerAt(col, row, towers);
  },
};
