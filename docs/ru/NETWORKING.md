# Сеть и reverse proxy

[← README](../../README.md) · [Установка](INSTALL.md) · [Nginx/TLS](NGINX.md) · [Безопасность](../../SECURITY.md)

Этот документ описывает сетевую архитектуру Retro Portal, основные endpoint'ы и рекомендуемую схему публикации приложения.

## Основные endpoint'ы

| Endpoint | Назначение | Профиль |
|---|---|---|
| `/`, `/game.html`, `/local.html` | интерфейс портала | обычный HTTPS |
| `/emulatorjs/` | JS/WASM/cores EmulatorJS | HTTPS, хорошо кешируется |
| `/roms/` | ROM для подготовленных игр | HTTPS download |
| `/bios/` | BIOS для браузерного core | HTTPS download |
| `/api/games` | публичный каталог | короткие JSON-запросы |
| `/api/activity` | online/activity статистика | короткие JSON-запросы |
| `/ws/presence` | presence и текущая игра | долгоживущий WebSocket |
| `/api/admin/*` | Library Manager | HTTPS, требуется авторизация |
| `/healthz` | health check | короткий HTTP/HTTPS запрос |

После загрузки runtime и ROM эмуляция выполняется на устройстве игрока. Сервер в основном раздаёт web/assets, хранит каталог и статистику и поддерживает presence-соединения.

## Типичная сессия

1. Браузер загружает HTML, CSS, JavaScript и обложки.
2. Открывается `/ws/presence`.
3. При запуске игры браузер получает нужный EmulatorJS core/runtime, ROM и при необходимости BIOS.
4. Эмуляция продолжается локально в браузере.
5. Presence WebSocket передаёт небольшие события `playing`, `idle`, heartbeat и обновления online.
6. Save-state/SRAM в базовой конфигурации сохраняются на стороне браузера.

## Рекомендуемая production-схема

```text
Internet
   ↓ HTTPS
Nginx / Caddy / Traefik / CDN
   ↓ HTTP localhost
127.0.0.1:8088
   ↓
Retro Portal
```

По возможности внутренний порт приложения стоит оставлять привязанным к `127.0.0.1`, а публичный HTTPS, сертификат и внешние security headers завершать на reverse proxy.

## WebSocket

Для `/ws/presence` reverse proxy должен передавать upgrade-заголовки:

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

Если WebSocket не работает, online-счётчик и блок текущей активности будут недоступны, но библиотека и запуск игр через обычный HTTP API продолжат работать.

## Кеширование

Статические файлы удобно кешировать агрессивнее:

- `/emulatorjs/`;
- `/assets/`;
- `/covers/`;
- `/screenshots/`.

Для API и админки лучше отключить длительное кеширование:

- `/api/`;
- `/admin.html`;
- `/healthz`.

ROM/BIOS можно кешировать только если это соответствует вашей модели обновления библиотеки. Для больших файлов полезно сохранять поддержку Range requests.

## Проверка

```bash
curl -i https://arcade.example.com/healthz
curl -s https://arcade.example.com/api/games | jq
curl -s https://arcade.example.com/api/activity | jq
```

Проверить WebSocket можно стандартным WS-клиентом по адресу:

```text
wss://arcade.example.com/ws/presence
```

`Origin` должен соответствовать hostname портала.

## Несколько приложений на одном сервере

Если сервер обслуживает несколько сайтов или приложений, удобнее разделять их по hostname и отдельным upstream/server block. Это упрощает TLS, логи, rate limits, обновления и диагностику.

Пример:

```text
arcade.example.com    → Retro Portal
files.example.com     → отдельное приложение
status.example.com    → мониторинг
```

Для сложной схемы с существующим Nginx используйте режим установки `existing` или `manual`: [INSTALL.md](INSTALL.md).
