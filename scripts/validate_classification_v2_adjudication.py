#!/usr/bin/env python3
"""Fail-closed validator for classification-contract-v2 adjudication outputs."""
from __future__ import annotations

import argparse
import hashlib
import json
from collections import Counter
from pathlib import Path
from typing import Any

AUDIT_VERSION = "classification-contract-v2.0"
VERDICTS = {"source_correct", "blind_correct", "modified", "taxonomy_gap"}
CONFIDENCES = {"high", "medium", "low"}

# These are ordered lists intentionally: adjudication artifacts are a stable,
# human-reviewed interchange format, not an arbitrary JSON object.
MANIFEST_KEYS = sorted([
    "auditVersion", "bank", "queueSha256", "count", "batchCount", "batchSize",
    "orderedIdSha256", "provenance", "batches",
])
QUEUE_KEYS = sorted(["auditVersion", "bank", "count", "counts", "provenance", "records"])
INPUT_KEYS = sorted(["auditVersion", "bank", "batch", "count", "taxonomy", "records", "inputSha256"])
INPUT_ROW_KEYS = sorted([
    "bank", "id", "category", "mismatchTypes", "source", "blind", "questionAssets",
    "markschemeAssets", "officialMarkschemeUnavailable",
])
RESULT_KEYS = ["auditVersion", "batch", "inputSha256", "count", "judgments"]
RESULT_KEYS = sorted(RESULT_KEYS)
ROW_KEYS = sorted([
    "bank", "id", "verdict", "primaryTopic", "secondaryTopics", "skills", "confidence",
    "taxonomyGap", "evidence", "rationale", "inspectedQuestionAssets",
    "inspectedMarkschemeAssets",
])


def canonical_bytes(value: Any) -> bytes:
    return (
        json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n"
    ).encode("utf-8")


def sha_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def sha_file(path: Path) -> str:
    try:
        return sha_bytes(path.read_bytes())
    except OSError as exc:
        raise ValueError(f"cannot read {path}: {exc}") from exc


def read_json(path: Path) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ValueError(f"cannot read JSON {path}: {exc}") from exc


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def nonempty_string(value: Any, label: str) -> str:
    require(isinstance(value, str) and bool(value.strip()), f"{label}: expected non-empty string")
    return value


def nonempty_evidence(value: Any) -> bool:
    if isinstance(value, str):
        return bool(value.strip())
    if isinstance(value, list):
        return bool(value) and all(nonempty_evidence(item) for item in value)
    if isinstance(value, dict):
        return bool(value) and all(
            isinstance(key, str) and bool(key.strip()) and nonempty_evidence(item)
            for key, item in value.items()
        )
    return False


def labels(value: Any, label: str) -> list[str]:
    require(isinstance(value, list), f"{label}: expected list")
    result = [nonempty_string(item, f"{label}[{index}]") for index, item in enumerate(value)]
    require(len(result) == len(set(result)), f"{label}: duplicate labels")
    return result


def meaningful_gap(value: Any, label: str) -> str:
    require(isinstance(value, str) and bool(value.strip()), f"{label}: taxonomy gap must be nonempty")
    require(value.strip().lower() not in {"none", "no", "n/a"}, f"{label}: taxonomy gap must be meaningful")
    return value


def semantic(value: dict[str, Any]) -> tuple[str, tuple[str, ...], tuple[str, ...], str | None]:
    """Return the comparison tuple, including taxonomyGap as a semantic field."""
    return (
        value["primaryTopic"],
        tuple(sorted(value.get("secondaryTopics") or [])),
        tuple(sorted(value.get("skills") or [])),
        value.get("taxonomyGap"),
    )


def _exact_keys(value: Any, expected: list[str], label: str) -> None:
    require(isinstance(value, dict), f"{label}: expected object")
    require(list(value) == expected, f"{label}: keys")


def _assets(value: Any, label: str) -> list[str]:
    paths = labels(value, label)
    require(all(Path(path).is_file() for path in paths), f"{label}: missing asset")
    return paths


def _validate_taxonomy(value: Any, label: str) -> dict[str, list[str]]:
    require(isinstance(value, dict) and value, f"{label}: expected non-empty object")
    taxonomy: dict[str, list[str]] = {}
    for topic, skills in value.items():
        topic_name = nonempty_string(topic, f"{label} topic")
        taxonomy[topic_name] = labels(skills, f"{label}.{topic_name}")
    return taxonomy


