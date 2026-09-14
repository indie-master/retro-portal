# Retro Portal

<p align="center"><strong>A self-hosted retro game library that runs directly in the browser.</strong></p>

<p align="center">
  <a href="https://indie-master.github.io/retro-portal/"><strong>🎮 OPEN LIVE DEMO</strong></a>
  &nbsp;·&nbsp; <a href="README.md">Русский</a>
  &nbsp;·&nbsp; <a href="docs/en/INSTALL.md">Install</a>
  &nbsp;·&nbsp; <a href="docs/en/LIBRARY.md">Library Manager</a>
  &nbsp;·&nbsp; <a href="SECURITY.md">Security</a>
</p>

<p align="center">
  <a href="LICENSE"><img alt="MIT License" src="https://img.shields.io/badge/license-MIT-d99a47"></a>
  <a href="https://ubuntu.com/server"><img alt="Ubuntu Server" src="https://img.shields.io/badge/Ubuntu-22.04%20%7C%2024.04-E95420?logo=ubuntu&logoColor=white"></a>
  <a href="https://docs.docker.com/engine/"><img alt="Docker Engine" src="https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white"></a>
  <a href="https://emulatorjs.org/"><img alt="EmulatorJS" src="https://img.shields.io/badge/EmulatorJS-4.2.3-a9d56f"></a>
  <a href="CHANGELOG.md"><img alt="Version" src="https://img.shields.io/badge/version-0.8.0-71cde2"></a>
</p>

![Retro Portal home](docs/images/home.png)

## What it is

Retro Portal turns a VPS, mini PC, or home server into a clean browser-based retro game library. A player opens the site, picks a title, and presses **Play**; emulation runs on the player's device in the browser.

The project is built for everyday use: library shelves, search, filters, saves, keyboard/gamepad controls, live activity, launch statistics, and a separate owner dashboard.

## Features

- browser-based emulation powered by EmulatorJS;
- Mega Drive, PlayStation, NES, SNES, Game Boy, GBA, Nintendo 64, and Arcade;
- experimental Dreamcast support;
- search, platform shelves, favorites, and multiplayer filtering;
- per-game or per-platform keyboard profiles;
- gamepad support;
- local ROM launch without uploading the file to the server;
- online presence, “playing now”, and 7-day popularity;
- Library Manager for ROMs, BIOS files, cards, and publishing;
- optional metadata proposals from TheGamesDB/Wikipedia with owner approval;
- Docker Compose, Nginx, and multiple installation modes.

## Live Demo

**https://indie-master.github.io/retro-portal/**

The public build contains only redistributable demo/homebrew ROMs. Activity widgets use representative demo data so the complete interface can be previewed; a self-hosted installation populates the same widgets from the built-in backend.

## Owner interface

Library Manager is available at `/admin.html` and keeps routine collection management out of the shell:

- ROM and BIOS uploads;
- library scan after SCP/SFTP;
- readiness checks;
- title, description, history, and sorting edits;
- featured/visibility management;
- metadata proposals and approval.

![Retro Portal Library Manager](docs/images/admin.png)

See **[docs/en/LIBRARY.md](docs/en/LIBRARY.md)**.

## Quick start

### Option 1 — interactive installer

```bash
sudo apt update
sudo apt install -y git
git clone https://github.com/indie-master/retro-portal.git
cd retro-portal
sudo ./scripts/install.sh
```

The installer supports full setup, integration with an existing Nginx installation, manual snippets, and a local test mode.

### Option 2 — Docker Compose

If Docker Engine/Compose and a reverse proxy are already available:

```bash
git clone https://github.com/indie-master/retro-portal.git
cd retro-portal
cp .env.example .env
./scripts/install-emulatorjs.sh 4.2.3
docker compose build --pull
docker compose up -d
curl -i http://127.0.0.1:8088/healthz
```

A common production layout keeps the app on `127.0.0.1:8088` and terminates HTTPS in host Nginx/Caddy/Traefik.

Full setup guide: **[docs/en/INSTALL.md](docs/en/INSTALL.md)**.

## Architecture

```text
Player browser
  ├─ HTML / CSS / JS
  ├─ EmulatorJS runtime / WASM
  ├─ ROM / BIOS for the selected game
  └─ WebSocket presence
          ↓
      Reverse proxy
          ↓
      Retro Portal
      ├─ web
      ├─ API
      ├─ catalog
      ├─ statistics
      └─ Library Manager
```

After ROM/runtime delivery, emulation runs on the player's device. The server handles the web UI, library files, API, presence, statistics, and owner tools.

Endpoints, caching, and reverse-proxy notes: **[docs/en/NETWORKING.md](docs/en/NETWORKING.md)**.

## Controls

Default desktop mapping:

```text
Arrow keys   movement
Z / X        primary actions
A / S / D    extra buttons
Q / W        shoulder buttons
Enter        Start
Shift        Select / Mode
```

Bindings can be changed on the game page and saved for one title or the entire platform.

## Activity

A self-hosted instance tracks active browser sessions through WebSocket presence and stores launch events for the weekly popularity list. Tabs from the same browser share one local session ID, keeping the online count closer to visitors than raw open-tab count.

## Security

Retro Portal uses layered hardening:

- admin API protected by `ADMIN_TOKEN` and brute-force throttling;
- ROM/BIOS uploads constrained by format allowlists and size limits;
- server-side paths do not trust original uploaded filenames;
- ZIP browser upload disabled by default;
- metadata fetching restricted to trusted sources;
- non-root backend with read-only root filesystem, `no-new-privileges`, and dropped Linux capabilities;
- Nginx CSP, anti-clickjacking, security headers, and API rate limits;
- CI syntax/config checks, `npm audit`, and CodeQL.

See **[SECURITY.md](SECURITY.md)** for the complete threat model and internet-facing deployment guidance.

## Documentation

| Topic | Document |
|---|---|
| Installation | [docs/en/INSTALL.md](docs/en/INSTALL.md) |
| Library Manager | [docs/en/LIBRARY.md](docs/en/LIBRARY.md) |
| Nginx / TLS | [docs/en/NGINX.md](docs/en/NGINX.md) |
| Networking / reverse proxy | [docs/en/NETWORKING.md](docs/en/NETWORKING.md) |
| ROM / BIOS | [docs/en/ROMS.md](docs/en/ROMS.md) |
| Dreamcast | [docs/en/DREAMCAST.md](docs/en/DREAMCAST.md) |
| Troubleshooting | [docs/en/TROUBLESHOOTING.md](docs/en/TROUBLESHOOTING.md) |
| Security | [SECURITY.md](SECURITY.md) |
| Third-party components | [THIRD_PARTY.md](THIRD_PARTY.md) |

## Components

- [EmulatorJS](https://emulatorjs.org/) — browser emulation;
- [Docker Engine / Compose](https://docs.docker.com/engine/) — containers;
- [Nginx](https://nginx.org/) — web/reverse proxy;
- [TheGamesDB](https://thegamesdb.net/) — optional game metadata;
- [MediaWiki API](https://www.mediawiki.org/wiki/API:Main_page) — optional historical context.

## ROMs and BIOS files

Commercial ROMs, BIOS files, and official artwork are not included in the repository. Users provide their own files. The public demo contains only ROMs that may be redistributed.

## License

Retro Portal is released under the [MIT License](LICENSE).
