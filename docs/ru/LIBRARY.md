# Управление библиотекой

Владелец и игрок используют разные интерфейсы: `/` — публичная библиотека, `/game.html` — плеер, `/local.html` — локальный ROM без отправки на сервер, `/admin.html` — Library Manager.

## Первый вход

Если `ADMIN_TOKEN` не задан, backend создаёт случайный токен:

```bash
cat catalog/admin-token
```

Откройте `/admin.html` и вставьте его. В браузере токен хранится только в `sessionStorage` текущей вкладки.

## Добавление игры

1. Откройте `/admin.html`.
2. Выберите ROM и платформу, если формат неоднозначен.
3. Нажмите **Загрузить ROM**.

Backend проверяет расширение, размер и известные сигнатуры. Финальное имя файла основано на нормализованном названии и SHA-256. ZIP-upload по умолчанию выключен (`ALLOW_ZIP_ROMS=0`).

Для большой библиотеки можно скопировать файлы в `games/roms/<system>/` через SCP/SFTP и запустить **Сканировать**.

## Когда игра публикуется

Игра становится публичной только когда ROM, обязательный BIOS и runtime системы готовы. Диагностика отсутствующих компонентов остаётся в кабинете владельца.

## PlayStation BIOS

Library Manager распознаёт ряд распространённых PS1 BIOS по MD5 и сохраняет их под каноническими именами, включая `scph5500.bin`, `scph5501.bin`, `scph5502.bin`, `PSXONPSP660.bin`, `scph101.bin`, `scph7001.bin`, `scph1001.bin`.

## Dreamcast

Experimental-профиль ожидает:

```text
games/bios/dreamcast/dc_boot.bin
games/bios/dreamcast/dc_flash.bin
```

Dreamcast остаётся experimental до завершения browser-runtime интеграции.

## Автоматические обложки и описание

Начиная с 0.10 отдельный `metadata`-контейнер автоматически дооформляет импортированные игры. Он не принимает входящие соединения и общается с backend только внутри Docker-сети.

Алгоритм учитывает **и название, и платформу**:

1. название ROM очищается от region/revision/translation-хвостов и служебного hash-suffix;
2. при наличии `THEGAMESDB_API_KEY` worker определяет ID конкретной платформы и выполняет поиск с platform filter;
3. совпадение по названию проходит confidence-проверку, чтобы одноимённая игра другой консоли не была выбрана случайно;
4. Wikipedia используется как platform-qualified fallback для описания/истории;
5. для обложек worker сначала использует TheGamesDB box-art, затем системный репозиторий Libretro thumbnails, затем допустимое Wikipedia image;
6. изображение всё равно проходит существующий защищённый admin upload: лимит 8 MB и проверка JPG/PNG/WebP сигнатуры;
7. вручную отредактированные поля по умолчанию **не перезаписываются**.

Настройки:

```ini
THEGAMESDB_API_KEY=
WIKIPEDIA_METADATA=1
AUTO_METADATA=1
AUTO_METADATA_OVERWRITE=0
AUTO_METADATA_INTERVAL=600
AUTO_METADATA_BATCH=8
```

TheGamesDB API key необязателен: без него остаются Wikipedia + Libretro fallback. `AUTO_METADATA_OVERWRITE=1` включайте только если сознательно хотите позволить worker заменять уже заполненные владельцем поля.

Неуспешные совпадения ставятся на backoff, поэтому worker не опрашивает внешние сервисы по одной и той же игре каждые несколько минут.

## Ручной режим остаётся

Кнопка **Подобрать описание** и ручная загрузка JPG/PNG/WebP-обложки остаются в Library Manager как fallback. В каждой карточке можно вручную менять название, год, игроков, краткое описание, историю, сортировку, `featured` и публикацию.

## Мобильная игра

Для мобильного браузера есть отдельный touch-first режим с полноэкранной игровой областью, safe-area и попыткой landscape orientation lock. Подробнее: [MOBILE.md](MOBILE.md).

## Клавиатура и геймпад

На desktop страница игры позволяет сохранить раскладку для конкретной игры или всей платформы. На touch-устройствах используется виртуальный геймпад EmulatorJS; USB/Bluetooth gamepad можно подключить до или во время игры.

## Online и популярность

`/api/activity` строится из активных WebSocket-сессий и launch events: текущий online, игры «прямо сейчас» и популярность за 7 дней. Несколько вкладок одного браузера дедуплицируются через session ID.

## Безопасность

- ROM/BIOS/cover upload доступен только admin API;
- локальный ROM пользователя не отправляется на сервер;
- ZIP upload выключен по умолчанию;
- backend не исполняет ROM как OS-программу;
- backend и metadata worker работают non-root, read-only, без Linux capabilities и с `no-new-privileges`;
- metadata worker не слушает публичный порт;
- внешние image-hosts ограничены allowlist'ом, размеры ограничены, image signatures перепроверяются backend;
- worker сохраняет ручные правки по умолчанию;
- admin/public API имеют rate limits.

Полный threat model: [../../SECURITY.md](../../SECURITY.md).

## Диагностика

```bash
curl -s http://127.0.0.1:8088/api/games | jq
curl -s http://127.0.0.1:8088/api/activity | jq

docker compose logs --tail=100 metadata
```

Owner-каталог:

```bash
TOKEN="$(cat catalog/admin-token)"
curl -s -H "Authorization: Bearer $TOKEN" \
  http://127.0.0.1:8088/api/admin/games | jq
```

## Правовой момент

Retro Portal не включает коммерческие ROM/BIOS/официальные artwork в дистрибутив. Если владелец включает внешнее metadata/artwork enrichment или загружает собственный контент, он отвечает за право использования полученных материалов.
