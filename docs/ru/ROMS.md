# Игры, BIOS, обложки и скриншоты

Retro Portal специально разделяет **код проекта** и **пользовательский игровой контент**. Коммерческие ROM, BIOS и официальные обложки не хранятся в Git.

## Рекомендуемая структура

```text
games/roms/
├── megadrive/
├── ps1/
└── dreamcast/

games/bios/
├── ps1/
└── dreamcast/

public/covers/library/
public/screenshots/library/
```

Каталог поддерживает вложенные пути, поэтому нет необходимости складывать сотни файлов в один каталог.

## Реальные обложки

Карточка игры использует `cover` из `catalog/games.json`. Для коммерческих игр используйте artwork, который вы имеете право хранить на своём сервере. Если задан `screenshots`, первый screenshot мягко появляется поверх box-art при наведении.

Пример:

```json
{
  "id": "sonic-2",
  "gameId": 21001,
  "title": "Sonic the Hedgehog 2",
  "system": "Mega Drive",
  "core": "segaMD",
  "rom": "megadrive/sonic-the-hedgehog-2.bin",
  "cover": "/covers/library/sonic-the-hedgehog-2.webp",
  "screenshots": ["/screenshots/library/sonic-the-hedgehog-2.webp"],
  "tags": ["platformer", "multiplayer"]
}
```

## Curated presets

`catalog/presets/curated-classics.json` содержит подготовленные записи для стартовой коллекции. Файлы игр туда не входят.

Скопируйте свои ROM/BIOS/artwork под ожидаемыми именами, затем:

```bash
./scripts/sync-classics.sh
```

По умолчанию запись импортируется только если найдены ROM, cover и все требуемые BIOS. Для просмотра всех карточек даже без файлов можно выполнить:

```bash
./scripts/sync-classics.sh all
```

Для production лучше использовать обычный режим без `all`.

## PS1

Для preset используется один пример BIOS-пути:

```text
games/bios/ps1/scph5501.bin
```

Если у вас другой подходящий BIOS, измените поле `bios` в preset или рабочем каталоге. Образы удобно хранить в CHD там, где выбранный core его поддерживает.

## Dreamcast

Dreamcast требует два BIOS-файла в preset:

```text
games/bios/dreamcast/dc_boot.bin
games/bios/dreamcast/dc_flash.bin
```

Сам runtime пока экспериментальный. См. [DREAMCAST.md](DREAMCAST.md).

## Добавление игры вручную

```bash
./scripts/add-game.sh
```

После любых ручных изменений:

```bash
./scripts/catalog-check.py
```

## Бесплатные demo-ROM

Шесть MIT-лицензированных Mega Drive homebrew игр можно установить командой:

```bash
./scripts/install-homebrew-roms.sh
```

Это Tank Battle, Battle 4Tris, Pong, Snake Arena, Space Shooter и Breakout.