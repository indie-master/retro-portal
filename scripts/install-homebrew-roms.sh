#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"; ROM_DIR="$ROOT_DIR/games/roms"; TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
for cmd in git docker; do command -v "$cmd" >/dev/null 2>&1 || { echo "Missing command: $cmd" >&2; exit 1; }; done
mkdir -p "$ROM_DIR"; echo 'Cloning free/open-source homebrew collection...'; git clone --depth 1 https://github.com/monteslu/retro-homebrew-games.git "$TMP/retro-homebrew-games"; cd "$TMP/retro-homebrew-games"; chmod +x ./build.sh; ./build.sh genesis
copy_rom(){ local game="$1" target="$2" source="genesis/${1}/out/rom.bin"; [[ -f "$source" ]] || { echo "Build output missing: $source" >&2; exit 1; }; cp "$source" "$ROM_DIR/$target"; echo "Installed $target"; }
copy_rom tank-battle tank-battle.bin; copy_rom battle-4tris battle-4tris.bin; copy_rom pong pong.bin; copy_rom snake-arena snake-arena.bin; copy_rom space-shooter space-shooter.bin; copy_rom breakout breakout.bin; ls -lh "$ROM_DIR"/*.bin
