(() => {
  const dot = document.querySelector('#statusDot');
  const conn = document.querySelector('#connection');
  const online = document.querySelector('#online');
  const onlineStat = document.querySelector('#onlineStat');
  let socket = null;
  let retry = null;
  let currentGame = null;

  function createSecurePresenceId() {
    const cryptoApi = globalThis.crypto;
    if (typeof cryptoApi?.randomUUID === 'function') return cryptoApi.randomUUID();
    if (typeof cryptoApi?.getRandomValues !== 'function') return null;

    const bytes = new Uint8Array(16);
    cryptoApi.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0'));
    return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10).join('')}`;
  }

  let sessionId = localStorage.getItem('retroPortal.presenceId');
  if (!sessionId) {
    sessionId = createSecurePresenceId();
    if (sessionId) localStorage.setItem('retroPortal.presenceId', sessionId);
  }

  function renderState(state, live) {
    if (conn) conn.textContent = state === 'live' ? 'В СЕТИ' : state === 'connecting' ? 'ПОДКЛЮЧАЕМ' : 'ВОЗВРАЩАЕМ СВЯЗЬ';
    if (dot) dot.className = live ? 'live' : '';
  }
  function send(payload) { if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(payload)); }
  function connect() {
    clearTimeout(retry);
    if (!['http:', 'https:'].includes(location.protocol)) return;
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    socket = new WebSocket(`${protocol}//${location.host}/ws/presence`);
    renderState('connecting', false);
    socket.onopen = () => {
      renderState('live', true);
      if (sessionId) send({ type: 'hello', sessionId });
      if (currentGame) send({ type: 'playing', gameId: currentGame });
    };
    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type !== 'presence') return;
        if (online) online.textContent = message.online ?? 0;
        if (onlineStat) onlineStat.textContent = message.online ?? 0;
        window.dispatchEvent(new CustomEvent('arcade:presence', { detail: message }));
      } catch {}
    };
    socket.onclose = () => { renderState('reconnecting', false); retry = setTimeout(connect, 1800); };
    socket.onerror = () => socket.close();
  }
  window.RetroPresence = {
    sessionId,
    playing(gameId) { currentGame = gameId || null; if (currentGame) send({ type: 'playing', gameId: currentGame }); else send({ type: 'idle' }); },
    idle() { currentGame = null; send({ type: 'idle' }); }
  };
  connect();
  setInterval(() => send({ type: 'ping', ts: Date.now() }), 20000);
})();
