#!/usr/bin/env python3
"""Fail-closed validation for the pinned AA SL production target."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

EXPECTED_TARGET_SHA256 = "8ddecd7634bede343defd82a4de097fe428e41c833b7957925c8e1e11bb7315c"
EXPECTED_CORRECTIONS_SHA256 = "5c5eff06c0881927164203ae71a9e2da6481052b0731afab72e6fc3f667c9629"
EXPECTED_RUNTIME_TAXONOMY_SHA256 = "6e3f313a298cdf206481626e1ad79fc32615a6d9cab104de79245fba28148ce3"
EXPECTED_QUESTION_COUNT = 578
EXPECTED_REVIEWED_COUNT = 408
EXPECTED_CHANGED_COUNT = 406
CLASSIFICATION_FIELDS = frozenset({
    "classification", "primaryTopic", "secondaryTopics", "skills", "subtopics", "detailedSubtopics",
    "classificationEvidence", "classificationConfidence", "classificationReviewStatus",
    "classificationVersion", "p3Applicability", "contextTags", "searchText",
})


def canonical_bytes(value: Any) -> bytes:
    return (json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n").encode("utf-8")


def sha_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def sha_file(path: Path) -> str:
    return sha_bytes(path.read_bytes())


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def semantic(value: dict[str, Any]) -> tuple[str, tuple[str, ...], tuple[str, ...]]:
    return (value["primaryTopic"], tuple(value["secondaryTopics"]), tuple(value["skills"]))


def tuple_from_value(value: dict[str, Any], label: str) -> dict[str, Any]:
    primary = value.get("primaryTopic")
    secondary = value.get("secondaryTopics")
    skills = value.get("skills")
    require(isinstance(primary, str) and primary.strip(), f"{label}.primaryTopic: invalid")
    require(isinstance(secondary, list) and all(isinstance(x, str) and x.strip() for x in secondary), f"{label}.secondaryTopics: invalid")
    require(len(secondary) == len(set(secondary)) and primary not in secondary, f"{label}.secondaryTopics: duplicate or primary")
    require(isinstance(skills, list) and all(isinstance(x, str) and x.strip() for x in skills), f"{label}.skills: invalid")
    require(len(skills) == len(set(skills)), f"{label}.skills: duplicate")
    return {"primaryTopic": primary, "secondaryTopics": secondary, "skills": skills}


def nonclassification_hash(question: dict[str, Any]) -> str:
    preserved = {key: value for key, value in question.items() if key not in CLASSIFICATION_FIELDS}
    return sha_bytes(canonical_bytes(preserved))


def questions_from(payload: Any, label: str) -> list[dict[str, Any]]:
    questions = payload.get("questions") if isinstance(payload, dict) else payload
    require(isinstance(questions, list) and len(questions) == EXPECTED_QUESTION_COUNT, f"{label}: question coverage drift")
    ids = [q.get("id") for q in questions if isinstance(q, dict)]
    require(len(ids) == len(questions) and all(isinstance(x, str) and x for x in ids), f"{label}: invalid question IDs")
    require(len(ids) == len(set(ids)), f"{label}: duplicate question IDs")
    return questions


def validate_target(target: dict[str, Any], corrections: dict[str, Any], baseline: dict[str, Any], runtime: dict[str, list[str]]) -> tuple[list[str], dict[str, dict[str, Any]]]:
    require(target.get("schema") == "aa-sl-final-production-target-1.0" and target.get("status") == "complete", "target schema/status drift")
    require(target.get("count") == EXPECTED_QUESTION_COUNT and target.get("reviewed_count") == EXPECTED_REVIEWED_COUNT and target.get("unreviewed_count") == 170, "target count drift")
    require(corrections.get("schema") == "aa-sl-final-corrections-1.0" and corrections.get("status") == "complete" and corrections.get("count") == EXPECTED_REVIEWED_COUNT, "corrections schema/count drift")
    target_records = target.get("records")
    require(isinstance(target_records, list) and len(target_records) == EXPECTED_QUESTION_COUNT, "target records coverage drift")
    ids: list[str] = []
    target_by_id: dict[str, dict[str, Any]] = {}
    for ordinal, record in enumerate(target_records, 1):
        require(isinstance(record, dict) and record.get("order") == ordinal, f"target order drift at {ordinal}")
        question_id = record.get("id")
        require(isinstance(question_id, str) and question_id not in target_by_id, f"target ID drift at {ordinal}")
        ids.append(question_id)
        target_by_id[question_id] = {
            "primaryTopic": record["primaryTopic"], "secondaryTopics": record["secondaryTopics"], "skills": record["skills"],
        }
        tuple_from_value(target_by_id[question_id], f"target {question_id}")
    baseline_records = baseline.get("records")
    require(isinstance(baseline_records, list) and len(baseline_records) == EXPECTED_QUESTION_COUNT, "baseline coverage drift")
    require([r.get("id") for r in baseline_records] == ids and baseline.get("questionCount") == EXPECTED_QUESTION_COUNT, "baseline ordered coverage drift")
    changed = 0
    for ordinal, record in enumerate(baseline_records, 1):
        require(record.get("ordinal") == ordinal and isinstance(record.get("nonClassificationSha256"), str) and len(record["nonClassificationSha256"]) == 64, f"baseline record drift at {ordinal}")
        before = tuple_from_value(record["baselineTuple"], f"baseline {record['id']}")
        changed += semantic(before) != semantic(target_by_id[record["id"]])
    require(changed == EXPECTED_CHANGED_COUNT and changed + (EXPECTED_QUESTION_COUNT - changed) == EXPECTED_QUESTION_COUNT, "changed/no-op partition drift")
    correction_records = corrections.get("records")
    require(isinstance(correction_records, list) and len(correction_records) == EXPECTED_REVIEWED_COUNT, "corrections coverage drift")
    correction_ids = [r.get("id") for r in correction_records]
    require(len(set(correction_ids)) == EXPECTED_REVIEWED_COUNT and set(correction_ids) <= set(ids), "corrections IDs drift")
    correction_changed = set()
    for record in correction_records:
        qid = record["id"]
        require(record.get("order") == target_records[ids.index(qid)]["order"], f"{qid}: correction order drift")
        require(tuple_from_value(record["currentTuple"], f"correction {qid} current") == tuple_from_value(target_records[ids.index(qid)]["currentTuple"], f"target {qid} current"), f"{qid}: correction current tuple drift")
        require(tuple_from_value(record["finalTuple"], f"correction {qid} final") == target_by_id[qid], f"{qid}: correction final tuple drift")
        if semantic(record["currentTuple"]) != semantic(record["finalTuple"]):
            correction_changed.add(qid)
    require(len(correction_changed) == EXPECTED_CHANGED_COUNT, "corrections changed partition drift")
    for qid, final in target_by_id.items():
        selected = [final["primaryTopic"], *final["secondaryTopics"]]
        require(all(topic in runtime for topic in selected), f"{qid}: topic outside runtime taxonomy")
        owned = {skill for skills in runtime.values() for skill in skills}
        require(set(final["skills"]) <= owned, f"{qid}: skill outside runtime taxonomy ownership")
    return ids, target_by_id


def validate(bank_path: Path, target_path: Path, baseline_path: Path, corrections_path: Path, runtime_taxonomy_path: Path, *, peer_bank_path: Path | None = None) -> dict[str, Any]:
    require(sha_file(target_path) == EXPECTED_TARGET_SHA256, "target artifact hash drift")
    require(sha_file(corrections_path) == EXPECTED_CORRECTIONS_SHA256, "correction artifact hash drift")
    runtime_payload = read_json(runtime_taxonomy_path)
    require(runtime_payload.get("sourceSha256") == EXPECTED_RUNTIME_TAXONOMY_SHA256, "runtime taxonomy source hash drift")
    runtime = runtime_payload.get("topics")
    require(isinstance(runtime, dict), "runtime taxonomy topics missing")
    require(runtime and all(isinstance(topic, str) and isinstance(skills, list) and skills for topic, skills in runtime.items()), "runtime taxonomy shape drift")
    all_runtime_skills = [skill for skills in runtime.values() for skill in skills]
    require(len(all_runtime_skills) == len(set(all_runtime_skills)), "runtime taxonomy ownership drift")
    target = read_json(target_path)
    corrections = read_json(corrections_path)
    baseline = read_json(baseline_path)
    ids, target_by_id = validate_target(target, corrections, baseline, runtime)
    questions = questions_from(read_json(bank_path), "bank")
    require([q["id"] for q in questions] == ids, "bank/target ordered ID drift")
    baseline_by_id = {record["id"]: record for record in baseline["records"]}
    mismatches = 0
    drift = 0
    for question in questions:
        final = tuple_from_value(question, f"bank {question['id']}")
        if semantic(final) != semantic(target_by_id[question["id"]]): mismatches += 1
        require(semantic(final) == semantic(target_by_id[question["id"]]), f"{question['id']}: target tuple mismatch")
        if "subtopics" in question:
            require(question["subtopics"] == final["skills"], f"{question['id']}: subtopics do not mirror skills")
        if nonclassification_hash(question) != baseline_by_id[question["id"]]["nonClassificationSha256"]: drift += 1
        require(nonclassification_hash(question) == baseline_by_id[question["id"]]["nonClassificationSha256"], f"{question['id']}: nonclassification drift")
        nested = question.get("classification", {})
        require(nested.get("primary_topic") == final["primaryTopic"] and nested.get("secondary_topics") == final["secondaryTopics"] and nested.get("skills") == final["skills"], f"{question['id']}: nested classification drift")
    if peer_bank_path is not None:
        peer = questions_from(read_json(peer_bank_path), "peer bank")
        require([q["id"] for q in peer] == ids, "source/app ordered ID drift")
        peer_by_id = {q["id"]: q for q in peer}
        for question in questions:
            other = peer_by_id[question["id"]]
            require(semantic(question) == semantic(other), f"{question['id']}: source/app tuple parity")
            require(nonclassification_hash(question) == nonclassification_hash(other), f"{question['id']}: source/app nonclassification parity")
    return {"status": "PASS", "questionCount": EXPECTED_QUESTION_COUNT, "reviewedCount": EXPECTED_REVIEWED_COUNT, "changedCount": EXPECTED_CHANGED_COUNT, "noOpCount": EXPECTED_QUESTION_COUNT - EXPECTED_CHANGED_COUNT, "parityMismatches": mismatches, "nonClassificationDriftCount": drift}


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--bank", type=Path, required=True)
    parser.add_argument("--target", type=Path, required=True)
    parser.add_argument("--baseline", type=Path, required=True)
    parser.add_argument("--corrections", type=Path, required=True)
    parser.add_argument("--runtime-taxonomy", type=Path, required=True)
    parser.add_argument("--peer-bank", type=Path)
    args = parser.parse_args()
    print(json.dumps(validate(args.bank, args.target, args.baseline, args.corrections, args.runtime_taxonomy, peer_bank_path=args.peer_bank), indent=2, sort_keys=True))
