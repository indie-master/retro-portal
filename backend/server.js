import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { WebSocketServer, WebSocket } from 'ws';

const PORT = Number(process.env.PORT || 3000);
const CATALOG_FILE = process.env.CATALOG_FILE || '/data/runtime-games.json';
const PRESET_FILE = process.env.PRESET_FILE || '/data/presets/curated-classics.json';
const STATS_FILE = process.env.STATS_FILE || '/data/stats.json';
const ROM_ROOT = process.env.ROM_ROOT || '/roms';
const BIOS_ROOT = process.env.BIOS_ROOT || '/bios';
const COVER_ROOT = process.env.COVER_ROOT || '/covers';
const ADMIN_TOKEN = String(process.env.ADMIN_TOKEN || '');
const THEGAMESDB_API_KEY = String(process.env.THEGAMESDB_API_KEY || '');
const WIKIPEDIA_METADATA = String(process.env.WIKIPEDIA_METADATA ?? '1') !== '0';
const ALLOW_ZIP_ROMS = String(process.env.ALLOW_ZIP_ROMS || '0') === '1';
const MAX_UPLOAD_BYTES = Math.max(1, Number(process.env.MAX_UPLOAD_BYTES || 2 * 1024 * 1024 * 1024));
const MAX_COVER_BYTES = 8 * 1024 * 1024;
const MAX_JSON_BYTES = 128 * 1024;
const MAX_TEXT = 8000;
const clients = new Map();
const authFailures = new Map();
const playRate = new Map();
let catalogWriteQueue = Promise.resolve();
let statsWriteQueue = Promise.resolve();

const SYSTEMS = {
  megadrive: { label: 'Mega Drive', dir: 'megadrive', core: 'segaMD', controlScheme: 'segaMD', engine: 'emulatorjs', extensions: ['.bin', '.md', '.gen', '.zip'], bios: [] },
  ps1: { label: 'PlayStation', dir: 'ps1', core: 'psx', controlScheme: 'psx', engine: 'emulatorjs', extensions: ['.chd', '.pbp', '.bin', '.iso', '.cue'], bios: ['ps1/scph5501.bin'] },
  dreamcast: { label: 'Dreamcast', dir: 'dreamcast', core: 'flycast', controlScheme: 'dreamcast', engine: 'flycast-wasm', extensions: ['.chd', '.gdi', '.cdi'], bios: ['dreamcast/dc_boot.bin', 'dreamcast/dc_flash.bin'], experimental: true },
  nes: { label: 'NES', dir: 'nes', core: 'nes', controlScheme: 'nes', engine: 'emulatorjs', extensions: ['.nes', '.zip'], bios: [] },
  snes: { label: 'SNES', dir: 'snes', core: 'snes', controlScheme: 'snes', engine: 'emulatorjs', extensions: ['.sfc', '.smc', '.zip'], bios: [] },
  gb: { label: 'Game Boy', dir: 'gb', core: 'gb', controlScheme: 'gb', engine: 'emulatorjs', extensions: ['.gb', '.gbc', '.zip'], bios: [] },
  gba: { label: 'Game Boy Advance', dir: 'gba', core: 'gba', controlScheme: 'gba', engine: 'emulatorjs', extensions: ['.gba', '.zip'], bios: [] },
  n64: { label: 'Nintendo 64', dir: 'n64', core: 'n64', controlScheme: 'n64', engine: 'emulatorjs', extensions: ['.z64', '.n64', '.v64', '.zip'], bios: [] },
  arcade: { label: 'Arcade', dir: 'arcade', core: 'arcade', controlScheme: 'arcade', engine: 'emulatorjs', extensions: ['.zip'], bios: [] }
};

const PS1_BIOS_BY_MD5 = new Map([
  ['8dd7d5296a650fac7319bce665a6a53c', 'scph5500.bin'],
  ['490f666e1afb15b7362b406ed1cea246', 'scph5501.bin'],
  ['32736f17079d0b2b7024407c39bd3050', 'scph5502.bin'],
  ['c53ca5908936d412331790f4426c6c33', 'PSXONPSP660.bin'],
  ['6e3735ff4c7dc899ee98981385f6f3d0', 'scph101.bin'],
  ['1e68c231d0896b7eadcad1d7d8e76129', 'scph7001.bin'],
  ['924e392ed05558ffdb115408c263dccf', 'scph1001.bin']
]);

const KNOWN_MAGIC = {
  '.nes': (buf) => buf.length >= 4 && buf.subarray(0, 4).equals(Buffer.from([0x4e, 0x45, 0x53, 0x1a])),
  '.chd': (buf) => buf.length >= 8 && buf.subarray(0, 8).toString('ascii') === 'MComprHD',
  '.pbp': (buf) => buf.length >= 4 && buf.subarray(0, 4).equals(Buffer.from([0x00, 0x50, 0x42, 0x50])),
  '.z64': (buf) => buf.length >= 4 && buf.readUInt32BE(0) === 0x80371240,
  '.n64': (buf) => buf.length >= 4 && buf.readUInt32BE(0) === 0x40123780,
  '.v64': (buf) => buf.length >= 4 && buf.readUInt32BE(0) === 0x37804012
};

function json(res, code, payload) {
  res.writeHead(code, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff'
  });
  res.end(JSON.stringify(payload));
}

function clientIp(req) {
  return String(req.headers['x-real-ip'] || req.socket.remoteAddress || '').slice(0, 128);
}

