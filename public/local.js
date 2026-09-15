const rom = document.querySelector('#rom');
const core = document.querySelector('#core');
const launch = document.querySelector('#launch');
const nameEl = document.querySelector('#romName');
const drop = document.querySelector('#dropZone');
const launcher = document.querySelector('#launcher');
const playerWrap = document.querySelector('#playerWrap');
const nowPlaying = document.querySelector('#nowPlaying');
const localFullscreen = document.querySelector('#localFullscreen');
const localGameFrame = document.querySelector('#localGameFrame');
const touchLike = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
let selectedFile = null;
let objectUrl = null;

document.body.classList.toggle('touch-device', touchLike);

function choose(file) {
  selectedFile = file || null;
  nameEl.textContent = file ? `${file.name} · ${(file.size / 1024 / 1024).toFixed(1)} MB` : 'или нажмите, чтобы выбрать файл';
  launch.disabled = !file;
}
rom.addEventListener('change', () => choose(rom.files[0]));
['dragenter', 'dragover'].forEach((eventName) => drop.addEventListener(eventName, (event) => { event.preventDefault(); drop.classList.add('dragging'); }));
['dragleave', 'drop'].forEach((eventName) => drop.addEventListener(eventName, (event) => { event.preventDefault(); drop.classList.remove('dragging'); }));
drop.addEventListener('drop', (event) => choose(event.dataTransfer.files[0]));

launch.addEventListener('click', () => {
  if (!selectedFile) return;
  if (objectUrl) URL.revokeObjectURL(objectUrl);
  objectUrl = URL.createObjectURL(selectedFile);
  window.EJS_player = '#game';
  window.EJS_core = core.value;
  window.EJS_gameName = selectedFile.name.replace(/\.[^.]+$/, '');
  window.EJS_gameUrl = objectUrl;
  window.EJS_pathtodata = '/emulatorjs/data/';
  window.EJS_startOnLoaded = true;
  window.EJS_fullscreenOnLoaded = false;
  window.EJS_language = 'ru-RU';
  window.EJS_threads = Boolean(window.crossOriginIsolated);
  window.EJS_fixedSaveInterval = 15000;
  window.EJS_color = '#d99a47';
  window.EJS_backgroundColor = '#05070a';
  launcher.classList.add('hidden');
  playerWrap.classList.remove('hidden');
  nowPlaying.textContent = `${window.EJS_gameName} · ${core.options[core.selectedIndex].text}`;
  window.RetroPresence?.playing(`local:${core.value}`);
  const script = document.createElement('script');
  script.src = '/emulatorjs/data/loader.js';
  script.onerror = () => alert('Не удалось загрузить EmulatorJS runtime. Проверьте доступность /emulatorjs/data/loader.js на сервере.');
  document.body.appendChild(script);
});

document.querySelector('#reset').addEventListener('click', () => location.reload());
localFullscreen?.addEventListener('click', async () => {
  try {
    if (!document.fullscreenElement) {
      if (localGameFrame.requestFullscreen) await localGameFrame.requestFullscreen({ navigationUI: 'hide' });
      else if (localGameFrame.webkitRequestFullscreen) localGameFrame.webkitRequestFullscreen();
      if (touchLike && screen.orientation?.lock) {
        try { await screen.orientation.lock('landscape'); } catch {}
      }
    } else await document.exitFullscreen();
  } catch (error) { console.warn('Fullscreen unavailable', error); }
});
document.addEventListener('fullscreenchange', () => {
  if (localFullscreen) localFullscreen.textContent = document.fullscreenElement ? '⤢ ВЫЙТИ ИЗ ЭКРАНА' : '⛶ ПОЛНЫЙ ЭКРАН';
  if (!document.fullscreenElement) {
    try { screen.orientation?.unlock?.(); } catch {}
  }
});
window.addEventListener('beforeunload', () => {
  window.RetroPresence?.idle();
  try { screen.orientation?.unlock?.(); } catch {}
  if (objectUrl) URL.revokeObjectURL(objectUrl);
});
