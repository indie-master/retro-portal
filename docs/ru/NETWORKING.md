# Сетевое поведение Retro Portal

[← README](../../README.md) · [Установка](INSTALL.md) · [Nginx/TLS](NGINX.md) · [Безопасность](../../SECURITY.md)

Этот документ описывает **реальный сетевой трафик Retro Portal**. Его можно прикладывать к обращению в поддержку хостинга/CDN/провайдера, когда нужно объяснить назначение соединений и endpoint'ов проекта.

## Что действительно делает портал

| Endpoint / тип | Назначение | Характер соединения |
|---|---|---|
| `/`, `/game.html`, `/local.html` | HTML/CSS/JS интерфейс | обычный HTTPS |
| `/emulatorjs/` | JS/WASM/cores EmulatorJS | HTTPS, обычно крупные cacheable assets |
| `/roms/` | ROM владельца сервера | HTTPS download; размер зависит от платформы |
| `/bios/` | BIOS, нужный браузерному core | HTTPS, только для подготовленных игр |
| `/api/games` | публичный каталог | короткие HTTPS JSON-запросы |
| `/api/activity` | реальная online/activity статистика | короткие HTTPS JSON-запросы |
| `/ws/presence` | online presence и текущая игра | долгоживущий WebSocket с небольшими heartbeat/events |
| `/api/admin/*` | Library Manager | HTTPS, только авторизованный владелец |

После загрузки ROM и runtime сама эмуляция выполняется на устройстве игрока в браузере. Поэтому CPU/GPU сервера не эмулируют игру; сервер в основном раздаёт assets и поддерживает web/API/presence-сессию.

## WebSocket

`/ws/presence` — настоящий application WebSocket. Он используется для:

- подсчёта активных browser sessions;
- события `playing` / `idle`;
- блока «Во что играют сейчас»;
- heartbeat и очистки умерших соединений.

WebSocket не переносит ROM и не является общим TCP-туннелем.

## Что проект не генерирует

Обычный браузер Retro Portal не создаёт Xray XHTTP и не открывает произвольные raw TCP-соединения. Native gRPC также не используется текущей версией. Если в будущем появится реальная функция на gRPC-Web/WebTransport/WebRTC, она должна быть задокументирована как часть самой игровой функции.

Если на том же сервере работают другие сервисы, рекомендуются отдельные hostnames/paths/upstreams и честное описание их назначения. Не следует приписывать Retro Portal трафик, который не создаётся самим порталом.

## Типичный профиль сессии

1. Пользователь открывает страницу: HTML/CSS/JS + обложки.
2. Открывается `/ws/presence`.
3. При запуске игры браузер скачивает нужный EmulatorJS runtime/core, ROM и при необходимости BIOS.
4. Эмуляция идёт локально.
5. WebSocket остаётся активным, пока открыт портал/игра, и передаёт небольшие события presence.
6. Save-state/SRAM в базовой конфигурации остаются в браузере.

Для больших PS1/Dreamcast образов основной объём трафика — обычная HTTPS-раздача файла, а не постоянный поток с сервера.

## Проверка на сервере

```bash
curl -i https://arcade.example.com/healthz
curl -s https://arcade.example.com/api/games | jq
curl -s https://arcade.example.com/api/activity | jq
```

WebSocket можно проверить любым стандартным WS-клиентом на `wss://arcade.example.com/ws/presence` с корректным `Origin` того же сайта.

## Reverse proxy

Production-схема по умолчанию:

```text
Internet
   ↓ HTTPS
Host Nginx / CDN
   ↓ HTTP localhost
127.0.0.1:8088
   ↓
Retro Portal web + backend
```

Внутренний порт рекомендуется оставлять привязанным к `127.0.0.1`. Host Nginx отвечает за публичный TLS, сертификат и внешние security headers.
