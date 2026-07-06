import builtins
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts"))
import extract_frames  # noqa: E402


def block_import(monkeypatch, *names):
    """Импорт перечисленных модулей падает с ImportError (как будто не установлены)."""
    real_import = builtins.__import__

    def fake_import(name, *args, **kwargs):
        if name in names:
            raise ImportError(name)
        return real_import(name, *args, **kwargs)

    monkeypatch.setattr(builtins, "__import__", fake_import)
    for name in names:
        monkeypatch.delitem(sys.modules, name, raising=False)


class TestFfmpegExe:
    def test_path_wins(self, monkeypatch):
        monkeypatch.setattr(extract_frames.shutil, "which", lambda _: "C:/tools/ffmpeg.exe")
        assert extract_frames.ffmpeg_exe() == "C:/tools/ffmpeg.exe"

    def test_none_when_no_path_and_no_pip(self, monkeypatch):
        monkeypatch.setattr(extract_frames.shutil, "which", lambda _: None)
        block_import(monkeypatch, "imageio_ffmpeg")
        assert extract_frames.ffmpeg_exe() is None


class TestYtdlpCmd:
    def test_path_wins(self, monkeypatch):
        monkeypatch.setattr(extract_frames.shutil, "which", lambda _: "/usr/bin/yt-dlp")
        assert extract_frames.ytdlp_cmd() == ["yt-dlp"]

    def test_pip_module_fallback(self, monkeypatch):
        monkeypatch.setattr(extract_frames.shutil, "which", lambda _: None)
        monkeypatch.setitem(sys.modules, "yt_dlp", object())  # модуль «установлен»
        assert extract_frames.ytdlp_cmd() == [sys.executable, "-m", "yt_dlp"]

    def test_none_when_nothing(self, monkeypatch):
        monkeypatch.setattr(extract_frames.shutil, "which", lambda _: None)
        block_import(monkeypatch, "yt_dlp")
        assert extract_frames.ytdlp_cmd() is None
