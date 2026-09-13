# Nginx and TLS

Run the read-only topology detector first:

```bash
sudo ./scripts/nginx-detect.sh arcade.example.com
```

It reports HTTP/stream ownership of ports 80/443, `ssl_preread`, PROXY protocol, local TLS listeners, existing hostnames and matching certificates.

## Standard HTTP/TLS profile

```text
Internet :443 → Nginx HTTP TLS → 127.0.0.1:8088 → portal containers
```

## Stream/SNI profile

```text
Internet :443 → Nginx stream + ssl_preread → 127.0.0.1:8443 HTTPS → 127.0.0.1:8088
```

When stream owns public port 443, the installer does not attempt to create a competing `listen 443 ssl` HTTP socket. It creates an inner HTTPS vhost and writes a stream routing example under `generated/`.

If the stream frontend uses PROXY protocol, the inner vhost is generated with the matching `proxy_protocol` listener and real-IP directives.

## Existing hostname safety

The installer never regex-edits an arbitrary existing server block. If the hostname already exists, it generates `generated/<domain>.locations.conf` for manual inclusion.

## Existing certificates

Certificate candidates are discovered from `/etc/letsencrypt/live` and certificate paths already referenced by `nginx -T`. Hostname coverage is verified with `openssl x509 -checkhost`, and the certificate public key is compared with the private key.

## HTTP-01 and DNS-01

HTTP-01 uses `/var/www/retro-portal-acme`. Cloudflare DNS-01 accepts a scoped token from a mode-0600 credentials file.

## WebSocket

Generated configs forward Upgrade/Connection headers and use a long read timeout. The backend sends heartbeat traffic as well.