SHELL := /usr/bin/env bash

.PHONY: up down restart ps logs doctor check install-emulator demos update edge-up edge-down edge-ps edge-logs edge-update sync-edges update-edges uninstall-edge

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

update:
	./scripts/update.sh --mode standalone

edge-up:
	docker compose --env-file .env.edge -f docker-compose.edge.yml up -d --build

edge-down:
	docker compose --env-file .env.edge -f docker-compose.edge.yml down

edge-ps:
	docker compose --env-file .env.edge -f docker-compose.edge.yml ps

edge-logs:
	docker compose --env-file .env.edge -f docker-compose.edge.yml logs -f --tail=100

edge-update:
	./scripts/update.sh --mode edge

sync-edges:
	./scripts/cluster-sync.sh

update-edges:
	./scripts/cluster-update.sh

uninstall-edge:
	./scripts/uninstall-edge.sh

install-emulator:
	./scripts/install-emulatorjs.sh 4.2.3

demos:
	./scripts/install-homebrew-roms.sh

check:
	@set -e; \
	for f in scripts/*.sh scripts/lib/*.sh; do bash -n "$$f"; done; \
	sh -n edge/entrypoint.sh; \
	python3 -m py_compile scripts/nginx_inspect.py; \
	python3 tests/test_nginx_inspect.py >/dev/null; \
	python3 -m json.tool catalog/games.json >/dev/null; \
	./scripts/catalog-check.py >/dev/null; \
	node --check backend/server.js; \
	for f in public/*.js; do node --check "$$f"; done; \
	docker compose config >/dev/null; \
	CONTROL_ORIGIN_HOST=example.com docker compose --env-file .env.edge.example -f docker-compose.edge.yml config >/dev/null; \
	echo "All static checks passed."
