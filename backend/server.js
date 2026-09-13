import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { WebSocketServer, WebSocket } from 'ws';

const PORT = Number(process.env.PORT || 3000);
const CATALOG_FILE = process.env.CATALOG_FILE || '/data/games.json';
const ROM_ROOT = process.env.ROM_ROOT || '/roms';
const BIOS_ROOT = process.env.BIOS_ROOT || '/bios';
const clients = new Map();

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

async function fileExists(root, value) {
  const safe = safeRelative(value);
  if (!safe) return false;
  const rootResolved = path.resolve(root);
  const target = path.resolve(root, safe);
  if (!(target === rootResolved || target.startsWith(`${rootResolved}${path.sep}`))) return false;
  try {
    const st = await fs.stat(target);
    return st.isFile();
  } catch {
    return false;
  }
}

async function loadCatalog() {
  const raw = await fs.readFile(CATALOG_FILE, 'utf8');
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed.games)) throw new Error('catalog.games must be an array');
  return parsed.games;
}

async function hydrateGame(game) {
  const installed = await fileExists(ROM_ROOT, game.rom);
  const biosFiles = Array.isArray(game.bios) ? game.bios : (game.bios ? [game.bios] : []);
  const biosStates = await Promise.all(biosFiles.map((item) => fileExists(BIOS_ROOT, item)));
  const biosInstalled = biosStates.every(Boolean);
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
    visible: game.listedWhenMissing !== false || playable,
    romUrl: installed ? publicFileUrl('/roms', game.rom) : null,
    biosUrls: biosInstalled ? biosFiles.map((item) => publicFileUrl('/bios', item)).filter(Boolean) : [],
    biosUrl: biosInstalled && biosFiles[0] ? publicFileUrl('/bios', biosFiles[0]) : null
  };
}

async function getGames() {
  const games = await loadCatalog();
  return Promise.all(games.filter((game) => game.enabled !== false).map(hydrateGame));
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
    if (url.pathname === '/api/games') return json(res, 200, { games: await getGames() });
    if (url.pathname.startsWith('/api/games/')) {
      const id = decodeURIComponent(url.pathname.slice('/api/games/'.length));
      const game = (await getGames()).find((item) => item.id === id);
      return game ? json(res, 200, { game }) : json(res, 404, { error: 'game not found' });
    }
    return json(res, 404, { error: 'not found' });
  } catch (error) {
    console.error(error);
    return json(res, 500, { error: 'internal error' });
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
