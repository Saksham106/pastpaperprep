#!/usr/bin/env python3
"""Fail-closed validation for the reviewed AA HL production target."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

EXPECTED_TARGET_SHA256 = "a949ef162921455b8150778e8c4861f4e96b496e78d56d88b3171da9a9760731"
EXPECTED_CORRECTIONS_SHA256 = "4a0c3918cd3cefc97812f792fe8447c3f9cd6872d3942c3ceaf283b48b2de92b"
EXPECTED_RUNTIME_TAXONOMY_SHA256 = "572967d0f51980ebbf5a12962b46cf9fa08a22cbd22806655ffc9d4b5e6f54a3"
EXPECTED_QUESTION_COUNT = 841
EXPECTED_REVIEWED_COUNT = 221
EXPECTED_CHANGED_COUNT = 214
CLASSIFICATION_FIELDS = frozenset({
    "primaryTopic", "secondaryTopics", "skills", "subtopics", "detailedSubtopics",
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


def semantic(value: dict[str, Any]) -> tuple[str, tuple[str, ...], tuple[str, ...]]:
    return (value["primaryTopic"], tuple(value["secondaryTopics"]), tuple(value["skills"]))


def nonclassification_hash(question: dict[str, Any]) -> str:
    preserved = {key: value for key, value in question.items() if key not in CLASSIFICATION_FIELDS}
    return sha_bytes(canonical_bytes(preserved))


def questions_from(payload: Any, label: str) -> list[dict[str, Any]]:
    questions = payload.get("questions") if isinstance(payload, dict) else payload
    require(isinstance(questions, list), f"{label}: questions must be a list")
    require(len(questions) == EXPECTED_QUESTION_COUNT, f"{label}: expected {EXPECTED_QUESTION_COUNT} questions")
    ids = [q.get("id") for q in questions if isinstance(q, dict)]
    require(len(ids) == len(questions) and all(isinstance(x, str) and x for x in ids), f"{label}: invalid question IDs")
    require(len(ids) == len(set(ids)), f"{label}: duplicate question IDs")
    return questions


def taxonomy_topics(payload: Any) -> dict[str, list[str]]:
    value = payload.get("topics") if isinstance(payload, dict) and isinstance(payload.get("topics"), dict) else payload
    require(isinstance(value, dict) and value, "runtime taxonomy: expected topic map")
    result: dict[str, list[str]] = {}
    seen: set[str] = set()
    for topic, skills in value.items():
        require(isinstance(topic, str) and topic.strip(), "runtime taxonomy: invalid topic")
        require(isinstance(skills, list) and skills, f"runtime taxonomy.{topic}: invalid skills")
        result[topic] = list(skills)
        require(len(skills) == len(set(skills)), f"runtime taxonomy.{topic}: duplicate skill")
        require(not seen.intersection(skills), f"runtime taxonomy: skill has multiple owners")
        seen.update(skills)
    return result


def validate_target(target: dict[str, Any], corrections: dict[str, Any], baseline: dict[str, Any], runtime: dict[str, list[str]]) -> tuple[list[str], dict[str, dict[str, Any]]]:
    require(target.get("schemaVersion") == "aa-hl-reviewed-production-target-v2", "target schema drift")
    require(target.get("status") == "PASS", "target status is not PASS")
    require(target.get("questionCount") == EXPECTED_QUESTION_COUNT, "target count drift")
    require(target.get("netChangedCount") == EXPECTED_CHANGED_COUNT, "target changed count drift")
    require(corrections.get("schemaVersion") == "aa-hl-latest-final-corrections-v1", "corrections schema drift")
    require(corrections.get("status") == "PASS", "corrections status is not PASS")
    require(corrections.get("reviewedCount") == EXPECTED_REVIEWED_COUNT, "corrections reviewed count drift")
    require(corrections.get("netChangedCount") == EXPECTED_CHANGED_COUNT, "corrections changed count drift")
    target_records = target.get("records")
    require(isinstance(target_records, list) and len(target_records) == EXPECTED_QUESTION_COUNT, "target records coverage drift")
    target_ids: list[str] = []
    target_by_id: dict[str, dict[str, Any]] = {}
    for ordinal, record in enumerate(target_records, 1):
        require(isinstance(record, dict) and record.get("ordinal") == ordinal, f"target ordinal drift at {ordinal}")
        question_id = record.get("id")
        require(isinstance(question_id, str) and question_id not in target_by_id, f"target ID drift at {ordinal}")
        target_ids.append(question_id)
        target_by_id[question_id] = tuple_from_value(record.get("targetTuple", {}), f"target {question_id}")
    baseline_records = baseline.get("records")
    require(isinstance(baseline_records, list) and len(baseline_records) == EXPECTED_QUESTION_COUNT, "baseline coverage drift")
    baseline_ids = [record.get("id") for record in baseline_records]
    require(baseline_ids == target_ids, "baseline/target ordered ID drift")
    require(baseline.get("questionCount") == EXPECTED_QUESTION_COUNT, "baseline count drift")
    changed = 0
    for ordinal, (record, question_id) in enumerate(zip(baseline_records, target_ids), 1):
        require(record.get("ordinal") == ordinal, "baseline ordinal malformed")
        before = tuple_from_value(record.get("baselineTuple", {}), f"baseline {question_id}")
        after = target_by_id[question_id]
        changed += semantic(before) != semantic(after)
        require(isinstance(record.get("nonClassificationSha256"), str) and len(record["nonClassificationSha256"]) == 64, f"baseline {question_id}: nonclassification hash")
    require(changed == EXPECTED_CHANGED_COUNT, f"baseline/target changed partition drift: {changed}")
    require(changed + (EXPECTED_QUESTION_COUNT - changed) == EXPECTED_QUESTION_COUNT, "baseline/target partition is not disjoint")
    return target_ids, target_by_id


def validate(
    bank_path: Path,
    target_path: Path,
    baseline_path: Path,
    corrections_path: Path,
    runtime_taxonomy_path: Path,
    *,
    peer_bank_path: Path | None = None,
) -> dict[str, Any]:
    require(sha_file(target_path) == EXPECTED_TARGET_SHA256, "target artifact hash drift")
    require(sha_file(corrections_path) == EXPECTED_CORRECTIONS_SHA256, "correction artifact hash drift")
    runtime = taxonomy_topics(read_json(runtime_taxonomy_path))
    target = read_json(target_path)
    corrections = read_json(corrections_path)
    baseline = read_json(baseline_path)
    ids, target_by_id = validate_target(target, corrections, baseline, runtime)
    bank_questions = questions_from(read_json(bank_path), "bank")
    bank_ids = [q["id"] for q in bank_questions]
    require(bank_ids == ids, "bank/target ordered ID drift")
    baseline_by_id = {record["id"]: record for record in baseline["records"]}
    for question in bank_questions:
        question_id = question["id"]
        final = tuple_from_value(question, f"bank {question_id}")
        require(semantic(final) == semantic(target_by_id[question_id]), f"{question_id}: target tuple mismatch")
        selected_topics = [final["primaryTopic"], *final["secondaryTopics"]]
        require(all(topic in runtime for topic in selected_topics), f"{question_id}: target topic outside runtime taxonomy")
        owned = {skill for topic in selected_topics for skill in runtime[topic]}
        require(set(final["skills"]).issubset(owned), f"{question_id}: target skill outside selected-topic ownership")
        if "subtopics" in question:
            require(question["subtopics"] == final["skills"], f"{question_id}: app subtopics do not mirror skills")
        require(nonclassification_hash(question) == baseline_by_id[question_id]["nonClassificationSha256"], f"{question_id}: nonclassification drift")
    corrections_ids = [record.get("id") for record in corrections.get("records", [])]
    require(len(corrections_ids) == EXPECTED_REVIEWED_COUNT and len(set(corrections_ids)) == EXPECTED_REVIEWED_COUNT, "corrections reviewed ID coverage drift")
    require(set(corrections_ids).issubset(set(ids)), "corrections contain unknown IDs")
    correction_by_id = {record["id"]: record for record in corrections["records"]}
    changed_ids = {question_id for question_id in ids if semantic(tuple_from_value(baseline_by_id[question_id]["baselineTuple"], f"baseline {question_id}")) != semantic(target_by_id[question_id])}
    reviewed_changed_ids = {record["id"] for record in corrections["records"] if record.get("changedFromLatest") is True}
    reviewed_unchanged_ids = {record["id"] for record in corrections["records"] if record.get("changedFromLatest") is False}
    require(len(reviewed_changed_ids) == EXPECTED_CHANGED_COUNT and len(reviewed_unchanged_ids) == EXPECTED_REVIEWED_COUNT - EXPECTED_CHANGED_COUNT, "corrections changed/no-op partition drift")
    require(changed_ids == reviewed_changed_ids, "target/corrections changed ID drift")
    require(changed_ids.isdisjoint(set(ids) - changed_ids), "changed/no-op partition is not disjoint")
    if peer_bank_path is not None:
        peer_questions = questions_from(read_json(peer_bank_path), "peer bank")
        require([q["id"] for q in peer_questions] == ids, "source/app ordered ID drift")
        peer_by_id = {q["id"]: q for q in peer_questions}
        for question in bank_questions:
            peer = peer_by_id[question["id"]]
            require(semantic(tuple_from_value(question, f"bank {question['id']}")) == semantic(tuple_from_value(peer, f"peer {question['id']}")), f"{question['id']}: source/app tuple parity")
            require(nonclassification_hash(question) == nonclassification_hash(peer), f"{question['id']}: source/app nonclassification parity")
    return {
        "status": "PASS",
        "questionCount": EXPECTED_QUESTION_COUNT,
        "reviewedCount": EXPECTED_REVIEWED_COUNT,
        "changedCount": EXPECTED_CHANGED_COUNT,
        "noOpCount": EXPECTED_QUESTION_COUNT - EXPECTED_CHANGED_COUNT,
        "sourceAppTargetTupleParityCount": EXPECTED_QUESTION_COUNT if peer_bank_path else None,
        "nonClassificationDriftCount": 0,
        "taxonomyOwnershipCount": EXPECTED_QUESTION_COUNT,
    }


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
