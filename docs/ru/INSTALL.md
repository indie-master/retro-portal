# Установка Retro Portal

[← README](../../README.md) · [Масштабирование](SCALING.md) · [Обновление](UPDATE.md) · [Удаление / перенос](UNINSTALL.md) · [Library Manager](LIBRARY.md) · [Nginx/TLS](NGINX.md) · [Сеть](NETWORKING.md)

## Что понадобится

Рекомендуемый стартовый сервер: Ubuntu 24.04 LTS, 2 vCPU, 2 GB RAM, 40 GB NVMe, 100 Mbps+.

Для обычной установки достаточно одной машины. Scale-out через edge-ноды является опциональным и добавляется позднее без переделки single-node инсталляции.

До production-установки желательно иметь DNS-запись выбранного поддомена, `root`/`sudo` и один из вариантов TLS: существующий wildcard/SAN, Let's Encrypt HTTP-01, DNS-01 или свой сертификат.

## Вариант A — быстрая установка в `/opt/retro-portal`

Это рекомендуемый вариант для нового или уже используемого сервера. Сам Retro Portal разворачивается как Docker Compose-проект в `/opt/retro-portal`. Если на сервере уже есть host Nginx, он остаётся снаружи как reverse proxy и не переносится внутрь контейнеров.

```bash
curl -fsSL https://raw.githubusercontent.com/indie-master/retro-portal/main/scripts/quick-install.sh \
  -o /tmp/retro-portal-install.sh
sudo bash /tmp/retro-portal-install.sh
```

Bootstrap-скрипт:

- проверяет/ставит `git` и `curl`;
- клонирует проект в `/opt/retro-portal`;
- при повторном запуске разрешает только безопасное fast-forward обновление чистого checkout;
- отказывается использовать чужой/неожиданный каталог;
- подготавливает writable-каталоги для non-root backend контейнера;
- затем запускает обычный `scripts/install.sh`.

На сервере с существующим Nginx можно сразу передать параметры основному installer:

```bash
sudo bash /tmp/retro-portal-install.sh \
  --mode existing \
  --domain arcade.example.com \
  --tls existing
```

Для полностью ручной интеграции host Nginx:

```bash
sudo bash /tmp/retro-portal-install.sh \
  --mode manual \
  --domain arcade.example.com
```

После быстрой установки рабочий каталог всегда:

```text
/opt/retro-portal
```

Все дальнейшие команды в этой инструкции предполагают:

```bash
cd /opt/retro-portal
```

## Вариант B — ручной clone + installer

Если bootstrap не нужен:

```bash
sudo git clone https://github.com/indie-master/retro-portal.git /opt/retro-portal
cd /opt/retro-portal
sudo ./scripts/install.sh
```

Installer предлагает четыре режима: полная установка, интеграция в существующий Nginx, ручная интеграция и локальный тест.

```bash
sudo ./scripts/install.sh --mode full --domain arcade.example.com
sudo ./scripts/install.sh --mode existing --domain arcade.example.com
sudo ./scripts/install.sh --mode manual --domain arcade.example.com
sudo ./scripts/install.sh --mode local
```

В режиме `existing` installer сначала анализирует `nginx -T`, listener'ы, stream/ssl_preread и сертификаты. Перед reload всегда выполняется `nginx -t`.

Для сервера, где уже живут другие приложения, обычно предпочтительны `existing` или `manual`.

## Вариант C — только Docker Compose

Если Docker Engine + Compose уже установлены и reverse proxy/TLS вы настраиваете сами:

```bash
sudo git clone https://github.com/indie-master/retro-portal.git /opt/retro-portal
cd /opt/retro-portal
sudo cp .env.example .env
sudo ./scripts/install-emulatorjs.sh 4.2.3
```

Опциональные demo-ROM:

```bash
sudo ./scripts/install-homebrew-roms.sh
```

Основные параметры `.env`:

```ini
PORT=8088
BIND_ADDR=127.0.0.1
PUID=1000
PGID=1000
ADMIN_TOKEN=
THEGAMESDB_API_KEY=
WIKIPEDIA_METADATA=1
ALLOW_ZIP_ROMS=0
MAX_UPLOAD_BYTES=2147483648
```

Если проект клонировался от `root`, writable-каталоги должны быть доступны UID/GID backend контейнера. Quick installer делает это сам. При ручной установке с дефолтными `PUID=1000` / `PGID=1000`:

```bash
sudo chown -R 1000:1000 \
  catalog \
  games/roms \
  games/bios \
  public/covers/library \
  public/screenshots/library
```

Запуск:

```bash
sudo docker compose pull --ignore-buildable
sudo docker compose build --pull
sudo docker compose up -d --remove-orphans
```

Проверка:

```bash
sudo docker compose ps
curl -i http://127.0.0.1:8088/healthz
curl -s http://127.0.0.1:8088/api/games | jq
```

После этого подключите host Nginx/Caddy/Traefik к `127.0.0.1:8088`. Не публикуйте внутренний порт наружу без необходимости.

## Что именно работает в Docker

В single-node режиме контейнеризированы:

- backend/API/Library Manager backend;
- внутренний web Nginx, раздающий интерфейс, ROM, artwork и EmulatorJS runtime.

На host остаются только файлы проекта/библиотеки в `/opt/retro-portal` и, при необходимости, внешний Nginx/Caddy/Traefik для TLS/reverse proxy. Это сделано намеренно: на машинах, где reverse proxy уже обслуживает другие сервисы, installer не должен переносить или ломать существующую инфраструктуру.

## Вариант D — существующий Nginx без автоматических правок

