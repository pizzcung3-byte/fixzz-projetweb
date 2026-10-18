'use strict';
/*
 * By @maklodevv
 * Police619 Store: server tanpa dependensi (hanya modul bawaan Node.js 18+).
 * Database: file JSON di folder data/ (otomatis dibuat).
 */
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Baca file .env (tanpa library). Nilai yang sudah ada di environment tidak ditimpa.
(function loadEnv() {
  try {
    const f = path.join(__dirname, '.env');
    if (!fs.existsSync(f)) return;
    for (const line of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
      if (line.trim().startsWith('#')) continue;
      const m = /^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
      if (!m) continue;
      let v = m[2];
      if (/^(".*"|'.*')$/.test(v)) v = v.slice(1, -1);
      if (process.env[m[1]] === undefined) process.env[m[1]] = v;
    }
  } catch (_) { /* abaikan */ }
})();

const config = require('./config');

const PORT = Number(process.env.PORT) || config.port || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const PUBLIC_DIR = path.join(__dirname, 'public');
const SESSION_MS = 30 * 24 * 3600 * 1000;

/* ------------------------------------------------------------------ */
/* Database                                                            */
/* ------------------------------------------------------------------ */
fs.mkdirSync(DATA_DIR, { recursive: true });

let db = {
  seq: { user: 0, product: 0, order: 0, deposit: 0, message: 0, tx: 0 },
  users: [], products: [], orders: [], deposits: [], messages: [], txs: [], sessions: {},
  settings: { maintenance: {} }, broadcasts: [],
};
if (fs.existsSync(DB_FILE)) {
  const loaded = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  db = Object.assign(db, loaded);
  db.seq = Object.assign({ user: 0, product: 0, order: 0, deposit: 0, message: 0, tx: 0, broadcast: 0 }, loaded.seq);
}
db.seq.broadcast = db.seq.broadcast || 0;
db.settings = db.settings || { maintenance: {} };
db.settings.maintenance = db.settings.maintenance || {};
db.broadcasts = db.broadcasts || [];
db.nokos = db.nokos || {};
db.nokos.items = db.nokos.items || [];
db.nokos.numbers = db.nokos.numbers || [];
db.nokos.orders = db.nokos.orders || [];
for (const k of ['nokosItem', 'nokosNumber', 'nokosOrder']) db.seq[k] = db.seq[k] || 0;

const MAINT = { akun: 'Akun Telegram', produk: 'Channel & Panel', topup: 'Top Up Game', nokos: 'Nokos' };
for (const k of Object.keys(MAINT)) {
  db.settings.maintenance[k] = Object.assign({ on: false, from: '', to: '', note: '' }, db.settings.maintenance[k]);
}
const catKey = (category) => (category === 'akun' ? 'akun' : 'produk');
const isMaint = (key) => !!db.settings.maintenance[key].on;
const ACCENTS = { mint: '5ad6b0', sky: '62b6ff', amber: 'f2b84b', rose: 'ff7d8f', violet: 'a78bfa' };
const ACCENT = ACCENTS[process.env.ACCENT || config.accent] ? (process.env.ACCENT || config.accent) : 'mint';

/* ------------------------------------------------------------------ */
/* Atlantic (deposit QRIS otomatis)                                    */
/* ------------------------------------------------------------------ */
const ATL_KEY = process.env.ATLANTIC_API_KEY || '';
const ATL = Object.assign({ enabled: true, baseUrl: 'https://atlantich2h.com', type: 'ewallet', metode: 'qris', expireMinutes: 30, creditMode: 'nominal' }, (config.payment && config.payment.atlantic) || {});
const ATL_BASE = process.env.ATLANTIC_BASE || ATL.baseUrl;
const atlanticOn = () => !!ATL_KEY && ATL.enabled !== false;
const EXPIRE_GRACE = Number(process.env.ATLANTIC_EXPIRE_GRACE_MS) || 120000;

function atlanticCall(pathname, fields) {
  return new Promise((resolve, reject) => {
    const u = new URL(pathname, ATL_BASE);
    const lib = u.protocol === 'http:' ? http : https;
    const body = new URLSearchParams(Object.assign({ api_key: ATL_KEY }, fields)).toString();
    const req = lib.request(u, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) },
      timeout: 12000,
    }, (res) => {
      const chunks = [];
      let size = 0;
      res.on('data', (c) => { size += c.length; if (size < 1024 * 1024) chunks.push(c); });
      res.on('end', () => {
        try { resolve({ http: res.statusCode, json: JSON.parse(Buffer.concat(chunks).toString('utf8')) }); } catch (_) { reject(new Error('Balasan Atlantic bukan JSON')); }
      });
    });
    req.on('timeout', () => req.destroy(new Error('Atlantic tidak merespons')));
    req.on('error', (e) => reject(new Error(String(e.message).replace(ATL_KEY, '***'))));
    req.write(body);
    req.end();
  });
}

function fetchDataUrl(rawUrl) {
  return new Promise((resolve) => {
    let u;
    try { u = new URL(rawUrl); } catch (_) { return resolve(''); }
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return resolve('');
    const lib = u.protocol === 'http:' ? http : https;
    const req = lib.get(u, { timeout: 8000 }, (res) => {
      const type = String(res.headers['content-type'] || '');
      if (res.statusCode !== 200 || !type.startsWith('image/')) { res.resume(); return resolve(''); }
      const chunks = []; let size = 0;
      res.on('data', (c) => { size += c.length; if (size > 300 * 1024) { req.destroy(); resolve(''); } else chunks.push(c); });
      res.on('end', () => resolve(`data:${type.split(';')[0]};base64,${Buffer.concat(chunks).toString('base64')}`));
    });
    req.on('timeout', () => req.destroy());
    req.on('error', () => resolve(''));
  });
}
const WHATSAPP = String(process.env.WHATSAPP || config.whatsapp || '').replace(/\D/g, '');
const REQUIRE_LOGIN = process.env.REQUIRE_LOGIN ? process.env.REQUIRE_LOGIN === 'true' : config.requireLogin !== false;
const ALLOWED_HOSTS = (process.env.ALLOWED_HOSTS ? process.env.ALLOWED_HOSTS.split(',') : (config.allowedHosts || []))
  .map((x) => String(x).trim().toLowerCase()).filter(Boolean);
const LOCK_TEXT = 'Mau Ngapain bg? By @maklodevv';
function hostAllowed(req) {
  if (!ALLOWED_HOSTS.length || ALLOWED_HOSTS.includes('*')) return true;
  const host = String(req.headers.host || '').toLowerCase().replace(/:\d+$/, '');
  return ALLOWED_HOSTS.some((h) => h === host || (h.startsWith('*.') && host.endsWith(h.slice(1))));
}
const WEAK_PASSWORDS = new Set(['123456', '1234567', '12345678', '123456789', '1234567890', 'password', 'password1', 'qwerty', 'qwerty123', 'abc123', 'abcdef', '111111', '000000', '123123', 'iloveyou', 'admin123', 'rahasia']);
function weakPassword(pw, username) {
  const p = String(pw).toLowerCase();
  if (WEAK_PASSWORDS.has(p)) return 'Password terlalu mudah ditebak. Pakai kombinasi lain ya.';
  if (username && p === String(username).toLowerCase()) return 'Password tidak boleh sama dengan username.';
  if (/^(.)\1+$/.test(p)) return 'Password tidak boleh satu huruf berulang.';
  return '';
}

function save() {
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db), { mode: 0o600 });
  fs.renameSync(tmp, DB_FILE);
}

const now = () => Date.now();
const nextId = (k) => ++db.seq[k];

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */
class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  return salt + ':' + crypto.scryptSync(pw, salt, 64).toString('hex');
}
const DUMMY_HASH = hashPassword('dummy-password');
function checkPassword(pw, stored) {
  const [salt, h] = stored.split(':');
  const test = crypto.scryptSync(pw, salt, 64);
  const real = Buffer.from(h, 'hex');
  return test.length === real.length && crypto.timingSafeEqual(test, real);
}

