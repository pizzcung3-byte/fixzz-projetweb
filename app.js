/* By @maklodevv */
(() => {
'use strict';

if (!window.__ok) {
  document.documentElement.innerHTML = '<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#000;color:#fff;font-family:system-ui,sans-serif;text-align:center"><div><h1 style="font-size:clamp(2rem,9vw,4rem);margin:0 0 .6rem">Mau Ngapain bg?</h1><p style="color:#9aa3ad;font-size:1.1rem;margin:0">By @maklodevv</p></div></body>';
  throw new Error('locked');
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const root = document.documentElement;
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const rp = (n) => 'Rp ' + new Intl.NumberFormat('id-ID').format(n || 0);
const dt = (ts) => new Date(ts).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

const CAT = { akun: 'Akun Telegram', channel: 'Channel Telegram', panel: 'Panel Pterodactyl' };
const STATUS = { pending: 'Menunggu', waiting: 'Menunggu kode', approved: 'Berhasil', rejected: 'Ditolak', done: 'Selesai', cancelled: 'Dibatalkan', expired: 'Kedaluwarsa', review: 'Perlu dicek' };
const COLORS = ['', '#5eead4', '#a7f3d0', '#c4b5fd', '#f9a8d4', '#fcd34d', '#fdba74', '#ffffff'];
const customColor = (c) => (c && String(c).toLowerCase() !== '#4cc3ff' ? c : '');

const S = { me: null, badges: {}, config: { siteName: 'Police619 Store', telegram: 'police619', minDeposit: 10000, paymentMethods: [] }, products: [], filter: 'all', inApp: false };

async function api(path, body) {
  const opt = body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
  const res = await fetch('/api' + path, opt);
  let data = {};
  try { data = await res.json(); } catch (_) { /* kosong */ }
  if (!res.ok) { const e = new Error(data.error || 'Terjadi kesalahan.'); e.status = res.status; throw e; }
  return data;
}

let toastT;
function toast(msg, err = false) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.toggle('err', err);
  t.classList.add('show');
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove('show'), 3400);
}

const VBADGE = '<svg class="vbadge" viewBox="0 0 24 24" role="img" aria-label="Owner resmi"><title>Owner resmi</title><circle cx="12" cy="12" r="11" fill="#3b9cff"/><path d="M7 12.4l3.3 3.3L17 9" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const ownerMark = (u) => (u && u.role === 'owner' ? VBADGE : '');

function avatarHtml(u, size = '') {
  const col = customColor(u.color);
  const c = col ? esc(col) : 'var(--sky)';
  if (u.avatar) return `<span class="av ${size}" style="--c:${c}"><img src="${esc(u.avatar)}" alt=""></span>`;
  const ch = esc(((u.displayName || u.username || '?').trim()[0] || '?').toUpperCase());
  return `<span class="av ${size}" style="--c:${c}">${ch}</span>`;
}

/* ------------------------------------------------------------------ */
/* Dialog helpers                                                      */
/* ------------------------------------------------------------------ */
function fieldHtml(f) {
  const id = 'f_' + f.name;
  const v = f.value == null ? '' : f.value;
  if (f.type === 'checkbox') {
    return `<div class="field"><label class="check"><input type="checkbox" id="${id}" name="${f.name}" ${v ? 'checked' : ''}> ${esc(f.label)}</label></div>`;
  }
  let input;
  if (f.type === 'textarea') {
    input = `<textarea id="${id}" name="${f.name}" maxlength="${f.max || 300}" placeholder="${esc(f.placeholder || '')}">${esc(v)}</textarea>`;
  } else if (f.type === 'select') {
    input = `<select id="${id}" name="${f.name}">${f.options.map((o) => `<option value="${esc(o[0])}" ${String(o[0]) === String(v) ? 'selected' : ''}>${esc(o[1])}</option>`).join('')}</select>`;
  } else {
    input = `<input id="${id}" name="${f.name}" type="${f.type || 'text'}" value="${esc(v)}" placeholder="${esc(f.placeholder || '')}" autocomplete="${f.autocomplete || 'off'}" ${f.type === 'number' ? 'inputmode="numeric" min="0"' : ''} ${f.max ? `maxlength="${f.max}"` : ''}>`;
  }
  return `<div class="field"><label for="${id}">${esc(f.label)}</label>${input}${f.hint ? `<span class="hint">${esc(f.hint)}</span>` : ''}</div>`;
}

function formModal({ title, intro = '', fields = [], submit = 'Simpan', danger = false, foot = null, onSubmit }) {
  const d = $('#formDialog');
  d.innerHTML = `<form class="dlg-form" novalidate>
    <h3>${esc(title)}</h3>
    ${intro ? `<p class="intro">${esc(intro)}</p>` : ''}
    ${fields.map(fieldHtml).join('')}
    <p class="form-err" role="alert"></p>
    <div class="dlg-actions"><button type="button" class="btn ghost" data-cancel>Batal</button><button class="btn ${danger ? 'danger' : ''}" type="submit">${esc(submit)}</button></div>
    ${foot ? `<p class="dlg-foot">${esc(foot.text)} <button type="button" data-foot>${esc(foot.label)}</button></p>` : ''}
  </form>`;
  const form = $('form', d);
  const err = $('.form-err', d);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    err.textContent = '';
    const btn = $('button[type=submit]', form);
    btn.disabled = true;
    try {
      const vals = {};
      fields.forEach((f) => {
        const el = form.elements[f.name];
        vals[f.name] = f.type === 'checkbox' ? el.checked : el.value;
      });
      await onSubmit(vals);
      d.close();
    } catch (ex) {
      err.textContent = ex.message || 'Terjadi kesalahan.';
    } finally {
      btn.disabled = false;
    }
  });
  $('[data-cancel]', d).addEventListener('click', () => d.close());
  if (foot) $('[data-foot]', d).addEventListener('click', foot.fn);
  if (!d.open) d.showModal();
  const first = $('input:not([type=checkbox]), textarea, select', form);
  if (first) first.focus();
}

function confirmModal({ title, text, submit = 'Ya', danger = false }) {
  return new Promise((resolve) => {
    let ok = false;
    const d = $('#formDialog');
    formModal({ title, intro: text, fields: [], submit, danger, onSubmit: async () => { ok = true; } });
    d.addEventListener('close', () => resolve(ok), { once: true });
  });
}

/* ------------------------------------------------------------------ */
/* Polling                                                             */
/* ------------------------------------------------------------------ */
let pollId = 0; let pollT = null;
function clearPoll() { pollId += 1; clearTimeout(pollT); clearInterval(S.payTimer); S.payTimer = null; }
function setPoll(fn, ms) {
  clearPoll();
  const id = pollId;
  const run = async () => {
    if (id !== pollId) return;
    if (!document.hidden) { try { await fn(); } catch (_) { /* abaikan */ } }
    if (id === pollId) pollT = setTimeout(run, ms);
  };
  pollT = setTimeout(run, ms);
}

/* ------------------------------------------------------------------ */
/* Data                                                                */
/* ------------------------------------------------------------------ */
async function loadConfig() {
  try { S.config = await api('/config'); } catch (_) { /* pakai default */ }
  $$('[data-site-name]').forEach((e) => { e.textContent = S.config.siteName; });
  $$('[data-tg]').forEach((a) => { a.href = 'https://t.me/' + S.config.telegram; });
  $$('[data-tg-text]').forEach((e) => { e.textContent = '@' + S.config.telegram; });
  const wa = S.config.whatsapp;
  $$('[data-wa]').forEach((a) => { a.hidden = !wa; if (wa) a.href = 'https://wa.me/' + wa; });
  $$('[data-wa-text]').forEach((e) => { e.textContent = wa ? '+' + wa : ''; });
  if (S.config.accent) root.setAttribute('data-accent', S.config.accent);
  buildProfileCard();
  document.title = `${S.config.siteName} | Akun Telegram, Panel Pterodactyl, Top Up Game, Nokos`;
}

async function loadProducts() {
  try { S.products = (await api('/products')).products; } catch (_) { S.products = []; }
}

async function refreshMe() {
  try {
    const r = await api('/me');
    S.me = r.user;
    S.badges = r.badges || {};
  } catch (_) { /* abaikan */ }
  renderNav();
  const ab = $('#accBal');
  if (ab && S.me) ab.textContent = rp(S.me.balance);
}

/* ------------------------------------------------------------------ */
/* Kontak dan maintenance                                              */
/* ------------------------------------------------------------------ */
function buildProfileCard() {
  const el = $('#profileCard');
  if (!el) return;
  const c = S.config;
  const rows = [[`https://t.me/${c.telegram}`, `@${esc(c.telegram)}${VBADGE}`, 'Telegram, owner resmi']];
  if (c.whatsapp) rows.push([`https://wa.me/${c.whatsapp}`, `+${esc(c.whatsapp)}`, 'WhatsApp']);
  rows.push([null, 'Akun Telegram, channel, panel, top up game, nokos', 'Layanan']);
  el.innerHTML = rows.map((r) => (r[0]
    ? `<a class="pc-row" href="${esc(r[0])}" target="_blank" rel="noopener"><b>${r[1]}</b><small>${esc(r[2])}</small></a>`
    : `<div class="pc-row"><b>${esc(r[1])}</b><small>${esc(r[2])}</small></div>`)).join('');
}

const MT_SEC = { akun: '#akun', produk: '#produk', topup: '#topup', nokos: '#nokos' };
const MT_TICKET = { akun: '#cnt-akun', produk: '#cnt-panel', topup: '#cnt-game', nokos: '#cnt-nokos' };
const isOwner = () => !!(S.me && S.me.role === 'owner');
const mtOn = (k) => !!(S.config.maintenance && S.config.maintenance[k] && S.config.maintenance[k].on);
const mtHide = (k) => mtOn(k) && !isOwner();
const availCount = (cats) => S.products.filter((p) => cats.includes(p.category) && (p.stock === null || p.stock > 0)).length;
const ticketText = {
  akun: () => `${AKUN_BASE.length} ID`,
  produk: () => { const n = availCount(['channel', 'panel']); return n ? `${n} produk` : 'Hubungi owner'; },
  topup: () => `${GAMES.length} game`,
  nokos: () => { const n = nkServices().length; return n ? `${n} layanan` : 'Segera hadir'; },
};

function mtHours(m) {
  const tz = S.config.timezoneLabel || 'WIB';
  if (m.from && m.to) return `Jam maintenance: ${m.from} sampai ${m.to} ${tz}`;
  if (m.from) return `Mulai jam ${m.from} ${tz}`;
  if (m.to) return `Sampai jam ${m.to} ${tz}`;
  return '';
}

function mtCard(m) {
  const c = S.config;
  return `<div class="mt-card">
    <div class="mt-ic"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.700 6.300a4 4 0 00-5.400 5.400L3.500 17.500a1.800 1.800 0 002.500 2.500l5.800-5.800a4 4 0 005.400-5.400l-2.600 2.600-2.400-.6-.6-2.400z"/></svg></div>
    <span class="tag">${esc(m.label)}</span>
    <h3>Sedang Maintenance Bro, Sabar</h3>
    <p class="muted">Bagian ini lagi dirapikan dan belum bisa dibuka. Bagian toko yang lain tetap bisa dipakai.</p>
    <div class="mt-hours">${esc(mtHours(m) || 'Segera dibuka kembali')}</div>
    ${m.note ? `<p>${esc(m.note)}</p>` : ''}
    <div class="mt-contact">
      <p class="muted">Ada perlu? Hubungi langsung:</p>
      <a class="btn" href="https://t.me/${esc(c.telegram)}" target="_blank" rel="noopener">Telegram @${esc(c.telegram)}</a>
      ${c.whatsapp ? `<a class="btn ghost" href="https://wa.me/${esc(c.whatsapp)}" target="_blank" rel="noopener">WhatsApp +${esc(c.whatsapp)}</a>` : ''}
    </div>
  </div>`;
}

function applyMaintenance() {
  const mt = S.config.maintenance || {};
  for (const k of Object.keys(MT_SEC)) {
    const sec = $(MT_SEC[k]);
    if (!sec) continue;
    const box = $(`[data-mt="${k}"]`, sec);
    const m = mt[k] || {};
    sec.classList.toggle('is-mt', mtHide(k));
    if (!m.on) box.innerHTML = '';
    else if (isOwner()) box.innerHTML = `<div class="mt-owner">Maintenance aktif untuk pengunjung dan user. Kamu tetap bisa membuka bagian ini karena kamu owner.${mtHours(m) ? ` (${esc(mtHours(m))})` : ''}</div>`;
    else box.innerHTML = mtCard(m);
    const t = $(MT_TICKET[k]);
    if (t) t.textContent = mtHide(k) ? 'Sedang maintenance' : ticketText[k]();
  }
  renderDrawer();
}

/* ------------------------------------------------------------------ */
/* Navigasi atas                                                       */
/* ------------------------------------------------------------------ */
function renderNav() {
  const box = $('#navUser');
  const u = S.me;
  if (!u) {
    box.innerHTML = `<button class="btn ghost sm" data-act="login">Masuk</button><button class="btn sm hide-xs" data-act="register">Daftar</button>`;
  } else {
    box.innerHTML = `<a class="who" href="#/akun" aria-label="Dashboard">${avatarHtml(u, 'sm')}<span class="t"><b>${esc(u.displayName)}${ownerMark(u)}</b><small>${rp(u.balance)}</small></span></a>`;
  }
  const n = u ? (S.badges.chat || 0) + (u.role === 'owner' ? (S.badges.deposits || 0) + (S.badges.orders || 0) : 0) : 0;
  const bd = $('#burgerDot');
  bd.hidden = !n;
  bd.textContent = n;
  applyMaintenance();
}

/* ------------------------------------------------------------------ */
/* Menu samping (tiga garis)                                           */
/* ------------------------------------------------------------------ */
const IC = {
  dash: '<path d="M4 4h7v7H4zM13 4h7v5h-7zM13 12h7v8h-7zM4 14h7v6H4z"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4.5 20c1.4-3.8 4.6-5 7.5-5s6.1 1.2 7.5 5"/>',
  id: '<rect x="3" y="5" width="18" height="14" rx="3"/><circle cx="9" cy="11" r="2"/><path d="M5.8 16c.6-1.5 1.8-2.1 3.2-2.1s2.600.6 3.200 2.100M14.500 10h3.500M14.500 14h3.500"/>',
  shield: '<path d="M12 3l8 3v6c0 4.500-3.200 7.500-8 9-4.800-1.500-8-4.500-8-9V6z"/>',
  out: '<path d="M9 4H5.500A1.500 1.500 0 004 5.500v13A1.500 1.500 0 005.500 20H9M15.500 8L20 12l-4.500 4M20 12H9"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
};
const ic = (k) => `<svg viewBox="0 0 24 24" aria-hidden="true">${IC[k]}</svg>`;