function cleanText(value, max = MAX_TEXT) {
  return String(value || '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

function safeRelative(value) {
  if (typeof value !== 'string' || !value) return null;
  const normalized = value.replaceAll('\\', '/').replace(/^\/+/, '');
  if (!normalized || normalized.includes('\0')) return null;
  const parts = normalized.split('/');
  if (parts.some((part) => !part || part === '.' || part === '..')) return null;
  return parts.join('/');
}

function publicFileUrl(prefix, value) {
  const safe = safeRelative(value);
  if (!safe) return null;
  return `${prefix}/${safe.split('/').map(encodeURIComponent).join('/')}`;
}

function decodeHeader(value = '') {
  try { return decodeURIComponent(String(value)); } catch { return String(value); }
}

function safeFileName(value) {
  const base = path.basename(decodeHeader(value)).replace(/[\u0000-\u001f<>:"/\\|?*]+/g, '_').replace(/^[-. ]+/, '').trim();
  return base.slice(0, 180) || null;
}

function slugify(value) {
  return String(value || 'game').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'game';
}

function normalizeGameName(value) {
  let name = path.basename(String(value || ''));
  for (let i = 0; i < 3; i += 1) name = name.replace(/\.(zip|7z|bin|md|gen|nes|sfc|smc|gb|gbc|gba|chd|cue|iso|pbp|gdi|cdi|z64|n64|v64)$/i, '');
  return name.replace(/\([^)]*\)|\[[^\]]*\]/g, ' ').replace(/\b(disc|disk|cd)\s*[0-9ivx]+\b/gi, ' ').replace(/[_.+]+/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase().replace(/[^a-z0-9а-яё]+/gi, '');
}

function prettyTitle(value) {
  let name = path.basename(String(value || 'Game'));
  for (let i = 0; i < 3; i += 1) name = name.replace(/\.(zip|7z|bin|md|gen|nes|sfc|smc|gb|gbc|gba|chd|cue|iso|pbp|gdi|cdi|z64|n64|v64)$/i, '');
  return name.replace(/\([^)]*\)|\[[^\]]*\]/g, ' ').replace(/[_.]+/g, ' ').replace(/\s+/g, ' ').trim() || 'Untitled game';
}

function inferSystemKey(fileName) {
  const ext = path.extname(String(fileName || '')).toLowerCase();
  return ({ '.nes': 'nes', '.sfc': 'snes', '.smc': 'snes', '.gb': 'gb', '.gbc': 'gb', '.gba': 'gba', '.md': 'megadrive', '.gen': 'megadrive', '.z64': 'n64', '.n64': 'n64', '.v64': 'n64', '.gdi': 'dreamcast', '.cdi': 'dreamcast' })[ext] || null;
}

function systemKeyByLabel(label) {
  const needle = String(label || '').toLowerCase();
  return Object.entries(SYSTEMS).find(([, cfg]) => cfg.label.toLowerCase() === needle)?.[0] || null;
}

function adminConfigured() { return ADMIN_TOKEN.length >= 16; }

function authBlocked(req) {
  const key = clientIp(req);
  const item = authFailures.get(key);
  if (!item) return false;
  if (item.until <= Date.now()) { authFailures.delete(key); return false; }
  return true;
}

function noteAuthFailure(req) {
  const key = clientIp(req);
  const now = Date.now();
  const item = authFailures.get(key) || { count: 0, until: 0, first: now };
  if (now - item.first > 10 * 60_000) { item.count = 0; item.first = now; }
  item.count += 1;
  if (item.count >= 8) item.until = now + 15 * 60_000;
  authFailures.set(key, item);
}

function isAdmin(req) {
  if (!adminConfigured() || authBlocked(req)) return false;
  const auth = String(req.headers.authorization || '');
  const supplied = auth.startsWith('Bearer ') ? auth.slice(7) : String(req.headers['x-admin-token'] || '');
  if (!supplied) return false;
  const a = Buffer.from(ADMIN_TOKEN);
  const b = Buffer.from(supplied);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function requireAdmin(req, res) {
  if (!adminConfigured()) { json(res, 503, { error: 'admin-disabled' }); return false; }
  if (authBlocked(req)) { json(res, 429, { error: 'too-many-auth-failures' }); return false; }
  if (!isAdmin(req)) { noteAuthFailure(req); json(res, 401, { error: 'unauthorized' }); return false; }
  return true;
}

async function readJsonBody(req, limit = MAX_JSON_BYTES) {
  let bytes = 0;
  const chunks = [];
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes > limit) throw Object.assign(new Error('json-body-too-large'), { status: 413 });
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw Object.assign(new Error('invalid-json'), { status: 400 }); }
}

async function readBinaryBody(req, limit, tooLargeError = 'upload-too-large') {
  let bytes = 0;
  const chunks = [];
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes > limit) throw Object.assign(new Error(tooLargeError), { status: 413 });
    chunks.push(chunk);
  }
  if (!bytes) throw Object.assign(new Error('empty-upload'), { status: 400 });
  return Buffer.concat(chunks);
}

async function fileExists(root, value) {
  const safe = safeRelative(value);
  if (!safe) return false;
  const rootResolved = path.resolve(root);
  const target = path.resolve(root, safe);
  if (!(target === rootResolved || target.startsWith(`${rootResolved}${path.sep}`))) return false;
  try { return (await fs.stat(target)).isFile(); } catch { return false; }
}

async function loadCatalogData() {
  const raw = await fs.readFile(CATALOG_FILE, 'utf8');
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed.games)) throw new Error('catalog.games must be an array');
  return parsed;
}

async function loadCatalog() { return (await loadCatalogData()).games; }

