# Networking and reverse proxy

[← README](../../README_EN.md) · [Install](INSTALL.md) · [Scaling](SCALING.md) · [Nginx/TLS](NGINX.md) · [Security](../../SECURITY.md)

This document describes Retro Portal's network architecture, main endpoints and production publishing layouts.

## Main endpoints

| Endpoint | Purpose | Profile |
|---|---|---|
| `/`, `/game.html`, `/local.html` | portal UI | normal HTTPS |
| `/emulatorjs/` | EmulatorJS JS/WASM/cores | HTTPS, cache-friendly |
| `/roms/` | ROM delivery | HTTPS download / Range |
| `/bios/` | BIOS delivery | HTTPS download |
| `/api/games` | public catalog | short JSON requests |
| `/api/activity` | online/activity data | short JSON requests |
| `/api/play/*` | game-launch event | short POST |
| `/ws/presence` | presence/current game | long-lived WebSocket |
| `/api/admin/*` | Library Manager | authenticated HTTPS |
| `/healthz` | health check | short HTTP/HTTPS request |

After runtime and ROM delivery, emulation runs on the player's device. The server primarily serves assets, stores catalog/statistics and maintains presence sessions.

## Single-node production

```text
Internet
   ↓ HTTPS
Nginx / Caddy / Traefik / CDN
   ↓ HTTP localhost
127.0.0.1:8088
   ↓
Retro Portal
```

Keep the internal app port on `127.0.0.1` where possible and terminate public TLS at the host reverse proxy.

## Real client addresses

The bundled web container logs a normalized `X-Real-IP` as the first field and retains `peer=...` for the actual Docker peer. This makes access logs useful without hiding the proxy hop.

For a normal host Nginx reverse proxy:

```nginx
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $remote_addr;
```

If public `:443` is owned by `stream { ssl_preread; }` and the stream frontend forwards to an inner HTTPS vhost with PROXY protocol, `$proxy_protocol_addr` is the authoritative source address:

```nginx
server {
    listen 127.0.0.1:8443 ssl proxy_protocol;

    set_real_ip_from 127.0.0.1;
    real_ip_header proxy_protocol;

    location / {
        proxy_pass http://127.0.0.1:8088;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $proxy_protocol_addr;
        proxy_set_header X-Forwarded-For $proxy_protocol_addr;
        proxy_set_header X-Forwarded-Proto https;
    }
}
```

Use the same client-IP headers in `/ws/` together with the WebSocket Upgrade headers.

Do not trust arbitrary client-supplied `X-Real-IP`. When a CDN/LB is in front, configure the host proxy to accept the provider's client-IP header only from the provider's trusted proxy ranges, then forward the normalized address to Retro Portal.

Verification:

```bash
docker compose logs --since=2m web | tail -20
```

The first field should be the client address; `peer=` will normally remain a Docker bridge address.

## Scale-out production

```text
Internet
   ↓
CDN / Load Balancer
   ↓
Edge pool
   ├─ static / ROM / BIOS / EmulatorJS
   └─ proxy API + WebSocket
          ↓
     Control / Origin
     backend + admin + stats
```

Edges serve bandwidth-heavy files locally and proxy `/api/*` and `/ws/*` to control/origin. `/admin.html` and `/api/admin/*` are disabled on edge nodes. See [SCALING.md](SCALING.md).

## WebSocket

A normal reverse proxy must forward Upgrade headers:

```nginx
location /ws/ {
    proxy_pass http://127.0.0.1:8088;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}
```

For a stream/PROXY-protocol profile use `$proxy_protocol_addr` instead, as shown above.

## Caching

Good CDN/edge cache targets include `/emulatorjs/` (except bootstrap `loader.js`), `/assets/`, `/covers/`, `/screenshots/`, and `/roms/` when appropriate for your library policy.

Avoid long-lived caching for `/api/`, `/ws/`, `/admin.html`, `/healthz`, and `/emulatorjs/data/loader.js`. Preserve Range requests for large game files.

## Origin connectivity

Prefer a private VLAN/WireGuard/Tailscale path from edges to control/origin. When the public Internet is used, use HTTPS, keep TLS verification enabled, and restrict origin access by edge IPs/firewall where practical.

## Health checks

Single/control `/healthz` checks the backend. Edge `/healthz` is intentionally local to the edge and does not depend on control/origin.

```bash
curl -i https://arcade.example.com/healthz
curl -s https://arcade.example.com/api/status | jq
```

## Verification

```bash
curl -i https://arcade.example.com/healthz
curl -s https://arcade.example.com/api/games | jq
curl -s https://arcade.example.com/api/activity | jq
```

Presence: `wss://arcade.example.com/ws/presence`.

## Multiple applications on one host

Separate applications by hostname/upstream. For an existing complex Nginx configuration use the `existing` or `manual` install mode: [INSTALL.md](INSTALL.md).