function renderDrawer() {
  const d = $('#drawer');
  if (!d) return;
  const h = location.hash;
  const cur = (p) => (p === '#/akun' ? /^#\/akun\/?$/.test(h) : h.startsWith(p));
  const link = (href, icon, label, extra = '') => `<a class="dr-link ${cur(href) ? 'on' : ''}" href="${href}">${ic(icon)}<span>${label}</span>${extra}</a>`;
  const u = S.me;
  const ownerDot = (S.badges.deposits || 0) + (S.badges.orders || 0);
  d.innerHTML = `
    <div class="dr-head"><b>Menu</b><button class="dr-close" type="button" data-drawer="close" aria-label="Tutup menu"><svg viewBox="0 0 24 24" aria-hidden="true">${IC.close}</svg></button></div>
    ${u ? `<div class="dr-card">${avatarHtml(u)}<div class="dr-who"><b>${esc(u.displayName)}${ownerMark(u)}</b><small>@${esc(u.username)}</small></div><div class="dr-bal"><small>Saldo</small><b>${rp(u.balance)}</b></div></div>
    <div class="dr-group">
      ${link('#/akun', 'dash', 'Dashboard', S.badges.chat ? `<span class="dot">${S.badges.chat}</span>` : '')}
      ${link('#/akun/profil', 'user', 'Profil')}
      ${link('#/akun/info', 'id', 'Informasi Akun')}
      ${u.role === 'owner' ? link('#/owner', 'shield', 'Owner menu', ownerDot ? `<span class="dot">${ownerDot}</span>` : '') : ''}
    </div>` : `<div class="dr-auth"><p class="muted">Masuk untuk deposit, belanja, dan chat dengan owner.</p><button class="btn" type="button" data-act="login">Masuk</button><button class="btn ghost" type="button" data-act="register">Daftar</button></div>`}
    <div class="dr-group">
      <p class="dr-title">Toko</p>
      ${[['akun', '#akun', 'Akun Telegram'], ['produk', '#produk', 'Channel &amp; Panel'], ['topup', '#topup', 'Top Up Game'], ['nokos', '#nokos', 'Nokos']].map((x) => `<a class="dr-link plain" href="${x[1]}"><span>${x[2]}</span>${mtHide(x[0]) ? '<span class="badge b-pending">Maintenance</span>' : ''}</a>`).join('')}
    </div>
    ${u ? `<div class="dr-foot"><button class="dr-link danger" type="button" data-act="logout">${ic('out')}<span>Log out</span></button></div>` : ''}`;
}

function openDrawer() {
  renderDrawer();
  root.classList.add('drawer-open');
  $('#burger').setAttribute('aria-expanded', 'true');
  $('#drawer').setAttribute('aria-hidden', 'false');
  setTimeout(() => { const f = $('#drawer .dr-link, #drawer .btn'); if (f) f.focus({ preventScroll: true }); }, 60);
}

function closeDrawer() {
  if (!root.classList.contains('drawer-open')) return;
  const hadFocus = $('#drawer').contains(document.activeElement);
  root.classList.remove('drawer-open');
  $('#burger').setAttribute('aria-expanded', 'false');
  $('#drawer').setAttribute('aria-hidden', 'true');
  if (hadFocus) $('#burger').focus({ preventScroll: true });
}

/* ------------------------------------------------------------------ */
/* Auth                                                                */
/* ------------------------------------------------------------------ */
function openAuth(mode = 'login') {
  const reg = mode === 'register';
  formModal({
    title: reg ? 'Daftar akun' : 'Masuk',
    intro: reg ? 'Buat username dan password. Akunmu langsung aktif dan tersimpan.' : 'Masuk dengan username dan password kamu.',
    fields: [
      { name: 'username', label: 'Username', type: 'text', autocomplete: 'username', max: 20, hint: reg ? '3-20 karakter: huruf, angka, atau garis bawah.' : '' },
      { name: 'password', label: 'Password', type: 'password', autocomplete: reg ? 'new-password' : 'current-password', max: 100, hint: reg ? 'Minimal 6 karakter.' : '' },
    ],
    submit: reg ? 'Daftar' : 'Masuk',
    foot: { text: reg ? 'Sudah punya akun?' : 'Belum punya akun?', label: reg ? 'Masuk' : 'Daftar', fn: () => openAuth(reg ? 'login' : 'register') },
    onSubmit: async (v) => {
      const r = await api(reg ? '/register' : '/login', { username: v.username, password: v.password });
      S.me = r.user;
      await refreshMe();
      await loadNokos(); drawNokos();
      toast(reg ? 'Akun dibuat. Selamat datang!' : 'Berhasil masuk.');
      if (r.user.role === 'owner') location.hash = '#/owner';
      else if (reg) location.hash = '#/akun';
      else route(true);
    },
  });
}

async function logout() {
  try { await api('/logout', {}); } catch (_) { /* abaikan */ }
  S.me = null; S.badges = {};
  resetNokos(); drawNokos();
  if (S.config.requireLogin) showGate('login');
  renderNav();
  if (location.hash === '#/' || !location.hash) route(); else location.hash = '#/';
}

/* ------------------------------------------------------------------ */
/* Layar masuk (wajib login)                                           */
/* ------------------------------------------------------------------ */
let gateMode = 'login';
function setGateMode(mode) {
  gateMode = mode;
  $$('[data-gtab]').forEach((b) => { const on = b.dataset.gtab === mode; b.classList.toggle('on', on); b.setAttribute('aria-selected', String(on)); });
  $('#gSubmit').textContent = mode === 'login' ? 'Masuk' : 'Daftar sekarang';
  $('#gUserHint').hidden = mode === 'login';
  $('#gPassHint').hidden = mode === 'login';
  $('#gPass').setAttribute('autocomplete', mode === 'login' ? 'current-password' : 'new-password');
  $('#gErr').textContent = '';
}
function showGate(mode = 'login') {
  root.classList.add('gated');
  closeDrawer();
  setGateMode(mode);
  $('#gUser').value = ''; $('#gPass').value = '';
}
function hideGate() { root.classList.remove('gated'); }
function initGate() {
  $$('[data-gtab]').forEach((b) => b.addEventListener('click', () => setGateMode(b.dataset.gtab)));
  $('#gateForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = $('#gErr'); const btn = $('#gSubmit');
    err.textContent = '';
    const username = $('#gUser').value.trim(); const password = $('#gPass').value;
    if (!username || !password) { err.textContent = 'Isi username dan password dulu.'; return; }
    btn.disabled = true;
    try {
      const r = await api(gateMode === 'login' ? '/login' : '/register', { username, password });
      S.me = r.user;
      hideGate();
      await Promise.all([refreshMe(), loadProducts(), loadConfig(), loadNokos()]);
      renderProducts(); drawNokos(); startNokosTimers();
      applyMaintenance();
      toast(gateMode === 'register' ? 'Akun dibuat. Selamat datang!' : 'Berhasil masuk.');
      if (r.user.role === 'owner') location.hash = '#/owner';
      else if (gateMode === 'register') location.hash = '#/akun';
      else route(true);
      window.scrollTo({ top: 0, behavior: 'instant' });
    } catch (ex) { err.textContent = ex.message || 'Terjadi kesalahan.'; } finally { btn.disabled = false; }
  });
}

/* ------------------------------------------------------------------ */
/* Backsound                                                           */
/* ------------------------------------------------------------------ */
const bgm = $('#bgm');
const musicBtn = $('#music');
const musicPref = () => { try { return localStorage.getItem('bgm'); } catch (_) { return null; } };
const setMusicPref = (v) => { try { localStorage.setItem('bgm', v); } catch (_) { /* abaikan */ } };
function paintMusic() {
  const on = !bgm.paused;
  musicBtn.setAttribute('aria-pressed', String(on));
  musicBtn.setAttribute('aria-label', on ? 'Matikan musik' : 'Putar musik');
}
async function playMusic(remember) {
  try { bgm.volume = 0.35; await bgm.play(); if (remember) setMusicPref('on'); } catch (_) { /* diblokir browser */ }
  paintMusic();
}
function pauseMusic(remember) {
  bgm.pause();
  if (remember) setMusicPref('off');
  paintMusic();
}
function initMusic() {
  musicBtn.addEventListener('click', (e) => { e.stopPropagation(); if (bgm.paused) playMusic(true); else pauseMusic(true); });
  bgm.addEventListener('play', paintMusic);
  bgm.addEventListener('pause', paintMusic);
  if (musicPref() !== 'off') {
    // Browser melarang suara otomatis, jadi mulai pada sentuhan atau klik pertama.
    const first = (e) => {
      if (e.target && e.target.closest && e.target.closest('#music')) return; // tombol musik mengurus dirinya sendiri
      document.removeEventListener('pointerdown', first, true); document.removeEventListener('keydown', first, true);
      if (musicPref() !== 'off') playMusic(false);
    };
    document.addEventListener('pointerdown', first, true);
    document.addEventListener('keydown', first, true);
  }
  paintMusic();
}

/* ------------------------------------------------------------------ */
/* Landing: produk                                                     */
/* ------------------------------------------------------------------ */
function productCard(p, i) {
  const out = p.stock !== null && p.stock < 1;
  const stock = p.stock === null ? 'Selalu ready' : out ? 'Habis' : `Sisa ${p.stock}`;
  return `<article class="card reveal" data-fx="zoom" style="--i:${i % 4}">
    <div class="card-top"><span class="tag">${esc(CAT[p.category] || p.category)}</span><span class="stock">${stock}</span></div>
    <h3>${esc(p.title)}</h3>
    <p>${esc(p.description)}</p>
    <div class="card-bot"><strong>${rp(p.price)}</strong><button class="btn sm" data-act="buy" data-id="${p.id}" ${out ? 'disabled' : ''}>${out ? 'Stok habis' : 'Beli'}</button></div>
  </article>`;
}

function renderProducts() {
  const list = S.products.filter((p) => p.category !== 'akun' && (S.filter === 'all' || p.category === S.filter));
  $('#productGrid').innerHTML = list.length
    ? list.map(productCard).join('')
    : '<p class="muted">Belum ada produk di kategori ini. Chat owner untuk request.</p>';
  $$('#filters .chip').forEach((c) => c.classList.toggle('on', c.dataset.filter === S.filter));
  const cp = $('#cnt-panel');
  if (cp && !mtHide('produk')) cp.textContent = ticketText.produk();
  observe($('#productGrid'));
}

async function buyProduct(id) {
  if (!S.me) { toast('Masuk dulu untuk membeli.'); openAuth('login'); return; }
  const p = S.products.find((x) => x.id === id);
  if (!p) return;
  if (S.me.balance < p.price) {
    const go = await confirmModal({ title: 'Saldo belum cukup', text: `Harga ${rp(p.price)}, saldo kamu ${rp(S.me.balance)}. Deposit dulu, lalu beli lagi.`, submit: 'Ke halaman deposit' });
    if (go) location.hash = '#/akun/deposit';
    return;
  }
  const ok = await confirmModal({ title: 'Beli produk ini?', text: `${p.title}\nHarga ${rp(p.price)}\nSaldo setelah beli ${rp(S.me.balance - p.price)}`, submit: 'Beli sekarang' });
  if (!ok) return;
  try {
    const r = await api('/orders', { productId: id });
    S.me = r.user;
    renderNav();
    toast('Pesanan dibuat. Owner akan memprosesnya lewat chat.');
    await loadProducts();
    renderProducts();
    location.hash = '#/akun/pesanan';
  } catch (e) {
    toast(e.message, true);
    loadProducts().then(renderProducts);
  }
}

/* ------------------------------------------------------------------ */
/* Animasi scroll                                                      */
/* ------------------------------------------------------------------ */
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const io = 'IntersectionObserver' in window
  ? new IntersectionObserver((entries) => {
    entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
  }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' })
  : null;

function observe(scope = document) {
  $$('.reveal:not(.in), .tx:not(.in)', scope).forEach((el) => (io ? io.observe(el) : el.classList.add('in')));
}

let ticking = false;
function update() {
  ticking = false;
  const y = window.scrollY;
  const max = root.scrollHeight - window.innerHeight;
  root.style.setProperty('--p', (max > 0 ? Math.min(1, y / max) : 0).toFixed(4));
  const topEl = $('#top');
  if (topEl) topEl.classList.toggle('scrolled', y > 24);
  if (reduceMotion || S.inApp) return;
  const hero = $('#hero');
  const hh = hero.offsetHeight || 1;
  const s = Math.min(1, y / hh);
  root.style.setProperty('--s', s.toFixed(3));
  if (y < hh * 1.4) {
    const copy = $('#heroCopy');
    copy.style.transform = `translateY(${(y * 0.22).toFixed(1)}px)`;
    copy.style.opacity = String(Math.max(0, 1 - s * 0.9).toFixed(3));
    $('.orb-a').style.transform = `translateY(${(y * 0.25).toFixed(1)}px)`;
    $('.orb-b').style.transform = `translateY(${(-y * 0.12).toFixed(1)}px)`;
  }
  $('#bandA').style.transform = `translateX(${(-y * 0.35).toFixed(1)}px)`;
  $('#bandB').style.transform = `translateX(${(-1200 + y * 0.35).toFixed(1)}px)`;
}
function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(update); } }

