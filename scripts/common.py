"""Общие чистые функции скриптов пайплайна. Без сети и побочных эффектов — покрыты unit-тестами."""

from __future__ import annotations

import re


def parse_timestamp(ts: str) -> int:
    """'MM:SS' или 'HH:MM:SS' -> секунды. ValueError на мусоре."""
    parts = ts.strip().split(":")
    if not 2 <= len(parts) <= 3 or not all(p.isdigit() for p in parts):
        raise ValueError(f"bad timestamp: {ts!r}")
    parts_int = [int(p) for p in parts]
    if any(p > 59 for p in parts_int[1:]):
        raise ValueError(f"bad timestamp: {ts!r}")
    seconds = 0
    for p in parts_int:
        seconds = seconds * 60 + p
    return seconds


def format_timestamp(seconds: int) -> str:
    """Секунды -> 'MM:SS' (или 'H:MM:SS' от часа и выше)."""
    if seconds < 0:
        raise ValueError("negative seconds")
    h, rem = divmod(seconds, 3600)
    m, s = divmod(rem, 60)
    return f"{h}:{m:02d}:{s:02d}" if h else f"{m:02d}:{s:02d}"


def slugify(text: str, max_len: int = 60) -> str:
    """Имя файла/папки из заголовка: латиница/цифры/дефисы."""
    slug = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return slug[:max_len].rstrip("-") or "item"


def youtube_id(url: str) -> str | None:
    """ID видео из youtube.com/watch?v=, youtu.be/, shorts/. None, если не YouTube."""
    m = re.search(
        r"(?:youtube\.com/(?:watch\?(?:.*&)?v=|shorts/|live/)|youtu\.be/)([\w-]{11})", url
    )
    return m.group(1) if m else None
