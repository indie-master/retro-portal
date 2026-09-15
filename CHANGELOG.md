# Changelog

## 0.11.3 — Mobile PlayStation memory fix

- stream same-origin PlayStation CHD/PBP images into EmulatorJS MEMFS with validated 8 MiB HTTP range requests;
- eliminate the second full-size JavaScript ROM buffer that caused iPhone Safari to reload near the end of a download;
- disable the EmulatorJS ROM cache and threaded core for PlayStation on touch devices;
- keep the simple 0.11.2 player UI and its single fullscreen action unchanged;
- fall back to the full-viewport player when iPhone WebKit exposes a fullscreen method but silently ignores the request;
- validate byte-range delivery from the ROM location in the runtime smoke test;
- refuse deployment with an incompatible EmulatorJS bootstrap instead of silently falling back to full-buffer loading;
- pause activity polling and presence sockets in hidden tabs to remove misleading background traffic from access logs.

## 0.11.2 — Simple player UI rollback

- restore the clean pre-mobile-mode player surface;
- remove the separate mobile-mode action, launch card, waiting copy, rotate hint and in-game exit overlay;
- keep one fullscreen action for desktop and mobile, with native fullscreen first and a clean viewport fallback;
- hide normal loading/ready notices while retaining visible error reporting;
- preserve the PlayStation mobile memory limits and dedicated touch controls introduced in 0.11.1.

## 0.11.1 — Mobile player hotfix

- restore the documented mobile-mode action removed during the 0.11.0 player consolidation;
- defer ROM downloads on touch devices until an explicit play gesture;
- add an iOS-safe full-viewport fallback with visual-viewport and safe-area handling plus an always-available exit control;
- reduce PlayStation peak memory pressure on mobile by disabling threaded mode and large EmulatorJS IndexedDB ROM copies;
- replace EmulatorJS's generic A/B/C fallback with a dedicated PlayStation touch layout;
- expose ROM byte size/format in the game API and cover the deferred mobile launch path in CI.

## 0.11.0 — Player, library and reliable updates

- consolidate player/library polish and deployment fixes previously split across PRs #20, #21 and #22;
- improve mobile player layout, controls, library filtering and owner library management;
- recreate and validate the frontend on update and rollback so replaced Nginx bind mounts are loaded;
- recover from container build/start failures as well as failed health checks;
- revalidate application JS/CSS on standalone and edge deployments;
- derive client IP from the trusted real-IP module and log the original proxy peer separately.

## 0.10.0 — Mobile play, automatic metadata & real client IPs

- added a touch-first mobile player with safe-area handling, responsive controls, fullscreen mobile mode and best-effort landscape orientation locking;
- kept EmulatorJS virtual touch controls and USB/Bluetooth gamepad support available on mobile browsers;
- added an isolated non-root `metadata` worker that automatically fills missing game information without exposing a public port;
- made metadata matching platform-aware: TheGamesDB searches use a resolved platform filter and title-confidence checks so same-name releases on different consoles are less likely to be mixed up;
- added Wikipedia platform-qualified description/history fallback plus platform-specific Libretro thumbnail fallback for cover art;
- kept manual owner fields intact by default and added provider retry/backoff to avoid repeated external requests for no-match titles;
- routed downloaded artwork back through the existing authenticated 8 MB cover-upload/signature-validation path instead of writing unvalidated images directly;
- changed the container access log to show the normalized client IP as the first field while retaining the Docker `peer=` address for diagnostics;
- hardened stream/PROXY-protocol Nginx templates to forward `$proxy_protocol_addr` to the portal rather than losing the source address on the host-to-Docker hop;
- fixed the edge EmulatorJS location/cache rules to match the standalone runtime behavior;
- expanded RU/EN networking, mobile, library and security documentation and added CI coverage for the new worker/mobile/IP path;
- bumped project version to `0.10.0`.

## 0.9.2 — Production polish

- preserve the actual client address through the host reverse proxy into the Docker web container so access logs and backend throttling no longer see only the Docker gateway;
- added owner-side JPG/PNG/WebP cover uploads from each game editor with an 8 MB limit and image-signature validation;
- fixed uploaded ROM/BIOS permissions so validated final files are readable by the read-only web container while temporary upload files remain private;
- stopped long-lived immutable caching for the EmulatorJS bootstrap loader so transient runtime delivery errors do not stick in browsers;
- simplified game cards without artwork by removing the generated text-heavy pseudo-cover;
- extended CI with real-IP logging, ROM mode, cover upload/mode and public-delivery checks;
- bumped project version to `0.9.2`.

