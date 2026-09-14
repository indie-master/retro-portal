# Масштабирование Retro Portal

[← README](../../README.md) · [Установка](INSTALL.md) · [Сеть](NETWORKING.md) · [Безопасность](../../SECURITY.md)

Retro Portal по умолчанию остаётся обычным **single-node** приложением: один сервер, один `docker-compose.yml`, один Nginx/reverse proxy. Для небольшой библиотеки и нескольких игроков это самый простой и предпочтительный вариант.

Когда основная нагрузка начинает приходиться на раздачу ROM, EmulatorJS runtime, обложек и других статических файлов, проект можно разнести на несколько edge-нод без изменения интерфейса для игрока.

## Рекомендуемая модель scale-out

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

Edge-ноды обслуживают тяжёлый и хорошо кешируемый трафик:

- HTML/CSS/JS;
- `/roms/`;
- `/bios/`;
- `/emulatorjs/`;
- обложки и screenshots.

Динамические endpoint'ы централизованы на control/origin-ноде:

- `/api/games`;
- `/api/activity`;
- `/api/play/*`;
- `/ws/presence`.

`/admin.html` и `/api/admin/*` на edge-нодах намеренно отключены. Управление библиотекой выполняется только через control/origin.

Такой дизайн распределяет основную полосу и файловый I/O между серверами, но не требует общей базы данных для presence/статистики и не ломает single-node режим.

## Что происходит при запуске игры

1. Пользователь попадает на любую здоровую edge-ноду через CDN/LB.
2. Страница и artwork отдаются локально с edge.
3. Каталог и activity API edge прозрачно проксирует на control/origin.
4. WebSocket presence также идёт через edge на один control/origin, поэтому online/current-game счётчики остаются общими для всего пула.
5. ROM, BIOS и EmulatorJS runtime загружаются с той edge-ноды, на которую попал пользователь.
6. Сама эмуляция дальше выполняется в браузере пользователя.

## Подготовка control/origin

Control-нода разворачивается обычным способом:

```bash
git clone https://github.com/indie-master/retro-portal.git
cd retro-portal
cp .env.example .env
./scripts/install-emulatorjs.sh 4.2.3
docker compose up -d --build
```

Или через installer:

```bash
sudo ./scripts/install.sh --mode existing --domain origin.arcade.example.com
```

Для scale-out желательно использовать отдельный origin hostname, например:

```text
origin.arcade.example.com
```

Он нужен edge-нодам для API/WebSocket. Если серверы имеют private VLAN/WireGuard/Tailscale, лучше направлять edge → origin по приватной сети. Если используется Internet, применяйте HTTPS и ограничьте origin firewall'ом по IP edge-нод и административных адресов.

## Подготовка edge-ноды

На каждой edge-ноде:

```bash
git clone https://github.com/indie-master/retro-portal.git
cd retro-portal
cp .env.edge.example .env.edge
```

Укажите control/origin:

```ini
EDGE_BIND_ADDR=127.0.0.1
EDGE_PORT=8088
CONTROL_ORIGIN_SCHEME=https
CONTROL_ORIGIN_HOST=origin.arcade.example.com
CONTROL_ORIGIN_PORT=443
EDGE_MEMORY_LIMIT=384m
EDGE_CPU_LIMIT=1.0
```

Установите runtime:

```bash
./scripts/install-emulatorjs.sh 4.2.3
```

Запустите edge:

```bash
docker compose --env-file .env.edge -f docker-compose.edge.yml up -d --build
curl -i http://127.0.0.1:8088/healthz
```

Edge-контейнер не запускает backend и не хранит admin token. Он обслуживает статические/игровые файлы и проксирует небольшой динамический трафик к origin.

## Синхронизация библиотеки на edge-ноды

На control-ноде создайте приватный inventory:

```bash
cp cluster/nodes.example cluster/nodes.conf
```

Формат:

```text
edge-1|retro@203.0.113.11|/opt/retro-portal
edge-2|retro@203.0.113.12|/opt/retro-portal
```

`cluster/nodes.conf` исключён из Git.

Проверка без изменений:

```bash
./scripts/cluster-sync.sh --dry-run
```

Синхронизация всех edge:

```bash
./scripts/cluster-sync.sh
```

Только одной ноды:

```bash
./scripts/cluster-sync.sh --node edge-2
```