/* ------------------------------------------------------------------ */
/* Router                                                              */
/* ------------------------------------------------------------------ */
function showLanding() {
  const was = $('#landing').hidden;
  $('#landing').hidden = false;
  $('#appView').hidden = true;
  root.classList.remove('is-app');
  S.inApp = false;
  if (NK.order && NK.order.status === 'waiting' && !NK.poll) startNokosTimers();
  if (was) {
    const id = location.hash.replace(/^#\/?/, '');
    const el = id ? document.getElementById(id) : null;
    if (el) el.scrollIntoView({ behavior: 'instant' }); else window.scrollTo({ top: 0, behavior: 'instant' });
  } else if (location.hash === '#/') {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  update();
}

function showApp(keepScroll) {
  stopNokos();
  stopAkun();
  $('#landing').hidden = true;
  $('#appView').hidden = false;
  root.classList.add('is-app');
  S.inApp = true;
  if (!keepScroll) window.scrollTo({ top: 0, behavior: 'instant' });
  update();
}

async function route(keepScroll) {
  clearPoll();
  S.keepFx = keepScroll === true;
  if (S.keepFx) setTimeout(() => { S.keepFx = false; }, 900);
  closeDrawer();
  renderDrawer();
  if (S.me && keepScroll !== true) refreshMe();
  const h = location.hash;
  const m = /^#\/(akun|owner)(?:\/([^/]*))?(?:\/([^/]*))?/.exec(h);
  if (!m) { showLanding(); return; }
  if (!S.me) {
    history.replaceState(null, '', '#/');
    showLanding();
    if (!root.classList.contains('gated')) { toast('Masuk dulu untuk membuka halaman ini.'); openAuth('login'); }
    return;
  }
  if (m[1] === 'owner' && S.me.role !== 'owner') {
    history.replaceState(null, '', '#/');
    showLanding();
    toast('Halaman ini khusus owner.', true);
    return;
  }
  showApp(keepScroll === true);
  if (m[1] === 'akun') renderAccount(m[2]); else renderOwner(m[2], m[3]);
}

function appShell({ title, tabs, cur, base, right = '' }) {
  return `<div class="app-head"><h1>${esc(title)}</h1>${right}</div>
    <nav class="tabs" aria-label="Menu">${tabs.map((t) => `<a href="#/${base}/${t.id}" class="${t.id === cur ? 'on' : ''}">${esc(t.label)}${t.badge ? `<span class="dot">${t.badge}</span>` : ''}</a>`).join('')}</nav>
    <div id="tabBody"></div>`;
}

async function guard(body, fn) {
  try { await fn(); } catch (e) {
    if (e.status === 401) { S.me = null; if (S.config.requireLogin) showGate('login'); renderNav(); route(); return; }
    body.innerHTML = `<div class="panel empty">${esc(e.message)}</div>`;
  }
}

function renderMsgs(el, msgs, mine, prevLen) {
  const near = !el.children.length || el.scrollHeight - el.scrollTop - el.clientHeight < 90;
  const label = (m) => {
    if (m.from === 'owner' && mine === 'user') return `<em class="bc">${m.broadcast ? 'Pengumuman dari owner' : 'Owner'}${VBADGE}</em>`;
    return m.broadcast ? '<em class="bc">Broadcast</em>' : '';
  };
  el.innerHTML = msgs.length
    ? msgs.map((m, i) => `<div class="bub ${m.from === mine ? 'me' : 'them'} ${i >= prevLen && prevLen > 0 ? 'new' : ''}">${label(m)}${esc(m.text)}<small>${dt(m.createdAt)}</small></div>`).join('')
    : '<div class="empty">Belum ada pesan. Tulis pesan pertamamu di bawah.</div>';
  if (near) el.scrollTop = el.scrollHeight;
  return msgs.length;
}

/* ------------------------------------------------------------------ */
/* Halaman akun                                                        */
/* ------------------------------------------------------------------ */
function renderAccount(tab) {
  const tabs = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'profil', label: 'Profil' },
    { id: 'info', label: 'Informasi Akun' },
    { id: 'deposit', label: 'Deposit' },
    { id: 'pesanan', label: 'Pesanan' },
    { id: 'chat', label: 'Chat', badge: S.badges.chat },
  ];
  if (!tabs.some((t) => t.id === tab)) tab = 'dashboard';
  $('#appView').innerHTML = appShell({
    title: 'Akun saya', tabs, cur: tab, base: 'akun',
    right: `<div class="balance"><small>Saldo</small><b id="accBal">${rp(S.me.balance)}</b></div>`,
  });
  const body = $('#tabBody');
  const fn = { dashboard: tabDashboard, profil: tabProfile, info: tabInfo, deposit: tabDeposit, pesanan: tabOrders, chat: tabChat }[tab];
  guard(body, () => fn(body));
}

function fileToAvatar(file) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) return reject(new Error('Pilih file gambar.'));
    const fr = new FileReader();
    fr.onerror = () => reject(new Error('File tidak bisa dibaca.'));
    fr.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('File gambar tidak bisa dibuka.'));
      img.onload = () => {
        const size = 192;
        const c = document.createElement('canvas');
        c.width = size; c.height = size;
        const m = Math.min(img.width, img.height);
        c.getContext('2d').drawImage(img, (img.width - m) / 2, (img.height - m) / 2, m, m, 0, 0, size, size);
        resolve(c.toDataURL('image/jpeg', 0.82));
      };
      img.src = fr.result;
    };
    fr.readAsDataURL(file);
  });
}

async function tabDashboard(body) {
  const [{ orders }, { deposits }] = await Promise.all([api('/orders'), api('/deposits')]);
  const u = S.me;
  const pendOrders = orders.filter((o) => o.status === 'pending').length;
  const pendDep = deposits.filter((d) => d.status === 'pending').length;
  body.innerHTML = `
    <div class="hello panel" style="${customColor(u.color) ? `--uc:${esc(customColor(u.color))}` : ''}">
      ${avatarHtml(u, 'lg')}
      <div class="hello-t"><small>Halo,</small><h2>${esc(u.displayName)}${ownerMark(u)}</h2><span class="muted">@${esc(u.username)}</span></div>
      <div class="hello-bal"><small>Saldo kamu</small><b>${rp(u.balance)}</b></div>
      <div class="row"><a class="btn" href="#/akun/deposit">Isi saldo</a><a class="btn ghost" href="#produk">Belanja</a></div>
    </div>
    <div class="stats">
      <a class="stat" href="#/akun/pesanan"><b>${orders.length}</b><span>Pesanan</span><small>${pendOrders} sedang diproses</small></a>
      <a class="stat" href="#/akun/deposit"><b>${pendDep}</b><span>Deposit menunggu</span><small>${deposits.length} total</small></a>
      <a class="stat" href="#/akun/chat"><b>${S.badges.chat || 0}</b><span>Pesan baru</span><small>dari owner</small></a>
    </div>
    <div class="panel">
      <h2>Pesanan terakhir</h2>
      <div class="list">${orders.length ? orders.slice(0, 3).map((o) => `<div class="item"><div class="item-main"><div class="grow"><b>${esc(o.title)}</b><small>Order #${o.id}, ${dt(o.createdAt)}</small></div><div style="text-align:right"><span class="amount">${rp(o.price)}</span><br><span class="badge b-${o.status}">${STATUS[o.status]}</span></div></div></div>`).join('') : '<div class="empty">Belum ada pesanan. Pilih produk di halaman utama.</div>'}</div>
    </div>`;
}

function tabInfo(body) {
  const u = S.me;
  const rows = [
    ['Username', `@${u.username}`],
    ['Nama tampilan', u.displayName],
    ['Peran', u.role === 'owner' ? `Owner${VBADGE}` : 'Pengguna', true],
    ['ID akun', `#${u.id}`],
    ['Terdaftar', new Date(u.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })],
    ['Saldo', rp(u.balance)],
  ];
  body.innerHTML = `<div class="panel narrow">
    <h2>Informasi akun</h2>
    <dl class="info">
      ${rows.map((r) => `<dt>${esc(r[0])}</dt><dd>${r[2] ? r[1] : esc(r[1])}</dd>`).join('')}
      <dt>Password</dt><dd><span class="mask">••••••••</span><button class="btn sm ghost" type="button" id="pwOpen">Ganti</button></dd>
    </dl>
    <p class="note">Password disimpan terenkripsi, jadi tidak bisa dilihat siapa pun, termasuk owner. Kalau lupa, minta owner mereset lewat chat.</p>
  </div>`;
  $('#pwOpen').addEventListener('click', () => formModal({
    title: 'Ganti password',
    fields: [
      { name: 'current', label: 'Password lama', type: 'password', autocomplete: 'current-password', max: 100 },
      { name: 'next', label: 'Password baru', type: 'password', autocomplete: 'new-password', max: 100, hint: 'Minimal 6 karakter.' },
    ],
    submit: 'Ganti password',
    onSubmit: async (v) => { await api('/password', { current: v.current, next: v.next }); toast('Password diganti.'); },
  }));
}

function tabProfile(body) {
  const u = S.me;
  let avatar = u.avatar || '';
  let color = customColor(u.color);
  body.innerHTML = `<div class="panel narrow">
      <h2>Profil</h2>
      <form id="profForm" novalidate>
        <div class="avatar-edit">
          <span id="avPrev"></span>
          <div class="row">
            <button type="button" class="btn ghost sm" id="avPick">Ganti foto</button>
            <button type="button" class="btn ghost sm" id="avClear">Hapus foto</button>
            <input class="file-hidden" id="avFile" type="file" accept="image/*" tabindex="-1">
          </div>
        </div>
        <div class="field"><label>Username</label><input type="text" value="@${esc(u.username)}" disabled></div>
        <div class="field"><label for="pn">Nama tampilan</label><input id="pn" type="text" maxlength="30" value="${esc(u.displayName)}"></div>
        <div class="field"><label for="pb">Bio</label><textarea id="pb" maxlength="160" placeholder="Ceritakan sedikit tentang kamu">${esc(u.bio)}</textarea></div>
        <div class="field"><label>Warna profil</label><div class="swatches" id="sws">${COLORS.map((c) => `<button type="button" class="sw ${c === color ? 'on' : ''}" style="--c:${c || 'var(--sky)'}" data-c="${c}" aria-label="${c ? `Warna ${c}` : 'Warna tema'}"></button>`).join('')}</div></div>
        <p class="form-err" id="profErr" role="alert"></p>
        <button class="btn" type="submit">Simpan profil</button>
      </form>
    </div>`;

  const paint = () => {
    $('#avPrev').innerHTML = avatarHtml({ displayName: $('#pn').value || u.username, username: u.username, avatar, color }, 'lg');
  };
  paint();
  $('#pn').addEventListener('input', paint);
  $('#avPick').addEventListener('click', () => $('#avFile').click());
  $('#avClear').addEventListener('click', () => { avatar = ''; paint(); });
  $('#avFile').addEventListener('change', async (e) => {
    try { avatar = await fileToAvatar(e.target.files[0]); paint(); } catch (ex) { toast(ex.message, true); }
    e.target.value = '';
  });
  $('#sws').addEventListener('click', (e) => {
    const b = e.target.closest('.sw');
    if (!b) return;
    color = b.dataset.c;
    $$('#sws .sw').forEach((x) => x.classList.toggle('on', x === b));
    paint();
  });
  $('#profForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    $('#profErr').textContent = '';
    try {
      const r = await api('/profile', { displayName: $('#pn').value, bio: $('#pb').value, avatar, color });
      S.me = r.user;
      renderNav();
      toast('Profil disimpan.');
    } catch (ex) { $('#profErr').textContent = ex.message; }
  });
}

