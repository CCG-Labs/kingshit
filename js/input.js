window.Game = window.Game || {};

Game.Input = {
  mouse: { x: 0, y: 0 },
  clicked: false,
  rightClicked: false,
  clickPos: null,
  keys: {},
  keysJustPressed: {},

  // Touch drag for scrolling
  touchDragging: false,
  touchDragStart: null,
  touchDragCamStart: null,
  touchDragMoved: false,

  init(canvas) {
    this.canvas = canvas;

    canvas.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      this.mouse.x = (e.clientX - rect.left) * scaleX;
      this.mouse.y = (e.clientY - rect.top) * scaleY;
    });

    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        this.clicked = true;
        this.clickPos = { x: this.mouse.x, y: this.mouse.y };
      } else if (e.button === 2) {
        this.rightClicked = true;
      }
    });

    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    // Touch support with drag-to-scroll
    canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const tx = (touch.clientX - rect.left) * scaleX;
      const ty = (touch.clientY - rect.top) * scaleY;
      this.mouse.x = tx;
      this.mouse.y = ty;
      this.touchDragging = true;
      this.touchDragStart = { x: tx, y: ty };
      this.touchDragCamStart = { x: Game.Renderer.camX, y: Game.Renderer.camY };
      this.touchDragMoved = false;
    });

    canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const tx = (touch.clientX - rect.left) * scaleX;
      const ty = (touch.clientY - rect.top) * scaleY;
      this.mouse.x = tx;
      this.mouse.y = ty;

      if (this.touchDragging && this.touchDragStart) {
        const dx = tx - this.touchDragStart.x;
        const dy = ty - this.touchDragStart.y;
        if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
          this.touchDragMoved = true;
        }
        Game.Renderer.camX = this.touchDragCamStart.x - dx;
        Game.Renderer.camY = this.touchDragCamStart.y - dy;
      }
    });

    canvas.addEventListener('touchend', (e) => {
      e.preventDefault();
      if (this.touchDragging && !this.touchDragMoved) {
        // Short tap = click (no drag happened)
        this.clicked = true;
        this.clickPos = { x: this.mouse.x, y: this.mouse.y };
      }
      this.touchDragging = false;
      this.touchDragStart = null;
      this.touchDragCamStart = null;
    });

    window.addEventListener('keydown', (e) => {
      if (!this.keys[e.key]) {
        this.keysJustPressed[e.key] = true;
      }
      this.keys[e.key] = true;
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.key] = false;
    });
  },

  // Edge scrolling (called each frame with dt)
  updateEdgeScroll(dt) {
    const m = Game.Config.EDGE_SCROLL_MARGIN;
    const speed = Game.Config.EDGE_SCROLL_SPEED;
    const mx = this.mouse.x;
    const my = this.mouse.y;
    const w = this.canvas.width;
    const h = this.canvas.height;

    let dx = 0, dy = 0;
    if (mx < m) dx = -speed * (1 - mx / m);
    else if (mx > w - m) dx = speed * (1 - (w - mx) / m);
    if (my < m) dy = -speed * (1 - my / m);
    else if (my > h - m) dy = speed * (1 - (h - my) / m);

    if (dx !== 0 || dy !== 0) {
      Game.Renderer.camX += dx * dt;
      Game.Renderer.camY += dy * dt;
    }
  },

  consume() {
    this.clicked = false;
    this.rightClicked = false;
    this.clickPos = null;
    this.keysJustPressed = {};
  },

  isKeyPressed(key) {
    return this.keysJustPressed[key] || false;
  },

  getGridPos() {
    return Game.Renderer.screenToGrid(this.mouse.x, this.mouse.y);
  },
};
