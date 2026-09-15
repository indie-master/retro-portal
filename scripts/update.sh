#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=lib/common.sh
source "$ROOT_DIR/scripts/lib/common.sh"
cd "$ROOT_DIR"

MODE='auto'
ASSUME_YES=0
NO_GIT=0
OLD_SHA=''
UPDATED_GIT=0

usage() {
  cat <<'TXT'
Retro Portal safe updater

Usage:
  ./scripts/update.sh
  ./scripts/update.sh --mode standalone
  ./scripts/update.sh --mode edge
  ./scripts/update.sh --mode edge --yes

Modes:
  auto        Edge when .env.edge exists and the edge compose file is present; otherwise standalone.
  standalone  Standard backend + web deployment.
  edge        Static/ROM edge deployment; API/WebSocket remain on the control origin.

Options:
  --mode MODE
  --no-git    Do not pull repository changes; only rebuild/recreate containers from current files.
  --yes, -y   Skip confirmation.
  -h, --help

The updater refuses tracked/untracked working-tree changes, uses ff-only Git updates, force-recreates the
selected Compose deployment so bind-mounted configuration is remounted, and rolls code/containers back to
the previous commit if the post-update local health check fails.
TXT
}

while (($#)); do
  case "$1" in
    --mode) MODE="${2:-}"; shift 2;;
    --no-git) NO_GIT=1; shift;;
    --yes|-y) ASSUME_YES=1; shift;;
    -h|--help) usage; exit 0;;
    *) die "Unknown option: $1";;
  esac
done

if [[ "$MODE" == auto ]]; then
  if [[ -f .env.edge && -f docker-compose.edge.yml ]]; then MODE=edge; else MODE=standalone; fi
fi
[[ "$MODE" =~ ^(standalone|edge)$ ]] || die "Invalid update mode: $MODE"

if [[ "$MODE" == edge ]]; then
  [[ -f .env.edge ]] || die 'Edge mode needs .env.edge (copy .env.edge.example and configure the control origin).'
  COMPOSE=(docker compose --env-file .env.edge -f docker-compose.edge.yml)
  ENV_FILE=.env.edge
  PORT_KEY=EDGE_PORT
  DEFAULT_PORT=8088
else
  COMPOSE=(docker compose)
  ENV_FILE=.env
  PORT_KEY=PORT
  DEFAULT_PORT=8088
fi

have docker || die 'Docker is required.'
docker compose version >/dev/null 2>&1 || die 'Docker Compose plugin is required.'

read_env_number() {
  local file="$1" key="$2" fallback="$3" value=''
  if [[ -f "$file" ]]; then
    value="$(sed -n "s/^${key}=//p" "$file" | tail -1 | tr -d '[:space:]' || true)"
  fi
  [[ "$value" =~ ^[0-9]+$ ]] || value="$fallback"
  printf '%s\n' "$value"
}

APP_PORT="$(read_env_number "$ENV_FILE" "$PORT_KEY" "$DEFAULT_PORT")"

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  OLD_SHA="$(git rev-parse HEAD)"
  if ((NO_GIT == 0)); then
    [[ -z "$(git status --porcelain)" ]] || die 'Working tree has changes. Commit/stash/remove them before automated update.'
    if ((ASSUME_YES == 0)); then
      info "Current commit: $OLD_SHA"
      ask_yes_no "Pull latest code and update $MODE deployment?" y || { echo 'Cancelled.'; exit 0; }
    fi
    info 'Fetching repository updates...'
    git fetch --prune origin
    git pull --ff-only
    [[ "$(git rev-parse HEAD)" == "$OLD_SHA" ]] || UPDATED_GIT=1
  fi
elif ((NO_GIT == 0)); then
  warn 'This checkout is not a Git work tree; continuing as --no-git.'
fi

if [[ "$MODE" == standalone && ! -f emulatorjs/data/loader.js ]]; then
  info 'EmulatorJS runtime is missing; installing pinned runtime...'
  ./scripts/install-emulatorjs.sh 4.2.3
fi
if [[ "$MODE" == edge && ! -f emulatorjs/data/loader.js ]]; then
  info 'EmulatorJS runtime is missing on this edge; installing pinned runtime...'
  ./scripts/install-emulatorjs.sh 4.2.3
fi

update_containers() {
  info "Updating $MODE containers..."
  "${COMPOSE[@]}" pull --ignore-buildable || true
  "${COMPOSE[@]}" build --pull
  "${COMPOSE[@]}" up -d --remove-orphans --force-recreate
}

health_ok() {
  local i
  for i in $(seq 1 40); do
    if curl -fsS "http://127.0.0.1:$APP_PORT/healthz" >/dev/null 2>&1; then return 0; fi
    sleep 1
  done
  return 1
}

rollback() {
  [[ -n "$OLD_SHA" && $UPDATED_GIT -eq 1 ]] || return 1
  fail 'Post-update health check failed. Rolling repository and containers back to the previous commit.'
  git reset --hard "$OLD_SHA"
  if [[ "$MODE" == edge ]]; then
    COMPOSE=(docker compose --env-file .env.edge -f docker-compose.edge.yml)
  else
    COMPOSE=(docker compose)
  fi
  "${COMPOSE[@]}" build
  "${COMPOSE[@]}" up -d --remove-orphans --force-recreate
  if health_ok; then
    ok "Rollback succeeded; deployment is healthy again at commit $OLD_SHA."
    return 0
  fi
  fail 'Rollback was attempted but the local health check is still failing. Inspect docker compose logs immediately.'
  return 1
}

update_containers
if ! health_ok; then
  "${COMPOSE[@]}" logs --tail=160 || true
  rollback || die 'Update failed and automatic recovery could not prove a healthy deployment.'
  exit 1
fi

NEW_SHA="$(git rev-parse HEAD 2>/dev/null || echo n/a)"
ok "$MODE deployment is healthy on 127.0.0.1:$APP_PORT."
echo "Version: $(cat VERSION 2>/dev/null || echo unknown)"
echo "Commit:  $NEW_SHA"
[[ "$MODE" == standalone ]] && echo 'Recommended: ./scripts/doctor.sh'
