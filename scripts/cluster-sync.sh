#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=lib/common.sh
source "$ROOT_DIR/scripts/lib/common.sh"

NODES_FILE="$ROOT_DIR/cluster/nodes.conf"
NODE_FILTER=''
DRY_RUN=0
SYNC_RUNTIME=1
DELETE_REMOTE=1

usage() {
  cat <<'TXT'
Sync Retro Portal library payload to edge nodes.

Usage:
  ./scripts/cluster-sync.sh --nodes cluster/nodes.conf
  ./scripts/cluster-sync.sh --node edge-2
  ./scripts/cluster-sync.sh --dry-run

Only library payload is synchronized: ROMs, BIOS, user covers/screenshots and optionally EmulatorJS runtime.
Secrets, .env, admin token, catalog state and Git files are never copied.

Options:
  --nodes FILE       Inventory file (default: cluster/nodes.conf)
  --node NAME        Sync one named edge only
  --no-runtime       Do not sync emulatorjs/data and VERSION
  --no-delete        Do not remove remote files that disappeared locally
  --dry-run          Show rsync changes without modifying remote nodes
  -h, --help
TXT
}

while (($#)); do
  case "$1" in
    --nodes) NODES_FILE="${2:-}"; shift 2;;
    --node) NODE_FILTER="${2:-}"; shift 2;;
    --no-runtime) SYNC_RUNTIME=0; shift;;
    --no-delete) DELETE_REMOTE=0; shift;;
    --dry-run) DRY_RUN=1; shift;;
    -h|--help) usage; exit 0;;
    *) die "Unknown option: $1";;
  esac
done

have rsync || die 'rsync is required on the control node.'
have ssh || die 'ssh is required on the control node.'
[[ -f "$NODES_FILE" ]] || die "Node inventory not found: $NODES_FILE (copy cluster/nodes.example to cluster/nodes.conf)."

valid_name() { [[ "$1" =~ ^[A-Za-z0-9._-]{1,64}$ ]]; }
valid_target() { [[ "$1" =~ ^[A-Za-z0-9._-]+@?[A-Za-z0-9._:-]+$ ]]; }
valid_path() { [[ "$1" =~ ^/[A-Za-z0-9._/-]+$ ]] && [[ "$1" != *'..'* ]]; }

sync_dir() {
  local target="$1" remote_root="$2" rel="$3"
  local src="$ROOT_DIR/$rel/" dst="$target:$remote_root/$rel/"
  [[ -d "$ROOT_DIR/$rel" ]] || return 0
  local opts=(-a --partial --human-readable -e 'ssh -o BatchMode=yes -o StrictHostKeyChecking=yes')
  ((DELETE_REMOTE)) && opts+=(--delete-delay)
  ((DRY_RUN)) && opts+=(--dry-run --itemize-changes)
  rsync "${opts[@]}" "$src" "$dst"
}

sync_file() {
  local target="$1" remote_root="$2" rel="$3"
  [[ -f "$ROOT_DIR/$rel" ]] || return 0
  local opts=(-a --human-readable -e 'ssh -o BatchMode=yes -o StrictHostKeyChecking=yes')
  ((DRY_RUN)) && opts+=(--dry-run --itemize-changes)
  rsync "${opts[@]}" "$ROOT_DIR/$rel" "$target:$remote_root/$rel"
}

sync_node() {
  local name="$1" target="$2" remote_root="$3"
  valid_name "$name" || die "Invalid node name in inventory: $name"
  valid_target "$target" || die "Invalid SSH target for $name: $target"
  valid_path "$remote_root" || die "Invalid remote path for $name: $remote_root"

  info "Syncing library payload to $name ($target:$remote_root)"
  if ((DRY_RUN == 0)); then
    ssh -o BatchMode=yes -o StrictHostKeyChecking=yes "$target" \
      "mkdir -p '$remote_root/games/roms' '$remote_root/games/bios' '$remote_root/public/covers/library' '$remote_root/public/screenshots/library' '$remote_root/emulatorjs'"
  fi

  sync_dir "$target" "$remote_root" games/roms
  sync_dir "$target" "$remote_root" games/bios
  sync_dir "$target" "$remote_root" public/covers/library
  sync_dir "$target" "$remote_root" public/screenshots/library
  if ((SYNC_RUNTIME)); then
    sync_dir "$target" "$remote_root" emulatorjs/data
    sync_file "$target" "$remote_root" emulatorjs/VERSION
  fi
  ok "Payload sync completed for $name."
}

matched=0
while IFS='|' read -r name target remote_root extra; do
  name="${name%%#*}"
  [[ -n "$name" ]] || continue
  [[ -z "${extra:-}" ]] || die "Invalid inventory line for $name: expected exactly name|ssh_target|path"
  [[ -z "$NODE_FILTER" || "$name" == "$NODE_FILTER" ]] || continue
  matched=1
  sync_node "$name" "$target" "$remote_root"
done < "$NODES_FILE"

((matched)) || die "No matching nodes found in $NODES_FILE."
((DRY_RUN)) && ok 'Dry run complete; no remote files were changed.'
