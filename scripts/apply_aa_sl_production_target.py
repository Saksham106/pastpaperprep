#!/usr/bin/env python3
"""Apply the pinned AA SL production target to the app bank."""
from __future__ import annotations

import argparse
import copy
import json
import os
import tempfile
from pathlib import Path
from typing import Any

from aa_sl_production_audit import (
    CLASSIFICATION_FIELDS,
    EXPECTED_CORRECTIONS_SHA256,
    EXPECTED_TARGET_SHA256,
    nonclassification_hash,
    read_json,
    sha_file,
    validate,
)


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def apply(bank_path: Path, target_path: Path, baseline_path: Path, corrections_path: Path, runtime_taxonomy_path: Path) -> dict[str, int]:
    require(sha_file(target_path) == EXPECTED_TARGET_SHA256, "target artifact hash drift")
    require(sha_file(corrections_path) == EXPECTED_CORRECTIONS_SHA256, "correction artifact hash drift")
    target = read_json(target_path)
    ids, target_by_id = validate_target_for_apply(target, read_json(corrections_path), read_json(baseline_path), read_json(runtime_taxonomy_path).get("topics"))
    payload = read_json(bank_path)
    questions = payload.get("questions")
    require(isinstance(questions, list) and [q.get("id") for q in questions] == ids, "app bank ID/order drift")
    baseline = read_json(baseline_path)
    baseline_by_id = {record["id"]: record for record in baseline["records"]}
    before_payload = copy.deepcopy(payload)
    changed = 0
    for question in questions:
        question_id = question["id"]
        before_nonclass = nonclassification_hash(question)
        require(before_nonclass == baseline_by_id[question_id]["nonClassificationSha256"], f"{question_id}: nonclassification drift before apply")
        before = (question.get("primaryTopic"), question.get("secondaryTopics"), question.get("skills"))
        final = target_by_id[question_id]
        question["primaryTopic"] = final["primaryTopic"]
        question["secondaryTopics"] = final["secondaryTopics"]
        question["skills"] = final["skills"]
        if "subtopics" in question:
            question["subtopics"] = final["skills"]
        nested = question.get("classification")
        require(isinstance(nested, dict), f"{question_id}: nested classification missing")
        nested["primary_topic"] = final["primaryTopic"]
        nested["secondary_topics"] = final["secondaryTopics"]
        nested["skills"] = final["skills"]
        require(nonclassification_hash(question) == before_nonclass, f"{question_id}: nonclassification drift after apply")
        changed += before != (final["primaryTopic"], final["secondaryTopics"], final["skills"])
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
    target_changed = sum(
        (record["currentTuple"]["primaryTopic"], record["currentTuple"]["secondaryTopics"], record["currentTuple"]["skills"])
        != (record["primaryTopic"], record["secondaryTopics"], record["skills"])
        for record in target["records"]
    )
    return {"questionCount": len(questions), "changedCount": target_changed, "noOpCount": len(questions) - target_changed}


def validate_target_for_apply(target: dict[str, Any], corrections: dict[str, Any], baseline: dict[str, Any], runtime: Any):
    require(isinstance(runtime, dict), "runtime taxonomy missing")
    # validate() owns the complete fail-closed artifact and partition checks; this
    # small adapter returns its normalized target map without treating the current
    # app tuple as the audit baseline.
    from aa_sl_production_audit import validate_target
    return validate_target(target, corrections, baseline, runtime)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--bank", type=Path, default=Path("src/data/raw/ib-sl.json"))
    parser.add_argument("--audit-root", type=Path, default=Path("docs/audits/ib-sl-sources/aa-sl-production-target"))
    args = parser.parse_args()
    root = args.audit_root
    print(json.dumps(apply(args.bank, root / "final-production-target.json", root / "production-baseline-overlay.json", root / "final-corrections.json", root / "runtime-taxonomy.json"), indent=2, sort_keys=True))
