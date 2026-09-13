# Dreamcast experimental status

Mega Drive and PlayStation use the normal EmulatorJS path. Dreamcast is different because it is not part of EmulatorJS's standard supported-system list.

The project is prepared for `flycast-wasm`: the backend understands `engine: "flycast-wasm"`, multiple BIOS files, Dreamcast catalog entries and the COOP/COEP headers needed by threaded WASM.

The runtime is intentionally not enabled by default yet. Dreamcast entries in the curated preset currently cover Crazy Taxi, Soulcalibur, Sonic Adventure and Jet Set Radio, but the user must provide legally obtained game images and BIOS files.

Planned path:

```text
Flycast WASM
 → version-pinned installer
 → custom core registration
 → BIOS validation
 → compatibility tests
 → optional experimental install flag
```

Source project: https://github.com/nasomers/flycast-wasm