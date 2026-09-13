# Dreamcast: экспериментальный статус

В обычном Retro Portal Mega Drive / PS1 запускаются через стабильный путь EmulatorJS. Dreamcast устроен иначе: EmulatorJS не включает Dreamcast в стандартный список систем.

В 2026 году проект `nasomers/flycast-wasm` выпустил Flycast WASM v1.0 — браузерный libretro core с SH4→WebAssembly JIT. Он требует cross-origin isolation (`COOP/COEP`), собственные `dc_boot.bin` / `dc_flash.bin` и образы игр.

Retro Portal уже подготовлен к этому направлению:

- backend понимает `engine: "flycast-wasm"`;
- поддерживается массив BIOS-файлов;
- Dreamcast входит в фильтры библиотеки;
- curated preset содержит Crazy Taxi, Soulcalibur, Sonic Adventure и Jet Set Radio;
- Nginx уже отдаёт COOP/COEP headers, необходимые для WASM/threads.

Но runtime намеренно **не включён автоматически**. Интеграция кастомного Flycast core пока менее предсказуема, чем штатные EmulatorJS cores. Launcher при попытке запустить Dreamcast покажет понятное сообщение вместо белого экрана.

План интеграции:

```text
Flycast WASM
   ↓
version-pinned installer
   ↓
custom core registration
   ↓
Dreamcast BIOS validation
   ↓
Crazy Taxi / Soulcalibur compatibility tests
   ↓
optional experimental flag in installer
```

Исходный проект: https://github.com/nasomers/flycast-wasm