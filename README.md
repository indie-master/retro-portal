# Retro Portal

<p align="center"><strong>Ламповая self-hosted библиотека ретро-игр: владелец собирает коллекцию, игроки просто нажимают «Играть».</strong></p>

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
  <a href="SECURITY.md"><img alt="Security" src="https://img.shields.io/badge/security-hardened-7ddc78"></a>
</p>

![Главная страница Retro Portal](docs/images/home.png)

## Что это

Retro Portal превращает Ubuntu VPS, мини‑ПК или домашний сервер в личную браузерную библиотеку ретро‑игр.

```text
Игрок
  ↓
/                     → только готовые к запуску игры
/game.html?id=...      → игра + удобная раскладка клавиатуры
/local.html            → свой ROM остаётся в браузере

Владелец
  ↓
/admin.html             → ROM, BIOS, карточки, описания, публикация
```

Публичный игрок **никогда не видит** сообщений «нужен BIOS», путей к файлам или серверной кухни. Игра появляется на главной только когда ROM, обязательный BIOS и runtime готовы.

## Что нового в 0.8.0

- собственный слой настройки клавиатуры поверх EmulatorJS;
- профили управления для Mega Drive, PlayStation, NES/SNES, GB/GBA, N64 и Arcade;
- раскладка сохраняется для одной игры или сразу для всей платформы;
- настоящий online-presence по уникальным браузерным сессиям, а не по количеству вкладок;
- «Во что играют сейчас» и «Популярно за 7 дней» строятся по **реальным** запускам;
- автоматический подбор сюжета/описания и короткой истории игры;
- новые метаданные сначала попадают в очередь владельцу: **Принять / Отклонить**;
- редактирование карточек, публикации и featured‑статуса прямо из `/admin.html`;
- загрузки ROM/BIOS усилены allowlist‑проверками, лимитами и безопасными именами;
- ZIP upload выключен по умолчанию;
- metadata fetch разрешён только с фиксированных доверенных источников;
- контейнер backend работает non-root, read-only, без Linux capabilities и с `no-new-privileges`;
- CSP, anti-clickjacking, rate limits и дополнительные HTTP security headers.

## Online и популярность

Счётчик на self-hosted портале настоящий. Браузер получает случайный локальный session ID, поэтому несколько вкладок одного браузера не раздувают online.

Retro Portal **не подделывает** востребованность. Если сейчас никто не играет, интерфейс честно показывает тишину. После реальных запусков появляется рейтинг за 7 дней. GitHub Pages demo явно помечает отсутствие backend-статистики как demo-режим.

## Управление с клавиатуры

EmulatorJS официально поддерживает собственные default controls через `EJS_defaultControls`; Retro Portal добавляет поверх этого удобный интерфейс. Нажмите **⌨ Клавиши** на странице игры, кликните по действию и нажмите желаемую клавишу.

По умолчанию:

```text
Стрелки     движение
Z / X       основные действия
A / S / D   дополнительные кнопки
Q / W       плечевые кнопки
Enter       Start
Shift       Select / Mode
```

Настройки хранятся локально в браузере и могут быть сохранены для конкретной игры либо платформы.

Официальная документация EmulatorJS: https://emulatorjs.org/docs4devs/control-mapping/

## Library Manager

Откройте:

```text
https://ваш-домен/admin.html
```

Из кабинета можно:

- загрузить ROM;
- загрузить и проверить BIOS;
- просканировать большую библиотеку после SCP/SFTP;
- увидеть, чего не хватает конкретной игре;
- отредактировать название, описание, историю, количество игроков и сортировку;
- сделать игру избранной или скрыть её;
- запросить автоматические метаданные;
- принять или отклонить предложенное описание/историю/обложку.

После установки для повседневного управления консоль не нужна.

Подробно: **[docs/ru/LIBRARY.md](docs/ru/LIBRARY.md)**.

## Автоматические описания и история

