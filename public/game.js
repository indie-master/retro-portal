const params = new URLSearchParams(location.search);
const gameId = params.get('id');
const title = document.querySelector('#gameTitle');
const system = document.querySelector('#gameSystem');
const notice = document.querySelector('#playerNotice');
document.querySelector('#reloadGame').addEventListener('click', () => location.reload());
function showError(message){notice.classList.add('error');notice.textContent=message;}
async function boot(){
  if(!gameId)return showError('Не указан id игры.');
  try{
    const response=await fetch(`/api/games/${encodeURIComponent(gameId)}`,{cache:'no-store'});
    if(!response.ok)throw new Error(response.status===404?'Игра не найдена.':`API error: ${response.status}`);
    const {game}=await response.json();
    title.textContent=game.title; document.title=`${game.title} · Retro Portal`; system.textContent=`${game.system} · ${game.players||'RETRO'}`;
    if(!game.installed)return showError('ROM этой игры не установлен на сервере.');
    if(game.biosRequired&&!game.biosInstalled)return showError('Для этой игры не хватает BIOS. Проверь games/bios.');
    if(game.engine==='flycast-wasm')return showError('Dreamcast отмечен как experimental. Метаданные и каталог уже готовы, но Flycast WASM runtime нужно подключить отдельно — см. docs/ru/DREAMCAST.md.');
    window.RetroPresence?.playing(game.id);
    window.EJS_player='#game'; window.EJS_core=game.core; window.EJS_gameName=game.title; window.EJS_gameID=Number(game.gameId); window.EJS_gameUrl=game.romUrl; window.EJS_biosUrl=game.biosUrl||''; window.EJS_pathtodata='/emulatorjs/data/'; window.EJS_startOnLoaded=true; window.EJS_language='ru-RU'; window.EJS_threads=Boolean(window.crossOriginIsolated); window.EJS_fixedSaveInterval=15000; window.EJS_color='#d99a47'; window.EJS_backgroundColor='#081018';
    notice.textContent=window.crossOriginIsolated?'Эмулятор готов · threaded cores доступны':'Эмулятор готов · однопоточный режим браузера';
    const script=document.createElement('script'); script.src='/emulatorjs/data/loader.js'; script.async=true; script.onerror=()=>showError('EmulatorJS не установлен. Запусти ./scripts/install-emulatorjs.sh на сервере.'); document.body.appendChild(script);
  }catch(error){console.error(error);showError(error.message||'Не удалось запустить игру.');}
}
window.addEventListener('beforeunload',()=>window.RetroPresence?.idle()); boot();
