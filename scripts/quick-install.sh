#!/usr/bin/env bash
set -euo pipefail

REPO_URL="https://github.com/indie-master/retro-portal.git"
INSTALL_DIR="${RETRO_PORTAL_DIR:-/opt/retro-portal}"
BRANCH="${RETRO_PORTAL_BRANCH:-main}"
RECONFIGURE=0
EXISTING_CHECKOUT=0
FORWARD_ARGS=()

usage() {
  cat <<'TXT'
Retro Portal quick installer

Downloads/updates Retro Portal into /opt/retro-portal by default.
All Retro Portal application services run through Docker Compose. An existing host Nginx, when used,
remains an external reverse proxy and is not moved into the project containers.

Usage:
  sudo ./scripts/quick-install.sh
  sudo ./scripts/quick-install.sh --mode existing --domain arcade.example.com
  sudo ./scripts/quick-install.sh --install-dir /opt/retro-portal --mode manual --domain arcade.example.com
  sudo ./scripts/quick-install.sh --reconfigure --mode existing --domain arcade.example.com

Quick-installer options:
  --install-dir DIR   Installation directory (default: /opt/retro-portal)
  --branch NAME       Git branch to deploy (default: main)
  --reconfigure       Re-run the configuration installer on an already initialized deployment
  --quick-help        Show this help

All other arguments are forwarded unchanged to scripts/install.sh on first install/reconfigure.
On an already initialized deployment, running without --reconfigure performs a safe code/container update
and preserves the existing .env configuration.
TXT
}

while (($#)); do
  case "$1" in
    --install-dir)
      INSTALL_DIR="${2:-}"
      shift 2
      ;;
    --branch)
      BRANCH="${2:-}"
      shift 2
      ;;
    --reconfigure)
      RECONFIGURE=1
      shift
      ;;
    --quick-help)
      usage
      exit 0
      ;;
    *)
      FORWARD_ARGS+=("$1")
      shift
      ;;
  esac
done

if [[ ${EUID:-$(id -u)} -ne 0 ]]; then
  echo 'ERROR: quick installation into /opt must be run as root (use sudo).' >&2
  exit 1
fi

