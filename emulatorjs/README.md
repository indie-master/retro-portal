# EmulatorJS runtime

Retro Portal uses [EmulatorJS](https://github.com/EmulatorJS/EmulatorJS) for browser emulation.

The project pins **EmulatorJS v4.2.3**. Runtime files are installed automatically during deployment:

```bash
./scripts/install-emulatorjs.sh 4.2.3
```

This creates:

```text
emulatorjs/data/loader.js
emulatorjs/data/cores/...
emulatorjs/data/*.wasm
```

The full generated runtime bundle is not duplicated in Git history; the upstream source is pinned separately under `vendor/emulatorjs-upstream` as a Git submodule.