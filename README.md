# Retro Portal

<p align="center"><strong>Self-hosted библиотека ретро-игр с запуском прямо в браузере.</strong></p>

<p align="center">
  <a href="https://indie-master.github.io/retro-portal/"><strong>🎮 ОТКРЫТЬ LIVE DEMO</strong></a>
  &nbsp;·&nbsp; <a href="README_EN.md">English</a>
  &nbsp;·&nbsp; <a href="docs/ru/INSTALL.md">Установка</a>
  &nbsp;·&nbsp; <a href="docs/ru/LIBRARY.md">Library Manager</a>
  &nbsp;·&nbsp; <a href="SECURITY.md">Безопасность</a>
</p>

<p align="center">
  <a href="LICENSE"><img alt="MIT License" src="https://img.shields.io/badge/license-MIT-d99a47"></a>
  <a href="https://ubuntu.com/server"><img alt="Ubuntu Server" src="https://img.shields.io/badge/Ubuntu-22.04%20%7C%2024.04-E95420?logo=ubuntu&logoColor=white"></a>
  <a href="https://docs.docker.com/engine/"><img alt="Docker Engine" src="https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white"></a>
  <a href="https://emulatorjs.org/"><img alt="EmulatorJS" src="https://img.shields.io/badge/EmulatorJS-4.2.3-a9d56f"></a>
  <a href="CHANGELOG.md"><img alt="Version" src="https://img.shields.io/badge/version-0.8.0-71cde2"></a>
</p>

![Главная страница Retro Portal](docs/images/home.png)

## Что это

Retro Portal превращает VPS, мини‑ПК или домашний сервер в аккуратную браузерную библиотеку ретро‑игр. Игрок открывает сайт, выбирает игру и нажимает **Играть** — эмуляция запускается на его устройстве в браузере.

Проект рассчитан на нормальную повседневную эксплуатацию: библиотека, поиск, фильтры, сохранения, клавиатура и геймпад, текущая активность, статистика запусков и отдельная админ‑панель для владельца.

## Возможности

- запуск игр прямо в браузере через EmulatorJS;
- Mega Drive, PlayStation, NES, SNES, Game Boy, GBA, Nintendo 64 и Arcade;
- экспериментальная поддержка Dreamcast;
- поиск, платформенные полки, избранное и фильтр игр на двоих;
- собственная раскладка клавиатуры для одной игры или всей платформы;
- поддержка геймпада;
- локальный запуск собственного ROM без отправки файла на сервер;
- online presence, блок «Во что играют сейчас» и популярность за 7 дней;
- Library Manager для ROM, BIOS, карточек игр и публикации;
- автоматические предложения метаданных из TheGamesDB/Wikipedia с подтверждением владельцем;
- Docker Compose, Nginx и несколько сценариев установки.

## Live Demo

**https://indie-master.github.io/retro-portal/**

Публичная сборка содержит только свободно распространяемые demo/homebrew ROM. Блок активности заполнен демонстрационными данными, чтобы можно было увидеть весь интерфейс в рабочем виде. В self-hosted установке те же блоки получают данные от встроенного backend.

## Интерфейс владельца

Library Manager доступен по `/admin.html` и позволяет управлять коллекцией без постоянной работы через консоль:

- загрузка ROM и BIOS;
- сканирование библиотеки после SCP/SFTP;
- проверка готовности игры к запуску;
- редактирование названия, описания, истории и порядка сортировки;
- featured/visibility;
- получение и подтверждение метаданных.

![Library Manager / админ-панель](docs/images/admin.png)

Подробно: **[docs/ru/LIBRARY.md](docs/ru/LIBRARY.md)**.

## Быстрый старт

### Вариант 1 — интерактивная установка

```bash
sudo apt update
sudo apt install -y git
git clone https://github.com/indie-master/retro-portal.git
cd retro-portal
sudo ./scripts/install.sh
```

Установщик поддерживает автоматическую установку, интеграцию в существующий Nginx, ручной режим и локальный тест.

### Вариант 2 — Docker Compose

Если Docker Engine/Compose и reverse proxy уже настроены:

