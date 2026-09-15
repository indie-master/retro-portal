# Retro Portal

<p align="center"><strong>Self-hosted библиотека ретро-игр с запуском прямо в браузере.</strong></p>

<p align="center">
  <a href="https://indie-master.github.io/retro-portal/"><strong>🎮 LIVE DEMO</strong></a>
  &nbsp;·&nbsp; <a href="README_EN.md">English</a>
  &nbsp;·&nbsp; <a href="docs/ru/INSTALL.md">Установка</a>
  &nbsp;·&nbsp; <a href="docs/ru/MOBILE.md">Мобильная игра</a>
  &nbsp;·&nbsp; <a href="docs/ru/SCALING.md">Масштабирование</a>
  &nbsp;·&nbsp; <a href="docs/ru/UPDATE.md">Обновление</a>
  &nbsp;·&nbsp; <a href="docs/ru/UNINSTALL.md">Удаление / перенос</a>
  &nbsp;·&nbsp; <a href="SECURITY.md">Безопасность</a>
</p>

<p align="center">
  <a href="LICENSE"><img alt="MIT License" src="https://img.shields.io/badge/license-MIT-d99a47"></a>
  <a href="https://ubuntu.com/server"><img alt="Ubuntu Server" src="https://img.shields.io/badge/Ubuntu-22.04%20%7C%2024.04-E95420?logo=ubuntu&logoColor=white"></a>
  <a href="https://docs.docker.com/engine/"><img alt="Docker Compose" src="https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white"></a>
  <a href="https://emulatorjs.org/"><img alt="EmulatorJS" src="https://img.shields.io/badge/EmulatorJS-4.2.3-a9d56f"></a>
  <a href="CHANGELOG.md"><img alt="Version" src="https://img.shields.io/badge/version-0.11.2-71cde2"></a>
</p>

![Главная страница Retro Portal](docs/images/home.png)

## Что это

Retro Portal превращает VPS, мини‑ПК или домашний сервер в игровую библиотеку: посетитель выбирает игру, браузер получает ROM/runtime и запускает эмуляцию локально на устройстве.

Проект одинаково подходит для одной машины и для scale-out схемы с несколькими edge-нодами/CDN. Быстрая установка размещает приложение в **`/opt/retro-portal`**, а web/backend/metadata работают через Docker Compose; существующий host Nginx/Caddy/Traefik остаётся внешним reverse proxy.

## Возможности

- Mega Drive, PlayStation, NES, SNES, Game Boy, GBA, Nintendo 64 и Arcade через EmulatorJS;
- экспериментальный Dreamcast-профиль;
- desktop-клавиатура, USB/Bluetooth gamepad и touch-first мобильный режим;
- мобильный fullscreen, safe-area и best-effort landscape lock;
- локальный запуск собственного ROM без отправки файла на сервер;
- Library Manager для ROM, BIOS, обложек, карточек и публикации;
- **автоматическое platform-aware оформление игр**: описание, история, год, количество игроков и box-art;
- TheGamesDB с фильтром конкретной платформы, Wikipedia fallback и системные Libretro thumbnails для обложек;
- ручные правки владельца сохраняются по умолчанию;
- online presence, «во что играют сейчас» и популярность за 7 дней;
- реальные client IP в container access log при корректной настройке reverse proxy;
- single-node и control/origin + edge/CDN режимы;
- безопасные rolling update, rollback, перенос и удаление.

## Live Demo

**https://indie-master.github.io/retro-portal/**

GitHub Pages содержит только свободно распространяемые demo/homebrew ROM. Activity-блок использует демонстрационные данные для показа интерфейса; self-hosted установка получает activity от собственного backend.

## Library Manager

`/admin.html` позволяет без ручного JSON:

- загружать ROM/BIOS и сканировать уже скопированную библиотеку;
- видеть готовность игр и обязательные BIOS;
- редактировать название, год, описание, историю, featured/visibility и сортировку;
- вручную загружать JPG/PNG/WebP обложки;
- запускать ручной metadata lookup при необходимости.

Начиная с 0.10 отдельный внутренний `metadata` worker сам обрабатывает новые и неполные карточки. По умолчанию он **не перезаписывает** заполненные владельцем поля.

```ini
THEGAMESDB_API_KEY=
WIKIPEDIA_METADATA=1
AUTO_METADATA=1
AUTO_METADATA_OVERWRITE=0
AUTO_METADATA_INTERVAL=600
AUTO_METADATA_BATCH=8
```

TheGamesDB key необязателен: без него остаются Wikipedia + Libretro fallback. Подробнее: **[docs/ru/LIBRARY.md](docs/ru/LIBRARY.md)**.

![Library Manager](docs/images/admin.png)

## Быстрая установка

```bash
curl -fsSL https://raw.githubusercontent.com/indie-master/retro-portal/main/scripts/quick-install.sh \
  -o /tmp/retro-portal-install.sh
sudo bash /tmp/retro-portal-install.sh
```

Рекомендуемый каталог:

```text
/opt/retro-portal
```

На машине с существующим Nginx:

