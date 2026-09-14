# Scaling Retro Portal

[← README](../../README_EN.md) · [Installation](INSTALL.md) · [Networking](NETWORKING.md) · [Security](../../SECURITY.md)

Retro Portal remains a normal **single-node** application by default: one server, one `docker-compose.yml`, one reverse proxy. For small/medium libraries this is the simplest and preferred deployment.

When bandwidth and file I/O from ROMs, EmulatorJS runtime and artwork become the main load, the same project can be expanded into a control/origin node plus multiple stateless edge nodes.

## Recommended scale-out model

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

Edges serve the heavy/cacheable paths locally: HTML/CSS/JS, `/roms/`, `/bios/`, `/emulatorjs/`, covers and screenshots. Dynamic API/WebSocket traffic is proxied to one control/origin node. `/admin.html` and `/api/admin/*` are disabled on edges.

This distributes bandwidth without requiring a shared database and keeps the original single-server deployment fully supported.

## Control/origin

Deploy the control node exactly like a normal installation:

```bash
git clone https://github.com/indie-master/retro-portal.git
cd retro-portal
cp .env.example .env
./scripts/install-emulatorjs.sh 4.2.3
docker compose up -d --build
```

A dedicated hostname such as `origin.arcade.example.com` is recommended. Prefer a private VLAN/WireGuard/Tailscale path from edges to origin. If the public Internet is used, keep HTTPS verification enabled and restrict the origin with firewall rules where possible.

## Edge node

```bash
git clone https://github.com/indie-master/retro-portal.git
cd retro-portal
cp .env.edge.example .env.edge
```

Configure:

```ini
EDGE_BIND_ADDR=127.0.0.1
EDGE_PORT=8088
CONTROL_ORIGIN_SCHEME=https
CONTROL_ORIGIN_HOST=origin.arcade.example.com
CONTROL_ORIGIN_PORT=443
EDGE_MEMORY_LIMIT=384m
EDGE_CPU_LIMIT=1.0
```

Then:

```bash
./scripts/install-emulatorjs.sh 4.2.3
docker compose --env-file .env.edge -f docker-compose.edge.yml up -d --build
curl -i http://127.0.0.1:8088/healthz
```

The edge does not run the Retro Portal backend or store the admin token.

## Replicating library payload

On the control node:

```bash
cp cluster/nodes.example cluster/nodes.conf
./scripts/cluster-sync.sh --dry-run
./scripts/cluster-sync.sh
```

Inventory format:

```text
edge-1|retro@203.0.113.11|/opt/retro-portal
edge-2|retro@203.0.113.12|/opt/retro-portal
```

Only ROMs, BIOS files, user artwork/screenshots and optionally EmulatorJS runtime are synchronized. `.env`, admin tokens, mutable catalog data and credentials are never copied. SSH/rsync uses normal host-key verification.

One node only:

```bash
./scripts/cluster-sync.sh --node edge-2
```

## Load balancer / CDN

A front proxy may distribute all player traffic across healthy edges. Sticky sessions are not required because edge nodes proxy API and WebSocket traffic back to the centralized control origin.

Typical cache targets:

- `/emulatorjs/`;
- `/roms/` when appropriate for your library policy;
- `/covers/`;
- `/screenshots/`;
- CSS/JS/images.

Do not long-cache `/api/`, `/ws/`, `/admin.html` or `/healthz`. Keep Range requests for large game files and WebSocket Upgrade support on the front proxy/CDN.

## Updating

Control node:

```bash
./scripts/update.sh --mode standalone
```

One edge:

```bash
./scripts/update.sh --mode edge
```

All configured edges from the control node:

```bash
./scripts/cluster-update.sh --dry-run
./scripts/cluster-update.sh
```

The updater requires a clean Git work tree, uses `git pull --ff-only`, rebuilds/recreates containers, checks local `/healthz`, and rolls code/containers back to the previous commit if the new deployment cannot become healthy.

Recommended rolling order:

1. update control/origin;
2. verify API/player;
3. update one canary edge;
4. verify game launch through it;
5. update remaining edges;
6. run `cluster-sync.sh` if library/runtime payload changed.

## Adding/removing edges

To add an edge: clone, create `.env.edge`, install runtime, start the edge compose file, sync payload, verify `/healthz`, then add it to the LB/CDN pool.

To remove an edge: drain/remove it from the LB/CDN first, then run:

```bash
docker compose --env-file .env.edge -f docker-compose.edge.yml down
```

Other edges and the control node are unaffected.

## State model

The current scale-out design intentionally keeps one writer/control plane for Library Manager, mutable catalog, launch statistics and online presence. This keeps consistency simple while distributing the bandwidth-heavy work. A future backend-HA design could move state into shared database/Redis/object storage if required.

## Security notes

- never copy `ADMIN_TOKEN` or control `.env` to edges;
- prefer private networking or firewall-restricted origin access;
- use HTTPS with verification for edge → origin over the Internet;
- keep `cluster/nodes.conf` out of Git;
- use SSH keys and host-key verification;
- use a separate admin hostname/IP allowlist/VPN for larger deployments;
- roll updates through a canary edge first.
