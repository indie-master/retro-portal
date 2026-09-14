const content=document.querySelector('#libraryContent');
const filters=document.querySelector('#filters');
const search=document.querySelector('#search');
const catalogCount=document.querySelector('#catalogCount');
const availableCount=document.querySelector('#availableCount');
const onlineStat=document.querySelector('#onlineStat');
const onlineTop=document.querySelector('#online');
const activityList=document.querySelector('#activityList');
const activitySummary=document.querySelector('#activitySummary');
const activityMode=document.querySelector('#activityMode');
let games=[];
let activeFilter='Все';
let query='';
let demoPresence={};
const ORDER=['Все','Mega Drive','Demo','На двоих'];
const esc=(v='')=>String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const multi=g=>(g.tags||[]).includes('multiplayer')||/2|3|4/.test(g.players||'');

function matches(g){
  if(query&&!([g.title,g.system,g.description,g.history,g.year,...(g.tags||[])].join(' ').toLowerCase().includes(query.toLowerCase())))return false;
  if(activeFilter==='Demo')return g.demo;
  if(activeFilter==='На двоих')return multi(g);
  if(activeFilter!=='Все')return g.system===activeFilter;
  return true;
}

function card(g){
  const cover=g.cover?`<img src="${esc(g.cover)}" alt="Обложка ${esc(g.title)}" loading="lazy" onerror="this.remove()">`:'';
  const desc=g.description?`<span class="card-story">${esc(g.description.slice(0,120))}${g.description.length>120?'…':''}</span>`:'';
  const viewers=demoPresence[g.id]||0;
  return `<article class="game-card ready demo-card"><div class="cover-wrap"><div class="cover-art">${cover}</div><div class="cover-shade"></div><span class="platform-badge">DEMO</span>${viewers?`<span class="playing-badge">● ${viewers} играет</span>`:''}</div><div class="game-card-body"><h4>${esc(g.title)}</h4><p>${esc(g.year||'')}${g.players?` · ${esc(g.players)}`:''}</p>${desc}<div class="tags">${(g.tags||[]).filter(t=>t!=='homebrew').slice(0,2).map(t=>`<span>${esc(t)}</span>`).join('')}</div><div class="card-action"><a class="play-button" href="game.html?id=${encodeURIComponent(g.id)}">▶ ИГРАТЬ</a></div></div></article>`;
}

function shelf(title,list,id=''){
  if(!list.length)return'';
  return `<section class="game-shelf" ${id?`id="${id}"`:''}><div class="shelf-heading"><div><p>DEMO / HOMEBREW</p><h3>${esc(title)}</h3></div><span>Можно запустить прямо сейчас.</span></div><div class="game-grid">${list.map(card).join('')}</div></section>`;
}

function render(){
  const sorted=[...games].filter(g=>g.playable).sort((a,b)=>(a.sort??9999)-(b.sort??9999));
  if(activeFilter==='Все'&&!query){content.innerHTML=shelf('Попробовать прямо сейчас',sorted,'demo');return;}
  const list=sorted.filter(matches);
  content.innerHTML=list.length?shelf(activeFilter,list):'<div class="loading-card">Ничего не найдено.</div>';
}

function renderFilters(){
  const items=ORDER.filter(x=>x==='Все'||x==='Demo'||x==='На двоих'&&games.some(multi)||games.some(g=>g.system===x));
  filters.innerHTML=items.map(x=>`<button class="filter ${x===activeFilter?'active':''}" data-filter="${x}">${x}</button>`).join('');
  filters.querySelectorAll('button').forEach(b=>b.onclick=()=>{activeFilter=b.dataset.filter;renderFilters();render();});
}

function activityItem(item,kind){
  const metric=kind==='current'?`${item.players} ${item.players===1?'игрок':'игрока'}`:`${item.launches} запусков за 7 дней`;
  return `<a class="activity-game" href="game.html?id=${encodeURIComponent(item.id)}">${item.cover?`<img src="${esc(item.cover)}" alt="" loading="lazy">`:`<span class="activity-fallback">${esc((item.title||'?').slice(0,1))}</span>`}<div><strong>${esc(item.title)}</strong><small>${esc(item.system||'')}</small></div><em>${esc(metric)}</em></a>`;
}

function renderDemoActivity(){
  const pool=[...games].filter(g=>g.playable).sort((a,b)=>(a.sort??9999)-(b.sort??9999));
  if(!pool.length)return;
  const playerCounts=[3,2,1];
  const launchCounts=[48,37,29,24,18,14];
  const current=pool.slice(0,Math.min(3,pool.length)).map((g,i)=>({id:g.id,title:g.title,system:g.system,cover:g.cover||'',players:playerCounts[i]||1}));
  const popular=pool.slice(0,Math.min(6,pool.length)).map((g,i)=>({id:g.id,title:g.title,system:g.system,cover:g.cover||'',launches:launchCounts[i]||12}));
  demoPresence=Object.fromEntries(current.map(item=>[item.id,item.players]));
  const playing=current.reduce((sum,item)=>sum+item.players,0);
  const online=Math.max(playing+3,9);
  if(onlineStat)onlineStat.textContent=String(online);
  if(onlineTop)onlineTop.textContent=String(online);
  if(activityMode)activityMode.textContent='ПРИМЕР';
  if(activitySummary)activitySummary.textContent=`${online} игроков онлайн`;
  if(activityList)activityList.innerHTML=`<div class="activity-group"><h3>Прямо сейчас</h3>${current.map(x=>activityItem(x,'current')).join('')}</div><div class="activity-group"><h3>Популярно за 7 дней</h3>${popular.map(x=>activityItem(x,'popular')).join('')}</div>`;
  render();
}

search?.addEventListener('input',()=>{query=search.value.trim();render();});
fetch('catalog.json',{cache:'no-store'}).then(r=>r.json()).then(data=>{
  games=(data.games||[]).filter(g=>g.playable);
  catalogCount.textContent=games.length;
  availableCount.textContent=games.length;
  renderFilters();
  renderDemoActivity();
}).catch(()=>{
  content.innerHTML='<div class="loading-card error">Не удалось загрузить demo-каталог.</div>';
  if(activityList)activityList.innerHTML='<div class="activity-empty"><strong>Активность временно недоступна.</strong><span>Обновите страницу чуть позже.</span></div>';
});