Логика специально разделена на **поиск** и **публикацию**.

1. Retro Portal распознаёт игру по ROM/preset.
2. Если задан `THEGAMESDB_API_KEY`, backend предлагает название, год, игроков, overview и box-art из TheGamesDB.
3. Отдельно можно получить короткий исторический контекст через публичный Wikipedia API.
4. Текст очищается и ограничивается по длине.
5. Ничего из найденного не публикуется автоматически — карточка получает `pendingMetadata`.
6. Владелец нажимает **Принять** или **Отклонить**.

```ini
THEGAMESDB_API_KEY=your-key
WIKIPEDIA_METADATA=1
```

## Безопасность ROM upload

ROM загружает **только администратор**. Пользовательская кнопка «Свой ROM» работает локально через browser Object URL и не отправляет файл на сервер.

Защита server-side upload включает:

- allowlist расширений для каждой платформы;
- лимит размера;
- безопасное серверное имя на основе SHA-256;
- проверку сигнатур для форматов, где она надёжно определима;
- запрет browser-upload многофайловых CUE/GDI — для них используется SCP/SFTP + scan;
- ZIP по умолчанию отключён;
- BIOS PS1 может распознаваться по известному MD5;
- ROM никогда не запускается как программа на backend;
- контейнер backend не имеет Linux capabilities;
- metadata/cover download не принимает произвольные URL;
- admin auth имеет защиту от перебора.

Это существенно уменьшает поверхность атаки, но ни один веб‑сервис нельзя честно назвать «невзламываемым». Полный threat model и рекомендации: **[SECURITY.md](SECURITY.md)**. Практики file upload сверены с рекомендациями OWASP.

## Быстрый старт

```bash
sudo apt update
sudo apt install -y git
git clone https://github.com/indie-master/retro-portal.git
cd retro-portal
sudo ./scripts/install.sh
```

Установщик предлагает:

```text
1) Полная автоматическая установка
2) Интеграция в существующий Nginx
3) Ручная интеграция — приложение + snippets
4) Локальный тест без домена и TLS
```

Подробно: [docs/ru/INSTALL.md](docs/ru/INSTALL.md).

## Конфигурация безопасности

```ini
# Browser upload архивов выключен по умолчанию
ALLOW_ZIP_ROMS=0

# Короткая история из Wikipedia proposal
WIKIPEDIA_METADATA=1

# Максимальный upload, по умолчанию 2 GiB
MAX_UPLOAD_BYTES=2147483648
```

## Требования

| Ресурс | Минимум | Рекомендуется |
|---|---:|---:|
| Ubuntu | 22.04 | 24.04 LTS |
| CPU | 1 vCPU | 2 vCPU |
| RAM | 1 GB | 2 GB |
| Диск | 20 GB | 40+ GB NVMe |
| Сеть | 100 Mbps | 1 Gbps |
| GPU | не нужен | не нужен |

Эмуляция выполняется на устройстве игрока, поэтому GPU серверу не нужен.

## Компоненты

- **EmulatorJS** — браузерные cores и эмуляция: https://emulatorjs.org/
- **Docker Engine / Compose** — контейнеризация: https://docs.docker.com/engine/
- **Nginx** — web/reverse proxy: https://nginx.org/
- **TheGamesDB** — опциональные игровые метаданные: https://thegamesdb.net/
- **MediaWiki API / Wikipedia** — опциональный исторический контекст: https://www.mediawiki.org/wiki/API:Main_page

Лицензии сторонних компонентов перечислены в [THIRD_PARTY.md](THIRD_PARTY.md).

## Live Demo

**https://indie-master.github.io/retro-portal/**

GitHub Pages содержит только легально распространяемые demo/homebrew ROM. Коммерческие ROM, BIOS и официальные artwork не входят в репозиторий.

## Лицензия

Код Retro Portal распространяется по [MIT License](LICENSE).