Скрипт передаёт только:

- `games/roms/`;
- `games/bios/`;
- `public/covers/library/`;
- `public/screenshots/library/`;
- `emulatorjs/data/` и `emulatorjs/VERSION`.

Он **не передаёт** `.env`, `ADMIN_TOKEN`, mutable catalog, Git credentials и другие секреты.

Для синхронизации используется SSH/rsync с обычной проверкой host key. Пароли и ключи в inventory не хранятся.

## Reverse proxy / load balancer

На внешнем балансировщике все пользовательские запросы можно распределять по edge-нодам. Sticky sessions не обязательны: WebSocket и API всё равно централизуются через edge на control/origin.

Пример Nginx OSS:

```nginx
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
    }
}
```

Если балансировщик не поддерживает активные health checks, используйте passive health (`max_fails`/`fail_timeout`) и внешний мониторинг `/healthz`.

## CDN

CDN можно ставить перед одним сервером или перед edge-пулом.

Наиболее выгодно кешировать:

- `/emulatorjs/`;
- `/roms/` — если модель библиотеки допускает кеширование;
- `/covers/`;
- `/screenshots/`;
- CSS/JS/images.

Не кешируйте длительно:

- `/api/`;
- `/ws/`;
- `/admin.html`;
- `/healthz`.

Для WebSocket CDN/LB должен поддерживать Upgrade. Для больших ROM желательно сохранять Range requests.

## Обновление control/origin

Безопасный updater:

```bash
./scripts/update.sh --mode standalone
```

Он:

1. отказывается работать при изменённом Git working tree;
2. выполняет `git fetch` + `git pull --ff-only`;
3. rebuild/recreate контейнеров;
4. проверяет `/healthz`;
5. при неуспешном health check откатывает Git на предыдущий commit и пересобирает предыдущую версию.

Если код уже обновлён другим способом:

```bash
./scripts/update.sh --mode standalone --no-git
```

## Обновление edge-нод

На одной edge-ноде:

```bash
./scripts/update.sh --mode edge
```

Для всего пула с control-ноды:

```bash
./scripts/cluster-update.sh --dry-run
./scripts/cluster-update.sh
```

Рекомендуемый порядок изменения версии:

```text
1. Обновить control/origin.
2. Проверить health/API/player.
3. Обновить одну edge-ноду (canary).
4. Проверить игру через неё.
5. Обновить оставшиеся edge-ноды.
6. Если менялись ROM/artwork/runtime — выполнить cluster-sync.sh.
```

Такой rolling update позволяет не останавливать весь портал одновременно.

## Добавление новой edge-ноды

1. Clone repo.
2. Создать `.env.edge`.
3. Установить EmulatorJS runtime.
4. Запустить `docker-compose.edge.yml`.
5. Добавить ноду в `cluster/nodes.conf`.
6. Выполнить `cluster-sync.sh --node <name>`.
7. Проверить `/healthz`.
8. Только после этого добавить ноду в CDN/load balancer pool.

## Удаление edge-ноды из пула

Сначала удалите/disable ноду в LB/CDN и дождитесь завершения активных соединений. Затем:

```bash
docker compose --env-file .env.edge -f docker-compose.edge.yml down
```

Это не влияет на control/origin и другие edge-ноды.

## Что остаётся single point of truth

В текущей scale-out модели control/origin остаётся единственным writer'ом для:

- Library Manager;
- mutable catalog;
- launch statistics;
- online presence.

Это осознанно: тяжёлая полоса распределяется, а маленький stateful слой остаётся простым и согласованным. Если когда-нибудь понадобится HA именно для backend/control plane, следующий шаг — вынести state в shared database/Redis/object storage. Для обычной игровой библиотеки это чаще всего не требуется.

## Безопасность scale-out

- не размещайте `ADMIN_TOKEN` на edge-нодах;
- не копируйте `.env` с control на edge;
- ограничьте origin firewall'ом/private network, когда это возможно;
- используйте HTTPS edge → origin через Internet;
- не отключайте TLS verification на edge;
- используйте SSH keys + host key checking для `cluster-sync.sh`/`cluster-update.sh`;
- держите `cluster/nodes.conf` вне Git;
- используйте отдельный admin hostname/IP allowlist/VPN для Library Manager на крупных установках;
- сначала обновляйте одну edge-ноду как canary.