async function loadPresets() {
  try {
    const parsed = JSON.parse(await fs.readFile(PRESET_FILE, 'utf8'));
    return Array.isArray(parsed.games) ? parsed.games : [];
  } catch { return []; }
}

async function saveCatalogData(data) {
  const dir = path.dirname(CATALOG_FILE);
  const tmp = path.join(dir, `.games.${process.pid}.${Date.now()}.tmp`);
  await fs.writeFile(tmp, `${JSON.stringify(data, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  await fs.rename(tmp, CATALOG_FILE);
}

function mutateCatalog(mutator) {
  const task = catalogWriteQueue.then(async () => {
    const data = await loadCatalogData();
    const result = await mutator(data);
    await saveCatalogData(data);
    return result;
  });
  catalogWriteQueue = task.catch(() => {});
  return task;
}

async function loadStats() {
  try {
    const parsed = JSON.parse(await fs.readFile(STATS_FILE, 'utf8'));
    return { launches: Array.isArray(parsed.launches) ? parsed.launches : [] };
  } catch { return { launches: [] }; }
}

function mutateStats(mutator) {
  const task = statsWriteQueue.then(async () => {
    const data = await loadStats();
    const result = await mutator(data);
    const cutoff = Date.now() - 90 * 24 * 3600_000;
    data.launches = data.launches.filter((item) => Number(item.ts) >= cutoff).slice(-20000);
    const tmp = `${STATS_FILE}.${process.pid}.${Date.now()}.tmp`;
    await fs.writeFile(tmp, `${JSON.stringify(data)}\n`, { encoding: 'utf8', mode: 0o600 });
    await fs.rename(tmp, STATS_FILE);
    return result;
  });
  statsWriteQueue = task.catch(() => {});
  return task;
}

async function recordLaunch(gameId, sessionId) {
  const sid = cleanText(sessionId, 100) || 'anonymous';
  const key = `${sid}:${gameId}`;
  const last = playRate.get(key) || 0;
  if (Date.now() - last < 10 * 60_000) return false;
  playRate.set(key, Date.now());
  await mutateStats((data) => { data.launches.push({ gameId, ts: Date.now() }); });
  return true;
}

async function popularGames(days = 7, limit = 6) {
  const cutoff = Date.now() - days * 24 * 3600_000;
  const stats = await loadStats();
  const counts = {};
  for (const item of stats.launches) if (item.ts >= cutoff && typeof item.gameId === 'string') counts[item.gameId] = (counts[item.gameId] || 0) + 1;
  const games = await getPublicGames();
  return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, limit).map(([id, launches]) => {
    const game = games.find((g) => g.id === id);
    return game ? { id, title: game.title, system: game.system, cover: game.cover, launches } : null;
  }).filter(Boolean);
}

async function hydrateGame(game) {
  const installed = await fileExists(ROM_ROOT, game.rom);
  const biosFiles = Array.isArray(game.bios) ? game.bios : (game.bios ? [game.bios] : []);
  const biosStates = await Promise.all(biosFiles.map((item) => fileExists(BIOS_ROOT, item)));
  const biosInstalled = biosStates.every(Boolean);
  const missingBios = biosFiles.filter((_, index) => !biosStates[index]);
  const engine = game.engine || 'emulatorjs';
  const experimental = engine === 'flycast-wasm' || Boolean(game.experimental);
  const runtimeReady = !experimental;
  const playable = installed && biosInstalled && runtimeReady;
  const status = experimental ? 'experimental' : !installed ? 'rom-missing' : !biosInstalled ? 'bios-missing' : 'ready';
  return {
    id: game.id,
    gameId: Number(game.gameId),
    title: cleanText(game.title, 180),
    system: cleanText(game.system, 80),
    engine,
    core: game.core,
    controlScheme: game.controlScheme || SYSTEMS[systemKeyByLabel(game.system)]?.controlScheme || game.core,
    controls: game.controls && typeof game.controls === 'object' ? game.controls : null,
    rom: game.rom,
    romExpected: safeRelative(game.rom),
    biosExpected: biosFiles.map(safeRelative).filter(Boolean),
    missingBios,
    cover: typeof game.cover === 'string' ? game.cover : '',
    screenshots: Array.isArray(game.screenshots) ? game.screenshots.slice(0, 6) : [],
    year: cleanText(game.year, 20),
    players: cleanText(game.players, 40),
    description: cleanText(game.description, 2500),
    history: cleanText(game.history, 2500),
    license: cleanText(game.license, 80),
    source: typeof game.source === 'string' ? game.source : '',
    tags: Array.isArray(game.tags) ? game.tags.map((x) => cleanText(x, 40)).filter(Boolean).slice(0, 16) : [],
    featured: Boolean(game.featured),
    demo: Boolean(game.demo || (Array.isArray(game.tags) && game.tags.includes('homebrew'))),
    experimental,
    status,
    sort: Number.isFinite(Number(game.sort)) ? Number(game.sort) : 9999,
    installed,
    biosRequired: biosFiles.length > 0,
    biosInstalled,
    runtimeReady,
    playable,
    autoManaged: Boolean(game.autoManaged),
    metadataSource: game.metadataSource || '',
    pendingMetadata: game.pendingMetadata && typeof game.pendingMetadata === 'object' ? game.pendingMetadata : null,
    publicVisible: playable && game.public !== false,
    romUrl: installed ? publicFileUrl('/roms', game.rom) : null,
    biosUrls: biosInstalled ? biosFiles.map((item) => publicFileUrl('/bios', item)).filter(Boolean) : [],
    biosUrl: biosInstalled && biosFiles[0] ? publicFileUrl('/bios', biosFiles[0]) : null
  };
}

async function getGames() { return Promise.all((await loadCatalog()).filter((g) => g.enabled !== false).map(hydrateGame)); }
async function getPublicGames() { return (await getGames()).filter((g) => g.publicVisible); }

function presetMatches(preset, fileName, systemLabel) {
  if (preset.system !== systemLabel) return false;
  const needle = normalizeGameName(fileName);
  return [preset.title, preset.rom ? path.basename(preset.rom) : ''].map(normalizeGameName).filter(Boolean).some((v) => v === needle || v.includes(needle) || needle.includes(v));
}

function uniqueId(games, base) {
  const ids = new Set(games.map((item) => item.id));
  const candidate = slugify(base);
  if (!ids.has(candidate)) return candidate;
  let i = 2;
  while (ids.has(`${candidate}-${i}`)) i += 1;
  return `${candidate}-${i}`;
}

async function registerRom(systemKey, relativeRom, originalName, sha256 = '') {
  const system = SYSTEMS[systemKey];
  if (!system) throw new Error(`Unsupported system: ${systemKey}`);
  const presets = await loadPresets();
  return mutateCatalog(async (data) => {
    const games = data.games;
    const preset = presets.find((item) => presetMatches(item, originalName, system.label));
    let existing = games.find((item) => item.rom === relativeRom);
    if (!existing && preset?.id) existing = games.find((item) => item.id === preset.id);
    const title = preset?.title || prettyTitle(originalName);
    const id = existing?.id || preset?.id || uniqueId(games, `${title}-${systemKey}`);
    const gameId = existing?.gameId || preset?.gameId || Number.parseInt((sha256 || crypto.createHash('sha256').update(relativeRom).digest('hex')).slice(0, 8), 16);
    const base = preset ? { ...preset } : {
      id, gameId, title, system: system.label, engine: system.engine, core: system.core, controlScheme: system.controlScheme,
      rom: relativeRom, bios: [...system.bios], cover: '', screenshots: [], year: '', players: '1 игрок', description: '', history: '', license: 'user-supplied', tags: [], sort: 5000
    };
    const item = { ...base, id, gameId, rom: relativeRom, listedWhenMissing: false, autoManaged: true, metadataSource: preset ? 'preset' : (existing?.metadataSource || 'filename') };
    if (system.experimental) item.experimental = true;
    if (existing) Object.assign(existing, item); else games.push(item);
    return item;
  });
}

async function walkFiles(root) {
  const out = [];
  async function walk(current, prefix = '') {
    let entries = [];
    try { entries = await fs.readdir(current, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      const abs = path.join(current, entry.name);
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) await walk(abs, rel);
      else if (entry.isFile()) out.push(rel);
    }
  }
  await walk(root);
  return out;
}

async function scanLibrary() {
  const before = await loadCatalog();
  const beforePaths = new Set(before.map((game) => game.rom));
  const results = [];
  for (const [key, system] of Object.entries(SYSTEMS)) {
    const baseDir = path.join(ROM_ROOT, system.dir);
    for (const rel of await walkFiles(baseDir)) {
      const ext = path.extname(rel).toLowerCase();
      if (!system.extensions.includes(ext)) continue;
      if (ext === '.zip' && !ALLOW_ZIP_ROMS) continue;
      const rom = `${system.dir}/${rel}`.replaceAll('\\', '/');
      if (beforePaths.has(rom)) continue;
      const registered = await registerRom(key, rom, rel);
      results.push({ id: registered.id, title: registered.title, system: registered.system, rom });
      beforePaths.add(rom);
    }
  }
  return results;
}

function validateMagic(ext, sample) {
  const checker = KNOWN_MAGIC[ext];
  return checker ? checker(sample) : true;
}

async function writeRequestBodyToFile(req, destination, ext) {
  await fs.mkdir(path.dirname(destination), { recursive: true });
  const tmp = `${destination}.upload-${crypto.randomUUID()}`;
  const handle = await fs.open(tmp, 'wx', 0o600);
  const sha256 = crypto.createHash('sha256');
  const md5 = crypto.createHash('md5');
  let bytes = 0;
  let sample = Buffer.alloc(0);
  try {
    for await (const chunk of req) {
      bytes += chunk.length;
      if (bytes > MAX_UPLOAD_BYTES) throw Object.assign(new Error('upload-too-large'), { code: 'UPLOAD_TOO_LARGE' });
      if (sample.length < 4096) sample = Buffer.concat([sample, chunk]).subarray(0, 4096);
      sha256.update(chunk); md5.update(chunk);
      await handle.write(chunk);
    }
    if (!bytes) throw Object.assign(new Error('empty-upload'), { status: 400 });
    if (!validateMagic(ext, sample)) throw Object.assign(new Error('file-signature-mismatch'), { status: 415 });
  } catch (error) {
    await handle.close().catch(() => {});
    await fs.unlink(tmp).catch(() => {});
    throw error;
  }
  await handle.close();
  await fs.rename(tmp, destination);
  return { bytes, sha256: sha256.digest('hex'), md5: md5.digest('hex') };
}

async function uploadRom(req) {
  const originalName = safeFileName(req.headers['x-file-name']);
  if (!originalName) throw Object.assign(new Error('missing-file-name'), { status: 400 });
  let systemKey = String(req.headers['x-system'] || 'auto').toLowerCase();
  if (systemKey === 'auto') systemKey = inferSystemKey(originalName);
  if (!systemKey || !SYSTEMS[systemKey]) throw Object.assign(new Error('system-required'), { status: 422, needsSystem: true });
  const system = SYSTEMS[systemKey];
  const ext = path.extname(originalName).toLowerCase();
  if (!system.extensions.includes(ext)) throw Object.assign(new Error(`unsupported-extension-for-${systemKey}`), { status: 415 });
  if (ext === '.zip' && !ALLOW_ZIP_ROMS) throw Object.assign(new Error('zip-roms-disabled'), { status: 415 });
  if (['.cue', '.gdi'].includes(ext)) throw Object.assign(new Error('multi-file-format-use-sftp-scan'), { status: 422 });
  const tempDestination = path.join(ROM_ROOT, system.dir, `.incoming-${crypto.randomUUID()}${ext}`);
  const upload = await writeRequestBodyToFile(req, tempDestination, ext);
  const storedName = `${slugify(prettyTitle(originalName))}-${upload.sha256.slice(0, 12)}${ext}`;
  const destination = path.join(ROM_ROOT, system.dir, storedName);
  await fs.rename(tempDestination, destination);
  await fs.chmod(destination, 0o644);
  const relativeRom = `${system.dir}/${storedName}`;
  const registered = await registerRom(systemKey, relativeRom, originalName, upload.sha256);
  return { upload, originalName, storedName, game: await hydrateGame(registered) };
}

async function uploadBios(req) {
  const fileName = safeFileName(req.headers['x-file-name']);
  if (!fileName) throw Object.assign(new Error('missing-file-name'), { status: 400 });
  const systemKey = String(req.headers['x-system'] || '').toLowerCase();
  if (!['ps1', 'dreamcast'].includes(systemKey)) throw Object.assign(new Error('system-required'), { status: 422 });
  const override = safeFileName(req.headers['x-bios-name'] || '');
  const system = SYSTEMS[systemKey];
  const ext = path.extname(fileName).toLowerCase();
  if (ext !== '.bin') throw Object.assign(new Error('bios-must-be-bin'), { status: 415 });
  const tempPath = path.join(BIOS_ROOT, system.dir, `.incoming-${crypto.randomUUID()}.bin`);
  const upload = await writeRequestBodyToFile(req, tempPath, ext);
  let canonical = override || fileName;
  let recognized = Boolean(override);
  if (systemKey === 'ps1') {
    const byHash = PS1_BIOS_BY_MD5.get(upload.md5.toLowerCase());
    if (byHash) { canonical = byHash; recognized = true; }
  } else {
    canonical = canonical.toLowerCase();
    recognized = ['dc_boot.bin', 'dc_flash.bin'].includes(canonical);
  }
  if (!recognized) { await fs.unlink(tempPath).catch(() => {}); throw Object.assign(new Error('bios-not-recognized'), { status: 422 }); }
  const destination = path.join(BIOS_ROOT, system.dir, canonical);
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.rename(tempPath, destination);
  await fs.chmod(destination, 0o644);
  return { upload, system: system.label, storedAs: `${system.dir}/${canonical}`, recognized: true };
}

function normalizeTitleForScore(value) { return String(value || '').toLowerCase().replace(/[^a-z0-9а-яё]+/gi, ' ').trim(); }

function findBoxartUrl(payload, gameId) {
  const boxart = payload?.include?.boxart;
  if (!boxart) return null;
  const entries = boxart?.data?.[String(gameId)] || boxart?.data?.[gameId] || [];
  const image = entries.find((item) => item?.side === 'front') || entries[0];
  const base = boxart?.base_url?.original || boxart?.base_url?.large || boxart?.base_url?.medium || '';
  if (!image?.filename || !base) return null;
  return `${String(base).replace(/\/$/, '')}/${String(image.filename).replace(/^\//, '')}`;
}

function allowedMetadataUrl(raw) {
  const url = new URL(raw);
  if (url.protocol !== 'https:') throw new Error('metadata-url-protocol');
  const host = url.hostname.toLowerCase();
  if (!(host === 'thegamesdb.net' || host.endsWith('.thegamesdb.net'))) throw new Error('metadata-url-host');
  return url;
}

function validImageSignature(bytes, contentType) {
  if (contentType.includes('png')) return bytes.length > 8 && bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  if (contentType.includes('webp')) return bytes.length > 12 && bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP';
  return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[bytes.length - 2] === 0xff && bytes[bytes.length - 1] === 0xd9;
}

async function uploadCover(req, gameId) {
  const originalName = safeFileName(req.headers['x-file-name']);
  if (!originalName) throw Object.assign(new Error('missing-file-name'), { status: 400 });
  const existing = (await loadCatalog()).find((game) => game.id === gameId);
  if (!existing) throw Object.assign(new Error('game-not-found'), { status: 404 });

  const rawExt = path.extname(originalName).toLowerCase();
  const typeByExt = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };
  const contentType = typeByExt[rawExt];
  if (!contentType) throw Object.assign(new Error('cover-unsupported-format'), { status: 415 });

  const bytes = await readBinaryBody(req, MAX_COVER_BYTES, 'cover-too-large');
  if (!validImageSignature(bytes, contentType)) throw Object.assign(new Error('cover-invalid'), { status: 415 });

  const ext = rawExt === '.jpeg' ? '.jpg' : rawExt;
  const digest = crypto.createHash('sha256').update(bytes).digest('hex');
  const file = `${slugify(gameId)}-${digest.slice(0, 10)}${ext}`;
  const destination = path.join(COVER_ROOT, file);
  await fs.mkdir(COVER_ROOT, { recursive: true });
  await fs.writeFile(destination, bytes, { mode: 0o644 });
  await fs.chmod(destination, 0o644);
  const cover = `/covers/library/${file}`;

  await mutateCatalog(async (data) => {
    const game = data.games.find((item) => item.id === gameId);
    if (!game) throw Object.assign(new Error('game-not-found'), { status: 404 });
    game.cover = cover;
  });

  return { cover, bytes: bytes.length, sha256: digest, game: (await getGames()).find((game) => game.id === gameId) };
}

async function downloadCover(rawUrl, gameId) {
  const url = allowedMetadataUrl(rawUrl);
  const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(8000), headers: { 'user-agent': 'RetroPortal/0.8 metadata-fetcher' } });
  if (!response.ok) throw new Error(`cover HTTP ${response.status}`);
  const length = Number(response.headers.get('content-length') || 0);
  if (length > MAX_COVER_BYTES) throw new Error('cover-too-large');
  const contentType = String(response.headers.get('content-type') || '').toLowerCase();
  if (!/^image\/(jpeg|png|webp)/.test(contentType)) throw new Error('cover-content-type');
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > MAX_COVER_BYTES || !validImageSignature(bytes, contentType)) throw new Error('cover-invalid');
  const ext = contentType.includes('png') ? '.png' : contentType.includes('webp') ? '.webp' : '.jpg';
  await fs.mkdir(COVER_ROOT, { recursive: true });
  const file = `${slugify(gameId)}-${crypto.createHash('sha256').update(bytes).digest('hex').slice(0, 10)}${ext}`;
  await fs.writeFile(path.join(COVER_ROOT, file), bytes, { mode: 0o644 });
  return `/covers/library/${file}`;
}

