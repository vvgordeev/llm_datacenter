"""Извлечение кадров из YouTube-видео по таймкодам (для конспектов видео).

Берёт прямой URL потока через yt-dlp (видео не скачивается целиком) и вырезает
по одному jpg на таймкод через ffmpeg. Инструменты берутся из PATH, а при их
отсутствии — из pip-пакетов yt-dlp и imageio-ffmpeg (несёт бинарник ffmpeg).

Запуск: python scripts/extract_frames.py <youtube_url> --timestamps 05:12,12:34 --out-dir docs/media/frames/my-video
Или таймкоды из конспекта gemini_video.py: --from-summary summary.json (берёт demonstration: true)
"""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import parse_timestamp  # noqa: E402


def demo_timestamps(summary: dict, limit: int) -> list[int]:
    """Секунды моментов-демонстраций из конспекта gemini_video.py."""
    out = [
        ts.get("seconds", parse_timestamp(ts["time"]))
        for ts in summary.get("timestamps", [])
        if ts.get("demonstration")
    ]
    return out[:limit]


def ffmpeg_exe() -> str | None:
    """ffmpeg из PATH, иначе бинарник pip-пакета imageio-ffmpeg, иначе None."""
    exe = shutil.which("ffmpeg")
    if exe:
        return exe
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except (ImportError, RuntimeError):
        return None


def ytdlp_cmd() -> list[str] | None:
    """Команда запуска yt-dlp: бинарник из PATH или python -m yt_dlp, иначе None."""
    if shutil.which("yt-dlp"):
        return ["yt-dlp"]
    try:
        import yt_dlp  # noqa: F401
        return [sys.executable, "-m", "yt_dlp"]
    except ImportError:
        return None


def stream_url(youtube_url: str) -> str:
    """Прямой URL видеопотока (<=720p достаточно для кадров со схемами)."""
    res = subprocess.run(
        [*ytdlp_cmd(), "-f", "best[height<=720]/bestvideo[height<=720]", "-g", youtube_url],
        capture_output=True, text=True, timeout=120,
    )
    if res.returncode != 0:
        raise RuntimeError(f"yt-dlp: {res.stderr.strip()[:400]}")
    return res.stdout.strip().splitlines()[0]


def grab_frame(stream: str, seconds: int, out_path: Path) -> None:
    res = subprocess.run(
        [ffmpeg_exe(), "-y", "-loglevel", "error", "-ss", str(seconds), "-i", stream,
         "-frames:v", "1", "-q:v", "4", str(out_path)],
        capture_output=True, text=True, timeout=180,
    )
    if res.returncode != 0 or not out_path.exists():
        raise RuntimeError(f"ffmpeg @{seconds}s: {res.stderr.strip()[:400]}")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("url", help="YouTube URL")
    ap.add_argument("--timestamps", help="список через запятую: 05:12,12:34")
    ap.add_argument("--from-summary", type=Path, help="JSON от gemini_video.py (моменты demonstration)")
    ap.add_argument("--out-dir", type=Path, required=True)
    ap.add_argument("--limit", type=int, default=6, help="максимум кадров")
    args = ap.parse_args()

    missing = [name for name, found in
               (("yt-dlp", ytdlp_cmd()), ("ffmpeg", ffmpeg_exe())) if not found]
    if missing:
        print(f"{', '.join(missing)} недоступны (PATH и pip) — кадры пропущены; "
              f"установка: python -m pip install yt-dlp imageio-ffmpeg", file=sys.stderr)
        return 3

    if args.from_summary:
        summary = json.loads(args.from_summary.read_text(encoding="utf-8"))
        seconds = demo_timestamps(summary, args.limit)
    elif args.timestamps:
        seconds = [parse_timestamp(t) for t in args.timestamps.split(",")][: args.limit]
    else:
        print("нужен --timestamps или --from-summary", file=sys.stderr)
        return 1

    if not seconds:
        print("нет моментов-демонстраций — кадры не нужны")
        return 0

    args.out_dir.mkdir(parents=True, exist_ok=True)
    stream = stream_url(args.url)
    ok = 0
    for sec in seconds:
        out_path = args.out_dir / f"{sec:06d}.jpg"
        try:
            grab_frame(stream, sec, out_path)
            ok += 1
            print(f"кадр {sec}s -> {out_path}")
        except RuntimeError as e:
            print(str(e), file=sys.stderr)

    print(f"извлечено {ok}/{len(seconds)} кадров")
    return 0 if ok else 2


if __name__ == "__main__":
    sys.exit(main())
