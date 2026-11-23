// Small built-in minigames. Used by the boss battle, duels, the daily mystery, Neonzonen and the secret cave.
// W.mini.run(container, id, { seed, duration, speed, mirror }) -> Promise<score>
(function () {
  'use strict';
  const { h, rng } = W;

  const GAMES = {
    stars: { name: 'Stjärnregn', icon: '🌠', help: 'Fånga stjärnorna med skålen. Undvik bomberna! Mus, finger eller ← →.', duration: 30, pc: 500, color: '#ff3d6e' },
    aim: { name: 'Prickskytt', icon: '🎯', help: 'Klicka på måltavlorna så snabbt du kan. Missar kostar poäng!', duration: 30, pc: 1200, color: '#3dff8a' },
    dodge: { name: 'Asteroidflykt', icon: '☄️', help: 'Styr skeppet (mus, finger eller piltangenter). Undvik asteroiderna, plocka energiklot. 3 liv.', duration: 45, pc: 900, color: '#5ee7ff' },
    memory: { name: 'Minnesrutor', icon: '🧠', help: 'Titta på ordningen rutorna lyser i och tryck sedan i samma ordning. Det blir längre och längre!', duration: 75, pc: 400, color: '#ffd23d' },
    snake: { name: 'Ormen', icon: '🐍', help: 'Ät äpplena och väx! Krocka inte med väggen eller dig själv. Piltangenter/WASD, eller tryck åt det håll du vill svänga.', duration: 60, pc: 150, color: '#3dff8a' },
    flappy: { name: 'Flaxfågel', icon: '🐤', help: 'Tryck (eller mellanslag) för att flaxa. Flyg genom hålen i rören!', duration: 60, pc: 500, color: '#ffd23d' },
    breakout: { name: 'Tegelkross', icon: '🧱', help: 'Studsa bollen och krossa alla tegelstenar. Styr plattan med mus, finger eller ← →. 3 bollar.', duration: 60, pc: 600, color: '#ff7a3d' },
    runner: { name: 'Hinderlöpning', icon: '🏃', help: 'Tryck (eller mellanslag) för att hoppa över hindren. Tryck två gånger för dubbelhopp! Plocka mynt.', duration: 60, pc: 1200, color: '#a970ff' },
    whack: { name: 'Slå mullvaden', icon: '🔨', help: 'Klicka på mullvadarna innan de gömmer sig. Guldmullvad = bonus. Akta bomberna! (Tangent 1–9 funkar också.)', duration: 30, pc: 600, color: '#c88a4a' },
    stack: { name: 'Tornbygge', icon: '🏗️', help: 'Tryck (eller mellanslag) för att släppa blocket. Det som hänger utanför ramlar av. Bygg högt!', duration: 60, pc: 250, color: '#5ee7ff' },
    pong: { name: 'Pixel Pong', icon: '🏓', help: 'Det hemliga spelet. Först till 5 vinner. Mus, finger eller ↑ ↓.', duration: 120, secret: true },
  };
  const PUBLIC = ['stars', 'aim', 'dodge', 'memory', 'snake', 'flappy', 'breakout', 'runner', 'whack', 'stack'];

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

    const input = { x: W_ / 2, y: H_ / 2, keys: {}, clicks: [], pointer: false, taps: 0, presses: [] };
    function pos(e) {
      const b = canvas.getBoundingClientRect();
      let x = ((e.clientX - b.left) / b.width) * W_;
      const y = ((e.clientY - b.top) / b.height) * H_;
      if (mirror) x = W_ - x;
      return [x, y];
    }
    canvas.addEventListener('pointermove', (e) => { [input.x, input.y] = pos(e); input.pointer = true; });
    canvas.addEventListener('pointerdown', (e) => { e.preventDefault(); [input.x, input.y] = pos(e); input.pointer = true; input.clicks.push([input.x, input.y]); input.taps++; });
    canvas.style.touchAction = 'none';
    const kd = (e) => { if (!e.repeat) { input.presses.push(e.key); if ([' ', 'ArrowUp', 'w', 'W', 'Enter'].includes(e.key)) input.taps++; } input.keys[e.key] = true; if (e.key.startsWith('Arrow') || e.key === ' ') e.preventDefault(); if (e.key.startsWith('Arrow') || 'wasdWASD'.includes(e.key)) input.pointer = false; };
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
          const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
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
            input.clicks.length = 0; input.taps = 0; input.presses.length = 0;
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
          input.clicks.length = 0; input.taps = 0; input.presses.length = 0;
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
    snake(W_, H_, r, speed, input) {
      const C = 20, GW = 24, GH = 16, OY = 32;
      const s = { score: 0, body: [[6, 8], [5, 8], [4, 8]], dir: [1, 0], next: [1, 0], step: 0, food: null, eaten: 0, label: 'Poäng', pulse: 0 };
      const place = () => {
        for (let i = 0; i < 200; i++) {
          const f = [Math.floor(r() * GW), Math.floor(r() * GH)];
          if (!s.body.some((b) => b[0] === f[0] && b[1] === f[1])) { s.food = f; s.gold = r() < 0.15; return; }
        }
      };
      place();
      s.extra = () => '🍎 ' + s.eaten;
      const turn = (d) => { if (d[0] !== -s.dir[0] || d[1] !== -s.dir[1]) s.next = d; };
      s.update = (dt) => {
        const k = input.presses;
        k.forEach((key) => {
          if (key === 'ArrowUp' || key === 'w') turn([0, -1]);
          if (key === 'ArrowDown' || key === 's') turn([0, 1]);
          if (key === 'ArrowLeft' || key === 'a') turn([-1, 0]);
          if (key === 'ArrowRight' || key === 'd') turn([1, 0]);
        });
        input.clicks.forEach(([x, y]) => {
          const hx = s.body[0][0] * C + C / 2, hy = s.body[0][1] * C + C / 2 + OY;
          const dx = x - hx, dy = y - hy;
          if (s.dir[0] !== 0) turn([0, dy < 0 ? -1 : 1]); else turn([dx < 0 ? -1 : 1, 0]);
        });
        s.pulse += dt;
        s.step -= dt;
        if (s.step > 0) return;
        s.step = Math.max(0.055, 0.13 - s.eaten * 0.003) / speed;
        s.dir = s.next;
        const h = [s.body[0][0] + s.dir[0], s.body[0][1] + s.dir[1]];
        if (h[0] < 0 || h[1] < 0 || h[0] >= GW || h[1] >= GH || s.body.some((b) => b[0] === h[0] && b[1] === h[1])) { s.won = false; return true; }
        s.body.unshift(h);
        if (h[0] === s.food[0] && h[1] === s.food[1]) { s.eaten++; s.score += (s.gold ? 50 : 10) + s.eaten * 2; if (s.gold) s.body.push(s.body[s.body.length - 1]); place(); }
        else s.body.pop();
      };
      s.draw = (ctx) => {
        bg(ctx, W_, H_, '#0f2a1a', '#0a1a10');
        for (let x = 0; x < GW; x++) for (let y = 0; y < GH; y++) { ctx.fillStyle = (x + y) % 2 ? '#16351f' : '#133019'; ctx.fillRect(x * C, y * C + OY, C, C); }
        const f = s.food;
        ctx.font = (16 + Math.sin(s.pulse * 6) * 2) + 'px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(s.gold ? '🍐' : '🍎', f[0] * C + C / 2, f[1] * C + C / 2 + OY);
        s.body.forEach((b, i) => {
          const t = i / s.body.length;
          ctx.fillStyle = 'hsl(' + (130 - t * 40) + ',80%,' + (55 - t * 20) + '%)';
          ctx.beginPath(); ctx.roundRect(b[0] * C + 1, b[1] * C + OY + 1, C - 2, C - 2, i === 0 ? 7 : 5); ctx.fill();
        });
        const hd = s.body[0];
        ctx.fillStyle = '#fff';
        const ex = hd[0] * C + C / 2 + s.dir[0] * 4, ey = hd[1] * C + OY + C / 2 + s.dir[1] * 4;
        [[-s.dir[1] * 4, s.dir[0] * 4], [s.dir[1] * 4, -s.dir[0] * 4]].forEach(([ox, oy]) => { ctx.beginPath(); ctx.arc(ex + ox, ey + oy, 2.6, 0, 7); ctx.fill(); });
      };
      return s;
    },
    flappy(W_, H_, r, speed, input) {
      const s = { score: 0, y: H_ / 2, vy: 0, pipes: [], spawn: 0.6, passed: 0, label: 'Poäng', clouds: [], dead: false };
      for (let i = 0; i < 6; i++) s.clouds.push({ x: r() * W_, y: 50 + r() * 120, s: 0.6 + r() * 0.8 });
      s.extra = () => '🟩 ' + s.passed;
      s.update = (dt) => {
        if (input.taps) s.vy = -290;
        s.vy += 900 * dt; s.y += s.vy * dt;
        const v = (150 + s.passed * 3) * speed;
        s.spawn -= dt;
        if (s.spawn <= 0) { s.spawn = 1.55 / speed; const gap = Math.max(105, 140 - s.passed * 2); s.pipes.push({ x: W_ + 30, gy: 70 + r() * (H_ - 140 - gap), gap, done: false }); }
        s.pipes.forEach((p) => { p.x -= v * dt; if (!p.done && p.x + 26 < 110) { p.done = true; s.passed++; s.score += 100; } });
        s.pipes = s.pipes.filter((p) => p.x > -70);
        s.clouds.forEach((c) => { c.x -= v * 0.2 * c.s * dt; if (c.x < -80) c.x = W_ + 60; });
        if (s.y < 42) { s.y = 42; s.vy = Math.max(0, s.vy); }
        if (s.y > H_ - 26) { s.won = false; return true; }
        for (const p of s.pipes) if (120 + 13 > p.x - 26 && 120 - 13 < p.x + 26 && (s.y - 11 < p.gy || s.y + 11 > p.gy + p.gap)) { s.won = false; return true; }
      };
      s.draw = (ctx) => {
        bg(ctx, W_, H_, '#5ec8ff', '#bfeaff');
        ctx.fillStyle = '#ffffffcc';
        s.clouds.forEach((c) => { ctx.beginPath(); ctx.ellipse(c.x, c.y, 34 * c.s, 14 * c.s, 0, 0, 7); ctx.ellipse(c.x + 18 * c.s, c.y - 8 * c.s, 20 * c.s, 12 * c.s, 0, 0, 7); ctx.fill(); });
        s.pipes.forEach((p) => {
          const g = ctx.createLinearGradient(p.x - 26, 0, p.x + 26, 0);
          g.addColorStop(0, '#2a9a3a'); g.addColorStop(0.4, '#6ee06e'); g.addColorStop(1, '#1f7a2c');
          ctx.fillStyle = g;
          ctx.fillRect(p.x - 26, 30, 52, p.gy - 30); ctx.fillRect(p.x - 26, p.gy + p.gap, 52, H_ - p.gy - p.gap);
          ctx.fillRect(p.x - 31, p.gy - 18, 62, 18); ctx.fillRect(p.x - 31, p.gy + p.gap, 62, 18);
          ctx.strokeStyle = '#0d4a16'; ctx.lineWidth = 2; ctx.strokeRect(p.x - 31, p.gy - 18, 62, 18); ctx.strokeRect(p.x - 31, p.gy + p.gap, 62, 18);
        });
        ctx.fillStyle = '#d8b46a'; ctx.fillRect(0, H_ - 20, W_, 20); ctx.fillStyle = '#7ac74f'; ctx.fillRect(0, H_ - 24, W_, 6);
        ctx.save(); ctx.translate(120, s.y); ctx.rotate(Math.max(-0.5, Math.min(1.1, s.vy / 450)));
        ctx.fillStyle = '#ffd23d'; ctx.beginPath(); ctx.ellipse(0, 0, 15, 12, 0, 0, 7); ctx.fill();
        ctx.fillStyle = '#ffb000'; ctx.beginPath(); ctx.ellipse(-4, 2 + Math.sin(performance.now() / 60) * 3, 8, 5, 0, 0, 7); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(6, -4, 5, 0, 7); ctx.fill(); ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(7.5, -4, 2.2, 0, 7); ctx.fill();
        ctx.fillStyle = '#ff7a3d'; ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(21, 3); ctx.lineTo(12, 6); ctx.fill();
        ctx.restore();
      };
      return s;
    },
    breakout(W_, H_, r, speed, input) {
      const s = { score: 0, px: W_ / 2, ball: null, bricks: [], lives: 3, wave: 0, label: 'Poäng', parts: [] };
      const COLORS = ['#ff3d6e', '#ff7a3d', '#ffd23d', '#3dff8a', '#5ee7ff', '#a970ff'];
      const build = () => {
        s.wave++; s.bricks = [];
        for (let y = 0; y < 5; y++) for (let x = 0; x < 10; x++) if (r() > 0.08 || s.wave === 1) s.bricks.push({ x: 14 + x * 45.2, y: 50 + y * 20, c: COLORS[(y + s.wave) % COLORS.length], hp: y === 0 && s.wave > 1 ? 2 : 1 });
      };
      const serve = () => { const a = -Math.PI / 2 + (r() - 0.5) * 0.8; const v = (260 + s.wave * 20) * speed; s.ball = { x: s.px, y: 300, vx: Math.cos(a) * v, vy: Math.sin(a) * v, stuck: 0.8 }; };
      build(); serve();
      s.extra = () => '⚪'.repeat(s.lives);
      s.update = (dt) => {
        [s.px] = steer(input, dt, s.px, 0, 480, W_, H_, 'x');
        s.px = Math.max(40, Math.min(W_ - 40, s.px));
        const b = s.ball;
        if (b.stuck > 0) { b.stuck -= dt; b.x = s.px; b.y = 318; return; }
        b.x += b.vx * dt; b.y += b.vy * dt;
        if (b.x < 7 || b.x > W_ - 7) { b.vx *= -1; b.x = Math.max(7, Math.min(W_ - 7, b.x)); }
        if (b.y < 37) { b.vy = Math.abs(b.vy); }
        if (b.y > 320 && b.y < 334 && Math.abs(b.x - s.px) < 44 && b.vy > 0) {
          const sp = Math.hypot(b.vx, b.vy) * 1.01, a = -Math.PI / 2 + ((b.x - s.px) / 44) * 1.05;
          b.vx = Math.cos(a) * sp; b.vy = Math.sin(a) * sp;
        }
        for (const k of s.bricks) {
          if (b.x > k.x - 6 && b.x < k.x + 43 && b.y > k.y - 6 && b.y < k.y + 18) {
            const ox = Math.min(b.x - (k.x - 6), k.x + 43 - b.x), oy = Math.min(b.y - (k.y - 6), k.y + 18 - b.y);
            if (ox < oy) b.vx *= -1; else b.vy *= -1;
            k.hp--;
            if (k.hp <= 0) { s.score += 20 * s.wave; for (let i = 0; i < 6; i++) s.parts.push({ x: k.x + 20, y: k.y + 8, vx: (r() - 0.5) * 200, vy: (r() - 0.8) * 200, c: k.c, a: 1 }); }
            break;
          }
        }
        s.bricks = s.bricks.filter((k) => k.hp > 0);
        if (!s.bricks.length) { s.score += 200; build(); serve(); }
        if (b.y > H_ + 10) { s.lives--; if (s.lives <= 0) { s.won = false; return true; } serve(); }
        s.parts.forEach((p) => { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 500 * dt; p.a -= dt * 1.5; });
        s.parts = s.parts.filter((p) => p.a > 0);
      };
      s.draw = (ctx) => {
        bg(ctx, W_, H_, '#141433', '#0b0b16');
        s.bricks.forEach((k) => {
          ctx.fillStyle = k.c; ctx.beginPath(); ctx.roundRect(k.x, k.y, 41, 16, 4); ctx.fill();
          ctx.fillStyle = '#ffffff40'; ctx.fillRect(k.x + 3, k.y + 2, 35, 4);
          if (k.hp > 1) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(k.x + 1, k.y + 1, 39, 14); }
        });
        s.parts.forEach((p) => { ctx.globalAlpha = Math.max(0, p.a); ctx.fillStyle = p.c; ctx.fillRect(p.x, p.y, 5, 5); });
        ctx.globalAlpha = 1;
        const g = ctx.createLinearGradient(0, 322, 0, 334); g.addColorStop(0, '#9ff4ff'); g.addColorStop(1, '#2aa8c8');
        ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(s.px - 42, 322, 84, 12, 6); ctx.fill();
        ctx.save(); ctx.shadowColor = '#fff'; ctx.shadowBlur = 12; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(s.ball.x, s.ball.y, 7, 0, 7); ctx.fill(); ctx.restore();
      };
      return s;
    },
    runner(W_, H_, r, speed, input) {
      const GY = 300;
      const s = { score: 0, y: GY, vy: 0, jumps: 0, obs: [], coins: [], spawn: 1, v: 260 * speed, dist: 0, label: 'Poäng', hills: [] };
      for (let i = 0; i < 6; i++) s.hills.push({ x: i * 110, h: 40 + r() * 60 });
      s.extra = () => Math.floor(s.dist / 10) + ' m';
      s.update = (dt) => {
        if (input.taps && s.jumps < 2) { s.vy = s.jumps ? -470 : -540; s.jumps++; }
        s.vy += 1500 * dt; s.y += s.vy * dt;
        if (s.y >= GY) { s.y = GY; s.vy = 0; s.jumps = 0; }
        s.v += dt * 6 * speed;
        s.dist += s.v * dt / 10; s.score += s.v * dt / 10;
        s.spawn -= dt;
        if (s.spawn <= 0) {
          s.spawn = (0.8 + r() * 0.9) * 280 / s.v;
          const kind = r();
          if (kind < 0.25) s.obs.push({ x: W_ + 20, w: 24, h: 70, c: '#ff3d6e' });
          else if (kind < 0.4) s.obs.push({ x: W_ + 20, w: 60, h: 30, c: '#ff7a3d' });
          else s.obs.push({ x: W_ + 20, w: 26, h: 36 + r() * 16, c: '#a970ff' });
          if (r() < 0.5) for (let i = 0; i < 3; i++) s.coins.push({ x: W_ + 120 + i * 28, y: GY - 80 - r() * 30 });
        }
        s.obs.forEach((o) => (o.x -= s.v * dt));
        s.coins.forEach((c) => (c.x -= s.v * dt));
        s.hills.forEach((hl) => { hl.x -= s.v * 0.25 * dt; if (hl.x < -120) hl.x += 660; });
        s.obs = s.obs.filter((o) => o.x > -80);
        s.coins = s.coins.filter((c) => { if (Math.hypot(c.x - 100, c.y - (s.y - 20)) < 22) { s.score += 50; return false; } return c.x > -20; });
        for (const o of s.obs) if (100 + 12 > o.x && 100 - 12 < o.x + o.w && s.y > GY - o.h + 4) { s.won = false; return true; }
      };
      s.draw = (ctx, t) => {
        bg(ctx, W_, H_, '#2a1a5a', '#ff8a6a');
        ctx.fillStyle = '#ffd23d'; ctx.beginPath(); ctx.arc(380, 150, 40, 0, 7); ctx.fill();
        ctx.fillStyle = '#3a2a6a';
        s.hills.forEach((hl) => { ctx.beginPath(); ctx.moveTo(hl.x - 70, GY); ctx.quadraticCurveTo(hl.x, GY - hl.h * 2, hl.x + 70, GY); ctx.fill(); });
        ctx.fillStyle = '#1a1030'; ctx.fillRect(0, GY, W_, H_ - GY);
        ctx.fillStyle = '#ffffff30'; for (let x = -((s.dist * 10) % 40); x < W_; x += 40) ctx.fillRect(x, GY + 8, 20, 3);
        s.obs.forEach((o) => { ctx.fillStyle = o.c; ctx.beginPath(); ctx.roundRect(o.x, GY - o.h, o.w, o.h, 5); ctx.fill(); ctx.fillStyle = '#ffffff30'; ctx.fillRect(o.x + 3, GY - o.h + 3, 5, o.h - 6); });
        s.coins.forEach((c) => { ctx.fillStyle = '#ffd23d'; ctx.beginPath(); ctx.ellipse(c.x, c.y, 8 * Math.abs(Math.cos(t * 4 + c.x)) + 1, 8, 0, 0, 7); ctx.fill(); });
        // runner
        const x = 100, y = s.y, run = s.y >= GY ? Math.sin(t * 18) : 0.6;
        ctx.strokeStyle = '#5ee7ff'; ctx.lineWidth = 5; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(x, y - 22); ctx.lineTo(x + run * 9, y); ctx.moveTo(x, y - 22); ctx.lineTo(x - run * 9, y); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x, y - 22); ctx.lineTo(x + 2, y - 42); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x + 1, y - 36); ctx.lineTo(x - run * 10, y - 26); ctx.moveTo(x + 1, y - 36); ctx.lineTo(x + run * 10, y - 26); ctx.stroke();
        ctx.fillStyle = '#ffdcb0'; ctx.beginPath(); ctx.arc(x + 3, y - 50, 8, 0, 7); ctx.fill();
      };
      return s;
    },
    whack(W_, H_, r, speed, input) {
      const s = { score: 0, holes: [], spawn: 0.4, label: 'Poäng', pops: [], hits: 0 };
      for (let i = 0; i < 9; i++) s.holes.push({ x: 100 + (i % 3) * 140, y: 110 + Math.floor(i / 3) * 95, up: 0, life: 0, kind: null, hit: 0 });
      s.extra = () => '🔨 ' + s.hits;
      const hitHole = (h) => {
        if (h.kind && h.up > 0.4 && !h.hit) {
          h.hit = 1;
          const p = h.kind === 'gold' ? 60 : h.kind === 'bomb' ? -60 : 20;
          s.score = Math.max(0, s.score + p); if (p > 0) s.hits++;
          s.pops.push({ x: h.x, y: h.y - 40, p, a: 1 });
          h.life = Math.min(h.life, 0.15);
        }
      };
      s.update = (dt, t) => {
        s.spawn -= dt;
        if (s.spawn <= 0) {
          s.spawn = Math.max(0.22, 0.6 - t / 80) / speed;
          const free = s.holes.filter((h) => !h.kind);
          if (free.length) { const h = free[Math.floor(r() * free.length)]; const k = r(); h.kind = k < 0.12 ? 'gold' : k < 0.25 ? 'bomb' : 'mole'; h.life = (0.75 + r() * 0.5) / speed; h.hit = 0; }
        }
        s.holes.forEach((h) => {
          if (!h.kind) return;
          h.life -= dt;
          h.up = h.life > 0 ? Math.min(1, h.up + dt * 8) : h.up - dt * 8;
          if (h.up <= 0 && h.life <= 0) { h.kind = null; h.up = 0; }
        });
        input.clicks.forEach(([x, y]) => { const h = s.holes.find((o) => Math.abs(x - o.x) < 50 && y > o.y - 70 && y < o.y + 25); if (h) hitHole(h); });
        input.presses.forEach((k) => { const n = parseInt(k, 10); if (n >= 1 && n <= 9) hitHole(s.holes[n - 1]); });
        s.pops.forEach((p) => { p.a -= dt * 2; p.y -= dt * 40; });
        s.pops = s.pops.filter((p) => p.a > 0);
      };
      s.draw = (ctx) => {
        bg(ctx, W_, H_, '#6ac45a', '#3d8a3a');
        ctx.fillStyle = '#ffffff10'; for (let i = 0; i < 30; i++) ctx.fillRect((i * 83) % W_, (i * 47) % H_, 3, 8);
        s.holes.forEach((h, i) => {
          ctx.fillStyle = '#3a2510'; ctx.beginPath(); ctx.ellipse(h.x, h.y, 44, 16, 0, 0, 7); ctx.fill();
          if (h.kind && h.up > 0) {
            ctx.save(); ctx.beginPath(); ctx.rect(h.x - 50, h.y - 90, 100, 90); ctx.clip();
            const yy = h.y + 10 - h.up * 52;
            ctx.fillStyle = h.kind === 'gold' ? '#ffd23d' : h.kind === 'bomb' ? '#333' : '#8a5a3a';
            ctx.beginPath(); ctx.ellipse(h.x, yy, 26, 32, 0, 0, 7); ctx.fill();
            if (h.kind === 'bomb') { ctx.font = '30px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('💣', h.x, yy - 2); }
            else {
              ctx.fillStyle = h.hit ? '#000' : '#fff'; ctx.beginPath(); ctx.arc(h.x - 9, yy - 10, 5, 0, 7); ctx.arc(h.x + 9, yy - 10, 5, 0, 7); ctx.fill();
              if (!h.hit) { ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(h.x - 9, yy - 9, 2.5, 0, 7); ctx.arc(h.x + 9, yy - 9, 2.5, 0, 7); ctx.fill(); }
              ctx.fillStyle = '#ff8aa0'; ctx.beginPath(); ctx.ellipse(h.x, yy + 2, 7, 5, 0, 0, 7); ctx.fill();
            }
            ctx.restore();
          }
          ctx.fillStyle = '#5a3a1a'; ctx.beginPath(); ctx.ellipse(h.x, h.y + 6, 46, 12, 0, 0, Math.PI); ctx.fill();
          ctx.fillStyle = '#ffffff70'; ctx.font = '700 11px system-ui'; ctx.textAlign = 'center'; ctx.fillText(i + 1, h.x, h.y + 28);
        });
        ctx.font = '900 18px system-ui';
        s.pops.forEach((p) => { ctx.fillStyle = (p.p > 0 ? 'rgba(255,255,255,' : 'rgba(255,60,60,') + p.a + ')'; ctx.fillText((p.p > 0 ? '+' : '') + p.p, p.x, p.y); });
      };
      return s;
    },
    stack(W_, H_, r, speed, input) {
      const BH = 22;
      const s = { score: 0, tower: [{ x: 140, w: 200 }], cur: null, dir: 1, cam: 0, falls: [], label: 'Poäng', perfect: 0 };
      const hue = (i) => 'hsl(' + ((i * 17 + 190) % 360) + ',75%,58%)';
      const spawn = () => { const top = s.tower[s.tower.length - 1]; s.cur = { x: s.dir > 0 ? -top.w * 0.5 : W_ - top.w * 0.5, w: top.w }; };
      spawn();
      s.extra = () => '🏗️ ' + (s.tower.length - 1);
      s.update = (dt) => {
        const v = (170 + s.tower.length * 7) * speed;
        s.cur.x += s.dir * v * dt;
        if (s.cur.x > W_ - s.cur.w * 0.2 && s.dir > 0) s.dir = -1;
        if (s.cur.x < -s.cur.w * 0.8 && s.dir < 0) s.dir = 1;
        if (input.taps) {
          const top = s.tower[s.tower.length - 1];
          const a = Math.max(top.x, s.cur.x), b = Math.min(top.x + top.w, s.cur.x + s.cur.w);
          if (b - a <= 2) { s.falls.push({ x: s.cur.x, w: s.cur.w, y: s.tower.length, vy: 0, i: s.tower.length }); s.won = false; return true; }
          let nx = a, nw = b - a;
          if (Math.abs(s.cur.x - top.x) < 6) { nx = top.x; nw = top.w; s.perfect++; s.score += 25; }
          else {
            s.perfect = 0;
            const cutX = s.cur.x < top.x ? s.cur.x : b, cutW = s.cur.w - nw;
            s.falls.push({ x: cutX, w: cutW, y: s.tower.length, vy: 0, i: s.tower.length });
          }
          s.tower.push({ x: nx, w: nw });
          s.score += 10;
          s.dir = r() < 0.5 ? 1 : -1;
          spawn();
        }
        s.cam += (Math.max(0, s.tower.length - 8) * BH - s.cam) * Math.min(1, dt * 5);
        s.falls.forEach((f) => { f.vy += 900 * dt; f.y -= f.vy * dt / BH; });
        s.falls = s.falls.filter((f) => f.y > -20);
      };
      s.draw = (ctx) => {
        bg(ctx, W_, H_, '#141a40', '#3a1a5a');
        const base = H_ - 20 + s.cam;
        s.tower.forEach((b, i) => {
          const y = base - (i + 1) * BH;
          if (y > H_ + 30) return;
          ctx.fillStyle = hue(i); ctx.fillRect(b.x, y, b.w, BH - 1);
          ctx.fillStyle = '#ffffff30'; ctx.fillRect(b.x, y, b.w, 4);
        });
        const cy = base - (s.tower.length + 1) * BH;
        ctx.fillStyle = hue(s.tower.length); ctx.fillRect(s.cur.x, cy, s.cur.w, BH - 1);
        ctx.fillStyle = '#ffffff40'; ctx.fillRect(s.cur.x, cy, s.cur.w, 4);
        s.falls.forEach((f) => { ctx.fillStyle = hue(f.i); ctx.globalAlpha = 0.8; ctx.fillRect(f.x, base - (f.y + 1) * BH, f.w, BH - 1); ctx.globalAlpha = 1; });
        if (s.perfect > 0) { ctx.fillStyle = '#ffd23d'; ctx.font = '900 18px system-ui'; ctx.textAlign = 'center'; ctx.fillText('PERFEKT! x' + s.perfect, W_ / 2, 60); }
      };
      return s;
    },
  };

  W.mini = { GAMES, PUBLIC, run };
})();
