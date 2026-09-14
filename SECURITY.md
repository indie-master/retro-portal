# Security Policy

Retro Portal is designed for self-hosting and uses defense in depth. Security-sensitive reports should be sent privately to the repository owner instead of publishing exploit details before a fix exists.

## Important limitation

No internet-facing application can be guaranteed impossible to compromise. Keep the host OS, Docker, Nginx, EmulatorJS/browser engines and dependencies patched, and keep backups of persistent data.

## Trust boundaries

### Public player

A visitor may read the public catalog, download owner-published game/runtime assets, run games in the browser, use the local-ROM player and establish presence WebSocket sessions. A normal visitor cannot upload ROM/BIOS/cover files to server storage.

### Server owner

Only authenticated `/api/admin/*` routes may upload files, scan folders, change cards or trigger owner workflows. Use a long random `ADMIN_TOKEN`, HTTPS, and an additional host-level admin control for higher-risk installations (IP allowlist/private management network/mTLS/second auth layer).

### Metadata worker

The automatic metadata worker is an internal Docker service. It:

- exposes no listening port;
- runs non-root with read-only root filesystem, no Linux capabilities and `no-new-privileges`;
- reads the persistent admin token from a read-only catalog mount when the token is not supplied through environment;
- talks to the backend only through the internal Compose network;
- uses fixed external metadata/image providers rather than visitor-supplied URLs;
- preserves owner-edited metadata by default (`AUTO_METADATA_OVERWRITE=0`).

Compromise of an external metadata provider must not become arbitrary server-side URL fetching. Keep provider host allowlists narrow.

## ROM threat boundary

ROMs are untrusted emulator input. Extension/magic checks can reject obvious invalid uploads, but cannot prove a ROM safe for every emulator implementation.

- the backend stores/serves ROM bytes and does not execute them as host programs;
- emulation runs in the player's browser through EmulatorJS/libretro cores;
- only administrators can publish server-hosted ROMs;
- public local-ROM files stay in the visitor's browser;
- keep emulator cores and browsers updated, and consider host quarantine/malware scanning for ROMs from untrusted third parties.

## File-upload controls

Server-side uploads use an allowlist model:

- platform-specific ROM extensions;
- Nginx/backend size limits;
- sanitized file names and generated SHA-256-backed storage names;
- known format signature checks where reliable;
- ZIP browser upload disabled by default;
- multi-file CUE/GDI browser upload rejected;
- PlayStation BIOS hash recognition/canonical naming;
- ROM/BIOS stored on dedicated mounted paths;
- final validated ROM/BIOS/cover files are readable by the read-only web container, while temporary uploads remain private during ingestion;
- manual cover upload accepts only JPG/PNG/WebP, caps size and verifies image signatures.

## Metadata, artwork and SSRF controls

Automatic enrichment is platform-aware and accepts a match only after title-confidence checks. TheGamesDB queries are platform-filtered when an API key is configured. Wikipedia search includes platform context. Cover lookup may use TheGamesDB, the platform-specific Libretro thumbnails repository, or an allowed Wikimedia image.

Security properties:

- outbound artwork hosts are hard-coded/allowlisted;
- only HTTPS is accepted for remote artwork;
- redirects are rejected;
- downloads have time and 8 MB size limits;
- downloaded artwork goes through the existing authenticated cover-upload endpoint and image-signature validation before publication;
- external text is normalized and length-limited;
- failed/no-match games use retry backoff;
- automatic enrichment does not overwrite populated owner fields unless `AUTO_METADATA_OVERWRITE=1` is explicitly configured.

The older manual proposal/approval path remains available as a fallback.

## Reverse proxies and client IPs

Retro Portal normally binds to host loopback and trusts the host reverse proxy, not arbitrary Internet clients, to normalize the client address.

The web container logs the normalized `X-Real-IP` while retaining the Docker peer for diagnostics. Do not forward raw, untrusted `X-Real-IP` from the public Internet.

