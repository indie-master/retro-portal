#!/usr/bin/env bash
set -euo pipefail
VERSION="${1:-4.2.3}"; ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"; DEST="$ROOT_DIR/emulatorjs"; URL="https://cdn.emulatorjs.org/releases/${VERSION}.7z"; TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
for cmd in curl 7z find; do command -v "$cmd" >/dev/null 2>&1 || { echo "Missing command: $cmd" >&2; exit 1; }; done
echo "Downloading EmulatorJS ${VERSION} from official CDN..."; curl -fL --retry 3 --connect-timeout 15 "$URL" -o "$TMP/emulatorjs.7z"; mkdir -p "$TMP/extracted"; 7z x -y "$TMP/emulatorjs.7z" -o"$TMP/extracted" >/dev/null; LOADER="$(find "$TMP/extracted" -type f -path '*/data/loader.js' -print -quit)"; [[ -n "$LOADER" ]] || { echo 'Could not find data/loader.js inside archive.' >&2; exit 1; }; DATA_DIR="$(dirname "$LOADER")"; rm -rf "$DEST/data"; mkdir -p "$DEST"; cp -a "$DATA_DIR" "$DEST/data"; printf '%s\n' "$VERSION" >"$DEST/VERSION"; echo "Installed EmulatorJS ${VERSION} to $DEST/data"
