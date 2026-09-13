# Changelog

## 0.5.0 — complete GitHub distribution

- исправлены отсутствующие `docs/` и 404-ссылки в README;
- добавлены полноценные RU/EN руководства по установке, Nginx/TLS, ROM/BIOS, Dreamcast и диагностике;
- шесть MIT-лицензированных Mega Drive homebrew ROM теперь реально хранятся в репозитории;
- installer demo-ROM переведён на проверенные prebuilt release assets с SHA256 validation;
- EmulatorJS v4.2.3 закреплён как upstream submodule, production installer по-прежнему разворачивает runtime автоматически;
- добавлен GitHub Pages demo workflow с EmulatorJS и playable homebrew games;
- добавлена автоматическая генерация README screenshots непосредственно из работающего портала через Playwright;
- README переведён на реальные `home.png` / `local-rom.png` и дополнен live-demo ссылкой;
- curated commercial library документирована точными ожидаемыми путями без распространения коммерческих ROM/BIOS/artwork.

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
