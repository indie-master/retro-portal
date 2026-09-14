import fs from 'node:fs/promises';

const BACKEND_URL = String(process.env.BACKEND_URL || 'http://backend:3000').replace(/\/$/, '');
const ADMIN_TOKEN = String(process.env.ADMIN_TOKEN || '');
const ADMIN_TOKEN_FILE = String(process.env.ADMIN_TOKEN_FILE || '/data/admin-token');
const THEGAMESDB_API_KEY = String(process.env.THEGAMESDB_API_KEY || '');
const AUTO_METADATA = String(process.env.AUTO_METADATA ?? '1') !== '0';
const AUTO_METADATA_OVERWRITE = String(process.env.AUTO_METADATA_OVERWRITE || '0') === '1';
const AUTO_METADATA_INTERVAL = Math.max(60, Number(process.env.AUTO_METADATA_INTERVAL || 600));
const AUTO_METADATA_BATCH = Math.max(1, Math.min(25, Number(process.env.AUTO_METADATA_BATCH || 8)));
const WIKIPEDIA_METADATA = String(process.env.WIKIPEDIA_METADATA ?? '1') !== '0';
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const UA = 'RetroPortal/0.10 metadata-worker';
const retryAfter = new Map();

const SYSTEM_META = {
  'Mega Drive': { tgdb: 'Sega Genesis', wiki: 'Sega Genesis Mega Drive', libretro: 'Sega_-_Mega_Drive_-_Genesis' },
  PlayStation: { tgdb: 'Sony Playstation', wiki: 'PlayStation video game', libretro: 'Sony_-_PlayStation' },
  Dreamcast: { tgdb: 'Sega Dreamcast', wiki: 'Dreamcast video game', libretro: 'Sega_-_Dreamcast' },
  NES: { tgdb: 'Nintendo Entertainment System (NES)', wiki: 'Nintendo Entertainment System video game', libretro: 'Nintendo_-_Nintendo_Entertainment_System' },
  SNES: { tgdb: 'Super Nintendo (SNES)', wiki: 'Super Nintendo video game', libretro: 'Nintendo_-_Super_Nintendo_Entertainment_System' },
  'Game Boy': { tgdb: 'Nintendo Game Boy', wiki: 'Game Boy video game', libretro: 'Nintendo_-_Game_Boy' },
  'Game Boy Advance': { tgdb: 'Nintendo Game Boy Advance', wiki: 'Game Boy Advance video game', libretro: 'Nintendo_-_Game_Boy_Advance' },
  'Nintendo 64': { tgdb: 'Nintendo 64', wiki: 'Nintendo 64 video game', libretro: 'Nintendo_-_Nintendo_64' },
  Arcade: { tgdb: 'Arcade', wiki: 'arcade video game', libretro: 'FBNeo_-_Arcade_Games' }
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function clean(value, max = 2500) {
  return String(value || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

function baseTitle(value) {
  return clean(value, 180)
    .replace(/\([^)]*\)|\[[^\]]*\]/g, ' ')
    .replace(/\b(disc|disk|cd)\s*[0-9ivx]+\b/gi, ' ')
    .replace(/\b(rev|revision|prototype|proto|beta|demo)\b.*$/i, ' ')
    .replace(/[-_][0-9a-f]{10,16}$/i, ' ')
    .replace(/[_+.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function norm(value) {
  return baseTitle(value).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9а-яё]+/gi, ' ').replace(/\s+/g, ' ').trim();
}

function titleScore(candidate, wanted) {
  const a = norm(candidate);
  const b = norm(wanted);
  if (!a || !b) return 0;
  if (a === b) return 100;
  if (a.startsWith(b) || b.startsWith(a)) return 88;
  if (a.includes(b) || b.includes(a)) return 82;
  const aa = new Set(a.split(' '));
  const bb = new Set(b.split(' '));
  const common = [...aa].filter((x) => bb.has(x)).length;
  return Math.round((common / Math.max(aa.size, bb.size)) * 75);
}

async function fetchTimed(url, options = {}, ms = 8000) {
  return fetch(url, {
    ...options,
    redirect: options.redirect || 'error',
    signal: AbortSignal.timeout(ms),
    headers: { 'user-agent': UA, ...(options.headers || {}) }
  });
}

async function readToken() {
  if (ADMIN_TOKEN.length >= 16) return ADMIN_TOKEN;
  try {
    const value = (await fs.readFile(ADMIN_TOKEN_FILE, 'utf8')).trim();
    return value.length >= 16 ? value : '';
  } catch {
    return '';
  }
}

async function admin(pathname, options = {}) {
  const token = await readToken();
  if (!token) throw new Error('admin-token-unavailable');
  const response = await fetchTimed(`${BACKEND_URL}${pathname}`, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, ...(options.headers || {}) }
  }, 15000);
  const text = await response.text();
  let body = {};
  try { body = text ? JSON.parse(text) : {}; } catch {}
  if (!response.ok) throw Object.assign(new Error(body?.error || `HTTP ${response.status}`), { status: response.status, body });
  return body;
}

