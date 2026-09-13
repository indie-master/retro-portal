SHELL := /usr/bin/env bash

.PHONY: up down restart ps logs doctor check install-emulator demos

up:
	docker compose up -d --build

down:
	docker compose down

restart:
	docker compose restart

ps:
	docker compose ps

logs:
	docker compose logs -f --tail=100

doctor:
	./scripts/doctor.sh

install-emulator:
	./scripts/install-emulatorjs.sh 4.2.3

demos:
	./scripts/install-homebrew-roms.sh

check:
	@set -e; \
	for f in scripts/*.sh scripts/lib/*.sh; do bash -n "$$f"; done; \
	python3 -m py_compile scripts/nginx_inspect.py; \
	python3 tests/test_nginx_inspect.py >/dev/null; \
	python3 -m json.tool catalog/games.json >/dev/null; \
	./scripts/catalog-check.py >/dev/null; \
	node --check backend/server.js; \
	for f in public/*.js; do node --check "$$f"; done; \
	echo "All static checks passed."
