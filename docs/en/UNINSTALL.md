# Safe removal and migration

[← README](../../README_EN.md) · [Installation](INSTALL.md) · [Scaling](SCALING.md) · [Updating](UPDATE.md) · [Nginx/TLS](NGINX.md) · [Troubleshooting](TROUBLESHOOTING.md)

Retro Portal is designed to coexist with other services. Removal is intentionally conservative: scripts remove only resources that can be identified as belonging to Retro Portal and never perform global Docker/Nginx cleanup.

## Control / standalone dry run

```bash
cd /path/to/retro-portal
sudo ./scripts/uninstall.sh --domain arcade.example.com --dry-run
```

## Normal control / standalone removal

```bash
sudo ./scripts/uninstall.sh --domain arcade.example.com
```

The script detaches only installer-managed Retro Portal vhosts, keeps rollback copies, runs `nginx -t` before reload, restores the vhost on validation/reload failure, stops only the current standard Compose project, and preserves library data/runtime/certificates by default.

## Edge-node removal

Edge nodes have a separate scoped helper:

```bash
./scripts/uninstall-edge.sh --dry-run
./scripts/uninstall-edge.sh
```

It only manages `docker-compose.edge.yml` in the current checkout. It does not touch host Nginx, control/origin, other Compose projects, global Docker resources, certificates or packages.

After draining/removing the edge from the LB/CDN, optionally delete its local replicated payload:

```bash
./scripts/uninstall-edge.sh --purge-replica-data
```

Verify that the control/origin or another backup contains the current library before purging a replica.

## Move control / standalone to another server

```bash
sudo ./scripts/uninstall.sh \
  --domain arcade.example.com \
  --move \
  --backup-dir /root/retro-portal-backups
```

Migration mode performs a mandatory verified backup first, creates a SHA-256 checksum, then removes local library data/runtime and the locally built backend image only when it is unused.

Backup files:

```text
/root/retro-portal-backups/retro-portal-YYYYMMDD-HHMMSS.tar.gz
/root/retro-portal-backups/retro-portal-YYYYMMDD-HHMMSS.tar.gz.sha256
```

Verify before copying:

```bash
cd /root/retro-portal-backups
sha256sum -c retro-portal-*.tar.gz.sha256
```

Treat the archive as a secret because it may contain `.env` and `catalog/admin-token`.

## Restore on the new host

```bash
git clone https://github.com/indie-master/retro-portal.git
cd retro-portal
sudo tar -xzf /path/retro-portal-YYYYMMDD-HHMMSS.tar.gz -C .
./scripts/install-emulatorjs.sh 4.2.3
sudo ./scripts/install.sh --mode existing --domain arcade.example.com
```

For Compose-only deployment, use the normal `docker compose build --pull && docker compose up -d` flow.

## Free disk space without moving

```bash
sudo ./scripts/uninstall.sh \
  --domain arcade.example.com \
  --purge-data \
  --remove-runtime \
  --remove-images
```

`--purge-data` always creates and verifies a backup before deleting local library data.

## What removal scripts never do

They do not perform:

- removal of unrelated Docker containers or Compose projects;
- Docker volume/network/image prune;
- Docker Engine removal;
- Nginx/Certbot removal;
- TLS certificate deletion;
- global package cleanup;
- automatic rewriting of arbitrary shared `stream` / `ssl_preread` maps;
- recursive deletion of the Git checkout itself.

## Existing complex Nginx configurations

If Retro Portal was manually added to a shared `server {}` or `stream {}` block, the control uninstaller reports the remaining domain references but does not rewrite that shared file.

```bash
sudo nginx -T | grep -n 'arcade.example.com'
sudo nginx -t
sudo systemctl reload nginx
```

Shared SNI/stream maps may route unrelated services, so automatic regex editing is intentionally avoided.

## Nginx rollback copies

Installer-managed vhosts are backed up under:

```text
/var/backups/retro-portal/uninstall-YYYYMMDD-HHMMSS/
```

If validation or reload fails, the old vhost is restored and removal stops before containers/data are touched.

## Quick reference

```bash
# control/standalone preview
sudo ./scripts/uninstall.sh --domain arcade.example.com --dry-run

# control/standalone stop while preserving library
sudo ./scripts/uninstall.sh --domain arcade.example.com

# control/standalone migration
sudo ./scripts/uninstall.sh --domain arcade.example.com --move --backup-dir /root/retro-portal-backups

# edge preview
./scripts/uninstall-edge.sh --dry-run

# edge containers only
./scripts/uninstall-edge.sh

# edge containers + replicated payload
./scripts/uninstall-edge.sh --purge-replica-data
```
