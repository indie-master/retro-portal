# Library management

Retro Portal 0.7 separates the player-facing library from owner-only content management.

- `/` — public portal; only fully playable games are shown.
- `/local.html` — local ROM player; the selected file stays in the user's browser.
- `/admin.html` — owner-only Library Manager for ROMs, BIOS files, scanning and metadata.

Visitors should never have to understand missing ROMs, BIOS paths or server layout.

## First login

If `ADMIN_TOKEN` is not set in `.env`, the backend creates a random token on first start.

```bash
cat catalog/admin-token
```

Open:

```text
https://your-domain/admin.html
```

and paste the token. The browser keeps it only in the current tab's `sessionStorage`.

You may set your own token in `.env`:

```ini
ADMIN_TOKEN=a-long-random-secret
```

## Uploading a ROM

1. Open `/admin.html`.
2. Select a ROM.
3. Unambiguous formats such as `.nes`, `.gba` or `.md` can be detected automatically.
4. Ambiguous formats such as `.bin`, `.cue`, `.chd` and `.iso` require a platform selection.
5. Click **Upload ROM**.

The backend stores the file in the platform directory, creates or updates its catalog card, checks BIOS requirements and exposes the game publicly only after it is actually playable.

If the filename matches a game in `catalog/presets/curated-classics.json`, the local preset metadata is applied automatically. Unknown games still receive a generated title/card from the filename.

## Scanning a large collection

Large PS1 and Dreamcast images are often more convenient to copy through SCP/SFTP:

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

Then press **Scan** in `/admin.html`. New files are registered recursively without editing JSON by hand.

## BIOS workflow

The Library Manager checks required BIOS files and shows the owner the exact missing path. The public site does not show those diagnostics.

For PlayStation, several common BIOS files can be recognized by MD5 and stored under their canonical names, including:

```text
scph5500.bin
scph5501.bin
scph5502.bin
PSXONPSP660.bin
scph101.bin
scph7001.bin
scph1001.bin
```

The current Dreamcast profile expects:

```text
games/bios/dreamcast/dc_boot.bin
games/bios/dreamcast/dc_flash.bin
```

Dreamcast remains experimental until the browser Flycast runtime is finalized.

## Optional metadata and box art

Without an external provider Retro Portal can already:

1. match curated local presets;
2. build a fallback card from the ROM filename;
3. publish the game after all runtime dependencies are ready.

For automatic title/year/description/player-count/box-art enrichment, configure TheGamesDB:

```ini
THEGAMESDB_API_KEY=your-api-key
```

Restart the stack:

```bash
docker compose up -d
```

The API key stays on the backend and is never exposed to portal visitors.

## Upload size

Browser uploads default to 2 GiB:

```ini
MAX_UPLOAD_BYTES=2147483648
```

For very large Dreamcast images, SCP/SFTP plus folder scanning is recommended.

## File permissions

The backend needs write access to:

```text
catalog/
games/roms/
games/bios/
public/covers/library/
```

Docker Compose runs the backend using `PUID/PGID` from `.env` (default `1000:1000`). Set these values to the owner of the project files when necessary.

## Diagnostics

Public playable catalog:

```bash
curl -s http://127.0.0.1:8088/api/games | jq
```

Owner catalog:

```bash
TOKEN="$(cat catalog/admin-token)"
curl -s -H "Authorization: Bearer $TOKEN" \
  http://127.0.0.1:8088/api/admin/games | jq
```

Manual scan:

```bash
curl -s -X POST \
  -H "Authorization: Bearer $TOKEN" \
  http://127.0.0.1:8088/api/admin/scan | jq
```

## Legal

Retro Portal does not distribute commercial ROMs, BIOS files or copyrighted game artwork. The server owner is responsible for the content they add.
