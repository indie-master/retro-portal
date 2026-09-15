const params = new URLSearchParams(location.search);
const gameId = params.get('id');
const title = document.querySelector('#gameTitle');
const system = document.querySelector('#gameSystem');
const notice = document.querySelector('#playerNotice');
const frame = document.querySelector('#gameFrame');
const fullscreenButton = document.querySelector('#fullscreenGame');
const mobileModeButton = document.querySelector('#mobileMode');
const mobileExitButton = document.querySelector('#mobileExit');
const playButton = document.querySelector('#playGame');
const controlsButton = document.querySelector('#controlsOpen');
const gamepadNotice = document.querySelector('#gamepadNotice');
const gamepadStatus = document.querySelector('#gamepadStatus');
const controlsGamepadStatus = document.querySelector('#controlsGamepadStatus');
const controlPreview = document.querySelector('#controlPreview');
const launchGuide = document.querySelector('#launchGuide');
const launchGuideEyebrow = document.querySelector('#launchGuideEyebrow');
const launchGuideTitle = document.querySelector('#launchGuideTitle');
const launchGuideText = document.querySelector('#launchGuideText');
const gameInfo = document.querySelector('#gameInfo');
const gameDescription = document.querySelector('#gameDescription');
const gameHistory = document.querySelector('#gameHistory');
const historyCard = document.querySelector('#historyCard');
const touchLike = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
const MOBILE_DISC_CACHE_LIMIT = 8 * 1024 * 1024;
const DEFAULT_CACHE_LIMIT = 1024 * 1024 * 1024;
let loadedGame = null;
let playRecorded = false;
let runtimeStarted = false;
let nativeFullscreenSeen = false;
let mobileScrollY = 0;

document.body.classList.toggle('touch-device', touchLike);
document.querySelector('#reloadGame')?.addEventListener('click', () => location.reload());

function nativeFullscreenElement() {
  return document.fullscreenElement || document.webkitFullscreenElement || null;
}

function syncMobileViewport() {
  const viewportHeight = Math.round(window.visualViewport?.height || window.innerHeight || 0);
  if (viewportHeight > 0) document.documentElement.style.setProperty('--player-vh', `${viewportHeight}px`);
  document.body.classList.toggle('player-portrait', window.innerHeight > window.innerWidth);
}

syncMobileViewport();
window.addEventListener('resize', syncMobileViewport);
window.addEventListener('orientationchange', syncMobileViewport);
window.visualViewport?.addEventListener('resize', syncMobileViewport);

async function lockLandscape() {
  if (!touchLike) return;
  try {
    if (screen.orientation?.lock) await screen.orientation.lock('landscape');
  } catch {}
}

function unlockOrientation() {
  try { screen.orientation?.unlock?.(); } catch {}
}

async function enterNativeFullscreen() {
  if (nativeFullscreenElement()) return;
  try {
    if (frame.requestFullscreen) await frame.requestFullscreen({ navigationUI: 'hide' });
    else if (frame.webkitRequestFullscreen) frame.webkitRequestFullscreen();
  } catch (error) {
    console.info('Native fullscreen unavailable; using the mobile player overlay.', error?.message || error);
  }
}

async function exitNativeFullscreen() {
  if (!nativeFullscreenElement()) return;
  try {
    if (document.exitFullscreen) await document.exitFullscreen();
    else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
  } catch {}
}

function setMobilePlaying(active) {
  if (active && !document.body.classList.contains('mobile-playing')) mobileScrollY = window.scrollY || 0;
  document.body.classList.toggle('mobile-playing', active);
  syncMobileViewport();
  if (mobileModeButton) mobileModeButton.textContent = active ? '⤢ ВЕРНУТЬСЯ НА СТРАНИЦУ' : '▰ МОБИЛЬНЫЙ РЕЖИМ';
  if (!active) {
    unlockOrientation();
    try { window.scrollTo(0, mobileScrollY); } catch {}
  }
}

async function enterMobileMode() {
  setMobilePlaying(true);
  await enterNativeFullscreen();
  await lockLandscape();
  syncMobileViewport();
}

async function exitMobileMode() {
  await exitNativeFullscreen();
  setMobilePlaying(false);
}

async function toggleDesktopFullscreen() {
  if (nativeFullscreenElement()) await exitNativeFullscreen();
  else {
    await enterNativeFullscreen();
    await lockLandscape();
  }
}

function syncFullscreenButton() {
  const fullscreen = Boolean(nativeFullscreenElement());
  if (fullscreenButton) fullscreenButton.textContent = fullscreen ? '⤢ ВЫЙТИ ИЗ ЭКРАНА' : '⛶ ПОЛНЫЙ ЭКРАН';
  document.body.classList.toggle('player-fullscreen', fullscreen);
  if (fullscreen) lockLandscape();
  else if (!document.body.classList.contains('mobile-playing')) unlockOrientation();

  if (!fullscreen && nativeFullscreenSeen && document.body.classList.contains('mobile-playing')) setMobilePlaying(false);
  nativeFullscreenSeen = fullscreen;
}

document.addEventListener('fullscreenchange', syncFullscreenButton);
document.addEventListener('webkitfullscreenchange', syncFullscreenButton);

