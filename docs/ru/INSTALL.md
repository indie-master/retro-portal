# Установка Retro Portal

[← README](../../README.md) · [Масштабирование](SCALING.md) · [Обновление](UPDATE.md) · [Удаление / перенос](UNINSTALL.md) · [Library Manager](LIBRARY.md) · [Nginx/TLS](NGINX.md) · [Сеть](NETWORKING.md)

## Что понадобится

Рекомендуемый стартовый сервер: Ubuntu 24.04 LTS, 2 vCPU, 2 GB RAM, 40 GB NVMe, 100 Mbps+.

Для обычной установки достаточно одной машины. Scale-out через edge-ноды является опциональным и добавляется позднее без переделки single-node инсталляции.

До production-установки желательно иметь DNS-запись выбранного поддомена, `root`/`sudo` и один из вариантов TLS: существующий wildcard/SAN, Let's Encrypt HTTP-01, DNS-01 или свой сертификат.

## Вариант A — интерактивный installer

```bash
sudo apt update
sudo apt install -y git
git clone https://github.com/indie-master/retro-portal.git retro-portal
cd retro-portal
sudo ./scripts/install.sh
```

Installer предлагает четыре режима: полная установка, интеграция в существующий Nginx, ручная интеграция и локальный тест.

```bash
sudo ./scripts/install.sh --mode full --domain arcade.example.com
sudo ./scripts/install.sh --mode existing --domain arcade.example.com
./scripts/install.sh --mode manual --domain arcade.example.com
./scripts/install.sh --mode local
```

В режиме `existing` installer сначала анализирует `nginx -T`, listener'ы, stream/ssl_preread и сертификаты. Перед reload всегда выполняется `nginx -t`.

Для сервера, где уже живут другие приложения, обычно предпочтительны `existing` или `manual`.

## Вариант B — только Docker Compose

Если Docker Engine + Compose уже установлены и reverse proxy/TLS вы настраиваете сами:

```bash
git clone https://github.com/indie-master/retro-portal.git
cd retro-portal
cp .env.example .env
./scripts/install-emulatorjs.sh 4.2.3
```

Опциональные demo-ROM:

```bash
./scripts/install-homebrew-roms.sh
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

Запуск:

```bash
docker compose pull --ignore-buildable
docker compose build --pull
docker compose up -d --remove-orphans
```

Проверка:

```bash
docker compose ps
curl -i http://127.0.0.1:8088/healthz
curl -s http://127.0.0.1:8088/api/games | jq
```

После этого подключите host Nginx/Caddy/Traefik к `127.0.0.1:8088`. Не публикуйте внутренний порт наружу без необходимости.

## Вариант C — существующий Nginx без автоматических правок

Запустите приложение через Compose и сгенерируйте snippets:

```bash
./scripts/install.sh --mode manual --domain arcade.example.com
```

Installer создаст файлы в `generated/`, но не будет менять активный Nginx. Это подходящий режим для сложной конфигурации с `stream`, `ssl_preread`, PROXY protocol или собственной схемой сертификатов.

## Вариант D — edge-нода для масштабирования

Edge не запускает backend/admin и служит для распределения тяжёлой раздачи ROM/runtime/artwork.

```bash
git clone https://github.com/indie-master/retro-portal.git
cd retro-portal
cp .env.edge.example .env.edge
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
./scripts/install-emulatorjs.sh 4.2.3
docker compose --env-file .env.edge -f docker-compose.edge.yml up -d --build
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
cat catalog/admin-token
```

Из Library Manager можно загружать ROM/BIOS, сканировать коллекцию, редактировать карточки, принимать/отклонять метаданные и проверять зависимости игры.

На edge-нодах `/admin.html` и `/api/admin/*` отключены специально.

## Управление single-node/control

```bash
make up
make ps
make logs
make down
make doctor
```

или:

```bash
docker compose up -d --build
docker compose logs -f --tail=100
docker compose restart
docker compose down
```

## Обновление

Рекомендуемый способ:

```bash
./scripts/update.sh --mode standalone
```

Edge:

```bash
./scripts/update.sh --mode edge
```

Весь edge-пул:

```bash
./scripts/cluster-update.sh --dry-run
./scripts/cluster-update.sh
```

Подробно: **[UPDATE.md](UPDATE.md)**.

## Удаление и перенос

Dry-run:

```bash
sudo ./scripts/uninstall.sh --domain arcade.example.com --dry-run
```

Обычное удаление:

```bash
sudo ./scripts/uninstall.sh --domain arcade.example.com
```

Перенос:

```bash
sudo ./scripts/uninstall.sh \
  --domain arcade.example.com \
  --move \
  --backup-dir /root/retro-portal-backups
```

Только edge-копия:

```bash
./scripts/uninstall-edge.sh --dry-run
./scripts/uninstall-edge.sh
```

Подробно: **[UNINSTALL.md](UNINSTALL.md)**.

## Где лежат данные

```text
catalog/runtime-games.json   рабочий каталог
catalog/stats.json           статистика запусков
games/roms/                  ROM
games/bios/                  BIOS
public/covers/library/       обложки
public/screenshots/library/  screenshots
emulatorjs/data/             EmulatorJS runtime
.env                         настройки/secrets control/single-node
.env.edge                    настройки конкретной edge-ноды
```

## Проверка после установки

Single/control:

```bash
./scripts/doctor.sh --domain arcade.example.com
curl -i http://127.0.0.1:8088/healthz
curl -s http://127.0.0.1:8088/api/activity | jq
sudo nginx -t
docker compose ps
```

Edge:

```bash
curl -i http://127.0.0.1:8088/healthz
docker compose --env-file .env.edge -f docker-compose.edge.yml ps
```

Для библиотеки см. [LIBRARY.md](LIBRARY.md), масштабирования — [SCALING.md](SCALING.md), обновления — [UPDATE.md](UPDATE.md), сети — [NETWORKING.md](NETWORKING.md), удаления — [UNINSTALL.md](UNINSTALL.md), security — [../../SECURITY.md](../../SECURITY.md).
