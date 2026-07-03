import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts"))
from common import format_timestamp, parse_timestamp, slugify, youtube_id  # noqa: E402


class TestParseTimestamp:
    @pytest.mark.parametrize("ts,expected", [
        ("00:00", 0),
        ("05:12", 312),
        ("1:02:03", 3723),
        (" 12:34 ", 754),
    ])
    def test_valid(self, ts, expected):
        assert parse_timestamp(ts) == expected

    @pytest.mark.parametrize("ts", ["", "12", "1:2:3:4", "ab:cd", "05:70", "-1:00", "1:60:00"])
    def test_invalid(self, ts):
        with pytest.raises(ValueError):
            parse_timestamp(ts)


class TestFormatTimestamp:
    @pytest.mark.parametrize("sec,expected", [
        (0, "00:00"),
        (312, "05:12"),
        (3723, "1:02:03"),
    ])
    def test_roundtrip(self, sec, expected):
        assert format_timestamp(sec) == expected
        assert parse_timestamp(expected) == sec

    def test_negative(self):
        with pytest.raises(ValueError):
            format_timestamp(-1)


class TestSlugify:
    def test_basic(self):
        assert slugify("Long-Lived Agents: What Changes?") == "long-lived-agents-what-changes"

    def test_truncates_on_boundary(self):
        assert slugify("a" * 10 + " b", max_len=10) == "a" * 10

    def test_empty_fallback(self):
        assert slugify("Долгоживущие агенты") == "item"  # кириллица выпадает — есть fallback


class TestYoutubeId:
    @pytest.mark.parametrize("url", [
        "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        "https://www.youtube.com/watch?list=x&v=dQw4w9WgXcQ",
        "https://youtu.be/dQw4w9WgXcQ",
        "https://www.youtube.com/shorts/dQw4w9WgXcQ",
    ])
    def test_extracts(self, url):
        assert youtube_id(url) == "dQw4w9WgXcQ"

    def test_not_youtube(self):
        assert youtube_id("https://vimeo.com/12345") is None