const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const str = (v, max) => String(v == null ? '' : v).trim().slice(0, max);
function intIn(v, min, max, msg) {
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) throw new HttpError(400, msg);
  return n;
}

function pub(u) {
  return {
    id: u.id, username: u.username, displayName: u.displayName, role: u.role,
    balance: u.balance, bio: u.bio, avatar: u.avatar, color: u.color, createdAt: u.createdAt,
    banned: !!u.banned,
  };
}

function createUser(username, password, role) {
  const u = {
    id: nextId('user'), username, displayName: username, pass: hashPassword(password),
    role, balance: 0, bio: '', avatar: '', color: '', banned: false, createdAt: now(),
  };
  db.users.push(u);
  return u;
}

function addTx(userId, type, amount, note) {
  db.txs.push({ id: nextId('tx'), userId, type, amount, note: note || '', createdAt: now() });
}

function addMessage(userId, from, text, extra) {
  const m = Object.assign({ id: nextId('message'), userId, from, text, createdAt: now(), read: false }, extra);
  db.messages.push(m);
  return m;
}

/* ------------------------------------------------------------------ */
/* Rate limit sederhana (in-memory)                                    */
/* ------------------------------------------------------------------ */
const hits = new Map();
function limited(key, max, windowMs) {
  const t = now();
  const arr = (hits.get(key) || []).filter((x) => t - x < windowMs);
  arr.push(t);
  hits.set(key, arr);
  return arr.length > max;
}
setInterval(() => hits.clear(), 30 * 60 * 1000).unref();

/* ------------------------------------------------------------------ */
/* Sessions                                                            */
/* ------------------------------------------------------------------ */
function parseCookies(req) {
  const out = {};
  (req.headers.cookie || '').split(';').forEach((p) => {
    const i = p.indexOf('=');
    if (i > 0) {
      try { out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim()); } catch (_) { /* abaikan */ }
    }
  });
  return out;
}

function isSecure(req) {
  return !!req.socket.encrypted || req.headers['x-forwarded-proto'] === 'https';
}

function cookieHeader(req, token, maxAgeSec) {
  return `sid=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSec}` + (isSecure(req) ? '; Secure' : '');
}

function startSession(ctx, user) {
  const token = crypto.randomBytes(32).toString('hex');
  db.sessions[sha(token)] = { userId: user.id, exp: now() + SESSION_MS };
  ctx.headers['Set-Cookie'] = cookieHeader(ctx.req, token, SESSION_MS / 1000);
}

function dropSessions(userId) {
  for (const k of Object.keys(db.sessions)) if (db.sessions[k].userId === userId) delete db.sessions[k];
}

function getUser(req) {
  const t = parseCookies(req).sid;
  if (!t) return null;
  const k = sha(t);
  const s = db.sessions[k];
  if (!s) return null;
  if (s.exp < now()) { delete db.sessions[k]; return null; }
  const u = db.users.find((x) => x.id === s.userId);
  return u && !u.banned ? u : null;
}

/* ------------------------------------------------------------------ */
/* Seed data                                                           */
/* ------------------------------------------------------------------ */
function ensureOwner() {
  const uname = String(config.ownerUsername || 'owner').toLowerCase();
  const envPw = process.env.OWNER_PASSWORD || config.ownerPassword || '';
  let owner = db.users.find((u) => u.username === uname);
  if (!owner) {
    const pw = envPw || crypto.randomBytes(7).toString('base64url');
    owner = createUser(uname, pw, 'owner');
    owner.displayName = 'Owner';
    save();
    console.log('\n==============================================');
    console.log(' Akun owner dibuat');
    console.log('   username : ' + uname);
    console.log('   password : ' + pw + (envPw ? '' : '   (acak, catat sekarang!)'));
    console.log('==============================================\n');
  } else if (process.env.OWNER_PASSWORD) {
    owner.pass = hashPassword(process.env.OWNER_PASSWORD);
    owner.role = 'owner';
    dropSessions(owner.id);
    save();
    console.log('Password owner diatur ulang dari env OWNER_PASSWORD.');
  }
}

function seedProducts() {
  if (db.products.length) return;
  const items = [
    ['akun', 'Akun Telegram Nomor Indonesia (+62)', 'Akun siap login. Detail nomor dan cara login dikirim lewat chat setelah order.', 15000, 20],
    ['akun', 'Akun Telegram Usia 1 Tahun ke Atas', 'Akun lama untuk kebutuhan yang butuh riwayat akun. Stok terbatas.', 35000, 8],
    ['channel', 'Channel Telegram Siap Pakai', 'Serah-terima kepemilikan channel. Kategori dan jumlah subscriber ditanyakan lewat chat.', 75000, 5],
    ['channel', 'Channel Telegram Premium', 'Channel dengan username rapi. Hubungi owner untuk daftar yang tersedia.', 150000, 3],
    ['panel', 'Panel Pterodactyl 1 GB', 'RAM 1 GB, CPU 40%, Disk 2 GB. Aktif 30 hari. Login panel dikirim setelah order.', 5000, null],
    ['panel', 'Panel Pterodactyl 2 GB', 'RAM 2 GB, CPU 80%, Disk 4 GB. Aktif 30 hari.', 10000, null],
    ['panel', 'Panel Pterodactyl Unlimited', 'RAM, CPU, dan disk tanpa batas dari sisi panel. Aktif 30 hari.', 25000, null],
  ];
  for (const [category, title, description, price, stock] of items) {
    db.products.push({ id: nextId('product'), category, title, description, price, stock, active: true, createdAt: now() });
  }
  save();
}

function seedNokos() {
  if (db.nokos.items.length) return;
  const rows = [['Telegram', 'Indonesia', '+62', 4500], ['WhatsApp', 'Indonesia', '+62', 6000], ['Telegram', 'Malaysia', '+60', 3800], ['WhatsApp', 'Malaysia', '+60', 5300]];
  for (const [service, country, code, price] of rows) db.nokos.items.push({ id: nextId('nokosItem'), service, country, code, price, active: true, createdAt: now() });
  save();
}

ensureOwner();
seedProducts();
seedNokos();
for (const k of Object.keys(db.sessions)) if (db.sessions[k].exp < now()) delete db.sessions[k];
save();

/* ------------------------------------------------------------------ */
/* Router                                                              */
/* ------------------------------------------------------------------ */
const routes = [];
function route(method, pattern, auth, handler, opts) {
  routes.push({ method, auth, handler, form: !!(opts && opts.form), re: new RegExp('^' + pattern.replace(/:(\w+)/g, '(?<$1>[^/]+)') + '$') });
}

const CATEGORIES = ['akun', 'channel', 'panel'];
const AVATAR_RE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;
const COLOR_RE = /^#[0-9a-fA-F]{6}$/;

/* ---------- publik ---------- */
function maintOut() {
  const out = {};
  for (const k of Object.keys(MAINT)) {
    const m = db.settings.maintenance[k];
    out[k] = { label: MAINT[k], on: m.on, from: m.from, to: m.to, note: m.note };
  }
  return out;
}

route('GET', '/api/config', false, (ctx) => ({
  requireLogin: REQUIRE_LOGIN,
  siteName: config.siteName,
  telegram: config.telegram,
  whatsapp: WHATSAPP,
  timezoneLabel: config.timezoneLabel || 'WIB',
  accent: ACCENT,
  autoPay: atlanticOn(),
  autoPayMethod: 'QRIS',
  nokosWait: (config.nokos && config.nokos.waitMinutes) || 20,
  minDeposit: config.minDeposit,
  paymentMethods: (ctx.user || !REQUIRE_LOGIN) ? (config.paymentMethods || []) : [],
  maintenance: maintOut(),
}));

route('GET', '/api/products', false, (ctx) => {
  const owner = ctx.user && ctx.user.role === 'owner';
  if (REQUIRE_LOGIN && !ctx.user) throw new HttpError(401, 'Silakan masuk dulu.');
  return { products: db.products.filter((p) => p.active && (owner || !isMaint(catKey(p.category)))).map(productOut) };
});