```bash
sudo bash /tmp/retro-portal-install.sh \
  --mode existing \
  --domain arcade.example.com \
  --tls existing
```

Для сложного существующего `stream`/SNI Nginx используйте `manual` или аккуратно интегрируйте inner-vhost отдельно. Полная инструкция: **[docs/ru/INSTALL.md](docs/ru/INSTALL.md)**.

## Мобильная игра

На touch-устройстве страница игры показывает **Мобильный режим**. Кнопка запрашивает fullscreen, пытается зафиксировать landscape и оставляет игровую область на весь доступный viewport. Виртуальный gamepad предоставляет EmulatorJS.

Подробнее: **[docs/ru/MOBILE.md](docs/ru/MOBILE.md)**.

## Масштабирование

Одна машина остаётся режимом по умолчанию:

```text
Internet → reverse proxy → 127.0.0.1:8088 → Retro Portal Docker
```

Для нагрузки можно добавить edge pool:

```text
                    CDN / Load Balancer
                           │
              ┌────────────┼────────────┐
              │            │            │
            EDGE-1       EDGE-2       EDGE-N
         ROM/runtime   ROM/runtime   ROM/runtime
              └────────────┬────────────┘
                           │ API / WS
                           ▼
                    CONTROL / ORIGIN
               backend + metadata + admin
```

Edge раздаёт тяжёлые статические payload локально, а API/WebSocket остаются централизованы. Admin endpoints на edge отключены. Подробнее: **[docs/ru/SCALING.md](docs/ru/SCALING.md)**.

## Реальный IP за reverse proxy

Обычный Nginx должен передавать нормализованный адрес в `X-Real-IP`. Если public `:443` принадлежит `stream` и inner HTTPS принимает `proxy_protocol`, используйте именно `$proxy_protocol_addr`:

```nginx
proxy_set_header X-Real-IP $proxy_protocol_addr;
proxy_set_header X-Forwarded-For $proxy_protocol_addr;
```

Container log показывает client IP первым полем, а `peer=` оставляет адрес Docker hop для диагностики. Не доверяйте произвольному `X-Real-IP` от Интернета; CDN/LB client-IP header нужно нормализовать на host proxy только от доверенных proxy ranges.

Подробнее: **[docs/ru/NETWORKING.md](docs/ru/NETWORKING.md)**.

## Обновление

```bash
cd /opt/retro-portal
sudo ./scripts/update.sh --mode standalone
```

Edge:

```bash
sudo ./scripts/update.sh --mode edge
```

Updater требует чистый Git checkout, использует `git pull --ff-only`, rebuild/recreate, проверяет `/healthz` и пытается откатить предыдущий commit при неудачном health check. Подробнее: **[docs/ru/UPDATE.md](docs/ru/UPDATE.md)**.

## Безопасное удаление / перенос

Сначала dry-run:

```bash
cd /opt/retro-portal
sudo ./scripts/uninstall.sh --domain arcade.example.com --dry-run
```

Перенос с verified backup:

```bash
sudo ./scripts/uninstall.sh \
  --domain arcade.example.com \
  --move \
  --backup-dir /root/retro-portal-backups
```

Uninstaller не запускает глобальные Docker prune-команды, не удаляет Docker/Nginx/Certbot и не переписывает произвольные shared stream maps. Подробнее: **[docs/ru/UNINSTALL.md](docs/ru/UNINSTALL.md)**.

## Безопасность

- backend и metadata worker — non-root, read-only root filesystem, capabilities dropped, `no-new-privileges`;
- metadata worker не имеет публичного listener;
- ROM/BIOS/cover uploads — только admin API;
- file size/type/signature validation;
- ZIP upload выключен по умолчанию;
- external artwork hosts allowlisted, redirects rejected, download size limited, image signature revalidated;
- admin/API throttling, CSP, anti-framing и browser security headers;
- CodeQL + production dependency audit + Docker/Nginx/runtime CI.

Полный threat model: **[SECURITY.md](SECURITY.md)**.

## Документация

| Раздел | Документ |
|---|---|
| Установка | [docs/ru/INSTALL.md](docs/ru/INSTALL.md) |
| Library Manager | [docs/ru/LIBRARY.md](docs/ru/LIBRARY.md) |
| Мобильная игра | [docs/ru/MOBILE.md](docs/ru/MOBILE.md) |
| Сеть / real IP / reverse proxy | [docs/ru/NETWORKING.md](docs/ru/NETWORKING.md) |
| Масштабирование | [docs/ru/SCALING.md](docs/ru/SCALING.md) |
| Обновление | [docs/ru/UPDATE.md](docs/ru/UPDATE.md) |
| Удаление / перенос | [docs/ru/UNINSTALL.md](docs/ru/UNINSTALL.md) |
| Безопасность | [SECURITY.md](SECURITY.md) |

## Контент и лицензии

Репозиторий не включает коммерческие ROM, проприетарные BIOS или официальные коммерческие artwork. Demo содержит только redistributable homebrew-контент. Владелец self-hosted инсталляции отвечает за право использования добавленных ROM/BIOS/изображений и материалов, получаемых через включённые им внешние metadata providers.