const platformCache = new Map();

async function tgdbPlatformId(system) {
  if (!THEGAMESDB_API_KEY) return null;
  const meta = SYSTEM_META[system];
  if (!meta?.tgdb) return null;
  if (platformCache.has(system)) return platformCache.get(system);
  try {
    const url = new URL('https://api.thegamesdb.net/v1/Platforms/ByPlatformName');
    url.searchParams.set('apikey', THEGAMESDB_API_KEY);
    url.searchParams.set('name', meta.tgdb);
    const response = await fetchTimed(url);
    if (!response.ok) throw new Error(`TGDB platform HTTP ${response.status}`);
    const payload = await response.json();
    const platforms = Array.isArray(payload?.data?.platforms) ? payload.data.platforms : [];
    const picked = platforms.map((item) => ({ item, score: titleScore(item?.name, meta.tgdb) })).sort((a, b) => b.score - a.score)[0]?.item;
    const id = picked?.id ? String(picked.id) : null;
    platformCache.set(system, id);
    return id;
  } catch (error) {
    console.warn(`[metadata] platform lookup failed for ${system}: ${error.message}`);
    platformCache.set(system, null);
    return null;
  }
}

function findBoxartUrl(payload, gameId) {
  const boxart = payload?.include?.boxart;
  const entries = boxart?.data?.[String(gameId)] || boxart?.data?.[gameId] || [];
  const image = entries.find((item) => item?.side === 'front') || entries[0];
  const base = boxart?.base_url?.original || boxart?.base_url?.large || boxart?.base_url?.medium || '';
  return image?.filename && base ? `${String(base).replace(/\/$/, '')}/${String(image.filename).replace(/^\//, '')}` : '';
}

async function fromTheGamesDB(game) {
  if (!THEGAMESDB_API_KEY) return null;
  try {
    const url = new URL('https://api.thegamesdb.net/v1.1/Games/ByGameName');
    url.searchParams.set('apikey', THEGAMESDB_API_KEY);
    url.searchParams.set('name', baseTitle(game.title));
    url.searchParams.set('fields', 'players,genres,overview,platform,coop,alternates');
    url.searchParams.set('include', 'boxart,platform');
    const platformId = await tgdbPlatformId(game.system);
    if (platformId) url.searchParams.set('filter[platform]', platformId);
    const response = await fetchTimed(url);
    if (!response.ok) throw new Error(`TGDB HTTP ${response.status}`);
    const payload = await response.json();
    const candidates = Array.isArray(payload?.data?.games) ? payload.data.games : [];
    const selected = candidates.map((item) => ({ item, score: titleScore(item?.game_title, game.title) })).sort((a, b) => b.score - a.score)[0];
    if (!selected || selected.score < 82) return null;
    const item = selected.item;
    return {
      confidence: selected.score,
      source: 'TheGamesDB',
      title: clean(item.game_title, 180),
      year: item.release_date ? String(item.release_date).slice(0, 4) : '',
      players: item.players ? `${item.players} ${Number(item.players) === 1 ? 'игрок' : 'игрока'}` : '',
      description: clean(item.overview, 2500),
      coverUrl: findBoxartUrl(payload, item.id)
    };
  } catch (error) {
    console.warn(`[metadata] TGDB failed for ${game.title}: ${error.message}`);
    return null;
  }
}

