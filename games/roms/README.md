# ROM library

`games/roms/` contains ROM files served by Retro Portal.

The project may bundle or automatically download only ROMs that are explicitly redistributable, such as the MIT-licensed demo games from `monteslu/retro-homebrew-games`. Commercial ROM images are **not** distributed by this repository.

Expected file names for the curated classics preset:

## Mega Drive
- `megadrive/sonic-the-hedgehog-2.bin`
- `megadrive/mortal-kombat-ii.bin`
- `megadrive/streets-of-rage-2.bin`
- `megadrive/comix-zone.bin`
- `megadrive/road-rash-3.bin`
- `megadrive/contra-hard-corps.bin`

## PlayStation
- `ps1/tekken-3.chd`
- `ps1/crash-bandicoot-3-warped.chd`
- `ps1/crash-team-racing.chd`
- `ps1/tony-hawks-pro-skater-2.chd`
- `ps1/resident-evil-2.chd`
- `ps1/worms-armageddon.chd`

## Dreamcast (experimental)
- `dreamcast/crazy-taxi.chd`
- `dreamcast/soulcalibur.chd`
- `dreamcast/sonic-adventure.chd`
- `dreamcast/jet-set-radio.chd`

After adding your ROMs, matching covers and required BIOS files, run:

```bash
./scripts/sync-classics.sh
```

Install the six redistributable demo ROMs with:

```bash
./scripts/install-homebrew-roms.sh
```