import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts"))
from extract_frames import demo_timestamps  # noqa: E402
from gemini_video import extract_json  # noqa: E402


def gemini_response(payload: str) -> dict:
    return {"candidates": [{"content": {"parts": [{"text": payload}]}}]}


class TestExtractJson:
    def test_parses_and_adds_seconds(self):
        data = extract_json(gemini_response(
            '{"theses": [{"ru": "т", "en": "t"}],'
            ' "timestamps": [{"time": "05:12", "label": {"ru": "д", "en": "d"}, "demonstration": true}]}'
        ))
        assert data["timestamps"][0]["seconds"] == 312

    def test_empty_theses_rejected(self):
        with pytest.raises(ValueError, match="тезисы"):
            extract_json(gemini_response('{"theses": [], "timestamps": []}'))

    def test_malformed_response_rejected(self):
        with pytest.raises(ValueError, match="неожиданный ответ"):
            extract_json({"candidates": []})


class TestDemoTimestamps:
    def test_filters_demonstrations_and_limits(self):
        summary = {"timestamps": [
            {"time": "01:00", "seconds": 60, "demonstration": True},
            {"time": "02:00", "seconds": 120, "demonstration": False},
            {"time": "03:00", "seconds": 180, "demonstration": True},
            {"time": "04:00", "seconds": 240, "demonstration": True},
        ]}
        assert demo_timestamps(summary, limit=2) == [60, 180]

    def test_seconds_computed_when_missing(self):
        summary = {"timestamps": [{"time": "05:12", "demonstration": True}]}
        assert demo_timestamps(summary, limit=6) == [312]
