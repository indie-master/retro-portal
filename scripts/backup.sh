#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="${1:-$ROOT_DIR/backups}"
umask 077
mkdir -p "$OUT_DIR"
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="$OUT_DIR/retro-portal-$STAMP.tar.gz"
CHECKSUM="$OUT.sha256"

items=()
for item in \
  catalog \
  games/roms \
  games/bios \
  public/covers/library \
  public/screenshots/library \
  .env \
  emulatorjs/VERSION; do
  [[ -e "$ROOT_DIR/$item" ]] && items+=("$item")
done

((${#items[@]})) || { echo 'Nothing to back up.' >&2; exit 1; }

tar -czf "$OUT" -C "$ROOT_DIR" "${items[@]}"
# Refuse to report success for a corrupt archive.
tar -tzf "$OUT" >/dev/null
sha256sum "$OUT" > "$CHECKSUM"
(
  cd "$OUT_DIR"
  sha256sum -c "$(basename "$CHECKSUM")" >/dev/null
)
chmod 600 "$OUT" "$CHECKSUM"

printf 'Backup created: %s\n' "$OUT"
printf 'Checksum: %s\n' "$CHECKSUM"
printf 'Note: the archive may contain .env and catalog/admin-token secrets; store it securely.\n'
