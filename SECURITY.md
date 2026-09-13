# Security

Please report security-sensitive problems privately to the repository owner rather than opening a public issue with exploit details.

Retro Portal does not require privileged containers. The public web container and backend are intended to bind to localhost behind a host Nginx reverse proxy in production.

Never commit TLS private keys, Cloudflare API tokens, ROM/BIOS files or other secrets to the repository.
