#!/usr/bin/env python3
"""Validate blind sample results and build the production comparison queue."""
from __future__ import annotations

import argparse
import hashlib
import json
from collections import Counter
from pathlib import Path
from typing import Any

ROOT = Path("/tmp/ppp-semantic-audit-2026-08")
CANONICAL_TAXONOMY_PATH = Path(__file__).resolve().parent / "classification-semantic-canonical-taxonomy.json"
EXPECTED_TOP = {"auditVersion", "batch", "inputSha256", "count", "judgments"}
EXPECTED_ROW = {
    "bank", "id", "primaryTopic", "secondaryTopics", "skills", "confidence",
    "taxonomyGap", "evidence", "rationale", "inspectedQuestionAssets",
    "inspectedMarkschemeAssets", "officialMarkschemeUnavailable",
}
CONFIDENCE = {"high", "medium", "low"}


def canonical_bytes(value: Any) -> bytes:
    return (json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n").encode()


def sha_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def semantic(value: dict[str, Any]) -> tuple[str, tuple[str, ...], tuple[str, ...]]:
    return (
        value["primaryTopic"],
        tuple(sorted(set(value.get("secondaryTopics") or []))),
        tuple(sorted(set(value.get("skills") or value.get("subtopics") or []))),
    )


def evidence_length(value: Any) -> int:
    """Count meaningful evidence text while preserving reviewer structure."""
    if isinstance(value, str):
        return len(value.strip())
    if isinstance(value, list) and all(isinstance(item, str) for item in value):
        return len(" ".join(item.strip() for item in value).strip())
    return 0


def has_canonical_ownership_violation(
    row: dict[str, Any], taxonomy: dict[str, dict[str, list[str]]]
) -> bool:
    selected = [row["primaryTopic"], *row["secondaryTopics"]]
    owned = {skill for topic in selected for skill in taxonomy[row["bank"]][topic]}
    return not set(row["skills"]).issubset(owned)


def validate() -> tuple[dict[str, Any], list[dict[str, Any]], list[dict[str, Any]]]:
    hidden = json.loads((ROOT / "selection-hidden.json").read_text())
    hidden_rows = {(r["bank"], r["id"]): r for r in hidden["records"]}
    all_judgments: list[dict[str, Any]] = []
    for index in range(1, 11):
        input_path = ROOT / "blind-inputs" / f"batch-{index:02d}.json"
        result_path = ROOT / "blind-results" / f"batch-{index:02d}.json"
        if not result_path.is_file():
            raise FileNotFoundError(result_path)
        packet = json.loads(input_path.read_text())
        result = json.loads(result_path.read_text())
        if set(result) != EXPECTED_TOP:
            raise ValueError(f"batch {index}: top keys {set(result)}")
        if result["auditVersion"] != packet["auditVersion"] or result["batch"] != packet["batch"]:
            raise ValueError(f"batch {index}: identity mismatch")
        if result["inputSha256"] != packet["inputSha256"]:
            raise ValueError(f"batch {index}: input hash mismatch")
        if result["count"] != len(packet["records"]) or len(result["judgments"]) != len(packet["records"]):
            raise ValueError(f"batch {index}: count mismatch")
        expected_ids = [(r["bank"], r["id"]) for r in packet["records"]]
        actual_ids = [(r["bank"], r["id"]) for r in result["judgments"]]
        if actual_ids != expected_ids:
            raise ValueError(f"batch {index}: ordered ID mismatch")
        input_by_id = {(r["bank"], r["id"]): r for r in packet["records"]}
        taxonomy = packet["taxonomyByBank"]
        for row in result["judgments"]:
            if set(row) != EXPECTED_ROW:
                raise ValueError(f"{row.get('id')}: keys {set(row)}")
            bank = row["bank"]
            topics = set(taxonomy[bank])
            allowed_skills = {skill for values in taxonomy[bank].values() for skill in values}
            if row["primaryTopic"] not in topics:
                raise ValueError(f"{row['id']}: invalid primary")
            if (
                not isinstance(row["secondaryTopics"], list)
                or not all(isinstance(topic, str) for topic in row["secondaryTopics"])
                or len(row["secondaryTopics"]) != len(set(row["secondaryTopics"]))
            ):
                raise ValueError(f"{row['id']}: invalid secondary list")
            if row["primaryTopic"] in row["secondaryTopics"] or not set(row["secondaryTopics"]).issubset(topics):
                raise ValueError(f"{row['id']}: invalid secondary topics")
            if (
                not isinstance(row["skills"], list)
                or not all(isinstance(skill, str) for skill in row["skills"])
                or len(row["skills"]) != len(set(row["skills"]))
            ):
                raise ValueError(f"{row['id']}: invalid skill list")
            if not set(row["skills"]).issubset(allowed_skills):
                raise ValueError(f"{row['id']}: uncontrolled skills {set(row['skills']) - allowed_skills}")
            if row["confidence"] not in CONFIDENCE:
                raise ValueError(f"{row['id']}: invalid confidence")
            taxonomy_gap = row["taxonomyGap"]
            if taxonomy_gap is not None and (
                not isinstance(taxonomy_gap, str)
                or not taxonomy_gap.strip()
                or taxonomy_gap.strip().lower() in {"none", "no", "n/a"}
            ):
                raise ValueError(f"{row['id']}: invalid taxonomy gap")
            expected = input_by_id[(bank, row["id"])]
            if row["inspectedQuestionAssets"] != expected["questionAssets"]:
                raise ValueError(f"{row['id']}: question assets mismatch")
            if row["inspectedMarkschemeAssets"] != expected["markschemeAssets"]:
                raise ValueError(f"{row['id']}: markscheme assets mismatch")
            if row["officialMarkschemeUnavailable"] != expected["officialMarkschemeUnavailable"]:
                raise ValueError(f"{row['id']}: markscheme availability mismatch")
            if evidence_length(row["evidence"]) < 30 or evidence_length(row["rationale"]) < 30:
                raise ValueError(f"{row['id']}: weak evidence/rationale")
        all_judgments.extend(result["judgments"])
    if len(all_judgments) != 350 or len({(r["bank"], r["id"]) for r in all_judgments}) != 350:
        raise ValueError("global result coverage mismatch")
    if set(hidden_rows) != {(r["bank"], r["id"]) for r in all_judgments}:
        raise ValueError("selection/result mismatch")
    return hidden, list(hidden_rows.values()), all_judgments


def compare(hidden_rows: list[dict[str, Any]], judgments: list[dict[str, Any]]) -> dict[str, Any]:
    hidden = {(r["bank"], r["id"]): r for r in hidden_rows}
    rows = []
    counts: dict[str, Counter[str]] = {}
    for judgment in judgments:
        key = (judgment["bank"], judgment["id"])
        selected = hidden[key]
        production = selected["production"]
        blind_sem = semantic(judgment)
        production_sem = semantic(production)
        if blind_sem == production_sem:
            category = "exact"
        elif blind_sem[0] != production_sem[0]:
            category = "primary-mismatch"
        elif blind_sem[1] != production_sem[1]:
            category = "secondary-mismatch"
        else:
            category = "skills-mismatch-only"
        counts.setdefault(judgment["bank"], Counter())[category] += 1
        rows.append({
            "bank": judgment["bank"],
            "id": judgment["id"],
            "sampleLayer": selected["sampleLayer"],
            "riskFlags": selected["riskFlags"],
            "category": category,
            "production": production,
            "blind": {
                "primaryTopic": judgment["primaryTopic"],
                "secondaryTopics": judgment["secondaryTopics"],
                "skills": judgment["skills"],
                "confidence": judgment["confidence"],
                "taxonomyGap": judgment["taxonomyGap"],
                "evidence": judgment["evidence"],
                "rationale": judgment["rationale"],
            },
            "questionAssets": judgment["inspectedQuestionAssets"],
            "markschemeAssets": judgment["inspectedMarkschemeAssets"],
            "officialMarkschemeUnavailable": judgment["officialMarkschemeUnavailable"],
        })
    disagreements = [r for r in rows if r["category"] != "exact"]
    report = {
        "auditVersion": "pastpaperprep-semantic-sample-2026.08.1",
        "sampleCount": len(rows),
        "preAdjudicationCounts": {bank: dict(counter) for bank, counter in sorted(counts.items())},
        "exactCount": len(rows) - len(disagreements),
        "disagreementCount": len(disagreements),
        "rows": rows,
    }
    (ROOT / "pre-adjudication-comparison.json").write_bytes(canonical_bytes(report))
    taxonomy_by_bank = json.loads((ROOT / "blind-inputs" / "batch-01.json").read_text())["taxonomyByBank"]
    queue = {
        "auditVersion": report["auditVersion"],
        "count": len(disagreements),
        "taxonomyByBank": taxonomy_by_bank,
        "records": disagreements,
    }
    queue["inputSha256"] = hashlib.sha256(canonical_bytes(queue)).hexdigest()
    (ROOT / "adjudication-queue.json").write_bytes(canonical_bytes(queue))
    return report


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--validate-only", action="store_true")
    args = parser.parse_args()
    hidden, hidden_rows, judgments = validate()
    canonical_taxonomy = json.loads(CANONICAL_TAXONOMY_PATH.read_text())
    result = {
        "validated": True,
        "count": len(judgments),
        "resultHashes": {
            f"batch-{i:02d}.json": sha_file(ROOT / "blind-results" / f"batch-{i:02d}.json")
            for i in range(1, 11)
        },
        "confidence": dict(Counter(row["confidence"] for row in judgments)),
        "taxonomyGaps": sum(row["taxonomyGap"] is not None for row in judgments),
        "blindCanonicalOwnershipViolations": sum(
            has_canonical_ownership_violation(row, canonical_taxonomy) for row in judgments
        ),
        "canonicalTaxonomySha256": sha_file(CANONICAL_TAXONOMY_PATH),
        "officialMarkschemeUnavailable": sum(row["officialMarkschemeUnavailable"] for row in judgments),
        "hiddenSelectionSha256": sha_file(ROOT / "selection-hidden.json"),
    }
    if not args.validate_only:
        comparison = compare(hidden_rows, judgments)
        result["exactCount"] = comparison["exactCount"]
        result["disagreementCount"] = comparison["disagreementCount"]
    print(json.dumps(result, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
