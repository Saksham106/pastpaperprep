#!/usr/bin/env python3
"""Apply and validate the pinned 0606 production target in the app bank."""
from __future__ import annotations

import argparse
import copy
import hashlib
import json
import os
import tempfile
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
AUDIT = ROOT / "docs" / "audits" / "igcse-additional-0606-sources"
TARGET = AUDIT / "reviewed-production-target.json"
CORRECTIONS = AUDIT / "final-corrections.json"
BASELINE = AUDIT / "production-baseline-overlay.json"
TAXONOMY = AUDIT / "runtime-taxonomy.json"
EXPECTED_TARGET_SHA256 = "695c0310314771077fef8666a7572cb7884f3f2318fa8afcd7b924f1c65f87b2"
EXPECTED_CORRECTIONS_SHA256 = "8bf05339c97376891241af6bcbc4419365dc48e3d4249b6cee91ebad8a4afb12"
EXPECTED_TARGET_COUNT = 1633
EXPECTED_REVIEWED_COUNT = 129
EXPECTED_CHANGED_COUNT = 118
CLASSIFICATION_FIELDS = frozenset({
    "primaryTopic", "secondaryTopics", "skills", "subtopics", "detailedSubtopics",
    "classification", "classificationEvidence", "classificationConfidence",
    "classificationReviewStatus", "classificationVersion",
})


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def canonical(value: Any) -> bytes:
    return (json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n").encode("utf-8")


def sha_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def sha_value(value: Any) -> str:
    return hashlib.sha256(canonical(value)).hexdigest()


def load(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def target_tuple(record: dict[str, Any]) -> dict[str, Any]:
    value = record.get("tuple")
    require(isinstance(value, dict), f"{record.get('id')}: missing target tuple")
    primary = value.get("primaryTopic")
    secondary = value.get("secondaryTopics")
    skills = value.get("skills")
    require(isinstance(primary, str) and primary, f"{record.get('id')}: invalid target primary")
    require(isinstance(secondary, list) and isinstance(skills, list), f"{record.get('id')}: invalid target tuple")
    topics: list[str] = []
    flattened = list(skills)
    for item in secondary:
        require(isinstance(item, dict) and isinstance(item.get("topic"), str) and isinstance(item.get("skills"), list), f"{record.get('id')}: malformed secondary")
        require(item["topic"] not in topics and item["topic"] != primary, f"{record.get('id')}: duplicate/primary secondary")
        topics.append(item["topic"])
        flattened.extend(item["skills"])
    require(all(isinstance(x, str) and x for x in flattened), f"{record.get('id')}: invalid fine label")
    return {"primaryTopic": primary, "secondaryTopics": topics, "skills": list(dict.fromkeys(flattened))}


def nonclassification(question: dict[str, Any]) -> dict[str, Any]:
    return {key: value for key, value in question.items() if key not in CLASSIFICATION_FIELDS}


def nonclassification_hash(question: dict[str, Any]) -> str:
    return sha_value(nonclassification(question))


def load_inputs() -> tuple[list[dict[str, Any]], dict[str, dict[str, Any]], dict[str, dict[str, Any]], dict[str, list[str]]]:
    require(sha_file(TARGET) == EXPECTED_TARGET_SHA256, "reviewed target artifact hash drift")
    require(sha_file(CORRECTIONS) == EXPECTED_CORRECTIONS_SHA256, "final corrections artifact hash drift")
    target = load(TARGET); corrections = load(CORRECTIONS); baseline = load(BASELINE); runtime = load(TAXONOMY)
    require(target.get("status") == "PASS" and target.get("questionCount") == EXPECTED_TARGET_COUNT, "target status/count drift")
    require(corrections.get("status") == "PASS" and corrections.get("reviewedCount") == EXPECTED_REVIEWED_COUNT and corrections.get("changedCount") == EXPECTED_CHANGED_COUNT, "correction counts drift")
    records = target.get("records"); base_records = baseline.get("records")
    require(isinstance(records, list) and len(records) == EXPECTED_TARGET_COUNT, "target coverage drift")
    require(isinstance(base_records, list) and len(base_records) == EXPECTED_TARGET_COUNT, "baseline coverage drift")
    target_by_id: dict[str, dict[str, Any]] = {}
    ids: list[str] = []
    for ordinal, record in enumerate(records, 1):
        require(record.get("order") == ordinal and record.get("id") not in target_by_id, f"target order/ID drift at {ordinal}")
        ids.append(record["id"]); target_by_id[record["id"]] = target_tuple(record)
    require([r.get("id") for r in base_records] == ids, "target/baseline ordered ID drift")
    correction_records = corrections.get("records")
    require(isinstance(correction_records, list) and len(correction_records) == EXPECTED_REVIEWED_COUNT, "correction coverage drift")
    correction_by_id = {r.get("id"): r for r in correction_records}
    require(len(correction_by_id) == EXPECTED_REVIEWED_COUNT and set(correction_by_id) <= set(ids), "correction missing/extra IDs")
    require(sum(bool(r.get("changed")) for r in correction_records) == EXPECTED_CHANGED_COUNT, "correction changed/no-op partition drift")
    require(set(r["id"] for r in correction_records if r.get("changed")) .isdisjoint(set(r["id"] for r in correction_records if not r.get("changed"))), "correction partition overlap")
    taxonomy_topics = runtime.get("topics") if isinstance(runtime, dict) else None
    require(isinstance(taxonomy_topics, dict) and taxonomy_topics, "runtime taxonomy missing")
    require(runtime.get("sourceSha256") == sha_file(ROOT / "src" / "lib" / "taxonomy.ts"), "runtime taxonomy source drift")
    return records, target_by_id, correction_by_id, taxonomy_topics


def apply(bank_path: Path) -> dict[str, int]:
    records, target_by_id, correction_by_id, taxonomy_topics = load_inputs()
    payload = load(bank_path); questions = payload.get("questions")
    require(isinstance(questions, list) and len(questions) == EXPECTED_TARGET_COUNT, "app bank count drift")
    baseline_records = load(BASELINE)["records"]
    baseline_by_id = {row["id"]: row for row in baseline_records}
    ids = [row["id"] for row in records]
    require([q.get("id") for q in questions] == ids, "app bank ordered ID drift")
    changed = 0
    before = copy.deepcopy(payload)
    for question in questions:
        qid = question["id"]
        require(nonclassification_hash(question) == baseline_by_id[qid]["nonClassificationSha256"], f"{qid}: nonclassification drift from pinned baseline")
        final = target_by_id[qid]
        current = {"primaryTopic": question.get("primaryTopic"), "secondaryTopics": question.get("secondaryTopics", []), "skills": set(question.get("subtopics", []))}
        target_semantics = {"primaryTopic": final["primaryTopic"], "secondaryTopics": final["secondaryTopics"], "skills": set(final["skills"])}
        changed += current != target_semantics
        baseline_labels = question.get("subtopics", []) if isinstance(question.get("subtopics", []), list) else []
        target_labels = final["skills"]
        target_set = set(target_labels)
        ordered_labels = [label for label in baseline_labels if label in target_set]
        ordered_labels.extend(label for label in target_labels if label not in ordered_labels)
        question["primaryTopic"] = final["primaryTopic"]
        question["secondaryTopics"] = final["secondaryTopics"]
        question["subtopics"] = ordered_labels
        question["detailedSubtopics"] = ordered_labels
        correction = correction_by_id.get(qid)
        if correction:
            confidence = "high" if float(correction.get("confidence", 0)) >= 0.95 else "medium"
            question["classificationEvidence"] = {
                "terms": [correction["evidence"]],
                "method": "final-corrections.json paired question and official mark-scheme evidence",
                "confidence": confidence,
                "reviewStatus": "manually-reviewed",
                "version": "0606-reviewed-production-target-v1",
                "provenance": {"artifactSha256": EXPECTED_CORRECTIONS_SHA256, "recordId": qid, "decision": correction["decision"], "changed": bool(correction["changed"])},
            }
            question["classificationVersion"] = "0606-reviewed-production-target-v1"
        require(nonclassification_hash(question) == baseline_by_id[qid]["nonClassificationSha256"], f"{qid}: nonclassification drift after apply")
        selected = [final["primaryTopic"], *final["secondaryTopics"]]
        require(all(topic in taxonomy_topics for topic in selected), f"{qid}: target owner outside runtime taxonomy")
        owned = {skill for topic in selected for skill in taxonomy_topics[topic]}
        require(set(final["skills"]).issubset(owned), f"{qid}: target fine label outside selected owner")
    for old, new in zip(before["questions"], questions):
        require(nonclassification(old) == nonclassification(new), f"{old['id']}: nonclassification field drift")
    bank_path.write_bytes((json.dumps(payload, ensure_ascii=False, indent=2) + "\n").encode("utf-8"))
    return {"questionCount": len(questions), "reviewedCount": EXPECTED_REVIEWED_COUNT, "changedCount": EXPECTED_CHANGED_COUNT, "noOpCount": EXPECTED_REVIEWED_COUNT - EXPECTED_CHANGED_COUNT, "targetDeltaCount": changed}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--bank", type=Path, default=Path("src/data/raw/igcse-additional.json"))
    args = parser.parse_args()
    print(json.dumps(apply(args.bank), indent=2, sort_keys=True))
