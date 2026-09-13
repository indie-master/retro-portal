#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEST="$ROOT_DIR/games/roms"
RELEASE="build-26"
BASE="https://github.com/monteslu/retro-homebrew-games/releases/download/${RELEASE}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

command -v curl >/dev/null 2>&1 || { echo 'curl is required' >&2; exit 1; }
command -v sha256sum >/dev/null 2>&1 || { echo 'sha256sum is required' >&2; exit 1; }

mkdir -p "$DEST"

declare -A SHA=(
  [battle-4tris.bin]="4c41fc7e03f393e3844818283082746624b23ddc121c3dd6c4b9f45eb4c6a8b0"
  [breakout.bin]="01fc26d512bc5cddfcc2860d15b7ed4ee3637daaf73aa40f1d045967f740abc8"
  [pong.bin]="4f077c764972b23c6f2ea6056ebc3b8bf1da972d95f400259de676f787f1061d"
  [snake.bin]="3169306a1396a0cf6c1f4d08f4ed55caa0e5e70627a6e0be689df027b31a5738"
  [space-shooter.bin]="de2fafcbcb669260ed383e1e8ee48493d5df4ee03b57b01b44cb790fd7339515"
  [tank-battle.bin]="0cdb580a87c88e6f81248253f8a2a549d41ded5632344c656b8b5ff8e06caff6"
)

for file in battle-4tris.bin breakout.bin pong.bin snake.bin space-shooter.bin tank-battle.bin; do
  echo "Downloading ${file}..."
  curl -fL --retry 3 --connect-timeout 15 "$BASE/$file" -o "$TMP/$file"
  echo "${SHA[$file]}  $TMP/$file" | sha256sum -c - >/dev/null
  echo "  checksum OK"
done

install -m 0644 "$TMP/tank-battle.bin" "$DEST/tank-battle.bin"
install -m 0644 "$TMP/battle-4tris.bin" "$DEST/battle-4tris.bin"
install -m 0644 "$TMP/pong.bin" "$DEST/pong.bin"
install -m 0644 "$TMP/snake.bin" "$DEST/snake-arena.bin"
install -m 0644 "$TMP/space-shooter.bin" "$DEST/space-shooter.bin"
install -m 0644 "$TMP/breakout.bin" "$DEST/breakout.bin"

echo "Installed 6 MIT-licensed Mega Drive homebrew ROMs into $DEST"
echo "Source: https://github.com/monteslu/retro-homebrew-games (${RELEASE})"