function productOut(p) {
  return { id: p.id, category: p.category, title: p.title, description: p.description, price: p.price, stock: p.stock, active: p.active };
}

route('POST', '/api/register', false, (ctx) => {
  if (limited('reg:' + ctx.ip, 8, 3600e3)) throw new HttpError(429, 'Terlalu banyak percobaan. Coba lagi nanti.');
  const username = str(ctx.body.username, 20).toLowerCase();
  const password = String(ctx.body.password || '');
  if (!/^[a-z0-9_]{3,20}$/.test(username)) throw new HttpError(400, 'Username 3-20 karakter: huruf, angka, atau garis bawah.');
  if (password.length < 6 || password.length > 100) throw new HttpError(400, 'Password minimal 6 karakter.');
  const weak = weakPassword(password, username);
  if (weak) throw new HttpError(400, weak);
  if (username === String(config.ownerUsername).toLowerCase() || db.users.some((u) => u.username === username)) {
    throw new HttpError(409, 'Username sudah dipakai.');
  }
  const user = createUser(username, password, 'user');
  startSession(ctx, user);
  save();
  return { user: pub(user) };
});

route('POST', '/api/login', false, (ctx) => {
  const username = str(ctx.body.username, 20).toLowerCase();
  const password = String(ctx.body.password || '').slice(0, 100);
  if (limited('login:' + ctx.ip, 20, 10 * 60e3) || limited('loginu:' + username, 10, 10 * 60e3)) {
    throw new HttpError(429, 'Terlalu banyak percobaan login. Coba lagi beberapa menit lagi.');
  }
  const user = db.users.find((u) => u.username === username);
  const ok = checkPassword(password, user ? user.pass : DUMMY_HASH);
  if (!user || !ok) throw new HttpError(401, 'Username atau password salah.');
  if (user.banned) throw new HttpError(403, 'Akun ini diblokir. Hubungi owner.');
  startSession(ctx, user);
  save();
  return { user: pub(user) };
});

route('POST', '/api/logout', false, (ctx) => {
  const t = parseCookies(ctx.req).sid;
  if (t) { delete db.sessions[sha(t)]; save(); }
  ctx.headers['Set-Cookie'] = cookieHeader(ctx.req, '', 0);
  return { ok: true };
});

/* ---------- user ---------- */
route('GET', '/api/me', false, (ctx) => {
  const u = ctx.user;
  if (!u) return { user: null };
  const out = { user: pub(u), badges: {} };
  if (u.role === 'owner') {
    out.badges.chat = db.messages.filter((m) => m.from === 'user' && !m.read).length;
    out.badges.deposits = db.deposits.filter((d) => d.status === 'pending').length;
    out.badges.orders = db.orders.filter((o) => o.status === 'pending').length;
  } else {
    out.badges.chat = db.messages.filter((m) => m.userId === u.id && m.from === 'owner' && !m.read).length;
  }
  return out;
});

route('POST', '/api/profile', 'user', (ctx) => {
  const u = ctx.user; const b = ctx.body;
  const displayName = str(b.displayName, 30);
  if (!displayName) throw new HttpError(400, 'Nama tampilan tidak boleh kosong.');
  const avatar = String(b.avatar || '');
  if (avatar && (avatar.length > 150000 || !AVATAR_RE.test(avatar))) throw new HttpError(400, 'Foto profil tidak valid atau terlalu besar.');
  const color = String(b.color || '');
  if (color && !COLOR_RE.test(color)) throw new HttpError(400, 'Warna tidak valid.');
  u.displayName = displayName;
  u.bio = str(b.bio, 160);
  u.avatar = avatar;
  u.color = color;
  save();
  return { user: pub(u) };
});

route('POST', '/api/password', 'user', (ctx) => {
  const u = ctx.user;
  const current = String(ctx.body.current || '').slice(0, 100);
  const next = String(ctx.body.next || '');
  if (limited('pw:' + u.id, 8, 10 * 60e3)) throw new HttpError(429, 'Terlalu banyak percobaan.');
  if (!checkPassword(current, u.pass)) throw new HttpError(400, 'Password lama salah.');
  if (next.length < 6 || next.length > 100) throw new HttpError(400, 'Password baru minimal 6 karakter.');
  const weakNext = weakPassword(next, u.username);
  if (weakNext) throw new HttpError(400, weakNext);
  u.pass = hashPassword(next);
  save();
  return { ok: true };
});

route('GET', '/api/transactions', 'user', (ctx) =>
  ({ transactions: db.txs.filter((t) => t.userId === ctx.user.id).slice(-100).reverse() }));

/* ---------- deposit ---------- */
function pubDep(d) {
  return {
    id: d.id, amount: d.amount, method: d.method, note: d.note, status: d.status, createdAt: d.createdAt, handledAt: d.handledAt,
    auto: d.provider === 'atlantic', expiresAt: d.expiresAt || null,
    qrString: d.status === 'pending' ? (d.qrString || '') : '', qrImage: d.status === 'pending' ? (d.qrImage || '') : '',
  };
}

route('GET', '/api/deposits', 'user', (ctx) =>
  ({ deposits: db.deposits.filter((d) => d.userId === ctx.user.id).slice(-50).reverse().map(pubDep) }));

route('POST', '/api/deposits', 'user', (ctx) => {
  const u = ctx.user;
  const amount = intIn(ctx.body.amount, config.minDeposit || 1000, 50000000,
    `Nominal deposit minimal Rp ${(config.minDeposit || 1000).toLocaleString('id-ID')}.`);
  if (db.deposits.filter((d) => d.userId === u.id && d.status === 'pending').length >= 5) {
    throw new HttpError(429, 'Masih ada 5 permintaan deposit yang menunggu konfirmasi.');
  }
  const d = {
    id: nextId('deposit'), userId: u.id, amount, method: str(ctx.body.method, 40), note: str(ctx.body.note, 200),
    status: 'pending', createdAt: now(), handledAt: null,
  };
  db.deposits.push(d);
  addMessage(u.id, 'user', `Halo, saya sudah kirim permintaan deposit #${d.id} sebesar Rp ${amount.toLocaleString('id-ID')}. Mohon dicek ya.`);
  save();
  return { deposit: d };
});

/* ---------- deposit otomatis (Atlantic) ---------- */
const syncing = new Set();
const lastSync = new Map();

function creditDeposit(dep, credit) {
  const u = db.users.find((x) => x.id === dep.userId);
  if (!u) { dep.status = 'review'; dep.handledAt = now(); return; }
  u.balance += credit;
  dep.status = 'approved';
  dep.handledAt = now();
  dep.credited = credit;
  addTx(u.id, 'deposit', credit, `Deposit #${dep.id} (QRIS) berhasil`);
  addMessage(u.id, 'owner', `Deposit #${dep.id} sebesar Rp ${credit.toLocaleString('id-ID')} sudah masuk ke saldo kamu.`);
}

// Cek status ke Atlantic. Saldo HANYA ditambah kalau Atlantic sendiri menjawab "success" untuk deposit ini.
async function syncAtlantic(dep, force) {
  if (dep.provider !== 'atlantic' || dep.status !== 'pending') return dep;
  if (syncing.has(dep.id)) return dep;
  if (!force && now() - (lastSync.get(dep.id) || 0) < 2500) return dep;
  syncing.add(dep.id);
  lastSync.set(dep.id, now());
  try {
    const r = await atlanticCall('/deposit/status', { id: dep.extId });
    const d = r.json && r.json.data;
    if (dep.status !== 'pending') return dep;
    const st = d ? String(d.status || '').toLowerCase() : '';
    if (st === 'success') {
      if ((d.reff_id && String(d.reff_id) !== dep.ref) || (d.nominal != null && Number(d.nominal) !== dep.amount)) {
        dep.status = 'review'; dep.handledAt = now(); // data tidak cocok, owner yang memutuskan
      } else {
        const net = Number(d.get_balance);
        creditDeposit(dep, ATL.creditMode === 'net' && net > 0 ? net : dep.amount);
      }
      save();
    } else if (st === 'cancel' || st === 'cancelled' || st === 'failed' || st === 'expired') {
      dep.status = st === 'expired' ? 'expired' : 'cancelled';
      dep.handledAt = now();
      save();
    } else if (now() > dep.expiresAt + EXPIRE_GRACE) {
      const c = await atlanticCall('/deposit/cancel', { id: dep.extId });
      if (dep.status === 'pending' && c.json && c.json.data && String(c.json.data.status).toLowerCase() === 'cancel') {
        dep.status = 'expired'; dep.handledAt = now(); save();
      }
    }
  } catch (_) { /* coba lagi di putaran berikutnya */ } finally { syncing.delete(dep.id); }
  return dep;
}

