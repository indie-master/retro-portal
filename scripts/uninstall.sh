#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=lib/common.sh
source "$ROOT_DIR/scripts/lib/common.sh"

DOMAIN=''
PURGE_DATA=0
REMOVE_RUNTIME=0
REMOVE_IMAGES=0
DO_BACKUP=0
DRY_RUN=0
ASSUME_YES=0
MOVE_MODE=0
BACKUP_DIR="$(cd "$ROOT_DIR/.." && pwd)/retro-portal-backups"
STAMP="$(date +%Y%m%d-%H%M%S)"
MANAGED_MARKER='# Managed by Retro Portal installer.'

usage() {
  cat <<'TXT'
Retro Portal safe uninstaller

Usage:
  sudo ./scripts/uninstall.sh --domain arcade.example.com
  sudo ./scripts/uninstall.sh --domain arcade.example.com --dry-run
  sudo ./scripts/uninstall.sh --domain arcade.example.com --move --backup-dir /root/retro-portal-backups

Default behavior is intentionally conservative:
  - detach only an Nginx vhost explicitly marked as managed by Retro Portal;
  - validate Nginx before reload and restore the vhost automatically on failure;
  - stop/remove only this Docker Compose project's containers/network;
  - preserve ROMs, BIOS, covers, catalog, .env, EmulatorJS runtime and certificates;
  - never uninstall Docker, Nginx, Certbot or shared system packages;
  - never run docker system prune / volume prune / image prune.

Options:
  --domain FQDN        Portal hostname. If omitted, a single managed Retro Portal vhost may be auto-detected.
  --backup             Create a verified migration backup before uninstalling.
  --backup-dir DIR     Backup destination (default: ../retro-portal-backups).
  --purge-data         After a verified backup, remove ROMs, BIOS, covers, mutable catalog files and .env.
  --remove-runtime     Remove downloaded EmulatorJS runtime files.
  --remove-images      Remove only the locally built Retro Portal backend image if no container still uses it.
  --move               Migration mode: backup + purge-data + remove-runtime + remove-images.
  --dry-run            Show the exact plan without changing anything.
  --yes, -y            Non-interactive confirmation.
  -h, --help

The repository directory itself is never deleted automatically. This is deliberate: it prevents a path mistake from removing unrelated files.
TXT
}

while (($#)); do
  case "$1" in
    --domain) DOMAIN="${2:-}"; shift 2;;
    --backup) DO_BACKUP=1; shift;;
    --backup-dir) BACKUP_DIR="${2:-}"; shift 2;;
    --purge-data) PURGE_DATA=1; DO_BACKUP=1; shift;;
    --remove-runtime) REMOVE_RUNTIME=1; shift;;
    --remove-images) REMOVE_IMAGES=1; shift;;
    --move) MOVE_MODE=1; DO_BACKUP=1; PURGE_DATA=1; REMOVE_RUNTIME=1; REMOVE_IMAGES=1; shift;;
    --dry-run) DRY_RUN=1; shift;;
    --yes|-y) ASSUME_YES=1; shift;;
    -h|--help) usage; exit 0;;
    *) die "Unknown option: $1 (use --help)";;
  esac
done

[[ -z "$DOMAIN" ]] || validate_domain "$DOMAIN" || die "Invalid domain: $DOMAIN"

managed_nginx_files() {
  local f
  shopt -s nullglob
  for f in /etc/nginx/sites-available/retro-portal-*.conf /etc/nginx/conf.d/retro-portal-*.conf; do
    [[ -f "$f" ]] || continue
    grep -Fq "$MANAGED_MARKER" "$f" && printf '%s\n' "$f"
  done
  shopt -u nullglob
}