Запустите приложение через Compose и сгенерируйте snippets:

```bash
sudo ./scripts/install.sh --mode manual --domain arcade.example.com
```

Installer создаст файлы в `generated/`, но не будет менять активный Nginx. Это подходящий режим для сложной конфигурации с `stream`, `ssl_preread`, PROXY protocol или собственной схемой сертификатов.

## Вариант E — edge-нода для масштабирования

Edge не запускает backend/admin и служит для распределения тяжёлой раздачи ROM/runtime/artwork.

```bash
sudo git clone https://github.com/indie-master/retro-portal.git /opt/retro-portal
cd /opt/retro-portal
sudo cp .env.edge.example .env.edge
```

Настройте origin:

```ini
EDGE_BIND_ADDR=127.0.0.1
EDGE_PORT=8088
CONTROL_ORIGIN_SCHEME=https
CONTROL_ORIGIN_HOST=origin.arcade.example.com
CONTROL_ORIGIN_PORT=443
```

Затем:

```bash
sudo ./scripts/install-emulatorjs.sh 4.2.3
sudo docker compose --env-file .env.edge -f docker-compose.edge.yml up -d --build
curl -i http://127.0.0.1:8088/healthz
```

Полный multi-node сценарий, синхронизация и LB/CDN: **[SCALING.md](SCALING.md)**.

## TLS-примеры

Существующий wildcard/SAN:

```bash
sudo ./scripts/install.sh --mode existing --domain arcade.example.com --tls existing
```

Let's Encrypt HTTP-01:

```bash
sudo ./scripts/install.sh \
  --mode full \
  --domain arcade.example.com \
  --tls certbot-http \
  --email admin@example.com
```

Cloudflare DNS-01:

```bash
sudo ./scripts/install.sh \
  --mode existing \
  --domain arcade.example.com \
  --tls certbot-cloudflare \
  --cloudflare-credentials /root/.secrets/cloudflare.ini \
  --email admin@example.com
```

Свой сертификат:

```bash
sudo ./scripts/install.sh \
  --mode existing \
  --domain arcade.example.com \
  --tls custom \
  --cert /path/fullchain.pem \
  --key /path/privkey.pem
```

## Первый вход в админку

```text
https://ваш-домен/admin.html
```

Если `ADMIN_TOKEN` в `.env` пуст, backend создаст случайный persistent token:

```bash
sudo cat /opt/retro-portal/catalog/admin-token
```

Из Library Manager можно загружать ROM/BIOS, сканировать коллекцию, редактировать карточки, принимать/отклонять метаданные и проверять зависимости игры.

На edge-нодах `/admin.html` и `/api/admin/*` отключены специально.

## Управление single-node/control

```bash
cd /opt/retro-portal
sudo make up
sudo make ps
sudo make logs
sudo make down
sudo make doctor
```

или:

```bash
cd /opt/retro-portal
sudo docker compose up -d --build
sudo docker compose logs -f --tail=100
sudo docker compose restart
sudo docker compose down
```

## Обновление

Рекомендуемый способ:

```bash
cd /opt/retro-portal
sudo ./scripts/update.sh --mode standalone
```

Edge:

```bash
cd /opt/retro-portal
sudo ./scripts/update.sh --mode edge
```

Весь edge-пул:

```bash
cd /opt/retro-portal
./scripts/cluster-update.sh --dry-run
./scripts/cluster-update.sh
```

Подробно: **[UPDATE.md](UPDATE.md)**.

## Удаление и перенос

Dry-run:

```bash
cd /opt/retro-portal
sudo ./scripts/uninstall.sh --domain arcade.example.com --dry-run
```

Обычное удаление:

```bash
cd /opt/retro-portal
sudo ./scripts/uninstall.sh --domain arcade.example.com
```

Перенос:

```bash
cd /opt/retro-portal
sudo ./scripts/uninstall.sh \
  --domain arcade.example.com \
  --move \
  --backup-dir /root/retro-portal-backups
```

Только edge-копия:

```bash
cd /opt/retro-portal
./scripts/uninstall-edge.sh --dry-run
./scripts/uninstall-edge.sh
```

Подробно: **[UNINSTALL.md](UNINSTALL.md)**.

## Где лежат данные

Быстрая установка хранит весь checkout и persistent bind-mounted data под `/opt/retro-portal`:

```text
/opt/retro-portal/
├── catalog/runtime-games.json   рабочий каталог
├── catalog/stats.json           статистика запусков
├── games/roms/                  ROM
├── games/bios/                  BIOS
├── public/covers/library/       обложки
├── public/screenshots/library/  screenshots
├── emulatorjs/data/             EmulatorJS runtime
├── .env                         настройки/secrets control/single-node
└── .env.edge                    настройки конкретной edge-ноды
```

## Проверка после установки

Single/control:

```bash
cd /opt/retro-portal
sudo ./scripts/doctor.sh --domain arcade.example.com
curl -i http://127.0.0.1:8088/healthz
curl -s http://127.0.0.1:8088/api/activity | jq
sudo nginx -t
sudo docker compose ps
```

Edge:

```bash
cd /opt/retro-portal
curl -i http://127.0.0.1:8088/healthz
sudo docker compose --env-file .env.edge -f docker-compose.edge.yml ps
```

Для библиотеки см. [LIBRARY.md](LIBRARY.md), масштабирования — [SCALING.md](SCALING.md), обновления — [UPDATE.md](UPDATE.md), сети — [NETWORKING.md](NETWORKING.md), удаления — [UNINSTALL.md](UNINSTALL.md), security — [../../SECURITY.md](../../SECURITY.md).