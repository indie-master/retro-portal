# Установка Retro Portal

[← README](../../README.md) · [Library Manager](LIBRARY.md) · [Nginx/TLS](NGINX.md) · [Сеть](NETWORKING.md) · [Диагностика](TROUBLESHOOTING.md)

## Что понадобится

Рекомендуемый стартовый VPS: Ubuntu 24.04 LTS, 2 vCPU, 2 GB RAM, 40 GB NVMe, 100 Mbps+.

До установки желательно иметь DNS-запись выбранного поддомена, `root`/`sudo` и один из вариантов TLS: уже существующий wildcard/SAN сертификат, Let's Encrypt HTTP-01 или DNS-01.

## Вариант A — интерактивный installer

Самый простой путь:

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

В режиме `existing` installer сначала анализирует `nginx -T`, существующие listener'ы, stream/ssl_preread и сертификаты. Перед reload всегда выполняется `nginx -t`.

## Вариант B — только Docker Compose

Подходит, если Docker Engine + Compose уже установлены и вы хотите сами управлять reverse proxy/TLS.

```bash
git clone https://github.com/indie-master/retro-portal.git
cd retro-portal
cp .env.example .env
./scripts/install-emulatorjs.sh 4.2.3
```

При необходимости добавьте demo-ROM:

```bash
./scripts/install-homebrew-roms.sh
```

Проверьте `.env`:

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
docker compose pull
docker compose build --pull
docker compose up -d
```

Проверка:

```bash
docker compose ps
curl -i http://127.0.0.1:8088/healthz
curl -s http://127.0.0.1:8088/api/games | jq
```

После этого подключите ваш host Nginx/Caddy/Traefik к `127.0.0.1:8088`. Не публикуйте внутренний порт наружу без необходимости.

## Вариант C — существующий Nginx без изменений installer'ом

Запустите приложение через Compose, затем используйте:

```bash
./scripts/install.sh --mode manual --domain arcade.example.com
```

Installer создаст snippets в `generated/`, но не будет менять активный Nginx. Это удобный вариант для сложных конфигураций, где уже используются `stream`, `ssl_preread`, PROXY protocol или собственная схема сертификатов.

## TLS-примеры

Существующий wildcard/SAN:

```bash
sudo ./scripts/install.sh \
  --mode existing \
  --domain arcade.example.com \
  --tls existing
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

Откройте:

```text
https://ваш-домен/admin.html
```

Если `ADMIN_TOKEN` в `.env` пуст, backend создаст случайный токен:

```bash
cat catalog/admin-token
```

Из админки можно загружать ROM/BIOS, сканировать коллекцию, редактировать карточки, принимать/отклонять найденные метаданные и проверять зависимости игры.

## Управление

```bash
make up
make ps
make logs
make down
make doctor
```

или напрямую:

```bash
docker compose up -d --build
docker compose logs -f --tail=100
docker compose restart
docker compose down
```

## Обновление

```bash
git pull --ff-only
./scripts/install-emulatorjs.sh 4.2.3
docker compose build --pull
docker compose up -d
./scripts/doctor.sh --domain arcade.example.com
```

Перед обновлением сохраните `.env`, `catalog/`, `games/` и `public/covers/library/`.

## Где лежат данные

```text
catalog/runtime-games.json   рабочий каталог
catalog/activity.json        локальная статистика запусков
games/roms/                  ROM
games/bios/                  BIOS
public/covers/library/       обложки
emulatorjs/data/             EmulatorJS
.env                         локальные настройки/secrets
```

## Проверка после установки

```bash
./scripts/doctor.sh --domain arcade.example.com
curl -i http://127.0.0.1:8088/healthz
curl -s http://127.0.0.1:8088/api/activity | jq
sudo nginx -t
docker compose ps
```

Для подробностей по библиотеке см. [LIBRARY.md](LIBRARY.md), по сетевому поведению — [NETWORKING.md](NETWORKING.md), по security — [../../SECURITY.md](../../SECURITY.md).
