const params = new URLSearchParams(location.search);
const gameId = params.get('id');
const title = document.querySelector('#gameTitle');
const system = document.querySelector('#gameSystem');
const notice = document.querySelector('#playerNotice');
const frame = document.querySelector('#gameFrame');
const fullscreenButton = document.querySelector('#fullscreenGame');
const gamepadNotice = document.querySelector('#gamepadNotice');

document.querySelector('#reloadGame')?.addEventListener('click', () => location.reload());
fullscreenButton?.addEventListener('click', async () => {
  try {
    if (!document.fullscreenElement) await frame.requestFullscreen();
    else await document.exitFullscreen();
  } catch (error) {
    console.warn('Fullscreen unavailable', error);
  }
});

document.addEventListener('fullscreenchange', () => {
  if (fullscreenButton) fullscreenButton.textContent = document.fullscreenElement ? '⤢ ВЫЙТИ ИЗ ЭКРАНА' : '⛶ ПОЛНЫЙ ЭКРАН';
});

function showError(message) {
  notice.classList.add('error');
  notice.textContent = message;
}
function showGamepad() {
  if (!gamepadNotice) return;
  gamepadNotice.hidden = false;
  clearTimeout(showGamepad.timer);
  showGamepad.timer = setTimeout(() => { gamepadNotice.hidden = true; }, 2600);
}
window.addEventListener('gamepadconnected', showGamepad);

async function boot() {
  if (!gameId) return showError('Не выбрана игра. Вернитесь в библиотеку и выберите карточку.');
  try {
    const response = await fetch(`/api/games/${encodeURIComponent(gameId)}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(response.status === 404 ? 'Игра не найдена.' : `Ошибка каталога: ${response.status}`);
    const { game } = await response.json();
    title.textContent = game.title;
    document.title = `${game.title} · Retro Portal`;
    system.textContent = `${game.system}${game.year ? ` · ${game.year}` : ''}${game.players ? ` · ${game.players}` : ''}`;

    if (game.experimental) return showError('Dreamcast пока работает в экспериментальном режиме. Runtime Flycast WASM ещё не включён в стабильную сборку.');
    if (!game.installed) return showError(`ROM этой игры ещё не добавлен. Ожидаемый путь: games/roms/${game.romExpected || game.rom}`);
    if (game.biosRequired && !game.biosInstalled) return showError(`Для запуска нужен BIOS: ${(game.biosExpected || []).join(', ')}`);

    window.RetroPresence?.playing(game.id);
    window.EJS_player = '#game';
    window.EJS_core = game.core;
    window.EJS_gameName = game.title;
    window.EJS_gameID = Number(game.gameId);
    window.EJS_gameUrl = game.romUrl;
    window.EJS_biosUrl = game.biosUrl || '';
    window.EJS_pathtodata = '/emulatorjs/data/';
    window.EJS_startOnLoaded = true;
    window.EJS_language = 'ru-RU';
    window.EJS_threads = Boolean(window.crossOriginIsolated);
    window.EJS_fixedSaveInterval = 15000;
    window.EJS_color = '#d99a47';
    window.EJS_backgroundColor = '#05070a';

    notice.textContent = 'Готово. Нажимайте Start — хорошей игры.';
    const script = document.createElement('script');
    script.src = '/emulatorjs/data/loader.js';
    script.async = true;
    script.onerror = () => showError('Эмулятор не установлен. Запустите ./scripts/install-emulatorjs.sh на сервере.');
    document.body.appendChild(script);
  } catch (error) {
    console.error(error);
    showError(error.message || 'Не удалось запустить игру.');
  }
}

window.addEventListener('beforeunload', () => window.RetroPresence?.idle());
boot();
