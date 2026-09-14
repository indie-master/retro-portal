# Installation

[← README](../../README_EN.md) · [Library Manager](LIBRARY.md) · [Nginx/TLS](NGINX.md) · [Networking](NETWORKING.md) · [Troubleshooting](TROUBLESHOOTING.md)

Recommended baseline: Ubuntu 24.04 LTS, 2 vCPU, 2 GB RAM, 40 GB NVMe and 100 Mbps+ network.

## Option A — interactive installer

```bash
sudo apt update
sudo apt install -y git
git clone https://github.com/indie-master/retro-portal.git retro-portal
cd retro-portal
sudo ./scripts/install.sh
```

The installer offers four modes: **Full**, **Existing Nginx**, **Manual integration**, and **Local test**.

```bash
sudo ./scripts/install.sh --mode full --domain arcade.example.com
sudo ./scripts/install.sh --mode existing --domain arcade.example.com
./scripts/install.sh --mode manual --domain arcade.example.com
./scripts/install.sh --mode local
```

Existing-Nginx mode inspects the current configuration before changing anything and always runs `nginx -t` before reload.

## Option B — Docker Compose only

Use this when Docker Engine + Compose are already installed and you want to manage reverse proxy/TLS yourself.

```bash
git clone https://github.com/indie-master/retro-portal.git
cd retro-portal
cp .env.example .env
./scripts/install-emulatorjs.sh 4.2.3
```

Optional demo ROMs:

```bash
./scripts/install-homebrew-roms.sh
```

Review `.env`:

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

Start the stack:

```bash
docker compose pull
docker compose build --pull
docker compose up -d
```

Verify:

```bash
docker compose ps
curl -i http://127.0.0.1:8088/healthz
curl -s http://127.0.0.1:8088/api/games | jq
```

Then proxy your host Nginx/Caddy/Traefik to `127.0.0.1:8088`. Avoid publishing the internal port to the Internet unless you explicitly need that topology.

## Option C — existing Nginx, no automatic edits

Run the Compose stack and generate snippets only:

```bash
./scripts/install.sh --mode manual --domain arcade.example.com
```

The installer writes snippets into `generated/` without touching the live Nginx config. This is appropriate for complex installations using `stream`, `ssl_preread`, PROXY protocol, or custom certificate handling.

## TLS examples

Existing wildcard/SAN certificate:

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

Custom certificate/key:

```bash
sudo ./scripts/install.sh \
  --mode existing \
  --domain arcade.example.com \
  --tls custom \
  --cert /path/fullchain.pem \
  --key /path/privkey.pem
```

## First Library Manager login

Open:

```text
https://your-domain/admin.html
```

If `ADMIN_TOKEN` is blank, the backend creates a persistent random token:

```bash
cat catalog/admin-token
```

The Library Manager handles ROMs, BIOS files, card editing, dependency checks and metadata review without routine console access.

## Operations

```bash
make up
make ps
make logs
make down
make doctor
```

or directly:

```bash
docker compose up -d --build
docker compose logs -f --tail=100
docker compose restart
docker compose down
```

## Updating

```bash
git pull --ff-only
./scripts/install-emulatorjs.sh 4.2.3
docker compose build --pull
docker compose up -d
./scripts/doctor.sh --domain arcade.example.com
```

Back up `.env`, `catalog/`, `games/` and `public/covers/library/` before upgrades.

## Persistent data

```text
catalog/runtime-games.json   runtime catalog
catalog/activity.json        local launch statistics
games/roms/                  ROMs
games/bios/                  BIOS files
public/covers/library/       downloaded/custom covers
emulatorjs/data/             EmulatorJS runtime
.env                         local settings/secrets
```

For library management see [LIBRARY.md](LIBRARY.md), for actual application traffic see [NETWORKING.md](NETWORKING.md), and for security guidance see [../../SECURITY.md](../../SECURITY.md).
