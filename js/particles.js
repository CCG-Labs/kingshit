window.Game = window.Game || {};

Game.Particles = {
  particles: [],

  spawn(x, y, count, color, opts = {}) {
    const speed = opts.speed || 100;
    const life = opts.life || 0.6;
    const size = opts.size || 3;
    const gravity = opts.gravity || 0;
    const text = opts.text || null;

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = speed * (0.3 + Math.random() * 0.7);
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd - (opts.upward ? speed * 0.5 : 0),
        life: life * (0.7 + Math.random() * 0.3),
        maxLife: life,
        color,
        size: size * (0.5 + Math.random() * 0.5),
        gravity,
        text: i === 0 ? text : null,
      });
    }
  },

  goldPopup(x, y, amount) {
    this.particles.push({
      x, y,
      vx: 0,
      vy: -40,
      life: 1.0,
      maxLife: 1.0,
      color: Game.Config.COLORS.goldText,
      size: 0,
      gravity: 0,
      text: '+' + amount,
    });
  },

  explosion(x, y, radius, color) {
    this.spawn(x, y, 15, color || '#FF6600', {
      speed: radius * 2,
      life: 0.4,
      size: 4,
    });
  },

  update(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += p.gravity * dt;
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }
  },

  draw(ctx) {
    for (const p of this.particles) {
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = alpha;

      if (p.text) {
        ctx.fillStyle = p.color;
        ctx.font = 'bold 14px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(p.text, p.x, p.y);
      } else {
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      }
    }
    ctx.globalAlpha = 1;
  },

  clear() {
    this.particles = [];
  },
};
