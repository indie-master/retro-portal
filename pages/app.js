const content = document.querySelector('#libraryContent');
const filters = document.querySelector('#filters');
const installedCount = document.querySelector('#installedCount');
const playingCount = document.querySelector('#playingCount');
const search = document.querySelector('#search');
let activeFilter = 'Все';
let query = '';
const games = [
  {id:'tank-battle',title:'Tank Battle',system:'Mega Drive',rom:'tank-battle.bin',cover:'covers/tank-battle.svg',description:'Танковые дуэли сверху — быстро и без лишних правил.',players:'1–2 игрока',tags:['homebrew','multiplayer'],sort:10},
  {id:'battle-4tris',title:'Battle 4Tris',system:'Mega Drive',rom:'battle-4tris.bin',cover:'covers/battle-4tris.svg',description:'Соревновательный тетрис с мусорными линиями.',players:'1–2 игрока',tags:['homebrew','multiplayer'],sort:20},
  {id:'pong-md',title:'Pong',system:'Mega Drive',rom:'pong.bin',cover:'covers/pong-md.svg',description:'Классический пинг-понг для Mega Drive / Genesis.',players:'1–2 игрока',tags:['homebrew','multiplayer'],sort:30},
  {id:'snake-arena',title:'Snake Arena',system:'Mega Drive',rom:'snake-arena.bin',cover:'covers/snake-arena.svg',description:'Змейка с соревновательным режимом на двоих.',players:'1–2 игрока',tags:['homebrew','multiplayer'],sort:40},
  {id:'space-shooter',title:'Space Shooter',system:'Mega Drive',rom:'space-shooter.bin',cover:'covers/space-shooter.svg',description:'Вертикальный шутер с кооперативом.',players:'1–2 игрока',tags:['homebrew','multiplayer'],sort:50},
  {id:'breakout-md',title:'Breakout',system:'Mega Drive',rom:'breakout.bin',cover:'covers/breakout-md.svg',description:'Разбивай кирпичи. Вечная классика.',players:'1 игрок',tags:['homebrew','arcade'],sort:60}
];
const esc = (v='') => String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
function visible(){return games.filter(g=>(activeFilter==='Все'||activeFilter==='На двоих'&&g.tags.includes('multiplayer')||g.system===activeFilter)&&(!query||[g.title,g.system,g.description,...g.tags].join(' ').toLowerCase().includes(query))).sort((a,b)=>a.sort-b.sort)}
function card(g){return `<article class="game-card"><div class="cover-wrap"><div class="cover-art"><img src="${g.cover}" alt="${esc(g.title)}"></div><div class="cover-shade"></div><span class="platform-badge">${g.system}</span></div><div class="game-card-body"><h4>${esc(g.title)}</h4><p>${esc(g.description)}</p><div class="tags"><span>homebrew</span><span>${esc(g.players)}</span></div><div class="card-action"><a class="play-button" href="game.html?id=${encodeURIComponent(g.id)}">▶ ИГРАТЬ</a></div></div></article>`}
function render(){content.innerHTML=`<div class="game-grid">${visible().map(card).join('')}</div>`}
function renderFilters(){const items=['Все','Mega Drive','На двоих'];filters.innerHTML=items.map(x=>`<button class="filter ${x===activeFilter?'active':''}" data-filter="${x}">${x}</button>`).join('');filters.querySelectorAll('button').forEach(b=>b.onclick=()=>{activeFilter=b.dataset.filter;renderFilters();render()})}
search?.addEventListener('input',()=>{query=search.value.trim().toLowerCase();render()});
installedCount.textContent=games.length; playingCount.textContent='2'; document.querySelector('#online').textContent='4'; renderFilters();render();