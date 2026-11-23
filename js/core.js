// Core helpers: time, random, profile (saved on this device), online backend, badges, toasts and popups.
(function () {
  'use strict';
  const D = window.EOJ_DATA;

  // ------------------------------------------------------------------ time (Swedish time, same for everyone)
  const TZ = 'Europe/Stockholm';
  let FMT = null;
  function parts(date) {
    const f = FMT || (FMT = new Intl.DateTimeFormat('sv-SE', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }));
    const o = {};
    f.formatToParts(date || new Date()).forEach((p) => (o[p.type] = p.value));
    return { y: +o.year, mo: +o.month, d: +o.day, h: +o.hour % 24, mi: +o.minute, s: +o.second };
  }
  const pad = (n) => String(n).padStart(2, '0');
  function today() {
    const p = parts();
    return p.y + '-' + pad(p.mo) + '-' + pad(p.d);
  }
  function dayOf(date) {
    const p = parts(new Date(date));
    return p.y + '-' + pad(p.mo) + '-' + pad(p.d);
  }
  function hour() {
    const p = parts();
    return p.h + p.mi / 60;
  }
  // minutes between Swedish time and UTC right now
  function tzOffsetMs() {
    const p = parts();
    return Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s) - Math.floor(Date.now() / 1000) * 1000;
  }
  function weekInfo() {
    const p = parts();
    const local = new Date(Date.UTC(p.y, p.mo - 1, p.d));
    const dow = (local.getUTCDay() + 6) % 7; // monday = 0
    const monday = new Date(local.getTime() - dow * 86400000);
    // ISO week number
    const thu = new Date(monday.getTime() + 3 * 86400000);
    const jan1 = new Date(Date.UTC(thu.getUTCFullYear(), 0, 1));
    const wk = Math.ceil(((thu - jan1) / 86400000 + 1) / 7);
    const startUtc = monday.getTime() - tzOffsetMs();
    return {
      id: thu.getUTCFullYear() + '-w' + pad(wk),
      num: wk + thu.getUTCFullYear() * 53,
      start: new Date(startUtc).toISOString(),
      end: startUtc + 7 * 86400000,
    };
  }
  function dayStartIso() {
    const p = parts();
    return new Date(Date.UTC(p.y, p.mo - 1, p.d) - tzOffsetMs()).toISOString();
  }

  // ------------------------------------------------------------------ random
  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const daily = (salt) => rng(hash(today() + ':' + salt));

  // ------------------------------------------------------------------ storage
  const ls = {
    get(k, d) {
      try {
        const v = localStorage.getItem(k);
        return v === null ? d : JSON.parse(v);
      } catch (e) {
        return d;
      }
    },
    set(k, v) {
      try {
        localStorage.setItem(k, JSON.stringify(v));
      } catch (e) {}
    },
  };

  const BAD = ['fitta', 'kuk', 'hora', 'jävla', 'javla', 'neger', 'nigg', 'fuck', 'shit', 'cunt', 'dick', 'bitch', 'whore', 'slut', 'cock', 'pussy', 'hitler', 'nazi', 'rape', 'våldt', 'bög', 'fag', 'retard', 'mongo', 'porr', 'porn', 'sex'];
  function cleanName(raw) {
    const n = String(raw || '').replace(/[^\p{L}\p{N} _\-.]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 12);
    if (!n) return null;
    const flat = n.toLowerCase().replace(/[^a-zåäö0-9]/g, '').replace(/0/g, 'o').replace(/1/g, 'i').replace(/3/g, 'e').replace(/4/g, 'a').replace(/5/g, 's');
    if (BAD.some((b) => flat.includes(b))) return null;
    return n;
  }

  const P_KEY = 'eojw:profile';
  const defaults = () => ({
    name: ls.get('eoj:name', '') || '',
    color: '#5ee7ff',
    hat: '',
    coins: 10,
    xp: 0,
    owned: {},
    badges: {},
    history: [],
    plays: {},
    cat: {},
    coinDay: { date: '', got: [] },
    totalCoins: 0,
    artifacts: {},
    visited: {},
    room: { wall: 0, floor: 0, items: [[0, 2, 5], [1, 0, 0], [3, 11, 0]] },
    pc: { date: '', done: [] },
    pcTotal: 0,
    roulette: 0,
    duels: [],
    mystery: { date: '', wrong: 0, solved: false, points: 0, rank: 0 },
    boss: {},
    pokes: 0,
    secretsFound: 0,
    seenCommunity: {},
  });
  let profile = Object.assign(defaults(), ls.get(P_KEY, {}));
  function save() {
    ls.set(P_KEY, profile);
    if (profile.name) ls.set('eoj:name', profile.name); // same name as in the games' leaderboards
    emit('profile');
  }

  // ------------------------------------------------------------------ tiny event bus
  const listeners = {};
  function on(ev, fn) {
    (listeners[ev] = listeners[ev] || []).push(fn);
  }
  function emit(ev, data) {
    (listeners[ev] || []).forEach((fn) => {
      try {
        fn(data);
      } catch (e) {
        console.error(e);
      }
    });
  }

  // ------------------------------------------------------------------ backend
  // Uses the same Supabase "scores" table as the games' leaderboards (shared/README.md in EoJ-spel).
  // Everything the world shares is saved there with boards that start with "u:" so it never mixes with game scores:
  //   u:play:<game>         someone started a game (world gets busier)
  //   u:boss:<week>         damage on the weekly boss
  //   u:mystery:<date>      solved the daily mystery (score = points)
  //   u:secret:<id>         found a secret
  //   u:mini:<game>         minigame score (counts for the community challenge)
  //   u:duel:<code>:<round> duel results
  //   u:room:<layout>       a saved room (layout is packed into the board name)
  //   u:pc                  finished a personal challenge
  const LOCAL_KEY = 'eojw:offline-rows';
  function cfg() {
    const c = window.EOJ_CONFIG || {};
    return c.supabaseUrl && c.supabaseKey ? c : null;
  }
  let online = !!cfg();
  function headers(c, extra) {
    const h = Object.assign({ apikey: c.supabaseKey }, extra || {});
    if (/^eyJ/.test(c.supabaseKey)) h.Authorization = 'Bearer ' + c.supabaseKey;
    return h;
  }
  function base() {
    return cfg().supabaseUrl.replace(/\/$/, '') + '/rest/v1/scores';
  }
  async function insert(board, score, name) {
    name = cleanName(name || profile.name) || 'Anonym';
    board = String(board).slice(0, 60);
    score = Math.max(0, Math.min(99999999, Math.round(score || 0)));
    const row = { board, name, score };
    if (online) {
      try {
        const r = await fetch(base(), {
          method: 'POST',
          headers: headers(cfg(), { 'Content-Type': 'application/json', Prefer: 'return=minimal' }),
          body: JSON.stringify(row),
        });
        if (r.ok) {
          emit('inserted', row);
          return true;
        }
      } catch (e) {}
    }
    const rows = ls.get(LOCAL_KEY, []);
    rows.push(Object.assign({ created_at: new Date().toISOString() }, row));
    ls.set(LOCAL_KEY, rows.slice(-800));
    emit('inserted', row);
    return true;
  }
  // q: { board: 'exact' | prefix: 'u:play:', since: iso, order: 'created_at.desc', limit }
  async function rows(q) {
    q = q || {};
    if (online) {
      const p = ['select=board,name,score,created_at'];
      if (q.board) p.push('board=eq.' + encodeURIComponent(q.board));
      if (q.prefix) p.push('board=like.' + encodeURIComponent(q.prefix.replace(/[%_]/g, (m) => '\\' + m) + '*'));
      if (q.since) p.push('created_at=gte.' + encodeURIComponent(q.since));
      p.push('order=' + (q.order || 'created_at.desc'));
      p.push('limit=' + (q.limit || 1000));
      try {
        const r = await fetch(base() + '?' + p.join('&'), { headers: headers(cfg()) });
        if (r.ok) return await r.json();
      } catch (e) {}
      // Online leaderboard is down (paused project etc.) – keep the world working on this device.
      online = false;
      emit('offline');
    }
    let out = ls.get(LOCAL_KEY, []).filter((r) => (!q.board || r.board === q.board) && (!q.prefix || r.board.startsWith(q.prefix)) && (!q.since || r.created_at >= q.since));
    const [field, dir] = (q.order || 'created_at.desc').split('.');
    out.sort((a, b) => (a[field] < b[field] ? -1 : a[field] > b[field] ? 1 : 0) * (dir === 'desc' ? -1 : 1));
    return out.slice(0, q.limit || 1000);
  }

  // ------------------------------------------------------------------ toasts & popups
  const $ = (s, r) => (r || document).querySelector(s);
  function h(tag, attrs, ...kids) {
    const e = document.createElement(tag);
    if (attrs)
      for (const k in attrs) {
        const v = attrs[k];
        if (v === null || v === undefined || v === false) continue;
        if (k === 'class') e.className = v;
        else if (k === 'style') e.style.cssText = v;
        else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
        else if (k === 'html') e.innerHTML = v;
        else e.setAttribute(k, v === true ? '' : v);
      }
    kids.flat().forEach((k) => {
      if (k === null || k === undefined || k === false) return;
      e.appendChild(typeof k === 'string' || typeof k === 'number' ? document.createTextNode(String(k)) : k);
    });
    return e;
  }
  let toastQueue = [];
  let toastBusy = false;
  function toast(msg, kind) {
    toastQueue.push([msg, kind]);
    if (!toastBusy) nextToast();
  }
  function nextToast() {
    const item = toastQueue.shift();
    if (!item) {
      toastBusy = false;
      return;
    }
    toastBusy = true;
    const t = h('div', { class: 'toast ' + (item[1] || ''), role: 'status' }, item[0]);
    $('#toasts').appendChild(t);
    requestAnimationFrame(() => t.classList.add('show'));
    setTimeout(() => {
      t.classList.remove('show');
      setTimeout(() => t.remove(), 300);
      nextToast();
    }, item[1] === 'big' ? 3200 : 2300);
  }

  let modalClose = null;
  let lastFocus = null;
  function modal(title, body, opts) {
    closeModal(true);
    opts = opts || {};
    lastFocus = document.activeElement;
    const box = h('div', { class: 'modal-box ' + (opts.cls || ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
      h('button', { class: 'modal-x', type: 'button', 'aria-label': 'Stäng', onclick: () => closeModal() }, '✕'),
      h('h2', { class: 'modal-title' }, title),
      body);
    const wrap = h('div', { class: 'modal', onclick: (e) => { if (e.target === wrap && !opts.sticky) closeModal(); } }, box);
    $('#modals').appendChild(wrap);
    modalClose = opts.onClose || null;
    document.body.classList.add('has-modal');
    setTimeout(() => { const f = box.querySelector('[autofocus]') || box.querySelector('.modal-x'); if (f) f.focus(); }, 30);
    emit('modal', true);
    return box;
  }
  function closeModal(silent) {
    const m = $('#modals');
    if (!m || !m.firstChild) return;
    const fn = modalClose;
    modalClose = null;
    m.innerHTML = '';
    document.body.classList.remove('has-modal');
    if (fn) fn();
    if (!silent) {
      emit('modal', false);
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }
  }
  const modalOpen = () => !!($('#modals') && $('#modals').firstChild);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modalOpen()) closeModal();
  });

  // ------------------------------------------------------------------ progress: xp, coins, badges
  const level = () => Math.floor(Math.sqrt(profile.xp / 60)) + 1;
  const levelXp = (l) => (l - 1) * (l - 1) * 60;
  function addXp(n) {
    const before = level();
    profile.xp += n;
    if (level() > before) toast('⬆️ Nivå ' + level() + '!', 'big');
    save();
  }
  function addCoins(n, silent) {
    profile.coins += n;
    if (n > 0) profile.totalCoins = (profile.totalCoins || 0) + n;
    if (profile.totalCoins >= 50) award('collector');
    save();
    if (!silent && n) toast((n > 0 ? '+' : '') + n + ' 🪙');
  }
  function has(id) {
    return !!profile.badges[id];
  }
  function award(id) {
    if (has(id) || !D.BADGES[id]) return false;
    const b = D.BADGES[id];
    profile.badges[id] = Date.now();
    profile.xp += 100;
    save();
    toast(b.i + ' Ny utmärkelse: ' + b.n, 'big');
    if (D.SECRETS.includes(id)) {
      profile.secretsFound = D.SECRETS.filter((s) => profile.badges[s]).length;
      save();
      insert('u:secret:' + id, 1);
      if (profile.secretsFound >= 5) award('secret-5');
    }
    emit('badge', id);
    return true;
  }

  // Name needed for everything that is shared. Asks once.
  function needName(then, why) {
    if (profile.name) return then(profile.name);
    const input = h('input', { maxlength: 12, placeholder: 'Ditt namn', autocomplete: 'nickname', autofocus: true, value: '' });
    const msg = h('p', { class: 'muted small' }, 'Syns på topplistor, i live-flödet och på ditt rum. Max 12 tecken.');
    const form = h('form', { class: 'name-form', onsubmit: (e) => {
      e.preventDefault();
      const n = cleanName(input.value);
      if (!n) {
        msg.textContent = 'Välj ett annat namn.';
        return;
      }
      profile.name = n;
      save();
      closeModal(true);
      toast('Hej ' + n + '! 👋');
      then(n);
    } }, input, h('button', { class: 'btn', type: 'submit' }, 'Spara'));
    modal('Vad heter du?', h('div', null, h('p', null, why || 'Välj ett namn för att vara med.'), form, msg));
  }

  // seeded pick helpers
  const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
  const fmt = (n) => Math.round(n).toLocaleString('sv-SE');
  function ago(iso) {
    const s = Math.max(0, (Date.now() - Date.parse(iso)) / 1000);
    if (s < 60) return 'nyss';
    if (s < 3600) return Math.floor(s / 60) + ' min sedan';
    if (s < 86400) return Math.floor(s / 3600) + ' tim sedan';
    return Math.floor(s / 86400) + ' d sedan';
  }
  function track(path, title) {
    try {
      if (window.goatcounter && window.goatcounter.count) window.goatcounter.count({ path, title, event: true });
    } catch (e) {}
  }
  async function share(title, text, url) {
    track('dela-' + title.toLowerCase().replace(/[^a-z0-9]+/g, '-'), 'dela: ' + title);
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch (e) {
        if (e && e.name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(text + '\n' + url);
      toast('Länken är kopierad – skicka den till en kompis!');
    } catch (e) {
      window.prompt('Kopiera länken:', url);
    }
  }
  const SITE = location.origin + location.pathname.replace(/index\.html$/, '');

  window.W = {
    D, today, dayOf, hour, weekInfo, dayStartIso, hash, rng, daily, pick, fmt, ago, ls, cleanName,
    get profile() { return profile; },
    save, on, emit, insert, rows, isOnline: () => online,
    $, h, toast, modal, closeModal, modalOpen, needName, track, share, SITE,
    level, levelXp, addXp, addCoins, award, has,
    reset() { profile = defaults(); save(); },
  };
})();
