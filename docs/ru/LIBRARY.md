# Управление библиотекой

Начиная с Retro Portal 0.7 владелец сервера и обычный игрок видят **разные интерфейсы**.

- `/` — публичный портал. Здесь отображаются **только полностью готовые к запуску игры**.
- `/local.html` — локальный ROM-плеер пользователя. Файл остаётся в браузере.
- `/admin.html` — панель владельца сервера для ROM, BIOS, диагностики и метаданных.

Обычный посетитель не должен видеть сообщения `НЕТ ROM`, `НУЖЕН BIOS` или пути на сервере.

## Первый вход в Library Manager

При первом запуске backend создаёт случайный admin-token, если `ADMIN_TOKEN` не задан в `.env`.

Посмотреть автоматически созданный токен:

```bash
cat catalog/admin-token
```

Откройте:

```text
https://ваш-домен/admin.html
```

и вставьте токен. В браузере он хранится только в `sessionStorage` текущей вкладки.

Можно задать собственный токен в `.env`:

```ini
ADMIN_TOKEN=очень-длинная-случайная-строка
```

После изменения `.env`:

```bash
docker compose up -d
```

## Самый простой способ добавить игру

1. Откройте `/admin.html`.
2. Выберите ROM.
3. Для однозначных форматов платформа определяется автоматически.
4. Для `.bin`, `.cue`, `.chd`, `.iso` выберите платформу вручную — эти расширения используются разными системами.
5. Нажмите **Загрузить ROM**.

Backend сохраняет файл в подходящую папку и сразу создаёт/обновляет карточку игры.

Например:

```text
Sonic the Hedgehog 2 (World).bin
```

при загрузке как Mega Drive окажется примерно здесь:

```text
games/roms/megadrive/Sonic the Hedgehog 2 (World).bin
```

Если название совпадает с одной из игр в `catalog/presets/curated-classics.json`, автоматически применяются подготовленные метаданные. Для неизвестной игры название создаётся из имени файла, и карточка всё равно появляется без ручного редактирования JSON.

## Большие PS1 / Dreamcast образы

Большие CHD/GDI удобнее копировать через SCP/SFTP:

```text
games/roms/megadrive/
games/roms/ps1/
games/roms/dreamcast/
games/roms/nes/
games/roms/snes/
games/roms/gb/
games/roms/gba/
games/roms/n64/
games/roms/arcade/
```

После копирования откройте `/admin.html` и нажмите **Сканировать**.

Менеджер рекурсивно найдёт новые файлы и создаст карточки.

## Что происходит после загрузки

Library Manager проверяет цепочку:

```text
ROM найден?
    ↓
Нужен BIOS?
    ↓
BIOS найден?
    ↓
Runtime системы готов?
    ↓
READY → игра появляется на публичном портале
```

Пока любой обязательный пункт не выполнен, игру видит только администратор.

## PlayStation BIOS

Для PlayStation EmulatorJS использует настоящий PS1 BIOS. Library Manager умеет узнавать несколько распространённых BIOS по MD5 и автоматически давать им каноническое имя.

Поддерживаются, в частности:

```text
scph5500.bin — JP
scph5501.bin — US
scph5502.bin — EU
PSXONPSP660.bin
scph101.bin
scph7001.bin
scph1001.bin
```

Если конкретная карточка ожидает, например:

```text
games/bios/ps1/scph5501.bin
```

панель прямо покажет этот путь.

## Dreamcast

Для текущего experimental-профиля ожидаются:

```text
games/bios/dreamcast/dc_boot.bin
games/bios/dreamcast/dc_flash.bin
```

Dreamcast всё ещё считается experimental до окончательной интеграции браузерного Flycast runtime. Поэтому наличие ROM и BIOS само по себе пока не публикует такую игру для посетителей.

## Автоматические обложки и описания

Без внешнего metadata provider Retro Portal делает следующее:

1. пытается сопоставить ROM с локальным curated preset;
2. если совпадения нет — создаёт красивую fallback-карточку из имени файла;
3. игра уже появляется в Library Manager без ручного JSON.

Для автоматической загрузки описания, года, количества игроков и box-art можно подключить TheGamesDB.

В `.env`:

```ini
THEGAMESDB_API_KEY=ваш-api-key
```

Затем:

```bash
docker compose up -d
```

После этого в `/admin.html` появится действие **Подтянуть метаданные**.

API key хранится только на backend и не передаётся браузеру посетителя.

## Максимальный размер загрузки

По умолчанию web-upload ограничен 2 GiB:

```ini
MAX_UPLOAD_BYTES=2147483648
```

Для крупных Dreamcast-образов лучше использовать SCP/SFTP и сканирование папок, а не браузерный upload.

## Права файлов

Backend должен иметь право записи в:

```text
catalog/
games/roms/
games/bios/
public/covers/library/
```

Docker Compose запускает backend с `PUID/PGID` из `.env` (по умолчанию `1000:1000`). Если проект принадлежит другому пользователю, укажите его UID/GID:

```bash
id -u
id -g
```

и запишите значения:

```ini
PUID=1000
PGID=1000
```

## Диагностика

Проверить публичный каталог:

```bash
curl -s http://127.0.0.1:8088/api/games | jq
```

Он должен содержать только playable-игры.

Полный каталог доступен только с admin token:

```bash
TOKEN="$(cat catalog/admin-token)"
curl -s \
  -H "Authorization: Bearer $TOKEN" \
  http://127.0.0.1:8088/api/admin/games | jq
```

Запустить сканирование вручную:

```bash
curl -s -X POST \
  -H "Authorization: Bearer $TOKEN" \
  http://127.0.0.1:8088/api/admin/scan | jq
```

## Важно

Retro Portal не распространяет коммерческие ROM, BIOS или copyrighted artwork. Library Manager предназначен для управления файлами, которые владелец сервера вправе использовать.
