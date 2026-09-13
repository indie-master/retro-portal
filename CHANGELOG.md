# Changelog

## 0.6.0 — Library Experience Update

- rebuilt the home page around the actual game library instead of emulator internals;
- added visible Mega Drive, PlayStation and Dreamcast shelves plus a separate Demo / Homebrew section;
- added 16 curated classics as installable catalog cards without distributing commercial ROMs, BIOS or official artwork;
- added clear `Play`, `Add ROM`, `BIOS required` and `Experimental` states;
- replaced the blurry raster hero with a resolution-independent CSS CRT / warm-room illustration;
- added title-specific cover fallbacks so missing user artwork never renders as broken images;
- fixed library/back/exit navigation on both Nginx and GitHub Pages;
- added fullscreen controls and gamepad connection feedback;
- simplified public-facing copy: no WASM/WebSocket/SRAM jargon on the first screen;
- GitHub Pages now mirrors the production library UI and builds its catalog from `catalog/games.json`;
- added CI checks for shell/JS/JSON/catalog/Docker/Nginx/README assets and links;
- screenshot workflow now fails on non-200 pages and verifies generated images;
- bumped project version to `0.6.0`.

## 0.5.0

- repaired missing repository docs and screenshot assets;
- added redistributable homebrew ROMs to the public repository;
- added a buildable `gh-pages` branch and public playable demo;
- pinned EmulatorJS upstream and improved repository completeness checks.

## 0.4.0 — warm pixel UI

- интерфейс главной и локального ROM-плеера приведён к утверждённому warm-retro макету;
- добавлены реальные визуальные hero-assets из утверждённых референсов;
- библиотека переведена на компактную 3-колоночную аркадную сетку;
- сохранена поддержка реальных cover/screenshot assets для пользовательской библиотеки;
- GitHub metadata и quick-start обновлены для `indie-master/retro-portal`.

## 0.3.0

- Reworked the entire UI toward a warmer CRT / living-room retro style with subtle 8-bit details.
- Added platform shelves, search and a dedicated multiplayer filter.
- Added real box-art + optional gameplay screenshot support.
- Added nested ROM/BIOS paths for cleaner large libraries.
- Added curated metadata presets for selected Mega Drive, PlayStation and experimental Dreamcast titles.
- Added `scripts/sync-classics.sh`, importing only titles whose ROM, cover and required BIOS are actually present.
- Added multi-file BIOS validation in the backend.
- Added explicit `engine` metadata and experimental Dreamcast catalog handling.

## 0.2.0

- GitHub-ready repository layout, installation modes, Nginx detection, TLS workflows and diagnostics.

## 0.1.0

- Initial browser retro portal with EmulatorJS, homebrew demo catalog and WebSocket presence.
