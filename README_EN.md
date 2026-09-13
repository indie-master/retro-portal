# Retro Portal

<p align="center"><strong>A cozy self-hosted retro library: the owner curates the collection, players simply press Play.</strong></p>

<p align="center">
  <a href="https://indie-master.github.io/retro-portal/"><strong>🎮 OPEN LIVE DEMO</strong></a>
  &nbsp;·&nbsp; <a href="README.md">Русский</a>
  &nbsp;·&nbsp; <a href="docs/en/INSTALL.md">Install</a>
  &nbsp;·&nbsp; <a href="docs/en/LIBRARY.md">Library Manager</a>
  &nbsp;·&nbsp; <a href="docs/en/NGINX.md">Nginx / TLS</a>
</p>

![Retro Portal home](docs/images/home.png)

### Local ROM player

![Local ROM Player](docs/images/local-rom.png)

## How it works

Retro Portal separates the **player-facing library** from **collection management**.

```text
Player
  ↓
/                     → only games that are ready to play
/game.html?id=...      → browser emulator
/local.html            → user's own local ROM; never uploaded

Server owner
  ↓
/admin.html             → ROMs, BIOS files, scanning and metadata
```

The public page never asks a visitor for a BIOS, ROM path or server setup. A title appears in the library only after its required files and runtime are ready.

Emulation runs on the player's device, so the server does not need a GPU.

## Library Manager

After installation open:

```text
https://your-domain/admin.html
```

If `ADMIN_TOKEN` was not configured in `.env`, the backend creates a random token on first start:

```bash
cat catalog/admin-token
```

The owner can then:

- upload a ROM from the browser;
- copy large collections over SCP/SFTP and scan folders;
- automatically create/update catalog cards;
- see exactly which BIOS file a system requires;
- upload BIOS files from the owner panel;
- use curated local metadata when a known title is detected;
- optionally enrich title/year/description/player count/box art through TheGamesDB.

See **[docs/en/LIBRARY.md](docs/en/LIBRARY.md)**.

## Public library behavior

Only playable games are returned by the public catalog API. Missing ROMs and BIOS diagnostics stay in `/admin.html`.

The separate `/local.html` page remains available for visitors who want to launch their own ROM locally. Their selected file is passed directly to EmulatorJS using a browser object URL and is not uploaded to the server.

## Highlights

- warm CRT-inspired UI with subtle 8-bit details;
- platform shelves and search;
- player-facing catalog contains only ready titles;
- protected owner-only Library Manager;
- automatic ROM registration after upload or folder scan;
- BIOS dependency diagnostics;
- curated presets for selected Mega Drive / PlayStation / Dreamcast titles;
- optional metadata and box-art enrichment;
- local ROM player;
- self-hosted EmulatorJS `4.2.3` in normal installs;
- fullscreen and Browser Gamepad API;
- browser-side saves and save states;
- online/playing presence;
- Docker Compose;
- interactive installation for clean servers and existing Nginx deployments;
- safe support for `stream :443 + ssl_preread`, PROXY protocol and internal TLS vhosts;
- wildcard/SAN certificate reuse, Let's Encrypt HTTP-01 and Cloudflare DNS-01;
- mandatory `nginx -t` before reload;
- GitHub Pages playable demo.

## Live Demo

**https://indie-master.github.io/retro-portal/**

The GitHub Pages build displays only demo/homebrew games that are actually playable. Commercial ROMs, BIOS files and official artwork are not included in the public repository or demo.

## Requirements

| Resource | Minimum | Recommended |
|---|---:|---:|
| Ubuntu | 22.04 | 24.04 LTS |
| CPU | 1 vCPU | 2 vCPU |
| RAM | 1 GB | 2 GB |
| Disk | 20 GB | 40+ GB NVMe |
| Network | 100 Mbps | 1 Gbps |
| GPU | not required | not required |

## Quick start

```bash
sudo apt update
sudo apt install -y git
git clone https://github.com/indie-master/retro-portal.git
cd retro-portal
sudo ./scripts/install.sh
```

The installer offers four modes:

```text
1) Full automatic setup
2) Existing Nginx integration
3) Manual integration — app + generated snippets
4) Local test without a domain or TLS
```

See [docs/en/INSTALL.md](docs/en/INSTALL.md).

## Curated presets

Metadata presets are included for:

**Mega Drive:** Sonic the Hedgehog 2, Mortal Kombat II, Streets of Rage 2, Comix Zone, Road Rash III, Contra: Hard Corps.

**PlayStation:** Tekken 3, Crash Bandicoot 3: Warped, Crash Team Racing, Tony Hawk's Pro Skater 2, Resident Evil 2, Worms Armageddon.

**Dreamcast — experimental:** Crazy Taxi, Soulcalibur, Sonic Adventure, Jet Set Radio.

These are metadata presets, not ROMs. When the owner supplies a matching image, the Library Manager can use the prepared metadata.

## Optional automatic artwork

Set a TheGamesDB API key on the backend:

```ini
THEGAMESDB_API_KEY=your-api-key
```

The key is server-side only. Without an external provider, unknown games still receive a generated fallback card based on the ROM filename.

## Nginx / TLS

The installer inspects `nginx -T` before changing a live configuration, supports conventional HTTPS vhosts and `stream :443 + ssl_preread`, and always runs `nginx -t` before reload. See [docs/en/NGINX.md](docs/en/NGINX.md).

## Dreamcast

Catalog and multi-file BIOS checks are ready, but Flycast WASM remains intentionally marked experimental. See [docs/en/DREAMCAST.md](docs/en/DREAMCAST.md).

## Legal

Retro Portal is software only. The repository does not distribute commercial ROMs, BIOS files or official artwork. The server owner is responsible for the content they add.

## License

Retro Portal code is MIT licensed. Third-party components retain their own licenses; see [THIRD_PARTY.md](THIRD_PARTY.md).
