const params = new URLSearchParams(location.search);
const gameId = params.get('id');
const title = document.querySelector('#gameTitle');
const system = document.querySelector('#gameSystem');
const notice = document.querySelector('#playerNotice');
const frame = document.querySelector('#gameFrame');
const fullscreenButton = document.querySelector('#fullscreenGame');
const controlsButton = document.querySelector('#controlsOpen');
const gamepadNotice = document.querySelector('#gamepadNotice');
const controlsGamepadStatus = document.querySelector('#controlsGamepadStatus');
const gameInfo = document.querySelector('#gameInfo');
const gameDescription = document.querySelector('#gameDescription');
const gameHistory = document.querySelector('#gameHistory');
const historyCard = document.querySelector('#historyCard');
const touchLike = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
const MOBILE_DISC_CACHE_LIMIT = 0;
const DEFAULT_CACHE_LIMIT = 1024 * 1024 * 1024;
let loadedGame = null;
let playRecorded = false;
let runtimeStarted = false;

document.body.classList.toggle('touch-device', touchLike);
document.querySelector('#reloadGame')?.addEventListener('click', () => location.reload());

function fullscreenElement() {
  return document.fullscreenElement || document.webkitFullscreenElement || null;
}

async function lockLandscape() {
  if (!touchLike) return;
  try { await screen.orientation?.lock?.('landscape'); } catch {}
}

function unlockOrientation() {
  try { screen.orientation?.unlock?.(); } catch {}
}

function setFallbackFullscreen(active) {
  document.body.classList.toggle('player-fullscreen-fallback', active);
  syncFullscreenButton();
  if (active) lockLandscape();
  else unlockOrientation();
}

async function toggleFullscreen() {
  if (document.body.classList.contains('player-fullscreen-fallback')) {
    setFallbackFullscreen(false);
    return;
  }
  if (fullscreenElement()) {
    try {
      if (document.exitFullscreen) await document.exitFullscreen();
      else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
    } catch {}
    return;
  }
  try {
    if (frame.requestFullscreen) await frame.requestFullscreen({ navigationUI: 'hide' });
    else if (frame.webkitRequestFullscreen) {
      const request = frame.webkitRequestFullscreen();
      if (request?.then) await request;
      await new Promise((resolve) => setTimeout(resolve, 80));
      if (!fullscreenElement()) throw new Error('WebKit fullscreen request was ignored');
    }
    else throw new Error('Fullscreen API unavailable');
    await lockLandscape();
  } catch (error) {
    console.info('Native fullscreen unavailable; using viewport fallback.', error?.message || error);
    setFallbackFullscreen(true);
  }
}

function syncFullscreenButton() {
  const active = Boolean(fullscreenElement()) || document.body.classList.contains('player-fullscreen-fallback');
  if (fullscreenButton) fullscreenButton.textContent = active ? '⤢ ВЫЙТИ ИЗ ЭКРАНА' : '⛶ ПОЛНЫЙ ЭКРАН';
  document.body.classList.toggle('player-fullscreen', active);
  if (!active) unlockOrientation();
}

fullscreenButton?.addEventListener('click', toggleFullscreen);
controlsButton?.addEventListener('click', () => loadedGame && window.RetroControls?.open(loadedGame));
window.addEventListener('retro:emulator-error', () => {
  runtimeStarted = false;
  showError('Не удалось загрузить эмулятор. Обновите страницу и попробуйте ещё раз.');
});
document.addEventListener('fullscreenchange', syncFullscreenButton);
document.addEventListener('webkitfullscreenchange', syncFullscreenButton);
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && document.body.classList.contains('player-fullscreen-fallback')) setFallbackFullscreen(false);
});

function stableNumericGameId(game) {
  const configured = Number(game.gameId);
  if (Number.isSafeInteger(configured) && configured > 0) return configured;
  let hash = 2166136261;
  for (const char of String(game.id || game.title || 'retro-portal')) {
    hash ^= char.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) || 1;
}

function isPlayStation(game) {
  return game.system === 'PlayStation' || game.core === 'psx' || game.core === 'pcsx_rearmed';
}

function supportsMobileDiscStream(game) {
  const format = String(game.romFormat || game.romUrl?.split('.').pop() || '').toLowerCase();
  return touchLike && isPlayStation(game) && ['chd', 'pbp'].includes(format);
}

