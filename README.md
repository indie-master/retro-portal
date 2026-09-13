# Retro Portal

<p align="center"><strong>Ламповая self-hosted библиотека ретро-игр, которая запускается прямо в браузере.</strong></p>

<p align="center">
  <a href="https://indie-master.github.io/retro-portal/"><strong>🎮 ОТКРЫТЬ LIVE DEMO</strong></a>
  &nbsp;·&nbsp; <a href="README_EN.md">English</a>
  &nbsp;·&nbsp; <a href="docs/ru/INSTALL.md">Установка</a>
  &nbsp;·&nbsp; <a href="docs/ru/ROMS.md">Игры и обложки</a>
  &nbsp;·&nbsp; <a href="docs/ru/NGINX.md">Nginx / TLS</a>
</p>

<p align="center">
  <img alt="MIT" src="https://img.shields.io/badge/license-MIT-d99a47">
  <img alt="Ubuntu" src="https://img.shields.io/badge/Ubuntu-22.04%20%7C%2024.04-E95420?logo=ubuntu&logoColor=white">
  <img alt="Docker" src="https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white">
  <img alt="EmulatorJS" src="https://img.shields.io/badge/EmulatorJS-4.2.3-a9d56f">
</p>

![Главная страница Retro Portal](docs/images/home.png)

### Локальный ROM-плеер

![Local ROM Player](docs/images/local-rom.png)

## Что это

Retro Portal превращает Ubuntu VPS, мини-ПК или домашний сервер в личную ретро-библиотеку. На главной находятся привычные полки Mega Drive, PlayStation, Dreamcast и отдельный раздел **Demo / Homebrew**. Если ROM уже добавлен владельцем сервера — нажмите **Играть**. Если нет — портал покажет ожидаемый путь к файлу вместо мёртвой кнопки.

Эмуляция выполняется на устройстве игрока, поэтому серверу не требуется GPU. Сервер хранит сайт, каталог, ROM/BIOS, artwork и EmulatorJS, а также обслуживает API и online-presence.

## Возможности

- тёплый CRT-интерфейс без неонового SaaS-вида;
- библиотека по платформам: **Mega Drive / PlayStation / Dreamcast / Demo**;
- 16 заранее подготовленных карточек известных игр и шесть легально распространяемых demo-ROM;
- user-supplied box-art и gameplay screenshots;
- явные состояния **Играть / Добавить ROM / Нужен BIOS / Experimental**;
- локальный ROM Player — выбранный файл не отправляется на сервер;
- self-hosted EmulatorJS `4.2.3` в обычной установке;
- fullscreen и Browser Gamepad API;
- browser-side сохранения / save states;
- online/playing presence;
- Docker Compose;
- интерактивная установка для чистого VPS и уже работающего Nginx;
- обнаружение `stream :443 + ssl_preread`, PROXY protocol и внутренних TLS-vhost;
- переиспользование wildcard/SAN сертификата, Let's Encrypt HTTP-01 и Cloudflare DNS-01;
- backup и обязательный `nginx -t` перед reload;
- GitHub Pages demo с тем же UI, что и production.

## Live Demo

**https://indie-master.github.io/retro-portal/**

Публичная версия показывает весь каталог. Коммерческие игры отображаются как готовые карточки под ваши собственные ROM, а отдельная секция Demo содержит шесть MIT-лицензированных Mega Drive homebrew-игр, которые можно запустить сразу.

## Требования

| Ресурс | Минимум | Рекомендуется |
|---|---:|---:|
| Ubuntu | 22.04 | 24.04 LTS |
| CPU | 1 vCPU | 2 vCPU |
| RAM | 1 GB | 2 GB |
| Диск | 20 GB | 40+ GB NVMe |
| Сеть | 100 Mbps | 1 Gbps |
| GPU | не нужен | не нужен |

## Быстрый старт

```bash
sudo apt update
sudo apt install -y git
git clone https://github.com/indie-master/retro-portal.git
cd retro-portal
sudo ./scripts/install.sh
```

Установщик предложит четыре режима:

```text
1) Полная автоматическая установка
2) Интеграция в существующий Nginx
3) Ручная интеграция — приложение + готовые snippets
4) Локальный тест без домена и TLS
```

Подробно: [docs/ru/INSTALL.md](docs/ru/INSTALL.md).

## Быстрый локальный тест

```bash
./scripts/install-emulatorjs.sh 4.2.3
./scripts/install-homebrew-roms.sh
docker compose up -d --build
```

После запуска откройте `http://127.0.0.1:8088/` через SSH-туннель или используйте режим Local Test установщика.

## Подготовленная коллекция

### Mega Drive

Sonic the Hedgehog 2 · Mortal Kombat II · Streets of Rage 2 · Comix Zone · Road Rash III · Contra: Hard Corps

### PlayStation

Tekken 3 · Crash Bandicoot 3: Warped · Crash Team Racing · Tony Hawk's Pro Skater 2 · Resident Evil 2 · Worms Armageddon

### Dreamcast — experimental

Crazy Taxi · Soulcalibur · Sonic Adventure · Jet Set Radio

Коммерческие ROM, BIOS и официальные artwork **не распространяются этим репозиторием**. Карточки и ожидаемые пути уже подготовлены. Положите собственные файлы по именам из каталога; backend сам проверит наличие файлов. Для синхронизации пользовательского artwork и presets можно выполнить:

```bash
./scripts/sync-classics.sh all
```

Подробнее: [docs/ru/ROMS.md](docs/ru/ROMS.md).

## Demo / Homebrew

В репозитории могут быть установлены шесть MIT-лицензированных тестовых ROM:

- Tank Battle
- Battle 4Tris
- Pong
- Snake Arena
- Space Shooter
- Breakout

Они вынесены в отдельную секцию и нужны для проверки реального запуска эмулятора, а не как основная витрина проекта.

## Nginx и TLS

Retro Portal не должен ломать уже работающий сервер. Установщик сначала анализирует `nginx -T`, определяет существующие listener'ы и только затем выбирает безопасный сценарий.

```text
Обычная схема:
Internet :443 → Nginx HTTPS → 127.0.0.1:8088 → Retro Portal

Сложная схема:
Internet :443 → Nginx stream + ssl_preread → inner HTTPS → Retro Portal
```

Перед reload всегда выполняется `nginx -t`. Если автоматическая интеграция небезопасна, installer создаёт готовый snippet вместо переписывания текущего конфига. Подробнее: [docs/ru/NGINX.md](docs/ru/NGINX.md).

## Полезные команды

```bash
./scripts/doctor.sh --domain arcade.example.com
sudo ./scripts/nginx-detect.sh arcade.example.com
python3 ./scripts/catalog-check.py
./scripts/sync-classics.sh all
./scripts/backup.sh
docker compose logs -f --tail=100
```

## Dreamcast

Каталог, multi-file BIOS checks и UI готовы, но Flycast WASM пока отмечен как experimental и не выдаётся за production-ready runtime. См. [docs/ru/DREAMCAST.md](docs/ru/DREAMCAST.md).

## Правовой момент

Retro Portal — программная оболочка. Репозиторий не распространяет коммерческие ROM, BIOS или официальные artwork. Пользователь самостоятельно отвечает за права на добавленный контент.

## Лицензия

Код Retro Portal распространяется по MIT. Лицензии сторонних компонентов перечислены в [THIRD_PARTY.md](THIRD_PARTY.md).
