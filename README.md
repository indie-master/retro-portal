# Retro Portal

<p align="center"><strong>Self-hosted библиотека ретро-игр с запуском прямо в браузере.</strong></p>

<p align="center">
  <a href="https://indie-master.github.io/retro-portal/"><strong>🎮 ОТКРЫТЬ LIVE DEMO</strong></a>
  &nbsp;·&nbsp; <a href="README_EN.md">English</a>
  &nbsp;·&nbsp; <a href="docs/ru/INSTALL.md">Установка</a>
  &nbsp;·&nbsp; <a href="docs/ru/SCALING.md">Масштабирование</a>
  &nbsp;·&nbsp; <a href="docs/ru/UPDATE.md">Обновление</a>
  &nbsp;·&nbsp; <a href="docs/ru/UNINSTALL.md">Удаление / перенос</a>
  &nbsp;·&nbsp; <a href="SECURITY.md">Безопасность</a>
</p>

<p align="center">
  <a href="LICENSE"><img alt="MIT License" src="https://img.shields.io/badge/license-MIT-d99a47"></a>
  <a href="https://ubuntu.com/server"><img alt="Ubuntu Server" src="https://img.shields.io/badge/Ubuntu-22.04%20%7C%2024.04-E95420?logo=ubuntu&logoColor=white"></a>
  <a href="https://docs.docker.com/engine/"><img alt="Docker Engine" src="https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white"></a>
  <a href="https://emulatorjs.org/"><img alt="EmulatorJS" src="https://img.shields.io/badge/EmulatorJS-4.2.3-a9d56f"></a>
  <a href="CHANGELOG.md"><img alt="Version" src="https://img.shields.io/badge/version-0.9.0-71cde2"></a>
</p>

![Главная страница Retro Portal](docs/images/home.png)

## Что это

Retro Portal превращает VPS, мини‑ПК или домашний сервер в аккуратную браузерную библиотеку ретро‑игр. Игрок открывает сайт, выбирает игру и нажимает **Играть** — эмуляция запускается на его устройстве в браузере.

Проект можно держать на одной машине или масштабировать: один control/origin отвечает за библиотеку, admin/API и живую статистику, а несколько edge-нод или CDN распределяют раздачу ROM, EmulatorJS runtime, обложек и статических файлов.

## Возможности

- запуск игр прямо в браузере через EmulatorJS;
- Mega Drive, PlayStation, NES, SNES, Game Boy, GBA, Nintendo 64 и Arcade;
- экспериментальная поддержка Dreamcast;
- поиск, платформенные полки, избранное и фильтр игр на двоих;
- собственная раскладка клавиатуры для одной игры или всей платформы;
- поддержка геймпада;
- локальный запуск собственного ROM без отправки файла на сервер;
- online presence, блок «Во что играют сейчас» и популярность за 7 дней;
- Library Manager для ROM, BIOS, карточек игр и публикации;
- автоматические предложения метаданных из TheGamesDB/Wikipedia с подтверждением владельцем;
- Docker Compose, Nginx и несколько сценариев установки;
- single-node режим без дополнительной инфраструктуры;
- optional scale-out через control/origin + edge-ноды + CDN/LB;
- синхронизация ROM/BIOS/artwork/runtime на edge через SSH/rsync без копирования секретов;
- rolling update control/edge с health check и попыткой rollback;
- безопасное штатное удаление/перенос без глобальной очистки Docker или Nginx.

## Live Demo

**https://indie-master.github.io/retro-portal/**

Публичная сборка содержит только свободно распространяемые demo/homebrew ROM. Блок активности заполнен демонстрационными данными, чтобы можно было увидеть весь интерфейс в рабочем виде. В self-hosted установке те же блоки получают данные от встроенного backend.

## Интерфейс владельца

Library Manager доступен по `/admin.html` и позволяет управлять коллекцией без постоянной работы через консоль:

- загрузка ROM и BIOS;
- сканирование библиотеки после SCP/SFTP;
- проверка готовности игры к запуску;
- редактирование названия, описания, истории и порядка сортировки;
- featured/visibility;
- получение и подтверждение метаданных.

![Library Manager / админ-панель](docs/images/admin.png)

