#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"; source "$ROOT_DIR/scripts/lib/common.sh"; require_root
if have certbot; then ok "Certbot already available: $(certbot --version 2>&1 | head -1)"; exit 0; fi
info 'Installing Certbot using the officially recommended snap package...'; apt-get update; apt-get install -y snapd; systemctl enable --now snapd.socket >/dev/null 2>&1 || true; snap install --classic certbot; ln -sf /snap/bin/certbot /usr/local/bin/certbot; certbot --version; ok 'Certbot installed.'