async function fetchWikipediaHistory(title) {
  if (!WIKIPEDIA_METADATA) return '';
  const query = `${title} video game`;
  for (const lang of ['ru', 'en']) {
    try {
      const search = new URL(`https://${lang}.wikipedia.org/w/api.php`);
      search.searchParams.set('action', 'query'); search.searchParams.set('format', 'json'); search.searchParams.set('origin', '*'); search.searchParams.set('list', 'search'); search.searchParams.set('srsearch', query); search.searchParams.set('srlimit', '1');
      const sRes = await fetch(search, { signal: AbortSignal.timeout(6000), headers: { 'user-agent': 'RetroPortal/0.8 metadata-fetcher' } });
      if (!sRes.ok) continue;
      const sJson = await sRes.json();
      const pageTitle = sJson?.query?.search?.[0]?.title;
      if (!pageTitle) continue;
      const api = new URL(`https://${lang}.wikipedia.org/w/api.php`);
      api.searchParams.set('action', 'query'); api.searchParams.set('format', 'json'); api.searchParams.set('origin', '*'); api.searchParams.set('prop', 'extracts'); api.searchParams.set('exintro', '1'); api.searchParams.set('explaintext', '1'); api.searchParams.set('redirects', '1'); api.searchParams.set('titles', pageTitle);
      const res = await fetch(api, { signal: AbortSignal.timeout(6000), headers: { 'user-agent': 'RetroPortal/0.8 metadata-fetcher' } });
      if (!res.ok) continue;
      const data = await res.json();
      const page = Object.values(data?.query?.pages || {})[0];
      const text = cleanText(page?.extract || '', 2200);
      if (text) return text.split(/(?<=[.!?])\s+/).slice(0, 4).join(' ');
    } catch {}
  }
  return '';
}

