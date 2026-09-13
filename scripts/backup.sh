#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"; OUT_DIR="${1:-$ROOT_DIR/backups}"; mkdir -p "$OUT_DIR"; STAMP="$(date +%Y%m%d-%H%M%S)"; OUT="$OUT_DIR/retro-portal-$STAMP.tar.gz"; tar -czf "$OUT" -C "$ROOT_DIR" catalog public/covers games/roms games/bios .env 2>/dev/null || tar -czf "$OUT" -C "$ROOT_DIR" catalog public/covers games/roms games/bios; printf 'Backup created: %s\n' "$OUT"
