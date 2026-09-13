#!/usr/bin/env bash
set -euo pipefail
if [[ -t 1 ]]; then C_RESET='\033[0m'; C_BOLD='\033[1m'; C_GREEN='\033[32m'; C_YELLOW='\033[33m'; C_RED='\033[31m'; C_CYAN='\033[36m'; else C_RESET=''; C_BOLD=''; C_GREEN=''; C_YELLOW=''; C_RED=''; C_CYAN=''; fi
info(){ printf '%b[INFO]%b %s\n' "$C_CYAN" "$C_RESET" "$*"; }; ok(){ printf '%b[ OK ]%b %s\n' "$C_GREEN" "$C_RESET" "$*"; }; warn(){ printf '%b[WARN]%b %s\n' "$C_YELLOW" "$C_RESET" "$*" >&2; }; fail(){ printf '%b[FAIL]%b %s\n' "$C_RED" "$C_RESET" "$*" >&2; }; die(){ fail "$*"; exit 1; }
have(){ command -v "$1" >/dev/null 2>&1; }
ask_yes_no(){ local prompt="$1" default="${2:-y}" answer hint='[Y/n]'; [[ "$default" == n ]] && hint='[y/N]'; read -r -p "$prompt $hint " answer || true; answer="${answer:-$default}"; [[ "$answer" =~ ^[Yy]$ ]]; }
validate_domain(){ local domain="$1"; [[ "$domain" =~ ^([A-Za-z0-9][A-Za-z0-9-]*\.)+[A-Za-z]{2,63}$ ]]; }
require_root(){ [[ ${EUID:-$(id -u)} -eq 0 ]] || die 'This mode needs root privileges. Re-run with sudo.'; }
backup_file(){ local file="$1" backup_dir="$2"; [[ -e "$file" ]] || return 0; mkdir -p "$backup_dir"; cp -a "$file" "$backup_dir/$(basename "$file").$(date +%Y%m%d-%H%M%S).bak"; }
render_template(){ local src="$1" dst="$2"; shift 2; cp "$src" "$dst"; while (($#)); do local key="$1" value="$2"; shift 2; KEY="$key" VALUE="$value" python3 - "$dst" <<'PY'
import os,pathlib,sys
p=pathlib.Path(sys.argv[1]);s=p.read_text();s=s.replace('{{'+os.environ['KEY']+'}}',os.environ['VALUE']);p.write_text(s)
PY
done; }
project_root(){ cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd; }