async function buildMetadataProposal(gameId) {
  const hydrated = (await getGames()).find((game) => game.id === gameId);
  if (!hydrated) throw Object.assign(new Error('game-not-found'), { status: 404 });
  let proposal = { title: hydrated.title, year: hydrated.year, players: hydrated.players, description: hydrated.description, history: hydrated.history, cover: hydrated.cover, sources: [], proposedAt: new Date().toISOString() };
  if (THEGAMESDB_API_KEY) {
    const params = new URLSearchParams({ apikey: THEGAMESDB_API_KEY, name: hydrated.title, fields: 'players,genres,overview,platform,coop,alternates', include: 'boxart' });
    const response = await fetch(`https://api.thegamesdb.net/v1.1/Games/ByGameName?${params}`, { signal: AbortSignal.timeout(8000), headers: { 'user-agent': 'RetroPortal/0.8 metadata-fetcher' } });
    if (response.ok) {
      const payload = await response.json();
      const candidates = Array.isArray(payload?.data?.games) ? payload.data.games : [];
      if (candidates.length) {
        const wanted = normalizeTitleForScore(hydrated.title);
        const selected = candidates.find((item) => normalizeTitleForScore(item.game_title) === wanted) || candidates[0];
        proposal.title = cleanText(selected.game_title || proposal.title, 180);
        proposal.year = selected.release_date ? String(selected.release_date).slice(0, 4) : proposal.year;
        proposal.description = cleanText(selected.overview || proposal.description, 2500);
        proposal.players = selected.players ? `${selected.players} игрок${Number(selected.players) === 1 ? '' : 'а'}` : proposal.players;
        const coverUrl = findBoxartUrl(payload, selected.id);
        if (coverUrl) try { proposal.cover = await downloadCover(coverUrl, gameId); } catch (e) { console.warn('cover download failed', e.message); }
        proposal.sources.push('TheGamesDB');
      }
    }
  }
  const history = await fetchWikipediaHistory(proposal.title || hydrated.title);
  if (history) { proposal.history = history; proposal.sources.push('Wikipedia'); }
  if (!proposal.sources.length) throw Object.assign(new Error('metadata-not-found'), { status: 404 });
  proposal.sources = [...new Set(proposal.sources)];
  await mutateCatalog(async (data) => {
    const game = data.games.find((item) => item.id === gameId);
    if (!game) throw Object.assign(new Error('game-not-found'), { status: 404 });
    game.pendingMetadata = proposal;
  });
  return proposal;
}

