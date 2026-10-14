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
        "blocked": 26,
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


def _raw_by_id():
    return {q["id"]: q for level in ("hl", "sl")
            for q in json.loads((REPO / f"src/data/raw/ib-biology-{level}.json").read_text())["questions"]}


def test_groups_follow_each_question_reviewed_subtopics_not_taxonomy_order():
    """A syllabus item belongs to several curated groups; each question takes the ones it was reviewed into."""
    generator.build(RESEARCH, REPO)
    overlay = json.loads((REPO / "src/data/ib-biology-official-subtopics/overlay.json").read_text())
    raw = _raw_by_id()
    resolved = [row for row in overlay["rows"] if not row["blocked"] and "sourceReassessment" not in row]
    assert len(resolved) == 3429
    for row in resolved:
        question = raw[row["id"]]
        names = [group["name"] for group in [row["primary"], *row["secondary"]]]
        assert set(names) <= set(question["subtopics"]), row["id"]
        assert row["primary"]["parentTopic"] == question["primaryTopic"], row["id"]
        owned = {atomic for group in [row["primary"], *row["secondary"]] for atomic in group["memberAtomicIds"]}
        assert set(row["officialAtomicIds"]) & owned, row["id"]
    # The regression this guards: 2016 ecology items resolved to "Biological molecules and water".
    food_chain = next(row for row in overlay["rows"] if row["id"] == "2022-may-tz2-hl-p1-q16")
    assert food_chain["primary"]["name"] == "Energy and matter cycles"


def test_source_reassessed_rows_are_kept_verbatim():
    before = {row["id"]: row for row in json.loads((REPO / "src/data/ib-biology-official-subtopics/overlay.json").read_text())["rows"]
              if "sourceReassessment" in row}
    generator.build(RESEARCH, REPO)
    after = {row["id"]: row for row in json.loads((REPO / "src/data/ib-biology-official-subtopics/overlay.json").read_text())["rows"]}
    assert sorted(before) == ["2019-may-tz1-sl-p1-q30", "2019-may-tz1-sl-p3-q16", "2019-may-tz2-sl-p1-q30", "2019-november-tz0-sl-p3-q2"]
    for question_id, row in before.items():
        assert after[question_id] == row
