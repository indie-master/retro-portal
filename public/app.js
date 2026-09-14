const content=document.querySelector('#libraryContent');
const filters=document.querySelector('#filters');
const catalogCount=document.querySelector('#catalogCount');
const availableCount=document.querySelector('#availableCount');
const onlineStat=document.querySelector('#onlineStat');
const search=document.querySelector('#search');
const activityList=document.querySelector('#activityList');
const activitySummary=document.querySelector('#activitySummary');
const activityMode=document.querySelector('#activityMode');
let games=[];
let activeFilter='Все';
let query='';
let presenceByGame={};
let lastActivity=null;

const SYSTEM_ORDER=['Mega Drive','PlayStation','Dreamcast','NES','SNES','Game Boy','Game Boy Advance','Nintendo 64','Arcade'];
const escapeHtml=(value='')=>String(value).replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));

function isMultiplayer(game){
  const tags=Array.isArray(game.tags)?game.tags:[];
  return tags.includes('multiplayer')||/2|3|4|multi|дв|чет/i.test(game.players||'');
}

function matchesQuery(game){
  if(!query)return true;
  return [game.title,game.system,game.description,game.history,game.year,...(game.tags||[])].join(' ').toLowerCase().includes(query.toLowerCase());
}

function filteredGames(){
  let result=games.filter(matchesQuery);
  if(activeFilter==='Избранное')result=result.filter(g=>g.featured&&!g.demo);
  else if(activeFilter==='Demo')result=result.filter(g=>g.demo);
  else if(activeFilter==='На двоих')result=result.filter(isMultiplayer);
  else if(activeFilter!=='Все')result=result.filter(g=>g.system===activeFilter&&!g.demo);
  return result.sort((a,b)=>(a.sort??9999)-(b.sort??9999)||a.title.localeCompare(b.title));
}

function tagLabel(tag){
  const labels={multiplayer:'на двоих',homebrew:'homebrew',racing:'гонки',fighting:'файтинг',platformer:'платформер',action:'экшен',arcade:'аркада',horror:'хоррор',strategy:'стратегия'};
  return labels[tag]||tag;
}

function systemClass(system=''){
  return system.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'retro';
}

function gameCard(game){
  const viewers=presenceByGame[game.id]||0;
  const preview=Array.isArray(game.screenshots)&&game.screenshots[0]?game.screenshots[0]:'';
  const tags=(game.tags||[]).filter(tag=>tag!=='homebrew').slice(0,2).map(tag=>`<span>${escapeHtml(tagLabel(tag))}</span>`).join('');
  const cover=game.cover?`<img src="${escapeHtml(game.cover)}" alt="Обложка ${escapeHtml(game.title)}" loading="lazy" onerror="this.remove()">`:'';
  const desc=game.description?`<span class="card-story">${escapeHtml(game.description.slice(0,120))}${game.description.length>120?'…':''}</span>`:'';
  return `<article class="game-card ready ${game.demo?'demo-card':''}"><div class="cover-wrap"><div class="cover-fallback system-${systemClass(game.system)}"><span>${escapeHtml(game.system)}</span><strong>${escapeHtml(game.title)}</strong><em>${escapeHtml(game.year||'RETRO')}</em></div><div class="cover-art">${cover}</div>${preview?`<div class="cover-preview"><img src="${escapeHtml(preview)}" alt="Скриншот ${escapeHtml(game.title)}" loading="lazy" onerror="this.parentElement.remove()"></div>`:''}<div class="cover-shade"></div><span class="platform-badge">${game.demo?'DEMO':escapeHtml(game.system)}</span>${viewers?`<span class="playing-badge">● ${viewers} играет</span>`:''}</div><div class="game-card-body"><h4>${escapeHtml(game.title)}</h4><p>${escapeHtml(game.year||'')}${game.players?` · ${escapeHtml(game.players)}`:''}</p>${desc}${tags?`<div class="tags">${tags}</div>`:''}<div class="card-action"><a class="play-button" href="/game.html?id=${encodeURIComponent(game.id)}">▶ ИГРАТЬ</a></div></div></article>`;
}

function shelf(title,list,id=''){
  if(!list.length)return'';
  const demo=id==='demo';
  return `<section class="game-shelf" ${id?`id="${id}"`:''}><div class="shelf-heading"><div><p>${demo?'DEMO / HOMEBREW':'КОЛЛЕКЦИЯ'}</p><h3>${escapeHtml(title)}</h3></div>${demo?'<span>Можно запустить прямо сейчас.</span>':''}</div><div class="game-grid">${list.map(gameCard).join('')}</div></section>`;
}