function formatBytes(value) {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes <= 0) return '';
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} ГБ`;
  return `${Math.round(bytes / 1024 ** 2)} МБ`;
}

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

function showError(message, retry = false) {
  notice.hidden = false;
  notice.classList.add('error');
  notice.textContent = message;
  launchGuide?.classList.remove('hidden');
  launchGuide?.classList.add('error');
  if (launchGuideEyebrow) launchGuideEyebrow.textContent = 'ОШИБКА ЗАПУСКА';
  if (launchGuideTitle) launchGuideTitle.textContent = 'Игра не запустилась';
  if (launchGuideText) launchGuideText.textContent = message;
  if (playButton) {
    playButton.disabled = !retry;
    playButton.textContent = retry ? '↻ ПОВТОРИТЬ' : 'НЕДОСТУПНО';
  }
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

function prepareMobileLaunch(game) {
  const size = formatBytes(game.romBytes);
  const sizeText = size ? `Размер образа: ${size}. ` : '';
  launchGuide?.classList.remove('error', 'hidden');
  if (launchGuideEyebrow) launchGuideEyebrow.textContent = isPlayStation(game) ? 'PLAYSTATION · МОБИЛЬНЫЙ ЗАПУСК' : 'МОБИЛЬНЫЙ ЗАПУСК';
  if (launchGuideTitle) launchGuideTitle.textContent = 'Поверните телефон';
  if (launchGuideText) launchGuideText.textContent = `${sizeText}После нажатия игра откроется поверх страницы и только тогда начнётся загрузка.`;
  if (playButton) {
    playButton.disabled = false;
    playButton.textContent = '▶ ИГРАТЬ В МОБИЛЬНОМ РЕЖИМЕ';
  }
  if (mobileModeButton) mobileModeButton.disabled = false;
  notice.classList.remove('error');
  notice.textContent = 'ROM пока не загружается. Поверните телефон горизонтально и нажмите «Мобильный режим».';
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
  notice.textContent = touchLike ? 'Эмулятор готов. Загружаем игровые данные…' : 'Эмулятор готов к запуску.';
}

function onGameStart() {
  launchGuide?.classList.add('hidden');
  notice.hidden = true;
  if (loadedGame) recordPlay(loadedGame);
}

function configureEmulator(game) {
  const memoryConstrainedDisc = touchLike && isPlayStation(game);
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
  window.EJS_browserMode = touchLike ? 'mobile' : 'desktop';
  window.EJS_threads = Boolean(window.crossOriginIsolated) && !memoryConstrainedDisc;
  window.EJS_CacheLimit = memoryConstrainedDisc ? MOBILE_DISC_CACHE_LIMIT : DEFAULT_CACHE_LIMIT;
  window.EJS_VirtualGamepadSettings = touchLike && isPlayStation(game) ? playStationVirtualGamepad() : undefined;
  window.EJS_fixedSaveInterval = 15000;
  window.EJS_color = '#d99a47';
  window.EJS_backgroundColor = '#05070a';
  window.EJS_Buttons = touchLike
    ? { fullscreen: false, screenRecord: false, exitEmulation: false }
    : { exitEmulation: false };
  window.EJS_ready = onEmulatorReady;
  window.EJS_onGameStart = onGameStart;
}

function startEmulator(game) {
  if (!game || runtimeStarted) return;
  runtimeStarted = true;
  configureEmulator(game);
  window.RetroPresence?.playing(game.id);
  launchGuide?.classList.add('hidden');
  notice.hidden = false;
  notice.classList.remove('error');
  notice.textContent = isPlayStation(game)
    ? 'Загружаем образ PlayStation. Не закрывайте вкладку до появления игры.'
    : 'Загружаем игру…';

  const script = document.createElement('script');
  script.src = '/emulatorjs/data/loader.js';
  script.async = true;
  script.onerror = () => {
    script.remove();
    runtimeStarted = false;
    showError('Не удалось загрузить runtime эмулятора. Проверьте соединение и повторите запуск.', true);
  };
  document.body.appendChild(script);
}

async function startMobilePlay() {
  if (!loadedGame) return;
  await enterMobileMode();
  startEmulator(loadedGame);
}

fullscreenButton?.addEventListener('click', () => {
  if (touchLike) {
    if (document.body.classList.contains('mobile-playing')) exitMobileMode();
    else startMobilePlay();
  } else toggleDesktopFullscreen();
});
mobileModeButton?.addEventListener('click', () => {
  if (document.body.classList.contains('mobile-playing')) exitMobileMode();
  else startMobilePlay();
});
playButton?.addEventListener('click', startMobilePlay);
mobileExitButton?.addEventListener('click', exitMobileMode);
controlsButton?.addEventListener('click', () => loadedGame && window.RetroControls?.open(loadedGame));

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

    if (touchLike) prepareMobileLaunch(game);
    else {
      if (launchGuideEyebrow) launchGuideEyebrow.textContent = 'ЗАПУСК ИГРЫ';
      if (launchGuideTitle) launchGuideTitle.textContent = `Загружаем ${game.title}`;
      if (launchGuideText) launchGuideText.textContent = 'Игровые данные загружаются. Управление можно открыть над игровым полем.';
      startEmulator(game);
    }
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
