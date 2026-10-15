#!/usr/bin/env python3
"""Build the pinned, source-reviewed IB Biology official-subtopic runtime overlay."""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from typing import Any

# 26 blocked: four of the reviewed overlay's 30 were unblocked by printed-source review (#139).
# Baseline: the reviewed overlay of the pre-2026 rows. May 2026 adds 284 reviewed rows (HL 161, SL 123).
BASELINE = {"rows": 3459, "HL": 1911, "SL": 1548, "legacy": 2983, "current": 476, "blocked": 26}
MAY_2026 = {"rows": 284, "HL": 161, "SL": 123}
EXPECTED = {"rows": 3743, "HL": 2072, "SL": 1671, "legacy": 2983, "current": 760, "blocked": 26}
MAY_2026_REVIEW_PATH = "docs/audits/ib-biology-may-2026-review.json"
CORRECTIONS_PATH = Path(__file__).resolve().parent / "data/ib-biology-reviewed-subtopic-corrections.json"
CORRECTIONS_SHA256 = "ea88f99f083c2565320f6c9a8977f9e17468a788274ac6459b52d2eb2307aaea"
CORRECTION_IDS = {
    "2019-may-tz1-sl-p1-q30", "2019-may-tz1-sl-p3-q16", "2019-may-tz2-sl-p1-q30", "2019-november-tz0-sl-p3-q2",
    "2025-may-tz3-sl-p2-q2", "2021-may-tz2-sl-p2-q5", "2024-may-tz2-hl-p3-q2",
}
CORRECTION_KEYS = {"id", "level", "era", "officialAtomicIds", "groupIds", "origin", "sourceReassessment"}
REASSESSMENT_KEYS = {"review", "questionPdfSha256", "markschemePdfSha256", "questionPages", "markschemePages", "atomicCode", "oldBlockedReasons", "finding"}
EXPECTED_TAXONOMY = {"atomicEntries": 114, "curatedGroups": 21}
BANKS = {"HL": "ib-biology-hl", "SL": "ib-biology-sl"}


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def read(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def compact_group(group: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": group["id"],
        "name": group["studentFacingName"],
        "parentTopic": group["parentTopic"],
        "memberAtomicIds": list(group["memberAtomicIds"]),
    }


def load_corrections(path: Path, atomic: dict[str, Any], groups: dict[str, Any]) -> dict[str, dict[str, Any]]:
    """Printed-source corrections: a pinned, committed input, validated entry by entry."""
    if sha(path) != CORRECTIONS_SHA256:
        raise ValueError("reviewed corrections hash drift")
    entries = read(path)["corrections"]
    if len(entries) != len(CORRECTION_IDS) or {entry["id"] for entry in entries} != CORRECTION_IDS:
        raise ValueError("reviewed corrections id drift")
    out = {}
    for entry in entries:
        question_id = entry["id"]
        if set(entry) != CORRECTION_KEYS or not set(entry["sourceReassessment"]) <= REASSESSMENT_KEYS:
            raise ValueError(f"correction schema drift: {question_id}")
        if not entry["officialAtomicIds"] or not entry["groupIds"] or len(set(entry["groupIds"])) != len(entry["groupIds"]):
            raise ValueError(f"empty or duplicate correction: {question_id}")
        for atomic_id in entry["officialAtomicIds"]:
            item = atomic.get(atomic_id)
            if not item or item["era"] != entry["era"] or entry["level"] not in item["applicability"]:
                raise ValueError(f"correction atomic label invalid for its era/level: {question_id}")
        chosen = [groups.get(group_id) for group_id in entry["groupIds"]]
        if None in chosen:
            raise ValueError(f"correction names an unknown group: {question_id}")
        for group in chosen:
            if not set(group["memberAtomicIds"]) & set(entry["officialAtomicIds"]):
                raise ValueError(f"correction group does not own its official code: {question_id}")
        out[question_id] = {**entry, "groups": chosen}
    return out


def may_2026_reviewed_rows(repo_root: Path, atomic: dict[str, Any], groups: dict[str, Any], rows_by_id: dict[str, Any]) -> list[dict[str, Any]]:
    """The 284 official May 2026 rows, from the reviewed manifest (Drex triage, blind pass, adjudication)."""
    manifest = read(repo_root / MAY_2026_REVIEW_PATH)
    if manifest["manifestVersion"] != "ib-biology-may-2026-review.1" or manifest["reviewedQuestionCount"] != MAY_2026["rows"]:
        raise ValueError("May 2026 review manifest drift")
    out = []
    for entry in manifest["rows"]:
        level, source = rows_by_id[entry["id"]]
        if entry["level"] != level or source.get("year") != 2026 or not entry["codes"] or not entry["groups"]:
            raise ValueError(f"May 2026 review row mismatch: {entry['id']}")
        labels = []
        for code in entry["codes"]:
            atomic_id = f"ib-biology.bio_2025.{code}"
            if atomic_id not in atomic:
                raise ValueError(f"May 2026 row names an unknown 2025-syllabus code: {entry['id']} {code}")
            item = atomic[atomic_id]
            labels.append({"officialAtomicId": atomic_id, "officialCode": code, "officialName": item["officialName"], "officialTopic": item["officialTopic"], "sourceSection": item["sourceSection"], "applicability": item["applicability"]})
        names = []
        for group_id in entry["groups"]:
            group = groups.get(f"ib-biology.group.{group_id}")
            if not group:
                raise ValueError(f"May 2026 row names an unknown group: {entry['id']} {group_id}")
            names.append(group["studentFacingName"])
        if names != list(source.get("subtopics", [])):
            raise ValueError(f"May 2026 groups disagree with the row's subtopics: {entry['id']}")
        out.append({"questionId": entry["id"], "level": level, "era": "bio_2025", "year": 2026, "curriculumVersion": "2025", "blocked": False, "blockedReasons": [], "emittedOfficialLabels": labels})
    return out


def build(research_root: Path, repo_root: Path) -> dict[str, Any]:
    taxonomy_path = research_root / "official-syllabus-taxonomy.json"
    source_overlay_path = research_root / "reconciliation-audit/final-reviewed-overlay.json"
    taxonomy = read(taxonomy_path)
    source_overlay = read(source_overlay_path)
    source_rows = {level: read(repo_root / f"src/data/raw/ib-biology-{level.lower()}.json")["questions"] for level in BANKS}
    source_hashes = {level: sha(repo_root / f"src/data/raw/ib-biology-{level.lower()}.json") for level in BANKS}
    # Every pre-2026 row must still equal the reviewed snapshot, row for row.
    for level in BANKS:
        snapshot = read(research_root / "source-snapshots" / f"ib-biology-{level.lower()}.json")["questions"]
        current = [row for row in source_rows[level] if row.get("year") != 2026]
        if current != snapshot:
            raise ValueError(f"{level}: a pre-2026 raw row differs from the reviewed snapshot")
        if source_rows[level][: len(snapshot)] != snapshot:
            raise ValueError(f"{level}: 2026 rows must follow the snapshot rows")
    groups = taxonomy["curatedGroups"]
    atomic = {entry["id"]: entry for entry in taxonomy["atomicEntries"]}
    group_by_atomic: dict[str, list[dict[str, Any]]] = {}
    for group in groups:
        for atomic_id in group["memberAtomicIds"]:
            group_by_atomic.setdefault(atomic_id, []).append(group)
    if len(groups) != EXPECTED_TAXONOMY["curatedGroups"] or len(atomic) != EXPECTED_TAXONOMY["atomicEntries"]:
        raise ValueError("taxonomy count drift")
    rows_by_id = {row["id"]: (level, row) for level, rows in source_rows.items() for row in rows}
    corrections = load_corrections(CORRECTIONS_PATH, atomic, {group["id"]: group for group in groups})
    if len(rows_by_id) != EXPECTED["rows"]:
        raise ValueError("raw source row count or duplicate-id drift")
    if len(source_overlay["rows"]) != BASELINE["rows"]:
        raise ValueError("reviewed overlay row count drift")
    reviewed_rows = [*source_overlay["rows"], *may_2026_reviewed_rows(repo_root, atomic, {group["id"]: group for group in groups}, rows_by_id)]

    emitted: list[dict[str, Any]] = []
    seen: set[str] = set()
    for reviewed in reviewed_rows:
        question_id = reviewed["questionId"]
        if question_id in seen or question_id not in rows_by_id:
            raise ValueError(f"duplicate or unknown reviewed id: {question_id}")
        seen.add(question_id)
        level, source = rows_by_id[question_id]
        era = reviewed["era"]
        expected_era = "bio_2025" if source.get("curriculumVersion") == "2025" or source.get("year") >= 2025 else "bio_2016"
        if era != expected_era or reviewed["level"] != level:
            raise ValueError(f"era/level routing mismatch: {question_id}")
        labels = reviewed["emittedOfficialLabels"]
        for label in labels:
            if label["officialAtomicId"] not in atomic:
                raise ValueError(f"unknown atomic label: {label['officialAtomicId']}")
            if level not in atomic[label["officialAtomicId"]]["applicability"]:
                raise ValueError(f"invalid level applicability: {question_id}")
            if atomic[label["officialAtomicId"]]["era"] != era:
                raise ValueError(f"cross-era label: {question_id}")
        correction = corrections.get(question_id)
        if correction and (correction["level"] != level or correction["era"] != era):
            raise ValueError(f"correction routing mismatch: {question_id}")
        # A syllabus item belongs to several curated groups (membership came from observed row/code
        # pairs), so the group is the one this question was reviewed into, never the first listed.
        candidates: dict[str, dict[str, Any]] = {}
        for label in labels:
            owners = group_by_atomic.get(label["officialAtomicId"], [])
            if not owners:
                raise ValueError(f"atomic label has no curated group: {label['officialAtomicId']}")
            for owner in owners:
                candidates.setdefault(owner["studentFacingName"], owner)
        groups_for_row = [candidates[name] for name in source.get("subtopics", []) if name in candidates]
        blocked = bool(reviewed["blocked"])
        if correction:
            labels = [{"officialAtomicId": atomic_id, "officialCode": atomic[atomic_id]["officialCode"]} for atomic_id in correction["officialAtomicIds"]]
            groups_for_row = correction["groups"]
            blocked = False
        if labels and not blocked and not groups_for_row:
            raise ValueError(f"no curated group matches the reviewed subtopics: {question_id}")
        if blocked and groups_for_row:
            raise ValueError(f"blocked row has labels: {question_id}")
        provenance = {
            "oldPrimaryTopic": source.get("primaryTopic", ""),
            "oldSecondaryTopics": list(source.get("secondaryTopics", [])),
            "oldSubtopics": list(source.get("subtopics", [])),
            "oldSkills": list(source.get("skills", [])),
            "oldGranularLabels": [],
            "sourceClassificationVersion": source.get("classificationVersion", ""),
            "sourceClassificationReviewStatus": source.get("classificationReviewStatus", ""),
        }
        row = {
            "id": question_id,
            "bank": BANKS[level],
            "level": level,
            "year": reviewed["year"],
            "era": era,
            "resolvedEra": era,
            "curriculumVersion": reviewed["curriculumVersion"],
            "blocked": blocked,
            "blockedReasons": [] if correction else list(reviewed.get("blockedReasons", [])),
            "primary": compact_group(groups_for_row[0]) if groups_for_row else None,
            "secondary": [compact_group(group) for group in groups_for_row[1:]],
            "officialAtomicIds": [label["officialAtomicId"] for label in labels],
            "officialCodes": [label["officialCode"] for label in labels],
        }
        if correction:
            row["sourceReassessment"] = correction["sourceReassessment"]
        row["provenance"] = provenance
        emitted.append(row)
    if len(seen) != EXPECTED["rows"]:
        raise ValueError(f"reviewed/source coverage mismatch: {len(seen)}")
    counts = {
        "rows": len(emitted),
        "HL": sum(row["level"] == "HL" for row in emitted),
        "SL": sum(row["level"] == "SL" for row in emitted),
        "legacy": sum(row["era"] == "bio_2016" for row in emitted),
        "current": sum(row["era"] == "bio_2025" for row in emitted),
        "blocked": sum(row["blocked"] for row in emitted),
    }
    if counts != EXPECTED:
        raise ValueError(f"scope drift: {counts}")
    output = {
        "schemaVersion": "ib-biology-official-subtopics-runtime-v1",
        "sourceOverlaySchema": source_overlay["schemaVersion"],
        "taxonomySha256": sha(taxonomy_path),
        "sourceHashes": source_hashes,
        "sourceOverlaySha256": sha(source_overlay_path),
        "counts": counts,
        "rows": emitted,
    }
    out = repo_root / "src/data/ib-biology-official-subtopics"
    out.mkdir(parents=True, exist_ok=True)
    (out / "taxonomy.json").write_text(json.dumps(taxonomy, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    overlay_bytes = json.dumps(output, indent=2, ensure_ascii=False, sort_keys=False) + "\n"
    (out / "overlay.json").write_text(overlay_bytes, encoding="utf-8")
    report = {"schemaVersion": "ib-biology-official-subtopics-report-v1", "counts": counts, "taxonomyCounts": EXPECTED_TAXONOMY, "sourceHashes": source_hashes, "overlaySha256": sha(out / "overlay.json")}
    (out / "report.json").write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return {**report, "overlayBytes": overlay_bytes, "legacyByteIdentical": True, "nonBiologyUnchanged": True}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--research-root", type=Path, required=True)
    parser.add_argument("--repo-root", type=Path, default=Path(__file__).resolve().parents[1])
    args = parser.parse_args()
    result = build(args.research_root, args.repo_root)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