[[ "$INSTALL_DIR" == /* ]] || { echo 'ERROR: --install-dir must be an absolute path.' >&2; exit 1; }
case "$INSTALL_DIR" in
  /|/opt|/usr|/var|/etc|/home|/root)
    echo "ERROR: refusing unsafe installation directory: $INSTALL_DIR" >&2
    exit 1
    ;;
esac
[[ "$BRANCH" =~ ^[A-Za-z0-9._/-]+$ ]] || { echo 'ERROR: invalid branch name.' >&2; exit 1; }

ensure_bootstrap_tools() {
  if command -v git >/dev/null 2>&1 && command -v curl >/dev/null 2>&1; then
    return
  fi
  [[ -r /etc/os-release ]] || { echo 'ERROR: cannot detect operating system.' >&2; exit 1; }
  # shellcheck disable=SC1091
  source /etc/os-release
  case "${ID:-}" in
    ubuntu|debian)
      apt-get update
      apt-get install -y ca-certificates curl git
      ;;
    *)
      echo 'ERROR: git and curl are required. Install them first on this distribution.' >&2
      exit 1
      ;;
  esac
}

safe_existing_checkout() {
  [[ -d "$INSTALL_DIR/.git" ]] || return 1
  local origin
  origin="$(git -C "$INSTALL_DIR" remote get-url origin 2>/dev/null || true)"
  case "$origin" in
    "$REPO_URL"|https://github.com/indie-master/retro-portal|git@github.com:indie-master/retro-portal.git)
      ;;
    *)
      echo "ERROR: $INSTALL_DIR is a Git repository, but origin is not Retro Portal: ${origin:-<none>}" >&2
      exit 1
      ;;
  esac
  if [[ -n "$(git -C "$INSTALL_DIR" status --porcelain)" ]]; then
    echo "ERROR: $INSTALL_DIR contains local changes. Commit/stash them before quick install/update." >&2
    exit 1
  fi
  return 0
}

backend_ids() {
  local uid=1000 gid=1000 value=''
  if [[ -f "$INSTALL_DIR/.env" ]]; then
    value="$(sed -n 's/^PUID=//p' "$INSTALL_DIR/.env" | tail -1 | tr -d '[:space:]' || true)"
    [[ "$value" =~ ^[0-9]+$ ]] && uid="$value"
    value="$(sed -n 's/^PGID=//p' "$INSTALL_DIR/.env" | tail -1 | tr -d '[:space:]' || true)"
    [[ "$value" =~ ^[0-9]+$ ]] && gid="$value"
  fi
  printf '%s:%s\n' "$uid" "$gid"
}

prepare_mutable_dirs() {
  local dir file ids uid gid
  ids="$(backend_ids)"
  uid="${ids%%:*}"
  gid="${ids##*:}"

  for dir in \
    "$INSTALL_DIR/catalog" \
    "$INSTALL_DIR/games/roms" \
    "$INSTALL_DIR/games/bios" \
    "$INSTALL_DIR/public/covers/library" \
    "$INSTALL_DIR/public/screenshots/library"; do
    mkdir -p "$dir"
    chown "$uid:$gid" "$dir"
    chmod 0755 "$dir"
  done

  for file in \
    "$INSTALL_DIR/catalog/admin-token" \
    "$INSTALL_DIR/catalog/runtime-games.json" \
    "$INSTALL_DIR/catalog/stats.json" \
    "$INSTALL_DIR/catalog/activity.json" \
    "$INSTALL_DIR/catalog/metadata-proposals.json"; do
    [[ -e "$file" ]] && chown "$uid:$gid" "$file"
  done

  # Artwork is small and may be refreshed by metadata jobs, so normalize existing ownership there.
  chown -R "$uid:$gid" "$INSTALL_DIR/public/covers/library" "$INSTALL_DIR/public/screenshots/library"
}

ensure_bootstrap_tools
mkdir -p "$(dirname "$INSTALL_DIR")"

if [[ -e "$INSTALL_DIR" ]]; then
  if safe_existing_checkout; then
    EXISTING_CHECKOUT=1
    echo "Updating existing Retro Portal checkout in $INSTALL_DIR ..."
    git -C "$INSTALL_DIR" fetch --prune origin
    git -C "$INSTALL_DIR" checkout "$BRANCH"
    git -C "$INSTALL_DIR" pull --ff-only origin "$BRANCH"
  elif [[ -n "$(find "$INSTALL_DIR" -mindepth 1 -maxdepth 1 -print -quit 2>/dev/null)" ]]; then
    echo "ERROR: $INSTALL_DIR already exists and is not a safe Retro Portal checkout." >&2
    exit 1
  else
    rmdir "$INSTALL_DIR" 2>/dev/null || true
    git clone --branch "$BRANCH" --single-branch "$REPO_URL" "$INSTALL_DIR"
  fi
else
  git clone --branch "$BRANCH" --single-branch "$REPO_URL" "$INSTALL_DIR"
fi

prepare_mutable_dirs
chmod 0755 "$INSTALL_DIR" "$INSTALL_DIR/scripts" "$INSTALL_DIR/scripts/install.sh" "$INSTALL_DIR/scripts/update.sh"

printf '\nRetro Portal checkout: %s\n' "$INSTALL_DIR"
printf 'Application runtime: Docker Compose\n'
printf 'Mutable library paths are prepared for the non-root backend container.\n\n'

cd "$INSTALL_DIR"

if ((EXISTING_CHECKOUT == 1 && RECONFIGURE == 0)) && [[ -f .env || -f .env.edge ]]; then
  if ((${#FORWARD_ARGS[@]})); then
    echo 'ERROR: this deployment is already initialized. Use --reconfigure before installer options,' >&2
    echo 'or run quick-install with no installer options to perform a safe update.' >&2
    exit 1
  fi
  if [[ -f .env.edge && ! -f .env ]]; then
    exec ./scripts/update.sh --mode edge --no-git --yes
  fi
  exec ./scripts/update.sh --mode standalone --no-git --yes
fi

exec ./scripts/install.sh "${FORWARD_ARGS[@]}"
