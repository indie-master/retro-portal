document.addEventListener('DOMContentLoaded',()=>{
  const connection=document.querySelector('#connection');
  const dot=document.querySelector('#statusDot');
  const online=document.querySelector('#online');
  const onlineStat=document.querySelector('#onlineStat');
  if(connection)connection.textContent='В СЕТИ';
  if(dot)dot.classList.add('live');
  if(online)online.textContent='9';
  if(onlineStat)onlineStat.textContent='9';
});
window.RetroPresence={playing(){},idle(){}};