function playStationVirtualGamepad() {
  return [
    { type: 'button', text: '△', id: 'triangle', location: 'right', left: 40, bold: true, input_value: 9 },
    { type: 'button', text: '□', id: 'square', location: 'right', left: 1, top: 40, bold: true, input_value: 1 },
    { type: 'button', text: '○', id: 'circle', location: 'right', left: 81, top: 40, bold: true, input_value: 8 },
    { type: 'button', text: '✕', id: 'cross', location: 'right', left: 40, top: 80, bold: true, input_value: 0 },
    { type: 'dpad', id: 'dpad', location: 'left', left: '50%', right: '50%', joystickInput: false, inputValues: [4, 5, 6, 7] },
    { type: 'button', text: 'L2', id: 'l2', location: 'top', left: 8, top: 4, fontSize: 13, block: true, input_value: 12 },
    { type: 'button', text: 'L1', id: 'l1', location: 'top', left: 74, top: 4, fontSize: 13, block: true, input_value: 10 },
    { type: 'button', text: 'R1', id: 'r1', location: 'top', right: 74, top: 4, fontSize: 13, block: true, input_value: 11 },
    { type: 'button', text: 'R2', id: 'r2', location: 'top', right: 8, top: 4, fontSize: 13, block: true, input_value: 13 },
    { type: 'button', text: 'Select', id: 'select', location: 'center', left: -5, fontSize: 13, block: true, input_value: 2 },
    { type: 'button', text: 'Start', id: 'start', location: 'center', left: 60, fontSize: 13, block: true, input_value: 3 }
  ];
}

function showError(message) {
  if (!notice) return;
  notice.hidden = false;
  notice.classList.add('error');
  notice.textContent = message;
}

function connectedGamepads() {
  try { return [...(navigator.getGamepads?.() || [])].filter(Boolean); } catch { return []; }
}

function updateGamepadStatus(gamepad = connectedGamepads()[0] || null) {
  if (!controlsGamepadStatus) return;
  controlsGamepadStatus.textContent = gamepad
    ? `Подключён: ${String(gamepad.id || 'Gamepad').slice(0, 90)}`
    : 'Подключите USB/Bluetooth-геймпад и нажмите любую кнопку — браузер определит его автоматически.';
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

function configureEmulator(game) {
  const mobilePlayStation = touchLike && isPlayStation(game);
  const mobileDiscStream = supportsMobileDiscStream(game);
  window.EJS_player = '#game';
  window.EJS_core = game.core;
  window.EJS_controlScheme = game.controlScheme || game.core;
  window.EJS_defaultControls = window.RetroControls?.getEJSControls(game);
  window.EJS_gameName = game.title;
  window.EJS_gameID = stableNumericGameId(game);
  window.EJS_gameUrl = game.romUrl;
  window.EJS_biosUrl = game.biosUrl || '';
  window.EJS_pathtodata = '/emulatorjs/data/';
  window.EJS_startOnLoaded = true;
  window.EJS_fullscreenOnLoaded = false;
  window.EJS_language = 'ru-RU';
  window.EJS_disableAutoLang = true;
  window.EJS_threads = Boolean(window.crossOriginIsolated) && !mobilePlayStation;
  window.EJS_CacheLimit = mobilePlayStation ? MOBILE_DISC_CACHE_LIMIT : DEFAULT_CACHE_LIMIT;
  window.EJS_mobileDiscStream = mobileDiscStream;
  window.EJS_VirtualGamepadSettings = mobilePlayStation ? playStationVirtualGamepad() : undefined;
  window.EJS_fixedSaveInterval = 15000;
  window.EJS_color = '#d99a47';
  window.EJS_backgroundColor = '#05070a';
  window.EJS_Buttons = touchLike
    ? { fullscreen: false, screenRecord: false, exitEmulation: false }
    : { exitEmulation: false };
  window.EJS_onGameStart = () => {
    if (notice) notice.hidden = true;
    recordPlay(game);
  };
}

function startEmulator(game) {
  if (!game || runtimeStarted) return;
  runtimeStarted = true;
  configureEmulator(game);
  window.RetroPresence?.playing(game.id);
  const script = document.createElement('script');
  script.src = window.EJS_mobileDiscStream ? '/emulatorjs-mobile-loader.js' : '/emulatorjs/data/loader.js';
  script.async = true;
  script.onerror = () => {
    script.remove();
    runtimeStarted = false;
    showError('Не удалось загрузить эмулятор. Обновите страницу и попробуйте ещё раз.');
  };
  document.body.appendChild(script);
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
    updateGamepadStatus();
    if (game.experimental) return showError('Эта система пока работает в экспериментальном режиме.');
    startEmulator(game);
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
