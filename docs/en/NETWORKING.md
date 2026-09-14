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

Edges serve bandwidth-heavy files locally and proxy `/api/*` and `/ws/*` to control/origin. `/admin.html` and `/api/admin/*` are disabled on edge nodes.

This spreads bandwidth and file I/O while keeping one consistent catalog/presence/statistics source. See [SCALING.md](SCALING.md).

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

In scale-out mode this proxying is handled by the edge configuration. All edge presence traffic returns to the same control/origin, so online/current-game counters remain global.

## Caching

Good CDN/edge cache targets:

- `/emulatorjs/`;
- `/assets/`;
- `/covers/`;
- `/screenshots/`;
- `/roms/` when appropriate for your library policy.

Avoid long-lived caching for `/api/`, `/ws/`, `/admin.html`, and `/healthz`. Preserve Range requests for large game files.

## Origin connectivity

Prefer a private VLAN/WireGuard/Tailscale path from edges to control/origin. When the public Internet is used:

- use HTTPS;
- keep TLS certificate verification enabled;
- restrict origin access by edge IPs/firewall where practical;
- separate administrative access from the public origin path.

The bundled edge image includes a CA store and verifies HTTPS origin certificates.

## Health checks

Single/control `/healthz` checks the backend. Edge `/healthz` is intentionally local to the edge and does not depend on control/origin, allowing the LB to evaluate edge health separately from control-plane health.

Use `/api/status` or origin `/healthz` to monitor the dynamic control plane.

## Verification

```bash
curl -i https://arcade.example.com/healthz
curl -s https://arcade.example.com/api/games | jq
curl -s https://arcade.example.com/api/activity | jq
```

Presence:

```text
wss://arcade.example.com/ws/presence
```

## Multiple applications on one host

Separate applications by hostname/upstream, especially on a server that already runs other services:

```text
arcade.example.com    → Retro Portal
files.example.com     → another application
status.example.com    → monitoring
```

For an existing complex Nginx configuration use the `existing` or `manual` install mode: [INSTALL.md](INSTALL.md).
