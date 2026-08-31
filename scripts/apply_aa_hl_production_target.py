#!/usr/bin/env python3
"""Apply the pinned AA HL production target to the app raw bank."""
from __future__ import annotations

import argparse
import copy
import json
import os
import tempfile
from pathlib import Path
from typing import Any

from aa_hl_production_audit import (
    EXPECTED_CORRECTIONS_SHA256,
    EXPECTED_TARGET_SHA256,
    nonclassification_hash,
    read_json,
    sha_file,
    tuple_from_value,
    validate_target,
)

CLASSIFICATION_FIELDS = frozenset({
    "primaryTopic", "secondaryTopics", "skills", "subtopics", "detailedSubtopics",
    "classificationEvidence", "classificationConfidence", "classificationReviewStatus",
    "classificationVersion", "p3Applicability", "contextTags", "searchText",
})


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def apply(bank_path: Path, target_path: Path, baseline_path: Path, corrections_path: Path, runtime_taxonomy_path: Path) -> dict[str, int]:
    require(sha_file(target_path) == EXPECTED_TARGET_SHA256, "target artifact hash drift")
    require(sha_file(corrections_path) == EXPECTED_CORRECTIONS_SHA256, "correction artifact hash drift")
    target = read_json(target_path)
    corrections = read_json(corrections_path)
    baseline = read_json(baseline_path)
    ids, target_by_id = validate_target(target, corrections, baseline, read_json(runtime_taxonomy_path)["topics"])
    payload = read_json(bank_path)
    questions = payload.get("questions")
    require(isinstance(questions, list) and [q.get("id") for q in questions] == ids, "app bank ID/order drift")
    baseline_by_id = {record["id"]: record for record in baseline["records"]}
    before_payload = copy.deepcopy(payload)
    changed = 0
    for question in questions:
        question_id = question["id"]
        before_nonclass = nonclassification_hash(question)
        require(before_nonclass == baseline_by_id[question_id]["nonClassificationSha256"], f"{question_id}: nonclassification drift before apply")
        before_tuple = tuple_from_value(question, f"app {question_id}")
        final = target_by_id[question_id]
        question["primaryTopic"] = final["primaryTopic"]
        question["secondaryTopics"] = final["secondaryTopics"]
        question["skills"] = final["skills"]
        if "subtopics" in question:
            question["subtopics"] = final["skills"]
        require(nonclassification_hash(question) == before_nonclass, f"{question_id}: nonclassification drift after apply")
        changed += before_tuple != final
    # Verify no field outside the declared classification surface moved.
    for before, after in zip(before_payload["questions"], questions):
        require(
            {k: v for k, v in before.items() if k not in CLASSIFICATION_FIELDS}
            == {k: v for k, v in after.items() if k not in CLASSIFICATION_FIELDS},
            f"{before['id']}: nonclassification field drift",
        )
    data = (json.dumps(payload, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
    with tempfile.NamedTemporaryFile("wb", dir=bank_path.parent, prefix=f".{bank_path.name}.", delete=False) as handle:
        handle.write(data)
        temp_path = Path(handle.name)
    os.replace(temp_path, bank_path)
    return {"questionCount": len(questions), "changedCount": changed, "noOpCount": len(questions) - changed}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--bank", type=Path, default=Path("src/data/raw/ib-hl.json"))
    parser.add_argument("--audit-root", type=Path, default=Path("docs/audits/ib-hl-sources/aa-hl-production-target"))
    args = parser.parse_args()
    root = args.audit_root
    print(json.dumps(apply(args.bank, root / "reviewed-production-target-841.json", root / "production-baseline-overlay.json", root / "latest-final-corrections.json", root / "runtime-taxonomy.json"), indent=2, sort_keys=True))
