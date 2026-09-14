# Безопасное удаление и перенос Retro Portal

[← README](../../README.md) · [Установка](INSTALL.md) · [Nginx/TLS](NGINX.md) · [Диагностика](TROUBLESHOOTING.md)

Retro Portal рассчитан на установку рядом с другими сервисами. Поэтому удаление специально сделано **консервативным**: скрипт удаляет только то, что может однозначно определить как принадлежащее Retro Portal, и не выполняет глобальную очистку Docker/Nginx.

## Главное правило

Не удаляйте каталоги и Nginx-конфиги вручную до запуска `scripts/uninstall.sh`. Сначала выполните dry-run, затем штатное удаление.

```bash
cd /path/to/retro-portal
sudo ./scripts/uninstall.sh --domain arcade.example.com --dry-run
```

Dry-run ничего не меняет и показывает:

- какой Nginx-vhost будет отключён;
- какие контейнеры относятся к текущему Compose-проекту;
- будет ли создан backup;
- какие данные будут сохранены или удалены.

## Обычное безопасное удаление

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

После этого портал не занимает RAM/CPU контейнерами, но библиотека остаётся на диске и может быть поднята снова.

## Перенос на другой сервер

Рекомендуемый вариант:

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

Архив имеет вид:

```text
/root/retro-portal-backups/retro-portal-YYYYMMDD-HHMMSS.tar.gz
/root/retro-portal-backups/retro-portal-YYYYMMDD-HHMMSS.tar.gz.sha256
```

Проверьте checksum перед переносом:

```bash
cd /root/retro-portal-backups
sha256sum -c retro-portal-*.tar.gz.sha256
```

> Backup может содержать `.env` и `catalog/admin-token`. Относитесь к нему как к секретному файлу и не публикуйте его.

## Восстановление на новой машине

```bash
git clone https://github.com/indie-master/retro-portal.git
cd retro-portal
sudo tar -xzf /path/retro-portal-YYYYMMDD-HHMMSS.tar.gz -C .
./scripts/install-emulatorjs.sh 4.2.3
```

Далее выберите нужный сценарий установки:

```bash
sudo ./scripts/install.sh --mode existing --domain arcade.example.com
```

или только Compose:

```bash
docker compose build --pull
docker compose up -d
```

После восстановления проверьте владельца файлов и доступ контейнера к bind mounts:

```bash
ls -la catalog games/roms games/bios public/covers/library
```

## Освобождение места без переноса

Удалить библиотеку и runtime можно так:

```bash
sudo ./scripts/uninstall.sh \
  --domain arcade.example.com \
  --purge-data \
  --remove-runtime \
  --remove-images
```

`--purge-data` всегда сначала создаёт и проверяет backup. Без успешного backup удаление данных не начинается.

## Что скрипт принципиально НЕ удаляет

Даже в режиме `--move` скрипт не трогает:

- другие Docker-контейнеры;
- чужие Compose-проекты;
- Docker volumes других приложений;
- Docker networks других приложений;
- Docker Engine;
- Nginx;
- Certbot;
- TLS-сертификаты;
- Certbot renewal configuration;
- общий `nginx:alpine` image;
- произвольные Nginx-конфиги;
- существующие `stream` / `ssl_preread` map-блоки;
- директорию самого git-репозитория.

Скрипт **никогда** не выполняет `docker system prune`, `docker volume prune`, `docker network prune` или глобальное удаление пакетов.

Это сделано специально, чтобы удаление Retro Portal на сервере с другими сервисами не могло случайно снести соседние приложения.

## Сложный существующий Nginx

Если портал подключался в существующий `server {}` или `stream {}` вручную, uninstaller не редактирует такой файл автоматически.

После штатного удаления он ищет оставшиеся упоминания домена в `/etc/nginx/*.conf` и показывает предупреждение. Например, может остаться ваша ручная строка SNI map:

```nginx
arcade.example.com  127.0.0.1:8443;
```

Её нужно удалить вручную только после проверки конкретного файла:

```bash
sudo nginx -T | grep -n 'arcade.example.com'
sudo nginx -t
sudo systemctl reload nginx
```

Это единственный намеренно неавтоматизированный участок: произвольный `stream`-map часто обслуживает несколько сервисов, поэтому безопаснее не переписывать его автоматически.

## Rollback Nginx

Перед отключением installer-managed vhost создаётся резервная копия:

```text
/var/backups/retro-portal/uninstall-YYYYMMDD-HHMMSS/
```

Если `nginx -t` или reload завершается ошибкой, uninstaller автоматически восстанавливает предыдущий vhost и прекращает удаление до остановки контейнеров и очистки данных.

## Репозиторий после удаления

Каталог git-репозитория намеренно не удаляется автоматически. Это дополнительная защита от ошибки пути в `rm -rf`.

После `--move` или `--purge-data --remove-runtime` там остаются в основном код и документация, занимающие сравнительно мало места. Если вы уверены, что backup скопирован на другой носитель и больше ничего из каталога не нужно, сам git checkout можно удалить отдельно уже после проверки переноса.

## Быстрая памятка

```bash
# Только посмотреть план
sudo ./scripts/uninstall.sh --domain arcade.example.com --dry-run

# Отключить портал, но сохранить библиотеку
sudo ./scripts/uninstall.sh --domain arcade.example.com

# Перенос на другую машину
sudo ./scripts/uninstall.sh --domain arcade.example.com --move --backup-dir /root/retro-portal-backups

# Полностью освободить почти всё занятое порталoм дисковое место, сохранив backup
sudo ./scripts/uninstall.sh --domain arcade.example.com --purge-data --remove-runtime --remove-images
```
