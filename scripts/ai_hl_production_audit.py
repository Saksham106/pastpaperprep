#!/usr/bin/env python3
"""Validate and apply the sealed AI HL full-bank production target."""
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
AUDIT = ROOT / "docs/audits/ib-ai-hl-sources/ai-hl-full-audit"
TARGET = AUDIT / "final-production-target.json"
CORRECTIONS = AUDIT / "final-corrections.json"
BASELINE = AUDIT / "production-baseline-overlay.json"
TAXONOMY = AUDIT / "runtime-taxonomy.json"
PROVENANCE = AUDIT / "final-provenance.json"
CONFLICT_PACKET = AUDIT / "conflict-packet.json"
CONFLICT_RESULT = AUDIT / "conflict-result.json"
EXPECTED_TARGET_SHA = "17e059eaab80cb5e076829ba567eb3f2e2610458565e7f6d870acb8175ee9c0d"
EXPECTED_CORRECTIONS_SHA = "d5ebf3860ad34d0bb165791fa50bf9ca927ab3970bcc7c48138a7abb12598a5d"
EXPECTED_PROVENANCE_SHA = "cc75d2e268cc21c41ea5267eb7028750b5b38120a7279bf9f952dc0968707d3c"
EXPECTED_CONFLICT_PACKET_SHA = "a0025ff5460657bc45a99f0d1de4a5cf170230f39b9f22f6a358d86ffb9a34cc"
EXPECTED_CONFLICT_RESULT_SHA = "3dc86cb0c2c3fe3f3dc09ab467e9440f0ef225e97c880454b2b93215078b80b7"
EXPECTED_COUNT = 409
EXPECTED_REVIEWED = 109
EXPECTED_CHANGED = 87
CLASSIFICATION_FIELDS = frozenset({
    "primaryTopic", "secondaryTopics", "skills", "subtopics", "detailedSubtopics",
    "classificationEvidence", "classificationConfidence", "classificationReviewStatus",
    "classificationVersion", "p3Applicability", "contextTags", "searchText",
})


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def canonical(value: Any) -> bytes:
    return (json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n").encode("utf-8")


def sha_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def load(path: Path) -> Any:
    require(path.is_file() and not path.is_symlink(), f"missing or symlinked audit input: {path}")
    return json.loads(path.read_text(encoding="utf-8"))


def nonclassification(question: dict[str, Any]) -> dict[str, Any]:
    return {key: value for key, value in question.items() if key not in CLASSIFICATION_FIELDS}


def nonclassification_hash(question: dict[str, Any]) -> str:
    return hashlib.sha256(canonical(nonclassification(question))).hexdigest()


def tuple_from_value(value: dict[str, Any], where: str) -> dict[str, Any]:
    require(isinstance(value, dict), f"{where}: tuple must be an object")
    primary, secondary, skills = value.get("primaryTopic"), value.get("secondaryTopics"), value.get("skills")
    require(isinstance(primary, str) and primary.strip(), f"{where}: invalid primary topic")
    require(isinstance(secondary, list) and all(isinstance(x, str) and x.strip() for x in secondary), f"{where}: invalid secondary topics")
    require(len(secondary) == len(set(secondary)) and primary not in secondary, f"{where}: duplicate or primary secondary topic")
    require(isinstance(skills, list) and skills and all(isinstance(x, str) and x.strip() for x in skills), f"{where}: invalid skills")
    require(len(skills) == len(set(skills)), f"{where}: duplicate skills")
    return {"primaryTopic": primary, "secondaryTopics": list(secondary), "skills": list(skills)}


def semantic(value: dict[str, Any]) -> tuple[str, tuple[str, ...], tuple[str, ...]]:
    return value["primaryTopic"], tuple(value["secondaryTopics"]), tuple(sorted(value["skills"]))


def target_tuple(record: dict[str, Any], where: str) -> dict[str, Any]:
    value = dict(record.get("targetTuple", {}))
    gap = value.pop("taxonomyGap", None)
    require(gap is None, f"{where}: unresolved taxonomy gap")
    require(set(value) == {"primaryTopic", "secondaryTopics", "skills"}, f"{where}: target tuple keys drift")
    return tuple_from_value(value, where)


def taxonomy_topics() -> dict[str, list[str]]:
    runtime = load(TAXONOMY)
    require(runtime.get("schemaVersion") == "ai-hl-runtime-taxonomy-v1", "runtime taxonomy schema drift")
    require(runtime.get("sourceSha256") == sha_file(ROOT / "src/lib/taxonomy.ts"), "runtime taxonomy source drift")
    topics = runtime.get("topics")
    require(isinstance(topics, dict) and len(topics) == 5, "runtime taxonomy topic coverage drift")
    owners: dict[str, list[str]] = {}
    for topic, skills in topics.items():
        require(isinstance(topic, str) and isinstance(skills, list) and skills, "runtime taxonomy shape drift")
        require(len(skills) == len(set(skills)), f"runtime taxonomy duplicate skill: {topic}")
        for skill in skills:
            require(skill not in owners, f"runtime taxonomy duplicate owner: {skill}")
            owners[skill] = [topic]
    return topics


def validate_inputs() -> tuple[list[str], dict[str, dict[str, Any]], dict[str, dict[str, Any]], dict[str, Any], dict[str, list[str]]]:
    require(sha_file(TARGET) == EXPECTED_TARGET_SHA, "final target artifact hash drift")
    require(sha_file(CORRECTIONS) == EXPECTED_CORRECTIONS_SHA, "final corrections artifact hash drift")
    require(sha_file(PROVENANCE) == EXPECTED_PROVENANCE_SHA, "final provenance artifact hash drift")
    require(sha_file(CONFLICT_PACKET) == EXPECTED_CONFLICT_PACKET_SHA, "conflict packet artifact hash drift")
    require(sha_file(CONFLICT_RESULT) == EXPECTED_CONFLICT_RESULT_SHA, "conflict result artifact hash drift")
    target, corrections, baseline, provenance = load(TARGET), load(CORRECTIONS), load(BASELINE), load(PROVENANCE)
    topics = taxonomy_topics()
    require(target.get("status") == "PASS" and target.get("schemaVersion") == "ai-hl-full-audit-final-production-target-v1", "final target status/schema drift")
    require(target.get("bank") == "ib-ai-hl" and target.get("questionCount") == EXPECTED_COUNT and target.get("netChangedCount") == EXPECTED_CHANGED and target.get("reviewedDefectCount") == EXPECTED_REVIEWED and target.get("taxonomyGapCount") == 1 and target.get("conflictPacketApplied") is True and target.get("conflictPacketSha256") == EXPECTED_CONFLICT_PACKET_SHA and target.get("conflictResultSha256") == EXPECTED_CONFLICT_RESULT_SHA, "final target count/provenance drift")
    require(provenance.get("schemaVersion") == "ai-hl-full-audit-final-provenance-v1" and provenance.get("conflictPacketApplied") is True, "final production provenance is not conflict-resolved")
    require(isinstance(target.get("records"), list) and len(target["records"]) == EXPECTED_COUNT, "final target coverage drift")
    require(baseline.get("schemaVersion") == "ai-hl-production-baseline-overlay-v1" and baseline.get("questionCount") == EXPECTED_COUNT, "baseline schema/count drift")
    require(isinstance(baseline.get("records"), list) and len(baseline["records"]) == EXPECTED_COUNT, "baseline coverage drift")
    require(isinstance(corrections.get("records"), list) and len(corrections["records"]) == EXPECTED_REVIEWED and corrections.get("changedCount") == 85 and corrections.get("keptCount") == 24 and corrections.get("conflictPacketApplied") is True, "correction coverage/count drift")
    require(isinstance(corrections.get("conflictRecords"), list) and len(corrections["conflictRecords"]) == 6, "conflict correction coverage drift")
    ids = [record.get("id") for record in target["records"]]
    require(ids == [record.get("id") for record in baseline["records"]] and len(set(ids)) == EXPECTED_COUNT, "target/baseline ID order drift")
    target_by_id = {record["id"]: target_tuple(record, f"target {record.get('id')}") for record in target["records"]}
    baseline_by_id = {record["id"]: record for record in baseline["records"]}
    correction_by_id = {record["id"]: record for record in corrections["records"]}
    conflict_by_id = {record["id"]: record for record in corrections["conflictRecords"]}
    require(len(correction_by_id) == EXPECTED_REVIEWED and set(correction_by_id) <= set(ids), "correction missing/extra IDs")
    require(len(conflict_by_id) == 6 and set(conflict_by_id) <= set(ids), "conflict missing/extra IDs")
    for qid, conflict in conflict_by_id.items():
        require(tuple_from_value(conflict.get("finalTuple", {}), f"conflict final {qid}") == target_by_id[qid], f"{qid}: conflict final mismatch")
    changed_ids: set[str] = set()
    for ordinal, record in enumerate(target["records"], 1):
        qid = record["id"]
        require(record.get("ordinal") == ordinal and record.get("position") == ordinal - 1, f"{qid}: target ordinal/position drift")
        current = tuple_from_value(record.get("currentTuple", {}), f"current {qid}")
        baseline_tuple = tuple_from_value(baseline_by_id[qid].get("baselineTuple", {}), f"baseline {qid}")
        require(semantic(current) == semantic(baseline_tuple), f"{qid}: baseline/current mismatch")
        require(isinstance(baseline_by_id[qid].get("nonClassificationSha256"), str) and len(baseline_by_id[qid]["nonClassificationSha256"]) == 64, f"{qid}: baseline hash missing")
        selected = [target_by_id[qid]["primaryTopic"], *target_by_id[qid]["secondaryTopics"]]
        owned = set().union(*(set(topics[topic]) for topic in selected))
        require(set(target_by_id[qid]["skills"]) <= owned, f"{qid}: target taxonomy ownership mismatch")
        if semantic(current) != semantic(target_by_id[qid]):
            changed_ids.add(qid)
        correction = correction_by_id.get(qid)
        if correction:
            require(correction.get("changed") is (qid in changed_ids), f"{qid}: correction changed partition drift")
            require(semantic(tuple_from_value(correction.get("currentTuple", {}), f"correction current {qid}")) == semantic(current), f"{qid}: correction current mismatch")
            require(tuple_from_value(correction.get("finalTuple", {}), f"correction final {qid}") == target_by_id[qid], f"{qid}: correction final mismatch")
        else:
            require(qid not in changed_ids or qid in conflict_by_id, f"{qid}: changed target missing reviewed correction/conflict")
    correction_changed_ids = {qid for qid, record in correction_by_id.items() if record.get("changed") is True}
    require(len(changed_ids) == EXPECTED_CHANGED and len(correction_changed_ids) == 85 and correction_changed_ids <= changed_ids, "target changed count drift")
    require(len(correction_by_id) - len(correction_changed_ids) == EXPECTED_REVIEWED - 85, "correction no-op count drift")
    return ids, target_by_id, baseline_by_id, corrections, topics


def validate_bank(bank_path: Path, peer_path: Path | None = None) -> dict[str, Any]:
    ids, target_by_id, baseline_by_id, corrections, topics = validate_inputs()
    payload = load(bank_path)
    questions = payload.get("questions")
    require(isinstance(questions, list) and [q.get("id") for q in questions] == ids, "app bank ID/order drift")
    correction_by_id = {record["id"]: record for record in corrections["records"]}
    for question in questions:
        qid = question["id"]
        actual = tuple_from_value(question, f"bank {qid}")
        require(actual == target_by_id[qid], f"{qid}: bank target tuple mismatch")
        require(question.get("subtopics") == question.get("skills"), f"{qid}: subtopics must mirror skills")
        require(nonclassification_hash(question) == baseline_by_id[qid]["nonClassificationSha256"], f"{qid}: nonclassification drift")
        selected = [actual["primaryTopic"], *actual["secondaryTopics"]]
        owned = set().union(*(set(topics[topic]) for topic in selected))
        require(set(actual["skills"]) <= owned, f"{qid}: bank taxonomy ownership mismatch")
    if peer_path:
        peer = load(peer_path).get("questions")
        require(isinstance(peer, list) and [q.get("id") for q in peer] == ids, "source/app ID/order parity drift")
        for question, source in zip(questions, peer):
            require(tuple_from_value(question, f"app {question['id']}") == tuple_from_value(source, f"source {source['id']}"), f"{question['id']}: source/app tuple parity")
            require(nonclassification(question) == nonclassification(source), f"{question['id']}: source/app nonclassification drift")
    return {"status": "PASS", "questionCount": EXPECTED_COUNT, "reviewedCount": EXPECTED_REVIEWED, "changedCount": EXPECTED_CHANGED, "noOpCount": EXPECTED_COUNT - EXPECTED_CHANGED, "reviewedNoOpCount": 24, "sourceAppTargetTupleParityCount": EXPECTED_COUNT if peer_path else None, "nonClassificationDriftCount": 0, "taxonomyOwnershipCount": EXPECTED_COUNT}


def apply(bank_path: Path) -> dict[str, Any]:
    ids, target_by_id, baseline_by_id, corrections, _ = validate_inputs()
    payload = load(bank_path)
    questions = payload.get("questions")
    require(isinstance(questions, list) and [q.get("id") for q in questions] == ids, "app bank ID/order drift")
    correction_by_id = {record["id"]: record for record in corrections["records"]}
    before = copy.deepcopy(payload)
    for question in questions:
        qid = question["id"]
        require(nonclassification_hash(question) == baseline_by_id[qid]["nonClassificationSha256"], f"{qid}: nonclassification drift before apply")
        question["primaryTopic"] = target_by_id[qid]["primaryTopic"]
        question["secondaryTopics"] = target_by_id[qid]["secondaryTopics"]
        question["skills"] = target_by_id[qid]["skills"]
        if "subtopics" in question:
            question["subtopics"] = target_by_id[qid]["skills"]
        correction = correction_by_id.get(qid)
        existing = question.get("classificationEvidence") or {}
        summary = correction["rationale"] if correction else existing.get("summary", "Pinned from the reviewed application baseline.")
        question["classificationEvidence"] = {
            "method": "reviewed AI HL full-bank production target",
            "summary": summary,
            "provenance": {
                "targetArtifactSha256": EXPECTED_TARGET_SHA,
                "correctionArtifactSha256": EXPECTED_CORRECTIONS_SHA,
                "baselineOverlaySha256": sha_file(BASELINE),
                "recordId": qid,
                "resolution": next(record["resolution"] for record in load(TARGET)["records"] if record["id"] == qid),
                "changed": bool(correction and correction.get("changed")),
                "sourceRowSha256": next(record["sourceRowSha256"] for record in load(TARGET)["records"] if record["id"] == qid),
            },
        }
        question["classificationConfidence"] = correction.get("confidence", "high") if correction else question.get("classificationConfidence", "high")
        question["classificationReviewStatus"] = "manually-reviewed"
        question["classificationVersion"] = "ib-ai-hl-reviewed-production-target-2026.08.1"
        require(nonclassification_hash(question) == baseline_by_id[qid]["nonClassificationSha256"], f"{qid}: nonclassification drift after apply")
    for old, new in zip(before["questions"], questions):
        require(nonclassification(old) == nonclassification(new), f"{old['id']}: nonclassification field drift")
    data = (json.dumps(payload, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
    with tempfile.NamedTemporaryFile("wb", dir=bank_path.parent, prefix=f".{bank_path.name}.", delete=False) as handle:
        handle.write(data)
        temporary = Path(handle.name)
    os.replace(temporary, bank_path)
    return {"status": "PASS", "questionCount": EXPECTED_COUNT, "reviewedCount": EXPECTED_REVIEWED, "changedCount": EXPECTED_CHANGED, "noOpCount": EXPECTED_COUNT - EXPECTED_CHANGED}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--bank", type=Path, default=ROOT / "src/data/raw/ib-ai-hl.json")
    parser.add_argument("--peer-bank", type=Path)
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    result = apply(args.bank) if args.apply else validate_bank(args.bank, args.peer_bank)
    print(json.dumps(result, indent=2, sort_keys=True))
