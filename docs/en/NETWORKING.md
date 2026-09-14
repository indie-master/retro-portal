# Networking and reverse proxy

[← README](../../README_EN.md) · [Install](INSTALL.md) · [Nginx/TLS](NGINX.md) · [Security](../../SECURITY.md)

This document describes Retro Portal's network architecture, main endpoints, and a recommended production publishing layout.

## Main endpoints

| Endpoint | Purpose | Profile |
|---|---|---|
| `/`, `/game.html`, `/local.html` | portal UI | normal HTTPS |
| `/emulatorjs/` | EmulatorJS JS/WASM/cores | HTTPS, cache-friendly |
| `/roms/` | ROM delivery for prepared games | HTTPS download |
| `/bios/` | BIOS delivery for browser cores | HTTPS download |
| `/api/games` | public catalog | short JSON requests |
| `/api/activity` | online/activity statistics | short JSON requests |
| `/ws/presence` | presence and current game | long-lived WebSocket |
| `/api/admin/*` | Library Manager | HTTPS, authenticated |
| `/healthz` | health check | short HTTP/HTTPS request |

After runtime and ROM delivery, emulation runs on the player's device. The server mainly serves web/assets, stores catalog/statistics data, and maintains presence sessions.

## Typical session

1. The browser loads HTML, CSS, JavaScript, and artwork.
2. `/ws/presence` opens.
3. Starting a game downloads the required EmulatorJS core/runtime, ROM, and optional BIOS.
4. Emulation continues locally in the browser.
5. The presence WebSocket carries small `playing`, `idle`, heartbeat, and online-update events.
6. Base save-state/SRAM storage stays in the browser.

## Recommended production layout

```text
Internet
   ↓ HTTPS
Nginx / Caddy / Traefik / CDN
   ↓ HTTP localhost
127.0.0.1:8088
   ↓
Retro Portal
```

Keep the internal application port bound to `127.0.0.1` where possible and terminate public HTTPS, certificates, and outer security headers at the reverse proxy.

## WebSocket

The reverse proxy must pass upgrade headers for `/ws/presence`:

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

If WebSocket connectivity is unavailable, online/current-activity widgets will not update, while the library and normal HTTP API remain usable.

## Caching

Static resources are good candidates for longer caching:

- `/emulatorjs/`;
- `/assets/`;
- `/covers/`;
- `/screenshots/`.

Avoid long-lived caches for:

- `/api/`;
- `/admin.html`;
- `/healthz`.

ROM/BIOS caching depends on how your library is updated. Keep Range request support for large files where possible.

## Verification

```bash
curl -i https://arcade.example.com/healthz
curl -s https://arcade.example.com/api/games | jq
curl -s https://arcade.example.com/api/activity | jq
```

Test presence with a standard WebSocket client at:

```text
wss://arcade.example.com/ws/presence
```

The `Origin` header should match the portal hostname.

## Multiple applications on one host

If one server hosts multiple websites or applications, separate hostnames and upstream/server blocks make TLS, logging, rate limits, updates, and troubleshooting easier.

Example:

```text
arcade.example.com    → Retro Portal
files.example.com     → another application
status.example.com    → monitoring
```

For an existing complex Nginx setup, use the `existing` or `manual` install mode: [INSTALL.md](INSTALL.md).
