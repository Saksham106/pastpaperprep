#!/usr/bin/env python3
"""Compare a sealed v2 blind bank with frozen source classifications.

The command is deliberately read-only with respect to source, taxonomy, and blind
artifacts.  It validates the complete sealed bank before creating an adjudication
queue, so malformed or drifted inputs cannot produce a partial queue.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shutil
import tempfile
from collections import Counter
from pathlib import Path
from typing import Any

AUDIT_VERSION = "classification-contract-v2.0"
CONFIDENCES = {"high", "medium", "low"}


def canonical_bytes(value: Any) -> bytes:
    return (json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n").encode("utf-8")


def sha_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def sha_file(path: Path) -> str:
    return sha_bytes(path.read_bytes())


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
        return bool(value) and all(isinstance(key, str) and bool(key.strip()) and nonempty_evidence(item) for key, item in value.items())
    return False


def strings(value: Any, label: str, *, allow_missing: bool = False) -> list[str]:
    if value is None and allow_missing:
        return []
    require(isinstance(value, list), f"{label}: expected list")
    result: list[str] = []
    for index, item in enumerate(value):
        result.append(nonempty_string(item, f"{label}[{index}]"))
    require(len(result) == len(set(result)), f"{label}: duplicate labels")
    return result


def normalized_skill_union(question: dict[str, Any]) -> list[str]:
    """Include every stored skill representation without inventing labels.

    0580 stores the filterable vocabulary in both ``subtopics`` and
    ``detailedSubtopics``.  Some banks store ``skills`` instead.  The union is
    only across fields actually present in the source record; taxonomy ownership
    is never used to fill an absent field.
    """
    values: list[str] = []
    for field in ("skills", "subtopics", "detailedSubtopics"):
        if field not in question or question[field] is None:
            continue
        for value in strings(question[field], f"source {question.get('id')}.{field}"):
            if value not in values:
                values.append(value)
    return sorted(values)


def normalized_taxonomy(value: Any, label: str) -> dict[str, list[str]]:
    require(isinstance(value, dict) and value, f"{label}: expected non-empty object")
    result: dict[str, list[str]] = {}
    for topic, owned in value.items():
        nonempty_string(topic, f"{label} topic")
        labels = strings(owned, f"{label}.{topic}")
        result[topic] = sorted(labels)
    return dict(sorted(result.items()))


def source_questions(payload: Any) -> list[dict[str, Any]]:
    questions = payload.get("questions") if isinstance(payload, dict) else payload
    require(isinstance(questions, list), "source questions: expected a list")
    result: list[dict[str, Any]] = []
    seen: set[str] = set()
    for index, question in enumerate(questions):
        require(isinstance(question, dict), f"source question {index}: expected object")
        question_id = nonempty_string(question.get("id"), f"source question {index}.id")
        require(question_id not in seen, f"duplicate source ID {question_id}")
        seen.add(question_id)
        result.append(question)
    return result


def asset_candidates(reference: str, source_path: Path, asset_root: Path | None) -> list[Path]:
    path = Path(reference)
    if path.is_absolute():
        return [path]
    candidates: list[Path] = []
    if asset_root is not None:
        candidates.append(asset_root / path)
    # Supports the repository's source JSON (src/data/raw/*.json), generated
    # source roots (site/data/questions.json), and self-contained fixtures.
    for parent in (source_path.parent, source_path.parent.parent, source_path.parent.parent.parent):
        candidates.extend((parent / path, parent / "site" / path, parent / "public" / path))
    return candidates


def resolve_asset(reference: Any, source_path: Path, asset_root: Path | None, label: str) -> Path:
    ref = nonempty_string(reference, label)
    for candidate in asset_candidates(ref, source_path, asset_root):
        if candidate.is_file():
            return candidate.resolve()
    raise ValueError(f"{label}: missing asset {ref}")


def source_assets(question: dict[str, Any], source_path: Path, asset_root: Path | None) -> tuple[list[str], list[str]]:
    question_refs = strings(question.get("questionImages"), f"source {question['id']}.questionImages")
    mark_refs = strings(question.get("markschemeImages"), f"source {question['id']}.markschemeImages", allow_missing=True)
    if not mark_refs and isinstance(question.get("officialMarkscheme"), dict):
        mark_refs = strings(question["officialMarkscheme"].get("images"), f"source {question['id']}.officialMarkscheme.images", allow_missing=True)
    question_paths = [resolve_asset(ref, source_path, asset_root, f"source {question['id']}.questionImages") for ref in question_refs]
    mark_paths = [resolve_asset(ref, source_path, asset_root, f"source {question['id']}.markschemeImages") for ref in mark_refs]
    return question_refs, mark_refs


def source_tuple(question: dict[str, Any], taxonomy: dict[str, list[str]], source_path: Path, asset_root: Path | None) -> dict[str, Any]:
    question_id = question["id"]
    primary = nonempty_string(question.get("primaryTopic"), f"source {question_id}.primaryTopic")
    secondary = strings(question.get("secondaryTopics"), f"source {question_id}.secondaryTopics")
    require(primary in taxonomy, f"source {question_id}: unowned primary {primary}")
    require(all(topic in taxonomy for topic in secondary), f"source {question_id}: unowned secondary")
    require(primary not in secondary, f"source {question_id}: primary in secondary topics")
    skills = normalized_skill_union(question)
    owned = {skill for topic in [primary, *secondary] for skill in taxonomy[topic]}
    controlled = {skill for topic_skills in taxonomy.values() for skill in topic_skills}
    taxonomy_violations = [
        {"skill": skill, "kind": "unowned" if skill in controlled else "uncontrolled"}
        for skill in skills
        if skill not in owned
    ]
    question_refs, mark_refs = source_assets(question, source_path, asset_root)
    return {
        "primaryTopic": primary,
        "secondaryTopics": secondary,
        "skills": skills,
        "taxonomyViolations": taxonomy_violations,
        "questionAssets": question_refs,
        "markschemeAssets": mark_refs,
        "officialMarkschemeUnavailable": not bool(mark_refs),
    }


def validate_blind_row(row: Any, packet_record: dict[str, Any], taxonomy: dict[str, list[str]], source_path: Path, asset_root: Path | None, label: str) -> dict[str, Any]:
    require(isinstance(row, dict), f"{label}: expected object")
    allowed_keys = {"id", "bank", "primaryTopic", "secondaryTopics", "skills", "confidence", "taxonomyGap", "evidence", "rationale", "inspectedQuestionAssets", "inspectedMarkschemeAssets", "officialMarkschemeUnavailable"}
    require(set(row).issubset(allowed_keys), f"{label}: invalid result fields")
    question_id = nonempty_string(row.get("id"), f"{label}.id")
    require(question_id == packet_record["id"], f"{label}: ID mismatch")
    if "bank" in row:
        require(row["bank"] == packet_record["bank"], f"{label}: bank mismatch")
    primary = nonempty_string(row.get("primaryTopic"), f"{label}.primaryTopic")
    secondary = strings(row.get("secondaryTopics"), f"{label}.secondaryTopics")
    skills = strings(row.get("skills"), f"{label}.skills")
    require(primary in taxonomy, f"{label}: unowned primary {primary}")
    require(primary not in secondary, f"{label}: primary in secondary topics")
    require(all(topic in taxonomy for topic in secondary), f"{label}: unowned secondary")
    owned = {skill for topic in [primary, *secondary] for skill in taxonomy[topic]}
    require(all(skill in owned for skill in skills), f"{label}: unowned skill")
    require(row.get("confidence") in CONFIDENCES, f"{label}: invalid confidence")
    gap = row.get("taxonomyGap")
    require(gap is None or (isinstance(gap, str) and bool(gap.strip())), f"{label}: invalid taxonomy gap")
    require(row.get("inspectedQuestionAssets") == packet_record["questionAssets"], f"{label}: question assets drift")
    require(row.get("inspectedMarkschemeAssets") == packet_record["markschemeAssets"], f"{label}: markscheme assets drift")
    require(row.get("officialMarkschemeUnavailable") == packet_record["officialMarkschemeUnavailable"], f"{label}: markscheme flag drift")
    require(nonempty_evidence(row.get("evidence")), f"{label}: missing evidence")
    require(isinstance(row.get("rationale"), str) and bool(row["rationale"].strip()), f"{label}: missing rationale")
    q_assets = strings(row["inspectedQuestionAssets"], f"{label}.inspectedQuestionAssets")
    m_assets = strings(row["inspectedMarkschemeAssets"], f"{label}.inspectedMarkschemeAssets")
    for asset in [*q_assets, *m_assets]:
        resolve_asset(asset, source_path, asset_root, f"{label} asset")
    return {
        "bank": packet_record["bank"],
        "id": question_id,
        "primaryTopic": primary,
        "secondaryTopics": secondary,
        "skills": sorted(skills),
        "taxonomyGap": gap,
        "confidence": row.get("confidence"),
        "evidence": row["evidence"],
        "rationale": row["rationale"],
        "questionAssets": q_assets,
        "markschemeAssets": m_assets,
        "officialMarkschemeUnavailable": row["officialMarkschemeUnavailable"],
    }


def mismatch_types(source: dict[str, Any], blind: dict[str, Any]) -> list[str]:
    types: list[str] = []
    if blind["primaryTopic"] != source["primaryTopic"]:
        types.append("primary")
    if blind["secondaryTopics"] != source["secondaryTopics"]:
        types.append("secondary")
    if blind["skills"] != source["skills"]:
        types.append("skill")
    if blind["taxonomyGap"] is not None:
        types.append("taxonomy-gap")
    if source["taxonomyViolations"]:
        types.append("source-taxonomy")
    return types


def compare(source_path: Path, manifest_path: Path, taxonomy_path: Path, blind_root: Path, output_root: Path, *, asset_root: Path | None = None, batch_size: int | None = None) -> dict[str, Any]:
    source_path = source_path.resolve()
    manifest_path = manifest_path.resolve()
    taxonomy_path = taxonomy_path.resolve()
    blind_root = blind_root.resolve()
    output_root = output_root.resolve()
    for input_path in (source_path, manifest_path, taxonomy_path):
        require(output_root != input_path and not input_path.is_relative_to(output_root), "output must not contain an input artifact")
    require(output_root != blind_root and not output_root.is_relative_to(blind_root), "output must not be inside blind artifacts")

    manifest = read_json(manifest_path)
    require(isinstance(manifest, dict), "manifest: expected object")
    bank = nonempty_string(manifest.get("bank"), "manifest.bank")
    require(manifest.get("auditVersion") == AUDIT_VERSION, "manifest.auditVersion drift")
    require(Path(str(manifest.get("sourceQuestions", ""))).resolve() == source_path, "manifest source path drift")
    require(manifest.get("sourceQuestionsSha256") == sha_file(source_path), "source questions hash drift")

    taxonomy_payload = read_json(taxonomy_path)
    taxonomy_value = taxonomy_payload.get(bank) if isinstance(taxonomy_payload, dict) and bank in taxonomy_payload else taxonomy_payload
    taxonomy = normalized_taxonomy(taxonomy_value, f"taxonomy.{bank}")
    require(manifest.get("taxonomySha256") == sha_bytes(canonical_bytes(taxonomy)), "taxonomy hash drift")

    source = source_questions(read_json(source_path))
    source_by_id: dict[str, dict[str, Any]] = {}
    source_tuples: dict[str, dict[str, Any]] = {}
    for question in source:
        source_by_id[question["id"]] = question
        source_tuples[question["id"]] = source_tuple(question, taxonomy, source_path, asset_root)

    inputs_dir = blind_root / "blind-inputs"
    results_dir = blind_root / "blind-results"
    input_json_paths = sorted(inputs_dir.glob("*.json")) if inputs_dir.is_dir() else []
    result_json_paths = sorted(results_dir.glob("*.json")) if results_dir.is_dir() else []
    require(all(re.fullmatch(r"batch-\d{2}\.json", path.name) for path in input_json_paths), "blind inputs contain an invalid batch filename")
    require(all(re.fullmatch(r"batch-\d{2}\.json", path.name) for path in result_json_paths), "blind results contain an invalid batch filename")
    input_paths = [path for path in input_json_paths if path.name.startswith("batch-")]
    result_paths = [path for path in result_json_paths if path.name.startswith("batch-")]
    require(input_paths, "blind inputs are missing")
    input_names = [path.name for path in input_paths]
    result_names = [path.name for path in result_paths]
    missing_results = sorted(set(input_names) - set(result_names))
    extra_results = sorted(set(result_names) - set(input_names))
    if missing_results:
        raise ValueError(f"missing result {missing_results[0]}")
    if extra_results:
        raise ValueError(f"extra result {extra_results[0]}")
    require(manifest.get("packetSha256") == {path.name: sha_file(path) for path in input_paths}, "blind input hash drift")
    if "resultSha256" in manifest:
        require(manifest["resultSha256"] == {path.name: sha_file(path) for path in result_paths}, "blind result hash drift")

    all_ids: list[str] = []
    records_by_id: dict[str, dict[str, Any]] = {}
    input_hashes: dict[str, str] = {}
    result_hashes: dict[str, str] = {}
    for batch_index, (input_path, result_path) in enumerate(zip(input_paths, result_paths, strict=True), start=1):
        packet = read_json(input_path)
        result = read_json(result_path)
        require(isinstance(packet, dict) and isinstance(result, dict), f"{input_path.name}: expected objects")
        require(packet.get("auditVersion") == AUDIT_VERSION and result.get("auditVersion") == AUDIT_VERSION, f"{input_path.name}: audit version drift")
        require(packet.get("bank") == bank and result.get("bank") == bank, f"{input_path.name}: bank drift")
        require(isinstance(packet.get("batch"), int) and packet["batch"] == batch_index, f"{input_path.name}: batch number")
        packet_records = packet.get("records")
        judgments = result.get("judgments")
        require(isinstance(packet_records, list) and isinstance(judgments, list), f"{input_path.name}: missing records/judgments")
        require(packet.get("count") == len(packet_records), f"{input_path.name}: input count")
        require(result.get("count") == len(judgments) == packet.get("count"), f"{input_path.name}: result count")
        require(packet.get("inputSha256") == sha_bytes(canonical_bytes({key: packet[key] for key in packet if key != "inputSha256"})), f"{input_path.name}: input provenance hash")
        require(result.get("inputSha256") == packet.get("inputSha256"), f"{input_path.name}: result input hash")
        require([row.get("id") for row in judgments] == [row.get("id") for row in packet_records], f"{input_path.name}: ordered IDs mismatch")
        packet_taxonomy = normalized_taxonomy(packet.get("taxonomy"), f"{input_path.name}.taxonomy")
        require(packet_taxonomy == taxonomy, f"{input_path.name}: taxonomy drift")
        for packet_record, judgment in zip(packet_records, judgments, strict=True):
            require(isinstance(packet_record, dict), f"{input_path.name}: invalid packet record")
            question_id = nonempty_string(packet_record.get("id"), f"{input_path.name}.record.id")
            require(question_id in source_by_id, f"{input_path.name}: missing source ID {question_id}")
            require(question_id not in records_by_id, f"duplicate blind ID {question_id}")
            require(packet_record.get("bank") == bank, f"{question_id}: packet bank")
            q_assets = strings(packet_record.get("questionAssets"), f"{question_id}.questionAssets")
            m_assets = strings(packet_record.get("markschemeAssets"), f"{question_id}.markschemeAssets")
            require(packet_record.get("officialMarkschemeUnavailable") == (not bool(m_assets)), f"{question_id}: packet markscheme flag")
            expected_q, expected_m = source_assets(source_by_id[question_id], source_path, asset_root)
            blind_q_paths = [resolve_asset(ref, source_path, asset_root, f"{question_id}.questionAssets") for ref in q_assets]
            blind_m_paths = [resolve_asset(ref, source_path, asset_root, f"{question_id}.markschemeAssets") for ref in m_assets]
            require(sorted(blind_q_paths) == sorted([resolve_asset(ref, source_path, asset_root, f"{question_id}.sourceQuestionAsset") for ref in expected_q]), f"{question_id}: question asset provenance drift")
            require(sorted(blind_m_paths) == sorted([resolve_asset(ref, source_path, asset_root, f"{question_id}.sourceMarkschemeAsset") for ref in expected_m]), f"{question_id}: markscheme asset provenance drift")
            blind = validate_blind_row(judgment, packet_record, taxonomy, source_path, asset_root, f"{input_path.name}/{question_id}")
            types = mismatch_types(source_tuples[question_id], blind)
            category = "+".join(types)
            record = {
                "bank": bank,
                "id": question_id,
                "category": category,
                "mismatchTypes": types,
                "source": source_tuples[question_id],
                "blind": blind,
                "questionAssets": q_assets,
                "markschemeAssets": m_assets,
                "officialMarkschemeUnavailable": packet_record["officialMarkschemeUnavailable"],
            }
            all_ids.append(question_id)
            records_by_id[question_id] = record
            input_hashes[input_path.name] = sha_file(input_path)
            result_hashes[result_path.name] = sha_file(result_path)

    require(len(all_ids) == len(source), "blind coverage mismatch")
    require(set(all_ids) == set(source_by_id), "blind IDs do not equal source IDs")
    require(manifest.get("reviewCount") == len(all_ids), "manifest review count drift")
    require(manifest.get("batchCount") == len(input_paths), "manifest batch count drift")
    require(manifest.get("orderedIdSha256") == sha_bytes(canonical_bytes(all_ids)), "ordered ID hash drift")
    require(len(all_ids) == len(set(all_ids)), "duplicate blind IDs")

    ordered_records = [records_by_id[question_id] for question_id in all_ids]
    queue_records = [record for record in ordered_records if record["mismatchTypes"]]
    categories = dict(sorted(Counter(record["category"] for record in queue_records).items()))
    counts = {
        "source": len(source),
        "blind": len(all_ids),
        "exact": len(ordered_records) - len(queue_records),
        "mismatches": len(queue_records),
        "taxonomyGaps": sum("taxonomy-gap" in record["mismatchTypes"] for record in queue_records),
        "sourceTaxonomyViolationRows": sum(bool(record["source"]["taxonomyViolations"]) for record in ordered_records),
        "sourceTaxonomyViolationLabels": sum(len(record["source"]["taxonomyViolations"]) for record in ordered_records),
        "adjudicationInputs": len(queue_records),
        "categories": categories,
    }
    require(counts["exact"] + counts["mismatches"] == len(source), "non-disjoint comparison counts")

    asset_hashes: dict[str, str] = {}
    for record in ordered_records:
        for ref in [*record["questionAssets"], *record["markschemeAssets"]]:
            path = resolve_asset(ref, source_path, asset_root, f"{record['id']} asset")
            asset_hashes[str(path)] = sha_file(path)
    provenance = {
        "sourceQuestions": {"path": str(source_path), "sha256": sha_file(source_path)},
        "manifest": {"path": str(manifest_path), "sha256": sha_file(manifest_path)},
        "taxonomy": {"path": str(taxonomy_path), "sha256": sha_file(taxonomy_path), "canonicalBankSha256": sha_bytes(canonical_bytes(taxonomy))},
        "blindInputs": input_hashes,
        "blindResults": result_hashes,
        "orderedIdsSha256": sha_bytes(canonical_bytes(all_ids)),
        "assetSha256": dict(sorted(asset_hashes.items())),
    }
    comparison = {
        "auditVersion": AUDIT_VERSION,
        "bank": bank,
        "counts": counts,
        "provenance": provenance,
        "records": ordered_records,
    }
    queue = {
        "auditVersion": AUDIT_VERSION,
        "bank": bank,
        "count": len(queue_records),
        "counts": counts,
        "provenance": provenance,
        "records": queue_records,
    }

    chosen_batch_size = batch_size or int(manifest.get("batchSize") or 75)
    require(chosen_batch_size > 0, "batch size must be positive")
    batch_packets: list[tuple[str, bytes]] = []
    for start in range(0, len(queue_records), chosen_batch_size):
        batch_number = start // chosen_batch_size + 1
        batch_rows = queue_records[start:start + chosen_batch_size]
        core = {"auditVersion": AUDIT_VERSION, "bank": bank, "batch": batch_number, "count": len(batch_rows), "taxonomy": taxonomy, "records": batch_rows}
        packet = {**core, "inputSha256": sha_bytes(canonical_bytes(core))}
        batch_packets.append((f"batch-{batch_number:02d}.json", canonical_bytes(packet)))
    queue_bytes = canonical_bytes(queue)
    output_manifest = {
        "auditVersion": AUDIT_VERSION,
        "bank": bank,
        "queueSha256": sha_bytes(queue_bytes),
        "count": len(queue_records),
        "batchCount": len(batch_packets),
        "batchSize": chosen_batch_size,
        "orderedIdSha256": sha_bytes(canonical_bytes([record["id"] for record in queue_records])),
        "provenance": provenance,
        "batches": {},
    }
    for name, data in batch_packets:
        output_manifest["batches"][name] = {"count": len(json.loads(data)["records"]), "sha256": sha_bytes(data)}

    # Commit all generated artifacts atomically and never touch a source artifact.
    stage = Path(tempfile.mkdtemp(prefix="classification-v2-", dir=str(output_root.parent)))
    try:
        (stage / "adjudication-inputs").mkdir()
        (stage / "comparison.json").write_bytes(canonical_bytes(comparison))
        (stage / "adjudication-queue.json").write_bytes(queue_bytes)
        for name, data in batch_packets:
            (stage / "adjudication-inputs" / name).write_bytes(data)
        (stage / "adjudication-manifest.json").write_bytes(canonical_bytes(output_manifest))
        if output_root.exists():
            require(output_root.is_dir(), "output path is not a directory")
            shutil.rmtree(output_root)
        os.replace(stage, output_root)
    except Exception:
        shutil.rmtree(stage, ignore_errors=True)
        raise
    return comparison


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-questions", "--source", dest="source_questions", type=Path, required=True)
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--taxonomy", type=Path, required=True)
    parser.add_argument("--blind-root", type=Path, required=True)
    parser.add_argument("--output-root", type=Path, required=True)
    parser.add_argument("--asset-root", type=Path)
    parser.add_argument("--batch-size", type=int)
    args = parser.parse_args()
    report = compare(args.source_questions, args.manifest, args.taxonomy, args.blind_root, args.output_root, asset_root=args.asset_root, batch_size=args.batch_size)
    print(json.dumps({"status": "PASS", "counts": report["counts"], "output": str(args.output_root.resolve())}, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
