import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts"))
from build_site import build_index, index_entry  # noqa: E402


def day(date, scores, demo=False, experts=0):
    return {
        "date": date,
        "demo": demo,
        "news": [
            {"impact_score": s, "title": {"ru": f"н{s}", "en": f"n{s}"}} for s in scores
        ],
        "expert_content": [{"id": str(i)} for i in range(experts)],
    }


class TestIndexEntry:
    def test_top_title_is_max_score(self):
        entry = index_entry(day("2026-07-03", [5, 9, 7], experts=2))
        assert entry["top_title"] == {"ru": "н9", "en": "n9"}
        assert entry["news_count"] == 3
        assert entry["expert_count"] == 2

    def test_demo_flag_only_when_true(self):
        assert index_entry(day("2026-07-03", [1], demo=True))["demo"] is True
        assert "demo" not in index_entry({"date": "2026-07-03", "news": []})

    def test_empty_day(self):
        entry = index_entry({"date": "2026-07-03", "news": []})
        assert entry["news_count"] == 0
        assert entry["top_title"] == {"ru": "", "en": ""}


class TestBuildIndex:
    def _write(self, dir_, d):
        (dir_ / f"{d['date']}.json").write_text(
            json.dumps(d, ensure_ascii=False), encoding="utf-8"
        )

    def test_sorted_desc(self, tmp_path):
        for date in ["2026-07-01", "2026-07-03", "2026-07-02"]:
            self._write(tmp_path, day(date, [5]))
        index = build_index(tmp_path)
        assert [d["date"] for d in index["days"]] == ["2026-07-03", "2026-07-02", "2026-07-01"]

    def test_date_filename_mismatch_raises(self, tmp_path):
        bad = day("2026-07-01", [5])
        (tmp_path / "2026-07-02.json").write_text(json.dumps(bad), encoding="utf-8")
        with pytest.raises(ValueError, match="не совпадает"):
            build_index(tmp_path)