async function approveMetadata(gameId) {
  await mutateCatalog(async (data) => {
    const game = data.games.find((item) => item.id === gameId);
    if (!game) throw Object.assign(new Error('game-not-found'), { status: 404 });
    const p = game.pendingMetadata;
    if (!p) throw Object.assign(new Error('no-pending-metadata'), { status: 409 });
    for (const key of ['title', 'year', 'players', 'description', 'history', 'cover']) if (p[key] !== undefined) game[key] = p[key];
    game.metadataSource = Array.isArray(p.sources) ? p.sources.join('+').toLowerCase() : 'approved';
    delete game.pendingMetadata;
  });
  return (await getGames()).find((game) => game.id === gameId);
}

async function rejectMetadata(gameId) {
  await mutateCatalog(async (data) => {
    const game = data.games.find((item) => item.id === gameId);
    if (!game) throw Object.assign(new Error('game-not-found'), { status: 404 });
    delete game.pendingMetadata;
  });
  return (await getGames()).find((game) => game.id === gameId);
}

async function patchGame(gameId, body) {
  const allowed = {};
  if ('title' in body) allowed.title = cleanText(body.title, 180);
  if ('year' in body) allowed.year = cleanText(body.year, 20);
  if ('players' in body) allowed.players = cleanText(body.players, 40);
  if ('description' in body) allowed.description = cleanText(body.description, 2500);
  if ('history' in body) allowed.history = cleanText(body.history, 2500);
  if ('featured' in body) allowed.featured = Boolean(body.featured);
  if ('public' in body) allowed.public = Boolean(body.public);
  if ('sort' in body && Number.isFinite(Number(body.sort))) allowed.sort = Math.max(0, Math.min(99999, Number(body.sort)));
  await mutateCatalog(async (data) => {
    const game = data.games.find((item) => item.id === gameId);
    if (!game) throw Object.assign(new Error('game-not-found'), { status: 404 });
    Object.assign(game, allowed);
  });
  return (await getGames()).find((game) => game.id === gameId);
}

