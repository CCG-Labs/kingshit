window.Game = window.Game || {};

Game.Input = {
  mouse: { x: 0, y: 0 },
  clicked: false,
  rightClicked: false,
  clickPos: null,
  keys: {},
  keysJustPressed: {},

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

    // Touch support
    canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      this.mouse.x = (touch.clientX - rect.left) * scaleX;
      this.mouse.y = (touch.clientY - rect.top) * scaleY;
      this.clicked = true;
      this.clickPos = { x: this.mouse.x, y: this.mouse.y };
    });

    canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      this.mouse.x = (touch.clientX - rect.left) * scaleX;
      this.mouse.y = (touch.clientY - rect.top) * scaleY;
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

  consume() {
    this.clicked = false;
    this.rightClicked = false;
    this.clickPos = null;
    this.keysJustPressed = {};
  },

  isKeyPressed(key) {
    const pressed = this.keysJustPressed[key] || false;
    return pressed;
  },

  getGridPos() {
    // Use isometric reverse projection
    return Game.Renderer.screenToGrid(this.mouse.x, this.mouse.y);
  },
};
