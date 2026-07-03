"""Конспект YouTube-видео через Gemini API (видео анализируется по URL, без скачивания).

Возвращает JSON: двуязычные тезисы, таймкоды с пометкой «демонстрация», список
моментов для извлечения кадров. Ключ — в переменной окружения GEMINI_API_KEY.

Запуск: python scripts/gemini_video.py <youtube_url> [--out file.json] [--model gemini-2.5-flash]
Без зависимостей: stdlib only (urllib).
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import parse_timestamp, youtube_id  # noqa: E402

API_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"

PROMPT = """\
Проанализируй это видео для дайджеста новостей об LLM. Верни СТРОГО JSON без markdown:

{
  "duration": "MM:SS",
  "theses": [{"ru": "тезис по-русски", "en": "the same thesis in English"}],
  "timestamps": [
    {"time": "MM:SS", "label": {"ru": "...", "en": "..."}, "demonstration": false}
  ]
}

Правила:
- theses: 3-6 ключевых тезисов, самое существенное о подходах к использованию LLM.
- timestamps: 4-8 смысловых вех видео по порядку.
- demonstration: true — только если в этот момент автор ПОКАЗЫВАЕТ что-то существенное
  для понимания (схему, диаграмму, живое демо, код на экране). Таких моментов максимум {max_frames}.
- Оба языка обязательны в каждом текстовом поле.
"""


def request_body(url: str, max_frames: int) -> dict:
    return {
        "contents": [{
            "parts": [
                {"file_data": {"file_uri": url}},
                {"text": PROMPT.replace("{max_frames}", str(max_frames))},
            ]
        }],
        "generationConfig": {
            "response_mime_type": "application/json",
            "temperature": 0.2,
        },
    }


def extract_json(response: dict) -> dict:
    """Достаёт и валидирует JSON конспекта из ответа generateContent."""
    try:
        text = response["candidates"][0]["content"]["parts"][0]["text"]
    except (KeyError, IndexError) as e:
        raise ValueError(f"неожиданный ответ Gemini: {json.dumps(response)[:400]}") from e
    data = json.loads(text)
    for ts in data.get("timestamps", []):
        ts["seconds"] = parse_timestamp(ts["time"])  # валидация + удобство для extract_frames
    if not data.get("theses"):
        raise ValueError("Gemini вернул пустые тезисы")
    return data


def summarize(url: str, model: str, max_frames: int, api_key: str) -> dict:
    req = urllib.request.Request(
        API_URL.format(model=model),
        data=json.dumps(request_body(url, max_frames)).encode(),
        headers={"Content-Type": "application/json", "x-goog-api-key": api_key},
    )
    with urllib.request.urlopen(req, timeout=300) as resp:
        return extract_json(json.load(resp))


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("url", help="YouTube URL")
    ap.add_argument("--out", type=Path, help="куда сохранить JSON (иначе stdout)")
    ap.add_argument("--model", default="gemini-2.5-flash")
    ap.add_argument("--max-frames", type=int, default=6)
    args = ap.parse_args()

    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("нет GEMINI_API_KEY в окружении", file=sys.stderr)
        return 1
    if not youtube_id(args.url):
        print(f"не похоже на YouTube URL: {args.url}", file=sys.stderr)
        return 1

    try:
        data = summarize(args.url, args.model, args.max_frames, api_key)
    except urllib.error.HTTPError as e:
        print(f"Gemini HTTP {e.code}: {e.read().decode(errors='replace')[:500]}", file=sys.stderr)
        return 2

    data["source_url"] = args.url
    out = json.dumps(data, ensure_ascii=False, indent=2)
    if args.out:
        args.out.write_text(out + "\n", encoding="utf-8")
        print(f"конспект: {args.out}")
    else:
        print(out)
    return 0


if __name__ == "__main__":
    sys.exit(main())
