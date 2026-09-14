# Обновление Retro Portal

[← README](../../README.md) · [Установка](INSTALL.md) · [Масштабирование](SCALING.md) · [Удаление/перенос](UNINSTALL.md)

Retro Portal можно обновлять из Git-репозитория или пересоздавать контейнеры из уже обновлённого checkout. Для single-node/control и edge используются одни и те же безопасные правила: чистый working tree, `ff-only`, health check и автоматическая попытка rollback при неудачном запуске новой версии.

## Single-node / control-origin

```bash
cd /opt/retro-portal
./scripts/update.sh --mode standalone
```

Скрипт:

1. проверяет, что в Git checkout нет локальных изменений;
2. запоминает текущий commit;
3. выполняет `git fetch --prune` и `git pull --ff-only`;
4. подтягивает/пересобирает контейнеры;
5. запускает новую версию;
6. проверяет локальный `/healthz`;
7. если новая версия не становится healthy — возвращает предыдущий commit и пересобирает контейнеры старой версии.

После успешного обновления рекомендуется:

```bash
./scripts/doctor.sh --domain arcade.example.com
```

## Edge-нода

```bash
cd /opt/retro-portal
./scripts/update.sh --mode edge
```

Updater использует `.env.edge` и `docker-compose.edge.yml`, затем проверяет локальный edge `/healthz`.

## Обновление всего edge-пула

С control-ноды:

```bash
./scripts/cluster-update.sh --dry-run
./scripts/cluster-update.sh
```

Inventory берётся из `cluster/nodes.conf`. На каждой выбранной ноде выполняется её локальный `scripts/update.sh --mode edge`, поэтому каждая нода сама выполняет health check и rollback.

Для безопасного production-обновления лучше обновлять поэтапно:

```text
control/origin → проверка → одна canary edge → проверка → остальные edge
```

## Если код уже обновлён вручную

Например вы обновили checkout через систему конфигурационного управления или сами выполнили `git pull`:

```bash
./scripts/update.sh --mode standalone --no-git
```

или:

```bash
./scripts/update.sh --mode edge --no-git
```

Скрипт не трогает Git и только rebuild/recreate текущей версии Compose.

## Чистый Docker Compose без update.sh

Single-node:

```bash
git pull --ff-only
docker compose pull --ignore-buildable
docker compose build --pull
docker compose up -d --remove-orphans
curl -fsS http://127.0.0.1:8088/healthz
```

Edge:

```bash
git pull --ff-only
docker compose --env-file .env.edge -f docker-compose.edge.yml pull --ignore-buildable
docker compose --env-file .env.edge -f docker-compose.edge.yml build --pull
docker compose --env-file .env.edge -f docker-compose.edge.yml up -d --remove-orphans
curl -fsS http://127.0.0.1:8088/healthz
```

Ручной путь проще, но не выполняет автоматический Git rollback. Для обычной эксплуатации рекомендуется `scripts/update.sh`.

## Library payload и обновление кода — разные операции

Обновление кода не копирует ROM/BIOS/artwork между нодами. Если изменилась библиотека или EmulatorJS runtime, после проверки control-ноды выполните:

```bash
./scripts/cluster-sync.sh --dry-run
./scripts/cluster-sync.sh
```

Это позволяет отдельно управлять версией приложения и содержимым библиотеки.

## Перед крупным обновлением

Если изменение затрагивает библиотеку или вы хотите иметь переносимый snapshot:

```bash
./scripts/backup.sh /root/retro-portal-backups
```

Храните backup как секретный файл: он может содержать `.env` и `catalog/admin-token`.