async function tabDeposit(body) {
  const cfg = S.config;
  const { deposits } = await api('/deposits');
  const methods = cfg.paymentMethods || [];
  const resume = deposits.find((d) => d.auto && d.status === 'pending' && (!d.expiresAt || d.expiresAt > Date.now()));
  const manual = methods.length ? `
      <p class="muted" style="margin-bottom:1rem">Transfer dulu ke salah satu metode di bawah, lalu kirim permintaan deposit. Saldo masuk setelah owner mengonfirmasi.</p>
      <div class="pay">${methods.map((m) => `<div><b>${esc(m.name)}</b><br><span class="muted">${esc(m.detail)}</span></div>`).join('')}</div>
      <form id="depForm" novalidate>
        <div class="field"><label for="dAmt">Nominal (Rp)</label><input id="dAmt" type="number" inputmode="numeric" min="${cfg.minDeposit}" placeholder="Minimal ${rp(cfg.minDeposit)}"></div>
        <div class="field"><label for="dMeth">Metode yang dipakai</label><select id="dMeth">${methods.map((m) => `<option>${esc(m.name)}</option>`).join('')}</select></div>
        <div class="field"><label for="dNote">Catatan</label><input id="dNote" type="text" maxlength="200" placeholder="Nama pengirim atau 4 digit terakhir rekening"></div>
        <p class="form-err" id="depErr" role="alert"></p>
        <button class="btn ghost" type="submit">Kirim permintaan deposit</button>
      </form>` : '';
  body.innerHTML = `<div class="cols">
    <div class="panel" id="payMain"></div>
    <div class="panel">
      <h2>Riwayat deposit</h2>
      <div class="list">${deposits.length ? deposits.map((d) => `<div class="item ${d.status === 'pending' ? 'pend' : ''}"><div class="item-main"><div class="grow"><b>Deposit #${d.id}</b><small>${dt(d.createdAt)}${d.method ? `, ${esc(d.method)}` : ''}</small></div><div style="text-align:right"><span class="amount">${rp(d.amount)}</span><br><span class="badge b-${d.status}">${STATUS[d.status] || esc(d.status)}</span></div></div>${d.auto && d.status === 'pending' && (!d.expiresAt || d.expiresAt > Date.now()) ? `<div class="item-act"><button class="btn sm" type="button" data-resume="${d.id}">Lanjut bayar</button></div>` : ''}</div>`).join('') : '<div class="empty">Belum ada deposit.</div>'}</div>
    </div>
  </div>`;
  const main = $('#payMain');

  const stopPay = () => { clearInterval(S.payTimer); S.payTimer = null; clearPoll(); };

  const showForm = () => {
    stopPay();
    main.innerHTML = `
      ${cfg.autoPay ? `<h2>Isi saldo lewat QRIS</h2>
      <p class="muted" style="margin-bottom:1rem">Bayar dari aplikasi bank atau e-wallet apa saja. Saldo masuk otomatis setelah pembayaran berhasil.</p>
      <form id="autoForm" novalidate>
        <div class="quick">${[10000, 25000, 50000, 100000].map((n) => `<button type="button" class="chip" data-amt="${n}">${rp(n)}</button>`).join('')}</div>
        <div class="field"><label for="aAmt">Nominal (Rp)</label><input id="aAmt" type="number" inputmode="numeric" min="${cfg.minDeposit}" placeholder="Minimal ${rp(cfg.minDeposit)}"></div>
        <p class="form-err" id="aErr" role="alert"></p>
        <button class="btn big" type="submit" style="width:100%">Buat QRIS</button>
      </form>` : '<h2>Isi saldo</h2>'}
      ${manual ? (cfg.autoPay ? `<details class="fold"><summary>Transfer manual</summary>${manual}</details>` : manual) : ''}
      ${!cfg.autoPay && !manual ? '<div class="muted">Metode pembayaran belum diatur. Chat owner.</div>' : ''}`;
    $('#autoForm') && $('#autoForm').addEventListener('click', (e) => { const b = e.target.closest('[data-amt]'); if (b) $('#aAmt').value = b.dataset.amt; });
    $('#autoForm') && $('#autoForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      $('#aErr').textContent = '';
      const btn = $('#autoForm button[type=submit]'); btn.disabled = true;
      try { await api('/deposits/auto', { amount: $('#aAmt').value }); route(true); } catch (ex) { $('#aErr').textContent = ex.message; } finally { btn.disabled = false; }
    });
    $('#depForm') && $('#depForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      $('#depErr').textContent = '';
      try {
        await api('/deposits', { amount: $('#dAmt').value, method: $('#dMeth').value, note: $('#dNote').value });
        toast('Permintaan deposit terkirim. Tunggu konfirmasi owner.');
        route(true);
      } catch (ex) { $('#depErr').textContent = ex.message; }
    });
  };

  const showPaid = (dep, balance) => {
    stopPay();
    main.innerHTML = `<div class="pay-done">
      <div class="tick"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></div>
      <h2 style="margin:0">Pembayaran berhasil</h2>
      <p class="muted">Deposit ${rp(dep.amount)} sudah masuk.${balance != null ? ` Saldo kamu sekarang ${rp(balance)}.` : ''}</p>
      <div class="row"><a class="btn" href="#akun">Belanja</a><button class="btn ghost" type="button" id="payAgain">Deposit lagi</button></div>
    </div>`;
    $('#payAgain').addEventListener('click', () => route(true));
  };

  const showQr = (dep) => {
    stopPay();
    const art = dep.qrString && window.QR ? window.QR.toSvg(dep.qrString) : (dep.qrImage ? `<img src="${esc(dep.qrImage)}" alt="Kode QR pembayaran">` : '');
    main.innerHTML = `<div class="qrview">
      <h2 style="margin:0">Scan untuk bayar</h2>
      <div class="qr-box">${art || '<p style="color:#222;padding:1rem">QR belum tersedia. Hubungi owner.</p>'}</div>
      <div class="qr-amount">${rp(dep.amount)}</div>
      <p class="muted">Buka aplikasi bank atau e-wallet, pilih Scan QRIS, lalu bayar sesuai nominal.</p>
      <div class="countdown" id="qrLeft">--:--</div>
      <span class="badge b-pending" id="qrState">Menunggu pembayaran</span>
      <button class="btn ghost" type="button" id="qrCancel">Batalkan</button>
    </div>`;
    const tick = () => {
      const left = Math.max(0, Math.round(((dep.expiresAt || 0) - Date.now()) / 1000));
      const el = $('#qrLeft');
      if (el) el.textContent = dep.expiresAt ? mmss(left) : '';
    };
    tick();
    S.payTimer = setInterval(tick, 1000);
    const check = async () => {
      const r = await api('/deposits/' + dep.id);
      const d = r.deposit;
      if (d.status === 'approved') { await refreshMe(); toast('Deposit berhasil. Saldo masuk.'); showPaid(d, r.balance); }
      else if (d.status === 'review') { stopPay(); main.innerHTML = '<h2>Perlu dicek owner</h2><p class="muted">Pembayaranmu terdeteksi tapi nominalnya tidak cocok. Owner akan mengeceknya, silakan chat.</p>'; }
      else if (d.status !== 'pending') { toast(d.status === 'expired' ? 'Waktu bayar habis.' : 'Deposit dibatalkan.', true); route(true); }
    };
    setPoll(check, 4000);
    $('#qrCancel').addEventListener('click', async () => {
      try { await api(`/deposits/${dep.id}/cancel`, {}); toast('Deposit dibatalkan.'); route(true); } catch (ex) { toast(ex.message, true); }
    });
  };

  if (resume) showQr(resume); else showForm();
  body.addEventListener('click', (e) => {
    const b = e.target.closest('[data-resume]');
    if (!b) return;
    const d = deposits.find((x) => x.id === Number(b.dataset.resume));
    if (d) { showQr(d); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  });
}

async function tabOrders(body) {
  const [{ orders }, { transactions }, nk] = await Promise.all([api('/orders'), api('/transactions'), api('/nokos/orders').catch(() => ({ orders: [] }))]);
  body.innerHTML = `<div class="cols">
    <div class="panel"><h2>Pesanan</h2><div class="list">${orders.length ? orders.map((o) => `<div class="item"><div class="item-main"><div class="grow"><b>${esc(o.title)}</b><small>Order #${o.id}, ${dt(o.createdAt)}</small></div><div style="text-align:right"><span class="amount">${rp(o.price)}</span><br><span class="badge b-${o.status}">${STATUS[o.status] || esc(o.status)}</span></div></div></div>`).join('') : '<div class="empty">Belum ada pesanan. Pilih produk di halaman utama.</div>'}</div></div>
    <div class="panel"><h2>Pesanan nokos</h2><div class="list">${nk.orders.length ? nk.orders.map((o) => `<div class="item"><div class="item-main"><div class="grow"><b>${esc(o.service)} ${esc(o.country)}</b><small>${esc(o.number)}</small><small>${o.otp ? `Kode: ${esc(o.otp)}, ` : ''}${dt(o.createdAt)}</small></div><div style="text-align:right"><span class="amount">${rp(o.price)}</span><br><span class="badge b-${o.status === 'waiting' ? 'pending' : o.status}">${STATUS[o.status] || esc(o.status)}</span></div></div></div>`).join('') : '<div class="empty">Belum ada pesanan nokos.</div>'}</div></div>
    <div class="panel"><h2>Riwayat saldo</h2><div class="list">${transactions.length ? transactions.map((t) => `<div class="item"><div class="item-main"><div class="grow"><b>${esc(t.note || t.type)}</b><small>${dt(t.createdAt)}</small></div><span class="amount ${t.amount < 0 ? 'neg' : ''}">${t.amount > 0 ? '+' : ''}${rp(t.amount)}</span></div></div>`).join('') : '<div class="empty">Belum ada transaksi saldo.</div>'}</div></div>
  </div>`;
}

async function tabChat(body) {
  body.innerHTML = `<div class="chat">
    <div class="chat-head"><span class="av">O</span><div class="grow"><b>Owner${VBADGE}</b><small>Balasan muncul di sini. Bisa juga lewat Telegram @${esc(S.config.telegram)}</small></div></div>
    <div class="msgs" id="msgs"></div>
    <form class="chat-form" id="chatForm"><input type="text" id="chatIn" maxlength="1000" placeholder="Tulis pesan" autocomplete="off"><button class="btn" type="submit">Kirim</button></form>
  </div>`;
  let key = ''; let len = 0;
  const load = async () => {
    const { messages } = await api('/chat');
    const k = messages.length + ':' + (messages.length ? messages[messages.length - 1].id : 0);
    if (k === key) return;
    key = k;
    len = renderMsgs($('#msgs'), messages, 'user', len);
  };
  await load();
  refreshMe();
  const dot = $('.tabs a.on .dot');
  if (dot) dot.remove();
  $('#chatForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = $('#chatIn').value.trim();
    if (!text) return;
    $('#chatIn').value = '';
    try { await api('/chat', { text }); key = ''; await load(); } catch (ex) { toast(ex.message, true); $('#chatIn').value = text; }
  });
  setPoll(load, 4000);
}

/* ------------------------------------------------------------------ */
/* Owner menu                                                          */
/* ------------------------------------------------------------------ */
function renderOwner(tab, arg) {
  const b = S.badges || {};
  const tabs = [
    { id: 'users', label: 'Pengguna' },
    { id: 'deposits', label: 'Deposit', badge: b.deposits },
    { id: 'orders', label: 'Pesanan', badge: b.orders },
    { id: 'products', label: 'Produk' },
    { id: 'nokos', label: 'Nokos' },
    { id: 'payment', label: 'Pembayaran' },
    { id: 'maintenance', label: 'Maintenance', badge: Object.values(S.config.maintenance || {}).filter((x) => x.on).length || undefined },
    { id: 'broadcast', label: 'Broadcast' },
    { id: 'chat', label: 'Chat', badge: b.chat },
  ];
  if (!tabs.some((t) => t.id === tab)) tab = 'users';
  $('#appView').innerHTML = appShell({ title: 'Owner menu', tabs, cur: tab, base: 'owner' });
  const body = $('#tabBody');
  const fn = { users: otUsers, deposits: otDeposits, orders: otOrders, products: otProducts, nokos: otNokos, payment: otPayment, maintenance: otMaintenance, broadcast: otBroadcast, chat: otChat }[tab];
  guard(body, () => fn(body, arg));
}

function balanceModal(u, after) {
  formModal({
    title: `Saldo @${u.username}`,
    intro: `Saldo sekarang ${rp(u.balance)}. Pilih tambah atau kurangi, lalu isi nominalnya.`,
    fields: [
      { name: 'mode', label: 'Tindakan', type: 'select', options: [['add', 'Tambah saldo'], ['sub', 'Kurangi saldo']], value: 'add' },
      { name: 'amount', label: 'Nominal (Rp)', type: 'number', placeholder: 'contoh 25000' },
      { name: 'note', label: 'Catatan (opsional)', type: 'text', max: 100 },
    ],
    submit: 'Simpan saldo',
    onSubmit: async (v) => {
      const n = Number(v.amount);
      if (!v.amount || !Number.isInteger(n) || n <= 0) throw new Error('Isi nominal dengan angka bulat lebih dari 0.');
      await api('/owner/balance', { userId: u.id, amount: v.mode === 'sub' ? -n : n, note: v.note });
      toast('Saldo diperbarui.');
      await refreshMe();
      if (after) await after();
    },
  });
}

function userRow(u) {
  return `<div class="item">
    <div class="item-main">${avatarHtml(u)}
      <div class="grow"><b>${esc(u.displayName)} ${u.banned ? '<span class="badge b-banned">Diblokir</span>' : ''}</b><small>@${esc(u.username)}</small><small>Daftar ${dt(u.createdAt)}, ${u.orders} pesanan</small></div>
      <span class="amount">${rp(u.balance)}</span>
    </div>
    <div class="item-act">
      <button class="btn sm" data-ua="balance" data-id="${u.id}">Atur saldo</button>
      <a class="btn sm ghost" href="#/owner/chat/${u.id}">Chat${u.unread ? ` <span class="dot">${u.unread}</span>` : ''}</a>
      <button class="btn sm ghost" data-ua="pw" data-id="${u.id}">Reset password</button>
      <button class="btn sm ghost" data-ua="ban" data-id="${u.id}">${u.banned ? 'Buka blokir' : 'Blokir'}</button>
    </div>
  </div>`;
}

async function otUsers(body) {
  const { users } = await api('/owner/users');
  body.innerHTML = `<div class="panel" style="margin-bottom:1rem">
    <div class="item-main"><div class="grow"><b>Saldo owner</b><small>Saldo akunmu sendiri, bisa dipakai belanja atau tes</small></div><span class="amount">${rp(S.me.balance)}</span><button class="btn sm" type="button" id="selfBal">Tambah saldo</button></div>
  </div>
  <div class="panel">
    <h2>Pengguna terdaftar (${users.length})</h2>
    <div class="field"><input type="search" id="uq" placeholder="Cari username atau nama" aria-label="Cari pengguna"></div>
    <div class="list" id="ulist"></div>
  </div>`;
  $('#selfBal').addEventListener('click', () => balanceModal(S.me, () => route(true)));
  const draw = () => {
    const q = $('#uq').value.trim().toLowerCase();
    const arr = users.filter((u) => !q || u.username.includes(q) || u.displayName.toLowerCase().includes(q));
    $('#ulist').innerHTML = arr.length ? arr.map(userRow).join('') : `<div class="empty">${users.length ? 'Tidak ada yang cocok.' : 'Belum ada pengguna yang mendaftar.'}</div>`;
  };
  draw();
  $('#uq').addEventListener('input', draw);
  $('#ulist').addEventListener('click', (e) => {
    const b = e.target.closest('[data-ua]');
    if (!b) return;
    const u = users.find((x) => x.id === Number(b.dataset.id));
    if (!u) return;
    if (b.dataset.ua === 'balance') balanceModal(u, () => route(true));
    if (b.dataset.ua === 'pw') {
      const gen = Array.from(crypto.getRandomValues(new Uint8Array(8)), (n) => 'abcdefghjkmnpqrstuvwxyz23456789'[n % 31]).join('');
      formModal({
        title: `Reset password @${u.username}`,
        intro: 'Password baru berlaku langsung dan user keluar dari semua perangkat. Kirim password ini ke user lewat chat atau Telegram.',
        fields: [{ name: 'password', label: 'Password baru', type: 'text', value: gen, max: 100 }],
        submit: 'Reset password',
        onSubmit: async (v) => { await api(`/owner/users/${u.id}/password`, { password: v.password }); toast('Password direset.'); },
      });
    }
    if (b.dataset.ua === 'ban') {
      confirmModal({
        title: u.banned ? 'Buka blokir?' : 'Blokir user?',
        text: u.banned ? `@${u.username} bisa masuk dan belanja lagi.` : `@${u.username} akan keluar dari semua perangkat dan tidak bisa masuk.`,
        submit: u.banned ? 'Buka blokir' : 'Blokir', danger: !u.banned,
      }).then(async (ok) => {
        if (!ok) return;
        try { await api(`/owner/users/${u.id}/ban`, { banned: !u.banned }); toast('Status akun diperbarui.'); route(true); } catch (ex) { toast(ex.message, true); }
      });
    }
  });
}

async function otDeposits(body) {
  const { deposits } = await api('/owner/deposits');
  body.innerHTML = `<div class="panel"><h2>Permintaan deposit</h2><div class="list">${deposits.length ? deposits.map((d) => `<div class="item ${d.status === 'pending' ? 'pend' : ''}">
    <div class="item-main">${avatarHtml(d.user)}<div class="grow"><b>${esc(d.user.displayName)}</b><small>@${esc(d.user.username)}</small><small>Deposit #${d.id}${d.method ? `, ${esc(d.method)}` : ''}, ${dt(d.createdAt)}</small>${d.note ? `<small>Catatan: ${esc(d.note)}</small>` : ''}</div>
    <div style="text-align:right"><span class="amount">${rp(d.amount)}</span><br><span class="badge b-${d.status}">${STATUS[d.status]}</span></div></div>
    ${(d.status === 'pending' && d.provider !== 'atlantic') || d.status === 'review' ? `<div class="item-act"><button class="btn sm" data-da="approve" data-id="${d.id}">Setujui</button><button class="btn sm ghost" data-da="reject" data-id="${d.id}">Tolak</button><a class="btn sm ghost" href="#/owner/chat/${d.user.id}">Chat</a></div>` : ''}
  </div>`).join('') : '<div class="empty">Belum ada permintaan deposit.</div>'}</div></div>`;
  body.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-da]');
    if (!b) return;
    const d = deposits.find((x) => x.id === Number(b.dataset.id));
    const approve = b.dataset.da === 'approve';
    const ok = await confirmModal({
      title: approve ? 'Setujui deposit?' : 'Tolak deposit?',
      text: approve ? `Saldo @${d.user.username} bertambah ${rp(d.amount)} sekarang juga.` : `Deposit #${d.id} ditandai ditolak dan user diberi tahu lewat chat.`,
      submit: approve ? 'Setujui' : 'Tolak', danger: !approve,
    });
    if (!ok) return;
    try { await api('/owner/deposits/' + d.id, { action: b.dataset.da }); toast(approve ? 'Deposit disetujui, saldo masuk.' : 'Deposit ditolak.'); await refreshMe(); route(true); } catch (ex) { toast(ex.message, true); }
  });
}