async function fromWikipedia(game) {
  if (!WIKIPEDIA_METADATA) return null;
  const wanted = baseTitle(game.title);
  const qualifier = SYSTEM_META[game.system]?.wiki || `${game.system} video game`;
  for (const lang of ['ru', 'en']) {
    try {
      const search = new URL(`https://${lang}.wikipedia.org/w/api.php`);
      search.searchParams.set('action', 'query');
      search.searchParams.set('format', 'json');
      search.searchParams.set('origin', '*');
      search.searchParams.set('list', 'search');
      search.searchParams.set('srsearch', `"${wanted}" ${qualifier}`);
      search.searchParams.set('srlimit', '5');
      const response = await fetchTimed(search);
      if (!response.ok) continue;
      const payload = await response.json();
      const hits = Array.isArray(payload?.query?.search) ? payload.query.search : [];
      const selected = hits.map((item) => ({ item, score: titleScore(item?.title, wanted) })).sort((a, b) => b.score - a.score)[0];
      if (!selected || selected.score < 75) continue;

      const api = new URL(`https://${lang}.wikipedia.org/w/api.php`);
      api.searchParams.set('action', 'query');
      api.searchParams.set('format', 'json');
      api.searchParams.set('origin', '*');
      api.searchParams.set('prop', 'extracts|pageimages');
      api.searchParams.set('exintro', '1');
      api.searchParams.set('explaintext', '1');
      api.searchParams.set('redirects', '1');
      api.searchParams.set('piprop', 'thumbnail|original');
      api.searchParams.set('pithumbsize', '640');
      api.searchParams.set('titles', selected.item.title);
      const pageResponse = await fetchTimed(api);
      if (!pageResponse.ok) continue;
      const data = await pageResponse.json();
      const page = Object.values(data?.query?.pages || {})[0];
      const text = clean(page?.extract, 2500);
      if (!text) continue;
      const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
      return {
        confidence: selected.score,
        source: `Wikipedia-${lang}`,
        title: clean(selected.item.title.replace(/\s*\([^)]*\)\s*$/, ''), 180),
        description: clean(sentences.slice(0, 2).join(' '), 1200),
        history: clean(sentences.slice(0, 5).join(' '), 2200),
        coverUrl: String(page?.original?.source || page?.thumbnail?.source || '')
      };
    } catch (error) {
      console.warn(`[metadata] Wikipedia ${lang} failed for ${game.title}: ${error.message}`);
    }
  }
  return null;
}

function libretroName(value) {
  return baseTitle(value).replace(/[&*\/:`<>?\\|]/g, '_').trim();
}

async function libretroCover(game) {
  const repo = SYSTEM_META[game.system]?.libretro;
  if (!repo) return null;
  const name = libretroName(game.title);
  const candidates = [name, `${name} (USA)`, `${name} (Europe)`, `${name} (World)`, `${name} (USA, Europe)`, `${name} (Japan)`];
  for (const candidate of [...new Set(candidates)]) {
    const encoded = candidate.split('/').map(encodeURIComponent).join('/');
    const url = `https://raw.githubusercontent.com/libretro-thumbnails/${repo}/master/Named_Boxarts/${encoded}.png`;
    try {
      const response = await fetchTimed(url, {}, 6000);
      if (!response.ok) continue;
      const length = Number(response.headers.get('content-length') || 0);
      if (length && length > MAX_IMAGE_BYTES) continue;
      const bytes = Buffer.from(await response.arrayBuffer());
      if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) continue;
      if (!(bytes.length > 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))) continue;
      return { bytes, fileName: 'auto-cover.png' };
    } catch {}
  }
  return null;
}

function allowedImageHost(raw) {
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:') return false;
    const host = url.hostname.toLowerCase();
    return host === 'raw.githubusercontent.com' || host === 'upload.wikimedia.org' || host === 'thegamesdb.net' || host.endsWith('.thegamesdb.net');
  } catch {
    return false;
  }
}

async function downloadImage(url) {
  if (!url || !allowedImageHost(url)) return null;
  const response = await fetchTimed(url, {}, 8000);
  if (!response.ok) return null;
  const length = Number(response.headers.get('content-length') || 0);
  if (length && length > MAX_IMAGE_BYTES) return null;
  const type = String(response.headers.get('content-type') || '').toLowerCase();
  if (!/^image\/(png|jpeg|webp)/.test(type)) return null;
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) return null;
  const ext = type.includes('png') ? 'png' : type.includes('webp') ? 'webp' : 'jpg';
  return { bytes, fileName: `auto-cover.${ext}` };
}

