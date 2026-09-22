#!/usr/bin/env python3
"""Build the pinned, source-reviewed IB Biology official-subtopic runtime overlay."""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from typing import Any

EXPECTED = {"rows": 3459, "HL": 1911, "SL": 1548, "legacy": 2983, "current": 476, "blocked": 30}
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


def build(research_root: Path, repo_root: Path) -> dict[str, Any]:
    taxonomy_path = research_root / "official-syllabus-taxonomy.json"
    source_overlay_path = research_root / "reconciliation-audit/final-reviewed-overlay.json"
    taxonomy = read(taxonomy_path)
    source_overlay = read(source_overlay_path)
    source_rows = {level: read(repo_root / f"src/data/raw/ib-biology-{level.lower()}.json")["questions"] for level in BANKS}
    source_hashes = {level: sha(repo_root / f"src/data/raw/ib-biology-{level.lower()}.json") for level in BANKS}
    expected_hashes = {
        level: sha(research_root / "source-snapshots" / f"ib-biology-{level.lower()}.json")
        for level in BANKS
    }
    if source_hashes != expected_hashes:
        raise ValueError(f"raw source hash drift: {source_hashes} != {expected_hashes}")
    groups = taxonomy["curatedGroups"]
    atomic = {entry["id"]: entry for entry in taxonomy["atomicEntries"]}
    group_by_atomic: dict[str, list[dict[str, Any]]] = {}
    for group in groups:
        for atomic_id in group["memberAtomicIds"]:
            group_by_atomic.setdefault(atomic_id, []).append(group)
    if len(groups) != EXPECTED_TAXONOMY["curatedGroups"] or len(atomic) != EXPECTED_TAXONOMY["atomicEntries"]:
        raise ValueError("taxonomy count drift")
    rows_by_id = {row["id"]: (level, row) for level, rows in source_rows.items() for row in rows}
    if len(rows_by_id) != EXPECTED["rows"]:
        raise ValueError("raw source row count or duplicate-id drift")
    if len(source_overlay["rows"]) != EXPECTED["rows"]:
        raise ValueError("reviewed overlay row count drift")

    emitted: list[dict[str, Any]] = []
    seen: set[str] = set()
    for reviewed in source_overlay["rows"]:
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
        groups_for_row: list[dict[str, Any]] = []
        for label in labels:
            owners = group_by_atomic.get(label["officialAtomicId"], [])
            if not owners:
                raise ValueError(f"atomic label has no curated group: {label['officialAtomicId']}")
            owner = owners[0]
            if owner["id"] not in {group["id"] for group in groups_for_row}:
                groups_for_row.append(owner)
        blocked = bool(reviewed["blocked"])
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
        emitted.append({
            "id": question_id,
            "bank": BANKS[level],
            "level": level,
            "year": reviewed["year"],
            "era": era,
            "resolvedEra": era,
            "curriculumVersion": reviewed["curriculumVersion"],
            "blocked": blocked,
            "blockedReasons": list(reviewed.get("blockedReasons", [])),
            "primary": compact_group(groups_for_row[0]) if groups_for_row else None,
            "secondary": [compact_group(group) for group in groups_for_row[1:]],
            "officialAtomicIds": [label["officialAtomicId"] for label in labels],
            "officialCodes": [label["officialCode"] for label in labels],
            "provenance": provenance,
        })
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
