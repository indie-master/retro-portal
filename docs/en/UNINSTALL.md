# Safe removal and migration

[← README](../../README_EN.md) · [Installation](INSTALL.md) · [Nginx/TLS](NGINX.md) · [Troubleshooting](TROUBLESHOOTING.md)

Retro Portal is designed to coexist with other services. Its uninstaller is intentionally conservative: it removes only resources that can be identified as belonging to Retro Portal and never performs global Docker or Nginx cleanup.

## Start with a dry run

```bash
cd /path/to/retro-portal
sudo ./scripts/uninstall.sh --domain arcade.example.com --dry-run
```

The dry run changes nothing and shows the exact Nginx file, Compose containers, backup plan and data cleanup actions.

## Normal safe removal

```bash
sudo ./scripts/uninstall.sh --domain arcade.example.com
```

By default the script:

1. detaches only `retro-portal-<domain>.conf` files carrying the `Managed by Retro Portal installer` marker;
2. keeps a rollback copy;
3. runs `nginx -t` before reload;
4. restores the vhost immediately if validation or reload fails;
5. stops only the current Retro Portal Docker Compose project;
6. preserves ROMs, BIOS files, artwork, catalog data, `.env`, EmulatorJS runtime, certificates and system packages.

This releases the portal containers' RAM/CPU while keeping the library available for a later restart.

## Move to another server

```bash
sudo ./scripts/uninstall.sh \
  --domain arcade.example.com \
  --move \
  --backup-dir /root/retro-portal-backups
```

Migration mode performs a mandatory verified backup first, creates a SHA-256 checksum, then removes local library data/runtime and the locally built backend image only when it is unused.

Backup files look like:

```text
/root/retro-portal-backups/retro-portal-YYYYMMDD-HHMMSS.tar.gz
/root/retro-portal-backups/retro-portal-YYYYMMDD-HHMMSS.tar.gz.sha256
```

Verify before copying:

```bash
cd /root/retro-portal-backups
sha256sum -c retro-portal-*.tar.gz.sha256
```

The archive may contain `.env` and `catalog/admin-token`; treat it as a secret.

## Restore on the new host

```bash
git clone https://github.com/indie-master/retro-portal.git
cd retro-portal
sudo tar -xzf /path/retro-portal-YYYYMMDD-HHMMSS.tar.gz -C .
./scripts/install-emulatorjs.sh 4.2.3
sudo ./scripts/install.sh --mode existing --domain arcade.example.com
```

For a Compose-only deployment, replace the last command with your normal `docker compose build --pull && docker compose up -d` flow.

## Free disk space without moving

```bash
sudo ./scripts/uninstall.sh \
  --domain arcade.example.com \
  --purge-data \
  --remove-runtime \
  --remove-images
```

`--purge-data` always creates and verifies a backup before deleting local library data.

## What the script never removes

Even in migration mode it does not touch:

- other Docker containers or Compose projects;
- unrelated Docker networks/volumes/images;
- Docker Engine, Nginx or Certbot packages;
- TLS certificates or Certbot renewal configuration;
- shared Nginx images;
- arbitrary Nginx configuration;
- manually edited `stream` / `ssl_preread` maps;
- the Git checkout itself.

It never runs `docker system prune`, `docker volume prune`, `docker network prune` or a global package purge.

## Existing complex Nginx configurations

If you manually added Retro Portal to an existing shared `server {}` or `stream {}` block, the uninstaller will not rewrite that file. It reports remaining references to the portal domain so you can remove only the exact line after review.

```bash
sudo nginx -T | grep -n 'arcade.example.com'
sudo nginx -t
sudo systemctl reload nginx
```

This is intentional: shared SNI/stream maps often route several unrelated services and should not be rewritten automatically.

## Nginx rollback copies

Installer-managed vhosts are backed up under:

```text
/var/backups/retro-portal/uninstall-YYYYMMDD-HHMMSS/
```

If Nginx validation or reload fails, the previous vhost is restored automatically and the removal stops before containers or local data are touched.

## Quick reference

```bash
# Preview only
sudo ./scripts/uninstall.sh --domain arcade.example.com --dry-run

# Stop/remove the portal while preserving the library
sudo ./scripts/uninstall.sh --domain arcade.example.com

# Migrate to another host
sudo ./scripts/uninstall.sh --domain arcade.example.com --move --backup-dir /root/retro-portal-backups

# Reclaim most portal disk usage while retaining a verified backup
sudo ./scripts/uninstall.sh --domain arcade.example.com --purge-data --remove-runtime --remove-images
```