function render(){
  if(!games.length){
    content.innerHTML='<div class="loading-card">На сервере пока нет готовых к запуску игр. Можно открыть «Свой ROM» и запустить локальный файл.</div>';
    return;
  }
  if(activeFilter==='Все'&&!query){
    const sorted=[...games].sort((a,b)=>(a.sort??9999)-(b.sort??9999));
    const chunks=[];
    const featured=sorted.filter(g=>g.featured&&!g.demo);
    if(featured.length)chunks.push(shelf('Избранное',featured));
    for(const system of SYSTEM_ORDER){
      const list=sorted.filter(g=>g.system===system&&!g.demo);
      if(list.length)chunks.push(shelf(system,list));
    }
    const demos=sorted.filter(g=>g.demo);
    if(demos.length)chunks.push(shelf('Попробовать прямо сейчас',demos,'demo'));
    content.innerHTML=chunks.join('');
    return;
  }
  const visible=filteredGames();
  content.innerHTML=visible.length?shelf(activeFilter,visible):'<div class="loading-card">Ничего не найдено.</div>';
}

function renderFilters(){
  const values=['Все'];
  if(games.some(g=>g.featured&&!g.demo))values.push('Избранное');
  for(const system of SYSTEM_ORDER)if(games.some(g=>g.system===system&&!g.demo))values.push(system);
  if(games.some(g=>g.demo))values.push('Demo');
  if(games.some(isMultiplayer))values.push('На двоих');
  if(!values.includes(activeFilter))activeFilter='Все';
  filters.innerHTML=values.map(value=>`<button class="filter ${value===activeFilter?'active':''}" data-filter="${escapeHtml(value)}">${escapeHtml(value)}</button>`).join('');
  filters.querySelectorAll('button').forEach(button=>button.addEventListener('click',()=>{activeFilter=button.dataset.filter;renderFilters();render();}));
}

async function loadLibrary(){
  try{
    const response=await fetch('/api/games',{cache:'no-store'});
    if(!response.ok)throw new Error(`HTTP ${response.status}`);
    const data=await response.json();
    games=(data.games||[]).filter(game=>game.playable!==false);
    catalogCount.textContent=games.length;
    availableCount.textContent=games.length;
    renderFilters();
    render();
    renderActivity(lastActivity);
  }catch(error){
    console.error(error);
    content.innerHTML='<div class="loading-card error">Не удалось загрузить библиотеку.</div>';
  }
}

function activityItem(item,kind){
  const game=games.find(g=>g.id===item.id);
  const cover=item.cover||game?.cover||'';
  const metric=kind==='current'?`${item.players} ${item.players===1?'игрок':'игрока'}`:`${item.launches} запусков за 7 дней`;
  return `<a class="activity-game" href="/game.html?id=${encodeURIComponent(item.id)}">${cover?`<img src="${escapeHtml(cover)}" alt="" loading="lazy">`:`<span class="activity-fallback">${escapeHtml((item.title||'?').slice(0,1))}</span>`}<div><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.system||'')}</small></div><em>${escapeHtml(metric)}</em></a>`;
}

function renderActivity(activity){
  if(!activityList)return;
  if(!activity){
    activityList.innerHTML='<div class="loading-card">Собираем активность…</div>';
    return;
  }
  lastActivity=activity;
  activityMode.textContent=activity.real===false?'ПРИМЕР':'LIVE';
  activitySummary.textContent=activity.online?`${activity.online} игроков онлайн`:'Сейчас тихо — можно быть первым';
  const current=Array.isArray(activity.current)?activity.current:[];
  const popular=Array.isArray(activity.popular7d)?activity.popular7d:[];
  if(current.length){
    activityList.innerHTML=`<div class="activity-group"><h3>Прямо сейчас</h3>${current.map(x=>activityItem(x,'current')).join('')}</div>${popular.length?`<div class="activity-group"><h3>Популярно за 7 дней</h3>${popular.map(x=>activityItem(x,'popular')).join('')}</div>`:''}`;
    return;
  }
  if(popular.length){
    activityList.innerHTML=`<div class="activity-group"><h3>Популярно за 7 дней</h3>${popular.map(x=>activityItem(x,'popular')).join('')}</div>`;
    return;
  }
  activityList.innerHTML='<div class="activity-empty"><strong>Пока здесь тихо.</strong><span>После первых запусков появятся активные игры и недельный рейтинг.</span></div>';
}

async function loadActivity(){
  try{
    const response=await fetch('/api/activity',{cache:'no-store'});
    if(!response.ok)throw new Error(`HTTP ${response.status}`);
    const data=await response.json();
    if(onlineStat)onlineStat.textContent=data.online||0;
    presenceByGame=data.byGame||presenceByGame;
    renderActivity(data);
    render();
  }catch(error){
    console.warn('Activity unavailable',error);
    if(activityList)activityList.innerHTML='<div class="activity-empty"><strong>Активность временно недоступна.</strong><span>Игры по-прежнему можно запускать из библиотеки.</span></div>';
  }
}

search?.addEventListener('input',()=>{query=search.value.trim();render();});
window.addEventListener('arcade:presence',event=>{
  presenceByGame=event.detail?.byGame||{};
  if(onlineStat)onlineStat.textContent=event.detail?.online||0;
  render();
  if(lastActivity){
    lastActivity={...lastActivity,online:event.detail?.online||0,byGame:presenceByGame};
    renderActivity(lastActivity);
  }
});

loadLibrary();
loadActivity();
setInterval(loadActivity,30000);
