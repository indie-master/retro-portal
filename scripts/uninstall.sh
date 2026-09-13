#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"; source "$ROOT_DIR/scripts/lib/common.sh"; DOMAIN=''; PURGE_DATA=0
while (($#)); do case "$1" in --domain) DOMAIN="${2:-}"; shift 2;; --purge-data) PURGE_DATA=1; shift;; -h|--help) echo 'Usage: sudo ./scripts/uninstall.sh [--domain host.example.com] [--purge-data]'; exit 0;; *) die "Unknown option: $1";; esac; done
(cd "$ROOT_DIR" && docker compose down) || true
if [[ -n "$DOMAIN" ]]; then require_root; for file in "/etc/nginx/sites-available/retro-portal-$DOMAIN.conf" "/etc/nginx/conf.d/retro-portal-$DOMAIN.conf"; do if [[ -e "$file" ]]; then rm -f "$file" "/etc/nginx/sites-enabled/$(basename "$file")"; fi; done; if have nginx; then nginx -t && systemctl reload nginx; fi; fi
if ((PURGE_DATA)); then find "$ROOT_DIR/games/roms" -mindepth 1 ! -name .gitkeep -delete; find "$ROOT_DIR/games/bios" -mindepth 1 ! -name .gitkeep -delete; rm -rf "$ROOT_DIR/emulatorjs/data" "$ROOT_DIR/emulatorjs/VERSION"; else ok 'ROMs, BIOS files, catalog and covers were preserved.'; fi
