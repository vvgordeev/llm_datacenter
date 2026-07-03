"""Билд сайта: data/ -> docs/data/.

- Пересобирает data/index.json из data/daily/*.json (дневной файл — источник истины).
- Копирует index и дневные файлы в docs/data/ (корень GitHub Pages).

Запуск из корня репо: python scripts/build_site.py
"""

from __future__ import annotations

import json
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
SITE_DATA = ROOT / "docs" / "data"


def index_entry(day: dict) -> dict:
    """Строка index.json из дневного файла: метаданные без контента."""
    news = day.get("news", [])
    top = max(news, key=lambda n: n.get("impact_score", 0), default=None)
    entry = {
        "date": day["date"],
        "news_count": len(news),
        "expert_count": len(day.get("expert_content", [])),
        "top_title": top["title"] if top else {"ru": "", "en": ""},
    }
    if day.get("demo"):
        entry["demo"] = True
    return entry


def build_index(daily_dir: Path) -> dict:
    days = []
    for path in sorted(daily_dir.glob("*.json"), reverse=True):
        day = json.loads(path.read_text(encoding="utf-8"))
        if day["date"] != path.stem:
            raise ValueError(f"{path.name}: поле date={day['date']} не совпадает с именем файла")
        days.append(index_entry(day))
    return {"days": days}


def main() -> int:
    daily = DATA / "daily"
    if not daily.is_dir():
        print(f"нет каталога {daily}", file=sys.stderr)
        return 1

    index = build_index(daily)
    (DATA / "index.json").write_text(
        json.dumps(index, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    (SITE_DATA / "daily").mkdir(parents=True, exist_ok=True)
    shutil.copy2(DATA / "index.json", SITE_DATA / "index.json")
    for path in daily.glob("*.json"):
        shutil.copy2(path, SITE_DATA / "daily" / path.name)

    print(f"index: {len(index['days'])} дней; скопировано в {SITE_DATA}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