def _validate_proposal(value: Any, label: str) -> None:
    require(isinstance(value, dict), f"{label}: proposal object")
    primary = nonempty_string(value.get("primaryTopic"), f"{label}.primaryTopic")
    labels(value.get("secondaryTopics"), f"{label}.secondaryTopics")
    labels(value.get("skills"), f"{label}.skills")
    gap = value.get("taxonomyGap")
    if gap is not None:
        meaningful_gap(gap, f"{label}.taxonomyGap")
    # Keep the local binding explicit so malformed proposals cannot be
    # accidentally accepted merely because their arrays happen to be valid.
    require(bool(primary), f"{label}.primaryTopic: expected non-empty string")


def _validate_output_row(
    row: Any,
    packet_record: dict[str, Any],
    taxonomy: dict[str, list[str]],
    label: str,
) -> dict[str, Any]:
    _exact_keys(row, ROW_KEYS, label)
    assert isinstance(row, dict)
    require(row["bank"] == packet_record["bank"], f"{label}: bank")
    require(row["id"] == packet_record["id"], f"{label}: ID mismatch")

    primary = nonempty_string(row["primaryTopic"], f"{label}.primaryTopic")
    secondary = labels(row["secondaryTopics"], f"{label}.secondaryTopics")
    skills = labels(row["skills"], f"{label}.skills")
    require(primary in taxonomy, f"{label}: uncontrolled primary topic {primary}")
    require(primary not in secondary, f"{label}: primary in secondary topics")
    require(all(topic in taxonomy for topic in secondary), f"{label}: uncontrolled secondary topic")
    owned = {skill for topic in [primary, *secondary] for skill in taxonomy[topic]}
    require(all(skill in owned for skill in skills), f"{label}: skill not owned by selected topic")

    require(row["verdict"] in VERDICTS, f"{label}: invalid verdict")
    require(row["confidence"] in CONFIDENCES, f"{label}: invalid confidence")
    gap = row["taxonomyGap"]
    if gap is not None:
        meaningful_gap(gap, f"{label}.taxonomyGap")
    require(nonempty_evidence(row["evidence"]), f"{label}: nonempty evidence required")
    require(isinstance(row["rationale"], str) and bool(row["rationale"].strip()), f"{label}: nonempty rationale required")
    require(row["inspectedQuestionAssets"] == packet_record["questionAssets"], f"{label}: question assets drift")
    require(row["inspectedMarkschemeAssets"] == packet_record["markschemeAssets"], f"{label}: markscheme assets drift")
    _assets(row["inspectedQuestionAssets"], f"{label}.inspectedQuestionAssets")
    _assets(row["inspectedMarkschemeAssets"], f"{label}.inspectedMarkschemeAssets")

    source = packet_record["source"]
    blind = packet_record["blind"]
    source_tuple = semantic(source)
    blind_tuple = semantic(blind)
    final_tuple = semantic(row)
    verdict = row["verdict"]
    if verdict == "source_correct":
        require(gap is None, f"{label}: source_correct requires null taxonomy gap")
        require(final_tuple == source_tuple, f"{label}: source_correct tuple mismatch")
    elif verdict == "blind_correct":
        require(final_tuple == blind_tuple, f"{label}: blind_correct tuple mismatch")
    elif verdict == "modified":
        require(gap is None, f"{label}: modified requires null taxonomy gap")
        require(final_tuple != source_tuple and final_tuple != blind_tuple, f"{label}: modified is a no-op")
    else:  # taxonomy_gap
        meaningful_gap(gap, f"{label}.taxonomyGap")

    return row


def _validate_packet(packet: Any, expected_records: list[dict[str, Any]], expected_batch: int, label: str) -> dict[str, Any]:
    _exact_keys(packet, INPUT_KEYS, label)
    assert isinstance(packet, dict)
    require(packet["auditVersion"] == AUDIT_VERSION, f"{label}: auditVersion drift")
    require(packet["batch"] == expected_batch, f"{label}: batch")
    require(packet["count"] == len(packet["records"]), f"{label}: count")
    require(isinstance(packet["records"], list), f"{label}: records")
    require(packet["records"] == expected_records, f"{label}: adjudication input drift")
    require(packet["inputSha256"] == sha_bytes(canonical_bytes({k: packet[k] for k in packet if k != "inputSha256"})), f"{label}: input hash drift")
    return packet


