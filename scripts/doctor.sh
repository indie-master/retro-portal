#!/usr/bin/env bash
set -uo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"; source "$ROOT_DIR/scripts/lib/common.sh"; DOMAIN=''; PORT=8088
while (($#)); do case "$1" in --domain) DOMAIN="${2:-}"; shift 2;; --port) PORT="${2:-}"; shift 2;; *) die "Unknown option: $1";; esac; done
errors=0; containers_running(){ local count; count="$(docker compose -f "$ROOT_DIR/docker-compose.yml" --env-file "$ROOT_DIR/.env" ps --status running --services 2>/dev/null | wc -l)"; [[ "$count" -ge 2 ]]; }; check(){ local label="$1"; shift; if "$@" >/dev/null 2>&1; then ok "$label"; else fail "$label"; errors=$((errors+1)); fi; }
check 'Docker CLI available' command -v docker; if have docker; then check 'Docker daemon reachable' docker info; check 'Compose configuration is valid' docker compose -f "$ROOT_DIR/docker-compose.yml" --env-file "$ROOT_DIR/.env" config; check 'Portal containers are running' containers_running; fi; check "Local health endpoint http://127.0.0.1:$PORT/healthz" curl -fsS "http://127.0.0.1:$PORT/healthz"; check 'Game catalog API' curl -fsS "http://127.0.0.1:$PORT/api/games"; [[ -f "$ROOT_DIR/emulatorjs/data/loader.js" ]] && ok 'EmulatorJS loader installed' || { fail 'EmulatorJS loader missing'; errors=$((errors+1)); }; if have nginx; then check 'Nginx configuration syntax' nginx -t; fi
if [[ -n "$DOMAIN" ]] && curl -fsSIL --max-time 12 "https://$DOMAIN/" >/dev/null 2>&1; then ok "Public HTTPS responds: https://$DOMAIN/"; fi
((errors==0)) || { fail "$errors critical check(s) failed."; exit 1; }; ok 'Core checks passed.'
