# Installation

[← README](../../README_EN.md) · [Nginx/TLS](NGINX.md) · [ROMs/BIOS](ROMS.md) · [Troubleshooting](TROUBLESHOOTING.md)

Recommended baseline: Ubuntu 24.04 LTS, 2 vCPU, 2 GB RAM, 40 GB NVMe and 100 Mbps+ network.

```bash
sudo apt update
sudo apt install -y git
git clone https://github.com/indie-master/retro-portal.git retro-portal
cd retro-portal
sudo ./scripts/install.sh
```

The installer offers four modes: **Full**, **Existing Nginx**, **Manual integration**, and **Local test**.

Examples:

```bash
sudo ./scripts/install.sh --mode full --domain arcade.example.com
sudo ./scripts/install.sh --mode existing --domain arcade.example.com --tls existing
./scripts/install.sh --mode manual --domain arcade.example.com
./scripts/install.sh --mode local
```

TLS modes include existing wildcard/SAN certificates, Let's Encrypt HTTP-01, Cloudflare DNS-01 and custom certificate/key paths.

Verify the deployment with:

```bash
./scripts/doctor.sh --domain arcade.example.com
curl -i http://127.0.0.1:8088/healthz
docker compose ps
sudo nginx -t
```

Install the six MIT-licensed Mega Drive demo ROMs with:

```bash
./scripts/install-homebrew-roms.sh
```

For curated commercial titles, add your own legally obtained ROM/BIOS/artwork using `catalog/presets/curated-classics.json`, then run `./scripts/sync-classics.sh`.