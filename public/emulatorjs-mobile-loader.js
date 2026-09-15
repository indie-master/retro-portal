/*
 * Loads the pinned local EmulatorJS bootstrap and adds Retro Portal's mobile
 * disc range extension before EmulatorJS creates the player instance.
 */
(async function loadMobileEmulator() {
  const fail = (error) => {
    console.error('Mobile EmulatorJS loader failed', error);
    window.dispatchEvent(new CustomEvent('retro:emulator-error', { detail: error }));
  };

  try {
    const dataPath = String(window.EJS_pathtodata || '/emulatorjs/data/').replace(/\/?$/, '/');
    const response = await fetch(`${dataPath}loader.js`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`EmulatorJS loader HTTP ${response.status}`);
    const source = await response.text();
    const marker = '    const config = {};';
    if (!source.includes(marker)) throw new Error('Unsupported EmulatorJS loader version');

    const extension = [
      '    await new Promise((resolve, reject) => {',
      '        const script = document.createElement("script");',
      '        script.src = "/mobile-disc-stream.js";',
      '        script.onload = resolve;',
      '        script.onerror = () => {',
      '            const error = new Error("Failed to load mobile disc extension");',
      '            window.dispatchEvent(new CustomEvent("retro:emulator-error", { detail: error }));',
      '            reject(error);',
      '        };',
      '        document.head.appendChild(script);',
      '    });',
      '    const config = { mobileDiscStream: window.EJS_mobileDiscStream === true };'
    ].join('\n');
    const patchedSource = source.replace(marker, extension);
    const blobUrl = URL.createObjectURL(new Blob([patchedSource], { type: 'text/javascript' }));
    const script = document.createElement('script');
    script.src = blobUrl;
    script.onload = () => URL.revokeObjectURL(blobUrl);
    script.onerror = () => {
      URL.revokeObjectURL(blobUrl);
      fail(new Error('Failed to execute EmulatorJS loader'));
    };
    document.head.appendChild(script);
  } catch (error) {
    fail(error);
  }
})();
