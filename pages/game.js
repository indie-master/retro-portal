const games={
 'tank-battle':['Tank Battle','tank-battle.bin'], 'battle-4tris':['Battle 4Tris','battle-4tris.bin'], 'pong-md':['Pong','pong.bin'],
 'snake-arena':['Snake Arena','snake-arena.bin'], 'space-shooter':['Space Shooter','space-shooter.bin'], 'breakout-md':['Breakout','breakout.bin']
};
const id=new URLSearchParams(location.search).get('id'); const item=games[id]; const notice=document.querySelector('#playerNotice');
document.querySelector('#reloadGame').onclick=()=>location.reload();
if(!item){notice.textContent='Игра не найдена в demo-каталоге.';notice.classList.add('error')}else{
 document.querySelector('#gameTitle').textContent=item[0]; document.querySelector('#gameSystem').textContent='Mega Drive · HOMEBREW';
 window.EJS_player='#game'; window.EJS_core='segaMD'; window.EJS_gameName=item[0]; window.EJS_gameUrl=`roms/${item[1]}`; window.EJS_pathtodata='emulatorjs/data/'; window.EJS_startOnLoaded=true; window.EJS_language='ru-RU'; window.EJS_threads=false; window.EJS_color='#d99a47'; window.EJS_backgroundColor='#081018';
 const s=document.createElement('script'); s.src='emulatorjs/data/loader.js'; s.onerror=()=>{notice.textContent='EmulatorJS runtime ещё не опубликован GitHub Pages workflow.';notice.classList.add('error')}; document.body.appendChild(s);
}