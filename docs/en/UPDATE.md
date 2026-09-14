# Updating Retro Portal

[← README](../../README_EN.md) · [Installation](INSTALL.md) · [Scaling](SCALING.md) · [Uninstall/migration](UNINSTALL.md)

Retro Portal can update directly from the Git repository or rebuild containers from an already-updated checkout. The same safety rules apply to standalone/control and edge nodes: clean work tree, ff-only Git updates, local health check and an automatic rollback attempt when the new version cannot become healthy.

## Standalone / control-origin

```bash
cd /opt/retro-portal
./scripts/update.sh --mode standalone
```

The updater remembers the current commit, runs `git fetch --prune` + `git pull --ff-only`, rebuilds/recreates containers, checks local `/healthz`, and resets/rebuilds the previous commit if the new deployment fails its health check.

After a successful control-node update:

```bash
./scripts/doctor.sh --domain arcade.example.com
```

## Edge node

```bash
./scripts/update.sh --mode edge
```

Edge mode uses `.env.edge` and `docker-compose.edge.yml` and verifies the local edge `/healthz` endpoint.

## All configured edges

From the control node:

```bash
./scripts/cluster-update.sh --dry-run
./scripts/cluster-update.sh
```

Each selected server executes its own `scripts/update.sh --mode edge`, so every node performs its own health check and rollback.

Recommended rollout order:

```text
control/origin → verify → one canary edge → verify → remaining edges
```

## Code already updated externally

If configuration management or a manual Git operation already updated the checkout:

```bash
./scripts/update.sh --mode standalone --no-git
./scripts/update.sh --mode edge --no-git
```

## Plain Docker Compose workflow

Standalone:

```bash
git pull --ff-only
docker compose pull --ignore-buildable
docker compose build --pull
docker compose up -d --remove-orphans
curl -fsS http://127.0.0.1:8088/healthz
```

Edge:

```bash
git pull --ff-only
docker compose --env-file .env.edge -f docker-compose.edge.yml pull --ignore-buildable
docker compose --env-file .env.edge -f docker-compose.edge.yml build --pull
docker compose --env-file .env.edge -f docker-compose.edge.yml up -d --remove-orphans
curl -fsS http://127.0.0.1:8088/healthz
```

This manual path does not provide automatic Git rollback; `scripts/update.sh` is preferred for routine operations.

## Code and library payload are separate

Code updates do not copy ROMs/BIOS/artwork between nodes. When library content or EmulatorJS runtime changes, synchronize the edge pool separately:

```bash
./scripts/cluster-sync.sh --dry-run
./scripts/cluster-sync.sh
```

Before a large change you can create a portable data backup with:

```bash
./scripts/backup.sh /root/retro-portal-backups
```

Treat backup archives as secrets because they may include `.env` and `catalog/admin-token`.
