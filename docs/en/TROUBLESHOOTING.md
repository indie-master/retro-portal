# Troubleshooting

Run:

```bash
./scripts/doctor.sh --domain arcade.example.com
```

## Portal does not answer locally

```bash
docker compose ps
docker compose logs --tail=200
curl -v http://127.0.0.1:8088/healthz
ss -ltnp | grep 8088
```

## ROM NOT INSTALLED

```bash
ls -lah games/roms/
cat catalog/games.json | jq
curl -s http://127.0.0.1:8088/api/games | jq
```

The catalog `rom` value must exactly match the file name.

## EmulatorJS missing

```bash
./scripts/install-emulatorjs.sh 4.2.3
ls -lh emulatorjs/data/loader.js
```

## WebSocket keeps reconnecting

Verify the reverse proxy forwards Upgrade/Connection and has an appropriate `proxy_read_timeout`.

## Nginx test fails

```bash
sudo nginx -t
sudo nginx -T > /tmp/nginx-full.txt 2>&1
```

The installer does not reload Nginx after a failed syntax test and rolls back the vhost it created.

## Stream frontend returns the wrong site

Check SNI routing, the default map entry and the inner TLS endpoint. Test the inner endpoint directly with `curl --resolve` before debugging the public stream layer.