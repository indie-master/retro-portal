const content = document.querySelector('#libraryContent');
const filters = document.querySelector('#filters');
const installedCount = document.querySelector('#installedCount');
const playingCount = document.querySelector('#playingCount');
const search = document.querySelector('#search');
let games = [];
let activeFilter = 'Все';
let query = '';
let presenceByGame = {};

const FILTER_ORDER = ['Все', 'Mega Drive', 'PlayStation', 'Dreamcast', 'NES', 'На двоих'];

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
}
function isMultiplayer(game) { const tags = Array.isArray(game.tags) ? game.tags : []; return tags.includes('multiplayer') || /2|multi|дв/i.test(game.players || ''); }
function filteredGames() {
  let result = [...games];
  if (activeFilter === 'На двоих') result = result.filter(isMultiplayer);
  else if (activeFilter !== 'Все') result = result.filter((game) => game.system === activeFilter);
  if (query) { const needle = query.toLowerCase(); result = result.filter((game) => [game.title, game.system, game.description, ...(game.tags || [])].join(' ').toLowerCase().includes(needle)); }
  return result.sort((a, b) => (a.sort ?? 9999) - (b.sort ?? 9999) || a.title.localeCompare(b.title));
}
function tagLabel(tag) { const labels = { multiplayer:'1–2 игрока', homebrew:'homebrew', racing:'гонки', fighting:'файтинг', platformer:'платформер', action:'экшен', arcade:'аркада', horror:'хоррор' }; return labels[tag] || tag; }
function gameCard(game) {
  const viewers = presenceByGame[game.id] || 0;
  const preview = Array.isArray(game.screenshots) && game.screenshots[0] ? game.screenshots[0] : '';
  const button = game.playable ? `<a class="play-button" href="/game.html?id=${encodeURIComponent(game.id)}">▶ ИГРАТЬ</a>` : `<button class="play-button disabled" disabled>${game.biosRequired && !game.biosInstalled ? 'НЕТ BIOS' : 'НЕТ ROM'}</button>`;
  const tags = (game.tags || []).slice(0, 2).map((tag) => `<span>${escapeHtml(tagLabel(tag))}</span>`).join('');
  return `<article class="game-card ${game.playable ? '' : 'unavailable'}"><div class="cover-wrap"><div class="cover-art"><img src="${escapeHtml(game.cover)}" alt="Обложка ${escapeHtml(game.title)}" loading="lazy"></div>${preview ? `<div class="cover-preview"><img src="${escapeHtml(preview)}" alt="Скриншот ${escapeHtml(game.title)}" loading="lazy"></div>` : ''}<div class="cover-shade"></div><span class="platform-badge">${escapeHtml(game.system)}</span>${viewers ? `<span class="playing-badge">● ${viewers} ИГРАЕТ</span>` : ''}${game.engine === 'flycast-wasm' ? '<span class="experimental-badge">EXPERIMENTAL</span>' : ''}</div><div class="game-card-body"><h4>${escapeHtml(game.title)}</h4><p>${escapeHtml(game.description || '')}</p>${tags ? `<div class="tags">${tags}</div>` : ''}<div class="card-action">${button}</div></div></article>`;
}
function render() { const visible = filteredGames(); if (!visible.length) { content.innerHTML = '<div class="loading-card">Ничего не найдено. Попробуйте другой фильтр.</div>'; return; } content.innerHTML = `<div class="game-grid">${visible.map(gameCard).join('')}</div>`; }
function renderFilters() {
  const values = FILTER_ORDER.filter((value) => value === 'Все' || value === 'На двоих' || games.some((game) => game.system === value));
  filters.innerHTML = values.map((value) => `<button class="filter ${value === activeFilter ? 'active' : ''}" data-filter="${escapeHtml(value)}">${escapeHtml(value)}</button>`).join('');
  filters.querySelectorAll('button').forEach((button) => button.addEventListener('click', () => { activeFilter = button.dataset.filter; renderFilters(); render(); }));
}
async function loadLibrary() {
  try { const response = await fetch('/api/games', { cache:'no-store' }); if (!response.ok) throw new Error(`HTTP ${response.status}`); const data = await response.json(); games = (data.games || []).filter((game) => game.visible !== false); installedCount.textContent = games.filter((game) => game.playable).length; renderFilters(); render(); }
  catch (error) { console.error(error); content.innerHTML = '<div class="loading-card error">Не удалось загрузить каталог игр.</div>'; }
}
search?.addEventListener('input', () => { query = search.value.trim(); render(); });
window.addEventListener('arcade:presence', (event) => { presenceByGame = event.detail?.byGame || {}; playingCount.textContent = event.detail?.playing || 0; render(); });
loadLibrary();
