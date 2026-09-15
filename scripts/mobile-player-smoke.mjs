import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

class FakeClassList {
  constructor() { this.values = new Set(); }
  add(...names) { names.forEach((name) => this.values.add(name)); }
  remove(...names) { names.forEach((name) => this.values.delete(name)); }
  contains(name) { return this.values.has(name); }
  toggle(name, force) {
    const active = force === undefined ? !this.values.has(name) : Boolean(force);
    if (active) this.values.add(name); else this.values.delete(name);
    return active;
  }
}

class FakeElement {
  constructor(id = '') {
    this.id = id;
    this.classList = new FakeClassList();
    this.listeners = new Map();
    this.hidden = false;
    this.textContent = '';
  }

  addEventListener(type, callback) { this.listeners.set(type, callback); }
  closest() { return new FakeElement(); }
  remove() { this.removed = true; }
  async fire(type, event = {}) { return this.listeners.get(type)?.({ target: this, ...event }); }
}

const game = {
  id: 'tekken-3',
  gameId: 22001,
  title: 'Tekken 3',
  system: 'PlayStation',
  core: 'psx',
  controlScheme: 'psx',
  romUrl: '/roms/ps1/tekken-3.chd',
  biosUrl: '/bios/ps1/scph5501.bin',
  playable: true
};

function createEnvironment({ touch, nativeFullscreen }) {
  const ids = [
    'gameTitle', 'gameSystem', 'playerNotice', 'gameFrame', 'fullscreenGame',
    'controlsOpen', 'gamepadNotice', 'controlsGamepadStatus', 'gameInfo',
    'gameDescription', 'gameHistory', 'historyCard', 'reloadGame'
  ];
  const elements = Object.fromEntries(ids.map((id) => [id, new FakeElement(id)]));
  elements.playerNotice.hidden = true;
  const appendedScripts = [];
  const documentListeners = new Map();
  const windowListeners = new Map();
  const body = new FakeElement('body');
  body.appendChild = (element) => { if (element.tagName === 'SCRIPT') appendedScripts.push(element); };
  const document = {
    body,
    title: '',
    fullscreenElement: null,
    webkitFullscreenElement: null,
    querySelector: (selector) => elements[selector.replace(/^#/, '')] || null,
    createElement: (tag) => Object.assign(new FakeElement(), { tagName: tag.toUpperCase() }),
    addEventListener: (type, callback) => documentListeners.set(type, callback),
    async exitFullscreen() {
      this.fullscreenElement = null;
      documentListeners.get('fullscreenchange')?.();
    }
  };
  if (nativeFullscreen) {
    elements.gameFrame.requestFullscreen = async () => {
      document.fullscreenElement = elements.gameFrame;
      documentListeners.get('fullscreenchange')?.();
    };
  }
  const window = {
    crossOriginIsolated: true,
    addEventListener: (type, callback) => windowListeners.set(type, callback),
    RetroPresence: { sessionId: 'test-session', playing() {}, idle() {} },
    RetroControls: { getEJSControls: () => ({ 0: {}, 1: {}, 2: {}, 3: {} }), open() {} }
  };
  const context = {
    window,
    document,
    location: { search: '?id=tekken-3', reload() {} },
    navigator: { maxTouchPoints: touch ? 5 : 0, getGamepads: () => [] },
    matchMedia: () => ({ matches: touch }),
    screen: { orientation: { async lock() {}, unlock() {} } },
    fetch: async (url) => {
      if (String(url).startsWith('/api/games/')) return { ok: true, status: 200, json: async () => ({ game }) };
      return { ok: true, status: 204, json: async () => ({}) };
    },
    URLSearchParams,
    encodeURIComponent,
    console,
    setTimeout,
    clearTimeout
  };
  window.window = window;
  return { context, elements, body, document, appendedScripts };
}

const source = await fs.readFile(new URL('../public/game.js', import.meta.url), 'utf8');
for (const removed of ['mobileMode', 'mobileExit', 'launchGuide', 'Подождите', 'Поверните', 'Готово.']) {
  assert.equal(source.includes(removed), false, `removed player UI must stay absent: ${removed}`);
}

const mobile = createEnvironment({ touch: true, nativeFullscreen: true });
await vm.runInNewContext(source, mobile.context, { filename: 'public/game.js' });
await new Promise((resolve) => setTimeout(resolve, 0));
assert.equal(mobile.appendedScripts.length, 1, 'mobile should start the runtime without a separate launch screen');
assert.equal(mobile.elements.playerNotice.hidden, true, 'normal loading must not show a notice banner');
assert.equal(mobile.elements.playerNotice.textContent, '', 'normal loading must not write status copy');
assert.equal(mobile.context.window.EJS_threads, false, 'mobile PlayStation should avoid threaded peak memory overhead');
assert.equal(mobile.context.window.EJS_CacheLimit, 0, 'mobile PlayStation should not create a second ROM cache copy');
assert.equal(mobile.context.window.EJS_mobileDiscStream, true, 'mobile PlayStation CHD should use range streaming');
assert.equal(mobile.context.window.EJS_VirtualGamepadSettings.some((item) => item.id === 'cross'), true);
assert.equal(mobile.appendedScripts[0].src, '/emulatorjs-mobile-loader.js');
await mobile.elements.fullscreenGame.fire('click');
assert.equal(mobile.document.fullscreenElement, mobile.elements.gameFrame, 'fullscreen button should request native fullscreen directly');
await mobile.elements.fullscreenGame.fire('click');
assert.equal(mobile.document.fullscreenElement, null, 'the same button should exit native fullscreen');

const fallback = createEnvironment({ touch: true, nativeFullscreen: false });
await vm.runInNewContext(source, fallback.context, { filename: 'public/game.js' });
await new Promise((resolve) => setTimeout(resolve, 0));
await fallback.elements.fullscreenGame.fire('click');
assert.equal(fallback.body.classList.contains('player-fullscreen-fallback'), true, 'unsupported mobile browsers should receive the clean viewport fallback');
assert.match(fallback.elements.fullscreenGame.textContent, /ВЫЙТИ ИЗ ЭКРАНА/);
await fallback.elements.fullscreenGame.fire('click');
assert.equal(fallback.body.classList.contains('player-fullscreen-fallback'), false, 'the same fullscreen button should close the fallback');

const desktop = createEnvironment({ touch: false, nativeFullscreen: true });
await vm.runInNewContext(source, desktop.context, { filename: 'public/game.js' });
await new Promise((resolve) => setTimeout(resolve, 0));
assert.equal(desktop.appendedScripts.length, 1, 'desktop automatic startup should remain intact');
assert.equal(desktop.context.window.EJS_threads, true);
assert.equal(desktop.context.window.EJS_CacheLimit, 1024 * 1024 * 1024);
assert.equal(desktop.context.window.EJS_mobileDiscStream, false);
assert.equal(desktop.appendedScripts[0].src, '/emulatorjs/data/loader.js');

console.log('Simple mobile player smoke checks passed.');