async function otOrders(body) {
  const { orders } = await api('/owner/orders');
  body.innerHTML = `<div class="panel"><h2>Pesanan masuk</h2><div class="list">${orders.length ? orders.map((o) => `<div class="item ${o.status === 'pending' ? 'pend' : ''}">
    <div class="item-main">${avatarHtml(o.user)}<div class="grow"><b>${esc(o.title)}</b><small>@${esc(o.user.username)}</small><small>Order #${o.id}, ${dt(o.createdAt)}</small></div>
    <div style="text-align:right"><span class="amount">${rp(o.price)}</span><br><span class="badge b-${o.status}">${STATUS[o.status]}</span></div></div>
    <div class="item-act">${o.status === 'pending' ? `<button class="btn sm" data-oa="done" data-id="${o.id}">Tandai selesai</button><button class="btn sm ghost" data-oa="cancel" data-id="${o.id}">Batalkan dan refund</button>` : ''}<a class="btn sm ghost" href="#/owner/chat/${o.user.id}">Chat</a></div>
  </div>`).join('') : '<div class="empty">Belum ada pesanan.</div>'}</div></div>`;
  body.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-oa]');
    if (!b) return;
    const o = orders.find((x) => x.id === Number(b.dataset.id));
    const done = b.dataset.oa === 'done';
    const ok = await confirmModal({
      title: done ? 'Tandai selesai?' : 'Batalkan pesanan?',
      text: done ? `Order #${o.id} ditandai selesai dan user diberi tahu.` : `Saldo ${rp(o.price)} dikembalikan ke @${o.user.username} dan stok produk bertambah satu.`,
      submit: done ? 'Tandai selesai' : 'Batalkan dan refund', danger: !done,
    });
    if (!ok) return;
    try { await api('/owner/orders/' + o.id, { action: b.dataset.oa }); toast(done ? 'Pesanan selesai.' : 'Pesanan dibatalkan, saldo dikembalikan.'); await refreshMe(); route(true); } catch (ex) { toast(ex.message, true); }
  });
}

function productModal(p) {
  const isNew = !p;
  const v = p || { category: 'akun', title: '', description: '', price: '', stock: null, active: true };
  formModal({
    title: isNew ? 'Tambah produk' : 'Edit produk',
    fields: [
      { name: 'category', label: 'Kategori', type: 'select', options: Object.entries(CAT), value: v.category },
      { name: 'title', label: 'Nama produk', type: 'text', value: v.title, max: 80 },
      { name: 'description', label: 'Deskripsi', type: 'textarea', value: v.description, max: 300 },
      { name: 'price', label: 'Harga (Rp)', type: 'number', value: v.price },
      { name: 'stock', label: 'Stok', type: 'number', value: v.stock == null ? '' : v.stock, hint: 'Kosongkan jika stok tidak terbatas.' },
      { name: 'active', label: 'Tampilkan di toko', type: 'checkbox', value: v.active },
    ],
    submit: 'Simpan produk',
    onSubmit: async (f) => {
      if (!f.title.trim()) throw new Error('Nama produk wajib diisi.');
      if (f.price === '') throw new Error('Harga wajib diisi.');
      await api('/owner/products', { id: p ? p.id : undefined, category: f.category, title: f.title, description: f.description, price: f.price, stock: f.stock, active: f.active });
      toast('Produk disimpan.');
      await loadProducts();
      renderProducts();
      route(true);
    },
  });
}

async function otProducts(body) {
  const { products } = await api('/owner/products');
  body.innerHTML = `<div class="panel"><div class="app-head" style="margin-bottom:1rem"><h2 style="margin:0">Produk (${products.length})</h2><button class="btn sm" data-pa="new">Tambah produk</button></div>
    <div class="list">${products.length ? products.map((p) => `<div class="item"><div class="item-main"><div class="grow"><b>${esc(p.title)} ${p.active ? '' : '<span class="badge b-cancelled">Disembunyikan</span>'}</b><small>${esc(CAT[p.category])}, ${p.stock === null ? 'stok tak terbatas' : `stok ${p.stock}`}</small></div><span class="amount">${rp(p.price)}</span></div>
    <div class="item-act"><button class="btn sm ghost" data-pa="edit" data-id="${p.id}">Edit</button><button class="btn sm ghost" data-pa="del" data-id="${p.id}">Hapus</button></div></div>`).join('') : '<div class="empty">Belum ada produk.</div>'}</div></div>`;
  body.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-pa]');
    if (!b) return;
    const p = products.find((x) => x.id === Number(b.dataset.id));
    if (b.dataset.pa === 'new') productModal(null);
    if (b.dataset.pa === 'edit') productModal(p);
    if (b.dataset.pa === 'del') {
      const ok = await confirmModal({ title: 'Hapus produk?', text: `${p.title} dihapus dari toko. Pesanan lama tidak terpengaruh.`, submit: 'Hapus', danger: true });
      if (!ok) return;
      try { await api(`/owner/products/${p.id}/delete`, {}); toast('Produk dihapus.'); await loadProducts(); renderProducts(); route(true); } catch (ex) { toast(ex.message, true); }
    }
  });
}

async function otMaintenance(body) {
  const { maintenance, timezoneLabel } = await api('/owner/maintenance');
  const afterChange = async () => { await loadConfig(); applyMaintenance(); route(true); };
  body.innerHTML = `<div class="panel">
    <div class="app-head" style="margin-bottom:.6rem"><h2 style="margin:0">Maintenance</h2><div class="row"><button class="btn sm danger" type="button" data-mall="on">Maintenance semua</button><button class="btn sm ghost" type="button" data-mall="off">Buka semua</button></div></div>
    <p class="muted" style="margin-bottom:1rem">Bagian yang di-maintenance tidak bisa dibuka pengunjung dan user, hanya kamu sebagai owner. Bagian lain tetap terbuka, dan boleh lebih dari satu sekaligus. Jam hanya tampil di pemberitahuan (zona ${esc(timezoneLabel)}), jadi nyalakan dan matikan lewat tombolnya.</p>
    <div class="list">${Object.keys(maintenance).map((k) => {
    const m = maintenance[k];
    return `<div class="mcard ${m.on ? 'on' : ''}" data-k="${k}">
        <div class="item-main"><div class="grow"><b>${esc(m.label)}</b><small>${m.on ? 'Pengunjung melihat halaman maintenance' : 'Terbuka untuk semua'}</small></div><span class="badge ${m.on ? 'b-pending' : 'b-done'}">${m.on ? 'Maintenance' : 'Buka'}</span></div>
        <div class="mrow">
          <div class="field"><label for="mf_${k}">Dari jam</label><input id="mf_${k}" type="time" value="${esc(m.from)}"></div>
          <div class="field"><label for="mt_${k}">Sampai jam</label><input id="mt_${k}" type="time" value="${esc(m.to)}"></div>
        </div>
        <div class="field"><label for="mn_${k}">Catatan (opsional)</label><input id="mn_${k}" type="text" maxlength="200" value="${esc(m.note)}" placeholder="contoh: Lagi isi stok baru"></div>
        <div class="item-act"><button class="btn sm ${m.on ? '' : 'danger'}" type="button" data-mact="toggle">${m.on ? 'Buka kembali' : `Maintenance ${esc(m.label)}`}</button><button class="btn sm ghost" type="button" data-mact="save">Simpan jam</button></div>
      </div>`;
  }).join('')}</div>
  </div>`;
  body.addEventListener('click', async (e) => {
    const all = e.target.closest('[data-mall]');
    if (all) {
      const on = all.dataset.mall === 'on';
      const ok = await confirmModal({
        title: on ? 'Maintenance semua bagian?' : 'Buka semua bagian?',
        text: on ? 'Pengunjung dan user tidak bisa membuka Akun Telegram, Channel & Panel, Top Up Game, dan Nokos. Kamu sebagai owner tetap bisa.' : 'Semua bagian toko dibuka kembali untuk semua orang.',
        submit: on ? 'Maintenance semua' : 'Buka semua', danger: on,
      });
      if (!ok) return;
      try { await api('/owner/maintenance', { all: true, on }); toast(on ? 'Semua bagian maintenance.' : 'Semua bagian dibuka.'); await afterChange(); } catch (ex) { toast(ex.message, true); }
      return;
    }
    const b = e.target.closest('[data-mact]');
    if (!b) return;
    const k = b.closest('.mcard').dataset.k;
    const m = maintenance[k];
    const payload = { key: k, from: $(`#mf_${k}`).value, to: $(`#mt_${k}`).value, note: $(`#mn_${k}`).value };
    if (b.dataset.mact === 'toggle') payload.on = !m.on;
    try {
      await api('/owner/maintenance', payload);
      toast(b.dataset.mact === 'save' ? 'Jam disimpan.' : (payload.on ? `${m.label} sekarang maintenance.` : `${m.label} dibuka kembali.`));
      await afterChange();
    } catch (ex) { toast(ex.message, true); }
  });
}

async function otBroadcast(body) {
  const [{ users }, { broadcasts }] = await Promise.all([api('/owner/users'), api('/owner/broadcasts')]);
  const n = users.filter((u) => !u.banned).length;
  body.innerHTML = `<div class="cols">
    <div class="panel">
      <h2>Broadcast ke semua user</h2>
      <p class="muted" style="margin-bottom:1rem">Pesan masuk ke Chat setiap pengguna sebagai pengumuman dan muncul sebagai pesan baru. Akan dikirim ke ${n} pengguna.</p>
      <form id="bcForm" novalidate>
        <div class="field"><label for="bcText">Isi pesan</label><textarea id="bcText" maxlength="1000" placeholder="contoh: Test Dari Owner Fixzz"></textarea><span class="hint" id="bcCount">0/1000</span></div>
        <p class="form-err" id="bcErr" role="alert"></p>
        <button class="btn" type="submit" ${n ? '' : 'disabled'}>Kirim broadcast</button>
      </form>
    </div>
    <div class="panel">
      <h2>Riwayat broadcast</h2>
      <div class="list">${broadcasts.length ? broadcasts.map((x) => `<div class="item"><div class="item-main"><div class="grow"><b>${esc(x.text)}</b><small>${dt(x.createdAt)}, terkirim ke ${x.count} pengguna</small></div></div></div>`).join('') : '<div class="empty">Belum ada broadcast.</div>'}</div>
    </div>
  </div>`;
  $('#bcText').addEventListener('input', (e) => { $('#bcCount').textContent = `${e.target.value.length}/1000`; });
  $('#bcForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    $('#bcErr').textContent = '';
    const text = $('#bcText').value.trim();
    if (!text) { $('#bcErr').textContent = 'Isi pesan broadcast dulu.'; return; }
    const ok = await confirmModal({ title: `Kirim ke ${n} pengguna?`, text, submit: 'Kirim broadcast' });
    if (!ok) return;
    try { await api('/owner/broadcast', { text }); toast(`Broadcast terkirim ke ${n} pengguna.`); route(true); } catch (ex) { $('#bcErr').textContent = ex.message; }
  });
}

function nokosItemModal(it) {
  const v = it || { service: '', country: '', code: '', price: '', active: true };
  formModal({
    title: it ? 'Edit layanan nokos' : 'Tambah layanan nokos',
    fields: [
      { name: 'service', label: 'Layanan', type: 'text', value: v.service, max: 40, placeholder: 'contoh Telegram' },
      { name: 'country', label: 'Negara', type: 'text', value: v.country, max: 40, placeholder: 'contoh Indonesia' },
      { name: 'code', label: 'Kode negara', type: 'text', value: v.code, max: 8, placeholder: 'contoh +62' },
      { name: 'price', label: 'Harga (Rp)', type: 'number', value: v.price },
      { name: 'active', label: 'Tampilkan di toko', type: 'checkbox', value: v.active },
    ],
    submit: 'Simpan',
    onSubmit: async (f) => {
      if (f.price === '') throw new Error('Harga wajib diisi.');
      await api('/owner/nokos/items', { id: it ? it.id : undefined, service: f.service, country: f.country, code: f.code, price: f.price, active: f.active });
      toast('Layanan disimpan.');
      await loadNokos(); drawNokos();
      route(true);
    },
  });
}

