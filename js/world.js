// The living world: a map you walk around in. Every game is a building, the plaza holds the special places.
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
  F('duel', 'Duellhallen', '⚔️', 1450, 760, 160, 130, '#ff7a3d');
  F('profile', 'DNA-labbet', '🧬', 950, 760, 160, 130, '#5ee7ff');
  F('home', 'Mitt rum', '🏠', 1200, 1560, 180, 150, '#ffb03d', 'house');
  F('neighbors', 'Granngatan', '🏘️', 1440, 1580, 150, 120, '#e8ecff', 'house');
  F('fame', 'Hall of Fame', '🏆', 960, 1580, 160, 130, '#ffd23d');
  // Neonzonen (locked until you've played 3 different games)
  W.mini.PUBLIC.forEach((m, i) => F('mini:' + m, W.mini.GAMES[m].name, W.mini.GAMES[m].icon, 1060 + i * 95, 300, 70, 100, ['#ff3d6e', '#3dff8a', '#5ee7ff', '#ffd23d'][i], 'cabinet'));
  F('terminal', 'Terminalen', '💻', 1300, 410, 80, 70, '#3dff8a', 'cabinet');
  F('wish', 'Önskebrunnen', '⛲', 1200, 1010, 120, 60, '#3d9bff', 'none');
  F('cave', '???', '🕳️', 70, 1000, 70, 60, '#333', 'cave');
  structs.forEach((s) => { s.rect = [s.x - s.w / 2, s.y - s.h, s.w, s.h - 14]; });
  const SOLID = structs.filter((s) => s.kind !== 'none');
  const byId = {};
  structs.forEach((s) => (byId[s.id] = s));

  // the cave and the bottle are secret – no sign
  byId.cave.hidden = true;
  const BOTTLE = { x: 2355, y: 1845 };

  // ------------------------------------------------------------------ scenery (same for everyone)
  const ROADS = [];
  D.GAMES.forEach((g) => ROADS.push([PLAZA.x, PLAZA.y, g.x, g.y + 30]));
  ROADS.push([PLAZA.x, PLAZA.y, 1200, 470], [PLAZA.x, PLAZA.y, 1200, 1580], [1200, 1580, 1440, 1600], [1200, 1580, 960, 1600]);
  function onRoad(x, y) {
    for (const [a, b, c, d] of ROADS) {
      const L = Math.hypot(c - a, d - b);
      const t = Math.max(0, Math.min(1, ((x - a) * (c - a) + (y - b) * (d - b)) / (L * L)));
      if (Math.hypot(x - (a + t * (c - a)), y - (b + t * (d - b))) < 40) return true;
    }
    return false;
  }

  const r = W.rng(1234);
  const trees = [];
  function blocked(x, y, pad) {
    if (Math.hypot(x - PLAZA.x, y - PLAZA.y) < PLAZA.r + 30) return true;
    for (const s of structs) {
      const [rx, ry, rw, rh] = s.rect;
      if (x > rx - pad && x < rx + rw + pad && y > ry - pad && y < ry + rh + pad + 40) return true;
    }
    return false;
  }
  for (let i = 0; i < 900 && trees.length < 230; i++) {
    const x = r() * WW, y = r() * WH;
    const inForest = x < 700 && y > 720 && y < 1180;
    const edge = x < 90 || x > WW - 90 || y < 80 || y > WH - 60;
    if (!inForest && !edge && r() > 0.12) continue;
    if (onRoad(x, y) || blocked(x, y, 30)) continue;
    if (x > 980 && x < 1420 && y < 480) continue; // neon zone
    trees.push({ x, y, s: 0.8 + r() * 0.6, c: inForest ? '#1f6a35' : '#2a7a40' });
  }
  // thicket hiding the cave
  for (let i = 0; i < 24; i++) trees.push({ x: 30 + r() * 150, y: 900 + r() * 220, s: 1 + r() * 0.5, c: '#17552a' });

  // ------------------------------------------------------------------ live state
  const state = {
    p: { x: PLAZA.x, y: PLAZA.y + 160, tx: null, ty: null, face: 1, moving: false, after: null },
    heat: {}, crowd: {}, ghosts: [], boss: null, rewards: {}, coins: [], neonLocked: true,
    district: null, near: null, t: 0,
  };
  const imgs = {};
  D.GAMES.forEach((g) => {
    const im = new Image();
    im.onload = () => (imgs[g.id] = im);
    im.src = g.img;
  });

  function dailyCoins() {
    const rr = W.daily('coins');
    const list = [];
    for (let i = 0; list.length < 25 && i < 500; i++) {
      const x = 120 + rr() * (WW - 240), y = 120 + rr() * (WH - 240);
      if (blocked(x, y, 20) && Math.hypot(x - PLAZA.x, y - PLAZA.y) > PLAZA.r) continue;
      if (x > 980 && x < 1420 && y < 480) continue;
      list.push({ i: list.length, x, y });
    }
    return list;
  }

  // ------------------------------------------------------------------ canvas & camera
  let canvas, ctx, dpr = 1, vw = 0, vh = 0, zoom = 1, cam = { x: 0, y: 0 };
  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    vw = canvas.clientWidth; vh = canvas.clientHeight;
    canvas.width = vw * dpr; canvas.height = vh * dpr;
    zoom = Math.max(0.5, Math.min(0.92, Math.min(vw, vh) / 880));
  }
  const toWorld = (sx, sy) => [sx / zoom + cam.x, sy / zoom + cam.y];

  const keys = {};
  function init(c) {
    canvas = c;
    ctx = canvas.getContext('2d');
    resize();
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
      const hit = structs.slice().reverse().find((s) => !s.hidden && x > s.rect[0] && x < s.rect[0] + s.rect[2] && y > s.rect[1] - 40 && y < s.y + 10);
      if (hit) {
        if (hit.id === 'boss') { W.profile.pokes = (W.profile.pokes || 0) + 1; if (W.profile.pokes >= 30) W.award('boss-poke'); }
        walkTo(hit.x, hit.y + 22, hit);
      } else walkTo(x, y, null);
    });
    state.coins = dailyCoins();
    let last = performance.now();
    function loop(now) {
      const dt = Math.min(0.05, (now - last) / 1000);
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
    if (state.neonLocked) list.push([980, 440, 440, 24]);
    list.push([PLAZA.x - 50, PLAZA.y - 40, 100, 60]); // fountain
    return list;
  }
  function collide(x, y) {
    for (const [rx, ry, rw, rh] of solids()) if (x > rx - 12 && x < rx + rw + 12 && y > ry - 6 && y < ry + rh + 6) return true;
    return x < 12 || y < 12 || x > WW - 12 || y > WH - 12;
  }

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
      if (!moved && p.tx !== null) {
        // stuck on the way to something: hop to the door
        if (p.after) { const s = p.after; p.after = null; p.tx = null; teleport(s.id); enter(s); } else p.tx = null;
      }
      if (dx) p.face = dx > 0 ? 1 : -1;
    }
    // nearest door
    let near = null, nd = 70;
    structs.forEach((s) => {
      const d = Math.hypot(p.x - s.x, p.y - (s.y + 18));
      if (d < nd && (!s.hidden || d < 45)) { nd = d; near = s; }
    });
    if (near !== state.near) { state.near = near; W.emit('near', near); }
    // coins
    const cd = W.profile.coinDay;
    if (cd.date !== W.today()) { W.profile.coinDay = { date: W.today(), got: [] }; W.save(); state.coins = dailyCoins(); }
    state.coins.forEach((c) => {
      if (!W.profile.coinDay.got.includes(c.i) && Math.hypot(c.x - p.x, c.y - p.y) < 30) {
        W.profile.coinDay.got.push(c.i);
        W.addCoins(1, true);
        W.emit('coin');
        sparkle(c.x, c.y, '+1 🪙');
        if (W.profile.coinDay.got.length === state.coins.length) { W.toast('Du hittade alla dagens mynt! +10 🪙 bonus', 'big'); W.addCoins(10, true); }
      }
    });
    D.ARTIFACTS.forEach((a) => {
      if (!W.profile.artifacts[a.id] && Math.hypot(a.x - p.x, a.y - p.y) < 32) {
        W.profile.artifacts[a.id] = 1;
        W.addXp(40);
        const n = Object.keys(W.profile.artifacts).length;
        W.toast(a.e + ' Artefakt hittad! (' + n + '/8)', 'big');
        if (n >= 8) W.award('artifacts');
      }
    });
    if (Math.hypot(BOTTLE.x - p.x, BOTTLE.y - p.y) < 40 && !W.has('edge')) {
      W.award('edge');
      W.modal('🍾 Flaskpost!', W.h('div', null, W.h('p', null, 'Någon har kastat en flaska i havet. På lappen står det:'),
        W.h('blockquote', { class: 'note' }, '”Den som skriver EOJ2026 i terminalen i Neonzonen får se något. Men koden finns egentligen gömd i sidans källkod… – E & J”')));
    }
    // ghosts wander
    state.ghosts.forEach((g) => {
      g.a += (Math.sin(state.t * 0.7 + g.seed) * 0.8) * dt;
      g.x += Math.cos(g.a) * 30 * dt; g.y += Math.sin(g.a) * 30 * dt;
      if (Math.hypot(g.x - g.hx, g.y - g.hy) > 90) g.a = Math.atan2(g.hy - g.y, g.hx - g.x);
    });
    sparks.forEach((s) => { s.a -= dt; s.y -= 30 * dt; });
    while (sparks.length && sparks[0].a <= 0) sparks.shift();
    puff.forEach((s) => (s.a -= dt * 1.5));
    while (puff.length && puff[0].a <= 0) puff.shift();
    // camera
    const tx = p.x - vw / zoom / 2, ty = p.y - vh / zoom / 2;
    cam.x += (tx - cam.x) * Math.min(1, dt * 6);
    cam.y += (ty - cam.y) * Math.min(1, dt * 6);
    cam.x = Math.max(-40, Math.min(WW - vw / zoom + 40, cam.x));
    cam.y = Math.max(-40, Math.min(WH - vh / zoom + 40, cam.y));
    if (WW < vw / zoom) cam.x = (WW - vw / zoom) / 2;
    if (WH < vh / zoom) cam.y = (WH - vh / zoom) / 2;
  }
  const sparks = [];
  function sparkle(x, y, text) { sparks.push({ x, y, a: 1, text }); }

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
          const all = Object.keys(D.DISTRICTS).filter((k) => k !== 'neon');
          if (all.every((k) => W.profile.visited[k])) W.award('explorer');
        }
      }
    }
    // secret cave: you have to squeeze through the thicket
    if (Math.hypot(p.x - 70, p.y - 1020) < 40 && !state.caveShown) { state.caveShown = true; W.toast('🕳️ Du hittade en dold grotta!'); }
  }

  function enter(s) {
    if (W.modalOpen()) return;
    W.emit('enter', s);
  }

  // ------------------------------------------------------------------ drawing
  function rr(x, y, w, h, rad) { ctx.beginPath(); ctx.roundRect(x, y, w, h, rad); }
  function shade(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.max(0, Math.min(255, Math.round(v * f))));
    return 'rgb(' + c.join(',') + ')';
  }
  function emoji(e, x, y, size) {
    ctx.font = size + 'px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(e, x, y);
  }
  function text(t, x, y, size, color, weight) {
    ctx.font = (weight || 800) + ' ' + size + 'px system-ui,"Segoe UI",sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = color || '#fff';
    ctx.fillText(t, x, y);
  }
  function sign(t, x, y, bg, fg) {
    ctx.font = '800 15px system-ui,sans-serif';
    const w = ctx.measureText(t).width + 18;
    ctx.fillStyle = bg || '#0b0b16dd';
    rr(x - w / 2, y - 12, w, 24, 12); ctx.fill();
    text(t, x, y + 1, 15, fg || '#fff');
  }

  function drawGround() {
    const night = nightness();
    ctx.fillStyle = '#1a3a26';
    ctx.fillRect(-200, -200, WW + 400, WH + 400);
    // water around the world
    ctx.fillStyle = '#123a5a';
    ctx.fillRect(-400, -400, WW + 800, 400); ctx.fillRect(-400, WH, WW + 800, 400);
    ctx.fillRect(-400, 0, 400, WH); ctx.fillRect(WW, 0, 400, WH);
    // districts
    for (const k in D.DISTRICTS) {
      const d = D.DISTRICTS[k];
      ctx.fillStyle = d.ground;
      rr(d.x, d.y, d.w, d.h, 40); ctx.fill();
      ctx.strokeStyle = d.color; ctx.lineWidth = 4; ctx.stroke();
      text(d.icon + ' ' + d.name.toUpperCase(), d.x + d.w / 2, d.y + 28, 22, '#ffffff99', 900);
    }
    // roads
    const rainbow = state.rewards.rainbow;
    ROADS.forEach(([a, b, c, d], i) => {
      ctx.strokeStyle = rainbow ? 'hsl(' + ((i * 40 + state.t * 40) % 360) + ',70%,45%)' : '#3a3a4a';
      ctx.lineWidth = 46; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(c, d); ctx.stroke();
    });
    ROADS.forEach(([a, b, c, d]) => {
      ctx.strokeStyle = '#ffffff22'; ctx.lineWidth = 3; ctx.setLineDash([16, 18]);
      ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(c, d); ctx.stroke(); ctx.setLineDash([]);
    });
    // plaza
    const g = ctx.createRadialGradient(PLAZA.x, PLAZA.y, 40, PLAZA.x, PLAZA.y, PLAZA.r);
    g.addColorStop(0, '#5a5470'); g.addColorStop(1, '#3a3550');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(PLAZA.x, PLAZA.y, PLAZA.r, 0, 7); ctx.fill();
    ctx.strokeStyle = '#ffffff18'; ctx.lineWidth = 2;
    for (let i = 1; i < 5; i++) { ctx.beginPath(); ctx.arc(PLAZA.x, PLAZA.y, PLAZA.r * i / 5, 0, 7); ctx.stroke(); }
    text('TORGET', PLAZA.x, PLAZA.y + 120, 20, '#ffffff55', 900);
    // fountain
    const gold = state.rewards['gold-fountain'];
    ctx.fillStyle = gold ? '#b8902a' : '#6a6a80'; ctx.beginPath(); ctx.ellipse(PLAZA.x, PLAZA.y, 70, 44, 0, 0, 7); ctx.fill();
    ctx.fillStyle = gold ? '#ffd23d' : '#3d9bff'; ctx.beginPath(); ctx.ellipse(PLAZA.x, PLAZA.y, 58, 34, 0, 0, 7); ctx.fill();
    for (let i = 0; i < 8; i++) {
      const a = state.t * 2 + i;
      ctx.fillStyle = '#ffffffaa';
      ctx.beginPath(); ctx.arc(PLAZA.x + Math.cos(a) * 20, PLAZA.y - 16 - Math.abs(Math.sin(a * 1.3)) * 30, 3, 0, 7); ctx.fill();
    }
    // neon gate
    if (state.neonLocked) {
      ctx.fillStyle = '#ff3d6e'; ctx.fillRect(980, 440, 440, 10);
      for (let x = 990; x < 1420; x += 40) { ctx.fillRect(x, 420, 6, 40); }
      sign('🔒 Spela 3 olika spel för att låsa upp', 1200, 480, '#ff3d6edd');
    }
    if (night > 0.2) { // street lamps
      ROADS.forEach(([a, b, c, d]) => {
        for (let t = 0.25; t < 1; t += 0.35) {
          const x = a + (c - a) * t + 30, y = b + (d - b) * t;
          const lg = ctx.createRadialGradient(x, y, 2, x, y, 60);
          lg.addColorStop(0, 'rgba(255,220,140,' + 0.5 * night + ')'); lg.addColorStop(1, 'rgba(255,220,140,0)');
          ctx.fillStyle = lg; ctx.fillRect(x - 60, y - 60, 120, 120);
        }
      });
    }
  }

  function drawStruct(s) {
    if (s.kind === 'none') {
      if (state.near === s) sign('⛲ ' + s.label, s.x, s.y + 4, '#5ee7ffee', '#0b0b16');
      return;
    }
    if (s.hidden) {
      ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(s.x, s.y - 20, 34, 26, 0, Math.PI, 0); ctx.fill();
      ctx.fillRect(s.x - 34, s.y - 20, 68, 14);
      return;
    }
    const [x, y, w, h] = s.rect;
    const t = state.t;
    const heat = s.type === 'game' ? state.heat[s.id] || 0 : 0;
    const col = s.color;
    // shadow
    ctx.fillStyle = '#0005'; ctx.beginPath(); ctx.ellipse(s.x, s.y - 4, s.w / 2 + 10, 16, 0, 0, 7); ctx.fill();
    if (heat > 0) {
      ctx.save(); ctx.shadowColor = col; ctx.shadowBlur = 18 + heat * 14 + Math.sin(t * 3) * 6;
      ctx.fillStyle = col; rr(x, y, w, h, 14); ctx.fill(); ctx.restore();
    }
    const front = s.h * 0.55;
    switch (s.kind) {
      case 'mountain':
        ctx.fillStyle = '#7a8aa0'; ctx.beginPath(); ctx.moveTo(x - 10, s.y - 10); ctx.lineTo(s.x, y - 30); ctx.lineTo(x + w + 10, s.y - 10); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(s.x - 40, y + 20); ctx.lineTo(s.x, y - 30); ctx.lineTo(s.x + 40, y + 20); ctx.fill();
        break;
      case 'stadium':
        ctx.fillStyle = shade(col, 0.45); ctx.beginPath(); ctx.ellipse(s.x, s.y - h / 2 - 10, w / 2, h / 2, 0, 0, 7); ctx.fill();
        ctx.fillStyle = '#2a8a4a'; ctx.beginPath(); ctx.ellipse(s.x, s.y - h / 2 - 10, w / 2 - 22, h / 2 - 20, 0, 0, 7); ctx.fill();
        ctx.strokeStyle = '#fff8'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(s.x, s.y - h + 10); ctx.lineTo(s.x, s.y - 30); ctx.stroke();
        break;
      case 'globe':
        ctx.fillStyle = shade(col, 0.5); ctx.fillRect(x + 20, s.y - front, w - 40, front - 14);
        ctx.fillStyle = col; ctx.beginPath(); ctx.arc(s.x, y + 40, 52, 0, 7); ctx.fill();
        ctx.fillStyle = '#3dff8a'; ctx.beginPath(); ctx.ellipse(s.x - 14 + Math.sin(t) * 6, y + 30, 20, 14, 0.4, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.ellipse(s.x + 20 + Math.sin(t) * 6, y + 56, 12, 9, 0, 0, 7); ctx.fill();
        break;
      case 'arena': {
        ctx.fillStyle = shade(col, 0.4); rr(x, y + 30, w, h - 30, 20); ctx.fill();
        ctx.fillStyle = shade(col, 0.7); rr(x + 10, y + 40, w - 20, 30, 10); ctx.fill();
        const b = state.boss;
        if (b) {
          const bob = Math.sin(t * 2) * 6;
          if (!b.dead) emoji(b.icon, s.x, y + 10 + bob, 84);
          else emoji('🏳️', s.x, y + 20, 50);
          ctx.fillStyle = '#000a'; rr(x - 10, y - 60, w + 20, 18, 9); ctx.fill();
          ctx.fillStyle = b.dead ? '#3dff8a' : '#ff3d6e'; rr(x - 8, y - 58, (w + 16) * Math.max(0.02, b.hp / b.max), 14, 7); ctx.fill();
          text(b.dead ? 'BESEGRAD!' : W.fmt(b.hp) + ' HP', s.x, y - 51, 11, '#fff', 900);
          text(b.name, s.x, y - 76, 15, '#fff', 900);
        }
        break;
      }
      case 'wheel': {
        ctx.fillStyle = shade(col, 0.45); ctx.fillRect(s.x - 8, y + 50, 16, h - 50);
        const spin = t * 1.5;
        for (let i = 0; i < 8; i++) {
          ctx.fillStyle = ['#ff3d6e', '#ffd23d', '#3dff8a', '#5ee7ff'][i % 4];
          ctx.beginPath(); ctx.moveTo(s.x, y + 45); ctx.arc(s.x, y + 45, 55, spin + i * Math.PI / 4, spin + (i + 1) * Math.PI / 4); ctx.fill();
        }
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(s.x, y + 45, 10, 0, 7); ctx.fill();
        break;
      }
      case 'screen': {
        ctx.fillStyle = '#222'; ctx.fillRect(s.x - 6, y + 70, 12, h - 70);
        ctx.fillStyle = '#111'; rr(x - 20, y - 10, w + 40, 90, 8); ctx.fill();
        ctx.fillStyle = '#071a24'; rr(x - 14, y - 4, w + 28, 78, 5); ctx.fill();
        const lines = (W.feedLines || []).slice(0, 3);
        ctx.save(); ctx.beginPath(); ctx.rect(x - 12, y - 2, w + 24, 74); ctx.clip();
        lines.forEach((l, i) => {
          ctx.font = '700 11px system-ui'; ctx.textAlign = 'left'; ctx.fillStyle = i === 0 ? '#5ee7ff' : '#9fd';
          ctx.fillText(l.slice(0, 34), x - 8, y + 14 + i * 22);
        });
        if (!lines.length) text('LIVE', s.x, y + 35, 22, '#5ee7ff');
        ctx.restore();
        ctx.fillStyle = Math.sin(t * 4) > 0 ? '#ff3d6e' : '#800'; ctx.beginPath(); ctx.arc(x + w + 8, y + 4, 5, 0, 7); ctx.fill();
        break;
      }
      case 'monument': {
        const c = state.community;
        ctx.fillStyle = '#8a8aa0'; ctx.fillRect(x + 20, y + 60, w - 40, h - 60);
        ctx.beginPath(); ctx.moveTo(x + 30, y + 60); ctx.lineTo(s.x, y - 10); ctx.lineTo(x + w - 30, y + 60); ctx.fill();
        const pct = c ? Math.min(1, c.value / c.goal) : 0;
        ctx.strokeStyle = '#0006'; ctx.lineWidth = 10; ctx.beginPath(); ctx.arc(s.x, y + 50, 28, 0, 7); ctx.stroke();
        ctx.strokeStyle = col; ctx.beginPath(); ctx.arc(s.x, y + 50, 28, -Math.PI / 2, -Math.PI / 2 + pct * Math.PI * 2); ctx.stroke();
        text(Math.round(pct * 100) + '%', s.x, y + 50, 13, '#fff', 900);
        break;
      }
      case 'cabinet':
        ctx.fillStyle = shade(col, 0.35); rr(x, y, w, h, 8); ctx.fill();
        ctx.fillStyle = '#000'; rr(x + 8, y + 12, w - 16, h * 0.4, 4); ctx.fill();
        ctx.save(); ctx.shadowColor = col; ctx.shadowBlur = 16; ctx.fillStyle = col;
        rr(x + 12, y + 16, w - 24, h * 0.4 - 8, 3); ctx.globalAlpha = 0.5 + Math.sin(t * 5 + s.x) * 0.3; ctx.fill(); ctx.restore();
        break;
      case 'house':
        ctx.fillStyle = shade(col, 0.55); ctx.fillRect(x, s.y - front - 14, w, front);
        ctx.fillStyle = shade(col, 0.9); ctx.beginPath(); ctx.moveTo(x - 14, s.y - front - 10); ctx.lineTo(s.x, y - 10); ctx.lineTo(x + w + 14, s.y - front - 10); ctx.fill();
        ctx.fillStyle = '#ffe9a8'; ctx.fillRect(x + 18, s.y - front + 6, 26, 22); ctx.fillRect(x + w - 44, s.y - front + 6, 26, 22);
        break;
      default: {
        // generic building: roof + front face (+ towers for castles)
        if (s.kind === 'castle') {
          ctx.fillStyle = shade(col, 0.5);
          [x - 6, x + w - 26].forEach((tx) => { ctx.fillRect(tx, y - 30, 32, h + 16); ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(tx - 4, y - 30); ctx.lineTo(tx + 16, y - 66); ctx.lineTo(tx + 36, y - 30); ctx.fill(); ctx.fillStyle = shade(col, 0.5); });
        }
        const tall = s.kind === 'tower' ? 1.0 : 0;
        ctx.fillStyle = shade(col, 0.45); ctx.fillRect(x, y + h * (0.45 - tall * 0.3), w, h * (0.55 + tall * 0.3));
        ctx.fillStyle = shade(col, 0.85); rr(x - 6, y - tall * h * 0.3, w + 12, h * 0.45, 10); ctx.fill();
        if (s.kind === 'tower') {
          ctx.fillStyle = '#ffe9a855';
          for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) ctx.fillRect(x + 14 + j * (w - 28) / 3, y + h * 0.2 + i * 22, 14, 12);
        }
        if (s.kind === 'hangar') { ctx.fillStyle = shade(col, 0.7); ctx.beginPath(); ctx.ellipse(s.x, y + h * 0.3, w / 2 + 6, h * 0.32, 0, Math.PI, 0); ctx.fill(); }
        if (s.kind === 'ramp') { ctx.fillStyle = '#c86a2a'; ctx.beginPath(); ctx.moveTo(x + w + 8, s.y - 14); ctx.lineTo(x + w + 70, s.y - 14); ctx.lineTo(x + w + 8, s.y - 70); ctx.fill(); }
      }
    }
    // billboard with the game's picture
    if (s.type === 'game' && imgs[s.id] && s.kind !== 'stadium' && s.kind !== 'mountain' && s.kind !== 'globe') {
      const bw = Math.min(w - 30, 140), bh = bw * 0.56;
      const bx = s.x - bw / 2, by = s.y - 14 - bh - 34;
      ctx.fillStyle = '#000'; ctx.fillRect(bx - 3, by - 3, bw + 6, bh + 6);
      try { ctx.drawImage(imgs[s.id], bx, by, bw, bh); } catch (e) {}
    }
    // door
    if (s.kind !== 'cabinet') { ctx.fillStyle = '#0b0b16'; rr(s.x - 16, s.y - 48, 32, 36, 6); ctx.fill(); }
    // icon on top
    if (s.icon && s.kind !== 'arena') emoji(s.icon, s.x, y - (s.kind === 'tower' ? 40 : 18) + Math.sin(t * 2 + s.x) * 3, s.kind === 'cabinet' ? 28 : 40);
    // sign
    const isNew = s.game && s.game.added && (Date.now() - Date.parse(s.game.added)) / 86400000 < 21;
    sign((isNew ? '🆕 ' : '') + s.label + (heat >= 3 ? ' 🔥' : ''), s.x, s.y + 4, state.near === s ? '#5ee7ffee' : '#0b0b16dd', state.near === s ? '#0b0b16' : '#fff');
    // crowd
    const n = s.type === 'game' ? state.crowd[s.id] || 0 : 0;
    for (let i = 0; i < n; i++) {
      const a = t * 0.6 + i * 1.7 + s.x;
      const px = s.x + Math.cos(a) * (s.w / 2 + 20), py = s.y + 20 + Math.sin(a) * 14;
      ctx.fillStyle = ['#ffd23d', '#ff7a3d', '#5ee7ff', '#a970ff', '#3dff8a'][i % 5];
      ctx.beginPath(); ctx.arc(px, py - 8, 5, 0, 7); ctx.fill(); ctx.fillRect(px - 4, py - 4, 8, 9);
    }
  }

  function drawTree(t) {
    ctx.fillStyle = '#0004'; ctx.beginPath(); ctx.ellipse(t.x, t.y, 16 * t.s, 6 * t.s, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#5a3a20'; ctx.fillRect(t.x - 3 * t.s, t.y - 18 * t.s, 6 * t.s, 18 * t.s);
    ctx.fillStyle = t.c; ctx.beginPath(); ctx.arc(t.x, t.y - 28 * t.s, 20 * t.s, 0, 7); ctx.fill();
    ctx.fillStyle = '#ffffff10'; ctx.beginPath(); ctx.arc(t.x - 6 * t.s, t.y - 34 * t.s, 9 * t.s, 0, 7); ctx.fill();
  }

  function drawPerson(x, y, color, name, hat, alpha, moving, face) {
    ctx.globalAlpha = alpha;
    const bob = moving ? Math.abs(Math.sin(state.t * 12)) * 3 : 0;
    ctx.fillStyle = '#0005'; ctx.beginPath(); ctx.ellipse(x, y, 12, 5, 0, 0, 7); ctx.fill();
    ctx.fillStyle = color; rr(x - 10, y - 26 - bob, 20, 22, 7); ctx.fill();
    ctx.fillStyle = '#ffdcb0'; ctx.beginPath(); ctx.arc(x, y - 34 - bob, 10, 0, 7); ctx.fill();
    ctx.fillStyle = '#0b0b16'; ctx.fillRect(x + face * 3 - 1, y - 36 - bob, 3, 3);
    if (hat) emoji(hat, x, y - 48 - bob, 18);
    if (name) sign(name, x, y - (hat ? 68 : 56) - bob, '#0b0b16aa');
    ctx.globalAlpha = 1;
  }

  function nightness() {
    const hr = W.hour();
    if (hr >= 22 || hr < 5) return 1;
    if (hr >= 18) return (hr - 18) / 4;
    if (hr < 8) return 1 - (hr - 5) / 3;
    return 0;
  }

  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, vw, vh);
    ctx.setTransform(dpr * zoom, 0, 0, dpr * zoom, -cam.x * dpr * zoom, -cam.y * dpr * zoom);
    drawGround();
    const t = state.t;
    // coins & artifacts
    const got = W.profile.coinDay.got;
    state.coins.forEach((c) => {
      if (got.includes(c.i)) return;
      const sx = Math.abs(Math.cos(t * 3 + c.i));
      ctx.fillStyle = '#b8902a'; ctx.beginPath(); ctx.ellipse(c.x, c.y, 9 * sx + 1, 10, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#ffd23d'; ctx.beginPath(); ctx.ellipse(c.x, c.y, 7 * sx + 0.5, 8, 0, 0, 7); ctx.fill();
    });
    D.ARTIFACTS.forEach((a) => {
      if (W.profile.artifacts[a.id]) return;
      ctx.globalAlpha = 0.55 + Math.sin(t * 2 + a.x) * 0.35;
      emoji(a.e, a.x, a.y + Math.sin(t * 2) * 3, 22);
      ctx.globalAlpha = 1;
    });
    if (!W.has('edge')) emoji('🍾', BOTTLE.x, BOTTLE.y + Math.sin(t * 1.5) * 4, 22);
    // depth-sorted things
    const things = [];
    structs.forEach((s) => things.push([s.y, () => drawStruct(s)]));
    trees.forEach((tr) => things.push([tr.y, () => drawTree(tr)]));
    state.ghosts.forEach((g) => things.push([g.y, () => drawPerson(g.x, g.y, g.color, g.name, '', 0.6, true, Math.cos(g.a) > 0 ? 1 : -1)]));
    const p = state.p;
    things.push([p.y, () => drawPerson(p.x, p.y, W.profile.color, W.profile.name || 'Du', W.profile.hat, 1, p.moving, p.face)]);
    if (state.rewards.detective) things.push([1300, () => emoji('🕵️', 1100, 1120, 50)]);
    things.sort((a, b) => a[0] - b[0]).forEach((x) => x[1]());
    // walk target
    if (p.tx !== null) { ctx.strokeStyle = '#5ee7ff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.tx, p.ty, 10 + Math.sin(t * 8) * 3, 0, 7); ctx.stroke(); }
    sparks.forEach((s) => { ctx.globalAlpha = Math.max(0, s.a); text(s.text, s.x, s.y - 20, 15, '#ffd23d'); ctx.globalAlpha = 1; });
    puff.forEach((s) => { ctx.strokeStyle = 'rgba(94,231,255,' + s.a + ')'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(s.x, s.y - 20, 60 * (1 - s.a) + 10, 0, 7); ctx.stroke(); });
    if (state.rewards.ufo) { emoji('🛸', PLAZA.x + Math.sin(t * 0.8) * 160, PLAZA.y - 260 + Math.cos(t) * 20, 60); }
    if (state.rewards.fireworks) {
      for (let i = 0; i < 3; i++) {
        const ph = (t * 0.5 + i / 3) % 1, fx = PLAZA.x + (i - 1) * 260, fy = PLAZA.y - 300;
        for (let k = 0; k < 12; k++) {
          const a = k / 12 * Math.PI * 2;
          ctx.fillStyle = 'hsla(' + (i * 120 + k * 10) + ',100%,60%,' + (1 - ph) + ')';
          ctx.beginPath(); ctx.arc(fx + Math.cos(a) * ph * 90, fy + Math.sin(a) * ph * 90 + ph * ph * 40, 4, 0, 7); ctx.fill();
        }
      }
    }
    // night tint (screen space)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = nightness();
    if (n > 0) { ctx.fillStyle = 'rgba(10,10,50,' + 0.42 * n + ')'; ctx.fillRect(0, 0, vw, vh); }
    drawMinimap();
  }

  function drawMinimap() {
    const mw = Math.min(180, vw * 0.3), mh = mw * WH / WW;
    const mx = vw - mw - 12, my = vh - mh - 64;
    if (vw < 520) return;
    ctx.fillStyle = '#0b0b16cc'; rr(mx - 4, my - 4, mw + 8, mh + 8, 8); ctx.fill();
    const k = mw / WW;
    for (const id in D.DISTRICTS) { const d = D.DISTRICTS[id]; ctx.fillStyle = d.color; ctx.fillRect(mx + d.x * k, my + d.y * k, d.w * k, d.h * k); }
    ctx.fillStyle = '#5a5470'; ctx.beginPath(); ctx.arc(mx + PLAZA.x * k, my + PLAZA.y * k, PLAZA.r * k, 0, 7); ctx.fill();
    structs.forEach((s) => { if (!s.hidden) { ctx.fillStyle = s.color; ctx.fillRect(mx + s.x * k - 2, my + s.y * k - 3, 4, 4); } });
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(mx + state.p.x * k, my + state.p.y * k, 4, 0, 7); ctx.fill();
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
        return old[g.name + g.target] || { name: g.name, target: g.target, hx: s.x, hy: s.y + 50, x: s.x + (i % 3 - 1) * 40, y: s.y + 60, a: i, seed: i * 3.1, color: ['#ffd23d', '#ff7a3d', '#a970ff', '#3dff8a'][i % 4] };
      });
    },
    setBoss(b) { state.boss = b; },
    setCommunity(c) { state.community = c; },
    setRewards(r) { state.rewards = r; },
    setNeonLocked(v) { state.neonLocked = v; },
  };
})();