setInterval(() => {
  if (!atlanticOn()) return;
  const pend = db.deposits.filter((d) => d.provider === 'atlantic' && d.status === 'pending').slice(0, 25);
  pend.reduce((p, d) => p.then(() => syncAtlantic(d, true)), Promise.resolve());
}, 15000).unref();

route('POST', '/api/deposits/auto', 'user', async (ctx) => {
  if (!atlanticOn()) throw new HttpError(503, 'Pembayaran otomatis belum aktif. Pakai deposit manual atau hubungi owner.');
  const u = ctx.user;
  if (limited('autodep:' + u.id, 8, 10 * 60e3)) throw new HttpError(429, 'Terlalu banyak permintaan. Tunggu sebentar.');
  const min = config.minDeposit || 10000;
  const amount = intIn(ctx.body.amount, min, 5000000, `Nominal deposit minimal Rp ${min.toLocaleString('id-ID')} dan maksimal Rp 5.000.000.`);
  if (db.deposits.filter((d) => d.userId === u.id && d.provider === 'atlantic' && d.status === 'pending').length >= 2) {
    throw new HttpError(429, 'Masih ada 2 deposit otomatis yang belum dibayar. Bayar atau batalkan dulu.');
  }
  const ref = 'FZ' + now().toString(36).toUpperCase() + crypto.randomBytes(3).toString('hex').toUpperCase();
  let r;
  try { r = await atlanticCall('/deposit/create', { reff_id: ref, nominal: amount, type: ATL.type, metode: ATL.metode }); } catch (e) {
    throw new HttpError(502, 'Tidak bisa menghubungi Atlantic. Coba lagi sebentar lagi.');
  }
  const j = r.json || {};
  const data = j.data || {};
  if (!(j.status === true || j.status === 'true') || !data.id) {
    const why = j.message ? String(j.message).replace(/[<>]/g, '').slice(0, 120) : 'permintaan ditolak';
    throw new HttpError(502, 'Atlantic menolak: ' + why);
  }
  const qrString = String(data.qr_string || data.qr || data.qr_content || '');
  let qrImage = String(data.qr_image || data.qr_url || data.qr_link || '');
  if (qrImage && !qrImage.startsWith('data:image/')) qrImage = await fetchDataUrl(qrImage);
  let expiresAt = Date.parse(String(data.expired_at || data.expired || '').replace(' ', 'T'));
  if (!(expiresAt > now())) expiresAt = now() + ATL.expireMinutes * 60000;
  const dep = {
    id: nextId('deposit'), userId: u.id, amount, method: 'QRIS (otomatis)', note: '', status: 'pending', createdAt: now(), handledAt: null,
    provider: 'atlantic', ref, extId: String(data.id), qrString, qrImage, expiresAt, fee: Number(data.fee) || 0,
  };
  db.deposits.push(dep);
  save();
  return { deposit: pubDep(dep) };
});

route('GET', '/api/deposits/:id', 'user', async (ctx) => {
  const d = db.deposits.find((x) => x.id === Number(ctx.params.id) && x.userId === ctx.user.id);
  if (!d) throw new HttpError(404, 'Deposit tidak ditemukan.');
  await syncAtlantic(d);
  return { deposit: pubDep(d), balance: ctx.user.balance };
});

route('POST', '/api/deposits/:id/cancel', 'user', async (ctx) => {
  const d = db.deposits.find((x) => x.id === Number(ctx.params.id) && x.userId === ctx.user.id);
  if (!d) throw new HttpError(404, 'Deposit tidak ditemukan.');
  if (d.status !== 'pending') throw new HttpError(409, 'Deposit ini sudah tidak menunggu pembayaran.');
  if (d.provider !== 'atlantic') throw new HttpError(400, 'Deposit manual dibatalkan lewat owner.');
  await syncAtlantic(d, true);
  if (d.status !== 'pending') return { deposit: pubDep(d), balance: ctx.user.balance };
  let r;
  try { r = await atlanticCall('/deposit/cancel', { id: d.extId }); } catch (_) { throw new HttpError(502, 'Gagal membatalkan di Atlantic. Coba lagi.'); }
  const st = r.json && r.json.data ? String(r.json.data.status || '').toLowerCase() : '';
  if (st !== 'cancel') throw new HttpError(502, 'Atlantic belum bisa membatalkan deposit ini.');
  if (d.status === 'pending') { d.status = 'cancelled'; d.handledAt = now(); save(); }
  return { deposit: pubDep(d), balance: ctx.user.balance };
});

// Webhook dari Atlantic. Isi kiriman TIDAK dipercaya: kita hanya memakainya untuk tahu deposit mana
// yang dicek, lalu status aslinya ditanyakan langsung ke Atlantic dengan API key.
route('POST', '/api/payment/atlantic/callback', false, async (ctx) => {
  if (limited('cb:' + ctx.ip, 60, 60e3)) throw new HttpError(429, 'Terlalu banyak.');
  const b = ctx.body || {};
  const inner = b.data && typeof b.data === 'object' ? b.data : {};
  const ext = String(b.id || inner.id || '');
  const ref = String(b.reff_id || inner.reff_id || '');
  const dep = db.deposits.find((d) => d.provider === 'atlantic' && ((ext && d.extId === ext) || (ref && d.ref === ref)));
  if (dep) await syncAtlantic(dep, true);
  return { ok: true };
}, { form: true });

route('GET', '/api/owner/payment', 'owner', (ctx) => {
  const proto = isSecure(ctx.req) ? 'https' : 'http';
  const host = String(ctx.req.headers.host || '');
  return {
    atlantic: { enabled: atlanticOn(), hasKey: !!ATL_KEY, baseHost: (() => { try { return new URL(ATL_BASE).host; } catch (_) { return ''; } })(), type: ATL.type, metode: ATL.metode, expireMinutes: ATL.expireMinutes, creditMode: ATL.creditMode },
    callbackUrl: `${proto}://${host}/api/payment/atlantic/callback`,
    recent: db.deposits.filter((d) => d.provider === 'atlantic').slice(-15).reverse().map((d) => ({ id: d.id, amount: d.amount, status: d.status, createdAt: d.createdAt, user: userBrief(d.userId) })),
  };
});

/* ---------- order ---------- */
route('GET', '/api/orders', 'user', (ctx) =>
  ({ orders: db.orders.filter((o) => o.userId === ctx.user.id).slice(-50).reverse() }));

route('POST', '/api/orders', 'user', (ctx) => {
  const u = ctx.user;
  const p = db.products.find((x) => x.id === Number(ctx.body.productId) && x.active);
  if (!p) throw new HttpError(404, 'Produk tidak ditemukan.');
  if (u.role !== 'owner' && isMaint(catKey(p.category))) throw new HttpError(503, 'Bagian ini sedang maintenance. Coba lagi nanti ya.');
  if (p.stock !== null && p.stock < 1) throw new HttpError(409, 'Stok habis.');
  if (u.balance < p.price) throw new HttpError(402, 'Saldo tidak cukup. Deposit dulu ya.');
  u.balance -= p.price;
  if (p.stock !== null) p.stock -= 1;
  const o = {
    id: nextId('order'), userId: u.id, productId: p.id, title: p.title, category: p.category,
    price: p.price, status: 'pending', createdAt: now(), handledAt: null,
  };
  db.orders.push(o);
  addTx(u.id, 'purchase', -p.price, `Order #${o.id}: ${p.title}`);
  addMessage(u.id, 'user', `Halo, saya baru order #${o.id}: ${p.title}. Mohon diproses.`);
  save();
  return { order: o, user: pub(u) };
});

