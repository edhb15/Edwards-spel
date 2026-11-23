// Everything that opens when you walk into a building: games, mystery, boss, roulette, duels, rooms, profile …
(function () {
  'use strict';
  const { D, h, $, modal, closeModal, toast, fmt } = W;
  const P = () => W.profile;
  const gameById = {};
  D.GAMES.forEach((g) => (gameById[g.id] = g));
  const BOARD_GAME = { 'stunt-rider': 'stunt', 'ski-to-death': 'ski', 'impossible-rooms': 'rooms', smita: 'smita', 'teacher-meltdown': 'teacher' };
  const BOARD_UNIT = { 'stunt-rider': 'p', 'ski-to-death': 'p', smita: 's', 'teacher-meltdown': 't', 'impossible-rooms': 't' };
  function fmtBoard(board, n) {
    const u = BOARD_UNIT[board.split(':')[0]];
    if (u === 's') return n + ' s';
    if (u === 't') { const m = Math.floor(n / 60); const s = n - m * 60; return m + ':' + (s < 10 ? '0' : '') + (Math.round(s * 10) / 10); }
    return fmt(n) + ' p';
  }
  const bestPerName = (rows, low) => {
    const sorted = rows.slice().sort((a, b) => (low ? a.score - b.score : b.score - a.score));
    const seen = new Set();
    return sorted.filter((r) => { const k = r.name.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
  };
  const sumPerName = (rows) => {
    const m = {};
    rows.forEach((r) => { m[r.name] = (m[r.name] || 0) + r.score; });
    return Object.entries(m).map(([name, score]) => ({ name, score })).sort((a, b) => b.score - a.score);
  };
  function list(rows, fmtFn, me) {
    if (!rows.length) return h('p', { class: 'muted' }, 'Inga resultat än – bli först!');
    return h('ol', { class: 'lb' }, rows.slice(0, 10).map((r, i) => h('li', { class: me && r.name.toLowerCase() === String(me).toLowerCase() ? 'me' : '' },
      h('span', { class: 'r' }, i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1 + '.'), h('span', { class: 'n' }, r.name), h('span', { class: 's' }, fmtFn ? fmtFn(r.score) : fmt(r.score)))));
  }
  const loading = () => h('p', { class: 'muted' }, 'Laddar…');
  async function fill(el, fn) {
    el.innerHTML = '';
    el.appendChild(loading());
    try { const c = await fn(); el.innerHTML = ''; el.appendChild(c); } catch (e) { console.error(e); el.innerHTML = '<p class="muted">Kunde inte ladda.</p>'; }
  }
  const btn = (label, onclick, cls) => h('button', { class: 'btn ' + (cls || ''), type: 'button', onclick }, label);

  // ================================================================== shared "live" state, refreshed every 30 s
  const live = { week: null, weekRows: [], feed: [], boss: null, community: null, bossDef: null, chal: null };
  W.live = live;

  function bossDef() {
    const wk = W.weekInfo();
    return Object.assign({ week: wk.id, end: wk.end, max: D.BOSS_HP }, D.BOSSES[wk.num % D.BOSSES.length]);
  }
  function communityDef() { return D.COMMUNITY[W.weekInfo().num % D.COMMUNITY.length]; }

  async function refresh() {
    const wk = W.weekInfo();
    live.week = wk;
    const [weekRows, feed] = await Promise.all([W.rows({ prefix: 'u:', since: wk.start, limit: 5000 }), W.rows({ limit: 50 })]);
    live.weekRows = weekRows;
    live.feed = feed;
    // world heat: how much each game is played this week; crowd: last 2 hours
    const heat = {}, crowd = {};
    const now = Date.now();
    weekRows.forEach((r) => {
      if (!r.board.startsWith('u:play:')) return;
      const g = r.board.slice(7);
      heat[g] = (heat[g] || 0) + 1;
      if (now - Date.parse(r.created_at) < 2 * 3600e3) crowd[g] = Math.min(8, (crowd[g] || 0) + 1);
    });
    const lvl = {};
    for (const g in heat) lvl[g] = heat[g] >= 15 ? 3 : heat[g] >= 5 ? 2 : 1;
    W.world.setHeat(lvl, crowd);
    // boss
    const b = bossDef();
    const dmgRows = weekRows.filter((r) => r.board === 'u:boss:' + b.week);
    const dmg = dmgRows.reduce((a, r) => a + r.score, 0);
    live.boss = Object.assign(b, { hp: Math.max(0, b.max - dmg), dmg, dead: dmg >= b.max, fighters: new Set(dmgRows.map((r) => r.name.toLowerCase())).size, rows: dmgRows });
    W.world.setBoss(live.boss);
    if (live.boss.dead && (P().boss[b.week] || 0) > 0) W.award('boss-kill');
    // community challenge
    const c = communityDef();
    const u = (p) => weekRows.filter((r) => r.board.startsWith(p));
    let value = 0;
    if (c.metric === 'points') value = u('u:mini:').concat(u('u:boss:')).reduce((a, r) => a + r.score, 0);
    if (c.metric === 'plays') value = u('u:play:').length;
    if (c.metric === 'games') value = new Set(u('u:play:').map((r) => r.board.slice(7))).size;
    if (c.metric === 'secrets') value = u('u:secret:').length;
    if (c.metric === 'mystery') value = u('u:mystery:').length;
    live.community = Object.assign({}, c, { value, done: value >= c.goal });
    W.world.setCommunity(live.community);
    const rewards = {};
    if (live.community.done) {
      rewards[c.reward] = true;
      if (!P().seenCommunity[c.reward]) { P().seenCommunity[c.reward] = Date.now(); W.save(); toast('🎉 Communityn klarade veckans utmaning! Belöning upplåst: ' + c.rewardName, 'big'); }
    }
    W.world.setRewards(rewards);
    // feed + ghosts
    buildFeed();
    W.emit('live');
  }

  function rowTarget(r) {
    const b = r.board;
    if (b.startsWith('u:play:')) return b.slice(7);
    if (b.startsWith('u:boss:')) return 'boss';
    if (b.startsWith('u:mystery:')) return 'mystery';
    if (b.startsWith('u:mini:')) return 'mini:' + b.split(':')[2];
    if (b.startsWith('u:duel:')) return 'duel';
    if (b.startsWith('u:room:')) return 'neighbors';
    if (b.startsWith('u:roulette')) return 'roulette';
    if (b.startsWith('u:')) return 'feed';
    return BOARD_GAME[b.split(':')[0]] || 'feed';
  }
  function rowText(r, best) {
    const b = r.board, n = r.name;
    if (b.startsWith('u:play:')) return '▶️ ' + n + ' började spela ' + ((gameById[b.slice(7)] || {}).name || 'ett spel');
    if (b.startsWith('u:boss:')) return '⚔️ ' + n + ' gjorde ' + fmt(r.score) + ' skada på bossen';
    if (b.startsWith('u:mystery:')) return '🕵️ ' + n + ' löste dagens mysterium!';
    if (b.startsWith('u:secret:')) return '🔮 ' + n + ' hittade en hemlighet!';
    if (b.startsWith('u:mini:')) { const m = W.mini.GAMES[b.split(':')[2]]; return '🕹️ ' + n + ' fick ' + fmt(r.score) + ' i ' + (m ? m.name : 'ett minispel'); }
    if (b.startsWith('u:duel:')) return '⚔️ ' + n + ' spelade en duell';
    if (b.startsWith('u:room:')) return '🏠 ' + n + ' visar upp sitt rum på Granngatan';
    if (b.startsWith('u:pc')) return '🎯 ' + n + ' klarade en personlig utmaning';
    if (b.startsWith('u:roulette')) return '🎲 ' + n + ' klarade en Surprise Me-utmaning';
    if (b.startsWith('u:')) return '✨ ' + n + ' gjorde något';
    const g = gameById[BOARD_GAME[b.split(':')[0]]];
    return (best ? '🏆 NYTT REKORD! ' : '🏁 ') + n + ' fick ' + fmtBoard(b, r.score) + ' i ' + (g ? g.name : b.split(':')[0]);
  }
  const recordCache = {};
  async function buildFeed() {
    const rows = live.feed;
    // game scores: is it the best on that board? (only checks a few boards)
    const boards = [...new Set(rows.filter((r) => !r.board.startsWith('u:')).map((r) => r.board))].slice(0, 5);
    await Promise.all(boards.map(async (b) => {
      if (recordCache[b] && Date.now() - recordCache[b].t < 120e3) return;
      const low = ['teacher-meltdown', 'impossible-rooms'].includes(b.split(':')[0]);
      const top = await W.rows({ board: b, order: 'score.' + (low ? 'asc' : 'desc'), limit: 1 });
      recordCache[b] = { t: Date.now(), best: top[0] };
    }));
    const lines = [];
    // "many people are playing X"
    const hourAgo = Date.now() - 3600e3;
    const counts = {};
    live.weekRows.forEach((r) => { if (r.board.startsWith('u:play:') && Date.parse(r.created_at) > hourAgo) counts[r.board.slice(7)] = (counts[r.board.slice(7)] || 0) + 1; });
    Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 1).forEach(([g, c]) => { if (c >= 3 && gameById[g]) lines.push({ text: '🔥 ' + c + ' personer har startat ' + gameById[g].name + ' senaste timmen', t: new Date().toISOString(), hot: true }); });
    const seenDuel = new Set();
    rows.forEach((r) => {
      if (r.board.startsWith('u:duel:')) { const k = r.name + r.board.split(':')[2]; if (seenDuel.has(k)) return; seenDuel.add(k); }
      const rec = recordCache[r.board] && recordCache[r.board].best;
      const isBest = rec && rec.name === r.name && rec.score === r.score && rec.created_at === r.created_at;
      lines.push({ text: rowText(r, isBest), t: r.created_at, best: isBest });
    });
    live.lines = lines;
    W.feedLines = lines.map((l) => l.text);
    // ghosts: people active the last 20 minutes walk around where they were
    const g = [], seen = new Set();
    rows.forEach((r) => {
      if (Date.now() - Date.parse(r.created_at) > 20 * 60e3) return;
      if (P().name && r.name.toLowerCase() === P().name.toLowerCase()) return;
      if (seen.has(r.name)) return;
      seen.add(r.name);
      g.push({ name: r.name, target: rowTarget(r) });
    });
    W.world.setGhosts(g);
    W.emit('feed', lines);
  }

  // ================================================================== personal profile: play history, challenges
  function recordPlay(kind, id, score) {
    const p = P();
    p.history.unshift({ k: kind, id, s: score, t: Date.now() });
    p.history = p.history.slice(0, 60);
    if (kind === 'game') {
      p.plays[id] = (p.plays[id] || 0) + 1;
      const d = gameById[id].d;
      p.cat[d] = (p.cat[d] || 0) + 1;
    } else if (kind === 'mini') p.cat.mini = (p.cat.mini || 0) + 1;
    W.save();
    W.award('community');
    const n = Object.keys(p.plays).length;
    if (kind === 'game') W.award('first-game');
    if (n >= 5) W.award('variety');
    if (n >= D.GAMES.length) W.award('all-games');
    if (n >= 3 && !W.has('neon')) { W.award('neon'); toast('🌈 Neonzonen är upplåst! Den ligger norr om Torget.', 'big'); }
    W.world.setNeonLocked(n < 3);
    checkChallenges({ kind, id, score });
  }
  function favCat() {
    const c = P().cat;
    const best = Object.keys(c).sort((a, b) => c[b] - c[a])[0];
    return best || null;
  }
  function profileType() {
    const f = favCat();
    return f ? D.TYPES[f] : { t: 'Nykomling', i: '🐣' };
  }
  function todaysChallenges() {
    const p = P();
    const r = W.rng(W.hash(W.today() + ':' + (p.name || 'x') + ':pc'));
    const out = [];
    const fav = favCat();
    const never = D.GAMES.filter((g) => !p.plays[g.id]);
    if (fav && fav !== 'mini' && D.DISTRICTS[fav]) out.push({ id: 'cat', type: 'play-cat', cat: fav, text: 'Spela ett spel i ' + D.DISTRICTS[fav].name + ' – ditt favoritområde' });
    else out.push({ id: 'cat', type: 'play-cat', cat: W.pick(r, ['fart', 'action', 'hjarna', 'skola']), text: '' });
    if (!out[0].text) out[0].text = 'Spela ett spel i ' + D.DISTRICTS[out[0].cat].name;
    if (never.length) { const g = W.pick(r, never); out.push({ id: 'new', type: 'play', game: g.id, text: 'Testa ' + g.name + ' – du har aldrig spelat det!' }); }
    else { const g = W.pick(r, D.GAMES); out.push({ id: 'new', type: 'play', game: g.id, text: 'Spela ' + g.name + ' igen' }); }
    const m = W.pick(r, W.mini.PUBLIC);
    const target = { stars: 500, aim: 1200, dodge: 900, memory: 400 }[m] + Math.floor(r() * 4) * 100 + W.level() * 30;
    out.push({ id: 'mini', type: 'mini', mini: m, target, text: 'Få minst ' + fmt(target) + ' poäng i ' + W.mini.GAMES[m].name + ' (Neonzonen eller Bossarenan)' });
    out.push(W.pick(r, [
      { id: 'x', type: 'boss', text: 'Gör skada på veckans boss' },
      { id: 'x', type: 'mystery', text: 'Lös dagens mysterium' },
      { id: 'x', type: 'coins', n: 10, text: 'Samla 10 mynt i världen idag' },
    ]));
    return out;
  }
  function checkChallenges(ev) {
    const p = P();
    if (p.pc.date !== W.today()) p.pc = { date: W.today(), done: [] };
    todaysChallenges().forEach((c) => {
      if (p.pc.done.includes(c.id)) return;
      let ok = false;
      if (c.type === 'play-cat' && ev.kind === 'game' && gameById[ev.id].d === c.cat) ok = true;
      if (c.type === 'play' && ev.kind === 'game' && ev.id === c.game) ok = true;
      if (c.type === 'mini' && ev.kind === 'mini' && ev.id === c.mini && ev.score >= c.target) ok = true;
      if (c.type === 'boss' && ev.kind === 'boss') ok = true;
      if (c.type === 'mystery' && ev.kind === 'mystery') ok = true;
      if (c.type === 'coins' && p.coinDay.date === W.today() && p.coinDay.got.length >= c.n) ok = true;
      if (ok) {
        p.pc.done.push(c.id);
        p.pcTotal = (p.pcTotal || 0) + 1;
        W.save();
        toast('🎯 Personlig utmaning klarad: ' + c.text + ' (+8 🪙)', 'big');
        W.addCoins(8, true); W.addXp(40);
        W.insert('u:pc', 1);
        if (p.pcTotal >= 3) W.award('challenge');
      }
    });
    W.save();
  }
  W.on('coin', () => checkChallenges({ kind: 'coin' }));

  // ================================================================== games
  function openGame(g) {
    const p = P();
    const video = h('video', { src: g.video, poster: g.img, muted: true, loop: true, playsinline: true, autoplay: true, class: 'gm-video', 'aria-hidden': 'true' });
    video.muted = true;
    const board = h('div', { class: 'gm-board' });
    const body = h('div', { class: 'gm' },
      h('div', { class: 'gm-media' }, video),
      h('div', { class: 'gm-info' },
        h('div', { class: 'tags' }, h('span', { class: 'tag' }, g.tag), h('span', { class: 'tag alt' }, D.DISTRICTS[g.d].icon + ' ' + D.DISTRICTS[g.d].name), g.desktop ? h('span', { class: 'tag warn' }, '🖥️ Endast för dator') : null),
        h('p', null, g.desc),
        h('p', { class: 'muted small' }, (p.plays[g.id] ? 'Du har spelat det ' + p.plays[g.id] + ' gång' + (p.plays[g.id] > 1 ? 'er' : '') + '. ' : 'Du har aldrig spelat det – +30 XP första gången! ') + ((W.world.state.heat[g.id] || 0) >= 3 ? '🔥 Ett av veckans hetaste spel.' : '')),
        h('div', { class: 'row' },
          h('a', { class: 'btn big', href: g.url, onclick: (e) => { e.preventDefault(); play(g); } }, '▶ Spela nu'),
          btn('🎲 Utmaning', () => roulette(g.id)),
          btn('📤 Dela', () => W.share(g.name, 'Spela ' + g.name + ' gratis i webbläsaren!', W.SITE + '?game=' + g.id), 'ghost')),
        g.board ? h('h3', null, '🏆 Topplista') : null, board));
    modal(g.name, body, { cls: 'wide' });
    if (g.board) fill(board, async () => list(bestPerName(await W.rows({ board: g.board, order: 'score.' + (g.low ? 'asc' : 'desc'), limit: 200 }), g.low), (n) => fmtBoard(g.board, n), p.name));
  }
  function play(g) {
    const first = !P().plays[g.id];
    recordPlay('game', g.id);
    W.addXp(first ? 30 : 15);
    W.insert('u:play:' + g.id, 1);
    W.track('spela-' + g.id, 'spela: ' + g.name);
    setTimeout(() => { location.href = g.url; }, 250);
  }

  // ================================================================== 2. Daily Mystery Game
  function mysteryGame() { return W.pick(W.daily('mystery'), D.GAMES); }
  function cluesNow() {
    const hr = W.hour();
    return D.CLUE_HOURS.filter((x) => hr >= x).length;
  }
  function mysteryState() {
    const p = P();
    if (p.mystery.date !== W.today()) p.mystery = { date: W.today(), wrong: 0, solved: false, points: 0 };
    return p.mystery;
  }
  function openMystery() {
    const ms = mysteryState();
    const g = mysteryGame();
    const n = cluesNow();
    const clues = h('ol', { class: 'clues' }, D.CLUES[g.id].map((c, i) => i < n || ms.solved
      ? h('li', null, c)
      : h('li', { class: 'locked' }, '🔒 Ledtråd ' + (i + 1) + ' släpps kl ' + String(D.CLUE_HOURS[i]).padStart(2, '0') + ':00')));
    const guess = h('div', { class: 'guess' });
    const board = h('div');
    const status = h('div');
    function render() {
      status.innerHTML = '';
      guess.innerHTML = '';
      if (ms.solved) {
        status.appendChild(h('div', { class: 'win-box' }, h('div', { class: 'big-icon' }, '🕵️'),
          h('p', null, h('b', null, 'Du löste det! '), 'Dagens hemliga spel var ', h('b', null, g.name), '. Du fick ', h('b', null, fmt(ms.points)), ' poäng' + (ms.rank === 1 ? ' – och du var FÖRST av alla! 🥇' : '.')),
          h('div', { class: 'row' }, h('a', { class: 'btn', href: g.url, onclick: (e) => { e.preventDefault(); play(g); } }, '▶ Spela ' + g.name), btn('Bonusrunda (+🪙)', bonus, 'ghost'))));
        return;
      }
      if (ms.wrong >= 3) { status.appendChild(h('p', { class: 'warn-box' }, '❌ Du har gissat fel 3 gånger idag. Nytt mysterium i morgon!')); return; }
      if (n === 0) { status.appendChild(h('p', { class: 'muted' }, 'Första ledtråden släpps kl 06:00. Kom tillbaka då!')); return; }
      const pts = Math.max(50, 600 - (n - 1) * 100 - ms.wrong * 100);
      status.appendChild(h('p', null, 'Vilket spel är det? Rätt svar nu ger ', h('b', null, pts + ' poäng'), '. Fel gissningar: ' + ms.wrong + '/3. Ju färre ledtrådar du behöver, desto fler poäng.'));
      D.GAMES.forEach((x) => guess.appendChild(btn(x.name, () => doGuess(x, pts), 'chip')));
    }
    function doGuess(x, pts) {
      W.needName(async () => {
        if (x.id !== g.id) {
          ms.wrong++; W.save();
          toast('❌ Nej, det är inte ' + x.name);
          render();
          return;
        }
        ms.solved = true; ms.points = pts; W.save();
        W.addXp(80); W.addCoins(5, true);
        W.award('mystery');
        recordPlay('mystery', 'mystery');
        checkChallenges({ kind: 'mystery' });
        await W.insert('u:mystery:' + W.today(), pts);
        const first = await W.rows({ board: 'u:mystery:' + W.today(), order: 'created_at.asc', limit: 1 });
        if (first[0] && first[0].name.toLowerCase() === P().name.toLowerCase()) { ms.rank = 1; W.save(); W.award('detective'); }
        toast('🕵️ Rätt! Det var ' + g.name, 'big');
        render();
        loadBoard();
      }, 'Välj ett namn så att du hamnar på dagens topplista.');
    }
    function bonus() {
      const m = W.pick(W.daily('mystery-mini'), W.mini.PUBLIC);
      const box = modal('🕵️ Mysteriets bonusrunda', h('div', { id: 'mini-slot' }), { sticky: true });
      W.mini.run(box.querySelector('#mini-slot'), m, { seed: W.hash(W.today() + 'bonus'), speed: 1.25, mirror: W.daily('mirror')() < 0.5, note: 'Dagens twist: snabbare' + (W.daily('mirror')() < 0.5 ? ' och spegelvänt!' : '!') }).then((s) => {
        if (s < 0) return;
        const c = Math.max(1, Math.floor(s / 150));
        W.addCoins(c); W.insert('u:mini:' + m, s);
        setTimeout(openMystery, 1200);
      });
    }
    async function loadBoard() {
      fill(board, async () => {
        const rows = await W.rows({ board: 'u:mystery:' + W.today(), order: 'created_at.asc', limit: 200 });
        if (!rows.length) return h('p', { class: 'muted' }, 'Ingen har löst det än idag. Bli först och få utmärkelsen 🕵️ Dagens detektiv!');
        const firstName = rows[0].name;
        return h('div', null, h('p', null, '🥇 Först idag: ', h('b', null, firstName), ' (' + W.ago(rows[0].created_at) + ')'), list(bestPerName(rows), (s) => s + ' p', P().name));
      });
    }
    render();
    loadBoard();
    modal('🕵️ Daily Mystery Game', h('div', null,
      h('p', { class: 'lead' }, 'Varje dag finns ett hemligt spel – samma för alla. Ledtrådar släpps under dagen. Den som löser det först får en speciell utmärkelse!'),
      h('div', { class: 'two' }, h('div', null, h('h3', null, 'Ledtrådar'), clues, status, guess), h('div', null, h('h3', null, 'Dagens topplista'), board))), { cls: 'wide' });
  }

  // ================================================================== 3. Global Boss Battle
  function openBoss() {
    const b = live.boss || Object.assign(bossDef(), { hp: D.BOSS_HP, dmg: 0, fighters: 0, rows: [] });
    const days = Math.max(0, Math.ceil((b.end - Date.now()) / 86400000));
    const mine = P().boss[b.week] || 0;
    const top = h('div');
    const pick = h('div', { class: 'mini-pick' }, W.mini.PUBLIC.map((m) => btn(W.mini.GAMES[m].icon + ' ' + W.mini.GAMES[m].name, () => attack(m), 'chip')));
    modal(b.icon + ' ' + b.name, h('div', null,
      h('p', { class: 'lead' }, b.desc + ' Alla spelare slåss mot samma boss. Varje poäng du får i ett minispel blir skada!'),
      h('div', { class: 'hp' }, h('div', { class: 'hp-fill' + (b.dead ? ' dead' : ''), style: 'width:' + Math.max(1, (b.hp / b.max) * 100) + '%' }), h('span', null, b.dead ? '💀 BESEGRAD!' : fmt(b.hp) + ' / ' + fmt(b.max) + ' HP')),
      h('p', { class: 'muted small' }, '👥 ' + b.fighters + ' spelare har slagits · Ny boss om ' + days + ' dag' + (days === 1 ? '' : 'ar') + ' · Din skada denna vecka: ' + fmt(mine)),
      b.dead ? h('p', { class: 'win-box' }, '🎉 Bossen är besegrad! Alla som var med får utmärkelsen 👑 Bossdräpare och bosssaker till sitt rum (👑 🐉). Du kan fortsätta slåss för topplistan.') : null,
      h('h3', null, 'Attackera med ett minispel'), pick,
      h('h3', null, 'Veckans bosskämpar'), top));
    fill(top, async () => list(sumPerName(b.rows || []), (s) => fmt(s) + ' skada', P().name));
    function attack(m) {
      W.needName(() => {
        const box = modal('⚔️ Attack: ' + W.mini.GAMES[m].name, h('div', { id: 'mini-slot' }), { sticky: true });
        W.mini.run(box.querySelector('#mini-slot'), m, { note: 'Dina poäng = skada på ' + b.name }).then(async (score) => {
          if (score < 0) return;
          P().boss[b.week] = (P().boss[b.week] || 0) + score;
          W.save();
          W.award('boss');
          recordPlay('mini', m, score);
          checkChallenges({ kind: 'boss' });
          checkChallenges({ kind: 'mini', id: m, score });
          W.addXp(30); W.addCoins(Math.max(1, Math.floor(score / 250)));
          await W.insert('u:boss:' + b.week, score);
          toast('💥 ' + fmt(score) + ' skada på ' + b.name + '!', 'big');
          await refresh();
          setTimeout(openBoss, 900);
        });
      }, 'Välj ett namn så att din skada syns på bosstopplistan.');
    }
  }

  // ================================================================== 5. Game Roulette (Surprise me)
  function roulette(forceGame, fromLink) {
    const r = Math.random;
    const g = forceGame ? gameById[forceGame] : D.GAMES[Math.floor(r() * D.GAMES.length)];
    const list_ = D.ROULETTE[g.id];
    const idx = fromLink ? fromLink.idx : Math.floor(r() * list_.length);
    const [text, min] = list_[idx];
    const card = h('div', { class: 'roulette-card spin' }, h('div', { class: 'big-icon' }, '🎲'), h('p', { class: 'muted' }, 'Snurrar…'));
    const body = h('div', null, fromLink ? h('p', { class: 'lead' }, '⚔️ ', h('b', null, fromLink.from || 'En kompis'), ' utmanar dig!') : h('p', { class: 'lead' }, 'Ett slumpmässigt spel, en slumpmässig utmaning och en tidsgräns. Klarar du det?'), card);
    modal('🎲 SURPRISE ME!', body);
    const names = D.GAMES.map((x) => x.name);
    let i = 0;
    const spin = setInterval(() => { card.querySelector('p').textContent = names[i++ % names.length]; }, 70);
    setTimeout(() => {
      clearInterval(spin);
      card.className = 'roulette-card';
      card.innerHTML = '';
      card.append(
        h('img', { src: g.img, alt: '', class: 'rc-img' }),
        h('h3', null, g.name),
        h('p', { class: 'rc-text' }, '“' + text + '”'),
        h('p', { class: 'rc-time' }, '⏱ Tidsgräns: ' + min + ' minuter'),
        g.desktop ? h('p', { class: 'muted small' }, '🖥️ Spelet fungerar bara på dator.') : null,
        h('div', { class: 'row center' },
          btn('▶ Starta utmaningen', () => {
            P().rouletteActive = { g: g.id, idx, text, until: Date.now() + min * 60e3, min };
            W.save();
            play(g);
          }, 'big'),
          btn('⚔️ Utmana en kompis', () => W.share('Surprise Me', '🎲 Jag utmanar dig i ' + g.name + ': ' + text + ' – på ' + min + ' minuter!', W.SITE + '?roulette=' + g.id + '.' + idx + '&from=' + encodeURIComponent(P().name || '')), 'ghost'),
          fromLink ? null : btn('🔄 Snurra igen', () => roulette(), 'ghost')));
    }, fromLink ? 400 : 1300);
  }
  // back from a roulette game: did you make it?
  function rouletteBanner() {
    const a = P().rouletteActive;
    const el = $('#roulette-banner');
    if (!a) { el.hidden = true; return; }
    const g = gameById[a.g];
    const left = a.until - Date.now();
    el.hidden = false;
    el.innerHTML = '';
    el.append(h('span', null, '🎲 ', h('b', null, g.name), ': ' + a.text + ' · ', h('b', { class: 'rb-time' }, left > 0 ? Math.floor(left / 60000) + ':' + String(Math.floor(left / 1000) % 60).padStart(2, '0') : 'Tiden är ute')),
      btn('✅ Klarade det!', () => done(true)), btn('❌ Misslyckades', () => done(false), 'ghost'));
    function done(ok) {
      const late = Date.now() > a.until + 60e3;
      P().rouletteActive = null;
      if (ok && !late) {
        P().roulette = (P().roulette || 0) + 1;
        W.addCoins(6); W.addXp(50);
        W.award('roulette');
        if (P().roulette >= 3) W.award('roulette-3');
        W.insert('u:roulette', 1);
        toast('🎉 Snyggt! Utmaningen klarad.', 'big');
      } else if (ok) toast('⏱ För sent den här gången – men bra kämpat!');
      else toast('Nästa gång! 💪');
      W.save();
      rouletteBanner();
    }
  }
  setInterval(() => { if (P().rouletteActive) { const t = $('.rb-time'); const left = P().rouletteActive.until - Date.now(); if (t) t.textContent = left > 0 ? Math.floor(left / 60000) + ':' + String(Math.floor(left / 1000) % 60).padStart(2, '0') : 'Tiden är ute'; } }, 1000);

  // ================================================================== 9. Live feed
  function openFeed() {
    const body = h('div');
    modal('📺 Live-tavlan', h('div', null, h('p', { class: 'lead' }, 'Det här händer i världen just nu – rekord, bossattacker, hemligheter och mycket mer.'), body), { cls: 'wide' });
    const render = () => {
      body.innerHTML = '';
      const lines = live.lines || [];
      const active = new Set(live.weekRows.filter((r) => Date.now() - Date.parse(r.created_at) < 3600e3).map((r) => r.name)).size;
      body.appendChild(h('p', { class: 'muted' }, '🟢 ' + active + ' spelare aktiva senaste timmen' + (W.isOnline() ? '' : ' · (visar bara den här enheten – topplistan online svarar inte)')));
      if (!lines.length) body.appendChild(h('p', { class: 'muted' }, 'Lugnt just nu… gör något så syns du här!'));
      body.appendChild(h('ul', { class: 'feed-list' }, lines.map((l) => h('li', { class: l.best ? 'best' : l.hot ? 'hot' : '' }, h('span', null, l.text), h('small', null, W.ago(l.t))))));
    };
    render();
    const off = () => { if (!document.body.contains(body)) return; render(); };
    W.on('feed', off);
  }

  // ================================================================== 10. Community challenges
  function openCommunity() {
    const c = live.community || Object.assign({}, communityDef(), { value: 0 });
    const pct = Math.min(100, (c.value / c.goal) * 100);
    const days = Math.max(0, Math.ceil((W.weekInfo().end - Date.now()) / 86400000));
    modal('🎯 Veckans communityutmaning', h('div', null,
      h('p', { class: 'lead' }, 'Alla spelare jobbar tillsammans. När ni når målet låses en gemensam belöning upp för alla!'),
      h('div', { class: 'cc' }, h('h3', null, c.text),
        h('div', { class: 'hp' }, h('div', { class: 'hp-fill good', style: 'width:' + Math.max(1, pct) + '%' }), h('span', null, fmt(c.value) + ' / ' + fmt(c.goal))),
        h('p', null, '🎁 Belöning: ', h('b', null, c.rewardName)),
        h('p', { class: 'muted small' }, c.done ? '✅ KLART! Belöningen är upplåst för alla.' : '⏳ ' + days + ' dag' + (days === 1 ? '' : 'ar') + ' kvar')),
      h('h3', null, 'Så hjälper du till'),
      h('ul', null, h('li', null, 'Minispel i Neonzonen och Bossarenan ger poäng'), h('li', null, 'Varje spel du startar från världen räknas'), h('li', null, 'Mysteriet och hemligheterna räknas också'))));
  }

  // ================================================================== 7. Duels
  const FORMATS = {
    sprint: { n: 'Högst poäng på 60 sekunder', rounds: 1, dur: 60 },
    bo3: { n: 'Bäst av tre', rounds: 3, dur: 20 },
    race: { n: 'Först att klara banan', rounds: 1, dur: 40, goal: 15 },
  };
  function duelRounds(code, fmtId) {
    const f = FORMATS[fmtId];
    const r = W.rng(W.hash(code));
    const ms = W.mini.PUBLIC.slice();
    const out = [];
    for (let i = 0; i < f.rounds; i++) {
      if (fmtId === 'race') { out.push('aim'); break; }
      const k = Math.floor(r() * ms.length);
      out.push(ms.splice(k, 1)[0]);
    }
    return out;
  }
  function openDuel() {
    const p = P();
    const wins = p.duels.filter((d) => d.res === 'win').length, losses = p.duels.filter((d) => d.res === 'loss').length;
    const rivals = {};
    const wk = W.weekInfo();
    p.duels.filter((d) => d.opp && d.t > Date.parse(wk.start)).forEach((d) => { rivals[d.opp] = rivals[d.opp] || { n: 0, w: 0, l: 0 }; rivals[d.opp].n++; if (d.res === 'win') rivals[d.opp].w++; if (d.res === 'loss') rivals[d.opp].l++; });
    const rival = Object.entries(rivals).sort((a, b) => b[1].n - a[1].n)[0];
    const mine = h('div');
    modal('⚔️ Duellhallen', h('div', null,
      h('p', { class: 'lead' }, 'Utmana en kompis! Du spelar först, sedan skickar du länken. Samma banor för er båda – högst poäng vinner. Resultaten syns på er profil.'),
      h('div', { class: 'stats' }, h('div', null, h('b', null, wins), 'vinster'), h('div', null, h('b', null, losses), 'förluster'), h('div', null, h('b', null, p.duels.length), 'dueller')),
      h('div', { class: 'rival' }, '🔥 Veckans rivalitet: ', rival ? h('span', null, h('b', null, rival[0]), ' – ' + rival[1].w + '–' + rival[1].l + ' den här veckan') : h('span', { class: 'muted' }, 'Spela en duell så får du en rival!')),
      h('h3', null, 'Starta en ny duell'),
      h('div', { class: 'mini-pick' }, Object.entries(FORMATS).map(([id, f]) => btn(f.n, () => W.needName(() => startDuel(id)), 'chip'))),
      h('h3', null, 'Dina dueller'), mine), { cls: 'wide' });
    fill(mine, async () => {
      if (!p.duels.length) return h('p', { class: 'muted' }, 'Inga dueller än.');
      await Promise.all(p.duels.slice(0, 8).filter((d) => !d.res).map(updateDuel));
      return h('ul', { class: 'duel-list' }, p.duels.slice(0, 10).map((d) => h('li', null,
        h('span', null, { win: '🥇', loss: '😵', draw: '🤝' }[d.res] || '⏳'), ' ', FORMATS[d.fmt].n, ' ', d.opp ? h('span', null, 'mot ', h('b', null, d.opp)) : h('span', { class: 'muted' }, '– väntar på motståndare'),
        d.res ? h('span', { class: 'muted' }, ' · ' + d.me + '–' + d.them) : btn('📤 Skicka länken igen', () => shareDuel(d), 'chip'))));
    });
  }
  function shareDuel(d) {
    W.share('Duell', '⚔️ ' + P().name + ' utmanar dig på en duell: ' + FORMATS[d.fmt].n + '! Kan du slå mig?', W.SITE + '?duel=' + d.code + '-' + d.fmt + '&from=' + encodeURIComponent(P().name));
  }
  async function playRounds(code, fmtId, title) {
    const rounds = duelRounds(code, fmtId);
    const f = FORMATS[fmtId];
    const scores = [];
    for (let i = 0; i < rounds.length; i++) {
      const box = modal(title + ' – runda ' + (i + 1) + '/' + rounds.length, h('div', { id: 'mini-slot' }), { sticky: true });
      const s = await W.mini.run(box.querySelector('#mini-slot'), rounds[i], { seed: W.hash(code + ':' + i), duration: f.dur, goal: f.goal, note: f.goal ? 'Träffa ' + f.goal + ' mål så snabbt du kan!' : null });
      if (s < 0) return null;
      scores.push(s);
      await W.insert('u:duel:' + code + ':' + i, s);
    }
    W.award('duel');
    W.addXp(40);
    return scores;
  }
  async function startDuel(fmtId) {
    const code = Math.random().toString(36).slice(2, 8);
    const scores = await playRounds(code, fmtId, '⚔️ Din duell');
    if (!scores) return;
    const d = { code, fmt: fmtId, mine: scores, t: Date.now(), creator: true };
    P().duels.unshift(d); P().duels = P().duels.slice(0, 40); W.save();
    modal('⚔️ Duellen är redo!', h('div', null,
      h('p', null, 'Ditt resultat: ', h('b', null, scores.map(fmt).join(' / '))),
      h('p', null, 'Skicka länken till en kompis. När hen har spelat ser ni båda vem som vann här i Duellhallen.'),
      h('div', { class: 'row' }, btn('📤 Skicka utmaningen', () => shareDuel(d), 'big'), btn('Till Duellhallen', openDuel, 'ghost'))));
  }
  async function updateDuel(d) {
    const rows = await W.rows({ prefix: 'u:duel:' + d.code + ':', order: 'created_at.asc', limit: 100 });
    const me = (P().name || '').toLowerCase();
    const others = rows.filter((r) => r.name.toLowerCase() !== me);
    if (!others.length) return;
    const opp = others[0].name;
    const rounds = FORMATS[d.fmt].rounds;
    const theirs = [];
    for (let i = 0; i < rounds; i++) { const r = others.find((x) => x.name === opp && x.board.endsWith(':' + i)); if (!r) return; theirs.push(r.score); }
    const mine = d.mine;
    let w = 0, l = 0;
    mine.forEach((s, i) => { if (s > theirs[i]) w++; else if (s < theirs[i]) l++; });
    d.opp = opp; d.me = w; d.them = l;
    if (rounds === 1) { d.me = fmt(mine[0]); d.them = fmt(theirs[0]); }
    d.res = w > l ? 'win' : w < l ? 'loss' : 'draw';
    if (d.res === 'win') W.award('duel-win');
    W.save();
  }
  async function acceptDuel(code, fmtId, from) {
    if (!FORMATS[fmtId]) return;
    if (P().duels.some((d) => d.code === code)) { openDuel(); return; }
    modal('⚔️ ' + (from || 'Någon') + ' utmanar dig!', h('div', null,
      h('p', { class: 'lead' }, 'Format: ', h('b', null, FORMATS[fmtId].n), '. Ni spelar exakt samma banor. Högst poäng vinner!'),
      btn('⚔️ Anta utmaningen', () => W.needName(async () => {
        const scores = await playRounds(code, fmtId, '⚔️ Duell mot ' + (from || 'kompis'));
        if (!scores) return;
        const d = { code, fmt: fmtId, mine: scores, t: Date.now() };
        P().duels.unshift(d); W.save();
        await updateDuel(d);
        modal(d.res === 'win' ? '🥇 Du vann!' : d.res === 'loss' ? '😵 Du förlorade' : d.res ? '🤝 Oavgjort' : '⚔️ Klart!', h('div', null,
          d.res ? h('p', { class: 'lead' }, 'Resultat: ' + d.me + ' – ' + d.them + ' mot ' + d.opp) : h('p', null, 'Ditt resultat är sparat. Resultatet visas när din kompis har spelat.'),
          h('div', { class: 'row' }, btn('⚔️ Utmana tillbaka', () => startDuel(fmtId), 'big'), btn('Till Duellhallen', openDuel, 'ghost'))));
      }, 'Välj ett namn så att din kompis ser vem som spelade.'), 'big')));
  }

  // ================================================================== 6. Your own game room
  const A64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  const RW = 12, RH = 8, MAXI = 17;
  function encodeRoom(room) {
    return A64[room.wall] + A64[room.floor] + room.items.slice(0, MAXI).map(([i, x, y]) => A64[i] + A64[x] + A64[y]).join('');
  }
  function decodeRoom(code) {
    const v = (c) => Math.max(0, A64.indexOf(c));
    const room = { wall: v(code[0]) % D.WALLS.length, floor: v(code[1]) % D.FLOORS.length, items: [] };
    for (let i = 2; i + 2 < code.length + 1 && room.items.length < MAXI; i += 3) {
      const it = v(code[i]), x = v(code[i + 1]), y = v(code[i + 2]);
      if (D.ITEMS[it] && x < RW && y < RH) room.items.push([it, x, y]);
    }
    return room;
  }
  function itemUnlocked(it, idx) {
    if (it.unlock) {
      const u = it.unlock;
      if (u.startsWith('community:')) return !!P().seenCommunity[u.slice(10)];
      if (u === 'boss') return W.has('boss-kill');
      return W.has(u);
    }
    return it.p === 0 || !!P().owned[idx];
  }
  function unlockText(it) {
    const u = it.unlock;
    if (u.startsWith('community:')) return 'Lås upp: communityutmaning';
    if (u === 'boss') return 'Lås upp: besegra en boss';
    return 'Lås upp: ' + (D.BADGES[u] ? D.BADGES[u].i + ' ' + D.BADGES[u].n : u);
  }
  function renderRoom(room, opts) {
    opts = opts || {};
    const grid = h('div', { class: 'room-grid', style: 'background:' + D.FLOORS[room.floor] });
    const wall = h('div', { class: 'room-wall', style: 'background:' + D.WALLS[room.wall] });
    if (opts.trophies) wall.appendChild(h('div', { class: 'shelf' }, opts.trophies.slice(0, 14).map((b) => h('span', { title: D.BADGES[b].n }, D.BADGES[b].i))));
    if (opts.posters) wall.appendChild(h('div', { class: 'posters' }, opts.posters.map((g) => h('img', { src: gameById[g].img, alt: gameById[g].name, title: 'Favoritspel: ' + gameById[g].name }))));
    if (opts.caption) wall.appendChild(h('div', { class: 'room-caption' }, opts.caption));
    for (let y = 0; y < RH; y++) for (let x = 0; x < RW; x++) {
      const it = room.items.find((i) => i[1] === x && i[2] === y);
      grid.appendChild(h('button', { type: 'button', class: 'cell', 'data-x': x, 'data-y': y, tabindex: opts.edit ? 0 : -1, 'aria-label': it ? D.ITEMS[it[0]].n : 'tom ruta', onclick: opts.onCell ? () => opts.onCell(x, y) : null }, it ? D.ITEMS[it[0]].e : ''));
    }
    return h('div', { class: 'room' }, wall, grid);
  }
  function favPosters() {
    const p = P().plays;
    return Object.keys(p).sort((a, b) => p[b] - p[a]).slice(0, 3).filter((g) => gameById[g]);
  }
  function openRoom() {
    const p = P();
    let sel = null;
    const view = h('div');
    const palette = h('div', { class: 'palette' });
    const info = h('p', { class: 'muted small' });
    function draw() {
      view.innerHTML = '';
      view.appendChild(renderRoom(p.room, { edit: true, trophies: Object.keys(p.badges), posters: favPosters(), onCell: cell }));
      palette.innerHTML = '';
      D.ITEMS.forEach((it, idx) => {
        const ok = itemUnlocked(it, idx);
        palette.appendChild(h('button', { type: 'button', class: 'pal' + (sel === idx ? ' sel' : '') + (ok ? '' : ' locked'), title: it.n + (ok ? '' : it.unlock ? ' – ' + unlockText(it) : ' – ' + it.p + ' 🪙'), onclick: () => choose(idx) },
          h('span', null, it.e), !ok ? h('small', null, it.unlock ? '🔒' : it.p + '🪙') : null));
      });
      info.textContent = sel === null ? 'Välj en sak nedanför och klicka i rummet för att ställa ut den. Klicka på en sak i rummet för att ta bort den. (' + p.room.items.length + '/' + MAXI + ' saker · ' + p.coins + ' 🪙)' : 'Placera: ' + D.ITEMS[sel].e + ' ' + D.ITEMS[sel].n + ' – klicka i rummet. (' + p.room.items.length + '/' + MAXI + ')';
    }
    function choose(idx) {
      const it = D.ITEMS[idx];
      if (!itemUnlocked(it, idx)) {
        if (it.unlock) { toast('🔒 ' + unlockText(it)); return; }
        if (p.coins < it.p) { toast('Du behöver ' + it.p + ' 🪙 (du har ' + p.coins + '). Samla mynt i världen!'); return; }
        if (!confirm('Köpa ' + it.e + ' ' + it.n + ' för ' + it.p + ' mynt?')) return;
        p.coins -= it.p; p.owned[idx] = 1; W.save(); toast('Köpt: ' + it.e + ' ' + it.n);
      }
      sel = idx; draw();
    }
    function cell(x, y) {
      const at = p.room.items.findIndex((i) => i[1] === x && i[2] === y);
      if (at >= 0) p.room.items.splice(at, 1);
      else if (sel !== null) {
        if (p.room.items.length >= MAXI) { toast('Rummet är fullt (' + MAXI + ' saker). Ta bort något först.'); return; }
        p.room.items.push([sel, x, y]);
      }
      W.save();
      if (p.room.items.length >= 5) W.award('room');
      draw();
    }
    const colors = h('div', { class: 'row' },
      h('label', null, 'Vägg ', h('span', { class: 'swatches' }, D.WALLS.map((c, i) => h('button', { type: 'button', class: 'sw', style: 'background:' + c, 'aria-label': 'Väggfärg ' + (i + 1), onclick: () => { p.room.wall = i; W.save(); draw(); } })))),
      h('label', null, 'Golv ', h('span', { class: 'swatches' }, D.FLOORS.map((c, i) => h('button', { type: 'button', class: 'sw', style: 'background:' + c, 'aria-label': 'Golvfärg ' + (i + 1), onclick: () => { p.room.floor = i; W.save(); draw(); } })))));
    draw();
    modal('🏠 Mitt spelrum', h('div', null, h('p', { class: 'lead' }, 'Inred ditt eget rum! Dina utmärkelser står på troféhyllan och dina favoritspel hänger på väggen. Lås upp fler saker genom att spela.'),
      view, info, colors, h('h3', null, 'Saker'), palette,
      h('div', { class: 'row' },
        btn('🏘️ Visa på Granngatan', () => W.needName(async () => { await W.insert('u:room:' + encodeRoom(p.room), Object.keys(p.badges).length * 100 + Math.min(99, W.level())); toast('🏘️ Ditt rum syns nu på Granngatan!', 'big'); }), 'big'),
        btn('📤 Dela mitt rum', () => W.needName(() => W.share('Mitt rum', '🏠 Kolla in mitt spelrum på Edwards och Johns spel!', W.SITE + '?room=' + encodeRoom(p.room) + '&by=' + encodeURIComponent(p.name))), 'ghost'))), { cls: 'wide' });
  }
  function visitRoom(code, owner, score) {
    const room = decodeRoom(code);
    const badges = score ? Math.floor(score / 100) : null, lvl = score ? score % 100 : null;
    if (!P().name || owner.toLowerCase() !== P().name.toLowerCase()) W.award('visitor');
    modal('🏠 ' + owner + 's rum', h('div', null,
      renderRoom(room, { caption: badges !== null ? '🏅 ' + badges + ' utmärkelser · Nivå ' + lvl : null }),
      h('div', { class: 'row' }, btn('👍 Snyggt rum!', () => { toast('Du gav ' + owner + ' en tumme upp 👍'); }, 'ghost'), btn('🏘️ Fler rum', openNeighbors, 'ghost'), btn('🏠 Inred ditt eget', openRoom))), { cls: 'wide' });
  }
  function openNeighbors() {
    const body = h('div');
    modal('🏘️ Granngatan', h('div', null, h('p', { class: 'lead' }, 'Här bor alla som har visat upp sitt rum. Knacka på och kika in!'), body), { cls: 'wide' });
    fill(body, async () => {
      const rows = await W.rows({ prefix: 'u:room:', limit: 300 });
      const seen = new Set();
      const homes = rows.filter((r) => { const k = r.name.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
      if (!homes.length) return h('p', { class: 'muted' }, 'Ingen har flyttat in än. Bli den första – gå till Mitt rum och tryck ”Visa på Granngatan”!');
      return h('div', { class: 'homes' }, homes.slice(0, 40).map((r) => {
        const code = r.board.slice(7);
        const room = decodeRoom(code);
        return h('button', { type: 'button', class: 'home-card', onclick: () => visitRoom(code, r.name, r.score) },
          h('span', { class: 'home-preview', style: 'background:linear-gradient(' + D.WALLS[room.wall] + ' 40%,' + D.FLOORS[room.floor] + ' 40%)' }, room.items.slice(0, 5).map((i) => D.ITEMS[i[0]].e).join('')),
          h('b', null, r.name), h('small', null, Math.floor(r.score / 100) + ' 🏅 · ' + W.ago(r.created_at)));
      }));
    });
  }

  // ================================================================== 4. Profile that evolves with you
  const HATS = [['', 1], ['🧢', 1], ['🎩', 2], ['👑', 6], ['🎓', 3], ['⛑️', 4], ['🪖', 5], ['🤠', 7], ['😎', 8], ['🦄', 10]];
  const COLORS = ['#5ee7ff', '#a970ff', '#ff7a3d', '#3dff8a', '#ffd23d', '#ff3d6e', '#e8ecff', '#3d9bff'];
  function openProfile() {
    const p = P();
    const ty = profileType();
    const lv = W.level();
    const cur = p.xp - W.levelXp(lv), need = W.levelXp(lv + 1) - W.levelXp(lv);
    const total = Object.values(p.cat).reduce((a, b) => a + b, 0) || 1;
    const cats = Object.keys(D.TYPES).map((k) => [k, p.cat[k] || 0]).sort((a, b) => b[1] - a[1]);
    const chal = todaysChallenges();
    if (p.pc.date !== W.today()) { p.pc = { date: W.today(), done: [] }; W.save(); }
    const nameInput = h('input', { value: p.name, maxlength: 12, placeholder: 'Ditt namn', 'aria-label': 'Ditt namn' });
    const areas = [
      ['🌈 Neonzonen', W.has('neon'), 'Spela 3 olika spel'],
      ['🕳️ ???', W.has('cave'), 'Något gömmer sig i skogen…'],
      ['🛸 Communitybelöningar', Object.keys(p.seenCommunity).length > 0, 'Klara en communityutmaning tillsammans'],
    ];
    modal('🧬 DNA-labbet – din spelprofil', h('div', { class: 'profile' },
      h('div', { class: 'prof-head' },
        h('div', { class: 'avatar', style: 'background:' + p.color }, p.hat || ty.i),
        h('div', null,
          h('form', { class: 'name-form', onsubmit: (e) => { e.preventDefault(); const n = W.cleanName(nameInput.value); if (!n) { toast('Välj ett annat namn'); return; } p.name = n; W.save(); toast('Sparat!'); } }, nameInput, h('button', { class: 'btn', type: 'submit' }, 'Spara')),
          h('p', { class: 'ptype' }, ty.i + ' ' + ty.t + ' · Nivå ' + lv + ' · ' + p.coins + ' 🪙'),
          h('div', { class: 'xpbar' }, h('div', { style: 'width:' + (cur / need) * 100 + '%' })), h('small', { class: 'muted' }, cur + ' / ' + need + ' XP till nivå ' + (lv + 1)))),
      h('div', { class: 'two' },
        h('div', null,
          h('h3', null, '🎯 Dagens personliga utmaningar'),
          h('ul', { class: 'pc' }, chal.map((c) => h('li', { class: p.pc.done.includes(c.id) ? 'done' : '' }, (p.pc.done.includes(c.id) ? '✅ ' : '⬜ ') + c.text))),
          h('h3', null, '🧬 Ditt spel-DNA'),
          h('div', { class: 'dna' }, cats.map(([k, v]) => h('div', { class: 'dna-row' }, h('span', null, D.TYPES[k].i + ' ' + (D.DISTRICTS[k] ? D.DISTRICTS[k].name : 'Minispel')), h('div', { class: 'bar' }, h('div', { style: 'width:' + (v / total) * 100 + '%' })), h('small', null, v)))),
          h('h3', null, '🗺️ Spelområden'),
          h('ul', { class: 'pc' }, areas.map(([n, ok, how]) => h('li', { class: ok ? 'done' : '' }, (ok ? '🔓 ' : '🔒 ') + n + (ok ? '' : ' – ' + how)))),
          h('h3', null, '🎨 Utseende'),
          h('div', { class: 'swatches' }, COLORS.map((c) => h('button', { type: 'button', class: 'sw' + (p.color === c ? ' sel' : ''), style: 'background:' + c, 'aria-label': 'Färg', onclick: () => { p.color = c; W.save(); openProfile(); } }))),
          h('div', { class: 'hats' }, HATS.map(([e, need]) => h('button', { type: 'button', class: 'pal' + (p.hat === e ? ' sel' : '') + (lv < need ? ' locked' : ''), title: lv < need ? 'Nivå ' + need : '', onclick: () => { if (lv < need) { toast('🔒 Låses upp på nivå ' + need); return; } p.hat = e; W.save(); openProfile(); } }, e || '🚫', lv < need ? h('small', null, 'Nv' + need) : null)))),
        h('div', null,
          h('h3', null, '🏅 Utmärkelser (' + Object.keys(p.badges).length + '/' + Object.keys(D.BADGES).length + ')'),
          h('div', { class: 'badges' }, Object.entries(D.BADGES).map(([id, b]) => {
            const got = p.badges[id];
            return h('div', { class: 'badge' + (got ? ' got' : ''), title: got || !b.secret ? b.n + ' – ' + b.d : 'Hemlig utmärkelse' }, h('span', null, got || !b.secret ? b.i : '❓'), h('small', null, got || !b.secret ? b.n : '???'));
          })),
          h('h3', null, '🧭 Artefakter (' + Object.keys(p.artifacts).length + '/8)'),
          h('div', { class: 'artifacts' }, D.ARTIFACTS.map((a) => h('span', { class: p.artifacts[a.id] ? 'got' : '' }, p.artifacts[a.id] ? a.e : '❔'))),
          h('h3', null, '📜 Din spelhistorik'),
          p.history.length ? h('ul', { class: 'history' }, p.history.slice(0, 14).map((x) => h('li', null,
            x.k === 'game' ? '▶️ ' + gameById[x.id].name : x.k === 'mystery' ? '🕵️ Löste dagens mysterium' : '🕹️ ' + (W.mini.GAMES[x.id] ? W.mini.GAMES[x.id].name : x.id) + (x.s !== undefined ? ' – ' + fmt(x.s) + ' p' : ''),
            h('small', null, W.ago(new Date(x.t).toISOString()))))) : h('p', { class: 'muted' }, 'Spela något så dyker det upp här!'),
          h('p', { class: 'muted small' }, '⚔️ Dueller: ' + p.duels.filter((d) => d.res === 'win').length + ' vinster, ' + p.duels.filter((d) => d.res === 'loss').length + ' förluster · 🎲 Surprise Me: ' + (p.roulette || 0) + ' klarade · 🔮 Hemligheter: ' + (p.secretsFound || 0) + '/' + D.SECRETS.length)))), { cls: 'wide' });
  }

  // ================================================================== Hall of fame (global leaderboards)
  function openFame() {
    const tabs = h('div', { class: 'tabs' });
    const body = h('div');
    const T = {
      boss: ['⚔️ Bosskämpar', async () => list(sumPerName(live.boss ? live.boss.rows : []), (s) => fmt(s) + ' skada', P().name)],
      mystery: ['🕵️ Detektiver', async () => list(bestPerName(await W.rows({ board: 'u:mystery:' + W.today(), limit: 300 })), (s) => s + ' p', P().name)],
      secrets: ['🔮 Hemlighetsjägare', async () => {
        const rows = await W.rows({ prefix: 'u:secret:', limit: 3000 });
        const m = {};
        rows.forEach((r) => { (m[r.name] = m[r.name] || new Set()).add(r.board); });
        const all = new Set(rows.map((r) => r.board)).size;
        return h('div', null, h('p', { class: 'muted' }, '🤝 Tillsammans har communityn hittat ' + all + ' av ' + D.SECRETS.length + ' hemligheter. Hjälp varandra att hitta resten!'),
          list(Object.entries(m).map(([name, s]) => ({ name, score: s.size })).sort((a, b) => b.score - a.score), (s) => s + ' 🔮', P().name));
      }],
      mini: ['🕹️ Minispel', async () => {
        const wrap = h('div', { class: 'two' });
        for (const m of W.mini.PUBLIC) {
          const rows = bestPerName(await W.rows({ board: 'u:mini:' + m, order: 'score.desc', limit: 100 }));
          wrap.appendChild(h('div', null, h('h4', null, W.mini.GAMES[m].icon + ' ' + W.mini.GAMES[m].name), list(rows.slice(0, 5), null, P().name)));
        }
        return wrap;
      }],
      games: ['🎮 Spelen', async () => {
        const wrap = h('div', { class: 'two' });
        for (const g of D.GAMES.filter((x) => x.board)) {
          const rows = bestPerName(await W.rows({ board: g.board, order: 'score.' + (g.low ? 'asc' : 'desc'), limit: 100 }), g.low);
          wrap.appendChild(h('div', null, h('h4', null, g.name), list(rows.slice(0, 5), (n) => fmtBoard(g.board, n), P().name)));
        }
        return wrap;
      }],
    };
    function show(k) {
      tabs.querySelectorAll('button').forEach((b) => b.classList.toggle('sel', b.dataset.k === k));
      fill(body, T[k][1]);
    }
    Object.entries(T).forEach(([k, v]) => tabs.appendChild(h('button', { type: 'button', class: 'chip', 'data-k': k, onclick: () => show(k) }, v[0])));
    modal('🏆 Hall of Fame – globala topplistor', h('div', null, tabs, body), { cls: 'wide' });
    show('boss');
  }

  // ================================================================== minigame arcade, terminal, cave, wish
  function openMini(m) {
    W.needName(() => {
      const box = modal(W.mini.GAMES[m].icon + ' ' + W.mini.GAMES[m].name, h('div', null, h('div', { id: 'mini-slot' }), h('div', { id: 'mini-lb' })), { sticky: true });
      fill(box.querySelector('#mini-lb'), async () => h('div', null, h('h3', null, 'Topplista'), list(bestPerName(await W.rows({ board: 'u:mini:' + m, order: 'score.desc', limit: 200 })).slice(0, 5), null, P().name)));
      W.mini.run(box.querySelector('#mini-slot'), m).then(async (s) => {
        if (s < 0) return;
        recordPlay('mini', m, s);
        W.addXp(20);
        W.addCoins(Math.max(1, Math.floor(s / 200)));
        await W.insert('u:mini:' + m, s);
        setTimeout(() => openMini(m), 1000);
      });
    }, 'Välj ett namn så att du hamnar på minispelens topplista.');
  }
  function openTerminal() {
    const out = h('pre', { class: 'term-out' }, 'EoJ-OS v2.026\nSkriv HJÄLP för hjälp.\n> ');
    const input = h('input', { class: 'term-in', autocomplete: 'off', spellcheck: 'false', autofocus: true, 'aria-label': 'Kommando' });
    const say = (t) => { out.textContent += t + '\n> '; out.scrollTop = 1e6; };
    const form = h('form', { onsubmit: (e) => {
      e.preventDefault();
      const cmd = input.value.trim().toUpperCase();
      input.value = '';
      out.textContent += cmd + '\n';
      if (D.CODES[cmd]) { const ok = W.award(D.CODES[cmd]); say(ok ? '*** ÅTKOMST BEVILJAD *** Hemlighet upplåst!' : 'Den koden har du redan använt.'); return; }
      const R = {
        'HJÄLP': 'Kommandon: HJÄLP, VEM, LEDTRÅD, HEMLIGHETER, RENSA. Eller skriv en hemlig kod.',
        HJALP: 'Kommandon: HJÄLP, VEM, LEDTRÅD, HEMLIGHETER, RENSA. Eller skriv en hemlig kod.',
        VEM: 'Den här världen byggdes av Edward och John.',
        LEDTRÅD: W.pick(W.rng(Date.now()), ['En skurk i ett äventyrsspel har ett namn på fyra bokstäver…', 'Utvecklare tittar ofta i konsolen (F12).', 'Källkoden säger mer än tusen ord.', 'Skogen i väst är tätare än den borde vara.', 'Vid världens sydöstra kant flyter något.', 'Den klassiska koden: ↑↑↓↓←→←→BA']),
        LEDTRAD: 'Prova med Å.',
        HEMLIGHETER: 'Du har hittat ' + (P().secretsFound || 0) + ' av ' + D.SECRETS.length + ' hemligheter.',
      };
      if (cmd === 'RENSA') { out.textContent = '> '; return; }
      say(R[cmd] || 'Okänt kommando.');
    } }, input);
    modal('💻 Terminalen', h('div', { class: 'term' }, out, form));
  }
  function openCave() {
    W.award('cave');
    modal('🕳️ Den hemliga grottan', h('div', null,
      h('p', { class: 'lead' }, 'Du klämde dig igenom snåren och hittade en gammal arkadmaskin som ingen vet om. På skärmen blinkar ett spel…'),
      h('div', { id: 'mini-slot' })), { sticky: true });
    W.mini.run($('#mini-slot'), 'pong').then((s) => {
      if (s < 0) return;
      const won = $('.mini-wrap') && $('.mini-wrap').dataset.won;
      if (won) { W.award('pong'); W.addCoins(15); }
      W.insert('u:mini:pong', s);
      setTimeout(openCave, 1100);
    });
  }
  function openWish() {
    modal('⛲ Önskebrunnen', h('div', null, h('p', null, 'Det sägs att den som kastar ett mynt i fontänen får tur… Vill du kasta ett mynt?'),
      h('div', { class: 'row' }, btn('🪙 Kasta ett mynt', () => {
        if (P().coins < 1) { toast('Du har inga mynt!'); return; }
        W.addCoins(-1, true);
        closeModal();
        const lucky = Math.random() < 0.25;
        if (lucky) { W.addCoins(5); toast('✨ Fontänen gnistrar… Tur! +5 🪙', 'big'); } else toast('*plask* 💧');
        W.award('wish');
      }, 'big'), btn('Nej tack', () => closeModal(), 'ghost'))));
  }

  // ================================================================== all games (list for quick access + mobile)
  function openAll() {
    modal('📋 Alla spel', h('div', null,
      h('p', { class: 'muted' }, 'Klicka för att spela – eller ”Gå dit” för att besöka byggnaden i världen.'),
      h('div', { class: 'all-games' }, D.GAMES.map((g) => h('div', { class: 'ag' },
        h('img', { src: g.img, alt: '', loading: 'lazy' }),
        h('div', null, h('b', null, g.name), h('small', null, g.tag + (g.desktop ? ' · 🖥️ dator' : '')),
          h('div', { class: 'row' }, btn('▶ Spela', () => play(g), 'chip'), btn('🚶 Gå dit', () => { closeModal(); W.world.teleport(g.id); }, 'chip ghost')))))),
      h('h3', null, 'Platser'),
      h('div', { class: 'row wrap' }, [['mystery', '🕵️ Mysterietornet'], ['boss', '👹 Bossarenan'], ['roulette', '🎲 Lyckohjulet'], ['duel', '⚔️ Duellhallen'], ['feed', '📺 Live-tavlan'], ['community', '🎯 Monumentet'], ['profile', '🧬 DNA-labbet'], ['home', '🏠 Mitt rum'], ['neighbors', '🏘️ Granngatan'], ['fame', '🏆 Hall of Fame']]
        .map(([id, n]) => btn(n, () => { closeModal(); W.world.teleport(id); }, 'chip')))), { cls: 'wide' });
  }

  // ================================================================== routing: walking into a building
  W.on('enter', (s) => {
    if ((s.id.startsWith('mini:') || s.id === 'terminal') && W.world.state.neonLocked) { toast('🔒 Neonzonen öppnar när du har spelat 3 olika spel (' + Object.keys(P().plays).length + '/3)'); return; }
    if (s.type === 'game') return openGame(s.game);
    if (s.id.startsWith('mini:')) return openMini(s.id.slice(5));
    ({ mystery: openMystery, boss: openBoss, roulette: () => roulette(), feed: openFeed, community: openCommunity, duel: openDuel, profile: openProfile, home: openRoom, neighbors: openNeighbors, fame: openFame, terminal: openTerminal, cave: openCave, wish: openWish }[s.id] || (() => {}))();
  });

  W.ui = { refresh, openGame, openMystery, openBoss, roulette, rouletteBanner, openFeed, openCommunity, openDuel, acceptDuel, openRoom, visitRoom, openNeighbors, openProfile, openFame, openAll, recordPlay, checkChallenges, mysteryState, cluesNow, profileType };
})();
