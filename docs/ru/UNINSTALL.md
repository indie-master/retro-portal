# Безопасное удаление и перенос Retro Portal

[← README](../../README.md) · [Установка](INSTALL.md) · [Масштабирование](SCALING.md) · [Обновление](UPDATE.md) · [Nginx/TLS](NGINX.md) · [Диагностика](TROUBLESHOOTING.md)

Retro Portal рассчитан на установку рядом с другими сервисами. Поэтому удаление специально сделано **консервативным**: скрипт удаляет только то, что может однозначно определить как принадлежащее Retro Portal, и не выполняет глобальную очистку Docker/Nginx.

## Главное правило

Не удаляйте каталоги и Nginx-конфиги вручную до запуска штатного скрипта. Для control/single-node сначала выполните dry-run:

```bash
cd /path/to/retro-portal
sudo ./scripts/uninstall.sh --domain arcade.example.com --dry-run
```

## Обычное безопасное удаление control/single-node

```bash
sudo ./scripts/uninstall.sh --domain arcade.example.com
```

По умолчанию скрипт:

1. ищет **только** файл вида `retro-portal-<domain>.conf`, содержащий маркер `Managed by Retro Portal installer`;
2. делает rollback-копию Nginx-конфига;
3. отключает этот vhost;
4. выполняет `nginx -t`;
5. reload'ит Nginx только после успешной проверки;
6. при любой ошибке автоматически возвращает vhost обратно;
7. после успешного отключения Nginx останавливает только контейнеры текущего Retro Portal Compose-проекта;
8. сохраняет ROM, BIOS, обложки, каталог, `.env` и EmulatorJS runtime.

После этого портал не занимает RAM/CPU контейнерами, но библиотека остаётся на диске.

## Безопасное удаление edge-ноды

Edge имеет отдельный scoped helper и не использует control uninstaller:

```bash
./scripts/uninstall-edge.sh --dry-run
./scripts/uninstall-edge.sh
```

Он:

- работает только с `docker-compose.edge.yml` текущего checkout;
- не трогает host Nginx;
- не трогает control/origin;
- не трогает другие Docker projects/networks/containers;
- не выполняет global prune;
- по умолчанию сохраняет локальную реплику ROM/BIOS/artwork/runtime.

После того как edge удалён из LB/CDN и активные соединения drained, можно полностью убрать локальную реплику данных:

```bash
./scripts/uninstall-edge.sh --purge-replica-data
```

Перед этим убедитесь, что control/origin или другой backup действительно содержит актуальную библиотеку.

## Перенос control/single-node на другой сервер

```bash
sudo ./scripts/uninstall.sh \
  --domain arcade.example.com \
  --move \
  --backup-dir /root/retro-portal-backups
```

`--move` включает:

- обязательный backup до любых удалений данных;
- проверку tar-архива;
- SHA-256 checksum;
- удаление локальных ROM/BIOS/обложек/mutable catalog/.env **только после успешного backup**;
- удаление скачанного EmulatorJS runtime;
- удаление только локально собранного backend image, если он больше не используется никаким контейнером.

Архив:

```text
/root/retro-portal-backups/retro-portal-YYYYMMDD-HHMMSS.tar.gz
/root/retro-portal-backups/retro-portal-YYYYMMDD-HHMMSS.tar.gz.sha256
```

Проверка:

```bash
cd /root/retro-portal-backups
sha256sum -c retro-portal-*.tar.gz.sha256
```

> Backup может содержать `.env` и `catalog/admin-token`. Относитесь к нему как к секретному файлу.

## Восстановление на новой машине

```bash
git clone https://github.com/indie-master/retro-portal.git
cd retro-portal
sudo tar -xzf /path/retro-portal-YYYYMMDD-HHMMSS.tar.gz -C .
./scripts/install-emulatorjs.sh 4.2.3
sudo ./scripts/install.sh --mode existing --domain arcade.example.com
```

Или Compose-only:

```bash
docker compose build --pull
docker compose up -d
```

После восстановления проверьте владельца файлов:

```bash
ls -la catalog games/roms games/bios public/covers/library
```

## Освобождение места без переноса

```bash
sudo ./scripts/uninstall.sh \
  --domain arcade.example.com \
  --purge-data \
  --remove-runtime \
  --remove-images
```

`--purge-data` всегда сначала создаёт и проверяет backup.

## Что скрипты принципиально НЕ удаляют

Control uninstaller и edge helper не выполняют:

- удаление чужих Docker-контейнеров/Compose-проектов;
- Docker volume/network/image prune;
- удаление Docker Engine;
- удаление Nginx/Certbot;
- удаление TLS-сертификатов;
- глобальное удаление пакетов;
- автоматическое редактирование произвольных shared `stream` / `ssl_preread` map;
- удаление git checkout целиком.

## Сложный существующий Nginx

Если портал подключался в существующий `server {}` или `stream {}` вручную, control uninstaller не редактирует такой файл автоматически. После удаления он показывает оставшиеся упоминания домена.

Проверка:

```bash
sudo nginx -T | grep -n 'arcade.example.com'
sudo nginx -t
sudo systemctl reload nginx
```

Это намеренно: shared SNI/stream map может обслуживать несколько сервисов.

## Rollback Nginx

Перед отключением installer-managed vhost создаётся резервная копия:

```text
/var/backups/retro-portal/uninstall-YYYYMMDD-HHMMSS/
```

Если `nginx -t` или reload завершается ошибкой, предыдущий vhost автоматически восстанавливается, а удаление прекращается до остановки контейнеров и очистки данных.

## Репозиторий после удаления

Git checkout намеренно не удаляется автоматически. Это дополнительная защита от ошибки пути в `rm -rf`.

## Быстрая памятка

```bash
# control/single-node: только план
sudo ./scripts/uninstall.sh --domain arcade.example.com --dry-run

# control/single-node: отключить, сохранив библиотеку
sudo ./scripts/uninstall.sh --domain arcade.example.com

# control/single-node: перенос
sudo ./scripts/uninstall.sh --domain arcade.example.com --move --backup-dir /root/retro-portal-backups

# edge: только план
./scripts/uninstall-edge.sh --dry-run

# edge: убрать контейнеры, сохранить replica data
./scripts/uninstall-edge.sh

# edge: убрать и replica data
./scripts/uninstall-edge.sh --purge-replica-data
```