async function uploadCover(gameId, image) {
  if (!image?.bytes?.length) return false;
  const token = await readToken();
  if (!token) return false;
  const response = await fetchTimed(`${BACKEND_URL}/api/admin/upload/cover/${encodeURIComponent(gameId)}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'X-File-Name': encodeURIComponent(image.fileName || 'auto-cover.png') },
    body: image.bytes
  }, 15000);
  if (!response.ok) throw new Error(`cover upload HTTP ${response.status}: ${(await response.text()).slice(0, 160)}`);
  return true;
}

async function patchGame(game, metadata) {
  const body = {};
  const filenameManaged = game.metadataSource === 'filename' || !game.metadataSource;
  if (metadata.title && (AUTO_METADATA_OVERWRITE || filenameManaged) && metadata.confidence >= 82) body.title = metadata.title;
  if (metadata.year && (AUTO_METADATA_OVERWRITE || !game.year)) body.year = metadata.year;
  if (metadata.players && (AUTO_METADATA_OVERWRITE || !game.players || game.players === '1 игрок')) body.players = metadata.players;
  if (metadata.description && (AUTO_METADATA_OVERWRITE || !game.description)) body.description = metadata.description;
  if (metadata.history && (AUTO_METADATA_OVERWRITE || !game.history)) body.history = metadata.history;
  if (!Object.keys(body).length) return false;
  await admin(`/api/admin/games/${encodeURIComponent(game.id)}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  });
  return true;
}

async function enrich(game) {
  const needsText = AUTO_METADATA_OVERWRITE || !game.description || !game.year || game.metadataSource === 'filename' || !game.metadataSource;
  const needsCover = AUTO_METADATA_OVERWRITE || !game.cover;
  if (!needsText && !needsCover) return false;

  const tgdb = await fromTheGamesDB(game);
  const wiki = needsText ? await fromWikipedia(game) : null;
  const metadata = {
    confidence: Math.max(tgdb?.confidence || 0, wiki?.confidence || 0),
    title: tgdb?.title || wiki?.title || '',
    year: tgdb?.year || '',
    players: tgdb?.players || '',
    description: tgdb?.description || wiki?.description || '',
    history: wiki?.history || '',
    sources: [tgdb?.source, wiki?.source].filter(Boolean)
  };

  let changed = false;
  if (needsText && metadata.confidence >= 75) changed = await patchGame(game, metadata) || changed;
  if (needsCover) {
    let image = tgdb?.coverUrl ? await downloadImage(tgdb.coverUrl).catch(() => null) : null;
    if (!image) image = await libretroCover(game).catch(() => null);
    if (!image && wiki?.coverUrl) image = await downloadImage(wiki.coverUrl).catch(() => null);
    if (image) { await uploadCover(game.id, image); changed = true; }
  }

  if (changed) {
    try { await admin(`/api/admin/metadata/reject/${encodeURIComponent(game.id)}`, { method: 'POST' }); }
    catch (error) { if (error.status !== 409) console.warn(`[metadata] pending cleanup: ${error.message}`); }
    console.log(`[metadata] enriched ${game.system}: ${game.title}${metadata.sources.length ? ` via ${metadata.sources.join('+')}` : ''}`);
  }
  return changed;
}

async function cycle() {
  if (!AUTO_METADATA) return;
  const { games = [] } = await admin('/api/admin/games');
  const now = Date.now();
  const targets = games
    .filter((game) => game.installed && !game.demo)
    .filter((game) => !retryAfter.has(game.id) || retryAfter.get(game.id) <= now)
    .filter((game) => AUTO_METADATA_OVERWRITE || !game.cover || !game.description || !game.year || game.metadataSource === 'filename' || !game.metadataSource)
    .slice(0, AUTO_METADATA_BATCH);

  for (const game of targets) {
    try {
      const changed = await enrich(game);
      retryAfter.set(game.id, Date.now() + (changed ? 12 * 3600_000 : 6 * 3600_000));
    } catch (error) {
      retryAfter.set(game.id, Date.now() + 3600_000);
      console.warn(`[metadata] ${game.id}: ${error.message}`);
    }
    await sleep(1200);
  }
}

async function main() {
  if (!AUTO_METADATA) {
    console.log('[metadata] AUTO_METADATA=0; worker disabled.');
    setInterval(() => {}, 24 * 3600_000);
    return;
  }
  console.log(`[metadata] worker enabled; interval=${AUTO_METADATA_INTERVAL}s batch=${AUTO_METADATA_BATCH}`);
  while (true) {
    try { await cycle(); } catch (error) { console.warn(`[metadata] cycle failed: ${error.message}`); }
    await sleep(AUTO_METADATA_INTERVAL * 1000);
  }
}

main().catch((error) => {
  console.error(error?.stack || error);
  process.exitCode = 1;
});
