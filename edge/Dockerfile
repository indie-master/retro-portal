FROM nginx:1.29-alpine

RUN apk add --no-cache ca-certificates gettext

COPY --chown=nginx:nginx edge/default.conf.template /etc/nginx/templates/default.conf.template
COPY --chown=nginx:nginx edge/nginx-main.conf /etc/nginx/edge-nginx.conf
COPY --chown=nginx:nginx edge/entrypoint.sh /usr/local/bin/retro-edge-entrypoint
RUN chmod 0755 /usr/local/bin/retro-edge-entrypoint

USER nginx
ENTRYPOINT ["/usr/local/bin/retro-edge-entrypoint"]
