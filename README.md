# LLM Datacenter

Ежедневная сводка-дашборд новостей об LLM: анонсы функций ведущих моделей из официальных блогов, реакции сообщества и экспертов, конспекты статей и видео, ранжирование по масштабу инновации.

## Как здесь всё устроено
- Метод работы над проектом — `CONVENTIONS.md`.
- Карта для агентов и правила — `AGENTS.md` (+ `CLAUDE.md` импортирует его).
- Актуальное состояние системы — `docs/features/*`; архитектура и инварианты — `docs/architecture.md`; решения — `docs/decisions.md`; журнал требований — `docs/requirements/`.

## Разработка
```
python -m http.server 8000 -d docs   # локальный просмотр дашборда
ruff check . && pytest tests/unit    # минимум перед коммитом
pytest tests/integration             # сетевые/интеграционные тесты (нужны ключи API)
```

## Практики
Проект использует общий набор практик из плагина `riplio-workflow` (marketplace `claude-practices`). Обновить практики: `/plugin marketplace update claude-practices` + `/sync-practices`.
