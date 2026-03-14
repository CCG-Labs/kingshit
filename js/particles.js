window.Game = window.Game || {};

Game.Particles = {
  particles: [],

  spawn(x, y, count, color, opts = {}) {
    const speed = opts.speed || 100;
    const life = opts.life || 0.6;
    const size = opts.size || 3;
    const gravity = opts.gravity || 0;
    const text = opts.text || null;
    const glow = opts.glow || false;
    const shape = opts.shape || 'circle'; // 'circle', 'spark', 'smoke'

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
        glow,
        shape,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 8,
      });
    }
  },

  goldPopup(x, y, amount) {
    this.particles.push({
      x, y,
      vx: (Math.random() - 0.5) * 10,
      vy: -50,
      life: 1.2,
      maxLife: 1.2,
      color: '#FFD700',
      size: 0,
      gravity: 0,
      text: '+' + amount,
      glow: true,
      shape: 'circle',
      rotation: 0,
      rotSpeed: 0,
    });
  },

  explosion(x, y, radius, color) {
    // Core flash
    this.spawn(x, y, 1, '#FFFFFF', {
      speed: 0, life: 0.1, size: radius * 0.4, glow: true,
    });
    // Fiery debris
    this.spawn(x, y, 12, color || '#FF6600', {
      speed: radius * 2.5, life: 0.5, size: 4, glow: true,
    });
    // Sparks
    this.spawn(x, y, 8, '#FFD700', {
      speed: radius * 3, life: 0.3, size: 2, shape: 'spark',
    });
    // Smoke
    this.spawn(x, y, 5, 'rgba(80,80,80,1)', {
      speed: radius * 0.5, life: 0.8, size: 6, shape: 'smoke', upward: true,
    });
  },

  update(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += p.gravity * dt;
      p.rotation += (p.rotSpeed || 0) * dt;
      p.life -= dt;

      // Friction for smoke
      if (p.shape === 'smoke') {
        p.vx *= 0.96;
        p.vy *= 0.96;
        p.size += dt * 8; // Smoke expands
      }

      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }
  },

  draw(ctx) {
    for (const p of this.particles) {
      const alpha = Math.max(0, p.life / p.maxLife);

      if (p.text) {
        ctx.save();
        ctx.globalAlpha = alpha;
        if (p.glow) {
          ctx.shadowColor = p.color;
          ctx.shadowBlur = 8;
        }
        ctx.fillStyle = p.color;
        ctx.font = 'bold 14px monospace';
        ctx.textAlign = 'center';
        // Scale up slightly as they float
        const scale = 1 + (1 - alpha) * 0.3;
        ctx.translate(p.x, p.y);
        ctx.scale(scale, scale);
        ctx.fillText(p.text, 0, 0);
        ctx.restore();
      } else if (p.shape === 'smoke') {
        ctx.globalAlpha = alpha * 0.4;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size / 2, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.shape === 'spark') {
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillStyle = p.color;
        // Elongated spark
        ctx.fillRect(-p.size, -0.5, p.size * 2, 1);
        ctx.restore();
      } else {
        // Circle particle
        ctx.save();
        ctx.globalAlpha = alpha;
        if (p.glow) {
          ctx.shadowColor = p.color;
          ctx.shadowBlur = p.size * 2;
        }
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(0.5, p.size / 2), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
  },

  clear() {
    this.particles = [];
  },
};
