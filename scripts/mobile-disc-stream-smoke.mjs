import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

const totalBytes = 20 * 1024 * 1024 + 317;
const target = new Uint8Array(totalBytes);
const requests = [];
let fallbackCalls = 0;

class EmulatorJS {
  async downloadRom() { fallbackCalls += 1; }
}

class TestHeaders {
  constructor(values) { this.values = Object.fromEntries(Object.entries(values).map(([key, value]) => [key.toLowerCase(), String(value)])); }
  get(name) { return this.values[String(name).toLowerCase()] ?? null; }
}

async function fakeFetch(url, options = {}) {
  requests.push({ url: String(url), options });
  if (options.method === 'HEAD') {
    return { ok: true, status: 200, headers: new TestHeaders({ 'content-length': totalBytes }) };
  }
  const match = String(options.headers?.Range || '').match(/^bytes=(\d+)-(\d+)$/);
  assert.ok(match, 'disc GET must use an explicit byte range');
  const start = Number(match[1]);
  const end = Number(match[2]);
  const bytes = Uint8Array.from({ length: end - start + 1 }, (_, index) => (start + index) % 251);
  return {
    ok: true,
    status: 206,
    headers: new TestHeaders({ 'content-range': `bytes ${start}-${end}/${totalBytes}` }),
    arrayBuffer: async () => bytes.buffer
  };
}

const source = await fs.readFile(new URL('../public/mobile-disc-stream.js', import.meta.url), 'utf8');
vm.runInNewContext(source, {
  EmulatorJS,
  fetch: fakeFetch,
  location: { href: 'https://arcade.example/game.html?id=test', origin: 'https://arcade.example' },
  URL,
  Uint8Array,
  Set,
  Number,
  String,
  Promise,
  console
});

const fileSystem = {
  exists: false,
  analyzePath() { return { exists: this.exists }; },
  open(name) { this.exists = true; this.name = name; return { name }; },
  allocate(stream, offset, length) { assert.equal(offset, 0); assert.equal(length, totalBytes); this.stream = stream; },
  write(stream, chunk, offset, length, position) {
    assert.equal(stream, this.stream);
    target.set(chunk.subarray(offset, offset + length), position);
    return length;
  },
  close() {},
  unlink() { this.exists = false; }
};

const instance = new EmulatorJS();
instance.config = { gameUrl: '/roms/ps1/test.chd', mobileDiscStream: true };
instance.gameManager = { FS: fileSystem };
instance.textElem = { innerText: '' };
instance.localization = () => 'Скачивание игровых данных';
instance.getBaseFileName = () => 'test.chd';
instance.startGameError = (message) => { throw new Error(message); };
await instance.downloadRom();

assert.equal(instance.fileName, 'test.chd');
assert.equal(requests[0].options.method, 'HEAD');
assert.equal(requests.filter((item) => item.options.headers?.Range).length, 3, '20 MiB image should be loaded in three 8 MiB ranges');
assert.equal(target[0], 0);
assert.equal(target[8 * 1024 * 1024], (8 * 1024 * 1024) % 251);
assert.equal(target.at(-1), (totalBytes - 1) % 251);
assert.match(instance.textElem.innerText, /100%$/);
assert.equal(fallbackCalls, 0);

const cartridge = new EmulatorJS();
cartridge.config = { gameUrl: '/roms/md/test.md', mobileDiscStream: true };
await cartridge.downloadRom();
assert.equal(fallbackCalls, 1, 'non-disc formats must retain the upstream loader');

const loaderSource = await fs.readFile(new URL('../public/emulatorjs-mobile-loader.js', import.meta.url), 'utf8');
assert.match(loaderSource, /mobileDiscStream: window\.EJS_mobileDiscStream === true/);
assert.match(loaderSource, /mobile-disc-stream\.js/);
assert.doesNotMatch(loaderSource, /https:\/\/cdn\.emulatorjs\.org/);

console.log('Mobile disc range streaming smoke checks passed.');