def validate(root: Path, *, allow_incomplete: bool = False) -> dict[str, Any]:
    """Validate all available adjudication batches under *root*.

    The queue, manifest, and every input packet are sealed before results are
    inspected.  ``allow_incomplete`` only relaxes missing-result coverage; it
    never relaxes schema, provenance, ordering, or semantic checks.
    """
    root = Path(root).resolve()
    manifest_path = root / "adjudication-manifest.json"
    queue_path = root / "adjudication-queue.json"
    manifest = read_json(manifest_path)
    _exact_keys(manifest, MANIFEST_KEYS, "manifest")
    assert isinstance(manifest, dict)
    require(manifest["auditVersion"] == AUDIT_VERSION, "manifest: auditVersion drift")
    bank = nonempty_string(manifest["bank"], "manifest.bank")
    require(sha_file(queue_path) == manifest["queueSha256"], "queue hash drift")

    queue = read_json(queue_path)
    _exact_keys(queue, QUEUE_KEYS, "queue")
    assert isinstance(queue, dict)
    require(queue["auditVersion"] == AUDIT_VERSION and queue["bank"] == bank, "queue identity drift")
    queue_records = queue["records"]
    require(isinstance(queue_records, list), "queue.records: expected list")
    require(isinstance(queue["count"], int) and isinstance(manifest["count"], int), "queue count drift")
    require(queue["count"] == len(queue_records) == manifest["count"], "queue count drift")
    queue_ids: list[str] = []
    seen_queue: set[str] = set()
    for index, record in enumerate(queue_records):
        _exact_keys(record, INPUT_ROW_KEYS, f"queue.records[{index}]")
        assert isinstance(record, dict)
        question_id = nonempty_string(record["id"], f"queue.records[{index}].id")
        require(question_id not in seen_queue, f"duplicate input ID {question_id}")
        seen_queue.add(question_id)
        require(record["bank"] == bank, f"{question_id}: input bank")
        _assets(record["questionAssets"], f"{question_id}.questionAssets")
        _assets(record["markschemeAssets"], f"{question_id}.markschemeAssets")
        _validate_proposal(record["source"], f"{question_id}.source")
        _validate_proposal(record["blind"], f"{question_id}.blind")
        queue_ids.append(question_id)
    require(sha_bytes(canonical_bytes(queue_ids)) == manifest["orderedIdSha256"], "ordered ID hash mismatch")

    input_dir = root / "adjudication-inputs"
    input_paths = sorted(path for path in input_dir.iterdir() if path.is_file()) if input_dir.is_dir() else []
    if not input_paths:
        require(manifest["count"] == 0 and manifest["batchCount"] == 0, "adjudication inputs are missing")
    require(all(path.name.startswith("batch-") and path.name.endswith(".json") for path in input_paths), "invalid adjudication input filename")
    manifest_batches = manifest["batches"]
    require(isinstance(manifest_batches, dict), "manifest.batches: expected object")
    require(set(manifest_batches) == {path.name for path in input_paths}, "manifest batch set drift")
    require(isinstance(manifest["batchCount"], int) and manifest["batchCount"] > 0, "manifest batch count drift")
    require(manifest["batchCount"] == len(input_paths), "manifest batch count drift")
    provenance = manifest["provenance"]
    require(isinstance(provenance, dict), "manifest provenance drift")
    taxonomy_provenance = provenance.get("taxonomy")
    if taxonomy_provenance is not None:
        require(isinstance(taxonomy_provenance, dict), "manifest taxonomy provenance drift")
        require(isinstance(taxonomy_provenance.get("canonicalBankSha256"), str), "manifest taxonomy provenance drift")
        taxonomy_path_value = taxonomy_provenance.get("path")
        taxonomy_file_hash = taxonomy_provenance.get("sha256")
        if taxonomy_path_value is not None and taxonomy_file_hash is not None:
            taxonomy_path = Path(taxonomy_path_value)
            require(taxonomy_path.is_file() and sha_file(taxonomy_path) == taxonomy_file_hash, "taxonomy file hash drift")

    expected_by_batch: dict[str, list[dict[str, Any]]] = {}
    pinned_taxonomy: dict[str, list[str]] | None = None
    cursor = 0
    for index, input_path in enumerate(input_paths, start=1):
        require(input_path.name == f"batch-{index:02d}.json", f"unexpected input batch order {input_path.name}")
        metadata = manifest_batches[input_path.name]
        require(isinstance(metadata, dict), f"{input_path.name}: manifest metadata")
        require(metadata.get("count") is not None and metadata.get("sha256") is not None, f"{input_path.name}: manifest metadata")
        require(sha_file(input_path) == metadata["sha256"], f"{input_path.name}: input hash drift")
        require(isinstance(metadata["count"], int) and metadata["count"] >= 0, f"{input_path.name}: manifest count")
        packet_records = queue_records[cursor : cursor + metadata["count"]]
        cursor += metadata["count"]
        packet = _validate_packet(read_json(input_path), packet_records, index, input_path.name)
        require(packet["bank"] == bank, f"{input_path.name}: bank drift")
        packet_taxonomy = _validate_taxonomy(packet["taxonomy"], f"{input_path.name}.taxonomy")
        if taxonomy_provenance is not None:
            require(
                sha_bytes(canonical_bytes(packet_taxonomy)) == taxonomy_provenance["canonicalBankSha256"],
                f"{input_path.name}: taxonomy hash drift",
            )
        if pinned_taxonomy is None:
            pinned_taxonomy = packet_taxonomy
        else:
            require(packet_taxonomy == pinned_taxonomy, f"{input_path.name}: taxonomy drift")
        expected_by_batch[input_path.name] = packet_records
    require(cursor == len(queue_records), "input coverage mismatch")

    result_dir = root / "adjudication-results"
    result_paths = sorted(path for path in result_dir.iterdir() if path.is_file()) if result_dir.is_dir() else []
    require(all(path.name.startswith("batch-") and path.name.endswith(".json") for path in result_paths), "invalid adjudication result filename")
    input_names = {path.name for path in input_paths}
    result_names = {path.name for path in result_paths}
    extra = sorted(result_names - input_names)
    if extra:
        raise ValueError(f"extra result {extra[0]}")
    result_by_name = {path.name: path for path in result_paths}

    reviewed_ids: list[str] = []
    verdicts: dict[str, str] = {}
    taxonomy_gaps = 0
    for input_path in input_paths:
        result_path = result_by_name.get(input_path.name)
        if result_path is None:
            if not allow_incomplete:
                raise ValueError(f"missing result {input_path.name}")
            continue
        packet = read_json(input_path)
        result = read_json(result_path)
        _exact_keys(result, RESULT_KEYS, f"{result_path.name}: top keys")
        assert isinstance(result, dict)
        require(result["auditVersion"] == packet["auditVersion"], f"{result_path.name}: auditVersion")
        require(result["batch"] == packet["batch"], f"{result_path.name}: batch")
        require(result["inputSha256"] == packet["inputSha256"], f"{result_path.name}: input hash")
        judgments = result["judgments"]
        require(isinstance(judgments, list), f"{result_path.name}: judgments")
        require(result["count"] == packet["count"] == len(judgments), f"{result_path.name}: count")
        expected_records = expected_by_batch[input_path.name]
        judgment_ids = [row.get("id") if isinstance(row, dict) else None for row in judgments]
        if all(isinstance(question_id, str) for question_id in judgment_ids) and len(judgment_ids) != len(set(judgment_ids)):
            raise ValueError(f"{result_path.name}: duplicate reviewed IDs")
        require(judgment_ids == [row["id"] for row in expected_records], f"{result_path.name}: ordered IDs mismatch")
        for row, packet_record in zip(judgments, expected_records, strict=True):
            question_id = packet_record["id"]
            require(question_id not in verdicts, f"duplicate reviewed ID {question_id}")
            checked = _validate_output_row(row, packet_record, _validate_taxonomy(packet["taxonomy"], f"{result_path.name}.taxonomy"), f"{result_path.name}/{question_id}")
            reviewed_ids.append(question_id)
            verdicts[question_id] = checked["verdict"]
            taxonomy_gaps += checked["verdict"] == "taxonomy_gap"

    require(len(reviewed_ids) == len(set(reviewed_ids)), "duplicate reviewed IDs")
    expected_reviewed = [question_id for question_id in queue_ids if question_id in set(reviewed_ids)]
    require(reviewed_ids == expected_reviewed, "reviewed ID order mismatch")
    complete = len(reviewed_ids) == manifest["count"]
    if not allow_incomplete:
        require(complete, "review coverage mismatch")
    return {
        "status": "PASS",
        "bank": bank,
        "reviewed": len(reviewed_ids),
        "expected": manifest["count"],
        "taxonomyGaps": taxonomy_gaps,
        "verdicts": verdicts,
        "complete": complete,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("root", type=Path)
    parser.add_argument("--allow-incomplete", action="store_true")
    args = parser.parse_args()
    print(json.dumps(validate(args.root, allow_incomplete=args.allow_incomplete), indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
