(() => {
  const BASE = {
    0: { value: 'x', value2: 'BUTTON_1' }, 1: { value: 's', value2: 'BUTTON_4' },
    2: { value: 'shift', value2: 'SELECT' }, 3: { value: 'enter', value2: 'START' },
    4: { value: 'up arrow', value2: 'DPAD_UP' }, 5: { value: 'down arrow', value2: 'DPAD_DOWN' },
    6: { value: 'left arrow', value2: 'DPAD_LEFT' }, 7: { value: 'right arrow', value2: 'DPAD_RIGHT' },
    8: { value: 'z', value2: 'BUTTON_2' }, 9: { value: 'a', value2: 'BUTTON_3' },
    10: { value: 'q', value2: 'LEFT_TOP_SHOULDER' }, 11: { value: 'w', value2: 'RIGHT_TOP_SHOULDER' },
    12: { value: 'e', value2: 'LEFT_BOTTOM_SHOULDER' }, 13: { value: 'r', value2: 'RIGHT_BOTTOM_SHOULDER' },
    14: { value: '', value2: 'LEFT_STICK' }, 15: { value: '', value2: 'RIGHT_STICK' },
    16: { value: 'l', value2: 'LEFT_STICK_X:+1' }, 17: { value: 'j', value2: 'LEFT_STICK_X:-1' },
    18: { value: 'k', value2: 'LEFT_STICK_Y:+1' }, 19: { value: 'i', value2: 'LEFT_STICK_Y:-1' },
    20: { value: 'l', value2: 'RIGHT_STICK_X:+1' }, 21: { value: 'j', value2: 'RIGHT_STICK_X:-1' },
    22: { value: 'k', value2: 'RIGHT_STICK_Y:+1' }, 23: { value: 'i', value2: 'RIGHT_STICK_Y:-1' },
    24: { value: '1' }, 25: { value: '2' }, 26: { value: '3' }, 27: { value: 'add' }, 28: { value: 'space' }, 29: { value: 'subtract' }
  };

  const SYSTEMS = {
    'Mega Drive': {
      labels: { 0:'A',1:'B',8:'C',9:'X',10:'Y',11:'Z',2:'MODE',3:'START',4:'ВВЕРХ',5:'ВНИЗ',6:'ВЛЕВО',7:'ВПРАВО' },
      defaults: { 0:'z',1:'x',8:'c',9:'a',10:'s',11:'d',2:'shift',3:'enter' },
      preview: [['Движение','Стрелки'],['A / B / C','Z / X / C'],['X / Y / Z','A / S / D'],['Start','Enter']]
    },
    'PlayStation': {
      labels: { 0:'✕',1:'□',8:'○',9:'△',10:'L1',11:'R1',12:'L2',13:'R2',2:'SELECT',3:'START',4:'ВВЕРХ',5:'ВНИЗ',6:'ВЛЕВО',7:'ВПРАВО' },
      defaults: { 0:'z',8:'x',1:'a',9:'s',10:'q',11:'w',12:'e',13:'r',2:'shift',3:'enter' },
      preview: [['D-pad','Стрелки'],['✕ / ○','Z / X'],['□ / △','A / S'],['L1 / R1','Q / W'],['Start','Enter']]
    },
    'Dreamcast': {
      labels: { 0:'A',1:'X',8:'B',9:'Y',10:'L',11:'R',3:'START',4:'D↑',5:'D↓',6:'D←',7:'D→',19:'STICK ↑',18:'STICK ↓',17:'STICK ←',16:'STICK →' },
      defaults: { 0:'z',8:'x',1:'a',9:'s',10:'q',11:'w',3:'enter',19:'i',18:'k',17:'j',16:'l' },
      preview: [['D-pad','Стрелки'],['A / B','Z / X'],['X / Y','A / S'],['L / R','Q / W'],['Stick','I J K L']]
    },
    'NES': { labels:{0:'B',8:'A',2:'SELECT',3:'START',4:'ВВЕРХ',5:'ВНИЗ',6:'ВЛЕВО',7:'ВПРАВО'}, defaults:{0:'x',8:'z',2:'shift',3:'enter'}, preview:[['Движение','Стрелки'],['B / A','X / Z'],['Select','Shift'],['Start','Enter']] },
    'SNES': { labels:{0:'B',1:'Y',8:'A',9:'X',10:'L',11:'R',2:'SELECT',3:'START',4:'ВВЕРХ',5:'ВНИЗ',6:'ВЛЕВО',7:'ВПРАВО'}, defaults:{0:'x',1:'a',8:'z',9:'s',10:'q',11:'w',2:'shift',3:'enter'}, preview:[['Движение','Стрелки'],['B / A','X / Z'],['Y / X','A / S'],['L / R','Q / W']] },
    'Game Boy': { labels:{0:'B',8:'A',2:'SELECT',3:'START',4:'ВВЕРХ',5:'ВНИЗ',6:'ВЛЕВО',7:'ВПРАВО'}, defaults:{0:'x',8:'z',2:'shift',3:'enter'}, preview:[['Движение','Стрелки'],['B / A','X / Z'],['Select','Shift'],['Start','Enter']] },
    'Game Boy Advance': { labels:{0:'B',8:'A',10:'L',11:'R',2:'SELECT',3:'START',4:'ВВЕРХ',5:'ВНИЗ',6:'ВЛЕВО',7:'ВПРАВО'}, defaults:{0:'x',8:'z',10:'q',11:'w',2:'shift',3:'enter'}, preview:[['Движение','Стрелки'],['B / A','X / Z'],['L / R','Q / W'],['Start','Enter']] },
    'Nintendo 64': { labels:{0:'B',8:'A',10:'L',11:'R',3:'START',4:'D↑',5:'D↓',6:'D←',7:'D→',19:'STICK ↑',18:'STICK ↓',17:'STICK ←',16:'STICK →'}, defaults:{0:'x',8:'z',10:'q',11:'w',3:'enter',19:'i',18:'k',17:'j',16:'l'}, preview:[['D-pad','Стрелки'],['A / B','Z / X'],['Stick','I J K L'],['L / R','Q / W']] },
    'Arcade': { labels:{0:'КНОПКА 1',1:'КНОПКА 2',8:'КНОПКА 3',9:'КНОПКА 4',10:'КНОПКА 5',11:'КНОПКА 6',2:'COIN',3:'START',4:'ВВЕРХ',5:'ВНИЗ',6:'ВЛЕВО',7:'ВПРАВО'}, defaults:{0:'z',1:'x',8:'c',9:'a',10:'s',11:'d',2:'shift',3:'enter'}, preview:[['Движение','Стрелки'],['Кнопки 1–3','Z / X / C'],['Кнопки 4–6','A / S / D'],['Start','Enter']] }
  };

  const SPECIAL = { ArrowUp:'up arrow',ArrowDown:'down arrow',ArrowLeft:'left arrow',ArrowRight:'right arrow',Enter:'enter',Shift:'shift',' ':'space','+':'add','-':'subtract' };
  const DISPLAY = { 'up arrow':'↑','down arrow':'↓','left arrow':'←','right arrow':'→',enter:'Enter',shift:'Shift',space:'Space',add:'+',subtract:'−' };
  let game=null,current=null,editingIndex=null;
  const clone=(value)=>JSON.parse(JSON.stringify(value));
  const profileFor=(system)=>SYSTEMS[system]||SYSTEMS.Arcade;
  const storageKey=()=>game?`retroPortal.controls.${game.system}.${game.id}`:'';
  const systemStorageKey=()=>game?`retroPortal.controls.${game.system}`:'';

  function buildDefaults(system){const result=clone(BASE);const profile=profileFor(system);for(const[index,key]of Object.entries(profile.defaults||{}))result[index]={...(result[index]||{}),value:key};return result}
  function getStored(key){try{const value=JSON.parse(localStorage.getItem(key)||'null');return value&&typeof value==='object'?value:null}catch{return null}}
  function mergedControls(targetGame){game=targetGame;const defaults=buildDefaults(game.system);const admin=game.controls?.[0]||game.controls||null;return{...defaults,...(admin||{}),...(getStored(systemStorageKey())||{}),...(getStored(storageKey())||{})}}
  function ejsObject(targetGame){const controls=mergedControls(targetGame);return{0:controls,1:{},2:{},3:{}}}
  function displayKey(value){return DISPLAY[value]||String(value||'—').toUpperCase()}
  function preview(targetGame){
    const profile=profileFor(targetGame?.system);
    return (profile.preview||[]).map(([action,key])=>({action,key}));
  }
  function summary(targetGame){return preview(targetGame).map((item)=>`${item.action}: ${item.key}`).join(' · ')}
  function rows(){const profile=profileFor(game.system);return Object.keys(profile.labels).map(Number).map((index)=>`<button class="control-row" type="button" data-control-index="${index}"><span>${profile.labels[index]}</span><kbd>${displayKey(current[index]?.value)}</kbd><em>изменить</em></button>`).join('')}
  function render(){const list=document.querySelector('#controlsList');if(list)list.innerHTML=rows();list?.querySelectorAll('[data-control-index]').forEach((button)=>button.addEventListener('click',()=>beginCapture(Number(button.dataset.controlIndex),button)))}
  function beginCapture(index,button){editingIndex=index;document.querySelectorAll('.control-row').forEach((row)=>row.classList.remove('listening'));button.classList.add('listening');button.querySelector('kbd').textContent='НАЖМИТЕ КЛАВИШУ'}
  function normalizeEventKey(event){if(['Control','Alt','Meta','CapsLock','Escape'].includes(event.key))return null;return SPECIAL[event.key]||String(event.key||'').toLowerCase()}
  function handleKey(event){if(editingIndex===null)return;event.preventDefault();event.stopPropagation();const key=normalizeEventKey(event);if(!key)return;current[editingIndex]={...(current[editingIndex]||{}),value:key};editingIndex=null;render()}
  function save(scope='game'){if(!game||!current)return;localStorage.setItem(scope==='system'?systemStorageKey():storageKey(),JSON.stringify(current));const msg=document.querySelector('#controlsMessage');if(msg)msg.textContent=scope==='system'?'Сохранено для всей платформы. Перезапустите игру.':'Сохранено для этой игры. Перезапустите игру.'}
  function reset(){if(!game)return;localStorage.removeItem(storageKey());current=mergedControls(game);render()}
  function open(targetGame){game=targetGame;current=mergedControls(game);const modal=document.querySelector('#controlsModal');const title=document.querySelector('#controlsTitle');const scheme=document.querySelector('#controlsScheme');if(title)title.textContent=`Управление · ${game.title}`;if(scheme)scheme.textContent=summary(game);if(modal){modal.hidden=false;document.body.classList.add('modal-open')}render()}
  function close(){editingIndex=null;const modal=document.querySelector('#controlsModal');if(modal)modal.hidden=true;document.body.classList.remove('modal-open')}

  document.addEventListener('keydown',handleKey,true);
  document.addEventListener('click',(event)=>{if(event.target.closest('#controlsClose')||event.target.matches('#controlsModal'))close();if(event.target.closest('#controlsSaveGame'))save('game');if(event.target.closest('#controlsSaveSystem'))save('system');if(event.target.closest('#controlsReset'))reset()});
  window.RetroControls={getEJSControls:ejsObject,open,close,reset,preview,summary,profileFor};
})();
