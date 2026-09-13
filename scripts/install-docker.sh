#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"; source "$ROOT_DIR/scripts/lib/common.sh"; require_root
if have docker && docker compose version >/dev/null 2>&1; then ok 'Docker Engine and Compose plugin are already installed.'; exit 0; fi
[[ -r /etc/os-release ]] || die 'Cannot detect operating system.'; source /etc/os-release; [[ "${ID:-}" == ubuntu ]] || die 'Automatic Docker installation supports Ubuntu only. Install Docker manually and re-run.'
info "Installing Docker Engine from Docker's official apt repository..."; apt-get update; apt-get install -y ca-certificates curl; install -m 0755 -d /etc/apt/keyrings; curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc; chmod a+r /etc/apt/keyrings/docker.asc
cat >/etc/apt/sources.list.d/docker.sources <<EOF
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: ${UBUNTU_CODENAME:-$VERSION_CODENAME}
Components: stable
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/docker.asc
EOF
apt-get update; apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin; systemctl enable --now docker; docker version >/dev/null; docker compose version >/dev/null; ok 'Docker Engine installed.'
