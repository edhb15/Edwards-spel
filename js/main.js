// Boot: HUD, links (?duel=, ?room=, ?roulette=, ?game=), secrets and the 30-second live refresh.
(function () {
  'use strict';
  const { $, h, D } = W;

  W.world.init($('#world'));
  W.world.setNeonLocked(Object.keys(W.profile.plays).length < 3);

  // ---------------------------------------------------------------- HUD
  function hud() {
    const p = W.profile;
    $('#chip-name').textContent = p.name || 'Välj namn';
    $('#chip-lvl').textContent = 'Nv ' + W.level();
    $('#chip-coins').textContent = p.coins;
    $('#chip-avatar').style.background = p.color;
    $('#chip-avatar').textContent = p.hat || W.ui.profileType().i;
  }
  W.on('profile', hud);
  hud();

  const act = {
    surprise: () => W.ui.roulette(),
    mystery: () => W.ui.openMystery(),
    boss: () => W.ui.openBoss(),
    community: () => W.ui.openCommunity(),
    duel: () => W.ui.openDuel(),
    room: () => W.ui.openRoom(),
    fame: () => W.ui.openFame(),
    all: () => W.ui.openAll(),
    profile: () => W.ui.openProfile(),
    feed: () => W.ui.openFeed(),
  };
  document.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', () => act[b.dataset.act]()));

  const prompt = $('#prompt');
  W.on('near', (s) => {
    if (!s) { prompt.hidden = true; return; }
    prompt.hidden = false;
    prompt.innerHTML = '';
    prompt.append(h('kbd', null, 'E'), ' ' + (s.id === 'cave' ? '🕳️ Kryp in i grottan' : s.kind === 'none' ? '⛲ ' + s.label : 'Gå in: ' + s.label));
  });
  prompt.addEventListener('click', () => { if (W.world.state.near) W.world.enter(W.world.state.near); });

  // live ticker + boss/mystery chips
  let tick = 0;
  function ticker() {
    const lines = W.live.lines || [];
    const el = $('#ticker-text');
    if (!lines.length) { el.textContent = W.isOnline() ? 'Välkommen till Edwards och Johns spel! Spela något så syns du här.' : 'Topplistan online svarar inte just nu – allt sparas på den här enheten.'; return; }
    const l = lines[tick++ % Math.min(8, lines.length)];
    el.classList.remove('in'); void el.offsetWidth; el.classList.add('in');
    el.textContent = l.text + ' · ' + W.ago(l.t);
  }
  setInterval(ticker, 4500);
  W.on('live', () => {
    const b = W.live.boss;
    if (b) $('#boss-hp').style.width = Math.max(2, (b.hp / b.max) * 100) + '%';
    const ms = W.ui.mysteryState();
    $('#mystery-dot').hidden = ms.solved || W.ui.cluesNow() === 0;
    const c = W.live.community;
    if (c) $('#cc-pct').textContent = Math.min(100, Math.round((c.value / c.goal) * 100)) + '%';
    if (!tick) ticker();
  });

  async function refresh() {
    try { await W.ui.refresh(); } catch (e) { console.error(e); }
  }
  refresh();
  setInterval(() => { if (!document.hidden) refresh(); }, 30000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { refresh(); W.ui.rouletteBanner(); } });
  W.ui.rouletteBanner();

  // ---------------------------------------------------------------- links
  const q = new URLSearchParams(location.search);
  function clearQuery() { history.replaceState(null, '', location.pathname); }
  setTimeout(() => {
    if (q.get('duel')) { const [code, fmt] = q.get('duel').split('-'); W.world.teleport('duel'); W.ui.acceptDuel(code.replace(/[^a-z0-9]/g, '').slice(0, 8), fmt, (q.get('from') || '').slice(0, 12)); clearQuery(); return; }
    if (q.get('room')) { W.world.teleport('neighbors'); W.ui.visitRoom(q.get('room').slice(0, 60), (q.get('by') || 'Någon').slice(0, 12)); clearQuery(); return; }
    if (q.get('roulette')) {
      const [g, idx] = q.get('roulette').split('.');
      if (D.ROULETTE[g] && D.ROULETTE[g][+idx]) { W.world.teleport('roulette'); W.ui.roulette(g, { idx: +idx, from: (q.get('from') || '').slice(0, 12) }); }
      clearQuery(); return;
    }
    if (q.get('game')) { const g = D.GAMES.find((x) => x.id === q.get('game')); if (g) { W.world.teleport(g.id); W.ui.openGame(g); } clearQuery(); return; }
    if (location.hash === '#mysterium') { W.world.teleport('mystery'); W.ui.openMystery(); return; }
    if (!W.ls.get('eojw:welcomed', false)) welcome();
  }, 300);

  function welcome() {
    W.ls.set('eojw:welcomed', true);
    W.modal('Välkommen till Edwards och Johns spel! 🌍', h('div', { class: 'welcome' },
      h('p', { class: 'lead' }, 'Det här är inte en vanlig hemsida – det är en hel värld. Varje byggnad är ett spel.'),
      h('ul', { class: 'wl' },
        h('li', null, '🚶 ', h('b', null, 'Gå runt: '), 'piltangenter/WASD, eller klicka/tryck där du vill gå. Gå in i en byggnad med ', h('kbd', null, 'E'), ' eller genom att klicka på den.'),
        h('li', null, '🕵️ ', h('b', null, 'Daily Mystery: '), 'ett hemligt spel varje dag – ledtrådar släpps under dagen.'),
        h('li', null, '👹 ', h('b', null, 'Boss Battle: '), 'alla slåss mot samma boss med minispel. Ny boss varje vecka.'),
        h('li', null, '🎲 ', h('b', null, 'SURPRISE ME: '), 'slumpat spel + slumpad utmaning + tidsgräns.'),
        h('li', null, '🏠 ', h('b', null, 'Ditt eget rum: '), 'inred, ställ ut troféer, besök andras rum.'),
        h('li', null, '🪙 ', h('b', null, 'Samla mynt '), 'som ligger utspridda – nya varje dag. Och leta efter hemligheter… 🔮')),
      h('div', { class: 'row' }, h('button', { class: 'btn big', type: 'button', onclick: () => W.closeModal() }, 'Börja utforska!'), h('button', { class: 'btn ghost', type: 'button', onclick: () => W.ui.openAll() }, '📋 Visa alla spel direkt'))));
  }

  // ---------------------------------------------------------------- secrets
  // 1) the classic code
  const KONAMI = ['arrowup', 'arrowup', 'arrowdown', 'arrowdown', 'arrowleft', 'arrowright', 'arrowleft', 'arrowright', 'b', 'a'];
  let kp = 0;
  window.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    kp = k === KONAMI[kp] ? kp + 1 : k === KONAMI[0] ? 1 : 0;
    if (kp === KONAMI.length) { kp = 0; document.body.classList.toggle('retro'); W.award('konami'); }
  });
  // 2) seven clicks at the bottom
  let fc = 0, ft = 0;
  $('#copy').addEventListener('click', () => { if (Date.now() - ft > 3000) fc = 0; ft = Date.now(); if (++fc >= 7) W.award('footer'); });
  // 3) the red pixel in the logo
  $('#pixel').addEventListener('click', (e) => { e.stopPropagation(); W.award('logo'); });
  // 4) night owl
  if (W.hour() < 4) setTimeout(() => W.award('night-owl'), 2500);
  // 5) the console
  console.log('%cHej utvecklare! 👋', 'font-size:20px;font-weight:900;color:#5ee7ff');
  console.log('%cTerminalen i Neonzonen gillar ordet NEONHACK.', 'color:#a970ff');
  console.log('Byggt av Edward och John.');
})();
