# Retro Portal

<p align="center">
  <strong>Ламповая self-hosted библиотека ретро-игр, которая запускается прямо в браузере.</strong><br>
  Реальные обложки ваших игр · EmulatorJS · ROM на сервере · локальный ROM-плеер · WebSocket presence · Docker · безопасная интеграция с Nginx
</p>

<p align="center">
  <img alt="License MIT" src="https://img.shields.io/badge/license-MIT-d99a47">
  <img alt="Ubuntu" src="https://img.shields.io/badge/Ubuntu-22.04%20%7C%2024.04-E95420?logo=ubuntu&logoColor=white">
  <img alt="Docker" src="https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white">
  <img alt="EmulatorJS" src="https://img.shields.io/badge/EmulatorJS-4.2.3-a9d56f">
  <img alt="Dreamcast experimental" src="https://img.shields.io/badge/Dreamcast-experimental-76b7c8">
</p>

<p align="center">
  <a href="README_EN.md">English</a> ·
  <a href="docs/ru/INSTALL.md">Установка</a> ·
  <a href="docs/ru/NGINX.md">Nginx / TLS</a> ·
  <a href="docs/ru/ROMS.md">Игры и обложки</a> ·
  <a href="docs/ru/DREAMCAST.md">Dreamcast</a> ·
  <a href="docs/ru/TROUBLESHOOTING.md">Диагностика</a>
</p>

![Retro Portal](docs/images/banner.svg)

![Главная страница](docs/images/home.svg)

### Локальный ROM-плеер

![Local ROM](docs/images/local-rom.svg)

## Что это

Retro Portal превращает VPS, мини-ПК или домашний сервер в личную браузерную ретро-библиотеку. Сайт, ROM-файлы, обложки и EmulatorJS хранятся у вас, а эмуляция выполняется на устройстве игрока через WebAssembly.

Серверу не нужен GPU. Для небольшой библиотеки достаточно недорогой Ubuntu-машины: основная нагрузка — раздача файлов, API каталога и постоянная WebSocket-сессия.

## Что уже умеет

- тёплый интерфейс в стиле домашнего ретро-уголка с лёгкими 8-bit акцентами;
- библиотека с реальными box-art обложками и опциональным игровым screenshot при наведении;
- отдельные полки по платформам, поиск и фильтр **«На двоих»**;
- запуск ROM, размещённых на сервере, одной кнопкой;
- локальный запуск своего ROM без отправки файла на сервер;
- self-hosted EmulatorJS `4.2.3`;
- Mega Drive / Genesis, NES, SNES, GB/GBC, GBA, PS1, N64, Arcade и другие системы EmulatorJS;
- browser-side SRAM / save states;
- WebSocket presence: online, playing now, heartbeat, reconnect;
- Docker Compose;
- четыре режима установки: полный автомат, существующий Nginx, ручная интеграция, локальный тест;
- обнаружение `stream :443 + ssl_preread`, PROXY protocol и внутренних TLS-vhost;
- переиспользование подходящего wildcard/SAN сертификата;
- Let's Encrypt HTTP-01 и Cloudflare DNS-01;
- backup + обязательный `nginx -t` перед reload;
- curated presets для популярных Mega Drive / PS1 / Dreamcast игр **без распространения ROM/BIOS/artwork**;
- экспериментальная подготовка каталога под Dreamcast / Flycast WASM.

## Требования

| Ресурс | Минимум | Рекомендуется |
|---|---:|---:|
| ОС | Ubuntu 22.04 / 24.04 x64/arm64 | Ubuntu 24.04 LTS |
| CPU | 1 vCPU | 2 vCPU |
| RAM | 1 GB | 2 GB |
| Диск | 15–20 GB | 40+ GB NVMe |
| Сеть | 100 Mbps | 1 Gbps |
| GPU | не нужен | не нужен |

Для Mega Drive/NES/SNES нагрузка на VPS минимальна. Для PS1 и особенно будущей Dreamcast-библиотеки важнее объём диска и скорость отдачи больших образов.

## Быстрый старт

```bash
sudo apt update
sudo apt install -y git

git clone https://github.com/indie-master/retro-portal.git retro-portal
cd retro-portal
sudo ./scripts/install.sh
```

Установщик предложит:

```text
1) Full automatic setup   Docker + Nginx + TLS
2) Existing Nginx         анализ и безопасная интеграция
3) Manual integration     приложение + готовые snippets
4) Local test             быстрый тест без домена/TLS
```

