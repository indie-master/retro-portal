# Installation

[← README](../../README_EN.md) · [Scaling](SCALING.md) · [Updating](UPDATE.md) · [Remove / migrate](UNINSTALL.md) · [Library Manager](LIBRARY.md) · [Nginx/TLS](NGINX.md) · [Networking](NETWORKING.md)

Recommended baseline: Ubuntu 24.04 LTS, 2 vCPU, 2 GB RAM, 40 GB NVMe and 100 Mbps+ network.

A normal deployment needs only one server. Optional edge nodes can be added later without redesigning the original single-node installation.

## Option A — quick install into `/opt/retro-portal`

This is the recommended path for both fresh and already-used hosts. Retro Portal itself runs as a Docker Compose project in `/opt/retro-portal`. If the server already has host Nginx, it stays outside the containers as the reverse proxy.

```bash
curl -fsSL https://raw.githubusercontent.com/indie-master/retro-portal/main/scripts/quick-install.sh \
  -o /tmp/retro-portal-install.sh
sudo bash /tmp/retro-portal-install.sh
```

The bootstrap script:

- installs/checks `git` and `curl`;
- clones the project to `/opt/retro-portal`;
- only allows a safe fast-forward update of an existing clean checkout;
- refuses an unexpected/non-Retro-Portal directory;
- prepares writable paths for the non-root backend container;
- then runs the normal `scripts/install.sh` wizard.

For a server that already runs Nginx:

```bash
sudo bash /tmp/retro-portal-install.sh \
  --mode existing \
  --domain arcade.example.com \
  --tls existing
```

For manual host-Nginx integration:

```bash
sudo bash /tmp/retro-portal-install.sh \
  --mode manual \
  --domain arcade.example.com
```

Default working directory after quick install:

```text
/opt/retro-portal
```

The commands below assume:

```bash
cd /opt/retro-portal
```

## Option B — manual clone + installer

```bash
sudo git clone https://github.com/indie-master/retro-portal.git /opt/retro-portal
cd /opt/retro-portal
sudo ./scripts/install.sh
```

Installer modes:

```bash
sudo ./scripts/install.sh --mode full --domain arcade.example.com
sudo ./scripts/install.sh --mode existing --domain arcade.example.com
sudo ./scripts/install.sh --mode manual --domain arcade.example.com
sudo ./scripts/install.sh --mode local
```

Existing-Nginx mode inspects the current topology first and always runs `nginx -t` before reload. On hosts that already run other applications, `existing` or `manual` is usually the safest choice.

## Option C — Docker Compose only

If Docker Engine + Compose are already installed and you manage reverse proxy/TLS yourself:

```bash
sudo git clone https://github.com/indie-master/retro-portal.git /opt/retro-portal
cd /opt/retro-portal
sudo cp .env.example .env
sudo ./scripts/install-emulatorjs.sh 4.2.3
```

Optional demo ROMs:

```bash
sudo ./scripts/install-homebrew-roms.sh
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

When cloning into `/opt` as root, writable paths must be accessible to the backend container UID/GID. The quick installer handles this automatically. With the default `PUID=1000` / `PGID=1000`, manual setup can use:

```bash
sudo chown -R 1000:1000 \
  catalog \
  games/roms \
  games/bios \
  public/covers/library \
  public/screenshots/library
```

Start:

```bash
sudo docker compose pull --ignore-buildable
sudo docker compose build --pull
sudo docker compose up -d --remove-orphans
```

Verify:

```bash
sudo docker compose ps
curl -i http://127.0.0.1:8088/healthz
curl -s http://127.0.0.1:8088/api/games | jq
```

Then proxy host Nginx/Caddy/Traefik to `127.0.0.1:8088`.

## What runs in Docker

In single-node mode the project containerizes:

- backend/API/Library Manager backend;
- internal web Nginx serving the UI, ROMs, artwork and EmulatorJS runtime.

The host keeps only the project/library files under `/opt/retro-portal` and, when needed, an external Nginx/Caddy/Traefik instance for TLS/reverse proxy. This is intentional on multi-service hosts: the installer should not move or replace existing shared proxy infrastructure.

## Option D — existing Nginx, no automatic edits

```bash
sudo ./scripts/install.sh --mode manual --domain arcade.example.com
```

This generates snippets under `generated/` but does not modify the active host configuration. It is a good fit for `stream`, `ssl_preread`, PROXY protocol, or custom certificate topologies.

## Option E — edge node

An edge node distributes the bandwidth-heavy ROM/runtime/artwork traffic and does not run the backend/admin plane.

```bash
sudo git clone https://github.com/indie-master/retro-portal.git /opt/retro-portal
cd /opt/retro-portal
sudo cp .env.edge.example .env.edge
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
sudo ./scripts/install-emulatorjs.sh 4.2.3
sudo docker compose --env-file .env.edge -f docker-compose.edge.yml up -d --build
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
sudo cat /opt/retro-portal/catalog/admin-token
```

Admin endpoints are intentionally disabled on edge nodes.

## Operations

Standalone/control:

```bash
cd /opt/retro-portal
sudo make up
sudo make ps
sudo make logs
sudo make down
sudo make doctor
```

or:

```bash
cd /opt/retro-portal
sudo docker compose up -d --build
sudo docker compose logs -f --tail=100
sudo docker compose restart
sudo docker compose down
```

Edge:

```bash
cd /opt/retro-portal
sudo docker compose --env-file .env.edge -f docker-compose.edge.yml ps
sudo docker compose --env-file .env.edge -f docker-compose.edge.yml logs -f
sudo docker compose --env-file .env.edge -f docker-compose.edge.yml down
```

## Updating

Recommended:

```bash
cd /opt/retro-portal
sudo ./scripts/update.sh --mode standalone
sudo ./scripts/update.sh --mode edge
```

All configured edges from the control node:

```bash
cd /opt/retro-portal
./scripts/cluster-update.sh --dry-run
./scripts/cluster-update.sh
```

See **[UPDATE.md](UPDATE.md)**.

## Persistent data

The quick installer keeps the checkout and bind-mounted persistent data under `/opt/retro-portal`:

```text
/opt/retro-portal/
├── catalog/runtime-games.json    runtime catalog
├── catalog/stats.json            launch statistics
├── games/roms/                   ROMs
├── games/bios/                   BIOS files
├── public/covers/library/        covers
├── public/screenshots/library/   screenshots
├── emulatorjs/data/              EmulatorJS runtime
├── .env                          standalone/control settings
└── .env.edge                     edge settings
```

For library management see [LIBRARY.md](LIBRARY.md), scaling [SCALING.md](SCALING.md), updating [UPDATE.md](UPDATE.md), networking [NETWORKING.md](NETWORKING.md), removal [UNINSTALL.md](UNINSTALL.md), and security [../../SECURITY.md](../../SECURITY.md).