/* ---------- chat (user <-> owner) ---------- */
route('GET', '/api/chat', 'user', (ctx) => {
  const msgs = db.messages.filter((m) => m.userId === ctx.user.id);
  let changed = false;
  for (const m of msgs) if (m.from === 'owner' && !m.read) { m.read = true; changed = true; }
  if (changed) save();
  return { messages: msgs.slice(-200) };
});

route('POST', '/api/chat', 'user', (ctx) => {
  const text = str(ctx.body.text, 1000);
  if (!text) throw new HttpError(400, 'Pesan kosong.');
  if (limited('chat:' + ctx.user.id, 30, 60e3)) throw new HttpError(429, 'Terlalu cepat, tunggu sebentar.');
  const m = addMessage(ctx.user.id, 'user', text);
  save();
  return { message: m };
});

/* ---------- owner ---------- */
route('GET', '/api/owner/users', 'owner', () => ({
  users: db.users.filter((u) => u.role !== 'owner').map((u) => Object.assign(pub(u), {
    unread: db.messages.filter((m) => m.userId === u.id && m.from === 'user' && !m.read).length,
    orders: db.orders.filter((o) => o.userId === u.id).length,
  })).reverse(),
}));

route('POST', '/api/owner/balance', 'owner', (ctx) => {
  const u = db.users.find((x) => x.id === Number(ctx.body.userId));
  if (!u) throw new HttpError(404, 'User tidak ditemukan.');
  const amount = intIn(ctx.body.amount, -1000000000, 1000000000, 'Nominal tidak valid.');
  if (amount === 0) throw new HttpError(400, 'Nominal tidak boleh 0.');
  if (u.balance + amount < 0) throw new HttpError(400, 'Saldo user tidak boleh jadi minus.');
  u.balance += amount;
  const note = str(ctx.body.note, 100);
  const self = u.role === 'owner';
  addTx(u.id, 'owner_adjust', amount, self ? 'Saldo owner ' + (amount > 0 ? 'ditambah' : 'dikurangi') : (note || (amount > 0 ? 'Owner menambahkan saldo' : 'Owner mengurangi saldo')));
  if (!self) {
    const abs = Math.abs(amount).toLocaleString('id-ID');
    addMessage(u.id, 'owner', `${amount > 0 ? 'Owner menambahkan saldo' : 'Owner mengurangi saldo'} Rp ${abs}${note ? '. Catatan: ' + note : ''}`);
  }
  save();
  return { user: pub(u) };
});

route('POST', '/api/owner/users/:id/password', 'owner', (ctx) => {
  const u = db.users.find((x) => x.id === Number(ctx.params.id) && x.role !== 'owner');
  if (!u) throw new HttpError(404, 'User tidak ditemukan.');
  const pw = String(ctx.body.password || '');
  if (pw.length < 6 || pw.length > 100) throw new HttpError(400, 'Password minimal 6 karakter.');
  u.pass = hashPassword(pw);
  dropSessions(u.id);
  save();
  return { ok: true };
});

route('POST', '/api/owner/users/:id/ban', 'owner', (ctx) => {
  const u = db.users.find((x) => x.id === Number(ctx.params.id) && x.role !== 'owner');
  if (!u) throw new HttpError(404, 'User tidak ditemukan.');
  u.banned = !!ctx.body.banned;
  if (u.banned) dropSessions(u.id);
  save();
  return { user: pub(u) };
});

function userBrief(id) {
  const u = db.users.find((x) => x.id === id);
  return u ? { id: u.id, username: u.username, displayName: u.displayName, avatar: u.avatar, color: u.color } : { id, username: '(dihapus)', displayName: '(dihapus)', avatar: '', color: '' };
}

route('GET', '/api/owner/deposits', 'owner', () => ({
  deposits: db.deposits.slice().reverse()
    .sort((a, b) => (a.status === 'pending' ? 0 : 1) - (b.status === 'pending' ? 0 : 1))
    .slice(0, 200).map((d) => Object.assign({ provider: d.provider || 'manual' }, pubDep(d), { qrString: '', qrImage: '', user: userBrief(d.userId) })),
}));

route('POST', '/api/owner/deposits/:id', 'owner', (ctx) => {
  const d = db.deposits.find((x) => x.id === Number(ctx.params.id));
  if (!d) throw new HttpError(404, 'Deposit tidak ditemukan.');
  if (d.status !== 'pending' && d.status !== 'review') throw new HttpError(409, 'Deposit ini sudah diproses.');
  if (d.provider === 'atlantic' && d.status === 'pending') throw new HttpError(409, 'Deposit otomatis ini masih menunggu pembayaran. Sistem yang akan mengonfirmasinya.');
  const action = ctx.body.action;
  if (action === 'approve') {
    const u = db.users.find((x) => x.id === d.userId);
    if (!u) throw new HttpError(404, 'User tidak ditemukan.');
    u.balance += d.amount;
    d.status = 'approved';
    addTx(u.id, 'deposit', d.amount, `Deposit #${d.id} disetujui`);
    addMessage(u.id, 'owner', `Deposit #${d.id} sebesar Rp ${d.amount.toLocaleString('id-ID')} sudah masuk ke saldo kamu.`);
  } else if (action === 'reject') {
    d.status = 'rejected';
    addMessage(d.userId, 'owner', `Deposit #${d.id} belum bisa dikonfirmasi. Silakan cek bukti transfer dan chat di sini.`);
  } else {
    throw new HttpError(400, 'Aksi tidak dikenal.');
  }
  d.handledAt = now();
  save();
  return { deposit: pubDep(d) };
});

route('GET', '/api/owner/orders', 'owner', () => ({
  orders: db.orders.slice().reverse()
    .sort((a, b) => (a.status === 'pending' ? 0 : 1) - (b.status === 'pending' ? 0 : 1))
    .slice(0, 200).map((o) => Object.assign({}, o, { user: userBrief(o.userId) })),
}));

route('POST', '/api/owner/orders/:id', 'owner', (ctx) => {
  const o = db.orders.find((x) => x.id === Number(ctx.params.id));
  if (!o) throw new HttpError(404, 'Pesanan tidak ditemukan.');
  if (o.status !== 'pending') throw new HttpError(409, 'Pesanan ini sudah diproses.');
  const action = ctx.body.action;
  if (action === 'done') {
    o.status = 'done';
    addMessage(o.userId, 'owner', `Pesanan #${o.id} (${o.title}) sudah selesai. Terima kasih sudah belanja!`);
  } else if (action === 'cancel') {
    const u = db.users.find((x) => x.id === o.userId);
    if (u) { u.balance += o.price; addTx(u.id, 'refund', o.price, `Refund order #${o.id}`); }
    const p = db.products.find((x) => x.id === o.productId);
    if (p && p.stock !== null) p.stock += 1;
    o.status = 'cancelled';
    addMessage(o.userId, 'owner', `Pesanan #${o.id} dibatalkan dan saldo Rp ${o.price.toLocaleString('id-ID')} sudah dikembalikan.`);
  } else {
    throw new HttpError(400, 'Aksi tidak dikenal.');
  }
  o.handledAt = now();
  save();
  return { order: o };
});

route('GET', '/api/owner/products', 'owner', () => ({ products: db.products.map(productOut) }));

