# Retro Portal

<p align="center"><strong>A cozy self-hosted retro game library that runs directly in the browser.</strong></p>

<p align="center">
  <a href="https://indie-master.github.io/retro-portal/"><strong>🎮 OPEN LIVE DEMO</strong></a>
  &nbsp;·&nbsp; <a href="README.md">Русский</a>
  &nbsp;·&nbsp; <a href="docs/en/INSTALL.md">Install</a>
  &nbsp;·&nbsp; <a href="docs/en/ROMS.md">Games & artwork</a>
  &nbsp;·&nbsp; <a href="docs/en/NGINX.md">Nginx / TLS</a>
</p>

![Retro Portal home](docs/images/home.png)

### Local ROM player

![Local ROM Player](docs/images/local-rom.png)

## What it is

Retro Portal turns an Ubuntu VPS, mini PC or home server into a personal browser-based retro library. The home page is organized into Mega Drive, PlayStation, Dreamcast and a dedicated **Demo / Homebrew** shelf. If a ROM is present, press **Play**. If it is missing, the card shows the exact expected path instead of a dead button.

Emulation runs on the player's device, so the server does not need a GPU. The server hosts the site, catalog, ROM/BIOS files, artwork and EmulatorJS and provides the catalog API and online presence.

## Highlights

- warm CRT-inspired UI with subtle 8-bit details;
- platform shelves for **Mega Drive / PlayStation / Dreamcast / Demo**;
- 16 preconfigured classic game cards plus six redistributable demo ROMs;
- user-supplied box art and optional gameplay screenshots;
- clear **Play / Add ROM / BIOS required / Experimental** states;
- local ROM player that never uploads the selected ROM to the server;
- self-hosted EmulatorJS `4.2.3` in normal installations;
- fullscreen and Browser Gamepad API support;
- browser-side saves and save states;
- online/playing presence;
- Docker Compose;
- interactive installer for clean servers and existing Nginx deployments;
- safe handling of `stream :443 + ssl_preread`, PROXY protocol and internal TLS vhosts;
- wildcard/SAN certificate reuse, Let's Encrypt HTTP-01 and Cloudflare DNS-01;
- backup and mandatory `nginx -t` before reload;
- GitHub Pages demo using the same UI as production.

## Live Demo

**https://indie-master.github.io/retro-portal/**

The public demo shows the complete library layout. Commercial titles are catalog cards ready for your own legally obtained ROMs, while the Demo shelf contains six MIT-licensed Mega Drive homebrew games that can be launched immediately.

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

## Quick local test

```bash
./scripts/install-emulatorjs.sh 4.2.3
./scripts/install-homebrew-roms.sh
docker compose up -d --build
```

## Curated classics

**Mega Drive:** Sonic the Hedgehog 2, Mortal Kombat II, Streets of Rage 2, Comix Zone, Road Rash III, Contra: Hard Corps.

**PlayStation:** Tekken 3, Crash Bandicoot 3: Warped, Crash Team Racing, Tony Hawk's Pro Skater 2, Resident Evil 2, Worms Armageddon.

**Dreamcast — experimental:** Crazy Taxi, Soulcalibur, Sonic Adventure, Jet Set Radio.

Commercial ROMs, BIOS files and official artwork are **not distributed by this repository**. Expected file names and paths are already present in the catalog. Add your own content and the backend will detect it automatically. See [docs/en/ROMS.md](docs/en/ROMS.md).

## Demo / Homebrew

Six MIT-licensed Mega Drive ROMs are available for functional testing: Tank Battle, Battle 4Tris, Pong, Snake Arena, Space Shooter and Breakout. They are intentionally kept in a separate demo shelf instead of being presented as the main library.

## Nginx / TLS

The installer inspects `nginx -T` before making changes, understands normal HTTP vhosts as well as `stream :443 + ssl_preread`, and runs `nginx -t` before every reload. If automatic editing is unsafe, it generates a snippet instead of modifying the live configuration. See [docs/en/NGINX.md](docs/en/NGINX.md).

## Dreamcast

Catalog metadata, multi-file BIOS checks and UI are ready, but Flycast WASM remains intentionally marked as experimental. See [docs/en/DREAMCAST.md](docs/en/DREAMCAST.md).

## Legal

Retro Portal is software only. The repository does not distribute commercial ROMs, BIOS files or official artwork. You are responsible for the content you add.

## License

Retro Portal code is MIT licensed. Third-party components retain their own licenses; see [THIRD_PARTY.md](THIRD_PARTY.md).