Подробная пошаговая инструкция: [docs/ru/INSTALL.md](docs/ru/INSTALL.md).

## Быстрый тест с открытыми играми

```bash
./scripts/install-emulatorjs.sh 4.2.3
./scripts/install-homebrew-roms.sh
docker compose up -d --build
```

После этого в библиотеке появятся тестовые Mega Drive homebrew-игры из открытого проекта `retro-homebrew-games`.

## Своя библиотека: Sonic, Mortal Kombat, Tekken и другие

Retro Portal **не содержит коммерческих ROM, BIOS или официальных обложек**. Вместо этого в `catalog/presets/curated-classics.json` лежат готовые метаданные и ожидаемые имена файлов для выбранной стартовой коллекции.

Например, для Sonic 2:

```text
games/roms/megadrive/sonic-the-hedgehog-2.bin
public/covers/library/sonic-the-hedgehog-2.webp
public/screenshots/library/sonic-the-hedgehog-2.webp   # необязательно
```

После добавления собственных файлов:

```bash
./scripts/sync-classics.sh
```

Скрипт добавляет в рабочий каталог **только те игры, для которых реально найдены ROM + обложка + требуемый BIOS**. Поэтому карточка никогда не показывает «левую» обложку от другой игры.

Преднастроены метаданные для:

**Mega Drive:** Sonic the Hedgehog 2, Mortal Kombat II, Streets of Rage 2, Comix Zone, Road Rash 3, Contra: Hard Corps.

**PlayStation:** Tekken 3, Crash Bandicoot 3, Crash Team Racing, Tony Hawk's Pro Skater 2, Resident Evil 2, Worms Armageddon.

**Dreamcast (experimental):** Crazy Taxi, Soulcalibur, Sonic Adventure, Jet Set Radio.

Подробнее: [docs/ru/ROMS.md](docs/ru/ROMS.md).

## Nginx без риска для существующей конфигурации

Перед изменениями установщик выполняет `nginx -T`, определяет топологию и не пытается вслепую переписывать сложные vhost.

Обычная схема:

```text
Internet :443
   ↓
Nginx HTTPS
   ↓
127.0.0.1:8088 → Retro Portal
```

Схема со `stream`:

```text
Internet :443
   ↓
Nginx stream + ssl_preread
   ↓ SNI
127.0.0.1:8443 HTTPS
   ↓
127.0.0.1:8088 → Retro Portal
```

Если автоматическая правка небезопасна, installer генерирует готовые snippets вместо изменения рабочего конфига. Подробнее: [docs/ru/NGINX.md](docs/ru/NGINX.md).

## Сертификаты

`--tls auto` сначала пытается найти уже существующий сертификат, покрывающий выбранный hostname. Проверяются SAN/wildcard, срок действия и соответствие private key. Если сертификата нет, доступны HTTP-01, Cloudflare DNS-01 или собственные пути к cert/key.

Пример:

```bash
sudo ./scripts/install.sh \
  --mode existing \
  --domain arcade.example.com \
  --tls auto
```

## Полезные команды

```bash
./scripts/doctor.sh --domain arcade.example.com
sudo ./scripts/nginx-detect.sh arcade.example.com
./scripts/catalog-check.py
./scripts/sync-classics.sh
./scripts/backup.sh
docker compose logs -f --tail=100
```

## Dreamcast

Dreamcast в EmulatorJS официально не входит в стандартный список систем. Проект `flycast-wasm` в 2026 году добавил рабочий браузерный Flycast core, но интеграция остаётся более молодой и экспериментальной, чем Mega Drive/PS1. Поэтому Retro Portal уже понимает Dreamcast-метаданные и BIOS-набор, но **не включает Dreamcast runtime по умолчанию и не выдаёт его за production-ready**.

Текущее состояние и план интеграции: [docs/ru/DREAMCAST.md](docs/ru/DREAMCAST.md).

## Правовой момент

Retro Portal — программная оболочка. Репозиторий не распространяет коммерческие ROM, BIOS или официальные artwork. Пользователь самостоятельно отвечает за право использования добавленного контента.

## Лицензия

Код Retro Portal распространяется по MIT. Сторонние компоненты имеют собственные лицензии — см. [THIRD_PARTY.md](THIRD_PARTY.md).
