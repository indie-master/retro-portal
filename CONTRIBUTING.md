# Contributing

Thanks for improving the project.

## Development workflow

1. Fork/clone the repository.
2. Create a feature branch.
3. Keep changes focused and documented.
4. Run `make check`.
5. Test at least the local Docker deployment when changing runtime code.

## Shell scripts

- Use `set -euo pipefail`.
- Avoid destructive edits of user configuration.
- Nginx changes must be testable with `nginx -t` and safely reversible.
- Never log secrets or write credentials into generated Git-tracked files.

## Legal content

Do not submit copyrighted commercial ROMs, BIOS images or official artwork unless licensing clearly permits redistribution.
