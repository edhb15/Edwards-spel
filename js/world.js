// The living world: a map you walk around in. Every game is a building, the plaza holds the special places.
// Graphics: the ground, roads and plaza are painted once into a big picture (fast), buildings/trees/people are
// drawn every frame on top, sorted by depth, then light and weather are added.
(function () {
  'use strict';
  const { D } = W;
  const WW = 2400, WH = 1880;
  const PLAZA = { x: 1200, y: 960, r: 330 };

  // ------------------------------------------------------------------ structures
  const structs = [];
  D.GAMES.forEach((g) => structs.push({ id: g.id, type: 'game', game: g, x: g.x, y: g.y, w: g.w, h: g.h, kind: g.kind, label: g.name, color: g.roof, d: g.d }));
  const F = (id, label, icon, x, y, w, h, color, kind) => structs.push({ id, type: 'feature', label, icon, x, y, w, h, color, kind: kind || 'block' });
  F('mystery', 'Mysterietornet', '🕵️', 1200, 760, 120, 210, '#a970ff', 'tower');
  F('boss', 'Bossarenan', '👹', 1500, 1000, 190, 150, '#ff3d6e', 'arena');
  F('roulette', 'Lyckohjulet', '🎲', 900, 1000, 150, 130, '#ffd23d', 'wheel');
  F('feed', 'Live-tavlan', '📺', 1010, 1210, 170, 120, '#5ee7ff', 'screen');
  F('community', 'Monumentet', '🎯', 1390, 1210, 130, 150, '#3dff8a', 'monument');
  F('duel', 'Duellhallen', '⚔️', 1440, 735, 160, 130, '#ff7a3d', 'hall');
  F('profile', 'DNA-labbet', '🧬', 950, 760, 160, 130, '#5ee7ff', 'lab');
  F('home', 'Mitt rum', '🏠', 1200, 1560, 180, 150, '#ffb03d', 'house');
  F('neighbors', 'Granngatan', '🏘️', 1440, 1580, 150, 120, '#e8ecff', 'house');
  F('fame', 'Hall of Fame', '🏆', 1200, 450, 200, 150, '#ffd23d', 'hall');
  F('terminal', 'Terminalen', '💻', 960, 1600, 80, 60, '#3dff8a', 'terminal');
  F('wish', 'Önskebrunnen', '⛲', 1200, 1010, 120, 60, '#3d9bff', 'none');
  F('cave', '???', '🕳️', 70, 1000, 70, 60, '#333', 'cave');
  structs.forEach((s) => { s.rect = [s.x - s.w / 2, s.y - s.h, s.w, s.h - 14]; });
  const SOLID = structs.filter((s) => s.kind !== 'none');
  const byId = {};
  structs.forEach((s) => (byId[s.id] = s));
  byId.cave.hidden = true;
  const BOTTLE = { x: 2355, y: 1845 };

  // ------------------------------------------------------------------ layout of roads, trees, lamps (same for everyone)
  const ROADS = [];
  D.GAMES.forEach((g) => ROADS.push([PLAZA.x, PLAZA.y, g.x, g.y + 30]));
  ROADS.push([PLAZA.x, PLAZA.y, 1200, 480], [PLAZA.x, PLAZA.y, 1200, 1580], [1200, 1580, 1440, 1600], [1200, 1580, 960, 1600]);
  function distToRoad(x, y) {
    let best = 1e9;
    for (const [a, b, c, d] of ROADS) {
      const L = Math.hypot(c - a, d - b);
      const t = Math.max(0, Math.min(1, ((x - a) * (c - a) + (y - b) * (d - b)) / (L * L)));
      best = Math.min(best, Math.hypot(x - (a + t * (c - a)), y - (b + t * (d - b))));
    }
    return best;
  }
  const inNeon = () => false;
  function blocked(x, y, pad, below) {
    if (Math.hypot(x - PLAZA.x, y - PLAZA.y) < PLAZA.r + 30) return true;
    for (const s of structs) {
      const [rx, ry, rw, rh] = s.rect;
      if (x > rx - pad && x < rx + rw + pad && y > ry - pad - 30 && y < ry + rh + pad + (below || 50)) return true;
    }
    return false;
  }
  const r0 = W.rng(1234);
  const trees = [];
  for (let i = 0; i < 1400 && trees.length < 300; i++) {
    const x = 50 + r0() * (WW - 100), y = 60 + r0() * (WH - 100);
    const inForest = x < 700 && y > 720 && y < 1180;
    const edge = x < 110 || x > WW - 110 || y < 100 || y > WH - 70;
    if (!inForest && !edge && r0() > 0.13) continue;
    if (distToRoad(x, y) < 52 || blocked(x, y, 40, 110) || inNeon(x, y, 30)) continue;
    const kind = inForest ? (r0() < 0.6 ? 'pine' : 'dark') : r0() < 0.2 ? 'bush' : r0() < 0.3 ? 'pine' : r0() < 0.5 ? 'round2' : 'round';
    trees.push({ x, y, s: 0.85 + r0() * 0.5, k: kind, ph: r0() * 6 });
  }
  for (let i = 0; i < 26; i++) trees.push({ x: 25 + r0() * 160, y: 890 + r0() * 240, s: 1 + r0() * 0.45, k: r0() < 0.5 ? 'pine' : 'dark', ph: r0() * 6 });
  const LAMPS = [];
  ROADS.forEach(([a, b, c, d]) => {
    const L = Math.hypot(c - a, d - b), nx = -(d - b) / L, ny = (c - a) / L;
    for (let t = 0.5; t < 1; t += 0.35) {
      const x = a + (c - a) * t + nx * 36, y = b + (d - b) * t + ny * 36;
      if (Math.hypot(x - PLAZA.x, y - PLAZA.y) > PLAZA.r + 20 && !blocked(x, y, 0)) LAMPS.push({ x, y });
    }
  });
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + 0.39; LAMPS.push({ x: PLAZA.x + Math.cos(a) * (PLAZA.r - 18), y: PLAZA.y + Math.sin(a) * (PLAZA.r - 18) }); }

  // ------------------------------------------------------------------ live state
  const state = {
    p: { x: PLAZA.x, y: PLAZA.y + 160, tx: null, ty: null, face: 1, moving: false, after: null, walk: 0 },
    heat: {}, crowd: {}, ghosts: [], boss: null, rewards: {}, coins: [],
    district: null, near: null, t: 0,
  };
  const imgs = {};
  D.GAMES.forEach((g) => { const im = new Image(); im.onload = () => (imgs[g.id] = im); im.src = g.img; });

  function dailyCoins() {
    const rr = W.daily('coins');
    const list = [];
    for (let i = 0; list.length < 25 && i < 600; i++) {
      const x = 130 + rr() * (WW - 260), y = 130 + rr() * (WH - 260);
      if (blocked(x, y, 20) && Math.hypot(x - PLAZA.x, y - PLAZA.y) > PLAZA.r) continue;
      if (Math.hypot(x - PLAZA.x, y - PLAZA.y) < 90 || inNeon(x, y, 20)) continue;
      list.push({ i: list.length, x, y });
    }
    return list;
  }

  // ------------------------------------------------------------------ helpers
  function shade(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.max(0, Math.min(255, Math.round(f > 1 ? v + (255 - v) * (f - 1) : v * f))));
    return 'rgb(' + c.join(',') + ')';
  }
  function rgba(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }
  const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';

  // ------------------------------------------------------------------ canvas & camera
  let canvas, ctx, dpr = 1, vw = 0, vh = 0, zoom = 1, cam = { x: 0, y: 0 };
  let staticC = null, staticS = 0;
  const lightC = document.createElement('canvas');
  const lctx = lightC.getContext('2d');
  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    vw = canvas.clientWidth; vh = canvas.clientHeight;
    canvas.width = vw * dpr; canvas.height = vh * dpr;
    zoom = Math.max(0.5, Math.min(0.92, Math.min(vw, vh) / 880));
    lightC.width = Math.ceil(vw / 2); lightC.height = Math.ceil(vh / 2);
    const want = Math.min(vw < 700 ? 1 : 1.25, Math.max(0.75, Math.round(dpr * zoom * 4) / 4));
    if (want !== staticS) { staticS = want; staticC = null; setTimeout(() => { if (!staticC) staticC = buildStatic(staticS); }, 0); }
  }
  const toWorld = (sx, sy) => [sx / zoom + cam.x, sy / zoom + cam.y];

  const keys = {};
  function init(c) {
    canvas = c;
    ctx = canvas.getContext('2d');
    resize();
    staticC = buildStatic(staticS);
    window.addEventListener('resize', resize);
    window.addEventListener('keydown', (e) => {
      if (W.modalOpen() || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      keys[e.key.toLowerCase()] = true;
      if (e.key.startsWith('Arrow')) e.preventDefault();
      if ((e.key === 'e' || e.key === 'Enter' || e.key === ' ') && state.near) { e.preventDefault(); enter(state.near); }
    });
    window.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });
    window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
    canvas.addEventListener('pointerdown', (e) => {
      const b = canvas.getBoundingClientRect();
      const [x, y] = toWorld(e.clientX - b.left, e.clientY - b.top);
      const hit = structs.slice().reverse().find((s) => !s.hidden && s.kind !== 'none' && x > s.rect[0] - 6 && x < s.rect[0] + s.rect[2] + 6 && y > s.rect[1] - 60 && y < s.y + 12);
      if (hit) {
        if (hit.id === 'boss') { W.profile.pokes = (W.profile.pokes || 0) + 1; if (W.profile.pokes >= 30) W.award('boss-poke'); }
        walkTo(hit.x, hit.y + 22, hit);
      } else walkTo(x, y, null);
    });
    state.coins = dailyCoins();
    let last = performance.now();
    function loop(now) {
      const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
      last = now;
      update(dt);
      draw();
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
    setInterval(checkDistrict, 500);
  }
  function walkTo(x, y, s) {
    state.p.tx = Math.max(20, Math.min(WW - 20, x));
    state.p.ty = Math.max(20, Math.min(WH - 20, y));
    state.p.after = s;
  }
  function teleport(id) {
    const s = byId[id];
    if (!s) return;
    state.p.x = s.x; state.p.y = s.y + 26; state.p.tx = null; state.p.after = null;
    puff.push({ x: state.p.x, y: state.p.y, a: 1 });
  }
  const puff = [];

  function solids() {
    const list = SOLID.map((s) => s.rect);
    list.push([PLAZA.x - 62, PLAZA.y - 40, 124, 64]); // fountain
    return list;
  }
  function collide(x, y) {
    for (const [rx, ry, rw, rh] of solids()) if (x > rx - 12 && x < rx + rw + 12 && y > ry - 6 && y < ry + rh + 6) return true;
    return x < 30 || y < 30 || x > WW - 30 || y > WH - 22;
  }

  // ------------------------------------------------------------------ simulation
  const sparks = [];
  function sparkle(x, y, text) { sparks.push({ x, y, a: 1, text }); }
  const particles = []; // fountain drops, smoke, confetti
  const fireflies = Array.from({ length: 40 }, (_, i) => ({ x: 120 + ((i * 137) % 580), y: 760 + ((i * 89) % 400), ph: i * 1.7 }))
    .concat(Array.from({ length: 16 }, (_, i) => ({ x: PLAZA.x - 300 + ((i * 97) % 600), y: PLAZA.y - 260 + ((i * 61) % 520), ph: i })));
  const clouds = Array.from({ length: 7 }, (_, i) => ({ x: (i * 520) % WW, y: (i * 330) % WH, s: 0.8 + (i % 3) * 0.4 }));
  let birds = null, birdTimer = 6;

  function update(dt) {
    state.t += dt;
    const p = state.p;
    let dx = (keys.arrowright || keys.d ? 1 : 0) - (keys.arrowleft || keys.a ? 1 : 0);
    let dy = (keys.arrowdown || keys.s ? 1 : 0) - (keys.arrowup || keys.w ? 1 : 0);
    if (dx || dy) { p.tx = null; p.after = null; }
    else if (p.tx !== null) {
      const ddx = p.tx - p.x, ddy = p.ty - p.y, L = Math.hypot(ddx, ddy);
      if (L < 8) {
        p.tx = null;
        if (p.after) { const s = p.after; p.after = null; enter(s); }
      } else { dx = ddx / L; dy = ddy / L; }
    }
    const L = Math.hypot(dx, dy);
    p.moving = L > 0;
    if (L) {
      const sp = 270 * dt;
      const nx = p.x + (dx / L) * sp, ny = p.y + (dy / L) * sp;
      let moved = false;
      if (!collide(nx, p.y)) { p.x = nx; moved = true; }
      if (!collide(p.x, ny)) { p.y = ny; moved = true; }
      if (moved) p.walk += dt * 11;
      if (!moved && p.tx !== null) {
        if (p.after) { const s = p.after; p.after = null; p.tx = null; teleport(s.id); enter(s); } else p.tx = null;
      }
      if (dx) p.face = dx > 0 ? 1 : -1;
    }
    let near = null, nd = 70;
    structs.forEach((s) => {
      const d = Math.hypot(p.x - s.x, p.y - (s.y + 18));
      if (d < nd && (!s.hidden || d < 45)) { nd = d; near = s; }
    });
    if (near !== state.near) { state.near = near; W.emit('near', near); }
    // coins & artifacts
    if (W.profile.coinDay.date !== W.today()) { W.profile.coinDay = { date: W.today(), got: [] }; W.save(); state.coins = dailyCoins(); }
    state.coins.forEach((c) => {
      if (!W.profile.coinDay.got.includes(c.i) && Math.hypot(c.x - p.x, c.y - p.y) < 30) {
        W.profile.coinDay.got.push(c.i);
        W.addCoins(1, true);
        W.emit('coin');
        sparkle(c.x, c.y, '+1 🪙');
        for (let k = 0; k < 10; k++) particles.push({ x: c.x, y: c.y - 10, vx: (Math.random() - 0.5) * 160, vy: -Math.random() * 180, life: 0.7, max: 0.7, c: '#ffd23d', g: 400, sz: 3 });
        if (W.profile.coinDay.got.length === state.coins.length) { W.toast('Du hittade alla dagens mynt! +10 🪙 bonus', 'big'); W.addCoins(10, true); }
      }
    });
    D.ARTIFACTS.forEach((a) => {
      if (!W.profile.artifacts[a.id] && Math.hypot(a.x - p.x, a.y - p.y) < 32) {
        W.profile.artifacts[a.id] = 1;
        W.addXp(40);
        const n = Object.keys(W.profile.artifacts).length;
        W.toast(a.e + ' Artefakt hittad! (' + n + '/8)', 'big');
        for (let k = 0; k < 24; k++) particles.push({ x: a.x, y: a.y, vx: (Math.random() - 0.5) * 260, vy: -Math.random() * 260, life: 1.1, max: 1.1, c: 'hsl(' + k * 15 + ',90%,65%)', g: 300, sz: 4 });
        if (n >= 8) W.award('artifacts');
      }
    });
    if (Math.hypot(BOTTLE.x - p.x, BOTTLE.y - p.y) < 40 && !W.has('edge')) {
      W.award('edge');
      W.modal('🍾 Flaskpost!', W.h('div', null, W.h('p', null, 'Någon har kastat en flaska i havet. På lappen står det:'),
        W.h('blockquote', { class: 'note' }, '”Den som skriver EOJ2026 i terminalen vid Mitt rum får se något. Men koden finns egentligen gömd i sidans källkod… – E & J”')));
    }
    // fountain water
    if (Math.random() < dt * 40) {
      const a = Math.random() * Math.PI * 2;
      particles.push({ x: PLAZA.x, y: PLAZA.y - 34, vx: Math.cos(a) * 40, vy: -150 - Math.random() * 40, life: 0.95, max: 0.95, c: state.rewards['gold-fountain'] ? '#ffe680' : '#bfe9ff', g: 320, sz: 2.5 });
    }
    // chimney smoke
    if (Math.random() < dt * 3) ['home', 'neighbors'].forEach((id) => { const s = byId[id]; particles.push({ x: s.x + s.w * 0.28, y: s.y - s.h - 6, vx: 8 + Math.random() * 6, vy: -22, life: 2.6, max: 2.6, c: '#d8d8e8', g: -2, sz: 6, smoke: true }); });
    for (let i = particles.length - 1; i >= 0; i--) {
      const q = particles[i];
      q.life -= dt; q.vy += q.g * dt; q.x += q.vx * dt; q.y += q.vy * dt;
      if (q.life <= 0) particles.splice(i, 1);
    }
    state.ghosts.forEach((g) => {
      g.a += Math.sin(state.t * 0.7 + g.seed) * 0.8 * dt;
      g.x += Math.cos(g.a) * 30 * dt; g.y += Math.sin(g.a) * 30 * dt; g.walk = (g.walk || 0) + dt * 8;
      if (Math.hypot(g.x - g.hx, g.y - g.hy) > 90) g.a = Math.atan2(g.hy - g.y, g.hx - g.x);
    });
    sparks.forEach((s) => { s.a -= dt; s.y -= 30 * dt; });
    while (sparks.length && sparks[0].a <= 0) sparks.shift();
    puff.forEach((s) => (s.a -= dt * 1.5));
    while (puff.length && puff[0].a <= 0) puff.shift();
    clouds.forEach((c) => { c.x += 14 * dt * c.s; c.y += 4 * dt; if (c.x > WW + 300) c.x = -300; if (c.y > WH + 200) c.y = -200; });
    birdTimer -= dt;
    if (birdTimer <= 0 && !birds) { birds = { x: cam.x - 100, y: cam.y + 80 + Math.random() * 200, n: 5 + Math.floor(Math.random() * 4) }; birdTimer = 18 + Math.random() * 20; }
    if (birds) { birds.x += 120 * dt; birds.y -= 10 * dt; if (birds.x > cam.x + vw / zoom + 200) birds = null; }
    // camera
    const tx = p.x - vw / zoom / 2, ty = p.y - vh / zoom / 2;
    cam.x += (tx - cam.x) * Math.min(1, dt * 6);
    cam.y += (ty - cam.y) * Math.min(1, dt * 6);
    cam.x = Math.max(-60, Math.min(WW - vw / zoom + 60, cam.x));
    cam.y = Math.max(-60, Math.min(WH - vh / zoom + 60, cam.y));
    if (WW < vw / zoom) cam.x = (WW - vw / zoom) / 2;
    if (WH < vh / zoom) cam.y = (WH - vh / zoom) / 2;
  }

  function checkDistrict() {
    const p = state.p;
    let cur = null;
    for (const k in D.DISTRICTS) {
      const d = D.DISTRICTS[k];
      if (p.x > d.x && p.x < d.x + d.w && p.y > d.y && p.y < d.y + d.h) cur = k;
    }
    if (Math.hypot(p.x - PLAZA.x, p.y - PLAZA.y) < PLAZA.r) cur = 'plaza';
    if (cur !== state.district) {
      state.district = cur;
      if (cur && cur !== 'plaza') {
        const d = D.DISTRICTS[cur];
        W.emit('district', cur);
        if (!W.profile.visited[cur]) {
          W.profile.visited[cur] = 1;
          W.addXp(20);
          W.toast(d.icon + ' Nytt område: ' + d.name);
          const all = Object.keys(D.DISTRICTS);
          if (all.every((k) => W.profile.visited[k])) W.award('explorer');
        }
      }
    }
    if (Math.hypot(p.x - 70, p.y - 1020) < 40 && !state.caveShown) { state.caveShown = true; W.toast('🕳️ Du hittade en dold grotta!'); }
  }
  function enter(s) {
    if (W.modalOpen()) return;
    W.emit('enter', s);
  }

  // ================================================================== static picture (ground, districts, roads, plaza)
  function buildStatic(S) {
    const c = document.createElement('canvas');
    c.width = Math.round(WW * S); c.height = Math.round(WH * S);
    const g = c.getContext('2d');
    g.scale(S, S);
    const r = W.rng(777);
    // sand + grass island with a wobbly shore
    g.fillStyle = '#e2c98f'; g.fillRect(0, 0, WW, WH);
    g.beginPath();
    const wob = (i) => Math.sin(i * 0.031) * 7 + Math.sin(i * 0.11) * 3;
    g.moveTo(34 + wob(0), 34);
    for (let x = 34; x <= WW - 34; x += 20) g.lineTo(x, 34 + wob(x));
    for (let y = 34; y <= WH - 26; y += 20) g.lineTo(WW - 34 + wob(y), y);
    for (let x = WW - 34; x >= 34; x -= 20) g.lineTo(x, WH - 26 + wob(x + 99));
    for (let y = WH - 26; y >= 34; y -= 20) g.lineTo(34 + wob(y + 55), y);
    g.closePath();
    const grass = g.createLinearGradient(0, 0, WW, WH);
    grass.addColorStop(0, '#3f8f45'); grass.addColorStop(0.5, '#358a40'); grass.addColorStop(1, '#2f7d3a');
    g.fillStyle = grass; g.fill();
    g.save(); g.clip();
    for (let i = 0; i < 260; i++) {
      const x = r() * WW, y = r() * WH, rad = 40 + r() * 140;
      const rg = g.createRadialGradient(x, y, 0, x, y, rad);
      const light = r() < 0.5;
      rg.addColorStop(0, light ? 'rgba(140,210,110,0.18)' : 'rgba(20,70,30,0.2)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = rg; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    g.lineWidth = 1.4; g.lineCap = 'round';
    for (let i = 0; i < 14000; i++) {
      const x = r() * WW, y = r() * WH, h = 3 + r() * 5;
      g.strokeStyle = r() < 0.5 ? 'rgba(120,200,100,0.45)' : 'rgba(25,80,35,0.45)';
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 3, y - h); g.stroke();
    }
    const FL = ['#ffffff', '#ffd23d', '#ff79c6', '#a970ff', '#ff7a3d'];
    for (let i = 0; i < 700; i++) {
      const x = r() * WW, y = r() * WH;
      g.fillStyle = FL[Math.floor(r() * FL.length)];
      g.beginPath(); g.arc(x, y, 2 + r() * 1.5, 0, 7); g.fill();
      g.fillStyle = '#ffe9a0'; g.beginPath(); g.arc(x, y, 0.9, 0, 7); g.fill();
    }
    g.restore();
    // districts
    for (const k in D.DISTRICTS) paintDistrict(g, k, D.DISTRICTS[k], r);
    // roads: sidewalk, curb shadow, asphalt, center line
    const stroke = (w, col, dash) => {
      g.strokeStyle = col; g.lineWidth = w; g.lineCap = 'round'; g.setLineDash(dash || []);
      ROADS.forEach(([a, b, c2, d]) => { g.beginPath(); g.moveTo(a, b); g.lineTo(c2, d); g.stroke(); });
      g.setLineDash([]);
    };
    stroke(70, 'rgba(0,0,0,0.18)');
    stroke(64, '#a9a6b6');
    stroke(60, '#bdbacb', [12, 3]);
    stroke(48, '#3c3e4c');
    for (let i = 0; i < 3000; i++) { // asphalt grain
      const [a, b, c2, d] = ROADS[Math.floor(r() * ROADS.length)];
      const t = r(), L = Math.hypot(c2 - a, d - b), off = (r() - 0.5) * 44;
      g.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.12)';
      g.fillRect(a + (c2 - a) * t - (d - b) / L * off, b + (d - b) * t + (c2 - a) / L * off, 2, 2);
    }
    stroke(3, 'rgba(255,226,120,0.75)', [18, 16]);
    // plaza: cobblestone rings
    g.save();
    g.beginPath(); g.arc(PLAZA.x, PLAZA.y, PLAZA.r + 12, 0, 7); g.fillStyle = '#4a4560'; g.fill();
    g.beginPath(); g.arc(PLAZA.x, PLAZA.y, PLAZA.r, 0, 7); g.fillStyle = '#5c566f'; g.fill();
    for (let rad = 26; rad < PLAZA.r - 6; rad += 17) {
      const n = Math.floor((Math.PI * 2 * rad) / 21);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + rad;
        const x = PLAZA.x + Math.cos(a) * rad, y = PLAZA.y + Math.sin(a) * rad;
        const v = 0.85 + r() * 0.3;
        g.save(); g.translate(x, y); g.rotate(a + Math.PI / 2);
        g.fillStyle = shade('#8f88a8', v);
        g.beginPath(); g.roundRect(-9, -7, 18, 14, 4); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(-7, -6, 14, 3);
        g.restore();
      }
    }
    // decorative pattern: a compass star
    g.globalAlpha = 0.25; g.fillStyle = '#ffd23d';
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      g.beginPath(); g.moveTo(PLAZA.x + Math.cos(a) * 95, PLAZA.y + Math.sin(a) * 95);
      g.lineTo(PLAZA.x + Math.cos(a + 0.18) * 230, PLAZA.y + Math.sin(a + 0.18) * 230);
      g.lineTo(PLAZA.x + Math.cos(a + 0.36) * 95, PLAZA.y + Math.sin(a + 0.36) * 95); g.fill();
    }
    g.globalAlpha = 1;
    g.restore();
    // flower beds around the plaza edge (between the roads)
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2 + 0.2;
      const x = PLAZA.x + Math.cos(a) * (PLAZA.r + 34), y = PLAZA.y + Math.sin(a) * (PLAZA.r + 34);
      if (distToRoad(x, y) < 46 || blocked(x, y, -10)) continue;
      g.fillStyle = '#6b4a2f'; g.beginPath(); g.ellipse(x, y, 30, 15, a, 0, 7); g.fill();
      g.fillStyle = '#3a8a3a'; g.beginPath(); g.ellipse(x, y - 2, 26, 12, a, 0, 7); g.fill();
      for (let k = 0; k < 9; k++) { g.fillStyle = FL[(i + k) % FL.length]; g.beginPath(); g.arc(x + (r() - 0.5) * 40, y + (r() - 0.5) * 16 - 3, 3, 0, 7); g.fill(); }
    }
    // lamp posts (bases)
    LAMPS.forEach((l) => { g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(l.x + 6, l.y + 2, 10, 4, 0, 0, 7); g.fill(); g.fillStyle = '#2a2a38'; g.fillRect(l.x - 3, l.y - 4, 6, 6); });
    // the hidden cave path: trampled grass
    g.fillStyle = 'rgba(90,70,40,0.35)'; g.beginPath(); g.ellipse(120, 1030, 90, 18, -0.1, 0, 7); g.fill();
    return c;
  }

  function paintDistrict(g, k, d, r) {
    g.save();
    // curb shadow + border
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.roundRect(d.x + 6, d.y + 8, d.w, d.h, 42); g.fill();
    g.beginPath(); g.roundRect(d.x, d.y, d.w, d.h, 40);
    g.fillStyle = d.ground; g.fill();
    g.clip();
    const X = d.x, Y = d.y, Wd = d.w, Hd = d.h;
    if (k === 'fart') {
      for (let i = 0; i < 2500; i++) { g.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.12)'; g.fillRect(X + r() * Wd, Y + r() * Hd, 2, 2); }
      g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 3;
      for (let i = 0; i < 9; i++) { g.beginPath(); g.moveTo(X + 60 + i * 34, Y + Hd - 90); g.lineTo(X + 60 + i * 34, Y + Hd - 40); g.stroke(); }
      for (let i = 0; i < 12; i++) for (let j = 0; j < 2; j++) { g.fillStyle = (i + j) % 2 ? '#fff' : '#111'; g.fillRect(X + Wd - 200 + i * 14, Y + 70 + j * 14, 14, 14); }
      g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 5;
      for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(X + 150 + r() * (Wd - 300), Y + 150 + r() * (Hd - 300), 40 + r() * 60, r() * 6, r() * 6 + 1.6); g.stroke(); }
    } else if (k === 'action') {
      for (let x = X; x < X + Wd; x += 44) for (let y = Y; y < Y + Hd; y += 44) { g.fillStyle = shade('#4a3442', 0.9 + r() * 0.25); g.fillRect(x + 1, y + 1, 42, 42); }
      for (let i = 0; i < 5; i++) { const x = X + 80 + r() * (Wd - 160), y = Y + 80 + r() * (Hd - 160); g.fillStyle = '#2a2a30'; g.beginPath(); g.arc(x, y, 13, 0, 7); g.fill(); g.strokeStyle = '#555'; g.lineWidth = 2; g.stroke(); }
    } else if (k === 'sport') {
      for (let x = X; x < X + Wd; x += 40) { g.fillStyle = ((x - X) / 40) % 2 ? '#2f8a45' : '#38994f'; g.fillRect(x, Y, 40, Hd); }
      g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 4;
      g.strokeRect(X + 30, Y + 60, Wd - 60, Hd - 90);
      g.beginPath(); g.arc(X + Wd / 2, Y + 60 + (Hd - 90) / 2, 50, 0, 7); g.stroke();
      g.beginPath(); g.moveTo(X + Wd / 2, Y + 60); g.lineTo(X + Wd / 2, Y + Hd - 30); g.stroke();
    } else if (k === 'skola') {
      for (let i = 0; i < 6000; i++) { g.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.12)' : 'rgba(90,60,20,0.2)'; g.fillRect(X + r() * Wd, Y + r() * Hd, 2, 2); }
      g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 3;
      const hx = X + Wd / 2 - 30, hy = Y + 120;
      [[0, 0], [0, 40], [-20, 80], [20, 80], [0, 120], [-20, 160], [20, 160], [0, 200]].forEach(([ox, oy], i) => { g.strokeRect(hx + ox, hy + oy, 40, 40); g.fillStyle = 'rgba(255,255,255,0.7)'; g.font = '700 16px system-ui'; g.textAlign = 'center'; g.fillText(i + 1, hx + ox + 20, hy + oy + 26); });
      g.strokeStyle = 'rgba(255,121,198,0.6)'; g.lineWidth = 6; g.beginPath(); g.arc(X + 120, Y + Hd - 120, 60, 0, 7); g.stroke();
    } else if (k === 'hjarna') {
      for (let x = X; x < X + Wd; x += 50) for (let y = Y; y < Y + Hd; y += 50) { g.fillStyle = ((x - X) / 50 + (y - Y) / 50) % 2 ? '#2c2f6a' : '#353a80'; g.fillRect(x, y, 50, 50); }
      g.fillStyle = 'rgba(255,255,255,0.06)'; g.font = '900 120px system-ui'; g.textAlign = 'center'; g.fillText('?', X + Wd - 110, Y + Hd - 60);
    } else if (k === 'aventyr') {
      for (let i = 0; i < 70; i++) { const x = X + r() * Wd, y = Y + r() * Hd, rad = 20 + r() * 60; g.fillStyle = r() < 0.5 ? 'rgba(60,120,50,0.35)' : 'rgba(10,40,15,0.4)'; g.beginPath(); g.ellipse(x, y, rad, rad * 0.6, r() * 3, 0, 7); g.fill(); }
      for (let i = 0; i < 400; i++) { g.fillStyle = ['#b8642a', '#d89a3a', '#8a3a1a'][i % 3]; g.beginPath(); g.ellipse(X + r() * Wd, Y + r() * Hd, 3, 1.6, r() * 3, 0, 7); g.fill(); }
    } else if (k === 'neon') {
      g.shadowBlur = 8;
      for (let x = X; x < X + Wd; x += 40) { g.strokeStyle = 'rgba(255,61,255,0.35)'; g.shadowColor = '#ff3dff'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x, Y); g.lineTo(x, Y + Hd); g.stroke(); }
      for (let y = Y; y < Y + Hd; y += 40) { g.strokeStyle = 'rgba(94,231,255,0.35)'; g.shadowColor = '#5ee7ff'; g.beginPath(); g.moveTo(X, y); g.lineTo(X + Wd, y); g.stroke(); }
      g.shadowBlur = 0;
    }
    g.restore();
    // border
    g.save();
    g.beginPath(); g.roundRect(d.x, d.y, d.w, d.h, 40);
    g.strokeStyle = shade(d.color, 1.25); g.lineWidth = 6; g.stroke();
    g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 2; g.beginPath(); g.roundRect(d.x - 3, d.y - 3, d.w + 6, d.h + 6, 42); g.stroke();
    // painted name
    g.font = '900 26px system-ui,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillText(d.name.toUpperCase(), d.x + d.w / 2 + 2, d.y + 34);
    g.fillStyle = 'rgba(255,255,255,0.85)'; g.fillText(d.name.toUpperCase(), d.x + d.w / 2, d.y + 32);
    g.restore();
  }

  // ================================================================== sprites (trees)
  const SPR = {};
  function treeSprite(kind) {
    if (SPR[kind]) return SPR[kind];
    const S = 2, c = document.createElement('canvas');
    c.width = 90 * S; c.height = 120 * S;
    const g = c.getContext('2d');
    g.scale(S, S);
    const cx = 45, by = 110;
    g.fillStyle = 'rgba(0,0,0,0.28)'; g.beginPath(); g.ellipse(cx + 8, by, 26, 8, 0, 0, 7); g.fill();
    if (kind === 'pine') {
      g.fillStyle = '#5a3a22'; g.fillRect(cx - 4, by - 20, 8, 20);
      [[0, 34, '#1f6a3a'], [20, 28, '#24774a'], [38, 21, '#2a8452']].forEach(([o, w, col], i) => {
        const y0 = by - 16 - o;
        const gr = g.createLinearGradient(cx - w, 0, cx + w, 0); gr.addColorStop(0, shade(col, 1.25)); gr.addColorStop(1, shade(col, 0.7));
        g.fillStyle = gr; g.beginPath(); g.moveTo(cx - w, y0); g.lineTo(cx, y0 - 40 + i * 4); g.lineTo(cx + w, y0); g.closePath(); g.fill();
        g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 1; g.stroke();
      });
    } else if (kind === 'bush') {
      [[-14, -10, 15], [12, -10, 15], [0, -20, 17]].forEach(([ox, oy, rad]) => {
        const gr = g.createRadialGradient(cx + ox - 5, by + oy - 6, 2, cx + ox, by + oy, rad); gr.addColorStop(0, '#6cc35a'); gr.addColorStop(1, '#2d7a32');
        g.fillStyle = gr; g.beginPath(); g.arc(cx + ox, by + oy, rad, 0, 7); g.fill();
      });
      ['#ff79c6', '#fff', '#ffd23d'].forEach((col, i) => { g.fillStyle = col; g.beginPath(); g.arc(cx - 12 + i * 12, by - 18 - (i % 2) * 8, 2.5, 0, 7); g.fill(); });
    } else {
      const pal = kind === 'dark' ? ['#2f8a44', '#14502a'] : kind === 'round2' ? ['#9bd45a', '#4a8a2a'] : ['#5fc35a', '#21753a'];
      g.fillStyle = '#6a4428'; g.beginPath(); g.moveTo(cx - 5, by); g.lineTo(cx - 3, by - 38); g.lineTo(cx + 3, by - 38); g.lineTo(cx + 5, by); g.fill();
      [[-16, -48, 20], [16, -48, 20], [0, -66, 25], [0, -44, 22]].forEach(([ox, oy, rad]) => {
        const gr = g.createRadialGradient(cx + ox - rad * 0.4, by + oy - rad * 0.4, 2, cx + ox, by + oy, rad); gr.addColorStop(0, pal[0]); gr.addColorStop(1, pal[1]);
        g.fillStyle = gr; g.beginPath(); g.arc(cx + ox, by + oy, rad, 0, 7); g.fill();
      });
      g.fillStyle = 'rgba(255,255,255,0.12)'; g.beginPath(); g.arc(cx - 8, by - 76, 9, 0, 7); g.fill();
      if (kind === 'round' && Math.random() < 1) { g.fillStyle = '#e8343a'; [[-14, -50], [10, -60], [4, -40]].forEach(([ox, oy]) => { g.beginPath(); g.arc(cx + ox, by + oy, 2.6, 0, 7); g.fill(); }); }
    }
    SPR[kind] = c;
    return c;
  }

  // ================================================================== drawing helpers
  function rr(x, y, w, h, rad) { ctx.beginPath(); ctx.roundRect(x, y, w, h, rad); }
  function emoji(e, x, y, size) {
    ctx.font = size + 'px ' + EMOJI_FONT;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(e, x, y);
  }
  function text(t, x, y, size, color, weight) {
    ctx.font = (weight || 800) + ' ' + size + 'px system-ui,"Segoe UI",sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = color || '#fff';
    ctx.fillText(t, x, y);
  }
  function sign(t, x, y, hot) {
    ctx.font = '800 15px system-ui,sans-serif';
    const w = ctx.measureText(t).width + 22;
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; rr(x - w / 2 + 2, y - 11, w, 26, 8); ctx.fill();
    ctx.fillStyle = hot ? '#5ee7ff' : '#1b1a2e'; rr(x - w / 2, y - 13, w, 26, 8); ctx.fill();
    ctx.strokeStyle = hot ? '#fff' : 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1.5; ctx.stroke();
    text(t, x, y + 1, 15, hot ? '#0b0b16' : '#fff');
  }
  // oblique box: front face (x, top, w, h), extruded up-right by depth
  function box(x, top, w, h, depth, col, opts) {
    opts = opts || {};
    const dx = depth * 0.5, dy = depth * 0.7;
    // right side
    ctx.fillStyle = shade(col, 0.42);
    ctx.beginPath(); ctx.moveTo(x + w, top); ctx.lineTo(x + w + dx, top - dy); ctx.lineTo(x + w + dx, top + h - dy); ctx.lineTo(x + w, top + h); ctx.closePath(); ctx.fill();
    // front
    const gr = ctx.createLinearGradient(0, top, 0, top + h);
    gr.addColorStop(0, shade(col, 0.78)); gr.addColorStop(1, shade(col, 0.55));
    ctx.fillStyle = gr; ctx.fillRect(x, top, w, h);
    // top
    if (!opts.noTop) {
      ctx.fillStyle = opts.roof || shade(col, 1.08);
      ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x + w, top); ctx.lineTo(x + w + dx, top - dy); ctx.lineTo(x + dx, top - dy); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(x, top - 2, w, 3);
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(x, top + h); ctx.lineTo(x, top); if (!opts.noTop) { ctx.lineTo(x + dx, top - dy); ctx.lineTo(x + w + dx, top - dy); } ctx.lineTo(x + w + dx, top + h - dy); ctx.lineTo(x + w, top + h); ctx.closePath(); ctx.stroke();
  }
  function windows(x, top, w, h, cols, rows, night, seed) {
    const ww = (w - 16) / cols, wh = Math.min(16, (h - 12) / rows);
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
      const lit = night > 0.25 && ((i * 7 + j * 13 + seed) % 5) > 1;
      ctx.fillStyle = lit ? '#ffe9a8' : night > 0.25 ? '#1a2440' : '#8fc4e8';
      ctx.fillRect(x + 8 + i * ww + 3, top + 8 + j * (wh + 6), ww - 6, wh);
      if (!lit) { ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(x + 8 + i * ww + 3, top + 8 + j * (wh + 6), (ww - 6) * 0.35, wh); }
    }
  }
  function door(x, y, col, night) {
    ctx.fillStyle = shade(col, 0.3); rr(x - 18, y - 44, 36, 40, [14, 14, 2, 2]); ctx.fill();
    ctx.fillStyle = night > 0.25 ? '#ffd88a' : '#141322'; rr(x - 13, y - 39, 26, 35, [11, 11, 0, 0]); ctx.fill();
    ctx.fillStyle = '#9a96aa'; ctx.fillRect(x - 22, y - 5, 44, 6);
  }
  function castShadow(s) {
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    const x = s.x - s.w / 2, y = s.y - 6;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + s.w, y); ctx.lineTo(x + s.w + s.h * 0.45, y - s.h * 0.25); ctx.lineTo(x + s.h * 0.45 + 10, y - s.h * 0.25); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.ellipse(s.x + 6, s.y - 2, s.w / 2 + 14, 12, 0, 0, 7); ctx.fill();
  }

  // ================================================================== buildings
  function drawStruct(s, night) {
    if (s.kind === 'none') { if (state.near === s) sign('⛲ ' + s.label, s.x, s.y + 6, true); return; }
    const t = state.t;
    const col = s.color;
    const heat = s.type === 'game' ? state.heat[s.id] || 0 : 0;
    const x = s.x - s.w / 2, w = s.w, base = s.y - 8;
    if (s.kind === 'cave') {
      ctx.fillStyle = '#5a5560'; ctx.beginPath(); ctx.ellipse(s.x, s.y - 18, 46, 34, 0, Math.PI, 0); ctx.fill();
      ctx.fillStyle = '#6e6a78'; ctx.beginPath(); ctx.ellipse(s.x - 12, s.y - 30, 22, 16, 0, Math.PI, 0); ctx.fill();
      ctx.fillStyle = '#050505'; ctx.beginPath(); ctx.ellipse(s.x, s.y - 12, 20, 20, 0, Math.PI, 0); ctx.fill(); ctx.fillRect(s.x - 20, s.y - 12, 40, 6);
      return;
    }
    castShadow(s);
    if (heat > 0) {
      const pulse = 0.5 + Math.sin(t * 3) * 0.2;
      const gr = ctx.createRadialGradient(s.x, s.y - s.h / 2, 10, s.x, s.y - s.h / 2, s.w * 0.9);
      gr.addColorStop(0, rgba(col.length === 7 ? col : '#ffffff', 0.15 * heat * pulse)); gr.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gr; ctx.fillRect(s.x - s.w, s.y - s.h * 1.5, s.w * 2, s.h * 1.7);
    }
    const fh = s.h * 0.6, top = base - fh, depth = s.h * 0.42;
    let iconY = top - depth * 0.7 - 22;
    switch (s.kind) {
      case 'mountain': {
        const gr = ctx.createLinearGradient(0, s.y - s.h - 40, 0, s.y);
        gr.addColorStop(0, '#9aa8c0'); gr.addColorStop(1, '#4a5670');
        ctx.fillStyle = '#3e4860'; ctx.beginPath(); ctx.moveTo(x + 40, base); ctx.lineTo(x + w * 0.85, s.y - s.h + 10); ctx.lineTo(x + w + 40, base); ctx.fill();
        ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(x - 20, base); ctx.lineTo(s.x - 10, s.y - s.h - 40); ctx.lineTo(x + w + 10, base); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(s.x - 52, s.y - s.h + 18); ctx.lineTo(s.x - 10, s.y - s.h - 40); ctx.lineTo(s.x + 34, s.y - s.h + 18); ctx.lineTo(s.x + 14, s.y - s.h + 8); ctx.lineTo(s.x - 6, s.y - s.h + 22); ctx.lineTo(s.x - 26, s.y - s.h + 8); ctx.fill();
        ctx.strokeStyle = '#222'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x, base - 20); ctx.lineTo(s.x - 10, s.y - s.h - 30); ctx.stroke();
        const k = (t * 0.1) % 1; ctx.fillStyle = '#ff3d6e'; ctx.fillRect(x + (s.x - 10 - x) * k - 4, base - 20 + (s.y - s.h - 30 - base + 20) * k, 8, 8);
        iconY = s.y - s.h - 60;
        break;
      }
      case 'stadium': {
        const cy = s.y - s.h / 2 - 6;
        ctx.fillStyle = shade(col, 0.35); ctx.beginPath(); ctx.ellipse(s.x, cy + 10, w / 2 + 6, s.h / 2 + 4, 0, 0, 7); ctx.fill();
        for (let i = 0; i < 4; i++) { ctx.fillStyle = shade('#c8ccd8', 0.6 + i * 0.12); ctx.beginPath(); ctx.ellipse(s.x, cy, w / 2 - i * 7, s.h / 2 - i * 6, 0, 0, 7); ctx.fill(); }
        ctx.fillStyle = '#2f9a4a'; ctx.beginPath(); ctx.ellipse(s.x, cy, w / 2 - 34, s.h / 2 - 28, 0, 0, 7); ctx.fill();
        ctx.save(); ctx.beginPath(); ctx.ellipse(s.x, cy, w / 2 - 34, s.h / 2 - 28, 0, 0, 7); ctx.clip();
        for (let i = -6; i < 6; i++) { ctx.fillStyle = i % 2 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'; ctx.fillRect(s.x + i * 18, cy - 60, 18, 120); }
        ctx.restore();
        ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(s.x, cy - s.h / 2 + 28); ctx.lineTo(s.x, cy + s.h / 2 - 28); ctx.stroke();
        ctx.beginPath(); ctx.arc(s.x, cy, 12, 0, 7); ctx.stroke();
        [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => {
          const lx = s.x + a * (w / 2 - 6), ly = cy + b * (s.h / 2 - 8);
          ctx.fillStyle = '#555'; ctx.fillRect(lx - 2, ly - 40, 4, 40);
          ctx.fillStyle = night > 0.25 ? '#fffbe0' : '#ddd'; ctx.fillRect(lx - 8, ly - 48, 16, 8);
        });
        iconY = cy - s.h / 2 - 50;
        break;
      }
      case 'globe': {
        box(x + 16, base - 40, w - 32, 40, 30, '#556', {});
        const gy = base - 95;
        const gr = ctx.createRadialGradient(s.x - 18, gy - 18, 6, s.x, gy, 55);
        gr.addColorStop(0, '#8fd0ff'); gr.addColorStop(1, '#1a5aa0');
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(s.x, gy, 55, 0, 7); ctx.fill();
        ctx.save(); ctx.beginPath(); ctx.arc(s.x, gy, 55, 0, 7); ctx.clip();
        const off = (t * 12) % 220;
        ctx.fillStyle = '#4ac45a';
        [[-40, -20, 22, 14], [10, 10, 26, 18], [60, -25, 18, 12], [-90, 15, 20, 12], [120, 5, 24, 16]].forEach(([ox, oy, a, b]) => { ctx.beginPath(); ctx.ellipse(s.x + ((ox + off + 110) % 220) - 110, gy + oy, a, b, 0.3, 0, 7); ctx.fill(); });
        ctx.restore();
        ctx.strokeStyle = '#ffd23d'; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(s.x, gy, 72, 18, -0.3, 0, 7); ctx.stroke();
        iconY = gy - 80;
        break;
      }
      case 'castle': {
        box(x + 14, top + 10, w - 28, fh - 10, depth * 0.6, '#8a8ca0', { roof: '#a8aabb' });
        for (let i = 0; i < 6; i++) { ctx.fillStyle = '#a8aabb'; ctx.fillRect(x + 16 + i * ((w - 40) / 5), top - 2, 12, 12); }
        [x - 8, x + w - 36].forEach((tx, i) => {
          box(tx, top - 40, 44, fh + 32, 18, '#9a9cb0', { roof: '#b8bacc' });
          ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(tx - 6, top - 46); ctx.lineTo(tx + 26, top - 110); ctx.lineTo(tx + 58, top - 46); ctx.fill();
          ctx.fillStyle = shade(col, 0.6); ctx.beginPath(); ctx.moveTo(tx + 26, top - 110); ctx.lineTo(tx + 58, top - 46); ctx.lineTo(tx + 34, top - 46); ctx.fill();
          ctx.strokeStyle = '#333'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(tx + 26, top - 110); ctx.lineTo(tx + 26, top - 138); ctx.stroke();
          const wv = Math.sin(t * 5 + i) * 4;
          ctx.fillStyle = i ? '#ffd23d' : '#ff3d6e'; ctx.beginPath(); ctx.moveTo(tx + 26, top - 138); ctx.quadraticCurveTo(tx + 38, top - 136 + wv, tx + 50, top - 132); ctx.lineTo(tx + 26, top - 124); ctx.fill();
          ctx.fillStyle = night > 0.25 ? '#ffe9a8' : '#2a2a40'; rr(tx + 16, top - 10, 12, 18, [6, 6, 0, 0]); ctx.fill();
        });
        iconY = top - 60;
        break;
      }
      case 'arena': {
        box(x, top + 10, w, fh - 10, depth, col, { roof: shade(col, 0.6) });
        for (let i = 0; i < 6; i++) { ctx.fillStyle = 'rgba(0,0,0,0.45)'; rr(x + 10 + i * ((w - 20) / 6), top + 22, (w - 20) / 6 - 8, 30, [10, 10, 0, 0]); ctx.fill(); }
        const b = state.boss;
        if (b) {
          const bob = Math.sin(t * 2) * 6;
          if (!b.dead) {
            const gr = ctx.createRadialGradient(s.x, top - 30, 10, s.x, top - 30, 80);
            gr.addColorStop(0, rgba(b.color || '#ff3d6e', 0.45)); gr.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = gr; ctx.fillRect(s.x - 100, top - 140, 200, 200);
            emoji(b.icon, s.x, top - 26 + bob, 78);
          } else emoji('🏳️', s.x, top - 30, 54);
          const by = top - 84;
          ctx.fillStyle = 'rgba(0,0,0,0.7)'; rr(x - 14, by, w + 28, 20, 10); ctx.fill();
          const pct = Math.max(0.02, b.hp / b.max);
          const hg = ctx.createLinearGradient(x, 0, x + w, 0); hg.addColorStop(0, b.dead ? '#3dff8a' : '#ff3d6e'); hg.addColorStop(1, b.dead ? '#5ee7ff' : '#ff7a3d');
          ctx.fillStyle = hg; rr(x - 11, by + 3, (w + 22) * pct, 14, 7); ctx.fill();
          text(b.dead ? 'BESEGRAD!' : W.fmt(b.hp) + ' HP', s.x, by + 10, 11, '#fff', 900);
          text(b.name, s.x, by - 14, 16, '#fff', 900);
        }
        iconY = -1e9;
        break;
      }
      case 'wheel': {
        const cy = base - 80;
        ctx.strokeStyle = '#6a6a80'; ctx.lineWidth = 7;
        ctx.beginPath(); ctx.moveTo(s.x - 40, base); ctx.lineTo(s.x, cy); ctx.lineTo(s.x + 40, base); ctx.stroke();
        const spin = t * 1.2;
        for (let i = 0; i < 10; i++) {
          ctx.fillStyle = ['#ff3d6e', '#ffd23d', '#3dff8a', '#5ee7ff', '#a970ff'][i % 5];
          ctx.beginPath(); ctx.moveTo(s.x, cy); ctx.arc(s.x, cy, 58, spin + (i * Math.PI) / 5, spin + ((i + 1) * Math.PI) / 5); ctx.fill();
        }
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(s.x, cy, 60, 0, 7); ctx.stroke();
        for (let i = 0; i < 10; i++) { const a = spin + (i * Math.PI) / 5; ctx.fillStyle = Math.sin(t * 8 + i) > 0 ? '#fff6a0' : '#a08a40'; ctx.beginPath(); ctx.arc(s.x + Math.cos(a) * 60, cy + Math.sin(a) * 60, 3.5, 0, 7); ctx.fill(); }
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(s.x, cy, 10, 0, 7); ctx.fill();
        ctx.fillStyle = '#ff3d6e'; ctx.beginPath(); ctx.moveTo(s.x - 9, cy - 68); ctx.lineTo(s.x + 9, cy - 68); ctx.lineTo(s.x, cy - 52); ctx.fill();
        iconY = cy - 90;
        break;
      }
      case 'screen': {
        ctx.fillStyle = '#3a3a48'; ctx.fillRect(x + 20, base - 50, 8, 50); ctx.fillRect(x + w - 28, base - 50, 8, 50);
        box(x - 20, base - 140, w + 40, 94, 14, '#22222e', {});
        ctx.fillStyle = '#04121a'; rr(x - 13, base - 133, w + 26, 80, 4); ctx.fill();
        const lines = (W.feedLines || []).slice(0, 3);
        ctx.save(); rr(x - 12, base - 132, w + 24, 78, 4); ctx.clip();
        if (lines.length) lines.forEach((l, i) => { ctx.font = '700 11px system-ui'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = i === 0 ? '#5ee7ff' : '#9fd'; ctx.fillText(l.slice(0, 36), x - 6, base - 116 + i * 24); });
        else text('LIVE', s.x, base - 93, 24, '#5ee7ff', 900);
        ctx.fillStyle = 'rgba(255,255,255,0.04)'; for (let y = base - 132; y < base - 54; y += 3) ctx.fillRect(x - 12, y, w + 24, 1);
        ctx.restore();
        ctx.fillStyle = Math.sin(t * 4) > 0 ? '#ff3d6e' : '#600'; ctx.beginPath(); ctx.arc(x + w + 8, base - 128, 5, 0, 7); ctx.fill();
        iconY = base - 170;
        break;
      }
      case 'monument': {
        const c = state.community;
        ctx.fillStyle = '#7a7890'; ctx.fillRect(x + 6, base - 18, w - 12, 18);
        ctx.fillStyle = '#8f8da8'; ctx.fillRect(x + 14, base - 30, w - 28, 12);
        const gr = ctx.createLinearGradient(s.x - 24, 0, s.x + 24, 0); gr.addColorStop(0, '#d8d6e8'); gr.addColorStop(1, '#8a88a0');
        ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(s.x - 24, base - 30); ctx.lineTo(s.x - 14, base - 150); ctx.lineTo(s.x, base - 172); ctx.lineTo(s.x + 14, base - 150); ctx.lineTo(s.x + 24, base - 30); ctx.fill();
        const pct = c ? Math.min(1, c.value / c.goal) : 0;
        const cy = base - 90;
        ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 9; ctx.beginPath(); ctx.arc(s.x, cy, 30, 0, 7); ctx.stroke();
        ctx.save(); ctx.shadowColor = col; ctx.shadowBlur = 12; ctx.strokeStyle = col; ctx.beginPath(); ctx.arc(s.x, cy, 30, -Math.PI / 2, -Math.PI / 2 + pct * Math.PI * 2); ctx.stroke(); ctx.restore();
        ctx.fillStyle = '#1b1a2e'; ctx.beginPath(); ctx.arc(s.x, cy, 24, 0, 7); ctx.fill();
        text(Math.round(pct * 100) + '%', s.x, cy, 13, '#fff', 900);
        iconY = base - 200;
        break;
      }
      case 'cabinet': {
        const ch = s.h - 6, ctop = base - ch;
        ctx.save(); ctx.shadowColor = col; ctx.shadowBlur = 18 + Math.sin(t * 4 + s.x) * 6;
        box(x, ctop, w, ch, 14, '#1d1b2e', { roof: shade(col, 0.6) });
        ctx.restore();
        ctx.fillStyle = col; ctx.fillRect(x, ctop, 5, ch); ctx.fillRect(x + w - 5, ctop, 5, ch);
        ctx.fillStyle = shade(col, 0.8); rr(x + 6, ctop + 4, w - 12, 16, 3); ctx.fill();
        text(s.label.slice(0, 11), s.x, ctop + 12, 8, '#0b0b16', 900);
        ctx.fillStyle = '#000'; rr(x + 8, ctop + 24, w - 16, ch * 0.36, 4); ctx.fill();
        const scr = ctx.createLinearGradient(0, ctop + 24, 0, ctop + 24 + ch * 0.36);
        scr.addColorStop(0, rgba(col, 0.9)); scr.addColorStop(1, rgba(col, 0.3));
        ctx.globalAlpha = 0.55 + Math.sin(t * 6 + s.x) * 0.25; ctx.fillStyle = scr; rr(x + 11, ctop + 27, w - 22, ch * 0.36 - 6, 3); ctx.fill(); ctx.globalAlpha = 1;
        emoji(s.icon, s.x, ctop + 24 + ch * 0.18, 20);
        ctx.fillStyle = '#2a2840'; ctx.fillRect(x + 4, ctop + ch * 0.62, w - 8, 12);
        ctx.fillStyle = '#ff3d6e'; ctx.beginPath(); ctx.arc(x + 20, ctop + ch * 0.62 + 4, 5, 0, 7); ctx.fill();
        ctx.fillStyle = '#ffd23d'; ctx.beginPath(); ctx.arc(x + w - 24, ctop + ch * 0.62 + 6, 4, 0, 7); ctx.fill();
        ctx.fillStyle = '#5ee7ff'; ctx.beginPath(); ctx.arc(x + w - 14, ctop + ch * 0.62 + 6, 4, 0, 7); ctx.fill();
        iconY = -1e9;
        break;
      }
      case 'terminal': {
        box(x, base - 50, w, 50, 16, '#2a2a3a', {});
        ctx.fillStyle = '#000'; rr(x + 8, base - 44, w - 16, 30, 3); ctx.fill();
        ctx.fillStyle = '#3dff8a'; ctx.font = '700 9px monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillText('> _' + (Math.sin(t * 6) > 0 ? '█' : ''), x + 12, base - 30);
        iconY = base - 84;
        break;
      }
      case 'house': {
        box(x, top + 6, w, fh - 6, depth * 0.6, '#d8c8b0', { noTop: true });
        // pitched roof
        const ry = top + 6, rh = s.h * 0.45;
        ctx.fillStyle = shade(col, 0.65); ctx.beginPath(); ctx.moveTo(x - 10, ry + 4); ctx.lineTo(s.x, ry - rh); ctx.lineTo(x + w + 10, ry + 4); ctx.closePath(); ctx.fill();
        ctx.fillStyle = shade(col, 0.45); ctx.beginPath(); ctx.moveTo(s.x, ry - rh); ctx.lineTo(s.x + depth * 0.32, ry - rh - depth * 0.42); ctx.lineTo(x + w + 10 + depth * 0.32, ry + 4 - depth * 0.42); ctx.lineTo(x + w + 10, ry + 4); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x - 10, ry + 4); ctx.lineTo(s.x, ry - rh); ctx.lineTo(x + w + 10, ry + 4); ctx.stroke();
        ctx.fillStyle = '#8a4a3a'; ctx.fillRect(x + w * 0.22, ry - rh * 0.75, 14, 26);
        windows(x + 4, top + 16, w * 0.32, 26, 1, 1, night, 1);
        windows(x + w * 0.64, top + 16, w * 0.32, 26, 1, 1, night, 2);
        iconY = ry - rh - 26;
        break;
      }
      case 'tower': {
        const th = s.h * 0.88, tt = base - th;
        box(x, tt, w, th, 36, col, { roof: shade(col, 1.15) });
        windows(x, tt + 10, w, th - 60, 3, 6, night, s.x);
        ctx.strokeStyle = '#ccc'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(s.x + 10, tt - 22); ctx.lineTo(s.x + 10, tt - 60); ctx.stroke();
        ctx.fillStyle = Math.sin(t * 3) > 0 ? '#ff3d3d' : '#600'; ctx.beginPath(); ctx.arc(s.x + 10, tt - 62, 4, 0, 7); ctx.fill();
        iconY = tt - 40;
        break;
      }
      default: {
        // generic building (+ hangar / ramp / garage / school / cube / lab / hall styles)
        const roof = s.kind === 'school' ? '#b04a3a' : s.kind === 'lab' ? '#e8f8ff' : undefined;
        const bodyCol = s.kind === 'school' ? '#d8a060' : s.kind === 'cube' ? '#5a3aa0' : s.kind === 'hall' ? shade(col, 0.9) : s.kind === 'hospital' ? '#d8d4c8' : col;
        box(x, top, w, fh, depth, bodyCol, { roof: roof || shade(col, 1.12) });
        if (s.kind === 'hangar') {
          ctx.fillStyle = shade(col, 0.9); ctx.beginPath(); ctx.ellipse(s.x + depth * 0.25, top - depth * 0.35, w / 2 + 4, depth * 0.55, 0, Math.PI, 0); ctx.fill();
          ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 2; for (let i = 1; i < 6; i++) { ctx.beginPath(); ctx.moveTo(x + (w / 6) * i + depth * 0.25 - w * 0.02, top); ctx.lineTo(x + (w / 6) * i + depth * 0.25, top - depth * 0.85); ctx.stroke(); }
          ctx.fillStyle = 'rgba(0,0,0,0.25)'; for (let i = 0; i < 6; i++) ctx.fillRect(x + 12, top + 10 + i * 8, w - 24, 3);
        } else if (s.kind === 'ramp') {
          ctx.fillStyle = '#c86a2a'; ctx.beginPath(); ctx.moveTo(x + w + 8, base); ctx.lineTo(x + w + 80, base); ctx.lineTo(x + w + 8, base - 62); ctx.fill();
          ctx.fillStyle = '#e88a4a'; ctx.beginPath(); ctx.moveTo(x + w + 8, base - 62); ctx.lineTo(x + w + 80, base); ctx.lineTo(x + w + 92, base - 8); ctx.lineTo(x + w + 20, base - 70); ctx.fill();
          for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) { ctx.fillStyle = (i + j) % 2 ? '#fff' : '#111'; ctx.fillRect(x + 6 + i * 8, top - 30 + j * 8, 8, 8); }
          ctx.fillStyle = '#555'; ctx.fillRect(x + 4, top - 30, 2, 30);
        } else if (s.kind === 'garage') {
          ctx.fillStyle = '#c8c8d0'; ctx.fillRect(x + w * 0.5, top + 14, w * 0.42, fh - 22);
          ctx.fillStyle = 'rgba(0,0,0,0.25)'; for (let i = 0; i < 6; i++) ctx.fillRect(x + w * 0.5, top + 20 + i * 9, w * 0.42, 2);
          emoji('🚗', x + w * 0.25, base - 18, 28);
        } else if (s.kind === 'school') {
          windows(x, top + 4, w, fh - 40, 4, 2, night, 3);
          ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(s.x, top - 14, 12, 0, 7); ctx.fill(); ctx.strokeStyle = '#333'; ctx.lineWidth = 1.5; ctx.stroke();
          ctx.beginPath(); ctx.moveTo(s.x, top - 14); ctx.lineTo(s.x, top - 22); ctx.moveTo(s.x, top - 14); ctx.lineTo(s.x + 6, top - 14); ctx.stroke();
          ctx.fillStyle = '#ccc'; ctx.fillRect(x + w - 6, top - 60, 3, 60);
          ctx.fillStyle = '#006aa7'; ctx.fillRect(x + w - 3, top - 60, 26, 16); ctx.fillStyle = '#fecc00'; ctx.fillRect(x + w + 5, top - 60, 5, 16); ctx.fillRect(x + w - 3, top - 55, 26, 5);
        } else if (s.kind === 'cube') {
          ctx.fillStyle = 'rgba(255,255,255,0.15)'; for (let i = 0; i < 3; i++) { ctx.save(); ctx.translate(s.x + Math.sin(t + i) * 30, top - 40 - i * 18); ctx.rotate(t * (i + 1) * 0.6); ctx.fillStyle = ['#a970ff', '#5ee7ff', '#ff79c6'][i]; ctx.fillRect(-8, -8, 16, 16); ctx.restore(); }
        } else if (s.kind === 'lab') {
          windows(x, top + 4, w, fh - 40, 4, 2, night, 7);
          ctx.fillStyle = '#e8f8ff'; ctx.beginPath(); ctx.ellipse(s.x + depth * 0.25, top - depth * 0.35, 34, 20, 0, Math.PI, 0); ctx.fill();
        } else if (s.kind === 'hospital') {
          windows(x, top + 4, w, fh - 40, 5, 3, night, 11);
          // red cross sign on the facade corner (the billboard covers the middle)
          const cx = x + w - 22, cy = top + 10;
          ctx.fillStyle = '#fff'; ctx.fillRect(cx - 14, cy, 28, 28);
          ctx.fillStyle = Math.sin(t * 2) > -0.6 ? '#c8161d' : '#5a0a0e'; ctx.fillRect(cx - 4, cy + 4, 8, 20); ctx.fillRect(cx - 10, cy + 10, 20, 8);
        } else if (s.kind === 'hall') {
          for (let i = 0; i < 4; i++) { ctx.fillStyle = '#efe8d8'; ctx.fillRect(x + 12 + i * ((w - 24) / 3.4), top + 6, 10, fh - 12); }
          ctx.fillStyle = shade(col, 1.2); ctx.beginPath(); ctx.moveTo(x - 6, top + 2); ctx.lineTo(s.x, top - 30); ctx.lineTo(x + w + 6, top + 2); ctx.fill();
        } else {
          windows(x, top + 4, w, fh - 40, 4, 2, night, s.x);
        }
      }
    }
    // billboard with the game's picture
    if (s.type === 'game' && imgs[s.id] && !['stadium', 'mountain', 'globe', 'castle'].includes(s.kind)) {
      const bw = Math.min(w - 36, 130), bh = bw * 0.56;
      const bx = s.x - bw / 2, by = base - 48 - bh - 6;
      ctx.fillStyle = '#111'; rr(bx - 5, by - 5, bw + 10, bh + 10, 4); ctx.fill();
      try { ctx.drawImage(imgs[s.id], bx, by, bw, bh); } catch (e) {}
      ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(bx, by, bw, bh * 0.3);
    } else if (s.type === 'game' && imgs[s.id] && s.kind !== 'stadium') {
      // standing billboard next to the building
      const bw = 96, bh = 54, bx = x + w - 10, by = base - 110;
      ctx.fillStyle = '#444'; ctx.fillRect(bx + bw / 2 - 3, by + bh, 6, 52);
      ctx.fillStyle = '#111'; rr(bx - 4, by - 4, bw + 8, bh + 8, 4); ctx.fill();
      try { ctx.drawImage(imgs[s.id], bx, by, bw, bh); } catch (e) {}
    }
    if (!['cabinet', 'stadium', 'mountain', 'globe', 'wheel', 'screen', 'monument', 'terminal'].includes(s.kind)) door(s.x, base + 6, s.color, night);
    if (s.icon && iconY > -1e8) emoji(s.icon, s.x, iconY + Math.sin(t * 2 + s.x) * 3, 40);
    if (s.type === 'game' && iconY > -1e8 && s.game) {
      // floating category badge for games
      const isNew = s.game.added && (Date.now() - Date.parse(s.game.added)) / 86400000 < 21;
      if (isNew) { ctx.fillStyle = '#ffd23d'; rr(s.x + w / 2 - 30, top - depth * 0.7 - 18, 46, 20, 10); ctx.fill(); text('NY!', s.x + w / 2 - 7, top - depth * 0.7 - 8, 12, '#1a1400', 900); }
    }
    if (s.kind !== 'cabinet' || state.near === s) sign(s.label + (heat >= 3 ? ' 🔥' : ''), s.x, s.y + 8, state.near === s);
    if (s.type === 'game') {
      const lv = W.live || {};
      const now = lv.playing && lv.playing[s.id];
      const top = lv.tops && lv.tops[s.id];
      if (top) { ctx.font = '700 12px system-ui,sans-serif'; const tw = ctx.measureText(top).width + 14; ctx.fillStyle = 'rgba(11,11,22,0.7)'; rr(s.x - tw / 2, s.y + 24, tw, 18, 9); ctx.fill(); text(top, s.x, s.y + 33.5, 12, '#ffd23d', 700); }
      if (now) { const lbl = '🟢 ' + now + ' spelar nu'; ctx.font = '800 12px system-ui,sans-serif'; const tw = ctx.measureText(lbl).width + 14; ctx.fillStyle = 'rgba(20,120,60,0.9)'; rr(s.x - tw / 2, s.y - 22, tw, 18, 9); ctx.fill(); text(lbl, s.x, s.y - 12.5, 12, '#fff', 800); }
    }
    // crowd
    const n = s.type === 'game' ? state.crowd[s.id] || 0 : 0;
    for (let i = 0; i < n; i++) {
      const a = t * 0.5 + i * 1.7 + s.x;
      drawPerson(s.x + Math.cos(a) * (s.w / 2 + 24), s.y + 30 + Math.sin(a) * 12, ['#ffd23d', '#ff7a3d', '#5ee7ff', '#a970ff', '#3dff8a'][i % 5], null, '', 0.9, true, Math.cos(a + 1.6) > 0 ? 1 : -1, t * 6 + i, 0.6);
    }
  }

  function drawTree(tr) {
    const spr = treeSprite(tr.k);
    const sc = tr.s, wv = Math.sin(state.t * 1.3 + tr.ph) * 0.02;
    ctx.save();
    ctx.translate(tr.x, tr.y);
    ctx.transform(1, 0, wv, 1, 0, 0);
    ctx.drawImage(spr, -45 * sc, -110 * sc, 90 * sc, 120 * sc);
    ctx.restore();
  }

  function drawPerson(x, y, color, name, hat, alpha, moving, face, walk, scale) {
    const k = scale || 1;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y); ctx.scale(k, k);
    const sw = moving ? Math.sin(walk) : 0;
    const bob = moving ? Math.abs(Math.cos(walk)) * 2 : 0;
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(3, 0, 13, 5, 0, 0, 7); ctx.fill();
    // legs
    ctx.strokeStyle = '#2a2a48'; ctx.lineWidth = 5.5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-4, -14); ctx.lineTo(-4 + sw * 5, -2); ctx.moveTo(4, -14); ctx.lineTo(4 - sw * 5, -2); ctx.stroke();
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.ellipse(-4 + sw * 5 + face * 1.5, -1, 4, 2.4, 0, 0, 7); ctx.ellipse(4 - sw * 5 + face * 1.5, -1, 4, 2.4, 0, 0, 7); ctx.fill();
    // body
    const by = -32 - bob;
    const gr = ctx.createLinearGradient(-10, by, 10, by + 20);
    gr.addColorStop(0, shade(color, 1.15)); gr.addColorStop(1, shade(color, 0.7));
    ctx.fillStyle = gr; rr(-10, by, 20, 20, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 1.2; ctx.stroke();
    // arms
    ctx.strokeStyle = shade(color, 0.85); ctx.lineWidth = 4.5;
    ctx.beginPath(); ctx.moveTo(-9, by + 5); ctx.lineTo(-12 - sw * 4, by + 16); ctx.moveTo(9, by + 5); ctx.lineTo(12 + sw * 4, by + 16); ctx.stroke();
    // head
    ctx.fillStyle = '#ffd9b0'; ctx.beginPath(); ctx.arc(0, by - 9, 10, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.fillStyle = '#4a2a18'; ctx.beginPath(); ctx.arc(0, by - 11, 10, Math.PI * 1.05, Math.PI * 1.95); ctx.fill();
    ctx.fillStyle = '#1a1a2a'; ctx.beginPath(); ctx.arc(face * 3.5 - 2, by - 8, 1.5, 0, 7); ctx.arc(face * 3.5 + 3, by - 8, 1.5, 0, 7); ctx.fill();
    ctx.strokeStyle = '#a04a3a'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(face * 3 + 0.5, by - 4.5, 2.5, 0.2, Math.PI - 0.2); ctx.stroke();
    if (hat) emoji(hat, 0, by - 22, 18);
    ctx.restore();
    if (name) {
      ctx.globalAlpha = alpha;
      ctx.font = '800 12px system-ui,sans-serif';
      const w = ctx.measureText(name).width + 14, ny = y - (hat ? 72 : 60) * k;
      ctx.fillStyle = 'rgba(11,11,22,0.75)'; rr(x - w / 2, ny - 9, w, 18, 9); ctx.fill();
      text(name, x, ny + 0.5, 12, '#fff');
      ctx.globalAlpha = 1;
    }
  }

  function nightness() {
    const hr = W.hour();
    if (hr >= 22 || hr < 5) return 1;
    if (hr >= 18) return (hr - 18) / 4;
    if (hr < 8) return 1 - (hr - 5) / 3;
    return 0;
  }
  function dusk() { const hr = W.hour(); return hr > 16 && hr < 20 ? Math.sin(((hr - 16) / 4) * Math.PI) : hr > 5.5 && hr < 8.5 ? Math.sin(((hr - 5.5) / 3) * Math.PI) * 0.7 : 0; }

  // ================================================================== frame
  function draw() {
    const night = nightness();
    const t = state.t;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // sea
    const sea = ctx.createLinearGradient(0, 0, 0, vh);
    sea.addColorStop(0, '#1d5f8a'); sea.addColorStop(1, '#134a70');
    ctx.fillStyle = sea; ctx.fillRect(0, 0, vw, vh);
    ctx.setTransform(dpr * zoom, 0, 0, dpr * zoom, -cam.x * dpr * zoom, -cam.y * dpr * zoom);
    const vx0 = cam.x - 150, vy0 = cam.y - 200, vx1 = cam.x + vw / zoom + 150, vy1 = cam.y + vh / zoom + 250;
    // waves
    ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 2;
    for (let k = 1; k <= 3; k++) {
      const off = 14 * k + Math.sin(t * 1.5 + k) * 5;
      ctx.beginPath(); ctx.rect(-off, -off, WW + off * 2, WH + off * 2); ctx.stroke();
    }
    // ground picture
    if (staticC) {
      const S = staticS;
      const sx = Math.max(0, cam.x), sy = Math.max(0, cam.y);
      const sw = Math.min(WW, cam.x + vw / zoom) - sx, sh = Math.min(WH, cam.y + vh / zoom) - sy;
      if (sw > 0 && sh > 0) ctx.drawImage(staticC, sx * S, sy * S, sw * S, sh * S, sx, sy, sw, sh);
    }
    // rainbow roads (community reward)
    if (state.rewards.rainbow) {
      ROADS.forEach(([a, b, c, d], i) => {
        ctx.strokeStyle = 'hsla(' + ((i * 40 + t * 60) % 360) + ',80%,55%,0.45)'; ctx.lineWidth = 46; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(c, d); ctx.stroke();
      });
    }
    // fountain
    const gold = state.rewards['gold-fountain'];
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(PLAZA.x + 6, PLAZA.y + 6, 76, 46, 0, 0, 7); ctx.fill();
    ctx.fillStyle = gold ? '#b8902a' : '#8a86a0'; ctx.beginPath(); ctx.ellipse(PLAZA.x, PLAZA.y, 74, 46, 0, 0, 7); ctx.fill();
    ctx.fillStyle = gold ? '#d8b04a' : '#a8a4bc'; ctx.beginPath(); ctx.ellipse(PLAZA.x, PLAZA.y - 4, 74, 44, 0, 0, 7); ctx.fill();
    const wg = ctx.createRadialGradient(PLAZA.x - 20, PLAZA.y - 14, 4, PLAZA.x, PLAZA.y - 4, 64);
    wg.addColorStop(0, gold ? '#fff2a0' : '#8fe0ff'); wg.addColorStop(1, gold ? '#e0a020' : '#2a8ad0');
    ctx.fillStyle = wg; ctx.beginPath(); ctx.ellipse(PLAZA.x, PLAZA.y - 4, 62, 34, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1.5;
    for (let i = 0; i < 3; i++) { const k = ((t * 0.6 + i / 3) % 1); ctx.globalAlpha = 1 - k; ctx.beginPath(); ctx.ellipse(PLAZA.x, PLAZA.y - 4, 12 + k * 46, 6 + k * 26, 0, 0, 7); ctx.stroke(); }
    ctx.globalAlpha = 1;
    ctx.fillStyle = gold ? '#d8b04a' : '#a8a4bc'; ctx.fillRect(PLAZA.x - 6, PLAZA.y - 36, 12, 32);
    ctx.beginPath(); ctx.ellipse(PLAZA.x, PLAZA.y - 36, 18, 7, 0, 0, 7); ctx.fill();
    // coins, artifacts, bottle
    const got = W.profile.coinDay.got;
    state.coins.forEach((c) => {
      if (got.includes(c.i) || c.x < vx0 || c.x > vx1 || c.y < vy0 || c.y > vy1) return;
      const sx = Math.abs(Math.cos(t * 3 + c.i)), by = Math.sin(t * 3 + c.i) * 3;
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(c.x, c.y + 10, 8, 3, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#b8862a'; ctx.beginPath(); ctx.ellipse(c.x, c.y + by, 10 * sx + 1, 11, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#ffd23d'; ctx.beginPath(); ctx.ellipse(c.x, c.y + by, 8 * sx + 0.5, 9, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#fff6b0'; ctx.beginPath(); ctx.ellipse(c.x - 2 * sx, c.y + by - 3, 2.5 * sx, 3, 0, 0, 7); ctx.fill();
    });
    D.ARTIFACTS.forEach((a) => {
      if (W.profile.artifacts[a.id]) return;
      const gr = ctx.createRadialGradient(a.x, a.y, 2, a.x, a.y, 30);
      gr.addColorStop(0, 'rgba(255,240,150,' + (0.35 + Math.sin(t * 3 + a.x) * 0.15) + ')'); gr.addColorStop(1, 'rgba(255,240,150,0)');
      ctx.fillStyle = gr; ctx.fillRect(a.x - 30, a.y - 30, 60, 60);
      emoji(a.e, a.x, a.y + Math.sin(t * 2) * 3, 22);
    });
    if (!W.has('edge')) emoji('🍾', BOTTLE.x, BOTTLE.y + Math.sin(t * 1.5) * 4, 22);
    // depth-sorted things (only what's on screen)
    const things = [];
    const vis = (x, y, m) => x > vx0 - m && x < vx1 + m && y > vy0 - m && y < vy1 + m;
    structs.forEach((s) => { if (vis(s.x, s.y, s.w + 120)) things.push([s.y, 0, s]); });
    trees.forEach((tr) => { if (vis(tr.x, tr.y, 80)) things.push([tr.y, 1, tr]); });
    LAMPS.forEach((l) => { if (vis(l.x, l.y, 40)) things.push([l.y, 2, l]); });
    state.ghosts.forEach((g) => { if (vis(g.x, g.y, 40)) things.push([g.y, 3, g]); });
    const p = state.p;
    things.push([p.y, 4, p]);
    if (state.rewards.detective) things.push([1130, 5, null]);
    things.sort((a, b) => a[0] - b[0]);
    for (const [, k, o] of things) {
      if (k === 0) drawStruct(o, night);
      else if (k === 1) drawTree(o);
      else if (k === 2) {
        ctx.fillStyle = '#2a2a38'; ctx.fillRect(o.x - 2, o.y - 58, 4, 58);
        ctx.fillRect(o.x - 2, o.y - 58, 14, 3);
        ctx.fillStyle = night > 0.2 ? '#fff2b0' : '#d8d8e0'; ctx.beginPath(); ctx.arc(o.x + 12, o.y - 52, 5, 0, 7); ctx.fill();
      } else if (k === 3) drawPerson(o.x, o.y, o.color, o.name, '', 0.75, true, Math.cos(o.a) > 0 ? 1 : -1, o.walk || 0);
      else if (k === 4) drawPerson(o.x, o.y, W.profile.color, W.profile.name || 'Du', W.profile.hat, 1, o.moving, o.face, o.walk);
      else emoji('🕵️', 1100, 1110, 54);
    }
    // particles
    particles.forEach((q) => {
      const a = Math.max(0, q.life / q.max);
      if (q.smoke) { ctx.fillStyle = 'rgba(220,220,235,' + a * 0.35 + ')'; ctx.beginPath(); ctx.arc(q.x, q.y, q.sz + (1 - a) * 12, 0, 7); ctx.fill(); }
      else { ctx.globalAlpha = a; ctx.fillStyle = q.c; ctx.fillRect(q.x - q.sz / 2, q.y - q.sz / 2, q.sz, q.sz); ctx.globalAlpha = 1; }
    });
    if (p.tx !== null) { ctx.strokeStyle = '#5ee7ff'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.ellipse(p.tx, p.ty, 14 + Math.sin(t * 8) * 3, 7 + Math.sin(t * 8) * 1.5, 0, 0, 7); ctx.stroke(); }
    sparks.forEach((s) => { ctx.globalAlpha = Math.max(0, s.a); text(s.text, s.x, s.y - 20, 15, '#ffd23d', 900); ctx.globalAlpha = 1; });
    puff.forEach((s) => { ctx.strokeStyle = 'rgba(94,231,255,' + s.a + ')'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(s.x, s.y - 20, 60 * (1 - s.a) + 10, 0, 7); ctx.stroke(); });
    if (state.rewards.ufo) {
      const ux = PLAZA.x + Math.sin(t * 0.8) * 160, uy = PLAZA.y - 260 + Math.cos(t) * 20;
      const beam = ctx.createLinearGradient(0, uy, 0, uy + 200); beam.addColorStop(0, 'rgba(150,255,180,0.35)'); beam.addColorStop(1, 'rgba(150,255,180,0)');
      ctx.fillStyle = beam; ctx.beginPath(); ctx.moveTo(ux - 16, uy + 10); ctx.lineTo(ux + 16, uy + 10); ctx.lineTo(ux + 60, uy + 200); ctx.lineTo(ux - 60, uy + 200); ctx.fill();
      emoji('🛸', ux, uy, 60);
    }
    if (state.rewards.fireworks && night > 0.1) {
      for (let i = 0; i < 4; i++) {
        const ph = (t * 0.45 + i / 4) % 1, fx = PLAZA.x + (i - 1.5) * 220, fy = PLAZA.y - 320 - (i % 2) * 60;
        for (let k = 0; k < 16; k++) {
          const a = (k / 16) * Math.PI * 2;
          ctx.fillStyle = 'hsla(' + (i * 90 + k * 8) + ',100%,62%,' + (1 - ph) + ')';
          ctx.beginPath(); ctx.arc(fx + Math.cos(a) * ph * 100, fy + Math.sin(a) * ph * 100 + ph * ph * 50, 3.5, 0, 7); ctx.fill();
        }
      }
    }
    // cloud shadows (day)
    if (night < 0.8) {
      clouds.forEach((c) => {
        if (!vis(c.x, c.y, 300)) return;
        const gr = ctx.createRadialGradient(c.x, c.y, 20, c.x, c.y, 220 * c.s);
        gr.addColorStop(0, 'rgba(0,0,30,' + 0.12 * (1 - night) + ')'); gr.addColorStop(1, 'rgba(0,0,30,0)');
        ctx.fillStyle = gr; ctx.beginPath(); ctx.ellipse(c.x, c.y, 260 * c.s, 150 * c.s, 0, 0, 7); ctx.fill();
      });
    }
    if (birds && night < 0.5) {
      ctx.strokeStyle = '#1a1a2a'; ctx.lineWidth = 2;
      for (let i = 0; i < birds.n; i++) {
        const bx = birds.x - Math.abs(i - birds.n / 2) * 22, by = birds.y + i * 14, f = Math.sin(t * 10 + i) * 5;
        ctx.beginPath(); ctx.moveTo(bx - 9, by - f); ctx.quadraticCurveTo(bx - 4, by - 4, bx, by); ctx.quadraticCurveTo(bx + 4, by - 4, bx + 9, by - f); ctx.stroke();
      }
    }
    // ---- light & atmosphere (screen space)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const dk = dusk();
    if (dk > 0) { ctx.fillStyle = 'rgba(255,130,60,' + 0.13 * dk + ')'; ctx.fillRect(0, 0, vw, vh); }
    if (night > 0.02) drawLights(night, vis);
    // vignette
    const vg = ctx.createRadialGradient(vw / 2, vh / 2, Math.min(vw, vh) * 0.45, vw / 2, vh / 2, Math.max(vw, vh) * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,20,0.35)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, vw, vh);
    drawMinimap();
  }

  function drawLights(night, vis) {
    const lights = [];
    const p = state.p;
    lights.push([p.x, p.y - 20, 170, '#ffe9b0', 1]);
    LAMPS.forEach((l) => { if (vis(l.x, l.y, 150)) lights.push([l.x + 12, l.y - 40, 130, '#ffd98a', 1]); });
    structs.forEach((s) => {
      if (!vis(s.x, s.y, 200) || s.kind === 'none' || s.hidden) return;
      const big = s.kind === 'cabinet' ? 90 : Math.max(s.w, s.h) * 0.9;
      lights.push([s.x, s.y - s.h * 0.4, big, s.kind === 'cabinet' ? s.color : '#ffe2a0', s.kind === 'cabinet' ? 0.9 : 0.75]);
    });
    lights.push([PLAZA.x, PLAZA.y, 140, '#8fe0ff', 0.8]);
    lctx.setTransform(1, 0, 0, 1, 0, 0);
    lctx.globalCompositeOperation = 'source-over';
    lctx.clearRect(0, 0, lightC.width, lightC.height);
    lctx.fillStyle = 'rgba(6,8,36,' + 0.66 * night + ')';
    lctx.fillRect(0, 0, lightC.width, lightC.height);
    lctx.globalCompositeOperation = 'destination-out';
    const k = lightC.width / vw;
    lights.forEach(([x, y, rad, , inten]) => {
      const sx = (x - cam.x) * zoom * k, sy = (y - cam.y) * zoom * k, sr = rad * zoom * k;
      const g = lctx.createRadialGradient(sx, sy, 0, sx, sy, sr);
      g.addColorStop(0, 'rgba(0,0,0,' + inten + ')'); g.addColorStop(1, 'rgba(0,0,0,0)');
      lctx.fillStyle = g; lctx.fillRect(sx - sr, sy - sr, sr * 2, sr * 2);
    });
    ctx.drawImage(lightC, 0, 0, vw, vh);
    // warm glow
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    lights.forEach(([x, y, rad, col]) => {
      const sx = (x - cam.x) * zoom, sy = (y - cam.y) * zoom, sr = rad * zoom * 0.6;
      if (sx < -sr || sy < -sr || sx > vw + sr || sy > vh + sr) return;
      const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr);
      g.addColorStop(0, rgba(col.length === 7 ? col : '#ffe2a0', 0.16 * night)); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(sx - sr, sy - sr, sr * 2, sr * 2);
    });
    // fireflies
    fireflies.forEach((f, i) => {
      const x = f.x + Math.sin(state.t * 0.7 + f.ph) * 30, y = f.y + Math.cos(state.t * 0.5 + f.ph * 2) * 20;
      const sx = (x - cam.x) * zoom, sy = (y - cam.y) * zoom;
      if (sx < 0 || sy < 0 || sx > vw || sy > vh) return;
      const a = (0.5 + Math.sin(state.t * 3 + i) * 0.5) * night;
      ctx.fillStyle = 'rgba(220,255,120,' + a + ')'; ctx.beginPath(); ctx.arc(sx, sy, 2.2, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(220,255,120,' + a * 0.25 + ')'; ctx.beginPath(); ctx.arc(sx, sy, 7, 0, 7); ctx.fill();
    });
    ctx.restore();
  }

  function drawMinimap() {
    const mw = Math.min(180, vw * 0.3), mh = mw * WH / WW;
    const mx = vw - mw - 12, my = vh - mh - 64;
    if (vw < 520) { minimapRect = null; return; }
    ctx.fillStyle = 'rgba(11,11,22,0.8)'; rr(mx - 5, my - 5, mw + 10, mh + 10, 10); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = 1; ctx.stroke();
    if (staticC) ctx.drawImage(staticC, 0, 0, staticC.width, staticC.height, mx, my, mw, mh);
    const k = mw / WW;
    structs.forEach((s) => { if (!s.hidden && s.kind !== 'none') { ctx.fillStyle = s.color; ctx.fillRect(mx + s.x * k - 2, my + s.y * k - 3, 4, 4); } });
    // view rectangle
    ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.strokeRect(mx + cam.x * k, my + cam.y * k, (vw / zoom) * k, (vh / zoom) * k);
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(mx + state.p.x * k, my + state.p.y * k, 4, 0, 7); ctx.fill();
    ctx.strokeStyle = '#5ee7ff'; ctx.lineWidth = 2; ctx.stroke();
    minimapRect = [mx, my, mw, mh, k];
  }
  let minimapRect = null;
  document.addEventListener('pointerdown', (e) => {
    if (!minimapRect || !canvas || e.target !== canvas) return;
    const [mx, my, mw, mh, k] = minimapRect;
    const b = canvas.getBoundingClientRect();
    const x = e.clientX - b.left, y = e.clientY - b.top;
    if (x > mx && x < mx + mw && y > my && y < my + mh) {
      e.stopImmediatePropagation();
      walkTo((x - mx) / k, (y - my) / k, null);
    }
  }, true);

  W.world = {
    init, teleport, walkTo, structs, byId, state, enter,
    setHeat(heat, crowd) { state.heat = heat; state.crowd = crowd; },
    setGhosts(list) {
      const old = {};
      state.ghosts.forEach((g) => (old[g.name + g.target] = g));
      state.ghosts = list.slice(0, 14).map((g, i) => {
        const s = byId[g.target] || byId.mystery;
        return old[g.name + g.target] || { name: g.name, target: g.target, hx: s.x, hy: s.y + 50, x: s.x + ((i % 3) - 1) * 40, y: s.y + 60, a: i, seed: i * 3.1, walk: 0, color: ['#ffd23d', '#ff7a3d', '#a970ff', '#3dff8a'][i % 4] };
      });
    },
    setBoss(b) { state.boss = b; },
    setCommunity(c) { state.community = c; },
    setRewards(r) { state.rewards = r; },
    setNeonLocked() {},
  };
})();
