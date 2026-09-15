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
    this.style = {};
    this.hidden = false;
    this.disabled = false;
    this.textContent = '';
    this.innerHTML = '';
  }

  addEventListener(type, callback) { this.listeners.set(type, callback); }
  closest() { return new FakeElement(); }
  remove() { this.removed = true; }
  async fire(type) { return this.listeners.get(type)?.({ target: this }); }
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
  romBytes: 463470592,
  romFormat: 'chd',
  year: '1998',
  players: '1–2 игрока',
  description: 'Test description',
  history: 'Test history',
  playable: true
};

function createEnvironment(touch) {
  const ids = [
    'gameTitle', 'gameSystem', 'playerNotice', 'gameFrame', 'fullscreenGame', 'mobileMode',
    'mobileExit', 'playGame', 'controlsOpen', 'gamepadNotice', 'gamepadStatus',
    'controlsGamepadStatus', 'controlPreview', 'launchGuide', 'launchGuideEyebrow',
    'launchGuideTitle', 'launchGuideText', 'gameInfo', 'gameDescription', 'gameHistory',
    'historyCard', 'reloadGame'
  ];
  const elements = Object.fromEntries(ids.map((id) => [id, new FakeElement(id)]));
  elements.playGame.disabled = true;
  elements.mobileMode.disabled = true;
  const appendedScripts = [];
  const documentListeners = new Map();
  const windowListeners = new Map();
  const body = new FakeElement('body');
  body.appendChild = (element) => { if (element.tagName === 'SCRIPT') appendedScripts.push(element); };
  const rootStyle = new Map();
  const documentElement = new FakeElement('html');
  documentElement.style = { setProperty: (name, value) => rootStyle.set(name, value) };
  const document = {
    body,
    documentElement,
    title: '',
    fullscreenElement: null,
    webkitFullscreenElement: null,
    querySelector: (selector) => elements[selector.replace(/^#/, '')] || null,
    createElement: (tag) => Object.assign(new FakeElement(), { tagName: tag.toUpperCase() }),
    addEventListener: (type, callback) => documentListeners.set(type, callback)
  };
  const window = {
    innerWidth: touch ? 844 : 1280,
    innerHeight: touch ? 390 : 720,
    scrollY: 120,
    crossOriginIsolated: true,
    visualViewport: { height: touch ? 390 : 720, addEventListener() {} },
    addEventListener: (type, callback) => windowListeners.set(type, callback),
    scrollTo() {},
    RetroPresence: { sessionId: 'test-session', playing() {}, idle() {} },
    RetroControls: {
      preview: () => [{ action: 'D-pad', key: 'Стрелки' }],
      getEJSControls: () => ({ 0: {}, 1: {}, 2: {}, 3: {} }),
      open() {}
    }
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
  return { context, elements, body, appendedScripts, rootStyle };
}

const source = await fs.readFile(new URL('../public/game.js', import.meta.url), 'utf8');

const mobile = createEnvironment(true);
await vm.runInNewContext(source, mobile.context, { filename: 'public/game.js' });
assert.equal(mobile.appendedScripts.length, 0, 'touch devices must not download the ROM during page boot');
assert.equal(mobile.elements.playGame.disabled, false, 'mobile play action should become available after catalog load');
assert.equal(mobile.elements.mobileMode.disabled, false, 'mobile mode action should become available after catalog load');
assert.match(mobile.elements.playerNotice.textContent, /ROM пока не загружается/);

await mobile.elements.playGame.fire('click');
assert.equal(mobile.appendedScripts.length, 1, 'one user gesture should load one EmulatorJS runtime');
assert.equal(mobile.appendedScripts[0].src, '/emulatorjs/data/loader.js');
assert.equal(mobile.body.classList.contains('mobile-playing'), true, 'mobile overlay should survive unavailable native fullscreen');
assert.equal(mobile.context.window.EJS_gameID, 22001);
assert.equal(mobile.context.window.EJS_threads, false, 'mobile PlayStation should avoid threaded peak memory overhead');
assert.equal(mobile.context.window.EJS_CacheLimit, 8 * 1024 * 1024, 'large mobile disc images should not be copied to EmulatorJS ROM cache');
assert.equal(mobile.context.window.EJS_browserMode, 'mobile');
assert.equal(mobile.context.window.EJS_VirtualGamepadSettings.some((item) => item.id === 'cross' && item.input_value === 0), true);
assert.equal(mobile.context.window.EJS_VirtualGamepadSettings.some((item) => item.id === 'triangle' && item.input_value === 9), true);
assert.equal(mobile.context.window.EJS_VirtualGamepadSettings.some((item) => item.id?.startsWith('speed_')), false);
assert.equal(mobile.rootStyle.get('--player-vh'), '390px');

await mobile.elements.playGame.fire('click');
assert.equal(mobile.appendedScripts.length, 1, 'repeat taps must not inject duplicate runtimes');
await mobile.elements.mobileExit.fire('click');
assert.equal(mobile.body.classList.contains('mobile-playing'), false, 'mobile exit should restore the page without reloading');

const desktop = createEnvironment(false);
await vm.runInNewContext(source, desktop.context, { filename: 'public/game.js' });
assert.equal(desktop.appendedScripts.length, 1, 'desktop should preserve automatic startup');
assert.equal(desktop.context.window.EJS_threads, true, 'desktop may use cross-origin-isolated threaded runtime');
assert.equal(desktop.context.window.EJS_CacheLimit, 1024 * 1024 * 1024);

console.log('Mobile player smoke checks passed.');
