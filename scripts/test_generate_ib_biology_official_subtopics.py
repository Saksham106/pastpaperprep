import hashlib
import json
from pathlib import Path

import pytest

import generate_ib_biology_official_subtopics as generator


RESEARCH = Path("/Users/sakshamgoel/Documents/ProjectsInternships/research/official-subtopics-ib-biology")
REPO = Path(__file__).resolve().parents[1]


def test_pinned_overlay_has_exact_reviewed_scope_and_taxonomy():
    result = generator.build(RESEARCH, REPO)
    assert result["counts"] == {
        "rows": 3459,
        "HL": 1911,
        "SL": 1548,
        "legacy": 2983,
        "current": 476,
        "blocked": 30,
    }
    assert result["taxonomyCounts"] == {"atomicEntries": 114, "curatedGroups": 21}


def test_generation_is_deterministic_and_preserves_non_target_source_fields():
    first = generator.build(RESEARCH, REPO)
    before = (REPO / "src/data/raw/ib-biology-hl.json").read_bytes()
    second = generator.build(RESEARCH, REPO)
    assert first["overlaySha256"] == second["overlaySha256"]
    assert first["overlayBytes"] == second["overlayBytes"]
    assert (REPO / "src/data/raw/ib-biology-hl.json").read_bytes() == before
    assert first["legacyByteIdentical"] is True
    assert first["nonBiologyUnchanged"] is True


def test_overlay_rows_are_era_routed_and_blocked_rows_have_no_labels():
    overlay = json.loads((REPO / "src/data/ib-biology-official-subtopics/overlay.json").read_text())
    assert {row["era"] for row in overlay["rows"]} == {"bio_2016", "bio_2025"}
    assert all(row["resolvedEra"] == row["era"] for row in overlay["rows"])
    assert all(row["primary"] is None and row["secondary"] == [] for row in overlay["rows"] if row["blocked"])
    assert all(row["primary"]["parentTopic"] for row in overlay["rows"] if not row["blocked"])


def test_overlay_is_safe_metadata_only():
    overlay = json.loads((REPO / "src/data/ib-biology-official-subtopics/overlay.json").read_text())
    forbidden = {"questionText", "markschemeTranscript", "questionImages", "markschemeImages", "evidence"}
    assert not forbidden.intersection(overlay)
    assert all(not forbidden.intersection(row) for row in overlay["rows"])
