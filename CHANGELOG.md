# Changelog

## 0.8.0 — Controls, Activity & Security

- added a Retro Portal keyboard configuration layer using EmulatorJS `EJS_defaultControls` and per-platform control schemes;
- added per-game and per-platform keyboard profiles stored in the browser;
- added a player-side controls modal and clearer keyboard/gamepad UX;
- added unique-session online counting instead of raw WebSocket-tab counting;
- added persistent launch statistics, "playing now" and 7-day popularity APIs/UI;
- GitHub Pages now previews the complete activity interface with representative demo data;
- added game description and history panels on the player page;
- changed automatic metadata from immediate publication to a review workflow with pending proposals;
- added owner-side metadata approve/reject actions plus direct card editing from `/admin.html`;
- added optional Wikipedia historical-context proposals alongside TheGamesDB metadata/box-art;
- hardened external cover fetching with fixed-host allowlists, redirect rejection, time/size limits and image signature checks;
- hardened ROM uploads with platform allowlists, size limits, SHA-256-backed storage names and known-format signature checks;
- disabled ZIP browser upload by default and rejected browser-upload of multi-file CUE/GDI images;
- added admin authentication throttling and WebSocket same-origin/max-payload checks;
- hardened Docker containers with read-only roots, `no-new-privileges`, PID limits and dropped backend capabilities;
- added CSP, anti-clickjacking, permissions policy and Nginx API rate limiting;
- replaced decorative README badges with real links to MIT, Ubuntu, Docker and EmulatorJS documentation;
- expanded `SECURITY.md` with a threat model, trust boundaries and host-hardening guidance;
- refreshed RU/EN project documentation, networking notes and installation examples;
- bumped project version to `0.8.0`.

## 0.7.1 — Automatic metadata

- when a ROM is uploaded through Library Manager and TheGamesDB is configured, metadata enrichment now runs automatically;
- successful enrichment immediately updates the title/year/description/player count and local box-art;
- metadata lookup failures no longer block the ROM import: the generated/preset card remains usable and can be refreshed later;
- retained a manual **Update metadata** action for retries;
- bumped project version to `0.7.1`.

## 0.7.0 — Library Manager

- split the portal into a player-facing library and an owner-only `/admin.html` Library Manager;
- public `/api/games` now returns only games that are fully playable;
- removed missing-ROM/BIOS setup states from the public library;
- added protected admin APIs using `ADMIN_TOKEN`;
- added browser ROM uploads with upload progress and platform detection;
- added recursive server-side ROM folder scanning for collections copied through SCP/SFTP;
- added automatic catalog registration from ROM filenames and curated presets;
- added owner-only BIOS diagnostics with exact expected file paths;
- added known PlayStation BIOS MD5 recognition and canonical naming;
- added BIOS upload through the Library Manager;
- added optional TheGamesDB metadata / box-art enrichment without exposing the API key to visitors;
- added automatic persistent admin-token generation when no explicit token is configured;
- added configurable upload limit and backend PUID/PGID;
- GitHub Pages now shows only demo titles that are actually playable instead of unavailable commercial placeholders;
- added RU/EN Library Manager documentation;
- bumped project version to `0.7.0`.

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