## 0.9.1 — Docker-first `/opt` quick install

- added `scripts/quick-install.sh` for a safe one-command bootstrap into `/opt/retro-portal`;
- quick install keeps Retro Portal application services in Docker Compose while preserving any existing host reverse proxy as external infrastructure;
- repeated quick-install runs only fast-forward a clean Retro Portal checkout and refuse unknown/non-project directories;
- prepared mutable library/catalog paths for the non-root backend container without recursively rewriting ownership of large ROM collections;
- updated RU/EN README and installation guides so `/opt/retro-portal` is the default quick-install and operations path;
- documented manual Docker Compose deployment under `/opt`, existing-Nginx integration, updates and removal from the same location;
- bumped project version to `0.9.1`.

## 0.9.0 — Scale-out & Safe Updates

- kept the original single-node deployment as the default while adding an optional control/origin + edge architecture;
- added `docker-compose.edge.yml` and a hardened unprivileged read-only edge image for distributing ROM/runtime/artwork traffic;
- edge nodes serve cacheable/static game payload locally and proxy API/WebSocket traffic to a single control/origin so presence/statistics remain consistent;
- disabled `/admin.html` and `/api/admin/*` on edge nodes;
- enabled verified HTTPS for edge → origin traffic and documented private-network/firewall recommendations;
- added configurable CPU/RAM guardrails for edge containers;
- added `cluster/nodes.example`, `scripts/cluster-sync.sh` and `scripts/cluster-update.sh` for SSH/rsync payload replication and rolling code updates;
- cluster sync explicitly excludes `.env`, admin tokens, mutable catalog/state and credentials;
- added `scripts/uninstall-edge.sh` for scoped edge removal without touching host Nginx or unrelated Docker resources;
- replaced the minimal updater with `scripts/update.sh` supporting standalone/edge modes, `git pull --ff-only`, health checks and automatic previous-commit rollback attempts;
- added RU/EN scaling and update guides plus expanded installation/networking/security documentation;
- CI validates the edge Compose file, hardened edge runtime and admin-path denial;
- bumped project version to `0.9.0`.

## 0.8.1 — Safe removal & migration

- replaced the minimal uninstaller with a conservative workflow for hosts running other services;
- added dry-run, move/backup, data purge, runtime cleanup and optional image cleanup modes;
- installer-managed Nginx vhosts are backed up, tested and automatically restored on validation/reload failure;
- arbitrary shared Nginx/stream maps are never rewritten by the uninstaller;
- global Docker prune, Docker/Nginx removal and certificate deletion are deliberately avoided.

## 0.8.0 — Controls, Activity & Security

- added per-game/per-platform keyboard profiles through EmulatorJS controls;
- added unique-session presence, launch statistics, current activity and 7-day popularity;
- added owner-side metadata proposals/approval and direct card editing;
- hardened uploads, metadata fetching, WebSocket handling, containers, CSP/security headers and rate limits;
- expanded the threat model and production documentation.

## 0.7.1 — Automatic metadata

- added optional TheGamesDB metadata lookup after owner ROM upload;
- retained usable ROM cards when metadata lookup fails.

## 0.7.0 — Library Manager

- split player and owner interfaces;
- added protected browser ROM/BIOS uploads, library scanning, generated admin token, BIOS diagnostics and optional metadata enrichment.

## 0.6.0 — Library Experience Update

- rebuilt the home page around the actual game library;
- added platform shelves, curated installable cards and improved player navigation.

## 0.5.0

- added redistributable homebrew demo ROMs and a playable GitHub Pages build.

## 0.4.0

- introduced the warm retro visual direction and compact library grid.

## 0.3.0

- added platform shelves, search, multiplayer filtering, cover/screenshot support and curated metadata presets.

## 0.2.0

- added GitHub-ready installation modes, Nginx detection, TLS workflows and diagnostics.

## 0.1.0

- initial browser retro portal with EmulatorJS, homebrew demo catalog and WebSocket presence.
