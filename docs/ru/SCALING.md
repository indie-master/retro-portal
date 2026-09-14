# Масштабирование Retro Portal

[← README](../../README.md) · [Установка](INSTALL.md) · [Обновление](UPDATE.md) · [Сеть](NETWORKING.md) · [Безопасность](../../SECURITY.md)

Retro Portal по умолчанию остаётся обычным **single-node** приложением: один сервер, один `docker-compose.yml`, один reverse proxy. Для небольшой/средней библиотеки это самый простой и предпочтительный вариант.

Когда основная нагрузка начинает приходиться на раздачу ROM, EmulatorJS runtime, обложек и других статических файлов, проект можно разнести на несколько edge-нод без изменения интерфейса для игрока.

## Архитектура scale-out

```text
                         Internet
                            │
                     CDN / Load Balancer
                            │
            ┌───────────────┼───────────────┐
            │               │               │
         EDGE-1          EDGE-2          EDGE-N
      static + ROM     static + ROM     static + ROM
            │               │               │
            └───────────────┬───────────────┘
                            │ small API / WS
                            ▼
                     CONTROL / ORIGIN
                    backend + admin + stats
```

Edge-ноды обслуживают тяжёлый/cacheable трафик: HTML/CSS/JS, `/roms/`, `/bios/`, `/emulatorjs/`, обложки и screenshots.

Динамические endpoint'ы остаются на control/origin:

- `/api/games`;
- `/api/activity`;
- `/api/play/*`;
- `/ws/presence`.

`/admin.html` и `/api/admin/*` на edge специально отключены. Поэтому библиотека редактируется только на control/origin, а online/current-game статистика остаётся единой для всего пула.

## Control / origin

Control-нода разворачивается как обычная установка:

```bash
git clone https://github.com/indie-master/retro-portal.git
cd retro-portal
cp .env.example .env
./scripts/install-emulatorjs.sh 4.2.3
docker compose up -d --build
```

Либо через существующий Nginx:

```bash
sudo ./scripts/install.sh --mode existing --domain origin.arcade.example.com
```

Для edge → origin предпочтительна private VLAN/WireGuard/Tailscale. Через Internet используйте HTTPS и по возможности ограничьте origin firewall'ом по IP edge-нод и административных адресов.

## Edge-нода

```bash
git clone https://github.com/indie-master/retro-portal.git
cd retro-portal
cp .env.edge.example .env.edge
```

Пример `.env.edge`:

```ini
EDGE_BIND_ADDR=127.0.0.1
EDGE_PORT=8088
CONTROL_ORIGIN_SCHEME=https
CONTROL_ORIGIN_HOST=origin.arcade.example.com
CONTROL_ORIGIN_PORT=443
EDGE_MEMORY_LIMIT=384m
EDGE_CPU_LIMIT=1.0
```

Запуск:

```bash
./scripts/install-emulatorjs.sh 4.2.3
docker compose --env-file .env.edge -f docker-compose.edge.yml up -d --build
curl -i http://127.0.0.1:8088/healthz
```

Edge-контейнер работает unprivileged/read-only, без Linux capabilities и без admin token.

## Синхронизация библиотеки

На control создайте приватный inventory:

```bash
cp cluster/nodes.example cluster/nodes.conf
```

Формат:

```text
edge-1|retro@203.0.113.11|/opt/retro-portal
edge-2|retro@203.0.113.12|/opt/retro-portal
```

`cluster/nodes.conf` исключён из Git.

Dry-run:

```bash
./scripts/cluster-sync.sh --dry-run
```

Все edge:

```bash
./scripts/cluster-sync.sh
```

Одна edge:

```bash
./scripts/cluster-sync.sh --node edge-2
```

Передаются только ROM, BIOS, user artwork/screenshots и EmulatorJS runtime. `.env`, `ADMIN_TOKEN`, mutable catalog/state и credentials не копируются.

## Reverse proxy / load balancer