route('POST', '/api/owner/products', 'owner', (ctx) => {
  const b = ctx.body;
  const category = String(b.category || '');
  if (!CATEGORIES.includes(category)) throw new HttpError(400, 'Kategori tidak valid.');
  const title = str(b.title, 80);
  if (!title) throw new HttpError(400, 'Judul produk wajib diisi.');
  const price = intIn(b.price, 0, 100000000, 'Harga tidak valid.');
  const stock = (b.stock === '' || b.stock == null) ? null : intIn(b.stock, 0, 99999, 'Stok tidak valid.');
  const fields = { category, title, description: str(b.description, 300), price, stock, active: b.active !== false };
  let p;
  if (b.id) {
    p = db.products.find((x) => x.id === Number(b.id));
    if (!p) throw new HttpError(404, 'Produk tidak ditemukan.');
    Object.assign(p, fields);
  } else {
    p = Object.assign({ id: nextId('product'), createdAt: now() }, fields);
    db.products.push(p);
  }
  save();
  return { product: productOut(p) };
});

route('POST', '/api/owner/products/:id/delete', 'owner', (ctx) => {
  const i = db.products.findIndex((x) => x.id === Number(ctx.params.id));
  if (i < 0) throw new HttpError(404, 'Produk tidak ditemukan.');
  db.products.splice(i, 1);
  save();
  return { ok: true };
});

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

route('GET', '/api/owner/maintenance', 'owner', () => ({ maintenance: maintOut(), timezoneLabel: config.timezoneLabel || 'WIB' }));

route('POST', '/api/owner/maintenance', 'owner', (ctx) => {
  const b = ctx.body;
  const keys = b.all ? Object.keys(MAINT) : [String(b.key || '')];
  for (const k of keys) if (!MAINT[k]) throw new HttpError(400, 'Bagian tidak dikenal.');
  for (const k of keys) {
    const m = db.settings.maintenance[k];
    if (!b.all) {
      const from = String(b.from == null ? m.from : b.from).trim();
      const to = String(b.to == null ? m.to : b.to).trim();
      if ((from && !TIME_RE.test(from)) || (to && !TIME_RE.test(to))) throw new HttpError(400, 'Format jam harus HH:MM, contoh 22:00.');
      m.from = from;
      m.to = to;
      if (b.note != null) m.note = str(b.note, 200);
    }
    if (typeof b.on === 'boolean') m.on = b.on;
  }
  save();
  return { maintenance: maintOut() };
});

route('GET', '/api/owner/broadcasts', 'owner', () => ({ broadcasts: db.broadcasts.slice(-30).reverse() }));

route('POST', '/api/owner/broadcast', 'owner', (ctx) => {
  const text = str(ctx.body.text, 1000);
  if (!text) throw new HttpError(400, 'Isi pesan broadcast dulu.');
  const targets = db.users.filter((u) => u.role !== 'owner' && !u.banned);
  if (!targets.length) throw new HttpError(400, 'Belum ada pengguna yang bisa dikirimi.');
  for (const u of targets) addMessage(u.id, 'owner', text, { broadcast: true });
  const rec = { id: nextId('broadcast'), text, count: targets.length, createdAt: now() };
  db.broadcasts.push(rec);
  if (db.broadcasts.length > 200) db.broadcasts.splice(0, db.broadcasts.length - 200);
  save();
  return { broadcast: rec };
});

/* ---------- nokos (stok sendiri + kode OTP) ---------- */
const NOKOS = Object.assign({ waitMinutes: 20, recycleNumbers: true }, config.nokos || {});
const NOKOS_SECRET = process.env.NOKOS_INBOUND_SECRET || '';
const digitsOf = (v) => String(v || '').replace(/\D/g, '');
const stockOf = (itemId) => db.nokos.numbers.filter((n) => n.itemId === itemId && n.status === 'stock').length;
const nokosPub = (o) => ({ id: o.id, service: o.service, country: o.country, code: o.code, price: o.price, number: o.number, status: o.status, otp: o.otp || '', createdAt: o.createdAt, expiresAt: o.expiresAt, doneAt: o.doneAt || null });

function nokosRelease(o, why) {
  // kembalikan saldo + nomor, dipakai saat batal atau kedaluwarsa
  const u = db.users.find((x) => x.id === o.userId);
  if (u) { u.balance += o.price; addTx(u.id, 'refund', o.price, `Refund nokos #${o.id}`); }
  const num = db.nokos.numbers.find((n) => n.id === o.numberId);
  if (num && NOKOS.recycleNumbers) { num.status = 'stock'; num.orderId = null; }
  o.status = why;
  o.doneAt = now();
  if (u) addMessage(u.id, 'owner', `Pesanan nokos #${o.id} ${why === 'expired' ? 'kedaluwarsa karena kode OTP tidak masuk' : 'dibatalkan'}. Saldo Rp ${o.price.toLocaleString('id-ID')} sudah dikembalikan.`);
}

function nokosSweep() {
  let changed = false;
  for (const o of db.nokos.orders) {
    if (o.status === 'waiting' && o.expiresAt < now()) { nokosRelease(o, 'expired'); changed = true; }
  }
  if (changed) save();
}
setInterval(nokosSweep, 30000).unref();

route('GET', '/api/nokos/catalog', false, (ctx) => {
  if (REQUIRE_LOGIN && !ctx.user) throw new HttpError(401, 'Silakan masuk dulu.');
  const items = db.nokos.items.filter((i) => i.active).map((i) => ({ id: i.id, service: i.service, country: i.country, code: i.code, price: i.price, stock: stockOf(i.id) }));
  return { items, waitMinutes: NOKOS.waitMinutes };
});

route('POST', '/api/nokos/order', 'user', (ctx) => {
  const u = ctx.user;
  if (u.role !== 'owner' && isMaint('nokos')) throw new HttpError(503, 'Bagian ini sedang maintenance. Coba lagi nanti ya.');
  if (limited('nokos:' + u.id, 12, 10 * 60e3)) throw new HttpError(429, 'Terlalu cepat. Tunggu sebentar.');
  nokosSweep();
  const item = db.nokos.items.find((i) => i.id === Number(ctx.body.itemId) && i.active);
  if (!item) throw new HttpError(404, 'Layanan tidak ditemukan.');
  if (db.nokos.orders.filter((o) => o.userId === u.id && o.status === 'waiting').length >= 3) throw new HttpError(429, 'Masih ada 3 pesanan nokos yang menunggu kode. Selesaikan dulu.');
  const num = db.nokos.numbers.find((n) => n.itemId === item.id && n.status === 'stock');
  if (!num) throw new HttpError(409, 'Stok nomor habis. Coba lagi nanti atau hubungi owner.');
  if (u.balance < item.price) throw new HttpError(402, 'Saldo tidak cukup. Deposit dulu ya.');
  u.balance -= item.price;
  const o = {
    id: nextId('nokosOrder'), userId: u.id, itemId: item.id, service: item.service, country: item.country, code: item.code, price: item.price,
    number: num.number, numberId: num.id, status: 'waiting', otp: '', createdAt: now(), expiresAt: now() + NOKOS.waitMinutes * 60000, doneAt: null,
  };
  num.status = 'used'; num.orderId = o.id;
  db.nokos.orders.push(o);
  addTx(u.id, 'purchase', -item.price, `Nokos #${o.id}: ${item.service} ${item.country}`);
  save();
  return { order: nokosPub(o), user: pub(u) };
});

route('GET', '/api/nokos/orders', 'user', (ctx) => {
  nokosSweep();
  return { orders: db.nokos.orders.filter((o) => o.userId === ctx.user.id).slice(-30).reverse().map(nokosPub) };
});

route('GET', '/api/nokos/orders/:id', 'user', (ctx) => {
  nokosSweep();
  const o = db.nokos.orders.find((x) => x.id === Number(ctx.params.id) && x.userId === ctx.user.id);
  if (!o) throw new HttpError(404, 'Pesanan tidak ditemukan.');
  return { order: nokosPub(o), balance: ctx.user.balance };
});

route('POST', '/api/nokos/orders/:id/cancel', 'user', (ctx) => {
  const o = db.nokos.orders.find((x) => x.id === Number(ctx.params.id) && x.userId === ctx.user.id);
  if (!o) throw new HttpError(404, 'Pesanan tidak ditemukan.');
  if (o.status !== 'waiting') throw new HttpError(409, 'Pesanan ini sudah tidak menunggu kode.');
  nokosRelease(o, 'cancelled');
  save();
  return { order: nokosPub(o), balance: ctx.user.balance };
});