async function otNokos(body) {
  const d = await api('/owner/nokos');
  const left = (o) => Math.max(0, Math.round((o.expiresAt - Date.now()) / 1000));
  body.innerHTML = `<div class="panel">
      <div class="app-head" style="margin-bottom:1rem"><h2 style="margin:0">Katalog dan stok nomor</h2><button class="btn sm" type="button" data-nka="new">Tambah layanan</button></div>
      <p class="muted" style="margin-bottom:1rem">Isi stok dengan nomor milikmu (satu nomor per baris). Saat user membeli, satu nomor diberikan dan kodenya kamu masukkan di bawah. Kalau kode tidak masuk dalam ${d.waitMinutes} menit, saldo dikembalikan otomatis. Penerima SMS otomatis: <b>${d.inboundEnabled ? 'aktif' : 'belum aktif'}</b>.</p>
      <div class="list">${d.items.length ? d.items.map((i) => `<div class="item"><div class="item-main"><div class="grow"><b>${esc(i.service)} ${esc(i.country)} ${i.active ? '' : '<span class="badge b-cancelled">Disembunyikan</span>'}</b><small>${esc(i.code)}, stok ${i.stock} nomor</small></div><span class="amount">${rp(i.price)}</span></div>
        <div class="item-act"><button class="btn sm" type="button" data-nka="nums" data-id="${i.id}">Tambah nomor</button><button class="btn sm ghost" type="button" data-nka="edit" data-id="${i.id}">Edit</button><button class="btn sm ghost" type="button" data-nka="clear" data-id="${i.id}">Kosongkan stok</button><button class="btn sm ghost" type="button" data-nka="del" data-id="${i.id}">Hapus</button></div></div>`).join('') : '<div class="empty">Belum ada layanan.</div>'}</div>
    </div>
    <div class="panel" style="margin-top:1rem">
      <h2>Pesanan nokos</h2>
      <div class="list">${d.orders.length ? d.orders.map((o) => `<div class="item ${o.status === 'waiting' ? 'pend' : ''}"><div class="item-main">${avatarHtml(o.user)}<div class="grow"><b>${esc(o.service)} ${esc(o.country)}</b><small>@${esc(o.user.username)}, ${esc(o.number)}</small><small>Order #${o.id}, ${dt(o.createdAt)}${o.status === 'waiting' ? `, sisa ${mmss(left(o))}` : ''}${o.otp ? `, kode ${esc(o.otp)}` : ''}</small></div><div style="text-align:right"><span class="amount">${rp(o.price)}</span><br><span class="badge b-${o.status === 'waiting' ? 'pending' : o.status}">${STATUS[o.status] || esc(o.status)}</span></div></div>
        ${o.status === 'waiting' ? `<div class="item-act"><button class="btn sm" type="button" data-nko="code" data-id="${o.id}">Isi kode</button><button class="btn sm ghost" type="button" data-nko="cancel" data-id="${o.id}">Batalkan dan refund</button></div>` : ''}</div>`).join('') : '<div class="empty">Belum ada pesanan nokos.</div>'}</div>
    </div>`;
  body.addEventListener('click', async (e) => {
    const a = e.target.closest('[data-nka]');
    const o = e.target.closest('[data-nko]');
    if (a) {
      const it = d.items.find((x) => x.id === Number(a.dataset.id));
      const act = a.dataset.nka;
      if (act === 'new') nokosItemModal(null);
      if (act === 'edit') nokosItemModal(it);
      if (act === 'nums') {
        formModal({
          title: `Tambah nomor, ${it.service} ${it.country}`,
          intro: 'Satu nomor per baris. Nomor ganda dan yang tidak valid dilewati.',
          fields: [{ name: 'numbers', label: 'Daftar nomor', type: 'textarea', max: 20000, placeholder: '+6281234567890\n+6281234567891' }],
          submit: 'Tambahkan',
          onSubmit: async (f) => {
            const r = await api(`/owner/nokos/items/${it.id}/numbers`, { numbers: f.numbers });
            toast(`${r.added} nomor ditambahkan${r.skipped ? `, ${r.skipped} dilewati` : ''}. Stok sekarang ${r.stock}.`);
            await loadNokos(); drawNokos();
            route(true);
          },
        });
      }
      if (act === 'clear' && await confirmModal({ title: 'Kosongkan stok?', text: `Semua nomor yang belum terjual di ${it.service} ${it.country} dihapus.`, submit: 'Kosongkan', danger: true })) {
        try { await api(`/owner/nokos/items/${it.id}/numbers`, { clear: true }); toast('Stok dikosongkan.'); await loadNokos(); drawNokos(); route(true); } catch (ex) { toast(ex.message, true); }
      }
      if (act === 'del' && await confirmModal({ title: 'Hapus layanan?', text: `${it.service} ${it.country} dan stok nomornya dihapus dari toko.`, submit: 'Hapus', danger: true })) {
        try { await api(`/owner/nokos/items/${it.id}/delete`, {}); toast('Layanan dihapus.'); await loadNokos(); drawNokos(); route(true); } catch (ex) { toast(ex.message, true); }
      }
    }
    if (o) {
      const ord = d.orders.find((x) => x.id === Number(o.dataset.id));
      if (o.dataset.nko === 'code') {
        formModal({
          title: `Isi kode, order #${ord.id}`,
          intro: `${ord.service} ${ord.country}, nomor ${ord.number}. Kode langsung tampil di layar @${ord.user.username}.`,
          fields: [{ name: 'otp', label: 'Kode OTP', type: 'text', max: 12, placeholder: 'contoh 482913' }],
          submit: 'Kirim kode',
          onSubmit: async (f) => { await api('/owner/nokos/orders/' + ord.id, { action: 'code', otp: f.otp }); toast('Kode dikirim ke user.'); route(true); },
        });
      }
      if (o.dataset.nko === 'cancel' && await confirmModal({ title: 'Batalkan pesanan?', text: `Saldo ${rp(ord.price)} dikembalikan ke @${ord.user.username} dan nomor kembali ke stok.`, submit: 'Batalkan dan refund', danger: true })) {
        try { await api('/owner/nokos/orders/' + ord.id, { action: 'cancel' }); toast('Pesanan dibatalkan, saldo dikembalikan.'); route(true); } catch (ex) { toast(ex.message, true); }
      }
    }
  });
  setPoll(async () => { if (!document.querySelector('#formDialog[open]')) { const fresh = await api('/owner/nokos'); if (JSON.stringify(fresh.orders.map((x) => [x.id, x.status, x.otp])) !== JSON.stringify(d.orders.map((x) => [x.id, x.status, x.otp]))) route(true); } }, 8000);
}

