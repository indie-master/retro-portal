const params = new URLSearchParams(location.search);
const gameId = params.get('id');
const title = document.querySelector('#gameTitle');
const system = document.querySelector('#gameSystem');
const notice = document.querySelector('#playerNotice');
const frame = document.querySelector('#gameFrame');
const fullscreenButton = document.querySelector('#fullscreenGame');
const controlsButton = document.querySelector('#controlsOpen');
const gamepadNotice = document.querySelector('#gamepadNotice');
const gamepadStatus = document.querySelector('#gamepadStatus');
const controlsGamepadStatus = document.querySelector('#controlsGamepadStatus');
const controlPreview = document.querySelector('#controlPreview');
const launchGuide = document.querySelector('#launchGuide');
const gameInfo = document.querySelector('#gameInfo');
const gameDescription = document.querySelector('#gameDescription');
const gameHistory = document.querySelector('#gameHistory');
const historyCard = document.querySelector('#historyCard');
const touchLike = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
let loadedGame = null;
let playRecorded = false;

document.body.classList.toggle('touch-device', touchLike);
document.querySelector('#reloadGame')?.addEventListener('click', () => location.reload());

async function lockLandscape() {
  if (!touchLike) return;
  try {
    if (screen.orientation?.lock) await screen.orientation.lock('landscape');
  } catch {}
}

function unlockOrientation() {
  try { screen.orientation?.unlock?.(); } catch {}
}

async function requestGameFullscreen() {
  try {
    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
      if (frame.requestFullscreen) await frame.requestFullscreen({ navigationUI: 'hide' });
      else if (frame.webkitRequestFullscreen) frame.webkitRequestFullscreen();
      await lockLandscape();
    } else if (document.exitFullscreen) await document.exitFullscreen();
    else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
  } catch (error) {
    console.warn('Fullscreen unavailable', error);
  }
}

fullscreenButton?.addEventListener('click', requestGameFullscreen);
controlsButton?.addEventListener('click', () => loadedGame && window.RetroControls?.open(loadedGame));

function syncFullscreenButton() {
  const fullscreen = Boolean(document.fullscreenElement || document.webkitFullscreenElement);
  if (fullscreenButton) fullscreenButton.textContent = fullscreen ? '⤢ ВЫЙТИ ИЗ ЭКРАНА' : '⛶ ПОЛНЫЙ ЭКРАН';
  document.body.classList.toggle('player-fullscreen', fullscreen);
  if (fullscreen) lockLandscape(); else unlockOrientation();
}
document.addEventListener('fullscreenchange', syncFullscreenButton);
document.addEventListener('webkitfullscreenchange', syncFullscreenButton);

function showError(message) {
  notice.hidden = false;
  notice.classList.add('error');
  notice.textContent = message;
  launchGuide?.classList.add('error');
}

function connectedGamepads() {
  try { return [...(navigator.getGamepads?.() || [])].filter(Boolean); } catch { return []; }
}

function updateGamepadStatus(gamepad = connectedGamepads()[0] || null) {
  const text = gamepad
    ? `Подключён: ${String(gamepad.id || 'Gamepad').slice(0, 90)}`
    : 'Подключите USB/Bluetooth-геймпад и нажмите любую кнопку — браузер определит его автоматически.';
  if (gamepadStatus) gamepadStatus.textContent = text;
  if (controlsGamepadStatus) controlsGamepadStatus.textContent = text;
  return Boolean(gamepad);
}

function showGamepad(event) {
  const gamepad = event?.gamepad || connectedGamepads()[0] || null;
  updateGamepadStatus(gamepad);
  if (!gamepadNotice || !gamepad) return;
  gamepadNotice.textContent = `🎮 Геймпад подключён · ${String(gamepad.id || 'Gamepad').slice(0, 80)}`;
  gamepadNotice.hidden = false;
  clearTimeout(showGamepad.timer);
  showGamepad.timer = setTimeout(() => { gamepadNotice.hidden = true; }, 3200);
}
window.addEventListener('gamepadconnected', showGamepad);
window.addEventListener('gamepaddisconnected', () => updateGamepadStatus());
window.addEventListener('focus', () => updateGamepadStatus());

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

function renderControlPreview(game) {
  if (!controlPreview) return;
  const items = window.RetroControls?.preview?.(game) || [];
  controlPreview.innerHTML = items.map((item) => `<span><b>${item.action}</b><kbd>${item.key}</kbd></span>`).join('');
}

async function recordPlay(game) {
  if (playRecorded) return;
  playRecorded = true;
  try {
    await fetch(`/api/play/${encodeURIComponent(game.id)}`, {
      method: 'POST',
      headers: { 'X-Session-ID': window.RetroPresence?.sessionId || '' },
      keepalive: true
    });
  } catch {}
}

function onEmulatorReady() {
  notice.classList.remove('error');
  notice.textContent = touchLike ? 'Готово к запуску. Сенсорное управление появится в игровом поле.' : 'Готово к запуску.';
}

function onGameStart() {
  launchGuide?.classList.add('hidden');
  notice.hidden = true;
  if (loadedGame) recordPlay(loadedGame);
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
    renderControlPreview(game);
    updateGamepadStatus();

    if (game.experimental) return showError('Эта система пока проходит проверку совместимости с браузерным runtime и временно не опубликована для запуска.');

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
    window.EJS_ready = onEmulatorReady;
    window.EJS_onGameStart = onGameStart;

    notice.textContent = game.system === 'PlayStation'
      ? 'Загружаем образ PlayStation. CHD/PBP обычно стартуют быстрее и экономят трафик.'
      : 'Загружаем игру…';
    const script = document.createElement('script');
    script.src = '/emulatorjs/data/loader.js';
    script.async = true;
    script.onerror = () => showError('Не удалось загрузить runtime эмулятора. Обновите страницу или обратитесь к владельцу портала.');
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