async function biosInventory() {
  const files = await walkFiles(BIOS_ROOT);
  return files.filter((file) => !path.basename(file).startsWith('.')).sort();
}

function aggregatePresence() {
  const sessions = new Map();
  for (const state of clients.values()) {
    const key = state.sessionId || state.connectionId;
    const existing = sessions.get(key);
    if (!existing || (!existing.gameId && state.gameId)) sessions.set(key, state);
  }
  const byGame = {};
  let playing = 0;
  for (const state of sessions.values()) if (state.gameId) { playing += 1; byGame[state.gameId] = (byGame[state.gameId] || 0) + 1; }
  return { online: sessions.size, playing, byGame };
}

function broadcastPresence() {
  const payload = JSON.stringify({ type: 'presence', ...aggregatePresence(), ts: Date.now() });
  for (const [ws] of clients) if (ws.readyState === WebSocket.OPEN) ws.send(payload);
}

async function activityPayload() {
  const presence = aggregatePresence();
  const games = await getPublicGames();
  const current = Object.entries(presence.byGame).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([id, players]) => {
    const game = games.find((g) => g.id === id);
    return game ? { id, title: game.title, system: game.system, cover: game.cover, players } : null;
  }).filter(Boolean);
  return { ...presence, current, popular7d: await popularGames(7, 6), real: true };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', 'http://localhost');
  try {
    if (url.pathname === '/healthz') { res.writeHead(204, { 'cache-control': 'no-store' }); return res.end(); }
    if (url.pathname === '/api/status' && req.method === 'GET') return json(res, 200, { ok: true, ...aggregatePresence(), real: true, ts: Date.now() });
    if (url.pathname === '/api/activity' && req.method === 'GET') return json(res, 200, await activityPayload());
    if (url.pathname === '/api/games' && req.method === 'GET') return json(res, 200, { games: await getPublicGames() });
    if (url.pathname.startsWith('/api/games/') && req.method === 'GET') {
      const id = decodeURIComponent(url.pathname.slice('/api/games/'.length));
      const game = (await getPublicGames()).find((item) => item.id === id);
      return game ? json(res, 200, { game }) : json(res, 404, { error: 'game-not-found' });
    }
    if (url.pathname.startsWith('/api/play/') && req.method === 'POST') {
      const id = decodeURIComponent(url.pathname.slice('/api/play/'.length)).slice(0, 120);
      const game = (await getPublicGames()).find((item) => item.id === id);
      if (!game) return json(res, 404, { error: 'game-not-found' });
      const sessionId = cleanText(req.headers['x-session-id'], 100);
      await recordLaunch(id, sessionId);
      return json(res, 200, { ok: true });
    }

    if (url.pathname.startsWith('/api/admin/')) {
      if (!requireAdmin(req, res)) return;
      if (url.pathname === '/api/admin/status' && req.method === 'GET') {
        const games = await getGames();
        return json(res, 200, {
          ok: true,
          metadataProvider: THEGAMESDB_API_KEY ? 'thegamesdb+wikipedia' : (WIKIPEDIA_METADATA ? 'wikipedia' : null),
          maxUploadBytes: MAX_UPLOAD_BYTES,
          security: { zipUploads: ALLOW_ZIP_ROMS, uploadByAdminOnly: true, serverExecRom: false, metadataApproval: true, uniqueOnlineSessions: true },
          systems: Object.fromEntries(Object.entries(SYSTEMS).map(([key, value]) => [key, { label: value.label, experimental: Boolean(value.experimental), bios: value.bios }])),
          bios: await biosInventory(),
          summary: {
            total: games.length,
            ready: games.filter((game) => game.playable).length,
            missingRom: games.filter((game) => !game.installed).length,
            missingBios: games.filter((game) => game.installed && game.biosRequired && !game.biosInstalled).length,
            pendingMetadata: games.filter((game) => game.pendingMetadata).length,
            experimental: games.filter((game) => game.experimental).length
          }
        });
      }
      if (url.pathname === '/api/admin/games' && req.method === 'GET') return json(res, 200, { games: await getGames() });
      if (url.pathname === '/api/admin/scan' && req.method === 'POST') return json(res, 200, { imported: await scanLibrary(), games: await getGames() });
      if (url.pathname === '/api/admin/upload/rom' && req.method === 'POST') {
        const result = await uploadRom(req);
        if (!result.game.demo && (THEGAMESDB_API_KEY || WIKIPEDIA_METADATA)) try { result.proposal = await buildMetadataProposal(result.game.id); } catch (e) { result.proposalError = e.message; }
        return json(res, 201, result);
      }
      if (url.pathname === '/api/admin/upload/bios' && req.method === 'POST') return json(res, 201, await uploadBios(req));
      if (url.pathname.startsWith('/api/admin/upload/cover/') && req.method === 'POST') {
        const id = decodeURIComponent(url.pathname.slice('/api/admin/upload/cover/'.length));
        return json(res, 201, await uploadCover(req, id));
      }
      if (url.pathname.startsWith('/api/admin/metadata/propose/') && req.method === 'POST') {
        const id = decodeURIComponent(url.pathname.slice('/api/admin/metadata/propose/'.length));
        return json(res, 200, { proposal: await buildMetadataProposal(id) });
      }
      if (url.pathname.startsWith('/api/admin/metadata/approve/') && req.method === 'POST') {
        const id = decodeURIComponent(url.pathname.slice('/api/admin/metadata/approve/'.length));
        return json(res, 200, { game: await approveMetadata(id) });
      }
      if (url.pathname.startsWith('/api/admin/metadata/reject/') && req.method === 'POST') {
        const id = decodeURIComponent(url.pathname.slice('/api/admin/metadata/reject/'.length));
        return json(res, 200, { game: await rejectMetadata(id) });
      }
      if (url.pathname.startsWith('/api/admin/games/') && req.method === 'PATCH') {
        const id = decodeURIComponent(url.pathname.slice('/api/admin/games/'.length));
        return json(res, 200, { game: await patchGame(id, await readJsonBody(req)) });
      }
      return json(res, 404, { error: 'admin-route-not-found' });
    }
    return json(res, 404, { error: 'not-found' });
  } catch (error) {
    console.error(error?.stack || error);
    if (error?.code === 'UPLOAD_TOO_LARGE') return json(res, 413, { error: 'upload-too-large', maxUploadBytes: MAX_UPLOAD_BYTES });
    return json(res, Number(error?.status) || 500, { error: error?.message || 'internal-error', needsSystem: Boolean(error?.needsSystem) });
  }
});

