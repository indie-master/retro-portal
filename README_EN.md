# Retro Portal

<p align="center"><strong>A cozy self-hosted retro library: the owner curates the collection, players simply press Play.</strong></p>

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
  <a href="SECURITY.md"><img alt="Security" src="https://img.shields.io/badge/security-hardened-7ddc78"></a>
</p>

![Retro Portal home](docs/images/home.png)

## Architecture

```text
Player
  ↓
/                     → only titles that are ready to play
/game.html?id=...      → emulator + portal keyboard layer
/local.html            → local user ROM; never uploaded

Owner
  ↓
/admin.html             → ROMs, BIOS, cards, metadata review, publishing
```

The public portal never exposes missing-ROM or BIOS diagnostics. A title appears only after the required runtime files are ready.

## 0.8.0 highlights

- portal-native keyboard configuration on top of EmulatorJS `EJS_defaultControls`;
- per-game or per-platform keyboard profiles;
- real online presence deduplicated by browser session ID;
- real "playing now" and 7-day popularity based on actual launches;
- automatic game description/history proposals;
- metadata review workflow: **Approve / Reject** before publication;
- title, story, history, featured and visibility management from `/admin.html`;
- hardened ROM/BIOS upload path with extension allowlists, limits and safe stored filenames;
- ZIP browser uploads disabled by default;
- metadata cover downloads restricted to trusted provider hosts;
- non-root/read-only backend container, dropped Linux capabilities and `no-new-privileges`;
- CSP, anti-clickjacking headers and API rate limits.

## Keyboard controls

Retro Portal uses EmulatorJS' supported custom control mapping and adds a simple UI. Open any game and press **Keyboard** to change a binding. Profiles can be saved for one title or the entire platform.

Default desktop layout:

```text
Arrow keys   movement
Z / X        primary actions
A / S / D    extra buttons
Q / W        shoulder buttons
Enter        Start
Shift        Select / Mode
```

Official EmulatorJS control mapping docs: https://emulatorjs.org/docs4devs/control-mapping/

## Real activity, not fake social proof

The self-hosted online counter is based on live WebSocket sessions. Multiple tabs in the same browser share one local presence ID, so they do not inflate the counter.

Retro Portal does not fabricate popularity. When nobody is playing, the UI says so. After real launches, the backend persists launch events and builds a 7-day popularity list. GitHub Pages clearly labels backend-less activity as demo mode.

## Metadata review

With `THEGAMESDB_API_KEY` configured, the backend can propose title/year/player count/overview/box art. Wikipedia's public API can optionally provide a short historical context paragraph.

```ini
THEGAMESDB_API_KEY=your-key
WIKIPEDIA_METADATA=1
```

External text is sanitized and length-limited. It is stored as `pendingMetadata` and is not published until the owner approves it in `/admin.html`.

## Security

Only the owner/admin can upload ROMs or BIOS files to the server. The public **Local ROM** page keeps user-selected files inside the browser.

Server-side hardening includes:

- platform-specific extension allowlists;
- upload size limits;
- SHA-256-based stored names;
- signature validation where a reliable format signature exists;
- no browser upload for multi-file CUE/GDI images;
- ZIP upload disabled by default;
- known PS1 BIOS hash recognition;
- ROM files are never executed by the backend;
- metadata URLs are not user-controlled;
- admin brute-force throttling;
- hardened Docker containers and HTTP security headers.

No internet-facing application can honestly be guaranteed "unhackable". Retro Portal uses defense in depth and documents remaining trust boundaries in [SECURITY.md](SECURITY.md).

## Quick start

```bash
sudo apt update
sudo apt install -y git
git clone https://github.com/indie-master/retro-portal.git
cd retro-portal
sudo ./scripts/install.sh
```

See [docs/en/INSTALL.md](docs/en/INSTALL.md) and [docs/en/LIBRARY.md](docs/en/LIBRARY.md).

## Requirements

| Resource | Minimum | Recommended |
|---|---:|---:|
| Ubuntu | 22.04 | 24.04 LTS |
| CPU | 1 vCPU | 2 vCPU |
| RAM | 1 GB | 2 GB |
| Disk | 20 GB | 40+ GB NVMe |
| Network | 100 Mbps | 1 Gbps |
| GPU | not required | not required |

Emulation runs on the player's device, so the server does not need a GPU.

## Upstream components

- EmulatorJS: https://emulatorjs.org/
- Docker Engine: https://docs.docker.com/engine/
- Nginx: https://nginx.org/
- TheGamesDB: https://thegamesdb.net/
- MediaWiki API: https://www.mediawiki.org/wiki/API:Main_page

See [THIRD_PARTY.md](THIRD_PARTY.md) for third-party licensing.

## License

Retro Portal is released under the [MIT License](LICENSE).
