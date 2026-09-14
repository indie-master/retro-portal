FROM nginx:1.29-alpine

RUN apk add --no-cache ca-certificates \
    && chown -R nginx:nginx /etc/nginx/conf.d /var/cache/nginx /var/run

COPY --chown=nginx:nginx edge/default.conf.template /etc/nginx/templates/default.conf.template

USER nginx
