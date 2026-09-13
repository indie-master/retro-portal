(() => {
  const dot = document.querySelector('#statusDot');
  const conn = document.querySelector('#connection');
  const online = document.querySelector('#online');
  const onlineStat = document.querySelector('#onlineStat');
  let socket = null;
  let retry = null;
  let currentGame = null;

  function renderState(state, live) {
    if (conn) conn.textContent = state === 'live' ? 'В СЕТИ' : state === 'connecting' ? 'ПОДКЛЮЧАЕМ' : 'ВОЗВРАЩАЕМ СВЯЗЬ';
    if (dot) dot.className = live ? 'live' : '';
  }
  function send(payload) { if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(payload)); }
  function connect() {
    clearTimeout(retry);
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    socket = new WebSocket(`${protocol}//${location.host}/ws/presence`);
    renderState('connecting', false);
    socket.onopen = () => { renderState('live', true); if (currentGame) send({ type: 'playing', gameId: currentGame }); };
    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type !== 'presence') return;
        if (online) online.textContent = message.online ?? 0;
        if (onlineStat) onlineStat.textContent = message.online ?? 0;
        window.dispatchEvent(new CustomEvent('arcade:presence', { detail: message }));
      } catch {}
    };
    socket.onclose = () => { renderState('reconnecting', false); retry = setTimeout(connect, 1500); };
    socket.onerror = () => socket.close();
  }
  window.RetroPresence = {
    playing(gameId) { currentGame = gameId || null; if (currentGame) send({ type: 'playing', gameId: currentGame }); else send({ type: 'idle' }); },
    idle() { currentGame = null; send({ type: 'idle' }); }
  };
  connect();
  setInterval(() => send({ type: 'ping', ts: Date.now() }), 20000);
})();
