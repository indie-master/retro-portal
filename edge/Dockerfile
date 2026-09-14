FROM nginx:1.29-alpine

RUN apk add --no-cache ca-certificates

COPY edge/default.conf.template /etc/nginx/templates/default.conf.template

USER nginx
