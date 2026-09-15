const params = new URLSearchParams(location.search);
const gameId = params.get('id');
const title = document.querySelector('#gameTitle');
const system = document.querySelector('#gameSystem');
const notice = document.querySelector('#playerNotice');
const frame = document.querySelector('#gameFrame');
const fullscreenButton = document.querySelector('#fullscreenGame');
const mobileModeButton = document.querySelector('#mobileMode');
const controlsButton = document.querySelector('#controlsOpen');
const gamepadNotice = document.querySelector('#gamepadNotice');
const gameInfo = document.querySelector('#gameInfo');
const gameDescription = document.querySelector('#gameDescription');
const gameHistory = document.querySelector('#gameHistory');
const historyCard = document.querySelector('#historyCard');
const touchLike = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
let loadedGame = null;

document.body.classList.toggle('touch-device', touchLike);
document.querySelector('#reloadGame')?.addEventListener('click', () => location.reload());

async function lockLandscape() {
  try {
    if (screen.orientation?.lock) await screen.orientation.lock('landscape');
  } catch (error) {
    console.debug('Orientation lock unavailable', error?.message || error);
  }
}

function unlockOrientation() {
  try { screen.orientation?.unlock?.(); } catch {}
}

async function requestGameFullscreen() {
  try {
    if (!document.fullscreenElement) {
      if (frame.requestFullscreen) await frame.requestFullscreen({ navigationUI: 'hide' });
      else if (frame.webkitRequestFullscreen) frame.webkitRequestFullscreen();
    } else if (document.exitFullscreen) await document.exitFullscreen();
  } catch (error) {
    console.warn('Fullscreen unavailable', error);
  }
}

fullscreenButton?.addEventListener('click', requestGameFullscreen);
mobileModeButton?.addEventListener('click', async () => {
  document.body.classList.add('mobile-playing');
  await requestGameFullscreen();
  await lockLandscape();
  try { frame.scrollIntoView({ block: 'start', behavior: 'instant' }); } catch { frame.scrollIntoView(); }
});
controlsButton?.addEventListener('click', () => loadedGame && window.RetroControls?.open(loadedGame));

document.addEventListener('fullscreenchange', () => {
  const fullscreen = Boolean(document.fullscreenElement);
  if (fullscreenButton) fullscreenButton.textContent = fullscreen ? '⤢ ВЫЙТИ ИЗ ЭКРАНА' : '⛶ ПОЛНЫЙ ЭКРАН';
  if (mobileModeButton) mobileModeButton.textContent = fullscreen ? '⤢ ВЫЙТИ ИЗ ЭКРАНА' : '▰ МОБИЛЬНЫЙ РЕЖИМ';
  if (!fullscreen) {
    document.body.classList.remove('mobile-playing');
    unlockOrientation();
  }
});

function showError(message) {
  notice.classList.add('error');
  notice.textContent = message;
}
function showGamepad(event) {
  if (!gamepadNotice) return;
  const name = event?.gamepad?.id ? ` · ${event.gamepad.id.slice(0, 80)}` : '';
  gamepadNotice.textContent = `🎮 Геймпад подключён${name}`;
  gamepadNotice.hidden = false;
  clearTimeout(showGamepad.timer);
  showGamepad.timer = setTimeout(() => { gamepadNotice.hidden = true; }, 3200);
}
window.addEventListener('gamepadconnected', showGamepad);

function renderInfo(game) {
  const description = String(game.description || '').trim();
  const history = String(game.history || '').trim();
  if (!description && !history) return;
  gameInfo.hidden = false;
  if (description) gameDescription.textContent = description;
  else gameDescription.closest('article').hidden = true;
  if (history) gameHistory.textContent = history;
  else historyCard.hidden = true;
}

async function recordPlay(game) {
  try {
    await fetch(`/api/play/${encodeURIComponent(game.id)}`, {
      method: 'POST',
      headers: { 'X-Session-ID': window.RetroPresence?.sessionId || '' },
      keepalive: true
    });
  } catch {}
}

async function boot() {
  if (!gameId) return showError('Не выбрана игра. Вернитесь в библиотеку и выберите карточку.');
  try {
    const response = await fetch(`/api/games/${encodeURIComponent(gameId)}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(response.status === 404 ? 'Игра сейчас недоступна.' : `Ошибка каталога: ${response.status}`);
    const { game } = await response.json();
    loadedGame = game;
    title.textContent = game.title;
    document.title = `${game.title} · Retro Portal`;
    system.textContent = `${game.system}${game.year ? ` · ${game.year}` : ''}${game.players ? ` · ${game.players}` : ''}`;
    renderInfo(game);

    if (game.experimental) return showError('Эта система пока работает в экспериментальном режиме и не опубликована для обычного запуска.');

    window.RetroPresence?.playing(game.id);
    window.EJS_player = '#game';
    window.EJS_core = game.core;
    window.EJS_controlScheme = game.controlScheme || game.core;
    window.EJS_defaultControls = window.RetroControls?.getEJSControls(game);
    window.EJS_gameName = game.title;
    window.EJS_gameID = Number(game.gameId);
    window.EJS_gameUrl = game.romUrl;
    window.EJS_biosUrl = game.biosUrl || '';
    window.EJS_pathtodata = '/emulatorjs/data/';
    window.EJS_startOnLoaded = true;
    window.EJS_fullscreenOnLoaded = false;
    window.EJS_language = 'ru-RU';
    window.EJS_disableAutoLang = true;
    window.EJS_threads = Boolean(window.crossOriginIsolated);
    window.EJS_fixedSaveInterval = 15000;
    window.EJS_color = '#d99a47';
    window.EJS_backgroundColor = '#05070a';
    window.EJS_Buttons = { exitEmulation: false };

    notice.textContent = touchLike
      ? 'Готово. На сенсорном экране EmulatorJS покажет виртуальный геймпад. Для игры поверните телефон и нажмите «Мобильный режим».'
      : 'Готово. Стрелки — движение, Z/X — основные действия. «Клавиши» открывает полную настройку.';
    const script = document.createElement('script');
    script.src = '/emulatorjs/data/loader.js';
    script.async = true;
    script.onload = () => recordPlay(game);
    script.onerror = () => showError('Эмулятор не установлен на сервере. Обратитесь к владельцу портала.');
    document.body.appendChild(script);
  } catch (error) {
    console.error(error);
    showError(error.message || 'Не удалось запустить игру.');
  }
}

window.addEventListener('beforeunload', () => {
  window.RetroPresence?.idle();
  unlockOrientation();
});
boot();
