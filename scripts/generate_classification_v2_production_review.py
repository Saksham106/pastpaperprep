#!/usr/bin/env python3
"""Generate sealed, production-aware second-review packets for classification-v2."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shutil
import tempfile
from pathlib import Path
from typing import Any

from validate_classification_v2_adjudication import validate as validate_adjudication

AUDIT_VERSION = "classification-contract-v2.0"
REVIEW_VERSION = "classification-v2-production-second-review-1.0"
CLASSIFICATION_FIELDS = {
    "classification",
    "primaryTopic",
    "secondaryTopics",
    "skills",
    "subtopics",
    "detailedSubtopics",
    "classificationEvidence",
    "classificationConfidence",
    "classificationReviewStatus",
    "classificationVersion",
    "contextTags",
}


def canonical_bytes(value: Any) -> bytes:
    return (json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n").encode("utf-8")


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


def nonempty(value: Any, label: str) -> str:
    require(isinstance(value, str) and bool(value.strip()), f"{label}: expected non-empty string")
    return value


def labels(value: Any, label: str) -> list[str]:
    require(isinstance(value, list), f"{label}: expected list")
    result = [nonempty(item, f"{label}[{index}]") for index, item in enumerate(value)]
    require(len(result) == len(set(result)), f"{label}: duplicate labels")
    return result


def nonempty_evidence(value: Any) -> bool:
    if isinstance(value, str):
        return bool(value.strip())
    if isinstance(value, list):
        return bool(value) and all(nonempty_evidence(item) for item in value)
    if isinstance(value, dict):
        return bool(value) and all(isinstance(key, str) and bool(key.strip()) and nonempty_evidence(item) for key, item in value.items())
    return False


def taxonomy_payload(payload: Any, bank: str) -> tuple[dict[str, list[str]], str]:
    version = ""
    value = payload
    if isinstance(payload, dict):
        version = str(payload.get("version") or payload.get("taxonomyVersion") or payload.get("artifactVersion") or "")
        if bank in payload:
            value = payload[bank]
        elif isinstance(payload.get("taxonomy"), dict) and bank in payload["taxonomy"]:
            value = payload["taxonomy"][bank]
        elif isinstance(payload.get("banks"), dict) and bank in payload["banks"]:
            value = payload["banks"][bank]
    require(bool(version.strip()), "refined taxonomy: missing version")
    # classification-v3 proposals use stable IDs internally and display labels
    # at the runtime boundary. Convert that hierarchy to the ownership map used
    # by the production-review validator; context tags are intentionally absent
    # because they must never satisfy student-facing topic/subtopic filters.
    if isinstance(payload, dict) and isinstance(payload.get("topics"), list):
        require(payload.get("bank") == bank, f"refined taxonomy: expected bank {bank}")
        result: dict[str, list[str]] = {}
        seen_topic_ids: set[str] = set()
        seen_subtopic_ids: set[str] = set()
        for index, topic in enumerate(payload["topics"]):
            require(isinstance(topic, dict), f"refined taxonomy topics[{index}]: expected object")
            topic_id = nonempty(topic.get("id"), f"refined taxonomy topics[{index}].id")
            topic_name = nonempty(topic.get("label"), f"refined taxonomy topics[{index}].label")
            require(topic_id not in seen_topic_ids, f"refined taxonomy: duplicate topic ID {topic_id}")
            require(topic_name not in result, f"refined taxonomy: duplicate topic label {topic_name}")
            seen_topic_ids.add(topic_id)
            owned: list[str] = []
            subtopics = topic.get("subtopics")
            require(isinstance(subtopics, list) and bool(subtopics), f"refined taxonomy.{topic_name}: expected subtopics")
            for sub_index, subtopic in enumerate(subtopics):
                require(isinstance(subtopic, dict), f"refined taxonomy.{topic_name}[{sub_index}]: expected object")
                subtopic_id = nonempty(subtopic.get("id"), f"refined taxonomy.{topic_name}[{sub_index}].id")
                label = nonempty(subtopic.get("label"), f"refined taxonomy.{topic_name}[{sub_index}].label")
                require(subtopic.get("filterable") is True, f"refined taxonomy.{label}: expected filterable subtopic")
                require(subtopic.get("ownerTopicId") == topic_id, f"refined taxonomy.{label}: owner mismatch")
                require(subtopic_id not in seen_subtopic_ids, f"refined taxonomy: duplicate subtopic ID {subtopic_id}")
                require(label not in owned, f"refined taxonomy.{topic_name}: duplicate subtopic label {label}")
                seen_subtopic_ids.add(subtopic_id)
                owned.append(label)
            result[topic_name] = sorted(owned)
        return dict(sorted(result.items())), version
    require(isinstance(value, dict) and bool(value), f"refined taxonomy.{bank}: expected non-empty object")
    result: dict[str, list[str]] = {}
    for topic, owned in value.items():
        topic_name = nonempty(topic, "refined taxonomy topic")
        result[topic_name] = sorted(labels(owned, f"refined taxonomy.{topic_name}"))
    return dict(sorted(result.items())), version


def load_source_questions(payload: Any) -> list[dict[str, Any]]:
    value = payload.get("questions") if isinstance(payload, dict) else payload
    require(isinstance(value, list) and bool(value), "source questions: expected non-empty list")
    seen: set[str] = set()
    result: list[dict[str, Any]] = []
    for index, question in enumerate(value):
        require(isinstance(question, dict), f"source question {index}: expected object")
        question_id = nonempty(question.get("id"), f"source question {index}.id")
        require(question_id not in seen, f"duplicate source ID {question_id}")
        seen.add(question_id)
        result.append(question)
    return result


def source_skills(question: dict[str, Any]) -> list[str]:
    result: list[str] = []
    for field in ("skills", "subtopics", "detailedSubtopics"):
        if field not in question or question[field] is None:
            continue
        for skill in labels(question[field], f"source {question['id']}.{field}"):
            if skill not in result:
                result.append(skill)
    return sorted(result)


def tuple_from_source(question: dict[str, Any]) -> dict[str, Any]:
    primary = nonempty(question.get("primaryTopic"), f"source {question['id']}.primaryTopic")
    secondary = labels(question.get("secondaryTopics"), f"source {question['id']}.secondaryTopics")
    require(primary not in secondary, f"source {question['id']}: primary in secondary topics")
    return {"primaryTopic": primary, "secondaryTopics": secondary, "skills": source_skills(question)}


def tuple_from_row(row: dict[str, Any], label: str) -> dict[str, Any]:
    primary = nonempty(row.get("primaryTopic"), f"{label}.primaryTopic")
    secondary = labels(row.get("secondaryTopics"), f"{label}.secondaryTopics")
    skills = labels(row.get("skills"), f"{label}.skills")
    require(primary not in secondary, f"{label}: primary in secondary topics")
    return {"primaryTopic": primary, "secondaryTopics": secondary, "skills": sorted(skills)}


def semantic(value: dict[str, Any]) -> tuple[str, tuple[str, ...], tuple[str, ...]]:
    return (
        value["primaryTopic"],
        tuple(value["secondaryTopics"]),
        tuple(value["skills"]),
    )


def resolve_asset(reference: Any, source_path: Path, asset_root: Path | None, label: str) -> Path:
    ref = nonempty(reference, label)
    reference_path = Path(ref)
    candidates: list[Path] = [reference_path] if reference_path.is_absolute() else []
    if not reference_path.is_absolute():
        if asset_root is not None:
            candidates.append(asset_root / reference_path)
        for parent in (source_path.parent, source_path.parent.parent, source_path.parent.parent.parent):
            candidates.extend((parent / reference_path, parent / "site" / reference_path, parent / "public" / reference_path))
    for candidate in candidates:
        if candidate.is_file():
            return candidate.resolve()
    raise ValueError(f"{label}: missing asset {ref}")


def asset_refs(question: dict[str, Any], field: str) -> list[str]:
    values = question.get(field)
    if field == "markschemeImages" and not values and isinstance(question.get("officialMarkscheme"), dict):
        values = question["officialMarkscheme"].get("images")
    if values is None and field == "markschemeImages":
        return []
    return labels(values, f"source {question['id']}.{field}")


def nonclassification_hash(question: dict[str, Any]) -> str:
    preserved = {key: value for key, value in question.items() if key not in CLASSIFICATION_FIELDS}
    return sha_bytes(canonical_bytes(preserved))


def corpus_files(root: Path) -> dict[str, str]:
    paths = [path for path in root.rglob("*") if path.is_file() and "__pycache__" not in path.parts]
    return {str(path.relative_to(root)): sha_file(path) for path in sorted(paths)}


def load_adjudication_rows(root: Path, validation: dict[str, Any]) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    queue = read_json(root / "adjudication-queue.json")
    require(isinstance(queue, dict), "adjudication queue: expected object")
    records = queue.get("records")
    require(isinstance(records, list), "adjudication queue.records: expected list")
    by_id = {record["id"]: record for record in records if isinstance(record, dict) and isinstance(record.get("id"), str)}
    require(len(by_id) == len(records), "adjudication queue: duplicate or invalid IDs")
    rows: list[dict[str, Any]] = []
    input_dir = root / "adjudication-inputs"
    result_dir = root / "adjudication-results"
    for input_path in sorted(input_dir.glob("batch-*.json")):
        result_path = result_dir / input_path.name
        result = read_json(result_path)
        for row in result["judgments"]:
            require(row["id"] in by_id, f"adjudication result: unknown ID {row.get('id')}")
            rows.append(row)
    require(len(rows) == validation["reviewed"], "adjudication corpus: validation count drift")
    require(len({row["id"] for row in rows}) == len(rows), "adjudication corpus: duplicate IDs")
    return queue, rows


def owned_by_taxonomy(candidate: dict[str, Any], taxonomy: dict[str, list[str]], label: str) -> None:
    primary = candidate["primaryTopic"]
    secondary = candidate["secondaryTopics"]
    require(primary in taxonomy, f"{label}: uncontrolled primary topic {primary}")
    require(all(topic in taxonomy for topic in secondary), f"{label}: uncontrolled secondary topic")
    owned = {skill for topic in [primary, *secondary] for skill in taxonomy[topic]}
    require(all(skill in owned for skill in candidate["skills"]), f"{label}: skill not owned by refined taxonomy")


def generate(
    source_questions: Path,
    source_commit: str,
    adjudication_root: Path,
    refined_taxonomy: Path,
    output_root: Path,
    *,
    asset_root: Path | None = None,
    batch_size: int = 75,
) -> dict[str, Any]:
    source_questions = Path(source_questions).resolve()
    adjudication_root = Path(adjudication_root).resolve()
    refined_taxonomy = Path(refined_taxonomy).resolve()
    output_root = Path(output_root).resolve()
    nonempty(source_commit, "source commit")
    require(re.fullmatch(r"[0-9a-fA-F]{40}", source_commit) is not None, "source commit: expected 40-hex commit hash")
    require(source_questions.is_file(), "source questions: missing file")
    require(refined_taxonomy.is_file(), "refined taxonomy: missing file")
    require(adjudication_root.is_dir(), "adjudication corpus: missing root")
    require(batch_size > 0, "batch size must be positive")
    require(not output_root.exists(), "output root already exists; refusing to mutate an existing artifact")

    source_path = source_questions
    questions = load_source_questions(read_json(source_path))
    questions_by_id = {question["id"]: question for question in questions}
    bank_manifest = read_json(adjudication_root / "adjudication-manifest.json")
    bank = nonempty(bank_manifest.get("bank"), "adjudication manifest.bank")
    taxonomy, taxonomy_version = taxonomy_payload(read_json(refined_taxonomy), bank)
    adjudication_validation = validate_adjudication(adjudication_root)
    queue, adjudication_rows = load_adjudication_rows(adjudication_root, adjudication_validation)

    asset_hashes: dict[str, str] = {}
    proposed: list[dict[str, Any]] = []
    for row in adjudication_rows:
        question_id = nonempty(row.get("id"), "adjudication row.id")
        require(question_id in questions_by_id, f"{question_id}: missing source question")
        question = questions_by_id[question_id]
        before = tuple_from_source(question)
        queue_record = queue["records"][next(index for index, record in enumerate(queue["records"]) if record["id"] == question_id)]
        queue_before = tuple_from_row(queue_record["source"], f"{question_id}.queue.source")
        require(semantic(before) == semantic(queue_before), f"{question_id}: source candidate drift")
        after = tuple_from_row(row, f"{question_id}.adjudication")
        gap = row.get("taxonomyGap")
        if gap is not None:
            nonempty(gap, f"{question_id}.taxonomyGap")
        if semantic(before) == semantic(after) and gap is None:
            continue
        owned_by_taxonomy(after, taxonomy, f"{question_id}.candidateAfter")
        question_assets = asset_refs(question, "questionImages")
        markscheme_assets = asset_refs(question, "markschemeImages")
        resolved_assets: dict[str, str] = {}
        for reference in [*question_assets, *markscheme_assets]:
            path = resolve_asset(reference, source_questions, asset_root, f"{question_id} asset")
            resolved_assets[reference] = sha_file(path)
        asset_hashes.update(resolved_assets)
        proposed.append({
            "bank": bank,
            "id": question_id,
            "adjudicationVerdict": row["verdict"],
            "mismatchTypes": queue_record["mismatchTypes"],
            "candidateBefore": before,
            "candidateAfter": after,
            "taxonomyGap": gap,
            "evidence": row["evidence"],
            "rationale": row["rationale"],
            "questionAssets": question_assets,
            "markschemeAssets": markscheme_assets,
            "officialMarkschemeUnavailable": not bool(markscheme_assets),
            "assetSha256": resolved_assets,
            "nonClassificationSha256": nonclassification_hash(question),
        })

    ordered_ids = [record["id"] for record in proposed]
    corpus_hashes = corpus_files(adjudication_root)
    corpus_provenance = {
        "root": str(adjudication_root),
        "validated": True,
        "validation": adjudication_validation,
        "files": corpus_hashes,
        "sha256": sha_bytes(canonical_bytes(corpus_hashes)),
    }
    provenance = {
        "source": {"path": str(source_path), "commit": source_commit, "sha256": sha_file(source_path)},
        "adjudicationCorpus": corpus_provenance,
        "refinedTaxonomy": {
            "path": str(refined_taxonomy),
            "sha256": sha_file(refined_taxonomy),
            "canonicalBankSha256": sha_bytes(canonical_bytes(taxonomy)),
            "version": taxonomy_version,
        },
        "orderedIdsSha256": sha_bytes(canonical_bytes(ordered_ids)),
        "assetSha256": dict(sorted(asset_hashes.items())),
        "nonClassificationSha256": sha_bytes(canonical_bytes([nonclassification_hash(questions_by_id[question_id]) for question_id in ordered_ids])),
    }
    report = {
        "reviewVersion": REVIEW_VERSION,
        "auditVersion": AUDIT_VERSION,
        "bank": bank,
        "count": len(proposed),
        "provenance": provenance,
        "orderedIds": ordered_ids,
        "records": proposed,
    }
    report_bytes = canonical_bytes(report)
    packets: list[tuple[str, bytes]] = []
    for start in range(0, len(proposed), batch_size):
        number = start // batch_size + 1
        core = {
            "reviewVersion": REVIEW_VERSION,
            "auditVersion": AUDIT_VERSION,
            "bank": bank,
            "batch": number,
            "count": len(proposed[start:start + batch_size]),
            "refinedTaxonomy": taxonomy,
            "records": proposed[start:start + batch_size],
        }
        packets.append((f"batch-{number:02d}.json", canonical_bytes({**core, "inputSha256": sha_bytes(canonical_bytes(core))})))
    manifest = {
        "reviewVersion": REVIEW_VERSION,
        "auditVersion": AUDIT_VERSION,
        "bank": bank,
        "count": len(proposed),
        "batchSize": batch_size,
        "batchCount": len(packets),
        "reportSha256": sha_bytes(report_bytes),
        "orderedIdSha256": provenance["orderedIdsSha256"],
        "provenance": provenance,
        "batches": {name: {"count": len(read_json_bytes(data)["records"]), "sha256": sha_bytes(data)} for name, data in packets},
    }

    stage = Path(tempfile.mkdtemp(prefix="classification-v2-production-review-", dir=str(output_root.parent)))
    try:
        (stage / "production-review-inputs").mkdir()
        (stage / "production-review-results").mkdir()
        (stage / "production-review.json").write_bytes(report_bytes)
        for name, data in packets:
            (stage / "production-review-inputs" / name).write_bytes(data)
        (stage / "production-review-manifest.json").write_bytes(canonical_bytes(manifest))
        os.replace(stage, output_root)
    except Exception:
        shutil.rmtree(stage, ignore_errors=True)
        raise
    return report


def read_json_bytes(data: bytes) -> Any:
    return json.loads(data.decode("utf-8"))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-questions", type=Path, required=True)
    parser.add_argument("--source-commit", required=True)
    parser.add_argument("--adjudication-root", type=Path, required=True)
    parser.add_argument("--refined-taxonomy", type=Path, required=True)
    parser.add_argument("--output-root", type=Path, required=True)
    parser.add_argument("--asset-root", type=Path)
    parser.add_argument("--batch-size", type=int, default=75)
    args = parser.parse_args()
    report = generate(args.source_questions, args.source_commit, args.adjudication_root, args.refined_taxonomy, args.output_root, asset_root=args.asset_root, batch_size=args.batch_size)
    print(json.dumps({"status": "PASS", "count": report["count"], "output": str(args.output_root.resolve())}, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