const wss = new WebSocketServer({ noServer: true, maxPayload: 16 * 1024 });
server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url || '/', 'http://localhost');
  if (url.pathname !== '/ws/presence') return socket.destroy();
  const origin = String(req.headers.origin || '');
  const host = String(req.headers.host || '');
  if (origin) {
    try { if (new URL(origin).host !== host) return socket.destroy(); } catch { return socket.destroy(); }
  }
  wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
});

wss.on('connection', (ws) => {
  const state = { isAlive: true, gameId: null, sessionId: null, connectionId: crypto.randomUUID(), connectedAt: Date.now() };
  clients.set(ws, state);
  broadcastPresence();
  ws.on('pong', () => { state.isAlive = true; });
  ws.on('message', (raw) => {
    if (raw.length > 16 * 1024) return ws.close(1009, 'too large');
    let message; try { message = JSON.parse(raw.toString()); } catch { return; }
    if (message?.type === 'hello') { state.sessionId = cleanText(message.sessionId, 100) || null; broadcastPresence(); return; }
    if (message?.type === 'ping') { state.isAlive = true; if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'pong', ts: Date.now() })); return; }
    if (message?.type === 'playing') { state.gameId = typeof message.gameId === 'string' ? message.gameId.slice(0, 120) : null; broadcastPresence(); return; }
    if (message?.type === 'idle') { state.gameId = null; broadcastPresence(); }
  });
  ws.on('close', () => { clients.delete(ws); broadcastPresence(); });
});

const heartbeat = setInterval(() => {
  for (const [ws, state] of clients) {
    if (!state.isAlive) { clients.delete(ws); ws.terminate(); continue; }
    state.isAlive = false;
    ws.ping();
  }
  broadcastPresence();
}, 30_000);
heartbeat.unref();

setInterval(() => {
  const now = Date.now();
  for (const [key, value] of playRate) if (now - value > 30 * 60_000) playRate.delete(key);
  for (const [key, value] of authFailures) if (value.until && value.until < now) authFailures.delete(key);
}, 10 * 60_000).unref();

server.listen(PORT, '0.0.0.0', () => console.log(`Retro Portal backend listening on :${PORT}`));