infer_domain_if_safe() {
  [[ -n "$DOMAIN" ]] && return 0
  have nginx || return 0
  local files=() base guessed
  mapfile -t files < <(managed_nginx_files)
  if ((${#files[@]} == 1)); then
    base="$(basename "${files[0]}")"
    guessed="${base#retro-portal-}"
    guessed="${guessed%.conf}"
    if validate_domain "$guessed"; then
      DOMAIN="$guessed"
      info "Auto-detected portal domain: $DOMAIN"
    fi
  elif ((${#files[@]} > 1)); then
    warn 'More than one installer-managed Retro Portal vhost exists. Pass --domain explicitly; Nginx will not be modified otherwise.'
  fi
}

find_managed_vhost_for_domain() {
  [[ -n "$DOMAIN" ]] || return 0
  local f
  for f in "/etc/nginx/sites-available/retro-portal-$DOMAIN.conf" "/etc/nginx/conf.d/retro-portal-$DOMAIN.conf"; do
    [[ -f "$f" ]] || continue
    if grep -Fq "$MANAGED_MARKER" "$f"; then
      printf '%s\n' "$f"
    else
      warn "Refusing to remove $f because it is not marked as installer-managed."
    fi
  done
}

compose_ready() {
  have docker || return 1
  docker compose version >/dev/null 2>&1 || return 1
  (cd "$ROOT_DIR" && docker compose config --services 2>/dev/null | grep -qx backend) || return 1
  (cd "$ROOT_DIR" && docker compose config --services 2>/dev/null | grep -qx web) || return 1
}

show_plan() {
  echo
  printf '%bRetro Portal removal plan%b\n' "$C_BOLD" "$C_RESET"
  echo "Project directory: $ROOT_DIR"
  [[ -n "$DOMAIN" ]] && echo "Portal domain:     $DOMAIN" || echo 'Portal domain:     not specified / not safely auto-detected'
  echo
  echo 'Will do:'
  echo '  - detach installer-managed Retro Portal Nginx vhost only (if found)'
  echo '  - run nginx -t before reload and automatically restore on failure'
  echo '  - stop/remove only this Compose project containers and its project network'
  ((DO_BACKUP)) && echo "  - create and verify migration backup in: $BACKUP_DIR"
  ((PURGE_DATA)) && echo '  - purge local ROM/BIOS/covers/mutable catalog/.env after backup succeeds'
  ((REMOVE_RUNTIME)) && echo '  - remove downloaded EmulatorJS runtime'
  ((REMOVE_IMAGES)) && echo '  - remove only the locally built backend image when unused'
  echo
  echo 'Will NOT touch:'
  echo '  - other Docker containers, networks, volumes or images'
  echo '  - Docker/Nginx/Certbot packages'
  echo '  - TLS certificates or Certbot renewal configuration'
  echo '  - arbitrary Nginx files, stream maps or manually integrated snippets'
  echo '  - the Retro Portal repository directory itself'
  echo
  local files=()
  mapfile -t files < <(find_managed_vhost_for_domain)
  if ((${#files[@]})); then
    printf 'Managed Nginx file(s):\n'
    printf '  %s\n' "${files[@]}"
  else
    echo 'Managed Nginx file(s): none selected; host Nginx will be left unchanged.'
  fi
  if compose_ready; then
    echo 'Compose containers currently visible:'
    (cd "$ROOT_DIR" && docker compose ps --format '  {{.Name}}  {{.Status}}' 2>/dev/null) || true
  else
    echo 'Compose project: not running or Docker/Compose is unavailable.'
  fi
  ((MOVE_MODE)) && echo 'Mode: migration cleanup (backup is mandatory and verified before data removal).'
  echo
}

make_backup() {
  ((DO_BACKUP)) || return 0
  [[ -n "$BACKUP_DIR" ]] || die 'Backup directory cannot be empty.'
  mkdir -p "$BACKUP_DIR"
  info "Creating verified backup in $BACKUP_DIR..."
  "$ROOT_DIR/scripts/backup.sh" "$BACKUP_DIR"
  ok 'Backup completed and verified. Destructive data cleanup may continue.'
}

restore_nginx_vhost() {
  local backup_file="$1" target="$2" link_path="$3" link_target="$4"
  cp -a "$backup_file" "$target"
  if [[ -n "$link_path" ]]; then
    ln -sfn "${link_target:-$target}" "$link_path"
  fi
  nginx -t >/dev/null 2>&1 || true
  systemctl reload nginx >/dev/null 2>&1 || true
}

safe_detach_nginx() {
  [[ -n "$DOMAIN" ]] || { info 'No domain selected; skipping host Nginx changes.'; return 0; }
  have nginx || { info 'Nginx command not found; skipping host Nginx changes.'; return 0; }
  local files=()
  mapfile -t files < <(find_managed_vhost_for_domain)
  ((${#files[@]})) || { info 'No installer-managed Nginx vhost found; nothing will be removed from Nginx.'; return 0; }
  require_root
  local backup_root="/var/backups/retro-portal/uninstall-$STAMP"
  mkdir -p "$backup_root"
  chmod 700 "$backup_root"
  local file backup_file link_path='' link_target='' had_link=0
  for file in "${files[@]}"; do
    [[ -f "$file" ]] || continue
    grep -Fq "$MANAGED_MARKER" "$file" || die "Safety marker disappeared from $file; refusing to modify Nginx."
    backup_file="$backup_root/$(basename "$file")"
    cp -a "$file" "$backup_file"
    link_path=''; link_target=''; had_link=0
    if [[ "$file" == /etc/nginx/sites-available/* ]]; then
      link_path="/etc/nginx/sites-enabled/$(basename "$file")"
      if [[ -L "$link_path" ]]; then
        had_link=1
        link_target="$(readlink "$link_path")"
        rm -f "$link_path"
      elif [[ -e "$link_path" ]]; then
        die "Safety stop: $link_path exists but is not a symlink. It was not modified."
      fi
    fi
    rm -f "$file"
    if ! nginx -t; then
      fail 'Nginx validation failed after removing the portal vhost. Restoring it immediately.'
      restore_nginx_vhost "$backup_file" "$file" "$([[ $had_link -eq 1 ]] && printf '%s' "$link_path")" "$link_target"
      die 'Nginx was restored; uninstall stopped before Docker/data removal.'
    fi
    if ! systemctl reload nginx; then
      fail 'Nginx reload failed. Restoring the portal vhost immediately.'
      restore_nginx_vhost "$backup_file" "$file" "$([[ $had_link -eq 1 ]] && printf '%s' "$link_path")" "$link_target"
      die 'Nginx was restored; uninstall stopped before Docker/data removal.'
    fi
    ok "Detached managed Nginx vhost: $file"
    ok "Rollback copy: $backup_file"
  done

  local remaining=''
  remaining="$(grep -RIlF --include='*.conf' "$DOMAIN" /etc/nginx 2>/dev/null | head -20 || true)"
  if [[ -n "$remaining" ]]; then
    warn 'The domain is still referenced by other Nginx files. They were intentionally NOT modified because they may be shared/manual configuration:'
    while IFS= read -r line; do [[ -n "$line" ]] && printf '  %s\n' "$line" >&2; done <<<"$remaining"
    warn 'If you added an ssl_preread/stream map entry manually, remove only that Retro Portal entry yourself after reviewing the file.'
  fi
}

stop_compose_project() {
  compose_ready || { info 'Retro Portal Compose project is not available; skipping Docker removal.'; return 0; }
  local backend_image=''
  if ((REMOVE_IMAGES)); then
    backend_image="$(cd "$ROOT_DIR" && docker compose images -q backend 2>/dev/null | head -1 || true)"
  fi
  info 'Stopping Retro Portal containers...'
  (cd "$ROOT_DIR" && docker compose down --remove-orphans --timeout 30)
  ok 'Retro Portal containers are stopped and its Compose project network has been removed.'
  if ((REMOVE_IMAGES)) && [[ -n "$backend_image" ]]; then
    if [[ -n "$(docker ps -aq --filter "ancestor=$backend_image" 2>/dev/null)" ]]; then
      warn "Backend image $backend_image is still referenced by another container; leaving it in place."
    elif docker image rm "$backend_image" >/dev/null 2>&1; then
      ok "Removed unused Retro Portal backend image: $backend_image"
    else
      warn "Could not remove backend image $backend_image; it was left in place."
    fi
  fi
}

remove_tree_contents() {
  local dir="$1"
  [[ -d "$dir" ]] || return 0
  find "$dir" -mindepth 1 ! -name .gitkeep -delete
}

purge_local_data() {
  ((PURGE_DATA)) || return 0
  info 'Removing local library data after verified backup...'
  remove_tree_contents "$ROOT_DIR/games/roms"
  remove_tree_contents "$ROOT_DIR/games/bios"
  remove_tree_contents "$ROOT_DIR/public/covers/library"
  remove_tree_contents "$ROOT_DIR/public/screenshots/library"
  rm -f \
    "$ROOT_DIR/catalog/admin-token" \
    "$ROOT_DIR/catalog/runtime-games.json" \
    "$ROOT_DIR/catalog/stats.json" \
    "$ROOT_DIR/catalog/activity.json" \
    "$ROOT_DIR/catalog/metadata-proposals.json" \
    "$ROOT_DIR/.env"
  ok 'ROMs, BIOS, artwork, mutable catalog files and .env were removed.'
}

remove_runtime() {
  ((REMOVE_RUNTIME)) || return 0
  rm -rf "$ROOT_DIR/emulatorjs/data" "$ROOT_DIR/emulatorjs/VERSION"
  ok 'Downloaded EmulatorJS runtime was removed.'
}

infer_domain_if_safe
show_plan

if ((DRY_RUN)); then
  ok 'Dry run complete. No changes were made.'
  exit 0
fi

if ((ASSUME_YES == 0)); then
  if ! ask_yes_no 'Proceed with this removal plan?' n; then
    echo 'Cancelled.'
    exit 0
  fi
  if ((PURGE_DATA)); then
    echo
    warn 'Data purge is enabled. A verified backup will be created first.'
    read -r -p 'Type PURGE to confirm removal of local ROM/BIOS/library data: ' answer
    [[ "$answer" == PURGE ]] || die 'Data purge confirmation did not match. Nothing was changed.'
  fi
fi

# Backup comes before any destructive action in migration/purge modes.
make_backup
# Remove public routing first while the app is still healthy; rollback is automatic if Nginx validation/reload fails.
safe_detach_nginx
# Only after Nginx has safely detached do we stop this Compose project.
stop_compose_project
# Local data/runtime cleanup happens last.
purge_local_data
remove_runtime

echo
ok 'Retro Portal removal completed safely.'
echo 'Preserved intentionally: system packages, certificates, unrelated Docker resources, manual/shared Nginx configuration and the repository directory.'
((DO_BACKUP)) && echo "Migration backups: $BACKUP_DIR"
echo 'To reinstall here later, run ./scripts/install.sh again. To move to another host, copy the generated backup and follow docs/ru/UNINSTALL.md.'
