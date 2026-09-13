# Диагностика

## Автоматическая проверка

```bash
./scripts/doctor.sh --domain arcade.example.com
```

Проверяются Docker, Compose, контейнеры, `/healthz`, API каталога, EmulatorJS loader, `nginx -t`, локальный сертификат и публичный HTTPS.

## Портал не открывается локально

```bash
docker compose ps
docker compose logs --tail=200
curl -v http://127.0.0.1:8088/healthz
ss -ltnp | grep 8088
```

## `ROM NOT INSTALLED`

```bash
ls -lah games/roms/
cat catalog/games.json | jq
curl -s http://127.0.0.1:8088/api/games | jq
```

Имя `rom` в JSON должно совпадать с именем файла посимвольно.

## `EmulatorJS is not installed`

```bash
./scripts/install-emulatorjs.sh 4.2.3
ls -lh emulatorjs/data/loader.js
```

## WebSocket reconnecting

Проверить proxy headers:

```nginx
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
proxy_read_timeout 3600s;
```

И backend:

```bash
docker compose logs backend --tail=100
```

## `nginx -t` падает

Installer не делает reload после неуспешного test и откатывает созданный им vhost.

```bash
sudo nginx -t
sudo nginx -T > /tmp/nginx-full.txt 2>&1
```

Частые причины:

- hostname уже описан в другом файле;
- `:443` уже занят stream-контекстом;
- неправильный certificate/key path;
- внутренний listener создан без требуемого `proxy_protocol` или наоборот;
- duplicate `location /` внутри существующего server-блока при ручной вставке.

## Stream frontend отдаёт не тот сайт

```bash
sudo ./scripts/nginx-detect.sh arcade.example.com
```

Проверьте SNI map `$ssl_preread_server_name`, default route и локальный inner TLS listener.

```bash
curl -vk --resolve arcade.example.com:8443:127.0.0.1 https://arcade.example.com:8443/
```

Если inner endpoint работает, а публичный домен нет — проблема находится на stream/SNI слое.