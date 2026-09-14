# Security Policy

Retro Portal is designed for self-hosting and uses a defense-in-depth model. Security-sensitive reports should be sent privately to the repository owner instead of being posted with exploit details in a public issue.

## Important limitation

No internet-facing application can truthfully be guaranteed impossible to compromise. The project aims to minimize attack surface, isolate untrusted game data, validate uploads and fail safely. Keep the host OS, Docker, Nginx, EmulatorJS, browser engines and dependencies updated.

## Trust boundaries

### Public player

A normal visitor can:

- read the public game catalog;
- start games that the owner has already prepared;
- open the local-ROM player;
- establish the presence WebSocket.

A normal visitor **cannot upload a ROM or BIOS to server storage**. `/local.html` uses a browser Object URL, so the selected ROM remains on the visitor's device.

### Server owner

Only the protected `/admin.html` API may upload ROM/BIOS files, scan server folders, change cards or approve metadata. Use a long random `ADMIN_TOKEN`, serve the site only over HTTPS, and do not share that token.

For higher-risk/public installations, place `/admin.html` and `/api/admin/` behind an additional host-level control such as an IP allowlist, VPN/private management network, mTLS, or a second authentication layer. The application token should not be treated as the only possible perimeter.

## ROM threat boundary

A ROM is untrusted binary input to an emulator core. File-name, extension and magic checks can reject obviously invalid uploads, but **they cannot prove that a ROM is safe for every emulator implementation**.

Retro Portal therefore separates the risks:

- the backend stores and serves ROM bytes; it does not execute them as host programs;
- emulation runs in the user's browser through EmulatorJS/libretro cores;
- a malicious ROM that exploits a bug in an emulator core would primarily target that client-side emulator/browser boundary, not become a server-side executable merely by being uploaded;
- only the administrator can publish server-hosted ROMs;
- public users' own ROMs remain local to their own browser.

Use ROMs from sources you trust, keep EmulatorJS/cores and browsers updated, and consider quarantine/malware scanning when importing files from untrusted third parties. Antivirus scanning is defense in depth; it is not a substitute for keeping emulator cores patched.

## File-upload controls

The server-side upload path follows an allowlist model inspired by the OWASP File Upload Cheat Sheet:

- only platform-specific ROM extensions are accepted;
- upload size is capped by both Nginx and backend limits;
- unsafe path components and control characters are removed;
- stored ROM filenames are generated from a normalized title plus SHA-256 prefix instead of trusting the original path;
- known container/file formats are checked by file signature where reliable;
- ZIP browser uploads are disabled by default (`ALLOW_ZIP_ROMS=0`);
- multi-file CUE/GDI browser uploads are rejected; copy them through a trusted admin channel and scan the folder instead;
- known PlayStation BIOS hashes can be recognized and canonicalized;
- ROM/BIOS data is never executed as an operating-system program by the backend;
- uploaded data lives on dedicated mounted paths rather than inside the application code tree.

If the host accepts ROMs from people you do not trust, add host-level malware scanning/quarantine (for example ClamAV) before publishing files. Retro Portal itself intentionally does not send private ROM files to third-party malware scanning services.

## Metadata and SSRF controls

External metadata is fetched server-side. Cover downloads are restricted to HTTPS hosts under `thegamesdb.net`, redirects are rejected, responses have time/size limits, image Content-Type is allowlisted and common image signatures are verified.

Wikipedia history lookup uses fixed `ru.wikipedia.org` / `en.wikipedia.org` API hosts. Visitors cannot submit arbitrary metadata-fetch URLs.

External text is stored as plain text, control characters are removed, length is limited and the owner must approve `pendingMetadata` before publication.

## Browser security

The bundled Nginx configuration adds:

- `Content-Security-Policy` compatible with same-origin EmulatorJS/WASM;
- `X-Frame-Options: DENY` and CSP `frame-ancestors 'none'`;
- `X-Content-Type-Options: nosniff`;
- `Referrer-Policy: same-origin`;
- restrictive `Permissions-Policy`;
- COOP/COEP/CORP headers required for threaded browser emulation;
- API rate limiting;
- no directory listing for ROM/BIOS/runtime paths;
- `noindex`/`noarchive` on the admin page.

HSTS should be enabled on the **public TLS vhost** after HTTPS is verified. It is not forced in the inner HTTP container because Retro Portal also supports local-only and stream-to-inner-TLS deployments.

## WebSocket / online counter

The presence WebSocket validates same-origin browser requests when an Origin header is present and caps message payload size. The public online counter is based on random browser-session identifiers and is intended as an approximate real count of active browser sessions, not a security identity system.

Presence/popularity data must not be treated as authentication, billing, anti-fraud or another security-sensitive metric. Non-browser clients can potentially attempt to imitate public presence traffic, so these numbers are deliberately informational only.

## Container hardening

The backend container:

- runs as configured non-root UID/GID;
- has a read-only root filesystem;
- drops all Linux capabilities;
- enables `no-new-privileges`;
- uses bounded PID and tmpfs settings;
- receives write access only to catalog/stats, ROM, BIOS and cover volumes.

