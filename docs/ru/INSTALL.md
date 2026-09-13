# Установка Retro Portal

[← README](../../README.md) · [Nginx/TLS](NGINX.md) · [ROM/BIOS](ROMS.md) · [Диагностика](TROUBLESHOOTING.md)

## 1. Что понадобится

Рекомендуемый стартовый VPS: Ubuntu 24.04 LTS, 2 vCPU, 2 GB RAM, 40 GB NVMe, 100 Mbps+.

До установки желательно иметь:

- DNS-запись выбранного поддомена, если нужен публичный HTTPS;
- доступ `root`/`sudo`;
- открытые TCP 80/443 для обычного HTTP-01 сценария;
- либо уже существующий сертификат;
- либо Cloudflare API Token с DNS Edit для DNS-01.

## 2. Клонирование

```bash
sudo apt update
sudo apt install -y git
git clone https://github.com/indie-master/retro-portal.git retro-portal
cd retro-portal
```

## 3. Интерактивная установка

```bash
sudo ./scripts/install.sh
```

Будет предложено четыре режима.

### Режим 1 — Full automatic

Подходит для чистого VPS или обычного Nginx.

Installer:

1. проверяет Ubuntu;
2. устанавливает необходимые пакеты;
3. устанавливает Docker Engine из официального Docker apt repository, если его ещё нет;
4. скачивает стабильный EmulatorJS;
5. при желании устанавливает тестовые open-source ROM;
6. запускает `docker compose`;
7. проверяет `/healthz`;
8. анализирует Nginx;
9. выбирает безопасную схему интеграции;
10. находит существующий сертификат или предлагает Let's Encrypt;
11. создаёт отдельный vhost;
12. выполняет `nginx -t`;
13. только после успешной проверки делает reload.

```bash
sudo ./scripts/install.sh \
  --mode full \
  --domain arcade.example.com
```

### Режим 2 — Existing Nginx

Для серверов, на которых Nginx уже обслуживает другие сайты, reverse proxy или `stream`.

```bash
sudo ./scripts/install.sh \
  --mode existing \
  --domain arcade.example.com
```

Если hostname уже существует в одном из server-блоков, installer его не переписывает: создаётся `generated/arcade.example.com.locations.conf`.

### Режим 3 — Manual integration

Приложение запускается на `127.0.0.1:8088`, Nginx не изменяется.

```bash
./scripts/install.sh \
  --mode manual \
  --domain arcade.example.com
```

Полученный snippet можно вручную вставить в существующий server-блок.

### Режим 4 — Local test

Быстрый тест без DNS/SSL:

```bash
./scripts/install.sh --mode local
```

По умолчанию в local mode портал доступен на `http://SERVER_IP:8088/`.

> Это тестовый режим без TLS. Не оставляйте его открытым в Интернет без необходимости.

## 4. Неинтерактивные примеры

### Использовать уже установленный wildcard/SAN certificate

```bash
sudo ./scripts/install.sh \
  --mode existing \
  --domain arcade.example.com \
  --tls existing \
  --demo-roms
```

### Выпустить Let's Encrypt HTTP-01

```bash
sudo ./scripts/install.sh \
  --mode full \
  --domain arcade.example.com \
  --tls certbot-http \
  --email admin@example.com \
  --no-demo-roms
```

### Выпустить сертификат через Cloudflare DNS-01

```bash
sudo ./scripts/install.sh \
  --mode existing \
  --domain arcade.example.com \
  --tls certbot-cloudflare \
  --cloudflare-credentials /root/.secrets/cloudflare.ini \
  --email admin@example.com
```

### Свой сертификат

```bash
sudo ./scripts/install.sh \
  --mode existing \
  --domain arcade.example.com \
  --tls custom \
  --cert /path/fullchain.pem \
  --key /path/privkey.pem
```

## 5. Проверка после установки

```bash
./scripts/doctor.sh --domain arcade.example.com
curl -i http://127.0.0.1:8088/healthz
curl -s http://127.0.0.1:8088/api/games | jq
sudo nginx -t
docker compose ps
```

## 6. Управление

```bash
make up
make ps
make logs
make down
make doctor
```

Без Makefile:

```bash
docker compose up -d --build
docker compose logs -f --tail=100
docker compose down
```

## 7. Где лежат данные

```text
catalog/games.json    каталог
games/roms/           ROM
games/bios/           BIOS
public/covers/        обложки
emulatorjs/data/      EmulatorJS
.env                  bind/port
```

## 8. Демо-игры

Шесть MIT-лицензированных Mega Drive homebrew ROM можно установить одной командой:

```bash
./scripts/install-homebrew-roms.sh
```

## 9. Библиотека популярных игр

Для Sonic 2, Mortal Kombat II, Streets of Rage 2, Comix Zone, Road Rash III, Contra: Hard Corps, Tekken 3, Crash 3, CTR, THPS2, Resident Evil 2, Worms Armageddon и экспериментальных Dreamcast-игр уже есть metadata preset в `catalog/presets/curated-classics.json`.

Положите собственные ROM/BIOS/обложки по ожидаемым путям и выполните:

```bash
./scripts/sync-classics.sh
```

В рабочий каталог попадут только полностью готовые записи.