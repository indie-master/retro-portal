const id = new URLSearchParams(location.search).get('id');
const $ = (selector) => document.querySelector(selector);
const title = $('#gameTitle');
const system = $('#gameSystem');
const notice = $('#playerNotice');
const frame = $('#gameFrame');
const launchGuide = $('#launchGuide');
const launchGuideEyebrow = $('#launchGuideEyebrow');
const launchGuideTitle = $('#launchGuideTitle');
const launchGuideText = $('#launchGuideText');
const playButton = $('#playGame');
const mobileModeButton = $('#mobileMode');
const mobileExitButton = $('#mobileExit');
const fullscreenButton = $('#fullscreenGame');
const controlsButton = $('#controlsOpen');
const touchLike = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
let game = null;
let runtimeStarted = false;
let nativeFullscreenSeen = false;
let scrollYBeforePlay = 0;

document.body.classList.toggle('touch-device', touchLike);
$('#reloadGame')?.addEventListener('click', () => location.reload());

function fullscreenElement() {
  return document.fullscreenElement || document.webkitFullscreenElement || null;
}

function syncViewport() {
  const height = Math.round(window.visualViewport?.height || window.innerHeight || 0);
  if (height > 0) document.documentElement.style.setProperty('--player-vh', `${height}px`);
  document.body.classList.toggle('player-portrait', window.innerHeight > window.innerWidth);
}

syncViewport();
window.addEventListener('resize', syncViewport);
window.addEventListener('orientationchange', syncViewport);
window.visualViewport?.addEventListener('resize', syncViewport);

async function enterNativeFullscreen() {
  if (fullscreenElement()) return;
  try {
    if (frame.requestFullscreen) await frame.requestFullscreen({ navigationUI: 'hide' });
    else if (frame.webkitRequestFullscreen) frame.webkitRequestFullscreen();
  } catch {}
}

async function exitNativeFullscreen() {
  try {
    if (document.exitFullscreen && fullscreenElement()) await document.exitFullscreen();
    else if (document.webkitExitFullscreen && fullscreenElement()) document.webkitExitFullscreen();
  } catch {}
}

async function lockLandscape() {
  if (!touchLike) return;
  try { await screen.orientation?.lock?.('landscape'); } catch {}
}

function leaveMobileMode() {
  document.body.classList.remove('mobile-playing');
  try { screen.orientation?.unlock?.(); } catch {}
  try { window.scrollTo(0, scrollYBeforePlay); } catch {}
  if (mobileModeButton) mobileModeButton.textContent = '▰ МОБИЛЬНЫЙ РЕЖИМ';
}

async function enterMobileMode() {
  if (!document.body.classList.contains('mobile-playing')) scrollYBeforePlay = window.scrollY || 0;
  document.body.classList.add('mobile-playing');
  if (mobileModeButton) mobileModeButton.textContent = '⤢ ВЕРНУТЬСЯ НА СТРАНИЦУ';
  syncViewport();
  await enterNativeFullscreen();
  await lockLandscape();
}

async function exitMobileMode() {
  await exitNativeFullscreen();
  leaveMobileMode();
}

function syncFullscreen() {
  const fullscreen = Boolean(fullscreenElement());
  if (fullscreenButton) fullscreenButton.textContent = fullscreen ? '⤢ ВЫЙТИ ИЗ ЭКРАНА' : '⛶ ПОЛНЫЙ ЭКРАН';
  document.body.classList.toggle('player-fullscreen', fullscreen);
  if (!fullscreen && nativeFullscreenSeen && document.body.classList.contains('mobile-playing')) leaveMobileMode();
  nativeFullscreenSeen = fullscreen;
}

document.addEventListener('fullscreenchange', syncFullscreen);
document.addEventListener('webkitfullscreenchange', syncFullscreen);

function fail(message) {
  notice.hidden = false;
  notice.textContent = message;
  notice.classList.add('error');
  launchGuide?.classList.remove('hidden');
  launchGuide?.classList.add('error');
  if (launchGuideEyebrow) launchGuideEyebrow.textContent = 'ОШИБКА ЗАПУСКА';
  if (launchGuideTitle) launchGuideTitle.textContent = 'Игра не запустилась';
  if (launchGuideText) launchGuideText.textContent = message;
}

function renderInfo(item) {
  const description = String(item.description || '').trim();
  const history = String(item.history || '').trim();
  if (!description && !history) return;
  $('#gameInfo').hidden = false;
  if (description) $('#gameDescription').textContent = description;
  else $('#gameDescription').closest('article').hidden = true;
  if (history) $('#gameHistory').textContent = history;
  else $('#historyCard').hidden = true;
}

