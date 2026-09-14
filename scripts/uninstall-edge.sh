#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=lib/common.sh
source "$ROOT_DIR/scripts/lib/common.sh"
cd "$ROOT_DIR"

PURGE_REPLICA=0
DRY_RUN=0
ASSUME_YES=0

usage() {
  cat <<'TXT'
Retro Portal edge-node remover

Usage:
  ./scripts/uninstall-edge.sh --dry-run
  ./scripts/uninstall-edge.sh
  ./scripts/uninstall-edge.sh --purge-replica-data

This helper only manages docker-compose.edge.yml in the current project directory.
It never touches host Nginx, Docker globally, certificates, packages, other Compose projects or the control/origin node.

Options:
  --purge-replica-data   Remove the local replicated ROM/BIOS/artwork/runtime payload after stopping the edge
  --dry-run              Show the plan only
  --yes, -y              Skip confirmation
  -h, --help
TXT
}

while (($#)); do
  case "$1" in
    --purge-replica-data) PURGE_REPLICA=1; shift;;
    --dry-run) DRY_RUN=1; shift;;
    --yes|-y) ASSUME_YES=1; shift;;
    -h|--help) usage; exit 0;;
    *) die "Unknown option: $1";;
  esac
done

[[ -f docker-compose.edge.yml ]] || die 'docker-compose.edge.yml not found.'
[[ -f .env.edge ]] || warn '.env.edge not found; Compose defaults may be used only for planning.'

cat <<EOF
Retro Portal edge removal plan
  project: $ROOT_DIR
  compose: docker-compose.edge.yml
  purge replicated payload: $PURGE_REPLICA

Will NOT touch host Nginx, certificates, Docker globally, packages, control/origin data or unrelated containers/networks.
EOF

if ((DRY_RUN)); then
  ok 'Dry run complete; no changes were made.'
  exit 0
fi

if ((ASSUME_YES == 0)); then
  ask_yes_no 'Stop/remove this edge Compose project?' n || { echo 'Cancelled.'; exit 0; }
  if ((PURGE_REPLICA)); then
    read -r -p 'Type PURGE-EDGE to remove replicated game/runtime files from this edge: ' answer
    [[ "$answer" == 'PURGE-EDGE' ]] || die 'Confirmation did not match.'
  fi
fi

COMPOSE=(docker compose -f docker-compose.edge.yml)
[[ -f .env.edge ]] && COMPOSE=(docker compose --env-file .env.edge -f docker-compose.edge.yml)
"${COMPOSE[@]}" down --remove-orphans --timeout 30
ok 'Edge containers and the edge Compose project network were removed.'

if ((PURGE_REPLICA)); then
  for dir in games/roms games/bios public/covers/library public/screenshots/library emulatorjs/data; do
    [[ -d "$dir" ]] && find "$dir" -mindepth 1 ! -name .gitkeep -delete
  done
  rm -f emulatorjs/VERSION .env.edge
  ok 'Replicated edge payload and .env.edge were removed.'
fi
