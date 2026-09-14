# Installation

[← README](../../README_EN.md) · [Scaling](SCALING.md) · [Updating](UPDATE.md) · [Remove / migrate](UNINSTALL.md) · [Library Manager](LIBRARY.md) · [Nginx/TLS](NGINX.md) · [Networking](NETWORKING.md)

Recommended baseline: Ubuntu 24.04 LTS, 2 vCPU, 2 GB RAM, 40 GB NVMe and 100 Mbps+ network.

A normal deployment needs only one server. Optional edge nodes can be added later without redesigning the original single-node installation.

## Option A — interactive installer

```bash
sudo apt update
sudo apt install -y git
git clone https://github.com/indie-master/retro-portal.git retro-portal
cd retro-portal
sudo ./scripts/install.sh
```

Installer modes:

```bash
sudo ./scripts/install.sh --mode full --domain arcade.example.com
sudo ./scripts/install.sh --mode existing --domain arcade.example.com
./scripts/install.sh --mode manual --domain arcade.example.com
./scripts/install.sh --mode local
```

Existing-Nginx mode inspects the current topology first and always runs `nginx -t` before reload. On hosts that already run other applications, `existing` or `manual` is usually the safest choice.

## Option B — Docker Compose only

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

Typical `.env`:

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

Start:

```bash
docker compose pull --ignore-buildable
docker compose build --pull
docker compose up -d --remove-orphans
```

Verify:

```bash
docker compose ps
curl -i http://127.0.0.1:8088/healthz
curl -s http://127.0.0.1:8088/api/games | jq
```

Then proxy host Nginx/Caddy/Traefik to `127.0.0.1:8088`.

## Option C — existing Nginx, no automatic edits

```bash
./scripts/install.sh --mode manual --domain arcade.example.com
```

This generates snippets under `generated/` but does not modify the active host configuration. It is a good fit for `stream`, `ssl_preread`, PROXY protocol, or custom certificate topologies.

## Option D — edge node

An edge node distributes the bandwidth-heavy ROM/runtime/artwork traffic and does not run the backend/admin plane.

```bash
git clone https://github.com/indie-master/retro-portal.git
cd retro-portal
cp .env.edge.example .env.edge
```

Configure:

```ini
EDGE_BIND_ADDR=127.0.0.1
EDGE_PORT=8088
CONTROL_ORIGIN_SCHEME=https
CONTROL_ORIGIN_HOST=origin.arcade.example.com
CONTROL_ORIGIN_PORT=443
```

Then:

```bash
./scripts/install-emulatorjs.sh 4.2.3
docker compose --env-file .env.edge -f docker-compose.edge.yml up -d --build
curl -i http://127.0.0.1:8088/healthz
```

See **[SCALING.md](SCALING.md)** for multi-node synchronization and LB/CDN setup.

## TLS examples

Existing wildcard/SAN:

```bash
sudo ./scripts/install.sh --mode existing --domain arcade.example.com --tls existing
```

Let's Encrypt HTTP-01:

```bash
sudo ./scripts/install.sh --mode full --domain arcade.example.com --tls certbot-http --email admin@example.com
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

```text
https://your-domain/admin.html
```

If `ADMIN_TOKEN` is blank, the backend creates a persistent random token:

```bash
cat catalog/admin-token
```

Admin endpoints are intentionally disabled on edge nodes.

## Operations

Standalone/control:

```bash
make up
make ps
make logs
make down
make doctor
```

Edge:

```bash
docker compose --env-file .env.edge -f docker-compose.edge.yml ps
docker compose --env-file .env.edge -f docker-compose.edge.yml logs -f
docker compose --env-file .env.edge -f docker-compose.edge.yml down
```

## Updating

Recommended:

```bash
./scripts/update.sh --mode standalone
./scripts/update.sh --mode edge
```

All configured edges from the control node:

```bash
./scripts/cluster-update.sh --dry-run
./scripts/cluster-update.sh
```

See **[UPDATE.md](UPDATE.md)**.

## Persistent data

```text
catalog/runtime-games.json    runtime catalog
catalog/stats.json            launch statistics
games/roms/                   ROMs
games/bios/                   BIOS files
public/covers/library/        covers
public/screenshots/library/   screenshots
emulatorjs/data/              EmulatorJS runtime
.env                          standalone/control settings
.env.edge                     edge settings
```

For library management see [LIBRARY.md](LIBRARY.md), scaling [SCALING.md](SCALING.md), updating [UPDATE.md](UPDATE.md), networking [NETWORKING.md](NETWORKING.md), removal [UNINSTALL.md](UNINSTALL.md), and security [../../SECURITY.md](../../SECURITY.md).