For Nginx `stream` + PROXY protocol deployments, use `$proxy_protocol_addr` in the inner HTTPS vhost when forwarding `X-Real-IP`/`X-Forwarded-For` to Retro Portal. For a CDN/LB, configure provider-specific trusted proxy ranges/client-IP headers at the host proxy before forwarding a normalized address.

Client IP is used only for logs and coarse throttling; it is not an authentication identity.

## Browser security

Bundled Nginx applies CSP, anti-framing, `nosniff`, same-origin referrer policy, restrictive permissions policy, COOP/COEP/CORP headers, API rate limits and disabled directory listing. The EmulatorJS bootstrap loader is deliberately not immutable-cached so transient deployment errors do not remain sticky in browsers.

Touch/mobile mode requests fullscreen/orientation APIs only from a user action; denial of those permissions falls back to the normal player layout.

## WebSocket / presence

Presence validates same-origin browser requests when `Origin` is present and caps message size. Online/popularity is informational and must not be used as authentication, billing or anti-fraud data.

## Container hardening

### Backend

- configured non-root UID/GID;
- read-only root filesystem;
- all capabilities dropped;
- `no-new-privileges`;
- bounded PIDs/tmpfs;
- write access limited to catalog/stats, ROM, BIOS and cover volumes.

### Metadata worker

- same non-root UID/GID model;
- read-only root filesystem;
- all capabilities dropped;
- `no-new-privileges`;
- no public port;
- catalog mount is read-only;
- does not directly write ROM/BIOS/cover directories; cover publication goes through authenticated backend validation.

### Web and edge

The web container is read-only with bounded PIDs/tmpfs. The edge image runs unprivileged/read-only, drops capabilities, receives game/runtime/artwork mounts read-only, and returns `404` for admin paths.

## Scale-out threat model

Multi-node mode adds SSH sync, edge hosts, origin links and the front LB/CDN as trust boundaries.

- `cluster/nodes.conf` is ignored by Git;
- cluster inventory contains no passwords/private keys;
- sync copies only library/runtime/artwork payloads, not `.env`, admin tokens or mutable state;
- SSH host-key verification remains enabled;
- edge-origin HTTPS verifies certificates;
- admin endpoints are disabled on edge nodes;
- use private networking/firewalls where practical;
- update control/origin first, then a canary edge, then the rest.

## Safe updates and rollback

`scripts/update.sh` refuses a dirty Git tree, uses `git pull --ff-only`, rebuilds/recreates the selected deployment and validates `/healthz`. If a pulled revision cannot become healthy, it attempts to restore the previous commit and containers. This is recovery assistance, not a replacement for backups.

## Dependency and code scanning

Security workflow runs production `npm audit` at high/critical threshold and GitHub CodeQL for JavaScript/TypeScript. CI validates JavaScript, Compose, Nginx, file permissions, protected cover upload, real-IP logging, standalone runtime behavior and hardened edge behavior.

A green scan is evidence, not proof that no vulnerability exists.

## Secrets

Never commit TLS private keys, CDN/DNS tokens, `ADMIN_TOKEN`, TheGamesDB API keys, commercial ROM/BIOS files, or real `cluster/nodes.conf`. Treat `.env`, `.env.edge`, migration backups and `catalog/admin-token` as secrets.

## Recommended host controls

1. bind the app to `127.0.0.1` and expose it through a host reverse proxy/LB;
2. use HTTPS and modern TLS;
3. expose only required firewall ports;
4. restrict admin paths at the reverse proxy when practical;
5. keep Ubuntu/Docker/Nginx/browser/emulator components patched;
6. back up catalog, ROMs, BIOS and covers;
7. monitor host and container logs;
8. use malware quarantine/scanning when importing untrusted ROM collections;
9. on edge hosts expose only LB-facing service ports and required management SSH;
10. configure client-IP trust only for known reverse proxies/CDN ranges.

## Reporting a vulnerability

Send the repository owner the affected version/commit, prerequisites, reproducible steps, expected impact and suggested mitigation if known. Do not publish a working exploit before a fix is available.
