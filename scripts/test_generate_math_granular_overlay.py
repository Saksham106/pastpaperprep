import json
from pathlib import Path

from generate_math_granular_overlay import build_overlay, validate_overlay

REPO = Path(__file__).parents[1]
RESEARCH = REPO.parent.parent / "research" / "math-subtopic-expansion"


def test_final_decisions_are_exact_and_fail_closed():
    overlay = build_overlay(REPO, RESEARCH)
    assert overlay["schemaVersion"] == "math-granular-additive-overlay-v1"
    assert overlay["sourceHashes"]["taxonomy"]
    assert overlay["sourceHashes"]["proposedOverlay"]
    assert overlay["countsByBank"] == {
        "0606": 638,
        "ib-aa-hl": 82,
        "ib-aa-sl": 37,
        "ib-ai-hl": 21,
        "ib-ai-sl": 35,
    }
    assert overlay["countsByLabel"]["0606"]["math.0606.calculus.differentiation"] == 349
    assert all(row["id"] != "0606-2026-june-12-q8" for row in overlay["labels"])
    assert "0580" not in overlay["countsByBank"]
    validate_overlay(overlay)


def test_overlay_rows_are_unique_and_only_add_granular_labels():
    overlay = build_overlay(REPO, RESEARCH)
    keys = [(row["bank"], row["id"], row["label"]) for row in overlay["labels"]]
    assert len(keys) == len(set(keys))
    assert all(set(row) == {"bank", "id", "label"} for row in overlay["labels"])


def test_generated_artifact_matches_builder():
    artifact = json.loads((REPO / "src/data/math-granular-label-overlay.json").read_text())
    assert artifact == build_overlay(REPO, RESEARCH)
