// Small built-in minigames. Used by the boss battle, duels, the daily mystery, Neonzonen and the secret cave.
// W.mini.run(container, id, { seed, duration, speed, mirror }) -> Promise<score>
(function () {
  'use strict';
  const { h, rng } = W;

  const GAMES = {
    stars: { name: 'Stjärnregn', icon: '🌠', help: 'Fånga stjärnorna med skålen. Undvik bomberna! Mus, finger eller ← →.', duration: 30 },
    aim: { name: 'Prickskytt', icon: '🎯', help: 'Klicka på måltavlorna så snabbt du kan. Missar kostar poäng!', duration: 30 },
    dodge: { name: 'Asteroidflykt', icon: '☄️', help: 'Styr skeppet (mus, finger eller piltangenter). Undvik asteroiderna, plocka energiklot. 3 liv.', duration: 45 },
    memory: { name: 'Minnesrutor', icon: '🧠', help: 'Titta på ordningen rutorna lyser i och tryck sedan i samma ordning. Det blir längre och längre!', duration: 75 },
    pong: { name: 'Pixel Pong', icon: '🏓', help: 'Det hemliga spelet. Först till 5 vinner. Mus, finger eller ↑ ↓.', duration: 120, secret: true },
  };
  const PUBLIC = ['stars', 'aim', 'dodge', 'memory'];

  function run(container, id, opts) {
    opts = opts || {};
    const G = GAMES[id];
    const W_ = 480, H_ = 360;
    const canvas = h('canvas', { width: W_, height: H_, class: 'mini-canvas', tabindex: 0, 'aria-label': G.name });
    const startBtn = h('button', { class: 'btn big', type: 'button' }, '▶ Starta');
    const overlay = h('div', { class: 'mini-overlay' },
      h('div', { class: 'mini-icon' }, G.icon), h('h3', null, G.name), h('p', null, G.help),
      opts.note ? h('p', { class: 'mini-note' }, opts.note) : null, startBtn);
    const wrap = h('div', { class: 'mini-wrap' }, canvas, overlay);
    container.innerHTML = '';
    container.appendChild(wrap);
    const ctx = canvas.getContext('2d');
    const r = rng(opts.seed || (Math.random() * 1e9) | 0);
    const speed = opts.speed || 1;
    const mirror = !!opts.mirror;
    const duration = opts.duration || G.duration;

    const input = { x: W_ / 2, y: H_ / 2, keys: {}, clicks: [], pointer: false };
    function pos(e) {
      const b = canvas.getBoundingClientRect();
      let x = ((e.clientX - b.left) / b.width) * W_;
      const y = ((e.clientY - b.top) / b.height) * H_;
      if (mirror) x = W_ - x;
      return [x, y];
    }
    canvas.addEventListener('pointermove', (e) => { [input.x, input.y] = pos(e); input.pointer = true; });
    canvas.addEventListener('pointerdown', (e) => { e.preventDefault(); [input.x, input.y] = pos(e); input.pointer = true; input.clicks.push([input.x, input.y]); });
    canvas.style.touchAction = 'none';
    const kd = (e) => { input.keys[e.key] = true; if (e.key.startsWith('Arrow') || e.key === ' ') e.preventDefault(); input.pointer = false; };
    const ku = (e) => { input.keys[e.key] = false; };

    return new Promise((resolve) => {
      let raf = 0, done = false;
      function finish(score) {
        if (done) return;
        done = true;
        cancelAnimationFrame(raf);
        window.removeEventListener('keydown', kd);
        window.removeEventListener('keyup', ku);
        resolve(score < 0 ? -1 : Math.round(score));
      }
      wrap._stop = () => finish(0);
      // stop if the popup is closed mid-game
      const obs = new MutationObserver(() => { if (!document.body.contains(canvas)) { obs.disconnect(); finish(-1); } });
      obs.observe(document.body, { childList: true, subtree: true });

      startBtn.addEventListener('click', () => {
        overlay.remove();
        canvas.focus();
        window.addEventListener('keydown', kd);
        window.addEventListener('keyup', ku);
        const game = MAKERS[id](W_, H_, r, speed, input, duration, opts);
        let last = performance.now(), countdown = 3, t = 0;
        function frame(now) {
          const dt = Math.min(0.05, (now - last) / 1000);
          last = now;
          ctx.save();
          if (mirror) { ctx.translate(W_, 0); ctx.scale(-1, 1); }
          if (countdown > 0) {
            countdown -= dt;
            game.draw(ctx, 0);
            ctx.restore();
            ctx.fillStyle = '#0008'; ctx.fillRect(0, 0, W_, H_);
            ctx.fillStyle = '#fff'; ctx.font = '900 90px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(Math.ceil(countdown), W_ / 2, H_ / 2);
            input.clicks.length = 0;
            raf = requestAnimationFrame(frame);
            return;
          }
          t += dt;
          const over = game.update(dt, t);
          game.draw(ctx, t);
          ctx.restore();
          // HUD (never mirrored)
          ctx.fillStyle = '#0009'; ctx.fillRect(0, 0, W_, 30);
          ctx.fillStyle = '#fff'; ctx.font = '800 16px system-ui'; ctx.textBaseline = 'middle';
          ctx.textAlign = 'left'; ctx.fillText((game.label || 'Poäng') + ': ' + W.fmt(game.score), 10, 15);
          ctx.textAlign = 'right'; ctx.fillText('⏱ ' + Math.max(0, Math.ceil(duration - t)) + ' s', W_ - 10, 15);
          if (game.extra) { ctx.textAlign = 'center'; ctx.fillText(game.extra(), W_ / 2, 15); }
          input.clicks.length = 0;
          if (over || t >= duration) {
            ctx.fillStyle = '#000a'; ctx.fillRect(0, 0, W_, H_);
            ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.font = '900 34px system-ui';
            ctx.fillText(game.won === false ? 'Slut!' : game.won ? 'Vinst! 🏆' : 'Tiden är ute!', W_ / 2, H_ / 2 - 20);
            ctx.font = '800 22px system-ui'; ctx.fillText(W.fmt(game.score) + ' poäng', W_ / 2, H_ / 2 + 20);
            setTimeout(() => finish(game.score), 900);
            if (game.won) wrap.dataset.won = '1';
            return;
          }
          raf = requestAnimationFrame(frame);
        }
        raf = requestAnimationFrame(frame);
      });
    });
  }

  const bg = (ctx, W_, H_, a, b) => {
    const g = ctx.createLinearGradient(0, 0, 0, H_);
    g.addColorStop(0, a); g.addColorStop(1, b);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W_, H_);
  };
  const steer = (input, dt, x, y, sp, W_, H_, axis) => {
    const k = input.keys;
    const dx = (k.ArrowRight || k.d ? 1 : 0) - (k.ArrowLeft || k.a ? 1 : 0);
    const dy = (k.ArrowDown || k.s ? 1 : 0) - (k.ArrowUp || k.w ? 1 : 0);
    if (dx || dy) { input.pointer = false; return [x + dx * sp * dt, y + dy * sp * dt]; }
    if (!input.pointer) return [x, y];
    const f = Math.min(1, dt * 12);
    return [axis === 'y' ? x : x + (input.x - x) * f, axis === 'x' ? y : y + (input.y - y) * f];
  };

  const MAKERS = {
    stars(W_, H_, r, speed, input) {
      const s = { score: 0, px: W_ / 2, items: [], spawn: 0, flash: 0 };
      s.update = (dt, t) => {
        [s.px] = steer(input, dt, s.px, 0, 420, W_, H_, 'x');
        s.px = Math.max(35, Math.min(W_ - 35, s.px));
        s.spawn -= dt;
        if (s.spawn <= 0) {
          s.spawn = (0.45 - Math.min(0.25, t / 120)) / speed;
          const roll = r();
          s.items.push({ x: 20 + r() * (W_ - 40), y: -20, v: (110 + r() * 90 + t * 3) * speed, k: roll < 0.18 ? 'bomb' : roll < 0.28 ? 'gold' : 'star' });
        }
        s.items.forEach((it) => { it.y += it.v * dt; });
        s.items = s.items.filter((it) => {
          if (it.y > H_ - 50 && it.y < H_ - 20 && Math.abs(it.x - s.px) < 42) {
            if (it.k === 'bomb') { s.score = Math.max(0, s.score - 80); s.flash = 0.3; }
            else s.score += it.k === 'gold' ? 60 : 20;
            return false;
          }
          return it.y < H_ + 20;
        });
        s.flash = Math.max(0, s.flash - dt);
      };
      s.draw = (ctx) => {
        bg(ctx, W_, H_, '#0b0b30', '#2a1050');
        ctx.font = '26px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        s.items.forEach((it) => ctx.fillText(it.k === 'bomb' ? '💣' : it.k === 'gold' ? '🌟' : '⭐', it.x, it.y));
        ctx.fillStyle = '#5ee7ff'; ctx.beginPath(); ctx.ellipse(s.px, H_ - 30, 40, 12, 0, 0, Math.PI); ctx.fill();
        ctx.fillRect(s.px - 40, H_ - 34, 80, 4);
        if (s.flash) { ctx.fillStyle = 'rgba(255,60,60,' + s.flash + ')'; ctx.fillRect(0, 0, W_, H_); }
      };
      return s;
    },
    aim(W_, H_, r, speed, input, duration, o) {
      const s = { score: 0, t: null, hits: 0, pops: [] };
      const goal = o && o.goal;
      if (goal) s.label = 'Tid kvar-poäng';
      const next = () => { s.t = { x: 40 + r() * (W_ - 80), y: 60 + r() * (H_ - 100), age: 0, life: 1.6 / speed }; };
      next();
      s.extra = () => '🎯 ' + s.hits + (goal ? ' / ' + goal : '');
      s.update = (dt, time) => {
        s.t.age += dt;
        const rad = 30 * (1 - s.t.age / s.t.life) + 8;
        input.clicks.forEach(([x, y]) => {
          if (Math.hypot(x - s.t.x, y - s.t.y) < rad + 4) {
            const p = Math.round(100 * (1 - s.t.age / s.t.life)) + 20;
            s.score += p; s.hits++; s.pops.push({ x: s.t.x, y: s.t.y, p, a: 1 }); next();
          } else s.score = Math.max(0, s.score - 20);
        });
        if (goal) { s.score = Math.round(Math.max(0, duration - time) * 100); if (s.hits >= goal) { s.won = true; return true; } }
        if (s.t.age > s.t.life) next();
        s.pops.forEach((p) => { p.a -= dt * 2; p.y -= dt * 40; });
        s.pops = s.pops.filter((p) => p.a > 0);
      };
      s.draw = (ctx) => {
        bg(ctx, W_, H_, '#12261a', '#0b160f');
        const rad = Math.max(8, 30 * (1 - s.t.age / s.t.life) + 8);
        ['#ff3d6e', '#fff', '#ff3d6e', '#fff'].forEach((c, i) => {
          ctx.fillStyle = c; ctx.beginPath(); ctx.arc(s.t.x, s.t.y, rad * (1 - i * 0.24), 0, 7); ctx.fill();
        });
        ctx.font = '800 18px system-ui'; ctx.textAlign = 'center';
        s.pops.forEach((p) => { ctx.fillStyle = 'rgba(94,231,255,' + p.a + ')'; ctx.fillText('+' + p.p, p.x, p.y); });
      };
      return s;
    },
    dodge(W_, H_, r, speed, input) {
      const s = { score: 0, x: W_ / 2, y: H_ / 2, rocks: [], orbs: [], spawn: 0, lives: 3, inv: 0, label: 'Poäng' };
      s.extra = () => '❤️'.repeat(s.lives);
      s.update = (dt, t) => {
        [s.x, s.y] = steer(input, dt, s.x, s.y, 300, W_, H_);
        s.x = Math.max(15, Math.min(W_ - 15, s.x)); s.y = Math.max(45, Math.min(H_ - 15, s.y));
        s.spawn -= dt;
        if (s.spawn <= 0) {
          s.spawn = Math.max(0.18, 0.7 - t / 60) / speed;
          const side = Math.floor(r() * 4);
          const x = side === 0 ? -20 : side === 1 ? W_ + 20 : r() * W_;
          const y = side === 2 ? 10 : side === 3 ? H_ + 20 : 30 + r() * (H_ - 30);
          const a = Math.atan2(s.y - y + (r() - 0.5) * 120, s.x - x + (r() - 0.5) * 120);
          const v = (90 + r() * 80 + t * 2) * speed;
          s.rocks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, rad: 10 + r() * 14 });
          if (r() < 0.25) s.orbs.push({ x: 30 + r() * (W_ - 60), y: 60 + r() * (H_ - 90), age: 0 });
        }
        s.rocks.forEach((k) => { k.x += k.vx * dt; k.y += k.vy * dt; });
        s.rocks = s.rocks.filter((k) => k.x > -60 && k.x < W_ + 60 && k.y > -60 && k.y < H_ + 60);
        s.inv = Math.max(0, s.inv - dt);
        if (!s.inv) for (const k of s.rocks) if (Math.hypot(k.x - s.x, k.y - s.y) < k.rad + 10) { s.lives--; s.inv = 1.4; break; }
        s.orbs = s.orbs.filter((o) => { o.age += dt; if (Math.hypot(o.x - s.x, o.y - s.y) < 20) { s.score += 100; return false; } return o.age < 5; });
        s.score += dt * 40;
        if (s.lives <= 0) { s.won = false; return true; }
      };
      s.draw = (ctx, t) => {
        bg(ctx, W_, H_, '#05050f', '#14143a');
        ctx.fillStyle = '#ffffff55';
        for (let i = 0; i < 40; i++) ctx.fillRect((i * 97 + t * 20 * (i % 3 + 1)) % W_, (i * 53) % H_, 2, 2);
        s.orbs.forEach((o) => { ctx.fillStyle = '#3dff8a'; ctx.beginPath(); ctx.arc(o.x, o.y, 8 + Math.sin(o.age * 8) * 2, 0, 7); ctx.fill(); });
        s.rocks.forEach((k) => { ctx.fillStyle = '#8a7a6a'; ctx.beginPath(); ctx.arc(k.x, k.y, k.rad, 0, 7); ctx.fill(); ctx.fillStyle = '#6a5a4a'; ctx.beginPath(); ctx.arc(k.x - k.rad / 3, k.y - k.rad / 4, k.rad / 3, 0, 7); ctx.fill(); });
        if (!s.inv || Math.floor(t * 10) % 2) {
          ctx.fillStyle = '#5ee7ff'; ctx.beginPath(); ctx.moveTo(s.x, s.y - 14); ctx.lineTo(s.x + 11, s.y + 11); ctx.lineTo(s.x - 11, s.y + 11); ctx.fill();
        }
      };
      return s;
    },
    memory(W_, H_, r, speed, input) {
      const s = { score: 0, seq: [], step: 0, mode: 'show', timer: 0.6, lit: -1, level: 0, label: 'Poäng' };
      const pads = [[60, 50, '#ff3d6e'], [250, 50, '#3dff8a'], [60, 200, '#5ee7ff'], [250, 200, '#ffd23d']];
      const newRound = () => { s.seq.push(Math.floor(r() * 4)); s.step = 0; s.mode = 'show'; s.timer = 0.7; s.level++; };
      newRound();
      s.extra = () => 'Nivå ' + s.level;
      s.update = (dt) => {
        s.timer -= dt;
        if (s.mode === 'show') {
          const per = 0.62 / speed;
          if (s.timer <= 0) {
            if (s.lit >= 0) { s.lit = -1; s.timer = 0.15 / speed; s.step++; }
            else if (s.step < s.seq.length) { s.lit = s.seq[s.step]; s.timer = per; }
            else { s.mode = 'input'; s.step = 0; }
          }
        } else if (s.mode === 'input') {
          if (s.timer <= 0) s.lit = -1;
          const keyMap = { '1': 0, '2': 1, '3': 2, '4': 3 };
          const presses = input.clicks.map(([x, y]) => pads.findIndex(([px, py]) => x > px && x < px + 170 && y > py && y < py + 130));
          Object.keys(keyMap).forEach((k) => { if (input.keys[k]) { presses.push(keyMap[k]); input.keys[k] = false; } });
          for (const p of presses) {
            if (p < 0) continue;
            s.lit = p; s.timer = 0.2;
            if (p === s.seq[s.step]) {
              s.step++; s.score += 10 * s.level;
              if (s.step >= s.seq.length) { s.score += 50 * s.level; s.mode = 'wait'; s.timer = 0.6; }
            } else { s.won = false; return true; }
          }
        } else if (s.mode === 'wait' && s.timer <= 0) { s.lit = -1; newRound(); }
      };
      s.draw = (ctx) => {
        bg(ctx, W_, H_, '#1a1030', '#0b0b16');
        pads.forEach(([x, y, c], i) => {
          ctx.globalAlpha = s.lit === i ? 1 : 0.35;
          ctx.fillStyle = c; ctx.beginPath(); ctx.roundRect(x, y, 170, 130, 18); ctx.fill();
          ctx.globalAlpha = 1; ctx.fillStyle = '#0008'; ctx.font = '800 20px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(i + 1, x + 85, y + 65);
        });
        ctx.fillStyle = '#fff'; ctx.font = '700 14px system-ui';
        ctx.fillText(s.mode === 'show' ? 'Titta…' : s.mode === 'input' ? 'Din tur! (' + (s.seq.length - s.step) + ' kvar)' : 'Bra!', W_ / 2, H_ - 14);
      };
      return s;
    },
    pong(W_, H_, r, speed, input) {
      const s = { score: 0, me: 0, cpu: 0, py: H_ / 2, cy: H_ / 2, b: null, label: 'Poäng' };
      const serve = (dir) => { const a = (r() - 0.5) * 0.9; s.b = { x: W_ / 2, y: H_ / 2, vx: Math.cos(a) * 260 * dir * speed, vy: Math.sin(a) * 260 * speed }; };
      serve(1);
      s.extra = () => s.me + ' – ' + s.cpu;
      s.update = (dt) => {
        let y;
        [, y] = steer(input, dt, 0, s.py, 380, W_, H_, 'y');
        s.py = Math.max(70, Math.min(H_ - 40, y));
        s.cy += Math.max(-210, Math.min(210, (s.b.y - s.cy) * 5)) * dt;
        const b = s.b;
        b.x += b.vx * dt; b.y += b.vy * dt;
        if (b.y < 38 || b.y > H_ - 8) b.vy *= -1;
        if (b.x < 30 && b.x > 14 && Math.abs(b.y - s.py) < 42 && b.vx < 0) { b.vx *= -1.07; b.vy += (b.y - s.py) * 4; }
        if (b.x > W_ - 30 && b.x < W_ - 14 && Math.abs(b.y - s.cy) < 42 && b.vx > 0) { b.vx *= -1.05; b.vy += (b.y - s.cy) * 3; }
        if (b.x < -10) { s.cpu++; serve(1); }
        if (b.x > W_ + 10) { s.me++; s.score += 200; serve(-1); }
        if (s.me >= 5) { s.won = true; s.score += 500; return true; }
        if (s.cpu >= 5) { s.won = false; return true; }
      };
      s.draw = (ctx) => {
        ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W_, H_);
        ctx.fillStyle = '#3dff8a';
        for (let y = 40; y < H_; y += 20) ctx.fillRect(W_ / 2 - 2, y, 4, 10);
        ctx.fillRect(16, s.py - 40, 10, 80); ctx.fillRect(W_ - 26, s.cy - 40, 10, 80);
        ctx.fillRect(s.b.x - 6, s.b.y - 6, 12, 12);
      };
      return s;
    },
  };

  W.mini = { GAMES, PUBLIC, run };
})();