Sticky sessions не обязательны: API/WebSocket всё равно возвращаются через edge на control/origin.

Полный пример лежит в [`examples/nginx-scale-out.conf`](../../examples/nginx-scale-out.conf).

Минимальный Nginx OSS вариант:

```nginx
map $http_upgrade $connection_upgrade {
    default upgrade;
    ''      close;
}

upstream retro_portal_edges {
    least_conn;
    server 10.0.0.11:8088 max_fails=3 fail_timeout=15s;
    server 10.0.0.12:8088 max_fails=3 fail_timeout=15s;
    server 10.0.0.13:8088 max_fails=3 fail_timeout=15s;
    keepalive 32;
}

server {
    listen 443 ssl;
    server_name arcade.example.com;

    ssl_certificate     /path/fullchain.pem;
    ssl_certificate_key /path/privkey.pem;

    location / {
        proxy_pass http://retro_portal_edges;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_read_timeout 1h;
    }
}
```

Nginx OSS использует passive health (`max_fails`/`fail_timeout`); внешний мониторинг может опрашивать `/healthz` каждой edge.

## CDN

CDN можно ставить перед single-node или edge-пулом.

Удобно кешировать:

- `/emulatorjs/`;
- `/roms/`, если это соответствует вашей модели библиотеки;
- `/covers/`;
- `/screenshots/`;
- CSS/JS/images.

Не кешируйте длительно `/api/`, `/ws/`, `/admin.html`, `/healthz`. CDN/LB должен поддерживать WebSocket Upgrade; для больших ROM желательно сохранять Range requests.

## Обновление control/origin

```bash
./scripts/update.sh --mode standalone
```

Updater требует чистый Git checkout, выполняет `git pull --ff-only`, rebuild/recreate, проверяет `/healthz` и при неудачном запуске новой версии пытается вернуть предыдущий commit и контейнеры.

## Обновление edge-пула

Одна нода:

```bash
./scripts/update.sh --mode edge
```

Все ноды из inventory:

```bash
./scripts/cluster-update.sh --dry-run
./scripts/cluster-update.sh
```

Рекомендуемый rolling порядок:

```text
1. control/origin
2. проверка API/player
3. одна canary edge
4. проверка запуска игры
5. остальные edge
6. cluster-sync.sh, если менялись library payload/runtime
```

Подробно: [UPDATE.md](UPDATE.md).

## Добавление edge

1. Clone repo.
2. Создать `.env.edge`.
3. Установить EmulatorJS runtime.
4. Запустить `docker-compose.edge.yml`.
5. Добавить ноду в `cluster/nodes.conf`.
6. Выполнить `cluster-sync.sh --node <name>`.
7. Проверить `/healthz`.
8. Добавить edge в LB/CDN pool.

## Удаление edge

Сначала drain/remove edge в LB/CDN, затем:

```bash
./scripts/uninstall-edge.sh --dry-run
./scripts/uninstall-edge.sh
```

Для удаления локальной реплики ROM/runtime:

```bash
./scripts/uninstall-edge.sh --purge-replica-data
```

## Single point of truth

Control/origin остаётся единственным writer'ом для Library Manager, mutable catalog, launch statistics и online presence. Это сознательно упрощает consistency и переносит на edge именно тяжёлую полосу/I/O.

Если когда-нибудь понадобится HA именно для backend/control plane, следующий архитектурный шаг — shared database/Redis/object storage, а не файловая репликация mutable state.

## Security checklist

- не копируйте `.env`/`ADMIN_TOKEN` на edge;
- используйте private network или HTTPS с валидным сертификатом edge → origin;
- не отключайте TLS verification;
- ограничьте origin firewall'ом, когда возможно;
- `cluster/nodes.conf` держите вне Git;
- используйте SSH keys и host-key verification;
- admin лучше вынести на отдельный hostname/private management path;
- сначала обновляйте canary edge;
- перед удалением edge сначала drain из LB/CDN.
