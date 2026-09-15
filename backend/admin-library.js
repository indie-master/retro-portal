import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const CATALOG_FILE = process.env.CATALOG_FILE || '/data/runtime-games.json';
const ROM_ROOT = process.env.ROM_ROOT || '/roms';
const COVER_ROOT = process.env.COVER_ROOT || '/covers';
const ADMIN_TOKEN = String(process.env.ADMIN_TOKEN || '');

function json(res, code, payload) {
  res.writeHead(code, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff'
  });
  res.end(JSON.stringify(payload));
}

function tokenMatches(req) {
  if (ADMIN_TOKEN.length < 16) return false;
  const auth = String(req.headers.authorization || '');
  const supplied = auth.startsWith('Bearer ') ? auth.slice(7) : String(req.headers['x-admin-token'] || '');
  if (!supplied) return false;
  const a = Buffer.from(ADMIN_TOKEN);
  const b = Buffer.from(supplied);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function safeRelative(value) {
  if (typeof value !== 'string' || !value) return null;
  const normalized = value.replaceAll('\\', '/').replace(/^\/+/, '');
  const parts = normalized.split('/');
  if (!normalized || normalized.includes('\0') || parts.some((part) => !part || part === '.' || part === '..')) return null;
  return parts.join('/');
}

async function safeUnlink(root, relative) {
  const safe = safeRelative(relative);
  if (!safe) return false;
  const base = path.resolve(root);
  const target = path.resolve(root, safe);
  if (!target.startsWith(`${base}${path.sep}`)) return false;
  try {
    const stat = await fs.lstat(target);
    if (!stat.isFile() || stat.isSymbolicLink()) return false;
    await fs.unlink(target);
    return true;
  } catch (error) {
    if (error?.code === 'ENOENT') return false;
    throw error;
  }
}

async function loadCatalog() {
  const raw = await fs.readFile(CATALOG_FILE, 'utf8');
  const data = JSON.parse(raw);
  if (!Array.isArray(data.games)) throw new Error('catalog.games must be an array');
  return data;
}

async function saveCatalog(data) {
  const dir = path.dirname(CATALOG_FILE);
  const tmp = path.join(dir, `.games.delete.${process.pid}.${Date.now()}.tmp`);
  await fs.writeFile(tmp, `${JSON.stringify(data, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  await fs.rename(tmp, CATALOG_FILE);
}

async function removeLibraryEntry(req, res, url) {
  if (!tokenMatches(req)) return json(res, 401, { error: 'unauthorized' });
  const prefix = '/api/admin/library/';
  const id = decodeURIComponent(url.pathname.slice(prefix.length)).slice(0, 180);
  const purge = url.searchParams.get('purge') === '1';
  const data = await loadCatalog();
  const index = data.games.findIndex((game) => game.id === id);
  if (index < 0) return json(res, 404, { error: 'game-not-found' });

  const [game] = data.games.splice(index, 1);
  const removed = [];
  if (purge && !game.demo) {
    if (await safeUnlink(ROM_ROOT, game.rom)) removed.push(`rom:${game.rom}`);
    if (typeof game.cover === 'string' && game.cover.startsWith('/covers/library/')) {
      const coverFile = path.basename(game.cover);
      if (await safeUnlink(COVER_ROOT, coverFile)) removed.push(`cover:${coverFile}`);
    }
  }
  await saveCatalog(data);
  return json(res, 200, { ok: true, id, purge, removed });
}

// Keep the main server small: this wrapper only intercepts the destructive owner-only route.
const originalCreateServer = http.createServer.bind(http);
http.createServer = function patchedCreateServer(listener) {
  return originalCreateServer(async (req, res) => {
    try {
      const url = new URL(req.url || '/', 'http://localhost');
      if (req.method === 'DELETE' && url.pathname.startsWith('/api/admin/library/')) {
        return await removeLibraryEntry(req, res, url);
      }
      return listener(req, res);
    } catch (error) {
      console.error('[library-delete]', error?.stack || error);
      if (!res.headersSent) return json(res, 500, { error: 'library-delete-failed' });
      res.destroy();
    }
  });
};
