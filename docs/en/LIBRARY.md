# Library management

Retro Portal 0.8 separates the player-facing portal from owner-only collection management.

- `/` — public portal; only fully playable titles are visible.
- `/game.html?id=...` — emulator, game description/history and keyboard configuration.
- `/local.html` — visitor's local ROM; the selected file stays in the browser.
- `/admin.html` — owner cabinet for ROMs, BIOS files, cards, metadata review and publishing.

Visitors never need to understand missing ROMs, BIOS paths or server layout.

## First login

If `ADMIN_TOKEN` is not set in `.env`, the backend creates a persistent random token on first start:

```bash
cat catalog/admin-token
```

Open `https://your-domain/admin.html` and paste the token. It is kept only in the current tab's `sessionStorage`.

After initial authentication, routine collection management is handled from the browser cabinet.

## Uploading ROMs

1. Open `/admin.html`.
2. Select a ROM.
3. Unambiguous formats can be auto-detected.
4. Pick the platform manually for ambiguous formats such as `.bin`, `.chd` or `.iso`.
5. Press **Upload ROM**.

The backend applies platform-specific extension allowlists, upload limits and file-signature checks where reliable. Stored filenames are generated from a normalized title plus a SHA-256 prefix rather than trusting the original path.

ZIP browser upload is disabled by default:

```ini
ALLOW_ZIP_ROMS=0
```

Multi-file CUE/GDI sets should be copied through SCP/SFTP and then discovered with **Scan**.

## Scanning a large collection

```text
games/roms/megadrive/
games/roms/ps1/
games/roms/dreamcast/
games/roms/nes/
games/roms/snes/
games/roms/gb/
games/roms/gba/
games/roms/n64/
games/roms/arcade/
```

Press **Scan** in `/admin.html`; new files are registered without editing JSON manually.

## Publishing flow

```text
ROM present?
    ↓
BIOS required?
    ↓
BIOS present?
    ↓
Runtime ready?
    ↓
READY → visible to public players
```

Dependency diagnostics stay in the owner cabinet.

## BIOS

The Library Manager can recognize several common PlayStation BIOS files by MD5 and store them under canonical names, including `scph5500.bin`, `scph5501.bin`, `scph5502.bin`, `PSXONPSP660.bin`, `scph101.bin`, `scph7001.bin` and `scph1001.bin`.

The experimental Dreamcast profile currently expects:

```text
games/bios/dreamcast/dc_boot.bin
games/bios/dreamcast/dc_flash.bin
```

Dreamcast remains experimental until the browser Flycast runtime is finalized.

## Automatic descriptions, history and box art

Retro Portal 0.8 uses a review-first workflow: **find → propose → approve**.

After ROM import the portal can:

1. match a local curated preset;
2. query TheGamesDB for title/year/player count/overview/box art when an API key is configured;
3. query fixed Wikipedia API hosts for a short historical context paragraph;
4. sanitize and length-limit external text;
5. store the result as `pendingMetadata`;
6. show it to the owner in `/admin.html`;
7. publish it only after **Approve**.

```ini
THEGAMESDB_API_KEY=your-api-key
WIKIPEDIA_METADATA=1
```

Provider failure never removes an imported ROM. Metadata can be requested again later.

## Editing cards

Each game has an **Edit card** section in Library Manager. The owner can change title, year, player count, short description, historical note, sort order, featured status and public visibility from the browser.

## Keyboard controls

Every player page has a **Keyboard** button. A binding profile may be stored for one game or the entire platform. Profiles stay in browser `localStorage` and are applied through EmulatorJS `EJS_defaultControls`.

## Real online activity

The online counter is not fabricated. WebSocket presence counts active browser sessions and deduplicates tabs that share the same local presence ID.

`/api/activity` reports current game activity and a 7-day popularity list based on real launch events. If there is no activity, the UI shows an honest empty state.

## Security

- server-side ROM/BIOS upload is admin-only;
- the public local-ROM player never uploads the chosen ROM;
- ZIP browser upload is disabled by default;
- the backend never executes ROM files as OS programs;
- metadata download URLs are not visitor-controlled;
- external text requires owner approval;
- the backend container runs non-root with a read-only root filesystem, no Linux capabilities and `no-new-privileges`;
- API rate limits and browser security headers are enabled in bundled Nginx.

See [../../SECURITY.md](../../SECURITY.md) for the full threat model.

## Diagnostics

Public catalog:

```bash
curl -s http://127.0.0.1:8088/api/games | jq
```

Real activity:

```bash
curl -s http://127.0.0.1:8088/api/activity | jq
```

Owner catalog:

```bash
TOKEN="$(cat catalog/admin-token)"
curl -s -H "Authorization: Bearer $TOKEN" \
  http://127.0.0.1:8088/api/admin/games | jq
```

## Legal

Retro Portal does not distribute commercial ROMs, proprietary BIOS files or official commercial artwork. The server owner is responsible for the content they add.
