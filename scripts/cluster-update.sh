#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=lib/common.sh
source "$ROOT_DIR/scripts/lib/common.sh"

NODES_FILE="$ROOT_DIR/cluster/nodes.conf"
NODE_FILTER=''
ASSUME_YES=0
DRY_RUN=0

usage() {
  cat <<'TXT'
Update Retro Portal code on edge nodes over SSH.

Usage:
  ./scripts/cluster-update.sh --nodes cluster/nodes.conf
  ./scripts/cluster-update.sh --node edge-1
  ./scripts/cluster-update.sh --dry-run

Each selected edge executes its local scripts/update.sh --mode edge. Library payload is not copied;
run scripts/cluster-sync.sh separately when ROM/BIOS/artwork/runtime changed.

Options:
  --nodes FILE
  --node NAME
  --dry-run
  --yes, -y
  -h, --help
TXT
}

while (($#)); do
  case "$1" in
    --nodes) NODES_FILE="${2:-}"; shift 2;;
    --node) NODE_FILTER="${2:-}"; shift 2;;
    --dry-run) DRY_RUN=1; shift;;
    --yes|-y) ASSUME_YES=1; shift;;
    -h|--help) usage; exit 0;;
    *) die "Unknown option: $1";;
  esac
done

have ssh || die 'ssh is required.'
[[ -f "$NODES_FILE" ]] || die "Node inventory not found: $NODES_FILE"

valid_name() { [[ "$1" =~ ^[A-Za-z0-9._-]{1,64}$ ]]; }
valid_target() { [[ "$1" =~ ^[A-Za-z0-9._-]+@?[A-Za-z0-9._:-]+$ ]]; }
valid_path() { [[ "$1" =~ ^/[A-Za-z0-9._/-]+$ ]] && [[ "$1" != *'..'* ]]; }

nodes=()
while IFS='|' read -r name target remote_root extra; do
  name="${name%%#*}"
  [[ -n "$name" ]] || continue
  [[ -z "${extra:-}" ]] || die "Invalid inventory line for $name"
  [[ -z "$NODE_FILTER" || "$name" == "$NODE_FILTER" ]] || continue
  valid_name "$name" || die "Invalid node name: $name"
  valid_target "$target" || die "Invalid target for $name: $target"
  valid_path "$remote_root" || die "Invalid path for $name: $remote_root"
  nodes+=("$name|$target|$remote_root")
done < "$NODES_FILE"

((${#nodes[@]})) || die 'No matching edge nodes found.'

printf 'Selected edge nodes:\n'
for entry in "${nodes[@]}"; do IFS='|' read -r n t p <<<"$entry"; printf '  %-16s %s:%s\n' "$n" "$t" "$p"; done

if ((DRY_RUN)); then
  ok 'Dry run complete. No remote commands were executed.'
  exit 0
fi

if ((ASSUME_YES == 0)); then
  ask_yes_no 'Run safe edge update on these nodes?' n || { echo 'Cancelled.'; exit 0; }
fi

for entry in "${nodes[@]}"; do
  IFS='|' read -r name target remote_root <<<"$entry"
  info "Updating $name..."
  ssh -o BatchMode=yes -o StrictHostKeyChecking=yes "$target" \
    "cd '$remote_root' && ./scripts/update.sh --mode edge --yes"
  ok "$name updated successfully."
done
