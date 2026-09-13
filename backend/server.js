import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { WebSocketServer, WebSocket } from 'ws';

const PORT = Number(process.env.PORT || 3000);
const CATALOG_FILE = process.env.CATALOG_FILE || '/data/games.json';
const PRESET_FILE = process.env.PRESET_FILE || '/data/presets/curated-classics.json';
const ROM_ROOT = process.env.ROM_ROOT || '/roms';
const BIOS_ROOT = process.env.BIOS_ROOT || '/bios';
const COVER_ROOT = process.env.COVER_ROOT || '/covers';
const ADMIN_TOKEN = String(process.env.ADMIN_TOKEN || '');
const THEGAMESDB_API_KEY = String(process.env.THEGAMESDB_API_KEY || '');
const MAX_UPLOAD_BYTES = Number(process.env.MAX_UPLOAD_BYTES || 2 * 1024 * 1024 * 1024);
const clients = new Map();
let catalogWriteQueue = Promise.resolve();

const SYSTEMS = {
  megadrive: { label: 'Mega Drive', dir: 'megadrive', core: 'segaMD', engine: 'emulatorjs', extensions: ['.bin', '.md', '.gen', '.zip'], bios: [] },
  ps1: { label: 'PlayStation', dir: 'ps1', core: 'psx', engine: 'emulatorjs', extensions: ['.chd', '.cue', '.bin', '.iso', '.pbp'], bios: ['ps1/scph5501.bin'] },
  dreamcast: { label: 'Dreamcast', dir: 'dreamcast', core: 'flycast', engine: 'flycast-wasm', extensions: ['.chd', '.gdi', '.cdi', '.cue', '.bin'], bios: ['dreamcast/dc_boot.bin', 'dreamcast/dc_flash.bin'], experimental: true },
  nes: { label: 'NES', dir: 'nes', core: 'nes', engine: 'emulatorjs', extensions: ['.nes', '.zip'], bios: [] },
  snes: { label: 'SNES', dir: 'snes', core: 'snes', engine: 'emulatorjs', extensions: ['.sfc', '.smc', '.zip'], bios: [] },
  gb: { label: 'Game Boy', dir: 'gb', core: 'gb', engine: 'emulatorjs', extensions: ['.gb', '.gbc', '.zip'], bios: [] },
  gba: { label: 'Game Boy Advance', dir: 'gba', core: 'gba', engine: 'emulatorjs', extensions: ['.gba', '.zip'], bios: [] },
  n64: { label: 'Nintendo 64', dir: 'n64', core: 'n64', engine: 'emulatorjs', extensions: ['.z64', '.n64', '.v64', '.zip'], bios: [] },
  arcade: { label: 'Arcade', dir: 'arcade', core: 'arcade', engine: 'emulatorjs', extensions: ['.zip'], bios: [] }
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

function json(res, code, payload) {
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(payload));
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
  const base = path.basename(decodeHeader(value)).replace(/[\u0000-\u001f<>:"/\\|?*]+/g, '_').trim();
  return base.slice(0, 220) || null;
}

function slugify(value) {
  return String(value || 'game').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'game';
}

function normalizeGameName(value) {
  let name = path.basename(String(value || ''));
  for (let i = 0; i < 3; i += 1) name = name.replace(/\.(zip|7z|bin|md|gen|nes|sfc|smc|gb|gbc|gba|chd|cue|iso|pbp|gdi|cdi|z64|n64|v64)$/i, '');
  return name
    .replace(/\([^)]*\)|\[[^\]]*\]/g, ' ')
    .replace(/\b(disc|disk|cd)\s*[0-9ivx]+\b/gi, ' ')
    .replace(/[_.+]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function prettyTitle(value) {
  let name = path.basename(String(value || 'Game'));
  for (let i = 0; i < 3; i += 1) name = name.replace(/\.(zip|7z|bin|md|gen|nes|sfc|smc|gb|gbc|gba|chd|cue|iso|pbp|gdi|cdi|z64|n64|v64)$/i, '');
  name = name.replace(/\([^)]*\)|\[[^\]]*\]/g, ' ').replace(/[_.]+/g, ' ').replace(/\s+/g, ' ').trim();
  return name || 'Untitled game';
}