```bash
git clone https://github.com/indie-master/retro-portal.git
cd retro-portal
cp .env.example .env
./scripts/install-emulatorjs.sh 4.2.3
docker compose build --pull
docker compose up -d
curl -i http://127.0.0.1:8088/healthz
```

По умолчанию приложение удобно держать на `127.0.0.1:8088`, а HTTPS завершать на host Nginx/Caddy/Traefik.

Полная инструкция: **[docs/ru/INSTALL.md](docs/ru/INSTALL.md)**.

## Как устроено

```text
Браузер игрока
  ├─ HTML / CSS / JS
  ├─ EmulatorJS runtime / WASM
  ├─ ROM / BIOS для выбранной игры
  └─ WebSocket presence
          ↓
      Reverse proxy
          ↓
      Retro Portal
      ├─ web
      ├─ API
      ├─ каталог
      ├─ статистика
      └─ Library Manager
```

После загрузки ROM и runtime сама эмуляция идёт на устройстве игрока. Сервер отвечает за web‑интерфейс, файлы библиотеки, API, presence и административные функции.

Сетевые endpoint'ы, кеширование и reverse proxy: **[docs/ru/NETWORKING.md](docs/ru/NETWORKING.md)**.

## Управление

По умолчанию используется привычная desktop‑раскладка:

```text
Стрелки     движение
Z / X       основные действия
A / S / D   дополнительные кнопки
Q / W       плечевые кнопки
Enter       Start
Shift       Select / Mode
```

Раскладку можно изменить прямо на странице игры и сохранить отдельно для конкретной игры или всей платформы.

## Активность

Self-hosted версия считает активные браузерные сессии через WebSocket и хранит историю запусков для недельного рейтинга. Несколько вкладок одного браузера используют общий локальный session ID, поэтому счётчик остаётся ближе к числу реальных посетителей, а не количеству открытых вкладок.

## Безопасность

Проект использует защиту в несколько слоёв:

- admin API защищён `ADMIN_TOKEN` и throttling от перебора;
- ROM/BIOS upload ограничен allowlist'ами форматов и размером;
- небезопасные имена файлов не используются как server-side пути;
- ZIP upload выключен по умолчанию;
- metadata fetch ограничен доверенными источниками;
- backend работает non-root, с read-only root filesystem, `no-new-privileges` и без Linux capabilities;
- Nginx добавляет CSP, anti-clickjacking, security headers и rate limits;
- CI запускает syntax/config checks, `npm audit` и CodeQL.

Полный threat model и рекомендации по публикации в Интернет: **[SECURITY.md](SECURITY.md)**.

## Документация

| Раздел | Документ |
|---|---|
| Установка | [docs/ru/INSTALL.md](docs/ru/INSTALL.md) |
| Library Manager | [docs/ru/LIBRARY.md](docs/ru/LIBRARY.md) |
| Nginx / TLS | [docs/ru/NGINX.md](docs/ru/NGINX.md) |
| Сеть и reverse proxy | [docs/ru/NETWORKING.md](docs/ru/NETWORKING.md) |
| ROM / BIOS | [docs/ru/ROMS.md](docs/ru/ROMS.md) |
| Dreamcast | [docs/ru/DREAMCAST.md](docs/ru/DREAMCAST.md) |
| Диагностика | [docs/ru/TROUBLESHOOTING.md](docs/ru/TROUBLESHOOTING.md) |
| Безопасность | [SECURITY.md](SECURITY.md) |
| Сторонние компоненты | [THIRD_PARTY.md](THIRD_PARTY.md) |

## Компоненты

- [EmulatorJS](https://emulatorjs.org/) — браузерная эмуляция;
- [Docker Engine / Compose](https://docs.docker.com/engine/) — контейнеризация;
- [Nginx](https://nginx.org/) — web/reverse proxy;
- [TheGamesDB](https://thegamesdb.net/) — опциональные игровые метаданные;
- [MediaWiki API](https://www.mediawiki.org/wiki/API:Main_page) — опциональная история игр.

## ROM и BIOS

Коммерческие ROM, BIOS и официальные artwork не входят в репозиторий. Пользователь добавляет собственные файлы самостоятельно. В публичном demo используются только ROM, разрешённые к распространению.

## Лицензия

Код Retro Portal распространяется по [MIT License](LICENSE).
