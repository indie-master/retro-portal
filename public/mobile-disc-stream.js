/*
 * Retro Portal mobile disc streaming extension for EmulatorJS 4.2.3.
 *
 * EmulatorJS normally downloads a disc image into one ArrayBuffer and then
 * copies it into MEMFS.  Large PS1 images can therefore exceed WebKit's page
 * memory budget.  For same-origin CHD/PBP files this extension preallocates the
 * MEMFS file and fills it with small HTTP range requests instead.
 */
(() => {
  if (typeof EmulatorJS !== 'function') return;

  const originalDownloadRom = EmulatorJS.prototype.downloadRom;
  const CHUNK_BYTES = 8 * 1024 * 1024;
  const STREAMABLE_EXTENSIONS = new Set(['chd', 'pbp']);

  function discExtension(value) {
    try {
      const pathname = new URL(String(value), location.href).pathname;
      return pathname.split('.').pop().toLowerCase();
    } catch {
      return '';
    }
  }

  function fail(instance, message, error) {
    console.error(message, error || '');
    instance.startGameError(message);
    return new Promise(() => {});
  }

  EmulatorJS.prototype.downloadRom = async function downloadMobileDisc() {
    const url = this.config.gameUrl;
    if (!this.config.mobileDiscStream || typeof url !== 'string' || !STREAMABLE_EXTENSIONS.has(discExtension(url))) {
      return originalDownloadRom.call(this);
    }

    const absoluteUrl = new URL(url, location.href);
    if (absoluteUrl.origin !== location.origin) return originalDownloadRom.call(this);

    const fs = this.gameManager?.FS;
    if (!fs?.open || !fs?.allocate || !fs?.write || !fs?.close) {
      return fail(this, 'Браузер не поддерживает безопасную загрузку большого образа PlayStation.');
    }

    this.textElem.innerText = this.localization('Download Game Data');
    let stream = null;
    let fileName = this.getBaseFileName(true);

    try {
      const head = await fetch(absoluteUrl.href, {
        method: 'HEAD',
        cache: 'no-store',
        credentials: 'same-origin'
      });
      const total = Number(head.headers.get('content-length'));
      if (!head.ok || !Number.isSafeInteger(total) || total <= 0) throw new Error('Missing Content-Length');

      try { if (fs.analyzePath?.(fileName)?.exists) fs.unlink(fileName); } catch {}
      stream = fs.open(fileName, 'w+');
      fs.allocate(stream, 0, total);

      for (let start = 0; start < total; start += CHUNK_BYTES) {
        const end = Math.min(start + CHUNK_BYTES, total) - 1;
        const response = await fetch(absoluteUrl.href, {
          headers: { Range: `bytes=${start}-${end}` },
          cache: 'no-store',
          credentials: 'same-origin'
        });
        const expectedRange = `bytes ${start}-${end}/${total}`;
        if (response.status !== 206 || response.headers.get('content-range') !== expectedRange) {
          throw new Error(`Invalid range response: ${response.status} ${response.headers.get('content-range') || ''}`);
        }
        const chunk = new Uint8Array(await response.arrayBuffer());
        const expectedBytes = end - start + 1;
        if (chunk.byteLength !== expectedBytes) throw new Error(`Short range response: ${chunk.byteLength}/${expectedBytes}`);
        const written = fs.write(stream, chunk, 0, chunk.byteLength, start);
        if (written !== chunk.byteLength) throw new Error(`Short MEMFS write: ${written}/${chunk.byteLength}`);
        this.textElem.innerText = `${this.localization('Download Game Data')} ${Math.floor((end + 1) / total * 100)}%`;
      }

      fs.close(stream);
      stream = null;
      this.fileName = fileName;
    } catch (error) {
      try { if (stream) fs.close(stream); } catch {}
      try { if (fileName && fs.analyzePath?.(fileName)?.exists) fs.unlink(fileName); } catch {}
      return fail(this, 'Не удалось загрузить образ PlayStation по частям. Обновите страницу и попробуйте ещё раз.', error);
    }
  };
})();
