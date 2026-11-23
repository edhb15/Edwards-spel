// Everything that opens when you walk into a building: games, mystery, boss, roulette, duels, rooms, profile …
(function () {
  'use strict';
  const { D, h, $, modal, closeModal, toast, fmt } = W;
  const P = () => W.profile;
  const gameById = {};
  D.GAMES.forEach((g) => (gameById[g.id] = g));
  function fmtBoard(board, n) {
    const u = (D.BOARDS[board.split(':')[0]] || {}).unit;
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
  const live = { week: null, weekRows: [], feed: [], boss: null, community: null, playing: {}, tops: {}, me: {}, history: [] };
  W.live = live;

  // ---------------------------------------------------------------- damage: every game you play hurts the boss
  const clampD = (v) => Math.max(100, Math.min(2500, Math.round(v)));
  const mysteryCache = {};
  function mysteryOn(day) {
    if (!mysteryCache[day]) mysteryCache[day] = W.pick(W.rng(W.hash(day + ':mystery')), D.GAMES).id;
    return mysteryCache[day];
  }
  function rowDamage(r) {
    if (r._d !== undefined) return r._d;
    return (r._d = calcDamage(r));
  }
  function calcDamage(r) {
    const b = r.board;
    let d = 0, g = null;
    if (b.startsWith('u:time:')) { g = b.slice(7); d = (Math.min(r.score, 300) * 100) / 120; }
    else if (b.startsWith('u:res:')) {
      const info = D.BOARDS[b.slice(6).split(':')[0]];
      g = info ? info.g : null;
      d = clampD(info ? info.dmg(r.score) : 100 + Math.sqrt(r.score) * 5);
    } else if (b.startsWith('u:play:')) { g = b.slice(7); d = 50; }
    else return 0;
    if (g && mysteryOn(W.dayOf(r.created_at)) === g) d *= 2;
    return Math.round(d);
  }
  const isDamageRow = (r) => /^u:(time|res|play):/.test(r.board);

  // ---------------------------------------------------------------- bosses: a new one when the old dies, the boss wins after a week
  // The current boss is remembered with a row "u:boss-n:<number>:<start in seconds>:<k = previous was killed | w = previous won>".
  function bossOf(n) { return Object.assign({ n }, D.BOSSES[(n - 1) % D.BOSSES.length]); }
  function parseMarker(r) {
    const p = r.board.split(':');
    return { n: +p[2], start: +p[3] * 1000, prev: p[4] || '' };
  }
  let markers = [];
  async function computeBoss(rowsSince) {
    let cur = markers.reduce((a, m) => (!a || m.n > a.n ? m : a), null) || { n: 1, start: D.BOSS_EPOCH, prev: '' };
    const dmgRows = rowsSince.filter(isDamageRow);
    const stored = cur.n;
    const ended = [];
    for (let guard = 0; guard < 60; guard++) {
      const end = cur.start + D.BOSS_WEEK, hp = D.bossHp(cur.n);
      let acc = 0, killAt = null;
      const per = {}, lastPlay = {};
      for (const r of dmgRows) {
        const t = Date.parse(r.created_at);
        if (t < cur.start || t >= end) continue;
        if (r.board.startsWith('u:play:')) { // starting the same game over and over doesn't count
          const k = r.name.toLowerCase() + r.board;
          if (lastPlay[k] && t - lastPlay[k] < 600e3) continue;
          lastPlay[k] = t;
        }
        const d = rowDamage(r);
        acc += d;
        per[r.name] = (per[r.name] || 0) + d;
        if (acc >= hp) { killAt = t; break; }
      }
      const st = Object.assign(bossOf(cur.n), { start: cur.start, end, max: hp, hp: Math.max(0, hp - acc), dmg: acc, per, prev: cur.prev });
      if (killAt !== null) { ended.push(Object.assign(st, { result: 'k', endedAt: killAt })); cur = { n: cur.n + 1, start: Math.ceil((killAt + 1) / 1000) * 1000, prev: 'k' }; continue; }
      if (Date.now() >= end) { ended.push(Object.assign(st, { result: 'w', endedAt: end })); cur = { n: cur.n + 1, start: end, prev: 'w' }; continue; }
      live.boss = st;
      break;
    }
    if (cur.n !== stored) {
      // tell everyone a new boss has arrived (same row from every browser – the start time decides)
      W.insert('u:boss-n:' + cur.n + ':' + Math.floor(cur.start / 1000) + ':' + cur.prev, cur.n, 'Världen');
      markers.push(cur);
    }
    // rewards for this player
    const me = (P().name || '').toLowerCase();
    const myBoss = P().bossDmg || (P().bossDmg = {});
    ended.concat([live.boss]).forEach((b) => {
      const mine = Object.entries(b.per).filter(([n]) => n.toLowerCase() === me).reduce((a, [, v]) => a + v, 0);
      if (mine > 0 && me) myBoss[b.n] = Math.max(myBoss[b.n] || 0, mine);
    });
    ended.forEach((b) => {
      if (myBoss[b.n] && !(P().bossDone || {})[b.n]) {
        P().bossDone = Object.assign(P().bossDone || {}, { [b.n]: b.result });
        if (b.result === 'k') { W.award('boss-kill'); W.addCoins(20, true); toast('👑 ' + b.name + ' är besegrad – och du var med! +20 🪙', 'big'); }
        else toast('😈 ' + b.name + ' vann den här gången. En ny boss har dykt upp!', 'big');
      }
    });
    if (myBoss[live.boss.n]) W.award('boss');
    W.save();
    live.history = ended;
  }
  // past bosses for the boss panel (from the saved rows)
  function bossHistory() {
    const starts = { 1: D.BOSS_EPOCH }, prevs = {};
    markers.forEach((m) => { if (!starts[m.n] || m.start < starts[m.n]) { starts[m.n] = m.start; prevs[m.n] = m.prev; } });
    live.history.forEach((b) => { starts[b.n] = b.start; prevs[b.n + 1] = b.result; starts[b.n + 1] = b.result === 'k' ? Math.ceil((b.endedAt + 1) / 1000) * 1000 : b.end; });
    const out = [];
    for (let n = live.boss.n - 1; n >= 1 && out.length < 6; n--) {
      if (!prevs[n + 1]) continue;
      out.push({ boss: bossOf(n), result: prevs[n + 1], took: starts[n] && starts[n + 1] ? starts[n + 1] - starts[n] : null });
    }
    return out;
  }

  function communityDef() { return D.COMMUNITY[W.weekInfo().num % D.COMMUNITY.length]; }

  async function refresh() {
    const wk = W.weekInfo();
    live.week = wk;
    markers = (await W.rows({ prefix: 'u:boss-n:', order: 'created_at.desc', limit: 80 })).map(parseMarker).filter((m) => m.n > 0 && m.start > 0);
    const cur = markers.reduce((a, m) => (!a || m.n > a.n ? m : a), null) || { start: D.BOSS_EPOCH };
    const since = new Date(Math.min(cur.start, Date.parse(wk.start), Date.now() - 86400e3)).toISOString();
    const [rows, feed] = await Promise.all([W.rows({ prefix: 'u:', since, order: 'created_at.asc', limit: 8000 }), W.rows({ limit: 150 })]);
    await computeBoss(rows);
    W.world.setBoss(live.boss);
    const weekRows = rows.filter((r) => r.created_at >= wk.start);
    live.weekRows = weekRows;
    live.feed = feed.filter((r) => !r.board.startsWith('u:time:'));
    // world heat (this week) and who is playing right now (last 5 minutes)
    const heat = {}, playing = {}, now = Date.now();
    weekRows.forEach((r) => {
      const m = r.board.match(/^u:(play|time):(.+)$/);
      if (!m) return;
      heat[m[2]] = (heat[m[2]] || 0) + 1;
      if (now - Date.parse(r.created_at) < 5 * 60e3) (playing[m[2]] = playing[m[2]] || new Set()).add(r.name.toLowerCase());
    });
    const lvl = {}, crowd = {};
    for (const g in heat) lvl[g] = heat[g] >= 40 ? 3 : heat[g] >= 12 ? 2 : 1;
    live.playing = {};
    for (const g in playing) { live.playing[g] = playing[g].size; crowd[g] = Math.min(8, playing[g].size); }
    W.world.setHeat(lvl, crowd);
    // my stats today (for personal challenges)
    const me = (P().name || '').toLowerCase(), dayStart = W.dayStartIso();
    const mine = rows.filter((r) => me && r.name.toLowerCase() === me && r.created_at >= dayStart);
    live.me = {
      dmg: mine.reduce((a, r) => a + rowDamage(r), 0),
      time: mine.filter((r) => r.board.startsWith('u:time:')).reduce((a, r) => a + r.score, 0),
      results: mine.filter((r) => r.board.startsWith('u:res:')).length,
    };
    const myTime = rows.filter((r) => me && r.name.toLowerCase() === me && r.board.startsWith('u:time:')).reduce((a, r) => a + r.score, 0);
    if (myTime > (P().playTime || 0)) { P().playTime = myTime; W.save(); }
    if ((P().playTime || 0) >= 3600) W.award('marathon');
    checkChallenges({ kind: 'live' });
    // community challenge
    const c = communityDef();
    const u = (p) => weekRows.filter((r) => r.board.startsWith(p));
    let value = 0;
    if (c.metric === 'damage') value = weekRows.filter(isDamageRow).reduce((a, r) => a + rowDamage(r), 0);
    if (c.metric === 'plays') value = u('u:play:').length;
    if (c.metric === 'games') value = new Set(u('u:play:').concat(u('u:time:')).map((r) => r.board.split(':')[2])).size;
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
    await loadTops();
    buildFeed();
    W.emit('live');
  }

  // best score per game, shown under each building's sign
  let topsAt = 0;
  async function loadTops() {
    if (Date.now() - topsAt < 120e3) return;
    topsAt = Date.now();
    const withBoard = D.GAMES.filter((g) => g.board);
    const res = await Promise.all(withBoard.map((g) => W.rows({ board: g.board, order: 'score.' + (g.low ? 'asc' : 'desc'), limit: 1 })));
    withBoard.forEach((g, i) => { const r = res[i][0]; if (r) live.tops[g.id] = '🏆 ' + r.name + ' · ' + fmtBoard(g.board, r.score); });
  }

  function rowTarget(r) {
    const b = r.board;
    if (b.startsWith('u:play:') || b.startsWith('u:time:')) return b.split(':')[2];
    if (b.startsWith('u:res:')) { const i = D.BOARDS[b.slice(6).split(':')[0]]; return i ? i.g : 'feed'; }
    if (b.startsWith('u:boss')) return 'boss';
    if (b.startsWith('u:mystery:')) return 'mystery';
    if (b.startsWith('u:duel:')) return 'duel';
    if (b.startsWith('u:room:')) return 'neighbors';
    if (b.startsWith('u:roulette')) return 'roulette';
    if (b.startsWith('u:')) return 'feed';
    return (D.BOARDS[b.split(':')[0]] || {}).g || 'feed';
  }
  function rowText(r, best) {
    const b = r.board, n = r.name;
    const gname = (id) => (gameById[id] || {}).name || 'ett spel';
    if (b.startsWith('u:play:')) return '▶️ ' + n + ' började spela ' + gname(b.slice(7));
    if (b.startsWith('u:res:')) {
      const key = b.slice(6), info = D.BOARDS[key.split(':')[0]];
      return '🏁 ' + n + ' fick ' + fmtBoard(key, r.score) + ' i ' + gname(info && info.g) + ' – ⚔️ ' + fmt(rowDamage(r)) + ' skada på bossen';
    }
    if (b.startsWith('u:boss-n:')) {
      const m = parseMarker(r), prev = bossOf(m.n - 1), next = bossOf(m.n);
      return (m.prev === 'k' ? '👑 ' + prev.name + ' är besegrad! ' : '😈 ' + prev.name + ' vann veckan. ') + next.icon + ' ' + next.name + ' har dykt upp!';
    }
    if (b.startsWith('u:mystery:')) return '🕵️ ' + n + ' löste dagens mysterium!';
    if (b.startsWith('u:secret:')) return '🔮 ' + n + ' hittade en hemlighet!';
    if (b.startsWith('u:duel:')) return '⚔️ ' + n + ' är med i en duell';
    if (b.startsWith('u:room:')) return '🏠 ' + n + ' visar upp sitt rum på Granngatan';
    if (b.startsWith('u:pc')) return '🎯 ' + n + ' klarade en personlig utmaning';
    if (b.startsWith('u:roulette')) return '🎲 ' + n + ' klarade en Surprise Me-utmaning';
    if (b.startsWith('u:')) return null;
    if (!best) return null; // saved leaderboard scores are already shown as results – only records get their own line
    return '🏆 NYTT REKORD! ' + n + ' fick ' + fmtBoard(b, r.score) + ' i ' + gname((D.BOARDS[b.split(':')[0]] || {}).g);
  }
  const recordCache = {};
  async function buildFeed() {
    const rows = live.feed;
    const boards = [...new Set(rows.filter((r) => !r.board.startsWith('u:')).map((r) => r.board))].slice(0, 5);
    await Promise.all(boards.map(async (b) => {
      if (recordCache[b] && Date.now() - recordCache[b].t < 120e3) return;
      const low = !!(D.BOARDS[b.split(':')[0]] || {}).low;
      const top = await W.rows({ board: b, order: 'score.' + (low ? 'asc' : 'desc'), limit: 1 });
      recordCache[b] = { t: Date.now(), best: top[0] };
    }));
    const lines = [];
    Object.entries(live.playing).sort((a, b) => b[1] - a[1]).slice(0, 2).forEach(([g, c]) => {
      if (gameById[g]) lines.push({ text: '🟢 ' + c + (c === 1 ? ' person spelar ' : ' personer spelar ') + gameById[g].name + ' just nu', t: new Date().toISOString(), hot: true });
    });
    const seenDuel = new Set();
    rows.forEach((r) => {
      if (r.board.startsWith('u:duel:')) { const k = r.name + r.board.split(':')[2]; if (seenDuel.has(k)) return; seenDuel.add(k); }
      const rec = recordCache[r.board] && recordCache[r.board].best;
      const isBest = rec && rec.name === r.name && rec.score === r.score && rec.created_at === r.created_at;
      const text = rowText(r, isBest);
      if (text) lines.push({ text, t: r.created_at, best: isBest });
    });
    live.lines = lines.slice(0, 60);
    W.feedLines = live.lines.map((l) => l.text);
    // other players walk around where they are playing right now
    const g = [], seen = new Set();
    live.weekRows.slice().reverse().concat(rows).forEach((r) => {
      if (Date.now() - Date.parse(r.created_at) > 20 * 60e3) return;
      if (r.name === 'Världen' || r.name === 'Anonym') return;
      if (P().name && r.name.toLowerCase() === P().name.toLowerCase()) return;
      if (seen.has(r.name)) return;
      seen.add(r.name);
      g.push({ name: r.name, target: rowTarget(r) });
    });
    W.world.setGhosts(g);
    W.emit('feed', lines);
  }

  // ================================================================== personal profile: play history, challenges
  function recordPlay(kind, id) {
    const p = P();
    p.history.unshift({ k: kind, id, t: Date.now() });
    p.history = p.history.slice(0, 60);
    if (kind === 'game') {
      p.plays[id] = (p.plays[id] || 0) + 1;
      const d = gameById[id].d;
      p.cat[d] = (p.cat[d] || 0) + 1;
      p.lastGame = id;
    }
    W.save();
    W.award('community');
    const n = Object.keys(p.plays).length;
    if (kind === 'game') W.award('first-game');
    if (n >= 5) W.award('variety');
    if (n >= D.GAMES.length) W.award('all-games');
    checkChallenges({ kind, id });
  }
  function favCat() {
    const c = P().cat;
    const best = Object.keys(c).filter((k) => D.TYPES[k]).sort((a, b) => c[b] - c[a])[0];
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
    const cat = fav && D.DISTRICTS[fav] ? fav : W.pick(r, ['fart', 'action', 'hjarna', 'skola']);
    out.push({ id: 'cat', type: 'play-cat', cat, text: 'Spela ett spel i ' + D.DISTRICTS[cat].name + (fav === cat ? ' – ditt favoritområde' : '') });
    if (never.length) { const g = W.pick(r, never); out.push({ id: 'new', type: 'play', game: g.id, text: 'Testa ' + g.name + ' – du har aldrig spelat det!' }); }
    else { const g = W.pick(r, D.GAMES); out.push({ id: 'new', type: 'play', game: g.id, text: 'Spela ' + g.name + ' igen' }); }
    const dmg = 600 + Math.min(20, W.level()) * 100;
    out.push(W.pick(r, [
      { id: 'boss', type: 'dmg', n: dmg, text: 'Gör minst ' + fmt(dmg) + ' skada på bossen idag (genom att spela)' },
      { id: 'boss', type: 'time', n: 600, text: 'Spela i minst 10 minuter idag' },
    ]));
    out.push(W.pick(r, [
      { id: 'x', type: 'result', text: 'Få ett resultat i ett spel med topplista (t.ex. Stunt Rider eller Ski to Death)' },
      { id: 'x', type: 'mystery', text: 'Lös dagens mysterium' },
      { id: 'x', type: 'coins', n: 10, text: 'Samla 10 mynt i världen idag' },
    ]));
    return out;
  }
  function checkChallenges(ev) {
    const p = P();
    if (p.pc.date !== W.today()) p.pc = { date: W.today(), done: [] };
    const me = live.me || {};
    todaysChallenges().forEach((c) => {
      if (p.pc.done.includes(c.id)) return;
      let ok = false;
      if (c.type === 'play-cat' && ev.kind === 'game' && gameById[ev.id].d === c.cat) ok = true;
      if (c.type === 'play' && ev.kind === 'game' && ev.id === c.game) ok = true;
      if (c.type === 'dmg' && (me.dmg || 0) >= c.n) ok = true;
      if (c.type === 'time' && (me.time || 0) >= c.n) ok = true;
      if (c.type === 'result' && (me.results || 0) > 0) ok = true;
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
    const now = live.playing[g.id] || 0;
    const b = live.boss;
    const mysteryBoost = mysteryState().solved && mysteryGame().id === g.id;
    const body = h('div', { class: 'gm' },
      h('div', { class: 'gm-media' }, video, now ? h('span', { class: 'gm-live' }, '🟢 ' + now + ' spelar nu') : null),
      h('div', { class: 'gm-info' },
        h('div', { class: 'tags' }, h('span', { class: 'tag' }, g.tag), h('span', { class: 'tag alt' }, D.DISTRICTS[g.d].icon + ' ' + D.DISTRICTS[g.d].name), g.desktop ? h('span', { class: 'tag warn' }, '🖥️ Endast för dator') : null),
        h('p', null, g.desc),
        h('a', { class: 'btn big play-big', href: g.url, onclick: (e) => { e.preventDefault(); play(g); } }, '▶ Spela ' + g.name),
        b ? h('div', { class: 'boss-hint' }, h('span', { class: 'bh-icon' }, b.icon),
          h('span', null, h('b', null, 'Skada ' + b.name + ' genom att spela! '), 'Varannan minut du spelar = 100 skada' + (g.board ? ', och varje resultat ger upp till 2 500 skada.' : '.') + (mysteryBoost ? ' 🕵️ Dagens mysteriespel – DUBBEL skada idag!' : ''))) : null,
        h('p', { class: 'muted small' }, p.plays[g.id] ? 'Du har spelat det ' + p.plays[g.id] + ' gång' + (p.plays[g.id] > 1 ? 'er' : '') + '.' : 'Du har aldrig spelat det – +30 XP första gången!'),
        h('div', { class: 'row' },
          btn('🎲 Slumpa en utmaning', () => roulette(g.id)),
          g.board ? btn('⚔️ Utmana en kompis', () => openDuel(g.id), 'ghost') : null,
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
          h('div', { class: 'row' }, h('a', { class: 'btn', href: g.url, onclick: (e) => { e.preventDefault(); play(g); } }, '▶ Spela ' + g.name)), h('p', { class: 'muted small' }, '⚔️ Idag gör ' + g.name + ' DUBBEL skada på bossen!')));
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
        if (window.W.live) W.ui.refresh();
        checkChallenges({ kind: 'mystery' });
        await W.insert('u:mystery:' + W.today(), pts);
        const first = await W.rows({ board: 'u:mystery:' + W.today(), order: 'created_at.asc', limit: 1 });
        if (first[0] && first[0].name.toLowerCase() === P().name.toLowerCase()) { ms.rank = 1; W.save(); W.award('detective'); }
        toast('🕵️ Rätt! Det var ' + g.name, 'big');
        render();
        loadBoard();
      }, 'Välj ett namn så att du hamnar på dagens topplista.');
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
      h('p', { class: 'lead' }, 'Varje dag finns ett hemligt spel – samma för alla. Ledtrådar släpps under dagen. Den som löser det först får en speciell utmärkelse – och dagens mysteriespel gör dubbel skada på bossen!'),
      h('div', { class: 'two' }, h('div', null, h('h3', null, 'Ledtrådar'), clues, status, guess), h('div', null, h('h3', null, 'Dagens topplista'), board))), { cls: 'wide' });
  }

  // ================================================================== 3. Boss battle – fought by playing the games
  const dur = (ms) => {
    const d = Math.floor(ms / 86400e3), hh = Math.floor((ms % 86400e3) / 3600e3), mm = Math.floor((ms % 3600e3) / 60e3);
    return d ? d + ' d ' + hh + ' h' : hh ? hh + ' h ' + mm + ' min' : mm + ' min';
  };
  function openBoss() {
    const b = live.boss;
    if (!b) { toast('Bossen laddas…'); return; }
    const left = Math.max(0, b.end - Date.now());
    const meName = (P().name || '').toLowerCase();
    const mine = Object.entries(b.per).filter(([n]) => n.toLowerCase() === meName).reduce((a, [, v]) => a + v, 0);
    const fighters = Object.keys(b.per).filter((n) => n !== 'Anonym').length;
    const hist = bossHistory();
    const quick = D.GAMES.slice().sort((x, y) => (live.playing[y.id] || 0) - (live.playing[x.id] || 0) || (P().plays[y.id] || 0) - (P().plays[x.id] || 0)).slice(0, 6);
    modal(b.icon + ' Boss #' + b.n + ': ' + b.name, h('div', null,
      h('p', { class: 'lead' }, b.desc + ' Alla slåss mot samma boss – genom att spela spelen. Besegra den innan veckan är slut, annars vinner bossen!'),
      h('div', { class: 'hp' }, h('div', { class: 'hp-fill', style: 'width:' + Math.max(1, (b.hp / b.max) * 100) + '%' }), h('span', null, fmt(b.hp) + ' / ' + fmt(b.max) + ' HP')),
      h('div', { class: 'stats' },
        h('div', null, h('b', null, dur(left)), 'tills bossen vinner'),
        h('div', null, h('b', null, fighters), 'spelare har slagits'),
        h('div', null, h('b', null, fmt(mine)), 'din skada')),
      h('h3', null, '⚔️ Så skadar du bossen'),
      h('ul', { class: 'how' },
        h('li', null, h('b', null, 'Spela vilket spel som helst: '), 'varannan minut du spelar = 100 skada'),
        h('li', null, h('b', null, 'Få ett resultat: '), 'varje resultat i Stunt Rider, Ski to Death, Smita från ledet, Teacher Meltdown och Impossible Rooms ger 100–2 500 skada'),
        h('li', null, h('b', null, 'Dagens mysteriespel '), 'gör dubbel skada (lös mysteriet för att veta vilket det är)'),
        h('li', null, 'När bossen dör kommer en ny direkt. Alla som var med får 👑 och 20 🪙.')),
      h('div', { class: 'quick-games' }, quick.map((g) => h('button', { type: 'button', class: 'qg', onclick: () => openGame(g) },
        h('img', { src: g.img, alt: '' }), h('span', null, g.name), live.playing[g.id] ? h('small', null, '🟢 ' + live.playing[g.id] + ' spelar') : null))),
      h('div', { class: 'two' },
        h('div', null, h('h3', null, '🏅 Bosskämpar'), list(Object.entries(b.per).map(([name, score]) => ({ name, score })).sort((x, y) => y.score - x.score), (s) => fmt(s) + ' skada', P().name)),
        h('div', null, h('h3', null, '📜 Tidigare bossar'), hist.length ? h('ul', { class: 'history' }, hist.map((x) => h('li', null,
          h('span', null, x.boss.icon + ' #' + x.boss.n + ' ' + x.boss.name), h('small', null, x.result === 'k' ? '👑 besegrad' + (x.took ? ' på ' + dur(x.took) : '') : '😈 vann veckan')))) : h('p', { class: 'muted' }, 'Det här är den första bossen!')))), { cls: 'wide' });
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
      h('ul', null, h('li', null, 'Spela spelen – speltid och resultat räknas'), h('li', null, 'Varje spel du startar från världen räknas'), h('li', null, 'Mysteriet och hemligheterna räknas också'))));
  }

  // ================================================================== 7. Duels – in the real games
  // Both players play the same game(s) within 48 hours. Best result each wins. The games send their
  // results themselves (u:res:<board>), so you don't even have to save to the leaderboard.
  const DUEL_MS = 48 * 3600e3;
  const DUEL_GAMES = () => D.GAMES.filter((g) => g.board);
  const FORMATS = {
    one: { n: 'Bäst i ett spel', d: 'Välj ett spel – bästa resultatet inom 48 timmar vinner.' },
    bo3: { n: 'Bäst av tre', d: 'Stunt Rider, Ski to Death och Smita från ledet – vinn flest av tre.', games: ['stunt', 'ski', 'smita'] },
  };
  function duelName(d) { return d.fmt === 'bo3' ? 'Bäst av tre' : 'Bäst i ' + ((gameById[d.games[0]] || {}).name || 'spelet'); }
  function openDuel(preGame) {
    const p = P();
    p.duels = p.duels.filter((d) => Array.isArray(d.games));
    const wins = p.duels.filter((d) => d.res === 'win').length, losses = p.duels.filter((d) => d.res === 'loss').length;
    const rivals = {};
    const wk = W.weekInfo();
    p.duels.filter((d) => d.opp && d.t > Date.parse(wk.start)).forEach((d) => { rivals[d.opp] = rivals[d.opp] || { n: 0, w: 0, l: 0 }; rivals[d.opp].n++; if (d.res === 'win') rivals[d.opp].w++; if (d.res === 'loss') rivals[d.opp].l++; });
    const rival = Object.entries(rivals).sort((a, b) => b[1].n - a[1].n)[0];
    const mine = h('div');
    const pick = h('div', { class: 'quick-games' }, DUEL_GAMES().map((g) => h('button', { type: 'button', class: 'qg' + (preGame === g.id ? ' sel' : ''), onclick: () => W.needName(() => startDuel('one', [g.id])) },
      h('img', { src: g.img, alt: '' }), h('span', null, g.name), h('small', null, g.low ? '⏱ snabbast vinner' : '🏆 högst vinner'))));
    modal('⚔️ Duellhallen', h('div', null,
      h('p', { class: 'lead' }, 'Utmana en kompis i ett riktigt spel! Ni har 48 timmar på er – bästa resultatet vinner. Resultaten syns på er profil.'),
      h('div', { class: 'stats' }, h('div', null, h('b', null, wins), 'vinster'), h('div', null, h('b', null, losses), 'förluster'), h('div', null, h('b', null, p.duels.length), 'dueller')),
      h('div', { class: 'rival' }, '🔥 Veckans rivalitet: ', rival ? h('span', null, h('b', null, rival[0]), ' – ' + rival[1].w + '–' + rival[1].l + ' den här veckan') : h('span', { class: 'muted' }, 'Spela en duell så får du en rival!')),
      h('h3', null, '🎮 Bäst i ett spel – välj spel'), pick,
      h('div', { class: 'row' }, btn('🏆 Bäst av tre (Stunt Rider, Ski to Death, Smita)', () => W.needName(() => startDuel('bo3', FORMATS.bo3.games)), 'chip')),
      h('h3', null, 'Dina dueller'), mine), { cls: 'wide' });
    fill(mine, async () => {
      if (!p.duels.length) return h('p', { class: 'muted' }, 'Inga dueller än.');
      await Promise.all(p.duels.slice(0, 8).filter((d) => !d.res).map(updateDuel));
      return h('ul', { class: 'duel-list' }, p.duels.slice(0, 10).map((d) => h('li', null,
        h('span', null, { win: '🥇', loss: '😵', draw: '🤝' }[d.res] || '⏳'), ' ', h('b', null, duelName(d)), ' ',
        d.opp ? h('span', null, 'mot ', h('b', null, d.opp)) : h('span', { class: 'muted' }, '– väntar på motståndare'),
        d.score ? h('span', { class: 'muted' }, ' · ' + d.score) : null,
        !d.res && d.end ? h('span', { class: 'muted' }, ' · slutar om ' + dur(Math.max(0, d.end - Date.now()))) : null,
        !d.res ? h('span', { class: 'row' }, d.games.map((g) => btn('▶ ' + gameById[g].name, () => play(gameById[g]), 'chip')), !d.opp ? btn('📤 Skicka länken', () => shareDuel(d), 'chip ghost') : null) : null)));
    });
  }
  function duelLink(d) { return W.SITE + '?duel=' + d.code + '.' + d.fmt + '.' + d.games.join('-') + '&from=' + encodeURIComponent(P().name || ''); }
  function shareDuel(d) {
    W.share('Duell', '⚔️ ' + P().name + ' utmanar dig: ' + duelName(d) + '! Bästa resultatet inom 48 timmar vinner.', duelLink(d));
  }
  async function startDuel(fmtId, games) {
    const code = Math.random().toString(36).slice(2, 8);
    const d = { code, fmt: fmtId, games, t: Date.now(), creator: true };
    await W.insert('u:duel:' + code + ':' + fmtId + ':' + games.join(','), 0);
    P().duels.unshift(d); P().duels = P().duels.slice(0, 40); W.save();
    W.award('duel'); W.addXp(30);
    modal('⚔️ Duellen är skapad!', h('div', null,
      h('p', { class: 'lead' }, h('b', null, duelName(d)), ' – skicka länken till en kompis. Sedan har ni 48 timmar på er.'),
      h('p', null, 'Spela spelet och få ett så bra resultat som möjligt. Resultaten räknas automatiskt (du behöver inte ens spara på topplistan).'),
      h('div', { class: 'row' }, btn('📤 Skicka utmaningen', () => shareDuel(d), 'big'), ...games.map((g) => btn('▶ Spela ' + gameById[g].name, () => play(gameById[g]), 'ghost')))));
  }
  async function updateDuel(d) {
    const marks = await W.rows({ prefix: 'u:duel:' + d.code + ':', order: 'created_at.asc', limit: 20 });
    if (!marks.length) return;
    const start = Date.parse(marks[0].created_at), end = start + DUEL_MS;
    d.end = end;
    const me = (P().name || '').toLowerCase();
    const names = [...new Set(marks.map((r) => r.name))];
    const opp = names.find((n) => n.toLowerCase() !== me);
    if (!opp) return;
    d.opp = opp;
    let w = 0, l = 0;
    const parts = [];
    for (const gid of d.games) {
      const g = gameById[gid];
      const since = new Date(start).toISOString();
      const [res, saved] = await Promise.all([W.rows({ prefix: 'u:res:' + g.board, since, limit: 2000 }), W.rows({ board: g.board, since, limit: 2000 })]);
      const all = res.concat(saved).filter((r) => Date.parse(r.created_at) < end);
      const best = (name) => {
        const s = all.filter((r) => r.name.toLowerCase() === name.toLowerCase()).map((r) => r.score);
        return s.length ? (g.low ? Math.min(...s) : Math.max(...s)) : null;
      };
      const a = best(me), b = best(opp);
      if (a !== null && (b === null || (g.low ? a < b : a > b))) w++;
      else if (b !== null && (a === null || (g.low ? b < a : b > a))) l++;
      parts.push(g.name + ': ' + (a === null ? '–' : fmtBoard(g.board, a)) + ' mot ' + (b === null ? '–' : fmtBoard(g.board, b)));
    }
    d.score = d.games.length > 1 ? w + '–' + l + ' (' + parts.join(', ') + ')' : parts[0];
    if (Date.now() >= end) {
      d.res = w > l ? 'win' : w < l ? 'loss' : 'draw';
      if (d.res === 'win') W.award('duel-win');
    }
    W.save();
  }
  async function acceptDuel(code, fmtId, games, from) {
    games = (games || []).filter((g) => gameById[g] && gameById[g].board);
    if (!FORMATS[fmtId] || !games.length) return;
    if (P().duels.some((d) => d.code === code)) { openDuel(); return; }
    const d = { code, fmt: fmtId, games, t: Date.now() };
    modal('⚔️ ' + (from || 'Någon') + ' utmanar dig!', h('div', null,
      h('p', { class: 'lead' }, h('b', null, duelName(d)), '. Ni har 48 timmar på er från att duellen skapades – bästa resultatet vinner!'),
      h('div', { class: 'quick-games' }, games.map((g) => h('div', { class: 'qg' }, h('img', { src: gameById[g].img, alt: '' }), h('span', null, gameById[g].name)))),
      h('div', { class: 'row' }, btn('⚔️ Anta utmaningen', () => W.needName(async () => {
        await W.insert('u:duel:' + code + ':' + fmtId + ':' + games.join(','), 0);
        P().duels.unshift(d); W.save();
        W.award('duel'); W.addXp(30);
        modal('⚔️ Kör!', h('div', null,
          h('p', { class: 'lead' }, 'Spela och få ett så bra resultat som möjligt. Du ser ställningen i Duellhallen.'),
          h('div', { class: 'row' }, ...games.map((g) => btn('▶ Spela ' + gameById[g].name, () => play(gameById[g]), 'big')), btn('Till Duellhallen', () => openDuel(), 'ghost'))));
      }, 'Välj ett namn – samma namn används i spelen så att resultaten räknas.'), 'big'))));
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
      ['⏱️ Maratonspelare', W.has('marathon'), 'Spela i en timme sammanlagt (' + Math.floor((p.playTime || 0) / 60) + '/60 min)'],
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
          p.history.length ? h('ul', { class: 'history' }, p.history.filter((x) => x.k === 'mystery' || (x.k === 'game' && gameById[x.id])).slice(0, 14).map((x) => h('li', null,
            x.k === 'game' ? '▶️ ' + gameById[x.id].name : '🕵️ Löste dagens mysterium',
            h('small', null, W.ago(new Date(x.t).toISOString()))))) : h('p', { class: 'muted' }, 'Spela något så dyker det upp här!'),
          h('p', { class: 'muted small' }, '⚔️ Dueller: ' + p.duels.filter((d) => d.res === 'win').length + ' vinster, ' + p.duels.filter((d) => d.res === 'loss').length + ' förluster · 🎲 Surprise Me: ' + (p.roulette || 0) + ' klarade · 🔮 Hemligheter: ' + (p.secretsFound || 0) + '/' + D.SECRETS.length)))), { cls: 'wide' });
  }

  // ================================================================== Hall of fame (global leaderboards)
  function openFame() {
    const tabs = h('div', { class: 'tabs' });
    const body = h('div');
    const T = {
      boss: ['⚔️ Bosskämpar', async () => list(live.boss ? Object.entries(live.boss.per).map(([name, score]) => ({ name, score })).sort((a, b) => b.score - a.score) : [], (s) => fmt(s) + ' skada', P().name)],
      time: ['⏱️ Mest speltid (veckan)', async () => list(sumPerName(live.weekRows.filter((r) => r.board.startsWith('u:time:') && r.name !== 'Anonym')), (s) => Math.round(s / 60) + ' min', P().name)],
      mystery: ['🕵️ Detektiver', async () => list(bestPerName(await W.rows({ board: 'u:mystery:' + W.today(), limit: 300 })), (s) => s + ' p', P().name)],
      secrets: ['🔮 Hemlighetsjägare', async () => {
        const rows = await W.rows({ prefix: 'u:secret:', limit: 3000 });
        const m = {};
        rows.forEach((r) => { (m[r.name] = m[r.name] || new Set()).add(r.board); });
        const all = new Set(rows.map((r) => r.board)).size;
        return h('div', null, h('p', { class: 'muted' }, '🤝 Tillsammans har communityn hittat ' + all + ' av ' + D.SECRETS.length + ' hemligheter. Hjälp varandra att hitta resten!'),
          list(Object.entries(m).map(([name, s]) => ({ name, score: s.size })).sort((a, b) => b.score - a.score), (s) => s + ' 🔮', P().name));
      }],
      games: ['🎮 Spelen', async () => {
        const wrap = h('div', { class: 'two' });
        const gs = D.GAMES.filter((x) => x.board);
        const all = await Promise.all(gs.map((g) => W.rows({ board: g.board, order: 'score.' + (g.low ? 'asc' : 'desc'), limit: 100 })));
        gs.forEach((g, i) => wrap.appendChild(h('div', null, h('h4', null, h('a', { href: '#', onclick: (e) => { e.preventDefault(); openGame(g); } }, g.name)), list(bestPerName(all[i], g.low).slice(0, 5), (n) => fmtBoard(g.board, n), P().name))));
        return wrap;
      }],
    };
    function show(k) {
      tabs.querySelectorAll('button').forEach((b) => b.classList.toggle('sel', b.dataset.k === k));
      fill(body, T[k][1]);
    }
    Object.entries(T).forEach(([k, v]) => tabs.appendChild(h('button', { type: 'button', class: 'chip', 'data-k': k, onclick: () => show(k) }, v[0])));
    modal('🏆 Hall of Fame – globala topplistor', h('div', null, tabs, body), { cls: 'wide' });
    show('games');
  }

  // ================================================================== terminal, cave, wish
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
    const first = W.award('cave');
    if (first) W.addCoins(15);
    modal('🕳️ Den hemliga grottan', h('div', null,
      h('p', { class: 'lead' }, 'Du klämde dig igenom snåren och hittade en grotta som ingen vet om. Det luktar gamla spelkonsoler här inne…'),
      h('p', null, 'Längst in har någon ristat in i stenen:'),
      h('blockquote', { class: 'note' }, '”Skurken i äventyret har ett namn på fyra bokstäver. Skriv det i terminalen bakom Mitt rum.”'),
      first ? h('p', { class: 'win-box' }, '+15 🪙 för att du hittade grottan!') : null));
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
    modal('🎮 Alla spel', h('div', null,
      h('p', { class: 'muted' }, 'Klicka för att spela – eller ”Gå dit” för att besöka byggnaden i världen.'),
      h('div', { class: 'all-games' }, D.GAMES.map((g) => h('div', { class: 'ag' },
        h('img', { src: g.img, alt: '', loading: 'lazy' }),
        h('div', null, h('b', null, g.name), h('small', null, g.tag + (g.desktop ? ' · 🖥️ dator' : '')), live.playing[g.id] ? h('small', { class: 'live-now' }, '🟢 ' + live.playing[g.id] + ' spelar nu') : null, live.tops[g.id] ? h('small', { class: 'top-now' }, live.tops[g.id]) : null,
          h('div', { class: 'row' }, btn('▶ Spela', () => play(g), 'chip'), btn('🚶 Gå dit', () => { closeModal(); W.world.teleport(g.id); }, 'chip ghost')))))),
      h('h3', null, 'Platser'),
      h('div', { class: 'row wrap' }, [['mystery', '🕵️ Mysterietornet'], ['boss', '👹 Bossarenan'], ['roulette', '🎲 Lyckohjulet'], ['duel', '⚔️ Duellhallen'], ['feed', '📺 Live-tavlan'], ['community', '🎯 Monumentet'], ['profile', '🧬 DNA-labbet'], ['home', '🏠 Mitt rum'], ['neighbors', '🏘️ Granngatan'], ['fame', '🏆 Hall of Fame']]
        .map(([id, n]) => btn(n, () => { closeModal(); W.world.teleport(id); }, 'chip')))), { cls: 'wide' });
  }

  // ================================================================== routing: walking into a building
  W.on('enter', (s) => {
    if (s.type === 'game') return openGame(s.game);
    ({ mystery: openMystery, boss: openBoss, roulette: () => roulette(), feed: openFeed, community: openCommunity, duel: () => openDuel(), profile: openProfile, home: openRoom, neighbors: openNeighbors, fame: openFame, terminal: openTerminal, cave: openCave, wish: openWish }[s.id] || (() => {}))();
  });

  W.ui = { refresh, play, gameById, openGame, openMystery, openBoss, roulette, rouletteBanner, openFeed, openCommunity, openDuel, acceptDuel, openRoom, visitRoom, openNeighbors, openProfile, openFame, openAll, recordPlay, checkChallenges, mysteryState, cluesNow, profileType };
})();
