#!/usr/bin/env bash
set -euo pipefail
LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; ROOT_DIR="$(cd "$LIB_DIR/../.." && pwd)"; source "$LIB_DIR/common.sh"; NGINX_INSPECT_JSON=''
inspect_nginx(){ NGINX_INSPECT_JSON=''; have nginx || return 1; local tmp; tmp="$(mktemp)"; if ! nginx -T >"$tmp" 2>&1; then rm -f "$tmp"; return 1; fi; NGINX_INSPECT_JSON="$(python3 "$ROOT_DIR/scripts/nginx_inspect.py" <"$tmp")"; rm -f "$tmp"; }
nginx_json_bool(){ JSON="$NGINX_INSPECT_JSON" KEY="$1" python3 - <<'PY'
import json,os
obj=json.loads(os.environ['JSON']);print('true' if obj.get(os.environ['KEY']) else 'false')
PY
}
nginx_domain_files(){ local domain="$1"; JSON="$NGINX_INSPECT_JSON" DOMAIN="$domain" python3 - <<'PY'
import json,os
obj=json.loads(os.environ['JSON']);d=os.environ['DOMAIN'];seen=set()
for s in obj.get('servers',[]):
    if d in s.get('server_name',[]) and s.get('file') and s['file'] not in seen: seen.add(s['file']);print(s['file'])
PY
}
nginx_inner_https_listener(){ JSON="$NGINX_INSPECT_JSON" python3 - <<'PY'
import json,os,re
obj=json.loads(os.environ['JSON'])
for s in obj.get('servers',[]):
    if s.get('protocol')!='http': continue
    for listen in s.get('listen',[]):
        first=listen.split()[0] if listen.split() else '';m=re.search(r'(?:127\.0\.0\.1|\[::1\]|localhost):(\d+)$',first);tls=('ssl' in listen.split()) or bool(s.get('ssl_certificate'))
        if m and tls and int(m.group(1)) not in (80,443): print(m.group(1));raise SystemExit
print('')
PY
}
find_matching_certs(){ local domain="$1" tmp; tmp="$(mktemp)"; { find /etc/letsencrypt/live -type l -name fullchain.pem 2>/dev/null || true; if have nginx; then nginx -T 2>&1 | awk '$1=="ssl_certificate" {gsub(/;/,"",$2); if ($2 !~ /\$/) print $2}' || true; fi; } | sort -u >"$tmp"; while IFS= read -r cert; do [[ -f "$cert" ]] || continue; if openssl x509 -in "$cert" -noout -checkhost "$domain" >/dev/null 2>&1; then local key=''; [[ "$cert" == */fullchain.pem ]] && key="${cert%/fullchain.pem}/privkey.pem"; [[ -f "$key" ]] || key="$(have nginx && nginx -T 2>&1 | awk -v c="$cert" '$1=="ssl_certificate" {gsub(/;/,"",$2); hit=($2==c)} hit && $1=="ssl_certificate_key" {gsub(/;/,"",$2); print $2; exit}' || true)"; [[ -f "$key" ]] || continue; local end epoch; end="$(openssl x509 -in "$cert" -noout -enddate | cut -d= -f2-)"; epoch="$(date -d "$end" +%s 2>/dev/null || echo 0)"; printf '%s|%s|%s|%s\n' "$epoch" "$cert" "$key" "$end"; fi; done <"$tmp" | sort -t'|' -k1,1nr; rm -f "$tmp"; }