// Penerima SMS dari aplikasi peneruus SMS di HP/SIM milik owner. Dilindungi NOKOS_INBOUND_SECRET.
route('POST', '/api/nokos/inbound', false, (ctx) => {
  if (!NOKOS_SECRET) throw new HttpError(503, 'Penerima SMS belum diaktifkan.');
  if (limited('inb:' + ctx.ip, 120, 60e3)) throw new HttpError(429, 'Terlalu banyak.');
  const given = String(ctx.req.headers['x-secret'] || ctx.body.secret || '');
  const a = Buffer.from(given); const b = Buffer.from(NOKOS_SECRET);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) throw new HttpError(403, 'Rahasia salah.');
  const num = digitsOf(ctx.body.number || ctx.body.from || ctx.body.to);
  const text = String(ctx.body.text || ctx.body.message || ctx.body.body || '').slice(0, 500);
  if (num.length < 7 || !text) throw new HttpError(400, 'number dan text wajib diisi.');
  nokosSweep();
  const o = db.nokos.orders.find((x) => x.status === 'waiting' && (digitsOf(x.number).endsWith(num.slice(-9)) || num.endsWith(digitsOf(x.number).slice(-9))));
  if (!o) return { ok: true, matched: false };
  const m = /(?:kode|code|otp|verification|verifikasi)\D{0,20}(\d{4,8})/i.exec(text) || /\b(\d{4,8})\b/.exec(text.replace(/\D?(\d{3})-(\d{3})\D?/, '$1$2'));
  if (!m) return { ok: true, matched: true, code: false };
  o.otp = m[1]; o.otpText = text; o.status = 'done'; o.doneAt = now();
  save();
  return { ok: true, matched: true, code: true };
}, { form: true });

route('GET', '/api/owner/nokos', 'owner', () => {
  nokosSweep();
  return {
    waitMinutes: NOKOS.waitMinutes,
    inboundEnabled: !!NOKOS_SECRET,
    items: db.nokos.items.map((i) => Object.assign({}, i, { stock: stockOf(i.id) })),
    orders: db.nokos.orders.slice().reverse()
      .sort((a, b) => (a.status === 'waiting' ? 0 : 1) - (b.status === 'waiting' ? 0 : 1))
      .slice(0, 100).map((o) => Object.assign(nokosPub(o), { user: userBrief(o.userId) })),
  };
});

route('POST', '/api/owner/nokos/items', 'owner', (ctx) => {
  const b = ctx.body;
  const service = str(b.service, 40); const country = str(b.country, 40); const code = str(b.code, 8);
  if (!service || !country) throw new HttpError(400, 'Layanan dan negara wajib diisi.');
  if (code && !/^\+?\d{1,4}$/.test(code)) throw new HttpError(400, 'Kode negara tidak valid, contoh +62.');
  const price = intIn(b.price, 0, 10000000, 'Harga tidak valid.');
  const fields = { service, country, code, price, active: b.active !== false };
  let it;
  if (b.id) {
    it = db.nokos.items.find((x) => x.id === Number(b.id));
    if (!it) throw new HttpError(404, 'Item tidak ditemukan.');
    Object.assign(it, fields);
  } else {
    it = Object.assign({ id: nextId('nokosItem'), createdAt: now() }, fields);
    db.nokos.items.push(it);
  }
  save();
  return { item: Object.assign({}, it, { stock: stockOf(it.id) }) };
});

route('POST', '/api/owner/nokos/items/:id/delete', 'owner', (ctx) => {
  const id = Number(ctx.params.id);
  const i = db.nokos.items.findIndex((x) => x.id === id);
  if (i < 0) throw new HttpError(404, 'Item tidak ditemukan.');
  if (db.nokos.orders.some((o) => o.itemId === id && o.status === 'waiting')) throw new HttpError(409, 'Masih ada pesanan yang menunggu kode untuk item ini.');
  db.nokos.items.splice(i, 1);
  db.nokos.numbers = db.nokos.numbers.filter((n) => n.itemId !== id || n.status === 'used');
  save();
  return { ok: true };
});

route('POST', '/api/owner/nokos/items/:id/numbers', 'owner', (ctx) => {
  const it = db.nokos.items.find((x) => x.id === Number(ctx.params.id));
  if (!it) throw new HttpError(404, 'Item tidak ditemukan.');
  if (ctx.body.clear) {
    db.nokos.numbers = db.nokos.numbers.filter((n) => n.itemId !== it.id || n.status !== 'stock');
    save();
    return { added: 0, stock: stockOf(it.id) };
  }
  const lines = String(ctx.body.numbers || '').split(/[\r\n,;]+/).map((l) => l.trim()).filter(Boolean).slice(0, 500);
  if (!lines.length) throw new HttpError(400, 'Tempel minimal satu nomor.');
  const have = new Set(db.nokos.numbers.filter((n) => n.status === 'stock' || db.nokos.orders.some((o) => o.numberId === n.id && o.status === 'waiting')).map((n) => digitsOf(n.number)));
  let added = 0; let skipped = 0;
  for (const raw of lines) {
    const d = digitsOf(raw);
    if (d.length < 7 || d.length > 16 || have.has(d)) { skipped += 1; continue; }
    have.add(d);
    db.nokos.numbers.push({ id: nextId('nokosNumber'), itemId: it.id, number: (raw.startsWith('+') ? '+' : '') + d, status: 'stock', orderId: null, createdAt: now() });
    added += 1;
  }
  save();
  return { added, skipped, stock: stockOf(it.id) };
});

route('POST', '/api/owner/nokos/orders/:id', 'owner', (ctx) => {
  nokosSweep();
  const o = db.nokos.orders.find((x) => x.id === Number(ctx.params.id));
  if (!o) throw new HttpError(404, 'Pesanan tidak ditemukan.');
  if (o.status !== 'waiting') throw new HttpError(409, 'Pesanan ini sudah diproses.');
  const action = ctx.body.action;
  if (action === 'code') {
    const otp = str(ctx.body.otp, 12).replace(/\s+/g, '');
    if (!/^[A-Za-z0-9-]{3,12}$/.test(otp)) throw new HttpError(400, 'Kode tidak valid.');
    o.otp = otp; o.status = 'done'; o.doneAt = now();
  } else if (action === 'cancel') {
    nokosRelease(o, 'cancelled');
  } else throw new HttpError(400, 'Aksi tidak dikenal.');
  save();
  return { order: nokosPub(o) };
});

route('GET', '/api/owner/threads', 'owner', () => {
  const map = new Map();
  for (const m of db.messages) {
    const t = map.get(m.userId) || { userId: m.userId, unread: 0, last: null };
    if (m.from === 'user' && !m.read) t.unread += 1;
    t.last = m;
    map.set(m.userId, t);
  }
  const threads = [...map.values()].map((t) => Object.assign(userBrief(t.userId), {
    userId: t.userId, unread: t.unread, lastText: t.last.text, lastFrom: t.last.from, lastAt: t.last.createdAt,
  }));
  threads.sort((a, b) => b.lastAt - a.lastAt);
  return { threads };
});

route('GET', '/api/owner/chat/:id', 'owner', (ctx) => {
  const u = db.users.find((x) => x.id === Number(ctx.params.id) && x.role !== 'owner');
  if (!u) throw new HttpError(404, 'User tidak ditemukan.');
  const msgs = db.messages.filter((m) => m.userId === u.id);
  let changed = false;
  for (const m of msgs) if (m.from === 'user' && !m.read) { m.read = true; changed = true; }
  if (changed) save();
  return { user: pub(u), messages: msgs.slice(-200) };
});

route('POST', '/api/owner/chat/:id', 'owner', (ctx) => {
  const u = db.users.find((x) => x.id === Number(ctx.params.id) && x.role !== 'owner');
  if (!u) throw new HttpError(404, 'User tidak ditemukan.');
  const text = str(ctx.body.text, 1000);
  if (!text) throw new HttpError(400, 'Pesan kosong.');
  const m = addMessage(u.id, 'owner', text);
  save();
  return { message: m };
});

