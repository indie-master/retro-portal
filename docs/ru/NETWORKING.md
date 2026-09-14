# Сеть и reverse proxy

[← README](../../README.md) · [Установка](INSTALL.md) · [Масштабирование](SCALING.md) · [Nginx/TLS](NGINX.md) · [Безопасность](../../SECURITY.md)

Этот документ описывает сетевую архитектуру Retro Portal, основные endpoint'ы и рекомендуемые схемы публикации.

## Основные endpoint'ы

| Endpoint | Назначение | Профиль |
|---|---|---|
| `/`, `/game.html`, `/local.html` | интерфейс портала | обычный HTTPS |
| `/emulatorjs/` | JS/WASM/cores EmulatorJS | HTTPS, хорошо кешируется |
| `/roms/` | ROM подготовленных игр | HTTPS download / Range |
| `/bios/` | BIOS для browser core | HTTPS download |
| `/api/games` | публичный каталог | короткие JSON-запросы |
| `/api/activity` | online/activity статистика | короткие JSON-запросы |
| `/api/play/*` | событие запуска игры | короткий POST |
| `/ws/presence` | presence и текущая игра | долгоживущий WebSocket |
| `/api/admin/*` | Library Manager | HTTPS, авторизация |
| `/healthz` | health check | короткий HTTP/HTTPS запрос |

После загрузки runtime и ROM эмуляция выполняется на устройстве игрока. Сервер в основном раздаёт web/assets, хранит каталог/статистику и поддерживает presence.

## Single-node production

```text
Internet
   ↓ HTTPS
Nginx / Caddy / Traefik / CDN
   ↓ HTTP localhost
127.0.0.1:8088
   ↓
Retro Portal
```

Внутренний порт лучше держать на `127.0.0.1`, а публичный TLS завершать на host reverse proxy.

## Scale-out production

```text
Internet
   ↓
CDN / Load Balancer
   ↓
Edge pool
   ├─ static / ROM / BIOS / EmulatorJS
   └─ proxy API + WebSocket
          ↓
     Control / Origin
     backend + admin + stats
```

Edge-ноды обслуживают тяжёлые файлы локально. `/api/*` и `/ws/*` они проксируют на control/origin. `/admin.html` и `/api/admin/*` на edge отключены.

Это позволяет распределять полосу и файловый I/O, сохраняя один согласованный источник каталога, online и статистики.

Полная схема: [SCALING.md](SCALING.md).

## WebSocket

Для `/ws/presence` reverse proxy должен передавать Upgrade-заголовки:

```nginx
location /ws/ {
    proxy_pass http://127.0.0.1:8088;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}
```

В scale-out режиме edge выполняет этот proxy автоматически через `docker-compose.edge.yml`. Presence всего пула возвращается на control/origin, поэтому счётчик online и «Во что играют сейчас» остаются общими.

## Кеширование

Хорошие кандидаты для CDN/edge cache:

- `/emulatorjs/`;
- `/assets/`;
- `/covers/`;
- `/screenshots/`;
- `/roms/`, если это соответствует политике вашей библиотеки.

Не делайте длительный cache для:

- `/api/`;
- `/ws/`;
- `/admin.html`;
- `/healthz`.

Для больших ROM сохраняйте Range requests.

## Origin connectivity

Для edge → control/origin предпочтительна приватная сеть: VLAN, WireGuard, Tailscale или другой доверенный private path.

Если трафик идёт через Internet:

- используйте HTTPS;
- не отключайте проверку TLS-сертификата;
- по возможности ограничьте origin firewall'ом по IP edge-нод;
- отделите административный доступ от публичного origin endpoint.

Edge image в Retro Portal включает CA store и выполняет TLS verification для HTTPS origin.

## Health checks

Single/control `/healthz` проверяет backend.

Edge `/healthz` является локальным health endpoint самого edge и не зависит от control origin. Это важно: LB может отдельно видеть состояние edge, а доступность control/API мониторится отдельным запросом к `/api/status` или origin `/healthz`.

Пример:

```bash
curl -fsS https://arcade.example.com/healthz
curl -fsS https://arcade.example.com/api/status | jq
```

## Проверка

```bash
curl -i https://arcade.example.com/healthz
curl -s https://arcade.example.com/api/games | jq
curl -s https://arcade.example.com/api/activity | jq
```

Presence:

```text
wss://arcade.example.com/ws/presence
```

## Несколько приложений на одном сервере

Разделяйте приложения по hostname/upstream, особенно если на одной машине уже есть другие сервисы:

```text
arcade.example.com    → Retro Portal
files.example.com     → другое приложение
status.example.com    → мониторинг
```

Для существующего сложного Nginx используйте `existing` или `manual`: [INSTALL.md](INSTALL.md).