Подробно: **[docs/ru/LIBRARY.md](docs/ru/LIBRARY.md)**.

## Быстрый старт

### Вариант 1 — интерактивная установка

```bash
sudo apt update
sudo apt install -y git
git clone https://github.com/indie-master/retro-portal.git
cd retro-portal
sudo ./scripts/install.sh
```

Установщик поддерживает автоматическую установку, интеграцию в существующий Nginx, ручной режим и локальный тест.

### Вариант 2 — Docker Compose

Если Docker Engine/Compose и reverse proxy уже настроены:

```bash
git clone https://github.com/indie-master/retro-portal.git
cd retro-portal
cp .env.example .env
./scripts/install-emulatorjs.sh 4.2.3
docker compose build --pull
docker compose up -d
curl -i http://127.0.0.1:8088/healthz
```

По умолчанию приложение удобно держать на `127.0.0.1:8088`, а HTTPS завершать на host Nginx/Caddy/Traefik.

Полная инструкция: **[docs/ru/INSTALL.md](docs/ru/INSTALL.md)**.

## Масштабирование

Single-node остаётся режимом по умолчанию. Для более высокой нагрузки можно добавить stateless edge-ноды:

```text
                  CDN / Load Balancer
                         │
            ┌────────────┼────────────┐
            │            │            │
          EDGE-1       EDGE-2       EDGE-N
       static/ROM    static/ROM    static/ROM
            └────────────┬────────────┘
                         │ API / WS
                         ▼
                  CONTROL / ORIGIN
                 backend + admin + stats
```

Edge обслуживает тяжёлые/cacheable файлы локально и проксирует небольшой API/WebSocket трафик к control/origin. Admin API на edge отключён. Online/current-game статистика остаётся общей, потому что WebSocket централизован на control-ноде.

Запуск edge:

```bash
cp .env.edge.example .env.edge
# задайте CONTROL_ORIGIN_HOST
./scripts/install-emulatorjs.sh 4.2.3
docker compose --env-file .env.edge -f docker-compose.edge.yml up -d --build
```

Синхронизация библиотеки с control на edge-пул:

```bash
cp cluster/nodes.example cluster/nodes.conf
./scripts/cluster-sync.sh --dry-run
./scripts/cluster-sync.sh
```

Подробная архитектура, LB/CDN и схема для нескольких серверов: **[docs/ru/SCALING.md](docs/ru/SCALING.md)**.

## Обновление

Обычная установка/control:

```bash
./scripts/update.sh --mode standalone
```

Одна edge-нода:

```bash
./scripts/update.sh --mode edge
```

Весь edge-пул:

```bash
./scripts/cluster-update.sh --dry-run
./scripts/cluster-update.sh
```

Updater использует `git pull --ff-only`, rebuild/recreate контейнеров и локальный health check. Если новая версия не становится healthy, скрипт пытается вернуть предыдущий commit и контейнеры предыдущей версии.

Полная инструкция и Docker Compose-only сценарий: **[docs/ru/UPDATE.md](docs/ru/UPDATE.md)**.

## Безопасное удаление и перенос

Перед удалением можно увидеть точный план без изменений:

```bash
sudo ./scripts/uninstall.sh --domain arcade.example.com --dry-run
```

Обычное удаление останавливает только текущий Compose-проект и снимает только installer-managed Nginx-vhost; ROM, BIOS, каталог и сертификаты сохраняются:

```bash
sudo ./scripts/uninstall.sh --domain arcade.example.com
```

Для переноса на другую машину:

```bash
sudo ./scripts/uninstall.sh \
  --domain arcade.example.com \
  --move \
  --backup-dir /root/retro-portal-backups
```

Для удаления только edge-копии:

```bash
./scripts/uninstall-edge.sh --dry-run
./scripts/uninstall-edge.sh
```

Подробно: **[docs/ru/UNINSTALL.md](docs/ru/UNINSTALL.md)**.

## Как устроено

```text
Браузер игрока
  ├─ HTML / CSS / JS
  ├─ EmulatorJS runtime / WASM
  ├─ ROM / BIOS для выбранной игры
  └─ WebSocket presence
          ↓
      Reverse proxy / CDN / edge
          ↓
      Retro Portal control
      ├─ API
      ├─ каталог
      ├─ статистика
      └─ Library Manager
```