/* ------------------------------------------------------------------ */
/* HTTP server                                                         */
/* ------------------------------------------------------------------ */
const SEC = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'same-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Strict-Transport-Security': 'max-age=15552000',
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'; media-src 'self'",
};

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp',
  '.ico': 'image/x-icon', '.mp3': 'audio/mpeg', '.json': 'application/json; charset=utf-8',
};

function sendJson(res, status, data, headers) {
  const body = JSON.stringify(data);
  res.writeHead(status, Object.assign({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }, SEC, headers));
  res.end(body);
}

function readJson(req, limit, asForm) {
  return new Promise((resolve, reject) => {
    let size = 0; let tooBig = false; const chunks = [];
    req.on('data', (c) => { size += c.length; if (size > limit) { tooBig = true; return; } chunks.push(c); });
    req.on('end', () => {
      if (tooBig) return reject(new HttpError(413, 'Data terlalu besar.'));
      if (!chunks.length) return resolve({});
      if (asForm) return resolve(Object.fromEntries(new URLSearchParams(Buffer.concat(chunks).toString('utf8'))));
      try {
        const v = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        resolve(v && typeof v === 'object' && !Array.isArray(v) ? v : {});
      } catch (_) { reject(new HttpError(400, 'JSON tidak valid.')); }
    });
    req.on('error', reject);
  });
}

function serveStatic(req, res, pathname) {
  let p;
  try { p = decodeURIComponent(pathname); } catch (_) { p = '/'; }
  if (p === '/') p = '/index.html';
  const notFound = () => { res.writeHead(404, Object.assign({ 'Content-Type': 'text/plain; charset=utf-8' }, SEC)); res.end('Tidak ditemukan'); };
  if (p.split('/').some((seg) => seg.startsWith('.')) || p.includes('\0')) return notFound();
  const file = path.normalize(path.join(PUBLIC_DIR, p));
  if (!file.startsWith(PUBLIC_DIR + path.sep)) { res.writeHead(403, SEC); return res.end('Forbidden'); }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) return notFound();
    const ext = path.extname(file).toLowerCase();
    const head = Object.assign({
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': ext === '.html' ? 'no-cache' : (p.startsWith('/assets/') ? 'public, max-age=86400' : 'public, max-age=300'),
      'Accept-Ranges': 'bytes',
    }, SEC);
    const rm = /^bytes=(\d*)-(\d*)$/.exec(String(req.headers.range || ''));
    if (rm && (rm[1] !== '' || rm[2] !== '')) {
      let start; let end;
      if (rm[1] === '') { start = Math.max(0, st.size - Number(rm[2])); end = st.size - 1; } else { start = Number(rm[1]); end = rm[2] === '' ? st.size - 1 : Math.min(Number(rm[2]), st.size - 1); }
      if (start > end || start >= st.size) { res.writeHead(416, Object.assign({ 'Content-Range': `bytes */${st.size}` }, SEC)); return res.end(); }
      res.writeHead(206, Object.assign({ 'Content-Range': `bytes ${start}-${end}/${st.size}`, 'Content-Length': end - start + 1 }, head));
      if (req.method === 'HEAD') return res.end();
      return fs.createReadStream(file, { start, end }).pipe(res);
    }
    res.writeHead(200, Object.assign({ 'Content-Length': st.size }, head));
    if (req.method === 'HEAD') return res.end();
    return fs.createReadStream(file).pipe(res);
  });
}

function lockPage(req, res) {
  const isApi = String(req.url).startsWith('/api/');
  if (isApi) return sendJson(res, 403, { error: LOCK_TEXT });
  res.writeHead(403, Object.assign({ 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }, SEC));
  res.end(`<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>403</title></head><body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#000;color:#fff;font-family:system-ui,sans-serif;text-align:center;padding:1.5rem"><div><h1 style="font-size:clamp(2rem,9vw,4.2rem);margin:0 0 .6rem">Mau Ngapain bg?</h1><p style="color:#9aa3ad;font-size:1.15rem;margin:0">By @maklodevv</p></div></body></html>`);
}

const server = http.createServer(async (req, res) => {
  try {
    if (!hostAllowed(req)) {
      if (!hostAllowed.warned) { hostAllowed.warned = true; console.warn('Host tidak diizinkan: ' + req.headers.host + ' (cek allowedHosts di config.js)'); }
      return lockPage(req, res);
    }
    const url = new URL(req.url, 'http://localhost');
    const pathname = url.pathname;

    if (pathname === '/boot.js') {
      const accent = ACCENTS[ACCENT];
      const bg = '0a0b0c';
      const gated = REQUIRE_LOGIN && !getUser(req);
      res.writeHead(200, Object.assign({ 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-store' }, SEC));
      return res.end(`window.__ok=1;document.documentElement.classList.add('js'${gated ? ",'gated'" : ''});document.documentElement.setAttribute('data-accent',${JSON.stringify(ACCENT)});(function(){var f=document.querySelector('link[rel=icon]');if(f)f.href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Crect width='24' height='24' rx='6' fill='%23${bg}'/%3E%3Cpath d='M4 11.5 20 5l-3.2 14-4.6-3.6-2.4 2.3.3-4.2z' fill='%23${accent}'/%3E%3C/svg%3E";var m=document.querySelector('meta[name=theme-color]');if(m)m.content='#${bg}';})();`);
    }
    if (!pathname.startsWith('/api/')) {
      if (req.method !== 'GET' && req.method !== 'HEAD') throw new HttpError(405, 'Method tidak diizinkan.');
      return serveStatic(req, res, pathname);
    }

    let rt = null; let match = null;
    for (const r of routes) {
      if (r.method !== req.method) continue;
      const m = r.re.exec(pathname);
      if (m) { rt = r; match = m; break; }
    }
    if (!rt) throw new HttpError(404, 'Endpoint tidak ditemukan.');

    const user = getUser(req);
    if (rt.auth && !user) throw new HttpError(401, 'Silakan masuk dulu.');
    if (rt.auth === 'owner' && user.role !== 'owner') throw new HttpError(403, 'Khusus owner.');

    let body = {};
    if (req.method === 'POST') {
      const origin = req.headers.origin;
      if (origin) {
        let same = false;
        try { same = new URL(origin).host.toLowerCase() === String(req.headers.host || '').toLowerCase(); } catch (_) { same = false; }
        if (!same) throw new HttpError(403, 'Permintaan ditolak.');
      }
      const ctype = String(req.headers['content-type'] || '');
      const isForm = rt.form && ctype.includes('application/x-www-form-urlencoded');
      if (!isForm && !ctype.includes('application/json')) throw new HttpError(415, 'Content-Type harus application/json.');
      body = await readJson(req, 400 * 1024, isForm);
    }

    const addr = req.socket.remoteAddress || '';
    const xff = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    const ctx = { req, res, user, body, params: match.groups || {}, url, headers: {}, ip: config.trustProxy && xff ? xff : addr };
    const data = await rt.handler(ctx);
    sendJson(res, 200, data, ctx.headers);
  } catch (e) {
    if (e instanceof HttpError) return sendJson(res, e.status, { error: e.message });
    console.error(e);
    sendJson(res, 500, { error: 'Terjadi kesalahan di server.' });
  }
});

server.requestTimeout = 30000;
server.headersTimeout = 15000;

server.listen(PORT, config.host || '0.0.0.0', () => {
  console.log(`${config.siteName} jalan di http://localhost:${PORT}`);
  console.log(atlanticOn() ? 'Pembayaran otomatis Atlantic: aktif.' : 'Pembayaran otomatis Atlantic: belum aktif (isi ATLANTIC_API_KEY di file .env).');
  console.log(ALLOWED_HOSTS.length ? `Kunci domain aktif untuk: ${ALLOWED_HOSTS.join(', ')}` : 'Kunci domain mati (allowedHosts kosong).');
});
