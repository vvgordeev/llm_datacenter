# Дашборд (docs/)

Статический SPA без сборки: `docs/index.html` + `docs/assets/app.js` + `docs/assets/style.css`. Корень GitHub Pages — `docs/`.

## Как работает

- При старте грузит `data/index.json` (список дней), затем дневные `data/daily/<date>.json` по мере надобности (кэш в памяти).
- **Виды:** День (селектор даты) / Неделя / Месяц. Срезы считаются на клиенте: `aggregate()` группирует по `cluster_id`, в кластере оставляет запись с максимальным `impact_score` (при равенстве — свежайшую), сортирует по score, отдаёт топ-N (неделя 10, месяц 15).
- **Карточка новости:** impact_score с 10-сегментным индикатором (последовательная шкала одного оттенка) и тиром (1–3 minor / 4–6 notable / 7–8 major / 9–10 paradigm), теги моделей, сводка, обоснование оценки, раскрывающиеся мнения (точка-стойка: positive/skeptical/neutral) и кейсы — всё со ссылками.
- **Эксперты:** карточки статей/видео со ссылками на конспект-страницы `docs/notes/{articles,videos}/<slug>.html`.
- **Фильтры по моделям** — chips, сохраняются в localStorage, влияют только на отображение.
- **RU/EN и тёмная/светлая тема** — переключатели в шапке, localStorage (ключи `lang`, `theme`), общие со страницами конспектов. Все строки UI — словарь `I18N` в app.js; контент — двуязычные поля данных.
- **URL-параметры** для шаринга: `?view=day|week|month&date=YYYY-MM-DD&lang=ru|en&theme=dark|light`.
- Баннер «демо-данные» показывается, если хоть один загруженный день имеет `demo: true`.
- KPI-строка: число новостей, макс. impact, число сюжетов, число конспектов.

## Страницы конспектов (docs/notes/)

Отдельные HTML с общими `note.css`/`note.js`; двуязычность через `<span data-lang="ru|en">` + атрибут `data-lang-active` на `<html>`. Образцы формата: `articles/demo-article.html` (тезисы + inline-SVG схема), `videos/demo-video.html` (тезисы, таймкоды-ссылки, кадры из `docs/media/frames/<slug>/`).

## Данные

Схема дневного файла — в `.claude/skills/digest/SKILL.md` (шаг 5), модель данных — в `docs/architecture.md`. Имена тегов моделей в UI — словарь `MODEL_NAMES` в app.js, должен соответствовать `tag` в `config/sources.yaml`.

## Локальный просмотр

`python -m http.server 8000 -d docs` → http://localhost:8000 (file:// не работает — fetch).
