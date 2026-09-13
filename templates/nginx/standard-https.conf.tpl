# Managed by Retro Portal installer.
server { listen 80; listen [::]:80; server_name {{DOMAIN}}; location ^~ /.well-known/acme-challenge/ { root {{ACME_ROOT}}; default_type text/plain; } location / { return 301 https://$host$request_uri; } }
server {
    listen 443 ssl; listen [::]:443 ssl; server_name {{DOMAIN}};
    ssl_certificate {{CERT_PATH}}; ssl_certificate_key {{KEY_PATH}}; ssl_session_cache shared:RETROPORTAL:10m; ssl_session_timeout 1d; ssl_protocols TLSv1.2 TLSv1.3;
    location /ws/ { proxy_pass http://127.0.0.1:{{APP_PORT}}; proxy_http_version 1.1; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; proxy_set_header X-Forwarded-Proto https; proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection "upgrade"; proxy_read_timeout 3600s; proxy_send_timeout 3600s; proxy_buffering off; }
    location / { proxy_pass http://127.0.0.1:{{APP_PORT}}; proxy_http_version 1.1; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; proxy_set_header X-Forwarded-Proto https; }
}