async function otPayment(body) {
  const d = await api('/owner/payment');
  const a = d.atlantic;
  const row = (k, v) => `<div class="item"><div class="item-main"><div class="grow"><b>${esc(k)}</b></div><span>${v}</span></div></div>`;
  body.innerHTML = `<div class="cols">
    <div class="panel">
      <h2>Pembayaran otomatis (Atlantic)</h2>
      <div class="list">
        ${row('Status', a.enabled ? '<span class="badge b-done">Aktif</span>' : '<span class="badge b-cancelled">Belum aktif</span>')}
        ${row('API key', a.hasKey ? '<span class="badge b-done">Terpasang</span>' : '<span class="badge b-cancelled">Belum diisi</span>')}
        ${row('Metode', `${esc(a.type)} / ${esc(a.metode)}`)}
        ${row('Batas bayar', `${a.expireMinutes} menit`)}
        ${row('Saldo user bertambah', a.creditMode === 'net' ? 'sebesar saldo bersih' : 'sebesar nominal (fee ditanggung toko)')}
      </div>
      ${a.hasKey ? '' : '<p class="note">Isi ATLANTIC_API_KEY di file .env di server, lalu restart. Key tidak pernah ditampilkan di website.</p>'}
      <h2 style="margin:1.4rem 0 .6rem">Atur di dashboard Atlantic</h2>
      <p class="muted" style="margin-bottom:.8rem"><b>IP Whitelist:</b> isi IP publik server tokomu.<br><b>Callback:</b> tempel alamat ini.</p>
      <div class="copy-row"><code>${esc(d.callbackUrl)}</code><button class="btn sm ghost" type="button" id="cbCopy">Salin</button></div>
      <p class="note">Callback hanya memicu pengecekan. Saldo baru bertambah setelah Atlantic sendiri menjawab sukses lewat API.</p>
    </div>
    <div class="panel">
      <h2>Deposit otomatis terbaru</h2>
      <div class="list">${d.recent.length ? d.recent.map((x) => `<div class="item"><div class="item-main">${avatarHtml(x.user)}<div class="grow"><b>@${esc(x.user.username)}</b><small>Deposit #${x.id}, ${dt(x.createdAt)}</small></div><div style="text-align:right"><span class="amount">${rp(x.amount)}</span><br><span class="badge b-${x.status}">${STATUS[x.status] || esc(x.status)}</span></div></div></div>`).join('') : '<div class="empty">Belum ada deposit otomatis.</div>'}</div>
    </div>
  </div>`;
  $('#cbCopy').addEventListener('click', () => copyText(d.callbackUrl, 'Alamat callback disalin.'));
}

async function otChat(body, arg) {
  const uid = arg ? Number(arg) : 0;
  body.innerHTML = `<div class="oc ${uid ? 'has-thread' : ''}"><div class="threads" id="threads"></div><div id="threadBox">${uid ? '' : '<div class="chat-empty">Pilih percakapan di sebelah kiri, atau mulai dari tab Pengguna.</div>'}</div></div>`;
  let key = ''; let len = 0; let target = null;

  const loadThreads = async () => {
    const { threads } = await api('/owner/threads');
    $('#threads').innerHTML = threads.length
      ? threads.map((t) => `<a class="thread ${t.userId === uid ? 'on' : ''}" href="#/owner/chat/${t.userId}">${avatarHtml(t)}<div class="grow"><b>${esc(t.displayName)}</b><small>${t.lastFrom === 'owner' ? 'Kamu: ' : ''}${esc(t.lastText)}</small></div>${t.unread ? `<span class="dot">${t.unread}</span>` : ''}</a>`).join('')
      : '<div class="empty">Belum ada percakapan.</div>';
  };

  const loadMsgs = async () => {
    const r = await api('/owner/chat/' + uid);
    target = r.user;
    const bal = $('#ocBal');
    if (bal) bal.textContent = rp(r.user.balance);
    const k = r.messages.length + ':' + (r.messages.length ? r.messages[r.messages.length - 1].id : 0);
    if (k === key) return;
    key = k;
    len = renderMsgs($('#msgs'), r.messages, 'owner', len);
  };

  if (uid) {
    const first = await api('/owner/chat/' + uid);
    target = first.user;
    $('#threadBox').innerHTML = `<div class="chat">
      <div class="chat-head"><a class="btn ghost sm back" href="#/owner/chat" aria-label="Kembali ke daftar">Kembali</a>${avatarHtml(first.user)}<div class="grow"><b>${esc(first.user.displayName)}</b><small>@${esc(first.user.username)}, saldo <span id="ocBal">${rp(first.user.balance)}</span></small></div><button class="btn sm" id="ocBalBtn">Atur saldo</button></div>
      <div class="msgs" id="msgs"></div>
      <form class="chat-form" id="chatForm"><input type="text" id="chatIn" maxlength="1000" placeholder="Balas ke @${esc(first.user.username)}" autocomplete="off"><button class="btn" type="submit">Kirim</button></form>
    </div>`;
    $('#ocBalBtn').addEventListener('click', () => balanceModal(target, async () => { key = ''; await loadMsgs(); }));
    $('#chatForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const text = $('#chatIn').value.trim();
      if (!text) return;
      $('#chatIn').value = '';
      try { await api('/owner/chat/' + uid, { text }); key = ''; await loadMsgs(); await loadThreads(); } catch (ex) { toast(ex.message, true); $('#chatIn').value = text; }
    });
    await loadMsgs();
    refreshMe();
  }
  await loadThreads();
  if (uid) { const dot = $('.tabs a.on .dot'); if (dot) dot.remove(); }
  setPoll(async () => { if (uid) await loadMsgs(); await loadThreads(); refreshMe(); }, 4000);
}

/* ------------------------------------------------------------------ */
/* Pratinjau: top up game (data contoh, belum terhubung ke provider)    */
/* ------------------------------------------------------------------ */
const GAMES = [
  { id: 'ml', name: 'Mobile Legends', cur: 'Diamond', ini: 'ML', fields: [{ k: 'uid', label: 'User ID', ph: 'contoh 12345678' }, { k: 'zone', label: 'Zone ID', ph: 'contoh 1234' }],
    items: [['86 Diamond', 20000], ['172 Diamond', 40000], ['257 Diamond', 60000], ['706 Diamond', 160000], ['2195 Diamond', 480000], ['3688 Diamond', 800000], ['5532 Diamond', 1200000], ['9288 Diamond', 2000000], ['Weekly Diamond Pass', 28000], ['Twilight Pass', 150000]] },
  { id: 'ff', name: 'Free Fire', cur: 'Diamond', ini: 'FF', fields: [{ k: 'uid', label: 'Player ID', ph: 'contoh 123456789' }],
    items: [['5 Diamond', 1000], ['12 Diamond', 2000], ['50 Diamond', 7500], ['70 Diamond', 10000], ['140 Diamond', 20000], ['355 Diamond', 50000], ['720 Diamond', 100000], ['1450 Diamond', 200000], ['2180 Diamond', 300000], ['Membership Mingguan', 30000], ['Membership Bulanan', 91000]] },
  { id: 'pubg', name: 'PUBG Mobile', cur: 'UC', ini: 'PM', fields: [{ k: 'uid', label: 'Player ID', ph: 'contoh 5123456789' }],
    items: [['60 UC', 15000], ['325 UC', 75000], ['660 UC', 150000], ['1800 UC', 375000], ['3850 UC', 750000], ['8100 UC', 1500000]] },
  { id: 'gi', name: 'Genshin Impact', cur: 'Genesis Crystal', ini: 'GI', fields: [{ k: 'uid', label: 'UID', ph: 'contoh 800123456' }, { k: 'srv', label: 'Server', options: ['Asia', 'America', 'Europe', 'TW, HK, MO'] }],
    items: [['60 Genesis Crystal', 16000], ['300 + 30 Genesis Crystal', 79000], ['980 + 110 Genesis Crystal', 249000], ['1980 + 260 Genesis Crystal', 479000], ['3280 + 600 Genesis Crystal', 799000], ['6480 + 1600 Genesis Crystal', 1599000], ['Blessing of the Welkin Moon', 79000]] },
  { id: 'val', name: 'Valorant', cur: 'Valorant Points', ini: 'VA', fields: [{ k: 'uid', label: 'Riot ID', ph: 'Nama#TAG' }],
    items: [['475 VP', 55000], ['1000 VP', 110000], ['2050 VP', 220000], ['3650 VP', 380000], ['5350 VP', 560000], ['11000 VP', 1100000]] },
  { id: 'rbx', name: 'Roblox', cur: 'Robux', ini: 'RB', fields: [{ k: 'uid', label: 'Username', ph: 'username Roblox' }],
    items: [['400 Robux', 75000], ['800 Robux', 150000], ['1700 Robux', 310000], ['4500 Robux', 800000], ['10000 Robux', 1750000], ['22500 Robux', 3900000]] },
  { id: 'hok', name: 'Honor of Kings', cur: 'Token', ini: 'HK', fields: [{ k: 'uid', label: 'Player ID', ph: 'contoh 6123456789' }],
    items: [['16 Token', 3000], ['80 Token', 14900], ['240 Token', 44200], ['400 Token', 73000], ['560 Token', 102000], ['800 + 30 Token', 146000], ['1200 + 45 Token', 219000], ['2400 + 108 Token', 438000], ['4000 + 180 Token', 730000], ['Weekly Card', 16200]] },
  { id: 'cod', name: 'Call of Duty Mobile', cur: 'CP', ini: 'CD', fields: [{ k: 'uid', label: 'Open ID', ph: 'contoh 6789012345' }],
    items: [['63 CP', 10000], ['128 CP', 20000], ['321 CP', 50000], ['645 CP', 100000], ['1373 CP', 200000], ['2060 CP', 300000], ['3564 CP', 500000], ['7656 CP', 1000000]] },
];
const TU = { g: 0, item: -1, vals: {} };
const gameVals = (g) => (TU.vals[g.id] = TU.vals[g.id] || {});

function drawTopup() {
  const g = GAMES[TU.g];
  const v = gameVals(g);
  $$('#gameGrid .game').forEach((b, i) => { b.classList.toggle('on', i === TU.g); b.setAttribute('aria-pressed', String(i === TU.g)); });
  $('#checkout').innerHTML = `<div class="panel">
      <h2>Data akun ${esc(g.name)}</h2>
      <div class="fields">${g.fields.map((f) => f.options
    ? `<div class="field"><label for="tf_${f.k}">${esc(f.label)}</label><select id="tf_${f.k}" data-fk="${f.k}">${f.options.map((o) => `<option ${v[f.k] === o ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select></div>`
    : `<div class="field"><label for="tf_${f.k}">${esc(f.label)}</label><input id="tf_${f.k}" data-fk="${f.k}" type="text" inputmode="text" autocomplete="off" placeholder="${esc(f.ph || '')}" value="${esc(v[f.k] || '')}"></div>`).join('')}</div>
      <h2 style="margin-top:1.3rem">Pilih nominal</h2>
      <div class="pkgs">${g.items.map((it, i) => `<button type="button" class="pkg ${i === TU.item ? 'on' : ''}" data-pi="${i}"><b>${esc(it[0])}</b><span>${rp(it[1])}</span></button>`).join('')}</div>
    </div>
    <div class="panel sum">
      <h2>Ringkasan</h2>
      <div class="sum-row"><span>Game</span><span id="sumGame"></span></div>
      <div class="sum-row"><span>Akun</span><span id="sumAcc"></span></div>
      <div class="sum-row"><span>Nominal</span><span id="sumItem"></span></div>
      <div class="sum-total"><span class="muted">Total</span><b id="sumTotal">Rp 0</b></div>
      <button class="btn big" id="payBtn" type="button">Bayar dengan saldo</button>
      <p class="note">Nominal mengikuti paket resmi tiap game, harga di sini contoh. Setelah provider top up terpasang, tombol ini memotong saldo dan mengirim pesanan otomatis.</p>
    </div>`;
  sumTopup();
}

function sumTopup() {
  const g = GAMES[TU.g];
  const v = gameVals(g);
  const it = TU.item >= 0 ? g.items[TU.item] : null;
  g.fields.forEach((f) => { if (f.options && v[f.k] == null) v[f.k] = f.options[0]; });
  const acc = g.fields.map((f) => v[f.k] || '').filter(Boolean).join(' / ');
  $('#sumGame').textContent = g.name;
  $('#sumAcc').textContent = acc || 'Belum diisi';
  $('#sumItem').textContent = it ? it[0] : 'Belum dipilih';
  $('#sumTotal').textContent = it ? rp(it[1]) : 'Rp 0';
  $('#payBtn').disabled = !it;
}

function payTopup() {
  const g = GAMES[TU.g];
  const v = gameVals(g);
  const it = g.items[TU.item];
  if (!it) return;
  const missing = g.fields.find((f) => !String(v[f.k] || '').trim());
  if (missing) {
    toast(`Isi ${missing.label} dulu.`, true);
    const el = $(`[data-fk="${missing.k}"]`);
    if (el) el.focus();
    return;
  }
  formModal({
    title: 'Pratinjau tampilan',
    intro: `Pesanan ${it[0]} untuk ${g.name} belum diproses, karena fitur ini belum terhubung ke provider top up. Setelah provider dan harga final dipasang, tombol ini memotong saldo dan mengirim pesanan.`,
    submit: 'Mengerti',
    onSubmit: async () => {},
  });
}

function initTopup() {
  const grid = $('#gameGrid');
  grid.innerHTML = GAMES.map((x, i) => `<button type="button" class="game reveal" data-fx="zoom" style="--i:${i % 4}" data-gi="${i}" aria-pressed="false"><span class="ini">${esc(x.ini)}</span><span class="gt"><b>${esc(x.name)}</b><small>${esc(x.cur)}</small></span></button>`).join('');
  observe(grid);
  grid.addEventListener('click', (e) => {
    const b = e.target.closest('[data-gi]');
    if (!b) return;
    TU.g = Number(b.dataset.gi);
    TU.item = -1;
    drawTopup();
  });
  const co = $('#checkout');
  co.addEventListener('click', (e) => {
    const p = e.target.closest('[data-pi]');
    if (p) {
      TU.item = Number(p.dataset.pi);
      $$('.pkg', co).forEach((x) => x.classList.toggle('on', x === p));
      sumTopup();
      return;
    }
    if (e.target.closest('#payBtn')) payTopup();
  });
  co.addEventListener('input', (e) => {
    const f = e.target.closest('[data-fk]');
    if (!f) return;
    gameVals(GAMES[TU.g])[f.dataset.fk] = f.value;
    sumTopup();
  });
  const cnt = $('#cnt-game');
  if (cnt) cnt.textContent = `${GAMES.length} game`;
  drawTopup();
}

/* ------------------------------------------------------------------ */
/* Pratinjau: akun Telegram ID 1-8 (stok, harga, dan alur kirim contoh) */
/* ------------------------------------------------------------------ */
const AKUN_BASE = [30000, 27500, 25000, 22500, 20000, 17500, 15000, 12500];
const AKUN_STOCK = [[9, 4, 14, 6], [12, 6, 10, 0], [7, 0, 21, 8], [15, 9, 5, 12], [3, 2, 18, 10], [20, 11, 0, 7], [6, 5, 9, 14], [10, 8, 16, 3]];
const AKUN_KEYS = ['abuse', 'permanen', 'nominus', 'nosurel'];
const AKUN_MULT = { abuse: 0.55, permanen: 0.35, nominus: 1, nosurel: 0.85 };
const AKUN_NAME = { abuse: 'Limit abuse', permanen: 'Limit permanen', nominus: 'No Minus', nosurel: 'No Surel' };
const AKUN_VARS = [
  { k: 'limit', name: 'Limit', keys: ['abuse', 'permanen'] },
  { k: 'nominus', name: 'No Minus', keys: ['nominus'] },
  { k: 'nosurel', name: 'No Surel', keys: ['nosurel'] },
];
const AK = { id: 0, v: null, sub: 'abuse', agree: false, phase: 'pick', timers: [] };
const akItem = (i, key) => ({ stock: AKUN_STOCK[i][AKUN_KEYS.indexOf(key)], price: Math.round((AKUN_BASE[i] * AKUN_MULT[key]) / 500) * 500 });
const akKey = () => (AK.v === 'limit' ? AK.sub : AK.v);
function akVarInfo(i, v) {
  const items = v.keys.map((k) => akItem(i, k));
  const prices = items.filter((x) => x.stock > 0).map((x) => x.price);
  return { stock: items.reduce((a, x) => a + x.stock, 0), from: prices.length ? Math.min(...prices) : 0 };
}
function akSpec(key) {
  const limit = key === 'abuse' || key === 'permanen';
  const rows = [['ID akun', `ID ${AK.id + 1}`], ['Varian', limit ? 'Limit' : AKUN_NAME[key]]];
  if (limit) rows.push(['Jenis limit', AKUN_NAME[key]]);
  if (key === 'nominus') rows.push(['Catatan', 'Anti minus']);
  if (key === 'nosurel') rows.push(['Surel', 'Tidak terpasang']);
  rows.push(['Pengiriman', 'Otomatis setelah bayar'], ['OTP dan 2FA', 'Masuk otomatis ke halaman ini']);
  return rows;
}

function stopAkun() {
  AK.timers.forEach(clearTimeout);
  AK.timers = [];
  if (AK.phase === 'wait' || AK.phase === 'logout') AK.phase = 'pick';
}

function drawAkun() {
  const box = $('#akunBox');
  const i = AK.id;
  $$('#idGrid .idc').forEach((b, n) => { b.classList.toggle('on', n === i); b.setAttribute('aria-pressed', String(n === i)); });
  const key = AK.v ? akKey() : null;
  const item = key ? akItem(i, key) : null;
  const spec = key ? `<div class="spec"><h3>Spesifikasi akun</h3><dl>${akSpec(key).map((r) => `<dt>${esc(r[0])}</dt><dd>${esc(r[1])}</dd>`).join('')}</dl></div>` : '';
  let left; let right;
  if (AK.phase === 'pick') {
    left = `<div class="panel">
      <h2>ID ${i + 1}: pilih varian</h2>
      <div class="pkgs">${AKUN_VARS.map((v) => {
    const f = akVarInfo(i, v);
    return `<button type="button" class="pkg ${AK.v === v.k ? 'on' : ''}" data-av="${v.k}" ${f.stock === 0 ? 'disabled' : ''}><b>${esc(v.name)}</b><span>${f.stock ? rp(f.from) : 'Habis'}</span><small>${f.stock ? `mulai dari, stok ${f.stock}` : 'Stok kosong'}</small></button>`;
  }).join('')}</div>
      ${AK.v === 'limit' ? `<h2 style="margin-top:1.3rem">Jenis limit</h2><div class="pkgs">${['abuse', 'permanen'].map((k) => {
    const it = akItem(i, k);
    return `<button type="button" class="pkg ${AK.sub === k ? 'on' : ''}" data-as="${k}" ${it.stock === 0 ? 'disabled' : ''}><b>${esc(AKUN_NAME[k])}</b><span>${it.stock ? rp(it.price) : 'Habis'}</span><small>${it.stock ? `Stok ${it.stock}` : 'Stok kosong'}</small></button>`;
  }).join('')}</div>` : ''}
      ${spec}
    </div>`;
    right = `<div class="panel sum">
      <h2>Ringkasan</h2>
      <div class="sum-row"><span>ID</span><span>ID ${i + 1}</span></div>
      <div class="sum-row"><span>Varian</span><span>${key ? esc(AKUN_NAME[key]) : 'Belum dipilih'}</span></div>
      <div class="sum-total"><span class="muted">Total</span><b>${item ? rp(item.price) : 'Rp 0'}</b></div>
      <label class="agree"><input type="checkbox" id="akAgree" ${AK.agree ? 'checked' : ''}><span>Saya paham: setelah pesanan selesai, akun sepenuhnya menjadi milik saya, dan kehilangan akun setelah itu bukan tanggung jawab penjual.</span></label>
      <button class="btn big" id="akPay" type="button" ${key && AK.agree ? '' : 'disabled'}>Bayar dengan saldo</button>
      <p class="note">Harga dan stok di sini contoh. Setelah bayar, nomor, OTP, dan kode 2FA muncul otomatis di halaman ini.</p>
    </div>`;
  } else {
    const st = AK.phase;
    const step = (cls, title, sub) => `<li class="${cls}"><i></i><span><b>${title}</b>${sub ? `<small>${sub}</small>` : ''}</span></li>`;
    const waiting = st === 'wait';
    right = `<div class="panel sum">
      <h2>Pesanan kamu <span class="pill">Simulasi</span></h2>
      <ul class="flow">
        ${step('done', 'Pembayaran diterima', `Saldo terpotong ${rp(item.price)}`)}
        ${step('done', 'Nomor diberikan', '+62 8xx-xxxx-xxxx')}
        ${step(waiting ? 'act' : 'done', 'Kode OTP', waiting ? 'Menunggu kode masuk' : 'Masuk dan terkirim ke server')}
        ${step(waiting ? '' : 'done', 'Kode 2FA', waiting ? 'Menunggu' : 'Terkirim ke halaman ini dan ke server')}
        ${step(st === 'logout' ? 'act' : st === 'done' ? 'done' : '', 'Bot logout dari akun', st === 'done' ? 'Akun tidak lagi terhubung ke server' : '')}
      </ul>
      ${waiting
    ? '<div class="otp wait otp-row" aria-label="Menunggu kode"><i>-</i><i>-</i><i>-</i><i>-</i><i>-</i><i>-</i></div>'
    : `<div class="otp otp-row" aria-label="Kode OTP"><i>5</i><i>3</i><i>1</i><i>8</i><i>0</i><i>4</i></div>
         <div class="twofa"><div><span>Kode 2FA (contoh)</span><code>contoh-2fa-4821</code></div><button class="btn sm ghost" type="button" data-ak="copy">Salin</button></div>`}
      ${st === 'got' ? '<button class="btn big" type="button" data-ak="finish" style="width:100%">Selesai</button><p class="note">Tekan Selesai kalau kamu sudah berhasil login. Bot akan logout dari akun ini.</p>' : ''}
      ${st === 'done' ? '<div class="final">Selesai. Bot sudah logout dari akun ini, jadi akun sepenuhnya milikmu.</div><button class="btn ghost" type="button" data-ak="again" style="width:100%">Beli lagi</button>' : ''}
    </div>`;
    left = `<div class="panel"><h2>Akun yang kamu beli</h2>${spec}</div>`;
  }
  box.innerHTML = left + right;
}

function initAkun() {
  const grid = $('#idGrid');
  grid.innerHTML = AKUN_BASE.map((_, i) => {
    const stock = AKUN_STOCK[i].reduce((a, b) => a + b, 0);
    const from = Math.min(...AKUN_KEYS.map((k) => akItem(i, k)).filter((x) => x.stock > 0).map((x) => x.price));
    return `<button type="button" class="idc reveal" data-fx="zoom" style="--i:${i % 4}" data-id="${i}" aria-pressed="false"><b>ID ${i + 1}</b><small>Stok ${stock} akun</small><span class="from">Mulai ${rp(from)}</span></button>`;
  }).join('');
  observe(grid);
  grid.addEventListener('click', (e) => {
    const b = e.target.closest('[data-id]');
    if (!b || AK.phase !== 'pick') return;
    AK.id = Number(b.dataset.id);
    if (AK.v) {
      const v = AKUN_VARS.find((x) => x.k === AK.v);
      if (akVarInfo(AK.id, v).stock === 0) AK.v = null;
      else if (AK.v === 'limit' && akItem(AK.id, AK.sub).stock === 0) AK.sub = AK.sub === 'abuse' ? 'permanen' : 'abuse';
    }
    drawAkun();
  });
  const box = $('#akunBox');
  box.addEventListener('click', (e) => {
    const v = e.target.closest('[data-av]');
    const s = e.target.closest('[data-as]');
    const a = e.target.closest('[data-ak]');
    if (v) {
      AK.v = v.dataset.av;
      if (AK.v === 'limit') AK.sub = akItem(AK.id, 'abuse').stock ? 'abuse' : 'permanen';
      drawAkun();
      return;
    }
    if (s) { AK.sub = s.dataset.as; drawAkun(); return; }
    if (e.target.closest('#akPay')) {
      AK.phase = 'wait';
      drawAkun();
      AK.timers.push(setTimeout(() => { AK.phase = 'got'; drawAkun(); }, 4000));
      return;
    }
    if (!a) return;
    if (a.dataset.ak === 'finish') {
      AK.phase = 'logout';
      drawAkun();
      AK.timers.push(setTimeout(() => { AK.phase = 'done'; drawAkun(); }, 1800));
    }
    if (a.dataset.ak === 'again') { AK.phase = 'pick'; AK.v = null; AK.agree = false; drawAkun(); }
    if (a.dataset.ak === 'copy') {
      try { navigator.clipboard.writeText('contoh-2fa-4821'); toast('Kode contoh disalin.'); } catch (_) { toast('Kode contoh: contoh-2fa-4821'); }
    }
  });
  box.addEventListener('change', (e) => {
    if (e.target.id === 'akAgree') { AK.agree = e.target.checked; drawAkun(); }
  });
  const cnt = $('#cnt-akun');
  if (cnt) cnt.textContent = `${AKUN_BASE.length} ID`;
  drawAkun();
}

/* ------------------------------------------------------------------ */
/* Nokos (stok dan kode OTP dari server)                               */
/* ------------------------------------------------------------------ */
const NK = { items: [], wait: 20, service: '', itemId: 0, order: null, poll: null, tick: null, busy: false };
const nkServices = () => [...new Set(NK.items.map((i) => i.service))];
const mmss = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

async function loadNokos() {
  if (!S.me) return;
  try { const r = await api('/nokos/catalog'); NK.items = r.items; NK.wait = r.waitMinutes; } catch (_) { return; }
  if (!NK.service || !nkServices().includes(NK.service)) NK.service = nkServices()[0] || '';
  const cur = NK.items.find((i) => i.id === NK.itemId);
  if (!cur || cur.service !== NK.service) NK.itemId = 0;
  if (!NK.order) {
    try { const w = (await api('/nokos/orders')).orders.find((x) => x.status === 'waiting'); if (w) NK.order = w; } catch (_) { /* abaikan */ }
  }
}

function stopNokos() { clearInterval(NK.poll); clearInterval(NK.tick); NK.poll = null; NK.tick = null; }
function resetNokos() { stopNokos(); NK.order = null; NK.items = []; NK.itemId = 0; }
function startNokosTimers() {
  stopNokos();
  if (!NK.order || NK.order.status !== 'waiting') return;
  NK.poll = setInterval(pollNokos, 3000);
  NK.tick = setInterval(() => {
    const t = $('#nkTimer');
    if (t && NK.order) t.textContent = mmss(Math.max(0, Math.round((NK.order.expiresAt - Date.now()) / 1000)));
  }, 1000);
}
async function pollNokos() {
  if (!NK.order || NK.busy || document.hidden) return;
  try {
    const r = await api('/nokos/orders/' + NK.order.id);
    NK.order = r.order;
    if (r.order.status !== 'waiting') {
      stopNokos();
      await refreshMe();
      await loadNokos();
      drawNokos();
      toast(r.order.status === 'done' ? 'Kode OTP masuk.' : 'Pesanan nokos berakhir, saldo dikembalikan.');
    }
  } catch (_) { /* coba lagi */ }
}

function drawNokos() {
  const box = $('#nokosBox');
  if (!box) return;
  const o = NK.order;
  if (!NK.items.length) {
    box.innerHTML = `<div class="panel empty">${S.me ? 'Belum ada layanan nokos. Hubungi owner.' : 'Masuk dulu untuk melihat layanan nokos.'}</div>`;
    return;
  }
  const locked = !!(o && o.status === 'waiting');
  const list = NK.items.filter((i) => i.service === NK.service);
  const sel = NK.items.find((i) => i.id === NK.itemId);
  const left = `<div class="panel">
      <h2>Layanan</h2>
      <div class="svc-grid">${nkServices().map((s) => `<button type="button" class="chip ${s === NK.service ? 'on' : ''}" data-nsvc="${esc(s)}" ${locked ? 'disabled' : ''}>${esc(s)}</button>`).join('')}</div>
      <h2 style="margin-top:1.3rem">Negara</h2>
      <div class="ctry-list">${list.map((i) => `<button type="button" class="ctry ${i.id === NK.itemId ? 'on' : ''}" data-nid="${i.id}" ${i.stock === 0 || locked ? 'disabled' : ''}><span><b>${esc(i.country)}</b><small>${esc(i.code)}</small></span><span class="stock">${i.stock ? `Stok ${i.stock}` : 'Habis'}</span><span class="amount">${rp(i.price)}</span></button>`).join('')}</div>
    </div>`;
  let body;
  if (o && o.status === 'waiting') {
    const secs = Math.max(0, Math.round((o.expiresAt - Date.now()) / 1000));
    body = `<div class="nk-card">
      <span class="badge b-pending">Menunggu kode OTP</span>
      <div class="num">${esc(o.number)}</div>
      <div class="timer" id="nkTimer">${mmss(secs)}</div>
      <div class="otp wait" aria-label="Menunggu kode"><i>-</i><i>-</i><i>-</i><i>-</i><i>-</i><i>-</i></div>
      <button class="btn ghost" type="button" data-nk="copynum">Salin nomor</button>
      <button class="btn ghost" type="button" data-nk="cancel">Batalkan dan refund</button>
      <p class="note">Pakai nomor ini untuk minta kode di ${esc(o.service)}. Kode muncul di sini otomatis. Kalau tidak masuk sampai waktu habis, saldo dikembalikan.</p>
    </div>`;
  } else if (o && o.status === 'done') {
    const digits = /^\d{4,8}$/.test(o.otp);
    body = `<div class="nk-card">
      <span class="badge b-done">Kode masuk</span>
      <div class="num">${esc(o.number)}</div>
      ${digits ? `<div class="otp" aria-label="Kode OTP">${[...o.otp].map((d) => `<i>${esc(d)}</i>`).join('')}</div>` : `<div class="twofa"><div><span>Kode</span><code>${esc(o.otp)}</code></div></div>`}
      <button class="btn" type="button" data-nk="copy">Salin kode</button>
      <button class="btn ghost" type="button" data-nk="retry">Ambil nomor lagi</button>
    </div>`;
  } else if (o) {
    body = `<div class="nk-card">
      <span class="badge b-cancelled">${o.status === 'expired' ? 'Waktu habis' : 'Dibatalkan'}</span>
      <p class="muted">Saldo ${rp(o.price)} sudah dikembalikan.</p>
      <button class="btn" type="button" data-nk="retry">Coba lagi</button>
    </div>`;
  } else if (!sel) {
    body = '<div class="empty">Pilih layanan dan negara dulu.</div>';
  } else {
    body = `<div class="sum-row"><span>Layanan</span><span>${esc(sel.service)}</span></div>
      <div class="sum-row"><span>Negara</span><span>${esc(sel.country)} (${esc(sel.code)})</span></div>
      <div class="sum-row"><span>Berlaku</span><span>${NK.wait} menit</span></div>
      <div class="sum-total"><span class="muted">Harga</span><b>${rp(sel.price)}</b></div>
      <button class="btn big" type="button" data-nk="take" ${sel.stock ? '' : 'disabled'}>Ambil nomor</button>
      <p class="note">Kalau kode OTP tidak masuk sampai waktu habis, saldo dikembalikan otomatis.</p>`;
  }
  box.innerHTML = `${left}<div class="panel sum"><h2>Nomor kamu</h2>${body}</div>`;
}

async function copyText(t, okMsg) {
  try { await navigator.clipboard.writeText(t); toast(okMsg); } catch (_) { toast(t); }
}

function initNokos() {
  const box = $('#nokosBox');
  box.addEventListener('click', async (e) => {
    const s = e.target.closest('[data-nsvc]');
    const c = e.target.closest('[data-nid]');
    const a = e.target.closest('[data-nk]');
    if (s && !s.disabled) { NK.service = s.dataset.nsvc; NK.itemId = 0; drawNokos(); return; }
    if (c && !c.disabled) { NK.itemId = Number(c.dataset.nid); drawNokos(); return; }
    if (!a) return;
    const act = a.dataset.nk;
    if (act === 'take') {
      if (!S.me) { openAuth('login'); return; }
      NK.busy = true;
      try {
        const r = await api('/nokos/order', { itemId: NK.itemId });
        NK.order = r.order; S.me = r.user; renderNav();
        await loadNokos();
        startNokosTimers(); drawNokos();
      } catch (ex) {
        toast(ex.message, true);
        if (ex.status === 402 && await confirmModal({ title: 'Saldo belum cukup', text: 'Deposit dulu, lalu ambil nomornya lagi.', submit: 'Ke halaman deposit' })) location.hash = '#/akun/deposit';
        if (ex.status === 409) { await loadNokos(); drawNokos(); }
      } finally { NK.busy = false; }
    }
    if (act === 'cancel') {
      const ok = await confirmModal({ title: 'Batalkan pesanan?', text: 'Saldo dikembalikan dan nomor ini dilepas.', submit: 'Batalkan', danger: true });
      if (!ok || !NK.order) return;
      try { const r = await api(`/nokos/orders/${NK.order.id}/cancel`, {}); NK.order = r.order; stopNokos(); await refreshMe(); await loadNokos(); drawNokos(); toast('Pesanan dibatalkan, saldo dikembalikan.'); } catch (ex) { toast(ex.message, true); }
    }
    if (act === 'retry') { NK.order = null; stopNokos(); await loadNokos(); drawNokos(); }
    if (act === 'copy' && NK.order) copyText(NK.order.otp, 'Kode disalin.');
    if (act === 'copynum' && NK.order) copyText(NK.order.number, 'Nomor disalin.');
  });
  const cnt = $('#cnt-nokos');
  if (cnt && !mtHide('nokos')) cnt.textContent = ticketText.nokos();
  drawNokos();
  startNokosTimers();
}

/* ------------------------------------------------------------------ */
/* Animasi teks (huruf dan kata muncul) dan masuk-layar otomatis        */
/* ------------------------------------------------------------------ */
const TX_LETTERS = '[data-tx="letters"], .sec-head h2, .app-head h1, .gate-card h1';
const FX_AUTO = '.sec-head, .grid > .card, .ids > .idc, .games > .game, .checkout > .panel, .nk > .panel, .steps3 > .step, .chips, .contact-main, .profile-card, .index, .mt-card, .app-head, .tabs, #tabBody > .panel, #tabBody > .hello, #tabBody > .chat, .cols > .panel, .stats > .stat';
const fxKind = (el) => (el.matches('.idc, .game, .card, .stat, .step, .mt-card') ? 'zoom' : el.matches('.sec-head, .app-head') ? 'left' : 'up');

function splitText(el, mode) {
  if (el.classList.contains('tx') || el.children.length || !el.textContent.trim()) return;
  if (el.closest('dialog') || el.matches('[data-site-name], [data-tg-text]')) return;
  const text = el.textContent;
  el.setAttribute('aria-label', text);
  el.textContent = '';
  el.classList.add('tx');
  el.dataset.tx = mode;
  let i = 0;
  text.split(/(\s+)/).forEach((tok) => {
    if (!tok) return;
    if (/^\s+$/.test(tok)) { el.appendChild(document.createTextNode(' ')); return; }
    const w = document.createElement('span');
    w.className = 'tw';
    w.setAttribute('aria-hidden', 'true');
    const chunks = mode === 'letters' ? [...tok] : [tok];
    chunks.forEach((ch) => {
      const c = document.createElement('span');
      c.className = 'tc';
      c.style.setProperty('--i', String(i++));
      c.textContent = ch;
      w.appendChild(c);
    });
    el.appendChild(w);
  });
  if (S.keepFx || reduceMotion) el.classList.add('in');
}

function fxScan(scope) {
  if (!scope) return;
  $$(TX_LETTERS, scope).forEach((el) => splitText(el, 'letters'));
  $$('[data-tx="words"]', scope).forEach((el) => splitText(el, 'words'));
  $$(FX_AUTO, scope).forEach((el) => {
    if (el.classList.contains('reveal') || el.closest('dialog')) return;
    const idx = el.parentElement ? [...el.parentElement.children].indexOf(el) : 0;
    el.classList.add('reveal');
    if (!el.dataset.fx) el.dataset.fx = fxKind(el);
    el.style.setProperty('--i', String(Math.min(idx, 6)));
    if (S.keepFx) el.classList.add('in');
  });
  observe(scope);
}

function initFx() {
  fxScan($('#landing'));
  fxScan($('#gate'));
  const av = $('#appView');
  let raf = 0;
  new MutationObserver((muts) => {
    if (muts.every((m) => m.target.closest && m.target.closest('.msgs, .threads'))) return;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => fxScan(av));
  }).observe(av, { childList: true, subtree: true });

  // kaca yang memantulkan cahaya mengikuti kursor (hanya mouse)
  let glowRaf = 0;
  document.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return;
    const g = e.target.closest && e.target.closest('.top-in, .index, .gate-card, .profile-card, .panel, .card, .step, .mt-card, .chat, .stat');
    if (!g) return;
    cancelAnimationFrame(glowRaf);
    glowRaf = requestAnimationFrame(() => {
      const r = g.getBoundingClientRect();
      g.style.setProperty('--mx', `${e.clientX - r.left}px`);
      g.style.setProperty('--my', `${e.clientY - r.top}px`);
    });
  }, { passive: true });
}

