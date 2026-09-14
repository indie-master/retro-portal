#!/bin/sh
set -eu

: "${CONTROL_ORIGIN_HOST:?CONTROL_ORIGIN_HOST is required}"
: "${CONTROL_ORIGIN_SCHEME:=https}"
: "${CONTROL_ORIGIN_PORT:=443}"

case "$CONTROL_ORIGIN_SCHEME" in
  http|https) ;;
  *) echo "Unsupported CONTROL_ORIGIN_SCHEME: $CONTROL_ORIGIN_SCHEME" >&2; exit 2;;
esac

case "$CONTROL_ORIGIN_PORT" in
  *[!0-9]*|'') echo "Invalid CONTROL_ORIGIN_PORT: $CONTROL_ORIGIN_PORT" >&2; exit 2;;
esac

case "$CONTROL_ORIGIN_HOST" in
  *[!A-Za-z0-9._-]*|'') echo "Invalid CONTROL_ORIGIN_HOST: $CONTROL_ORIGIN_HOST" >&2; exit 2;;
esac

envsubst '${CONTROL_ORIGIN_SCHEME} ${CONTROL_ORIGIN_HOST} ${CONTROL_ORIGIN_PORT}' \
  < /etc/nginx/templates/default.conf.template \
  > /tmp/retro-portal-edge.conf

exec nginx -c /etc/nginx/edge-nginx.conf -g 'daemon off;'
