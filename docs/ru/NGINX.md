# Nginx и TLS

## Сначала диагностика

```bash
sudo ./scripts/nginx-detect.sh arcade.example.com
```

Команда read-only: она запускает `nginx -T`, анализирует topology и сертификаты, но ничего не меняет.

## Профиль A — обычный Nginx HTTP/TLS

```text
Internet :443
    │ TLS
    ▼
Nginx http server
    │
    ▼
127.0.0.1:8088
    │
    └─ Docker portal
```

Для нового hostname installer может создать vhost полностью автоматически.

## Профиль B — `stream :443 + ssl_preread`

```text
Internet :443
    │ TLS ClientHello
    ▼
Nginx stream
    │ ssl_preread / SNI
    ▼
127.0.0.1:8443 HTTPS
    │
    ▼
127.0.0.1:8088 Portal
```

Если `stream` уже владеет публичным `:443`, обычный `server { listen 443 ssl; }` на том же сокете создавать нельзя.

Installer обнаруживает этот сценарий и создаёт внутренний HTTPS-vhost. В `generated/<domain>.stream-map-example.conf` появляется пример SNI-route.

Если существующий stream-map уже отправляет unknown/default SNI на тот же локальный HTTPS listener, дополнительная запись может быть не нужна. Проверяйте реальную конфигурацию `nginx -T`.

### PROXY protocol

Если stream-frontend передаёт PROXY protocol, внутренний vhost должен слушать с `proxy_protocol`, например:

```nginx
listen 127.0.0.1:8443 ssl proxy_protocol;
set_real_ip_from 127.0.0.1;
real_ip_header proxy_protocol;
```

Installer добавляет это только если обнаруживает `proxy_protocol on` в stream server на `:443`.

## Когда hostname уже существует

Проект принципиально не пытается автоматически вставить `location` внутрь произвольного рабочего `server {}`.

Вместо этого создаётся:

```text
generated/arcade.example.com.locations.conf
```

Его содержимое можно вставить внутрь нужного server-блока либо подключить через `include`.

После этого обязательно:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## Existing wildcard/SAN certificate

```bash
sudo ./scripts/install.sh \
  --mode existing \
  --domain arcade.example.com \
  --tls existing
```

Поиск идёт по `/etc/letsencrypt/live/*/fullchain.pem` и путям `ssl_certificate`, которые уже видны в `nginx -T`.

Каждый кандидат проверяется:

```bash
openssl x509 -in fullchain.pem -noout -checkhost arcade.example.com
```

и сверяется с private key по публичному ключу.

## Let's Encrypt HTTP-01

Installer создаёт/использует ACME webroot `/var/www/retro-portal-acme` и выполняет `certbot certonly --webroot`.

Нужно:

- DNS hostname должен вести на этот сервер;
- входящий TCP/80 должен быть доступен из Интернета;
- внешний CDN/WAF не должен ломать `/.well-known/acme-challenge/`.

## Cloudflare DNS-01

Credentials-файл:

```ini
dns_cloudflare_api_token = YOUR_TOKEN
```

Права:

```bash
chmod 600 /root/.secrets/cloudflare.ini
```

Рекомендуется использовать scoped token только с необходимыми DNS permissions.

## WebSocket

Для `/ws/` нужны Upgrade/Connection headers и увеличенный read timeout. Проект уже генерирует их.

## Проверка TLS

```bash
openssl s_client -connect arcade.example.com:443 -servername arcade.example.com </dev/null 2>/dev/null \
  | openssl x509 -noout -subject -issuer -dates
```

Проверка hostname локального сертификата:

```bash
openssl x509 -in /path/fullchain.pem -noout -checkhost arcade.example.com
```