/* ------------------------------------------------------------------ */
/* Event global                                                        */
/* ------------------------------------------------------------------ */
document.addEventListener('click', (e) => {
  if (e.target.closest('[data-drawer="close"]')) { closeDrawer(); return; }
  if (e.target.closest('#drawer a, #drawer [data-act]')) closeDrawer();
  const act = e.target.closest('[data-act]');
  if (act) {
    const a = act.dataset.act;
    if (a === 'login' || a === 'register') openAuth(a);
    if (a === 'logout') logout();
    if (a === 'buy') buyProduct(Number(act.dataset.id));
    return;
  }
  const f = e.target.closest('[data-filter]');
  if (f) { S.filter = f.dataset.filter; renderProducts(); }
});

$('#formDialog').addEventListener('click', (e) => { if (e.target === e.currentTarget) e.currentTarget.close(); });
$('#burger').addEventListener('click', () => (root.classList.contains('drawer-open') ? closeDrawer() : openDrawer()));
$('#scrim').addEventListener('click', closeDrawer);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDrawer(); });
window.addEventListener('hashchange', () => route());
window.addEventListener('scroll', onScroll, { passive: true });
window.addEventListener('resize', onScroll);

setInterval(() => {
  if (S.me && !document.hidden) refreshMe();
}, 20000);
setInterval(() => {
  if (!document.hidden) {
    loadConfig().then(applyMaintenance);
    if (S.me && !NK.order) loadNokos().then(drawNokos);
  }
}, 30000);

/* ------------------------------------------------------------------ */
/* Mulai                                                               */
/* ------------------------------------------------------------------ */
(async function init() {
  $('#year').textContent = new Date().getFullYear();
  observe();
  initGate();
  initMusic();
  await Promise.all([loadConfig(), loadProducts(), refreshMe()]);
  if (S.config.requireLogin && !S.me) showGate('login'); else hideGate();
  await loadNokos();
  renderProducts();
  initAkun();
  initTopup();
  initNokos();
  applyMaintenance();
  initFx();
  route();
  update();
})();
})();
