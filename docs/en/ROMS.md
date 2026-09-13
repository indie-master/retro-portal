# Games, BIOS, covers and screenshots

Retro Portal keeps project code separate from user-supplied game content. Commercial ROMs, BIOS files and official artwork are not stored in Git.

Recommended layout:

```text
games/roms/megadrive/
games/roms/ps1/
games/roms/dreamcast/
games/bios/ps1/
games/bios/dreamcast/
public/covers/library/
public/screenshots/library/
```

The catalog supports nested paths. A game can have a real box-art `cover` and an optional `screenshots` array.

`catalog/presets/curated-classics.json` contains metadata and expected names for a curated starter collection. Add your own legally obtained files, then run:

```bash
./scripts/sync-classics.sh
```

By default, only entries with an actual ROM, cover and all required BIOS files are imported. `./scripts/sync-classics.sh all` is available for UI previews.

Six MIT-licensed Mega Drive homebrew ROMs can be installed with:

```bash
./scripts/install-homebrew-roms.sh
```

Validate manual catalog edits with `./scripts/catalog-check.py`.