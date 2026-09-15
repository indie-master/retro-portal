# Library management

Players and owners use separate interfaces: `/` is the public library, `/game.html` is the player, `/local.html` runs a local ROM without uploading it, and `/admin.html` is the Library Manager.

## First login

If `ADMIN_TOKEN` is not set, the backend creates a persistent random token:

```bash
cat catalog/admin-token
```

Open `/admin.html` and paste it. The browser keeps it only in the current tab's `sessionStorage`.

## Adding a game

1. Open `/admin.html`.
2. Select a ROM and choose the platform when the format is ambiguous.
3. Press **Upload ROM**.

The backend checks extension, upload size and known signatures. The final stored filename is derived from a normalized title and SHA-256. ZIP upload is disabled by default (`ALLOW_ZIP_ROMS=0`).

For large collections, copy files to `games/roms/<system>/` over SCP/SFTP and press **Scan**.

## Publishing

A title becomes public only when the ROM, required BIOS and platform runtime are ready. Missing dependency diagnostics remain owner-only.

## BIOS

Library Manager recognizes several common PlayStation BIOS files by MD5 and stores them using canonical names, including `scph5500.bin`, `scph5501.bin`, `scph5502.bin`, `PSXONPSP660.bin`, `scph101.bin`, `scph7001.bin` and `scph1001.bin`.

The experimental Dreamcast profile expects:

```text
games/bios/dreamcast/dc_boot.bin
games/bios/dreamcast/dc_flash.bin
```

Dreamcast remains experimental until browser-runtime integration is finalized.

## Automatic covers and descriptions

Starting with 0.10 an isolated `metadata` container automatically enriches imported titles. It exposes no public listener and talks to the backend only on the internal Docker network.

Matching uses **both game title and console/platform**:

1. ROM names are normalized to remove region/revision/translation noise and generated hash suffixes;
2. with `THEGAMESDB_API_KEY`, the worker resolves the target platform and searches TheGamesDB with a platform filter;
3. title similarity must pass a confidence threshold before metadata is accepted;
4. Wikipedia is used as a platform-qualified description/history fallback;
5. cover lookup prefers TheGamesDB box art, then the matching system repository in Libretro thumbnails, then an allowed Wikipedia image;
6. every downloaded image is still sent through the protected cover-upload path with the 8 MB limit and JPG/PNG/WebP signature validation;
7. owner-edited fields are preserved by default.

Configuration:

```ini
THEGAMESDB_API_KEY=
WIKIPEDIA_METADATA=1
AUTO_METADATA=1
AUTO_METADATA_OVERWRITE=0
AUTO_METADATA_INTERVAL=600
AUTO_METADATA_BATCH=8
```

TheGamesDB is optional; Wikipedia + Libretro remain available without its API key. Set `AUTO_METADATA_OVERWRITE=1` only when you intentionally want the worker to replace already populated owner fields.

Failed/no-match items use backoff instead of hammering external providers on every cycle.

## Manual fallback

**Find description** and manual JPG/PNG/WebP cover upload remain available in Library Manager. Owners can also edit title, year, player count, description, history, sort order, featured state and publication manually.

## Mobile play

The player includes a touch-first fullscreen mode with safe-area handling and best-effort landscape orientation lock. See [MOBILE.md](MOBILE.md).

## Keyboard and gamepads

Desktop players can store bindings per game or per platform. Touch devices use EmulatorJS's virtual gamepad, and USB/Bluetooth gamepads may be connected before or during play.

## Activity

`/api/activity` is based on active WebSocket sessions and launch events: current online count, currently played titles and 7-day popularity. Multiple tabs from one browser are deduplicated using a session ID.

## Security

- ROM/BIOS/cover uploads are admin-only;
- the local-ROM player does not upload the visitor's ROM;
- ZIP upload is disabled by default;
- the backend does not execute ROMs as OS programs;
- backend and metadata worker run non-root, read-only, capability-free and with `no-new-privileges`;
- the metadata worker exposes no public port;
- external image hosts are allowlisted, downloads are size-limited, and image signatures are revalidated by the backend;
- manual owner edits are preserved by default;
- admin/public API rate limits remain enabled.

See [../../SECURITY.md](../../SECURITY.md).

## Diagnostics

```bash
curl -s http://127.0.0.1:8088/api/games | jq
curl -s http://127.0.0.1:8088/api/activity | jq
docker compose logs --tail=100 metadata
```

Owner catalog:

```bash
TOKEN="$(cat catalog/admin-token)"
curl -s -H "Authorization: Bearer $TOKEN" \
  http://127.0.0.1:8088/api/admin/games | jq
```

## Legal

Retro Portal does not ship commercial ROMs, proprietary BIOS files or official commercial artwork. If the owner enables external metadata/artwork enrichment or adds their own content, they are responsible for having the appropriate rights to use it.
