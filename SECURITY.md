# Security Policy

Retro Portal is designed for self-hosting and uses a defense-in-depth model. Security-sensitive reports should be sent privately to the repository owner instead of being posted with exploit details in a public issue.

## Important limitation

No internet-facing application can truthfully be guaranteed impossible to compromise. The project aims to minimize attack surface, isolate untrusted game data, validate uploads and fail safely. Keep the host OS, Docker, Nginx, EmulatorJS and dependencies updated.

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

## File-upload controls

The server-side upload path follows an allowlist model inspired by the OWASP File Upload Cheat Sheet:

- only platform-specific ROM extensions are accepted;
- upload size is capped by both Nginx and backend limits;
- unsafe path components and control characters are removed;
- stored ROM filenames are generated from a normalized title plus SHA-256 prefix instead of trusting the original path;
- known container/file formats are checked by file signature where reliable;
- ZIP browser uploads are disabled by default (`ALLOW_ZIP_ROMS=0`);
- multi-file CUE/GDI browser uploads are rejected; copy them through a trusted admin channel and scan the folder instead;
- unknown PS1 BIOS images can be rejected unless recognized by a known hash/name flow;
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

The presence WebSocket validates same-origin requests and caps message payload size. The public online counter is based on random browser-session identifiers and is intended as an approximate real count of active browser sessions, not a security identity system.

## Container hardening

The backend container:

- runs as configured non-root UID/GID;
- has a read-only root filesystem;
- drops all Linux capabilities;
- enables `no-new-privileges`;
- uses bounded PID and tmpfs settings;
- receives write access only to catalog/stats, ROM, BIOS and cover volumes.

The Nginx container also uses a read-only root filesystem, `no-new-privileges`, bounded PIDs and explicit tmpfs paths.

## Secrets

Never commit:

- TLS private keys;
- Cloudflare tokens;
- `ADMIN_TOKEN`;
- TheGamesDB API keys;
- commercial ROMs or BIOS files.

Keep `.env` permissions restrictive and back it up separately from the public repository.

## Recommended host controls

For an internet-facing installation:

1. bind Retro Portal itself to `127.0.0.1` and expose it only through the host Nginx;
2. enable HTTPS and modern TLS on the host vhost;
3. use a firewall allowing only required ports;
4. keep Ubuntu and Docker patched;
5. make periodic offline backups of `catalog/`, ROMs, BIOS and covers;
6. consider fail2ban or upstream rate limiting for the public host;
7. consider ClamAV/quarantine if ROMs are obtained from untrusted sources;
8. inspect `docker compose logs` and Nginx access/error logs for anomalous traffic.

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