function numericGameId(item) {
  const configured = Number(item.gameId);
  if (Number.isSafeInteger(configured) && configured > 0) return configured;
  let hash = 2166136261;
  for (const char of String(item.id || item.title || 'retro-portal')) {
    hash ^= char.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) || 1;
}

function isPlayStation(item) {
  return item.system === 'PlayStation' || item.core === 'psx' || item.core === 'pcsx_rearmed';
}

function psxTouchControls() {
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

function startRuntime() {
  if (!game || runtimeStarted) return;
  runtimeStarted = true;
  window.EJS_player = '#game';
  window.EJS_core = game.core;
  window.EJS_controlScheme = game.controlScheme || game.core;
  window.EJS_defaultControls = window.RetroControls?.getEJSControls(game);
  window.EJS_gameName = game.title;
  window.EJS_gameID = numericGameId(game);
  window.EJS_gameUrl = game.romUrl;
  window.EJS_biosUrl = game.biosUrl || '';
  window.EJS_pathtodata = 'https://cdn.emulatorjs.org/stable/data/';
  window.EJS_startOnLoaded = true;
  window.EJS_fullscreenOnLoaded = false;
  window.EJS_language = 'ru-RU';
  window.EJS_disableAutoLang = true;
  window.EJS_browserMode = touchLike ? 'mobile' : 'desktop';
  window.EJS_threads = false;
  window.EJS_CacheLimit = touchLike && isPlayStation(game) ? 8 * 1024 * 1024 : 1024 * 1024 * 1024;
  window.EJS_VirtualGamepadSettings = touchLike && isPlayStation(game) ? psxTouchControls() : undefined;
  window.EJS_color = '#d99a47';
  window.EJS_backgroundColor = '#05070a';
  window.EJS_Buttons = touchLike ? { fullscreen: false, screenRecord: false, exitEmulation: false } : { exitEmulation: false };
  window.EJS_onGameStart = () => { launchGuide?.classList.add('hidden'); notice.hidden = true; };
  launchGuide?.classList.add('hidden');
  notice.textContent = isPlayStation(game) ? 'Загружаем образ PlayStation…' : 'Загружаем игру…';
  const script = document.createElement('script');
  script.src = 'https://cdn.emulatorjs.org/stable/data/loader.js';
  script.onerror = () => { runtimeStarted = false; fail('Не удалось загрузить EmulatorJS CDN.'); };
  document.body.appendChild(script);
}

async function startMobilePlay() {
  if (!game) return;
  await enterMobileMode();
  startRuntime();
}

playButton?.addEventListener('click', startMobilePlay);
mobileModeButton?.addEventListener('click', () => document.body.classList.contains('mobile-playing') ? exitMobileMode() : startMobilePlay());
mobileExitButton?.addEventListener('click', exitMobileMode);
fullscreenButton?.addEventListener('click', () => {
  if (touchLike) return document.body.classList.contains('mobile-playing') ? exitMobileMode() : startMobilePlay();
  return fullscreenElement() ? exitNativeFullscreen() : enterNativeFullscreen();
});
controlsButton?.addEventListener('click', () => game && window.RetroControls?.open(game));

fetch('catalog.json', { cache: 'no-store' })
  .then((response) => response.json())
  .then(({ games }) => {
    game = (games || []).find((item) => item.id === id);
    if (!game) return fail('Игра не найдена в demo-каталоге.');
    title.textContent = game.title;
    document.title = `${game.title} · Retro Portal`;
    system.textContent = `${game.system}${game.year ? ` · ${game.year}` : ''}${game.players ? ` · ${game.players}` : ''}`;
    renderInfo(game);
    $('#controlPreview').innerHTML = (window.RetroControls?.preview?.(game) || []).map((item) => `<span><b>${item.action}</b><kbd>${item.key}</kbd></span>`).join('');
    if (!game.playable) return fail('Эта игра недоступна в demo.');
    if (touchLike) {
      launchGuideEyebrow.textContent = 'МОБИЛЬНЫЙ ЗАПУСК';
      launchGuideTitle.textContent = 'Поверните телефон';
      launchGuideText.textContent = 'После нажатия игра откроется поверх страницы и только тогда начнётся загрузка.';
      playButton.disabled = false;
      playButton.textContent = '▶ ИГРАТЬ В МОБИЛЬНОМ РЕЖИМЕ';
      mobileModeButton.disabled = false;
      notice.textContent = 'ROM пока не загружается. Поверните телефон и нажмите «Мобильный режим».';
    } else startRuntime();
  })
  .catch(() => fail('Не удалось загрузить demo-каталог.'));

window.addEventListener('beforeunload', () => {
  try { screen.orientation?.unlock?.(); } catch {}
});