The standard web container uses a read-only root filesystem, `no-new-privileges`, bounded PIDs and explicit tmpfs paths.

The scale-out edge container is intentionally smaller and has no backend/admin credentials. It:

- runs as the unprivileged `nginx` user;
- has a read-only root filesystem;
- drops all Linux capabilities;
- enables `no-new-privileges`;
- receives ROM/BIOS/runtime/artwork mounts as read-only;
- keeps only temporary Nginx paths in bounded tmpfs mounts;
- returns `404` for `/admin.html` and `/api/admin/*`.

## Scale-out / cluster threat model

Multi-node mode adds new trust boundaries: SSH synchronization, edge hosts, the control/origin link, and a front load balancer/CDN.

Retro Portal uses the following rules:

- `cluster/nodes.conf` is ignored by Git because it may contain real infrastructure hostnames/IPs;
- cluster inventory stores no passwords/private keys;
- `cluster-sync.sh` copies only ROMs, BIOS, artwork/screenshots and optional EmulatorJS runtime;
- `.env`, `ADMIN_TOKEN`, mutable catalog/state and Git credentials are never replicated to edge nodes;
- `cluster-sync.sh` and `cluster-update.sh` use SSH `BatchMode` and normal host-key verification rather than disabling `StrictHostKeyChecking`;
- edge-origin HTTPS enables certificate verification and uses the system CA store;
- admin endpoints are disabled on edge nodes;
- resource limits are configurable per edge to stop a replica from consuming the whole host;
- rolling/canary updates are recommended instead of changing every node simultaneously.

Recommended network controls:

1. prefer a private VLAN/WireGuard/Tailscale path for edge → control/origin;
2. if the public Internet is used, keep HTTPS verification enabled;
3. firewall the origin to known edge IPs and administrative addresses where practical;
4. use a separate admin hostname/private management path for larger installations;
5. do not expose SSH with password authentication solely for cluster sync; use dedicated keys and least-privilege accounts;
6. drain an edge from the LB/CDN before maintenance/removal;
7. treat every edge as a read-only replica: owner changes happen only on control/origin.

The current design deliberately centralizes mutable application state instead of introducing distributed writes. This reduces split-brain and stale-catalog risks. If future versions implement HA backend writers, they should use a real shared datastore with explicit consistency/locking rather than file replication.

## Safe updates and rollback

`scripts/update.sh` refuses a dirty Git working tree, uses `git pull --ff-only`, rebuilds/recreates the selected standalone or edge Compose deployment, and checks local `/healthz`. If a Git update was applied and the new deployment cannot become healthy, the script attempts to reset to the previous commit and rebuild that version.

This is a recovery aid, not a replacement for backups. Before changes that alter persistent data or library formats, create an explicit backup.

For multi-node deployments update control/origin first, then one canary edge, then the rest of the pool.

## Dependency and code scanning

The repository security workflow runs:

- `npm audit --omit=dev --audit-level=high` for production Node dependencies;
- GitHub CodeQL for JavaScript/TypeScript;
- Dependabot update checks for npm, Docker and GitHub Actions.

The main CI also validates both standard and edge Compose configurations and boots the edge container to verify local health, admin-path denial and container hardening.

A green scan is useful evidence, not a mathematical proof of safety. Newly disclosed vulnerabilities can appear after a release, so updates should be applied continuously.

## Secrets

Never commit:

- TLS private keys;
- Cloudflare tokens;
- `ADMIN_TOKEN`;
- TheGamesDB API keys;
- commercial ROMs or BIOS files;
- `cluster/nodes.conf` from a real deployment.

Keep `.env` and `.env.edge` permissions restrictive. Backups created for migration can contain `.env` and `catalog/admin-token`; treat them as secrets.

## Recommended host controls

For an internet-facing installation:

1. bind Retro Portal itself to `127.0.0.1` and expose it only through the host Nginx/LB;
2. enable HTTPS and modern TLS on the host vhost;
3. use a firewall allowing only required ports;
4. keep Ubuntu, Docker, browsers and EmulatorJS patched;
5. make periodic offline backups of `catalog/`, ROMs, BIOS and covers;
6. consider fail2ban or upstream rate limiting for the public host;
7. consider ClamAV/quarantine if ROMs are obtained from untrusted sources;
8. restrict the admin endpoint at the reverse proxy when practical;
9. inspect Docker and Nginx logs for anomalous traffic;
10. on edge hosts, expose only the front proxy/LB-facing port and required management SSH.

## References

- OWASP File Upload Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html
- OWASP Content Security Policy Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html
- OWASP HTTP Headers Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html
- Docker security: https://docs.docker.com/engine/security/
- Nginx documentation: https://nginx.org/en/docs/

## Reporting a vulnerability

Please report privately to the repository owner with:

- affected version/commit;
- attack prerequisites;
- reproducible steps or proof of concept;
- expected impact;
- suggested mitigation, if known.

Do not include working exploit details in a public issue before a fix is available.
