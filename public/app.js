const content = document.querySelector('#libraryContent');
const filters = document.querySelector('#filters');
const catalogCount = document.querySelector('#catalogCount');
const availableCount = document.querySelector('#availableCount');
const onlineStat = document.querySelector('#onlineStat');
const search = document.querySelector('#search');
const modal = document.querySelector('#gameModal');
const modalTitle = document.querySelector('#modalTitle');
const modalText = document.querySelector('#modalText');
const modalRom = document.querySelector('#modalRom');
const modalBios = document.querySelector('#modalBios');
const modalBiosBox = document.querySelector('#modalBiosBox');
let games = [];
let activeFilter = 'Все';
let query = '';
let presenceByGame = {};

const FILTER_ORDER = ['Все', 'Избранное', 'Mega Drive', 'PlayStation', 'Dreamcast', 'Demo', 'На двоих'];
const SHELVES = [
  ['Избранное', (g) => g.featured && !g.demo],
  ['Mega Drive', (g) => g.system === 'Mega Drive' && !g.demo],
  ['PlayStation', (g) => g.system === 'PlayStation' && !g.demo],
  ['Dreamcast', (g) => g.system === 'Dreamcast' && !g.demo],
  ['Попробовать прямо сейчас', (g) => g.demo]
];

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
}
function isMultiplayer(game) {
  const tags = Array.isArray(game.tags) ? game.tags : [];
  return tags.includes('multiplayer') || /2|3|4|multi|дв|чет/i.test(game.players || '');
}
function matchesQuery(game) {
  if (!query) return true;
  const haystack = [game.title, game.system, game.description, game.year, ...(game.tags || [])].join(' ').toLowerCase();
  return haystack.includes(query.toLowerCase());
}
function filteredGames() {
  let result = games.filter(matchesQuery);
  if (activeFilter === 'Избранное') result = result.filter((g) => g.featured && !g.demo);
  else if (activeFilter === 'Demo') result = result.filter((g) => g.demo);
  else if (activeFilter === 'На двоих') result = result.filter(isMultiplayer);
  else if (activeFilter !== 'Все') result = result.filter((g) => g.system === activeFilter && !g.demo);
  return result.sort((a, b) => (a.sort ?? 9999) - (b.sort ?? 9999) || a.title.localeCompare(b.title));
}
function tagLabel(tag) {
  const labels = { multiplayer: 'на двоих', homebrew: 'homebrew', racing: 'гонки', fighting: 'файтинг', platformer: 'платформер', action: 'экшен', arcade: 'аркада', horror: 'хоррор', strategy: 'стратегия' };
  return labels[tag] || tag;
}
function systemClass(system = '') {
  return system.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'retro';
}
function missingButton(game) {
  if (game.experimental) return `<button class="play-button unavailable-button" type="button" data-missing="${escapeHtml(game.id)}">EXPERIMENTAL</button>`;
  if (game.biosRequired && !game.biosInstalled) return `<button class="play-button unavailable-button" type="button" data-missing="${escapeHtml(game.id)}">! НУЖЕН BIOS</button>`;
  return `<button class="play-button unavailable-button" type="button" data-missing="${escapeHtml(game.id)}">+ ДОБАВИТЬ ROM</button>`;
}
function gameCard(game) {
  const viewers = presenceByGame[game.id] || 0;
  const preview = Array.isArray(game.screenshots) && game.screenshots[0] ? game.screenshots[0] : '';
  const button = game.playable
    ? `<a class="play-button" href="/game.html?id=${encodeURIComponent(game.id)}">▶ ИГРАТЬ</a>`
    : missingButton(game);
  const tags = (game.tags || []).filter((tag) => tag !== 'homebrew').slice(0, 2).map((tag) => `<span>${escapeHtml(tagLabel(tag))}</span>`).join('');
  const cover = game.cover ? `<img src="${escapeHtml(game.cover)}" alt="Обложка ${escapeHtml(game.title)}" loading="lazy" onerror="this.remove()">` : '';
  const badge = game.demo ? 'DEMO' : escapeHtml(game.system);
  return `<article class="game-card ${game.playable ? 'ready' : 'missing'} ${game.demo ? 'demo-card' : ''}">
    <div class="cover-wrap">
      <div class="cover-fallback system-${systemClass(game.system)}"><span>${escapeHtml(game.system)}</span><strong>${escapeHtml(game.title)}</strong><em>${escapeHtml(game.year || 'RETRO')}</em></div>
      <div class="cover-art">${cover}</div>
      ${preview ? `<div class="cover-preview"><img src="${escapeHtml(preview)}" alt="Скриншот ${escapeHtml(game.title)}" loading="lazy" onerror="this.parentElement.remove()"></div>` : ''}
      <div class="cover-shade"></div><span class="platform-badge">${badge}</span>
      ${viewers ? `<span class="playing-badge">● ${viewers} играет</span>` : ''}
      ${game.experimental ? '<span class="experimental-badge">EXPERIMENTAL</span>' : ''}
    </div>
    <div class="game-card-body"><h4>${escapeHtml(game.title)}</h4><p>${escapeHtml(game.year || '')}${game.players ? ` · ${escapeHtml(game.players)}` : ''}</p>${tags ? `<div class="tags">${tags}</div>` : ''}<div class="card-action">${button}</div></div>
  </article>`;
}
function shelf(title, list, id = '') {
  if (!list.length) return '';
  const isDemo = title === 'Попробовать прямо сейчас';
  return `<section class="game-shelf" ${id ? `id="${id}"` : ''}><div class="shelf-heading"><div><p>${isDemo ? 'DEMO / HOMEBREW' : 'КОЛЛЕКЦИЯ'}</p><h3>${escapeHtml(title)}</h3></div>${isDemo ? '<span>Эти игры входят в demo и запускаются сразу.</span>' : ''}</div><div class="game-grid">${list.map(gameCard).join('')}</div></section>`;
}
function render() {
  if (!games.length) return;
  if (activeFilter === 'Все' && !query) {
    content.innerHTML = SHELVES.map(([title, predicate]) => shelf(title, games.filter(predicate).sort((a,b)=>(a.sort??9999)-(b.sort??9999)), title === 'Попробовать прямо сейчас' ? 'demo' : '')).join('');
    return;
  }
  const visible = filteredGames();
  content.innerHTML = visible.length ? `<section class="game-shelf"><div class="shelf-heading"><div><p>РЕЗУЛЬТАТЫ</p><h3>${escapeHtml(activeFilter)}</h3></div><span>${visible.length} ${visible.length === 1 ? 'игра' : 'игр'}</span></div><div class="game-grid">${visible.map(gameCard).join('')}</div></section>` : '<div class="loading-card">Ничего не найдено. Попробуйте другой фильтр.</div>';
}
function renderFilters() {
  filters.innerHTML = FILTER_ORDER.map((value) => `<button class="filter ${value === activeFilter ? 'active' : ''}" data-filter="${escapeHtml(value)}">${escapeHtml(value)}</button>`).join('');
  filters.querySelectorAll('button').forEach((button) => button.addEventListener('click', () => { activeFilter = button.dataset.filter; renderFilters(); render(); }));
}
function openMissing(game) {
  if (!game || !modal) return;
  modalTitle.textContent = game.title;
  if (game.experimental) modalText.textContent = 'Поддержка Dreamcast подготовлена в каталоге, но runtime Flycast WASM пока отмечен как экспериментальный.';
  else if (game.biosRequired && !game.biosInstalled) modalText.textContent = 'ROM найден или ожидается, но для запуска этой системы нужен BIOS.';
  else modalText.textContent = 'Эта игра уже есть в каталоге. Добавьте собственный ROM по указанному пути — карточка автоматически станет доступной для запуска.';
  modalRom.textContent = `games/roms/${game.romExpected || game.rom || ''}`;
  const bios = Array.isArray(game.biosExpected) ? game.biosExpected : [];
  modalBiosBox.hidden = bios.length === 0;
  modalBios.textContent = bios.map((item) => `games/bios/${item}`).join('\n');
  modal.hidden = false;
  document.body.classList.add('modal-open');
  modal.querySelector('.modal-close')?.focus();
}
function closeModal() { if (!modal) return; modal.hidden = true; document.body.classList.remove('modal-open'); }
async function loadLibrary() {
  try {
    const response = await fetch('/api/games', { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    games = (data.games || []).filter((game) => game.visible !== false);
    catalogCount.textContent = games.filter((game) => !game.demo).length;
    availableCount.textContent = games.filter((game) => game.playable).length;
    renderFilters(); render();
  } catch (error) {
    console.error(error); content.innerHTML = '<div class="loading-card error">Не удалось загрузить каталог игр.</div>';
  }
}
search?.addEventListener('input', () => { query = search.value.trim(); render(); });
content?.addEventListener('click', (event) => { const button = event.target.closest('[data-missing]'); if (!button) return; openMissing(games.find((g) => g.id === button.dataset.missing)); });
modal?.addEventListener('click', (event) => { if (event.target.closest('[data-close-modal]')) closeModal(); });
document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && modal && !modal.hidden) closeModal(); });
window.addEventListener('arcade:presence', (event) => { presenceByGame = event.detail?.byGame || {}; if (onlineStat) onlineStat.textContent = event.detail?.online || 0; render(); });
loadLibrary();