После загрузки ROM и runtime сама эмуляция идёт на устройстве игрока. Сервер отвечает за web‑интерфейс, файлы библиотеки, API, presence и административные функции.

Сетевые endpoint'ы, кеширование и reverse proxy: **[docs/ru/NETWORKING.md](docs/ru/NETWORKING.md)**.

## Управление

По умолчанию используется привычная desktop‑раскладка:

```text
Стрелки     движение
Z / X       основные действия
A / S / D   дополнительные кнопки
Q / W       плечевые кнопки
Enter       Start
Shift       Select / Mode
```

Раскладку можно изменить прямо на странице игры и сохранить отдельно для конкретной игры или всей платформы.

## Активность

Self-hosted версия считает активные браузерные сессии через WebSocket и хранит историю запусков для недельного рейтинга. В scale-out режиме все edge проксируют presence на один control/origin, поэтому счётчик и «Во что играют сейчас» остаются общими для всего пула.

## Безопасность

Проект использует защиту в несколько слоёв:

- admin API защищён `ADMIN_TOKEN` и throttling от перебора;
- ROM/BIOS upload ограничен allowlist'ами форматов и размером;
- небезопасные имена файлов не используются как server-side пути;
- ZIP upload выключен по умолчанию;
- metadata fetch ограничен доверенными источниками;
- backend работает non-root, с read-only root filesystem, `no-new-privileges` и без Linux capabilities;
- edge-контейнер работает unprivileged, read-only, без Linux capabilities и не содержит admin token;
- edge → origin через Internet рассчитан на HTTPS с обязательной проверкой сертификата;
- cluster inventory исключён из Git, а sync/update используют SSH host-key verification;
- Nginx добавляет CSP, anti-clickjacking, security headers и rate limits;
- CI запускает syntax/config checks, standalone и edge runtime checks, `npm audit` и CodeQL.

Полный threat model и рекомендации по публикации в Интернет: **[SECURITY.md](SECURITY.md)**.

## Документация

| Раздел | Документ |
|---|---|
| Установка | [docs/ru/INSTALL.md](docs/ru/INSTALL.md) |
| Масштабирование | [docs/ru/SCALING.md](docs/ru/SCALING.md) |
| Обновление | [docs/ru/UPDATE.md](docs/ru/UPDATE.md) |
| Удаление / перенос | [docs/ru/UNINSTALL.md](docs/ru/UNINSTALL.md) |
| Library Manager | [docs/ru/LIBRARY.md](docs/ru/LIBRARY.md) |
| Nginx / TLS | [docs/ru/NGINX.md](docs/ru/NGINX.md) |
| Сеть и reverse proxy | [docs/ru/NETWORKING.md](docs/ru/NETWORKING.md) |
| ROM / BIOS | [docs/ru/ROMS.md](docs/ru/ROMS.md) |
| Dreamcast | [docs/ru/DREAMCAST.md](docs/ru/DREAMCAST.md) |
| Диагностика | [docs/ru/TROUBLESHOOTING.md](docs/ru/TROUBLESHOOTING.md) |
| Безопасность | [SECURITY.md](SECURITY.md) |
| Сторонние компоненты | [THIRD_PARTY.md](THIRD_PARTY.md) |

## Компоненты

- [EmulatorJS](https://emulatorjs.org/) — браузерная эмуляция;
- [Docker Engine / Compose](https://docs.docker.com/engine/) — контейнеризация;
- [Nginx](https://nginx.org/) — web/reverse proxy;
- [TheGamesDB](https://thegamesdb.net/) — опциональные игровые метаданные;
- [MediaWiki API](https://www.mediawiki.org/wiki/API:Main_page) — опциональная история игр.

## ROM и BIOS

Коммерческие ROM, BIOS и официальные artwork не входят в репозиторий. Пользователь добавляет собственные файлы самостоятельно. В публичном demo используются только ROM, разрешённые к распространению.

## Лицензия

Код Retro Portal распространяется по [MIT License](LICENSE).