function inferSystemKey(fileName) {
  const ext = path.extname(String(fileName || '')).toLowerCase();
  const simple = { '.nes': 'nes', '.sfc': 'snes', '.smc': 'snes', '.gb': 'gb', '.gbc': 'gb', '.gba': 'gba', '.md': 'megadrive', '.gen': 'megadrive', '.z64': 'n64', '.n64': 'n64', '.v64': 'n64', '.gdi': 'dreamcast', '.cdi': 'dreamcast' };
  return simple[ext] || null;
}

function adminConfigured() {
  return ADMIN_TOKEN.length >= 16;
}

function isAdmin(req) {
  if (!adminConfigured()) return false;
  const auth = String(req.headers.authorization || '');
  const supplied = auth.startsWith('Bearer ') ? auth.slice(7) : String(req.headers['x-admin-token'] || '');
  if (!supplied) return false;
  const a = Buffer.from(ADMIN_TOKEN);
  const b = Buffer.from(supplied);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function requireAdmin(req, res) {
  if (!adminConfigured()) { json(res, 503, { error: 'admin-disabled', message: 'ADMIN_TOKEN is not configured.' }); return false; }
  if (!isAdmin(req)) { json(res, 401, { error: 'unauthorized' }); return false; }
  return true;
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

async function loadCatalog() {
  return (await loadCatalogData()).games;
}

async function loadPresets() {
  try {
    const parsed = JSON.parse(await fs.readFile(PRESET_FILE, 'utf8'));
    return Array.isArray(parsed.games) ? parsed.games : [];
  } catch { return []; }
}

async function saveCatalogData(data) {
  const dir = path.dirname(CATALOG_FILE);
  const tmp = path.join(dir, `.games.${process.pid}.${Date.now()}.tmp`);
  await fs.writeFile(tmp, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
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
    title: game.title,
    system: game.system,
    engine,
    core: game.core,
    rom: game.rom,
    romExpected: safeRelative(game.rom),
    biosExpected: biosFiles.map(safeRelative).filter(Boolean),
    missingBios,
    cover: game.cover || '',
    screenshots: Array.isArray(game.screenshots) ? game.screenshots.slice(0, 6) : [],
    year: game.year || '',
    players: game.players || '',
    description: game.description || '',
    license: game.license || '',
    source: game.source || '',
    tags: Array.isArray(game.tags) ? game.tags.slice(0, 16) : [],
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
    publicVisible: playable && game.public !== false,
    romUrl: installed ? publicFileUrl('/roms', game.rom) : null,
    biosUrls: biosInstalled ? biosFiles.map((item) => publicFileUrl('/bios', item)).filter(Boolean) : [],
    biosUrl: biosInstalled && biosFiles[0] ? publicFileUrl('/bios', biosFiles[0]) : null
  };
}

async function getGames() {
  const games = await loadCatalog();
  return Promise.all(games.filter((game) => game.enabled !== false).map(hydrateGame));
}

async function getPublicGames() {
  return (await getGames()).filter((game) => game.publicVisible);
}

function presetMatches(preset, fileName, systemLabel) {
  if (preset.system !== systemLabel) return false;
  const needle = normalizeGameName(fileName);
  const candidates = [preset.title, preset.rom ? path.basename(preset.rom) : ''].map(normalizeGameName).filter(Boolean);
  return candidates.some((value) => value === needle || value.includes(needle) || needle.includes(value));
}

function uniqueId(games, base) {
  const ids = new Set(games.map((item) => item.id));
  let candidate = slugify(base);
  if (!ids.has(candidate)) return candidate;
  let i = 2;
  while (ids.has(`${candidate}-${i}`)) i += 1;
  return `${candidate}-${i}`;
}

async function registerRom(systemKey, relativeRom, originalName, sha1 = '') {
  const system = SYSTEMS[systemKey];
  if (!system) throw new Error(`Unsupported system: ${systemKey}`);
  const presets = await loadPresets();
  return mutateCatalog(async (data) => {
    const games = data.games;
    let preset = presets.find((item) => presetMatches(item, originalName, system.label));
    let existing = games.find((item) => item.rom === relativeRom);
    if (!existing && preset?.id) existing = games.find((item) => item.id === preset.id);
    const title = preset?.title || prettyTitle(originalName);
    const id = existing?.id || preset?.id || uniqueId(games, `${title}-${systemKey}`);
    const gameId = existing?.gameId || preset?.gameId || Number.parseInt((sha1 || crypto.createHash('sha1').update(relativeRom).digest('hex')).slice(0, 8), 16);
    const base = preset ? { ...preset } : {
      id,
      gameId,
      title,
      system: system.label,
      engine: system.engine,
      core: system.core,
      rom: relativeRom,
      bios: [...system.bios],
      cover: '',
      screenshots: [],
      year: '',
      players: '1 игрок',
      description: '',
      license: 'user-supplied',
      tags: [],
      sort: 5000
    };
    const item = { ...base, id, gameId, rom: relativeRom, listedWhenMissing: false, autoManaged: true, metadataSource: preset ? 'preset' : (existing?.metadataSource || 'filename') };
    if (system.experimental) item.experimental = true;
    if (existing) Object.assign(existing, item);
    else games.push(item);
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
    const files = await walkFiles(baseDir);
    for (const rel of files) {
      const ext = path.extname(rel).toLowerCase();
      if (!system.extensions.includes(ext)) continue;
      const rom = `${system.dir}/${rel}`.replaceAll('\\', '/');
      if (beforePaths.has(rom)) continue;
      const registered = await registerRom(key, rom, rel);
      results.push({ id: registered.id, title: registered.title, system: registered.system, rom });
      beforePaths.add(rom);
    }
  }
  return results;
}

async function writeRequestBodyToFile(req, destination) {
  await fs.mkdir(path.dirname(destination), { recursive: true });
  const tmp = `${destination}.upload-${process.pid}-${Date.now()}`;
  const handle = await fs.open(tmp, 'w');
  const sha1 = crypto.createHash('sha1');
  const md5 = crypto.createHash('md5');
  let bytes = 0;
  try {
    for await (const chunk of req) {
      bytes += chunk.length;
      if (bytes > MAX_UPLOAD_BYTES) throw Object.assign(new Error('upload-too-large'), { code: 'UPLOAD_TOO_LARGE' });
      sha1.update(chunk); md5.update(chunk);
      await handle.write(chunk);
    }
  } catch (error) {
    await handle.close().catch(() => {});
    await fs.unlink(tmp).catch(() => {});
    throw error;
  }
  await handle.close();
  await fs.rename(tmp, destination);
  return { bytes, sha1: sha1.digest('hex'), md5: md5.digest('hex') };
}

function systemKeyByLabel(label) {
  const needle = String(label || '').toLowerCase();
  return Object.entries(SYSTEMS).find(([, cfg]) => cfg.label.toLowerCase() === needle)?.[0] || null;
}

async function uploadRom(req) {
  const fileName = safeFileName(req.headers['x-file-name']);
  if (!fileName) throw Object.assign(new Error('missing-file-name'), { status: 400 });
  let systemKey = String(req.headers['x-system'] || 'auto').toLowerCase();
  if (systemKey === 'auto') systemKey = inferSystemKey(fileName);
  if (!systemKey || !SYSTEMS[systemKey]) throw Object.assign(new Error('system-required'), { status: 422, needsSystem: true });
  const system = SYSTEMS[systemKey];
  const ext = path.extname(fileName).toLowerCase();
  if (!system.extensions.includes(ext)) throw Object.assign(new Error(`unsupported-extension-for-${systemKey}`), { status: 415 });
  const relativeRom = `${system.dir}/${fileName}`;
  const destination = path.join(ROM_ROOT, system.dir, fileName);
  const upload = await writeRequestBodyToFile(req, destination);
  const registered = await registerRom(systemKey, relativeRom, fileName, upload.sha1);
  return { upload, game: await hydrateGame(registered) };
}

async function uploadBios(req) {
  const fileName = safeFileName(req.headers['x-file-name']);
  if (!fileName) throw Object.assign(new Error('missing-file-name'), { status: 400 });
  const systemKey = String(req.headers['x-system'] || '').toLowerCase();
  if (!SYSTEMS[systemKey]) throw Object.assign(new Error('system-required'), { status: 422 });
  const override = safeFileName(req.headers['x-bios-name'] || '');
  const system = SYSTEMS[systemKey];
  const tempName = `.incoming-${Date.now()}-${fileName}`;
  const tempPath = path.join(BIOS_ROOT, system.dir, tempName);
  const upload = await writeRequestBodyToFile(req, tempPath);
  let canonical = override || fileName;
  let recognized = Boolean(override);
  if (systemKey === 'ps1') {
    const byHash = PS1_BIOS_BY_MD5.get(upload.md5.toLowerCase());
    if (byHash) { canonical = byHash; recognized = true; }
  } else if (systemKey === 'dreamcast') {
    recognized = ['dc_boot.bin', 'dc_flash.bin'].includes(canonical.toLowerCase());
  }
  const destination = path.join(BIOS_ROOT, system.dir, canonical);
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.rename(tempPath, destination);
  return { upload, system: system.label, storedAs: `${system.dir}/${canonical}`, recognized };
}

function normalizeTitleForScore(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function findBoxartUrl(payload, gameId) {
  const boxart = payload?.include?.boxart;
  if (!boxart) return null;
  const entries = boxart?.data?.[String(gameId)] || boxart?.data?.[gameId] || [];
  const image = entries.find((item) => item?.side === 'front') || entries[0];
  const base = boxart?.base_url?.original || boxart?.base_url?.large || boxart?.base_url?.medium || '';
  if (!image?.filename || !base) return null;
  return `${String(base).replace(/\/$/, '')}/${String(image.filename).replace(/^\//, '')}`;
}

async function downloadCover(url, gameId) {
  const response = await fetch(url, { redirect: 'follow' });
  if (!response.ok) throw new Error(`cover HTTP ${response.status}`);
  const length = Number(response.headers.get('content-length') || 0);
  if (length > 12 * 1024 * 1024) throw new Error('cover-too-large');
  const contentType = response.headers.get('content-type') || '';
  const ext = contentType.includes('png') ? '.png' : contentType.includes('webp') ? '.webp' : '.jpg';
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > 12 * 1024 * 1024) throw new Error('cover-too-large');
  await fs.mkdir(COVER_ROOT, { recursive: true });
  const file = `${slugify(gameId)}${ext}`;
  await fs.writeFile(path.join(COVER_ROOT, file), bytes);
  return `/covers/library/${file}`;
}

async function enrichGameMetadata(gameId) {
  if (!THEGAMESDB_API_KEY) throw Object.assign(new Error('metadata-provider-not-configured'), { status: 409 });
  const hydrated = (await getGames()).find((game) => game.id === gameId);
  if (!hydrated) throw Object.assign(new Error('game-not-found'), { status: 404 });
  const params = new URLSearchParams({ apikey: THEGAMESDB_API_KEY, name: hydrated.title, fields: 'players,genres,overview,platform,coop,alternates', include: 'boxart' });
  const response = await fetch(`https://api.thegamesdb.net/v1.1/Games/ByGameName?${params}`);
  if (!response.ok) throw Object.assign(new Error(`metadata-provider-http-${response.status}`), { status: 502 });
  const payload = await response.json();
  const candidates = Array.isArray(payload?.data?.games) ? payload.data.games : [];
  if (!candidates.length) throw Object.assign(new Error('metadata-not-found'), { status: 404 });
  const wanted = normalizeTitleForScore(hydrated.title);
  const selected = candidates.find((item) => normalizeTitleForScore(item.game_title) === wanted) || candidates[0];
  let cover = '';
  const coverUrl = findBoxartUrl(payload, selected.id);
  if (coverUrl) {
    try { cover = await downloadCover(coverUrl, gameId); } catch (error) { console.warn('cover download failed', error.message); }
  }
  const patch = {
    title: selected.game_title || hydrated.title,
    year: selected.release_date ? String(selected.release_date).slice(0, 4) : hydrated.year,
    description: selected.overview || hydrated.description,
    players: selected.players ? `${selected.players} игрок${Number(selected.players) === 1 ? '' : 'а'}` : hydrated.players,
    metadataSource: 'thegamesdb'
  };
  if (cover) patch.cover = cover;
  await mutateCatalog(async (data) => {
    const game = data.games.find((item) => item.id === gameId);
    if (!game) throw Object.assign(new Error('game-not-found'), { status: 404 });
    Object.assign(game, patch);
  });
  return (await getGames()).find((game) => game.id === gameId);
}

async function biosInventory() {
  const files = await walkFiles(BIOS_ROOT);
  return files.filter((file) => !path.basename(file).startsWith('.')).sort();
}

function aggregatePresence() {
  const byGame = {};
  let playing = 0;
  for (const state of clients.values()) {
    if (state.gameId) {
      playing += 1;
      byGame[state.gameId] = (byGame[state.gameId] || 0) + 1;
    }
  }
  return { online: clients.size, playing, byGame };
}

function broadcastPresence() {
  const payload = JSON.stringify({ type: 'presence', ...aggregatePresence(), ts: Date.now() });
  for (const [ws] of clients) if (ws.readyState === WebSocket.OPEN) ws.send(payload);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', 'http://localhost');
  try {
    if (url.pathname === '/healthz') { res.writeHead(204, { 'cache-control': 'no-store' }); return res.end(); }
    if (url.pathname === '/api/status') return json(res, 200, { ok: true, ...aggregatePresence(), ts: Date.now() });
    if (url.pathname === '/api/games' && req.method === 'GET') return json(res, 200, { games: await getPublicGames() });
    if (url.pathname.startsWith('/api/games/') && req.method === 'GET') {
      const id = decodeURIComponent(url.pathname.slice('/api/games/'.length));
      const game = (await getPublicGames()).find((item) => item.id === id);
      return game ? json(res, 200, { game }) : json(res, 404, { error: 'game not found' });
    }

    if (url.pathname.startsWith('/api/admin/')) {
      if (!requireAdmin(req, res)) return;
      if (url.pathname === '/api/admin/status' && req.method === 'GET') {
        const games = await getGames();
        return json(res, 200, {
          ok: true,
          metadataProvider: THEGAMESDB_API_KEY ? 'thegamesdb' : null,
          maxUploadBytes: MAX_UPLOAD_BYTES,
          systems: Object.fromEntries(Object.entries(SYSTEMS).map(([key, value]) => [key, { label: value.label, experimental: Boolean(value.experimental), bios: value.bios }])),
          bios: await biosInventory(),
          summary: {
            total: games.length,
            ready: games.filter((game) => game.playable).length,
            missingRom: games.filter((game) => !game.installed).length,
            missingBios: games.filter((game) => game.installed && game.biosRequired && !game.biosInstalled).length,
            experimental: games.filter((game) => game.experimental).length
          }
        });
      }
      if (url.pathname === '/api/admin/games' && req.method === 'GET') return json(res, 200, { games: await getGames() });
      if (url.pathname === '/api/admin/scan' && req.method === 'POST') {
        const imported = await scanLibrary();
        return json(res, 200, { imported, games: await getGames() });
      }
      if (url.pathname === '/api/admin/upload/rom' && req.method === 'POST') {
        const result = await uploadRom(req);
        return json(res, 201, result);
      }
      if (url.pathname === '/api/admin/upload/bios' && req.method === 'POST') {
        const result = await uploadBios(req);
        return json(res, 201, result);
      }
      if (url.pathname.startsWith('/api/admin/enrich/') && req.method === 'POST') {
        const id = decodeURIComponent(url.pathname.slice('/api/admin/enrich/'.length));
        return json(res, 200, { game: await enrichGameMetadata(id) });
      }
      return json(res, 404, { error: 'admin route not found' });
    }

    return json(res, 404, { error: 'not found' });
  } catch (error) {
    console.error(error);
    if (error?.code === 'UPLOAD_TOO_LARGE') return json(res, 413, { error: 'upload-too-large', maxUploadBytes: MAX_UPLOAD_BYTES });
    const status = Number(error?.status) || 500;
    return json(res, status, { error: error?.message || 'internal error', needsSystem: Boolean(error?.needsSystem) });
  }
});

const wss = new WebSocketServer({ noServer: true });
server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url || '/', 'http://localhost');
  if (url.pathname !== '/ws/presence') return socket.destroy();
  wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
});

wss.on('connection', (ws) => {
  clients.set(ws, { isAlive: true, gameId: null, connectedAt: Date.now() });
  broadcastPresence();
  ws.on('pong', () => { const state = clients.get(ws); if (state) state.isAlive = true; });
  ws.on('message', (raw) => {
    let message; try { message = JSON.parse(raw.toString()); } catch { return; }
    const state = clients.get(ws); if (!state) return;
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
}, 25000);

server.listen(PORT, '0.0.0.0', () => console.log(`Retro Portal backend listening on :${PORT}`));
function shutdown() { clearInterval(heartbeat); for (const [ws] of clients) ws.close(1001, 'server shutdown'); server.close(() => process.exit(0)); }
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
