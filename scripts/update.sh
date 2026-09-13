#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"; source "$ROOT_DIR/scripts/lib/common.sh"; cd "$ROOT_DIR"; if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then [[ -z "$(git status --porcelain)" ]] || die 'Working tree has local changes. Commit/stash them before automated update.'; git pull --ff-only; fi; docker compose pull --ignore-buildable; docker compose up -d --build; ok 'Portal updated. Run ./scripts/doctor.sh for a full check.'
