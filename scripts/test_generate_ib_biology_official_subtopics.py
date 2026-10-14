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
    assert len(resolved) == 3426
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


def test_printed_source_corrections_match_their_reviewed_values():
    import subprocess
    generator.build(RESEARCH, REPO)
    after = {row["id"]: row for row in json.loads((REPO / "src/data/ib-biology-official-subtopics/overlay.json").read_text())["rows"]}
    assert sorted(row_id for row_id, row in after.items() if "sourceReassessment" in row) == sorted(generator.CORRECTION_IDS)
    # The four #139 rows must equal the committed #139 output (an independent, hash-addressed baseline).
    baseline = json.loads(subprocess.check_output(
        ["git", "show", "76e0566248e4ef7e39ba5c7848e99ef38999cae2:src/data/ib-biology-official-subtopics/overlay.json"], cwd=REPO))
    group_ids = lambda row: [group["id"] for group in [row["primary"], *row["secondary"]]]
    without_groups = lambda row: {key: value for key, value in row.items() if key not in ("primary", "secondary")}
    reviewed = [row for row in baseline["rows"] if "sourceReassessment" in row]
    assert len(reviewed) == 4
    for row in reviewed:
        assert group_ids(after[row["id"]]) == group_ids(row)
        assert without_groups(after[row["id"]]) == without_groups(row)
    triglyceride = after["2025-may-tz3-sl-p2-q2"]
    assert triglyceride["primary"]["name"] == "Biological molecules and water" and triglyceride["secondary"] == []


def _with_corrections(tmp_path, monkeypatch, edit):
    data = json.loads(generator.CORRECTIONS_PATH.read_text())
    edit(data["corrections"])
    path = tmp_path / "corrections.json"
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")
    monkeypatch.setattr(generator, "CORRECTIONS_PATH", path)
    monkeypatch.setattr(generator, "CORRECTIONS_SHA256", generator.sha(path))
    out = tmp_path / "repo"
    (out / "src/data/raw").mkdir(parents=True)
    for level in ("hl", "sl"):
        (out / f"src/data/raw/ib-biology-{level}.json").write_bytes((REPO / f"src/data/raw/ib-biology-{level}.json").read_bytes())
    return out


@pytest.mark.parametrize("edit, message", [
    (lambda c: c[0].update(groupIds=["ib-biology.group.P2"]), "does not own"),
    (lambda c: c[0].update(officialAtomicIds=["ib-biology.bio_2025.B1.1"]), "era/level"),
    (lambda c: c[0]["sourceReassessment"].update(questionText="leak"), "schema"),
    (lambda c: c.append({**c[0], "id": "2022-may-tz2-hl-p1-q16"}), "id drift"),
])
def test_corrections_fail_closed(tmp_path, monkeypatch, edit, message):
    repo = _with_corrections(tmp_path, monkeypatch, edit)
    with pytest.raises(ValueError, match=message):
        generator.build(RESEARCH, repo)


def test_corrections_file_is_hash_pinned(tmp_path, monkeypatch):
    path = tmp_path / "corrections.json"
    path.write_text(generator.CORRECTIONS_PATH.read_text().replace("printed QP/MS verified", "edited"))
    monkeypatch.setattr(generator, "CORRECTIONS_PATH", path)
    with pytest.raises(ValueError, match="hash drift"):
        generator.build(RESEARCH, REPO)
