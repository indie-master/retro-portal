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

## Реальный IP клиента

Встроенный web-контейнер пишет в access log нормализованный `X-Real-IP`, а рядом сохраняет `peer=...` — фактический Docker peer. Это позволяет видеть адрес посетителя и одновременно понимать, через какой proxy-hop пришёл запрос.

Обычный host Nginx:

```nginx
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $remote_addr;
```

Если публичный `:443` занят `stream { ssl_preread; }`, stream передаёт соединение во внутренний HTTPS-vhost через PROXY protocol, и именно `$proxy_protocol_addr` является адресом исходного TCP-клиента. Для такого inner-vhost используйте:

```nginx
server {
    listen 127.0.0.1:8443 ssl proxy_protocol;

    set_real_ip_from 127.0.0.1;
    real_ip_header proxy_protocol;

    location / {
        proxy_pass http://127.0.0.1:8088;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $proxy_protocol_addr;
        proxy_set_header X-Forwarded-For $proxy_protocol_addr;
        proxy_set_header X-Forwarded-Proto https;
    }
}
```

Для `/ws/` передавайте тот же `X-Real-IP` вместе с `Upgrade/Connection`.

Не доверяйте произвольному `X-Real-IP` от Интернета. Если перед сервером стоит CDN/LB, сначала настройте host reverse proxy так, чтобы он принимал client-IP header только от доверенных адресов CDN/LB, а уже затем передавал нормализованный адрес Retro Portal.

После настройки проверка выглядит так:

```bash
docker compose logs --since=2m web | tail -20
```

Первая колонка должна содержать client IP, а `peer=` обычно останется адресом Docker bridge — это нормально.

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

Это позволяет распределять полосу и файловый I/O, сохраняя один согласованный источник каталога, online и статистики. Полная схема: [SCALING.md](SCALING.md).

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

В stream/PROXY-protocol профиле замените `$remote_addr` на `$proxy_protocol_addr`, как показано выше.

## Кеширование

Хорошие кандидаты для CDN/edge cache: `/emulatorjs/` (кроме bootstrap `loader.js`), `/assets/`, `/covers/`, `/screenshots/` и `/roms/`, если это соответствует политике библиотеки.

Не делайте длительный cache для `/api/`, `/ws/`, `/admin.html`, `/healthz` и `/emulatorjs/data/loader.js`. Для больших ROM сохраняйте Range requests.

## Origin connectivity

Для edge → control/origin предпочтительна приватная сеть: VLAN, WireGuard, Tailscale или другой доверенный private path. Если трафик идёт через Internet, используйте HTTPS, не отключайте проверку TLS-сертификата и по возможности ограничьте origin firewall'ом по IP edge-нод.

## Health checks

Single/control `/healthz` проверяет backend. Edge `/healthz` является локальным health endpoint самого edge и не зависит от control origin.

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

Presence: `wss://arcade.example.com/ws/presence`.

## Несколько приложений на одном сервере

Разделяйте приложения по hostname/upstream. Для существующего сложного Nginx используйте `existing` или `manual`: [INSTALL.md](INSTALL.md).
