# Пайплайн сбора сводки

Ежедневный сбор — скилл `/digest` (`.claude/skills/digest/SKILL.md`): источники из `config/sources.yaml`, дедуп через `data/state.json`, обогащение, ранжирование по рубрике impact_score, конспекты, билд, коммит. Там же — JSON-схема дневного файла и рубрика оценки.

## Скрипты (scripts/)

| Скрипт | Что делает |
|---|---|
| `build_site.py` | Пересобирает `data/index.json` из `data/daily/*.json` и копирует всё в `docs/data/`. Падает, если `date` внутри файла не совпадает с именем файла. |
| `gemini_video.py` | Конспект YouTube-видео через Gemini API (URL передаётся напрямую, видео не скачивается). Выход: JSON с двуязычными тезисами и таймкодами, у моментов-демонстраций `demonstration: true`. Требует `GEMINI_API_KEY`. Stdlib-only. |
| `extract_frames.py` | Кадры jpg по таймкодам: yt-dlp даёт прямой URL потока (≤720p), ffmpeg вырезает по кадру. `--from-summary` берёт моменты-демонстрации из вывода gemini_video.py. Инструменты ищутся в PATH, при отсутствии — pip-пакеты `yt-dlp` и `imageio-ffmpeg` (несёт бинарник ffmpeg); совсем без них — код возврата 3 (fallback: конспект без кадров). |
| `common.py` | Чистые функции: parse/format таймкодов, slugify, youtube_id. Покрыт unit-тестами. |

## Запуск по расписанию

Облачная routine Claude Code, cron `0 5 * * *` UTC (= 8:00 GMT+3): клонирует репо → `/digest` → push. Настройка — через `/schedule`; секрет `GEMINI_API_KEY` задаётся в окружении routine. Ручной пересбор — `/digest` локально.

Ограничение облачной песочницы (по данным `data/run_log/2026-07-09.json`): egress-прокси блокирует **большинство прямых fetch** — блоги вендоров (Anthropic, OpenAI, DeepMind, Meta, xAI, Mistral, DeepSeek), агрегаторы (smol.ai, tldr.tech), hn.algolia.com и youtube.com (все — 403). Доступны: WebSearch (основной канал discovery в облаке) и Gemini API (`generativelanguage.googleapis.com`) — конспекты видео работают, Gemini получает ролик на стороне Google. Кадры из видео и полные прямые fetch доступны только в локальных прогонах (`pip install yt-dlp imageio-ffmpeg` + `GEMINI_API_KEY`).

## Состояние и данные

- `data/daily/<date>.json` — дневная сводка, append-only после публикации (инвариант 1).
- `data/state.json` — дедуп: **только опубликованные** URL (source_url новостей + конспекты) и сюжеты (rolling 60 дней). Ссылки мнений/кейсов и отклонённые кандидаты сюда не пишутся — иначе фильтр нарастающе душит сбор (наблюдалось: 24 → 7 → 2 кандидата за три дня). При пересборе за день дублями считаются только URL, виденные ДО целевой даты. Продолжение сюжета с новым содержанием — включается с тем же cluster_id, скипаются только перепечатки.
- `data/run_log/<date>.json` — отчёт о сборе: статус каждого источника (ok/blocked/empty/error), счётчики кандидатов/опубликованного/отсева, статус видео-пайплайна. По нему видно, что реально доступно из облачной песочницы. Не копируется на сайт.
- Секция `aggregators` в sources.yaml — дайджест-источники для discovery (smol.ai, TLDR AI, linkblog Willison, HN API); в сводке всегда ссылки на первоисточники.
- `docs/data/` — билд-артефакт, руками не править: перезаписывается build_site.py.
