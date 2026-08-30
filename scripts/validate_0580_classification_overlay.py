#!/usr/bin/env python3
"""Independent, fail-closed release gate for the Cambridge 0580 overlay.

The gate intentionally reads only a frozen source, a refined taxonomy, a
candidate output, a sealed production-review validation result, and a locked
delivery artifact.  It never writes any of those inputs or production data.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
import unicodedata
from pathlib import Path
from typing import Any, cast

from generate_classification_v2_production_review import CLASSIFICATION_FIELDS as SEALED_CLASSIFICATION_FIELDS
from validate_classification_v2_production_review import validate as validate_production_review

EXPECTED_COUNT = 2_684
BANK = "igcse"
SCHEMA_VERSION = "0580-classification-overlay-1.0"
REVIEW_SCHEMA_VERSION = "0580-production-review-validation-1.0"
REAL_OVERLAY_VERSION = "classification-v2-0580-overlay-1.0"
REAL_EXPECTED_REVIEWED = 1_629

# These fields are classification or classification-derived metadata.  Every
# other field must remain byte-equivalent after canonical JSON normalization.
LEGACY_CLASSIFICATION_FIELDS = {
    "classification",
    "classificationEvidence",
    "classificationConfidence",
    "classificationReviewStatus",
    "classificationVersion",
    "classificationV2",
    "primaryTopic",
    "secondaryTopics",
    "skills",
    "subtopics",
    "detailedSubtopics",
    "reviewStatus",
    "taxonomyGap",
    "nonClassificationSha256",
    "searchText",
}
# The production-review generator is the authority for the historical sealed
# field set. The legacy fixture gate above remains compatible with its old
# synthetic manifest, while the real generator contract uses this exact set.
CLASSIFICATION_FIELDS = frozenset(SEALED_CLASSIFICATION_FIELDS)
PROTECTED_FIELDS = {
    "accessibleText": "",
    "summary": "",
    "solution": None,
    "questionImages": [],
    "markschemeImages": [],
    "questionAssetPaths": [],
    "markschemeAssetPaths": [],
    "sourceQuestionUrl": None,
    "sourceMarkSchemeUrl": None,
}


class GateError(ValueError):
    """An input violates a release invariant."""


def canonical_bytes(value: Any) -> bytes:
    return (json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n").encode("utf-8")


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def sha256_file(path: Path) -> str:
    try:
        return sha256_bytes(path.read_bytes())
    except OSError as exc:
        raise GateError(f"cannot read {path}: {exc}") from exc


def require(condition: bool, message: str) -> None:
    if not condition:
        raise GateError(message)


def read_json(path: Path, label: str) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise GateError(f"{label}: cannot read JSON: {exc}") from exc


def nonempty_string(value: Any, label: str) -> str:
    require(isinstance(value, str) and bool(value.strip()), f"{label}: expected non-empty string")
    return value


def string_list(value: Any, label: str, *, allow_empty: bool = True) -> list[str]:
    require(isinstance(value, list), f"{label}: expected list")
    items = cast(list[Any], value)
    result = [nonempty_string(item, f"{label}[{index}]") for index, item in enumerate(items)]
    require(len(result) == len(set(result)), f"{label}: duplicate values")
    require(allow_empty or bool(result), f"{label}: must not be empty")
    return result


def load_records(payload: Any, label: str) -> list[dict[str, Any]]:
    value = payload.get("questions") if isinstance(payload, dict) else payload
    require(isinstance(value, list), f"{label}: expected questions list")
    records: list[dict[str, Any]] = []
    seen: set[str] = set()
    for index, item in enumerate(value):
        require(isinstance(item, dict), f"{label}[{index}]: expected object")
        question_id = nonempty_string(item.get("id"), f"{label}[{index}].id")
        require(question_id not in seen, f"duplicate {label} ID {question_id}")
        seen.add(question_id)
        records.append(item)
    return records


def nonclassification_record(question: dict[str, Any]) -> dict[str, Any]:
    return {key: value for key, value in question.items() if key not in LEGACY_CLASSIFICATION_FIELDS}


def nonclassification_hash(question: dict[str, Any]) -> str:
    return sha256_bytes(canonical_bytes(nonclassification_record(question)))


def normalized_text(value: str) -> str:
    return " ".join(unicodedata.normalize("NFKC", value).casefold().split())


def resolve_metadata_path(root: Path, metadata: Any, label: str) -> Path:
    require(isinstance(metadata, dict), f"{label}: expected provenance object")
    path_value = nonempty_string(metadata.get("path"), f"{label}.path")
    path = Path(path_value).expanduser().resolve()
    require(path.is_file(), f"{label}: missing file {path}")
    return path


def taxonomy_payload(payload: Any) -> tuple[str, dict[str, list[str]]]:
    require(isinstance(payload, dict), "refined taxonomy: expected object")
    version = nonempty_string(
        payload.get("version") or payload.get("taxonomyVersion"),
        "refined taxonomy.version",
    )
    for gap_key in ("taxonomyGaps", "gaps", "unresolvedGaps"):
        if gap_key in payload:
            gap_value = payload[gap_key]
            require(gap_value in (None, [], {}), f"refined taxonomy: unresolved taxonomy gaps in {gap_key}")

    topics_value: Any = payload.get("topics")
    if topics_value is not None:
        require(payload.get("bank") == BANK, "refined taxonomy: bank mismatch")
        require(isinstance(topics_value, list) and bool(topics_value), "refined taxonomy.topics: expected non-empty list")
        owners: dict[str, list[str]] = {}
        topic_ids: set[str] = set()
        subtopic_ids: set[str] = set()
        for index, topic in enumerate(topics_value):
            require(isinstance(topic, dict), f"refined taxonomy.topics[{index}]: expected object")
            topic_id = nonempty_string(topic.get("id"), f"refined taxonomy.topics[{index}].id")
            topic_label = nonempty_string(topic.get("label"), f"refined taxonomy.topics[{index}].label")
            require(topic_id not in topic_ids, f"refined taxonomy: duplicate topic ID {topic_id}")
            require(topic_label not in owners, f"refined taxonomy: duplicate topic label {topic_label}")
            topic_ids.add(topic_id)
            subtopics = topic.get("subtopics")
            require(isinstance(subtopics, list) and bool(subtopics), f"refined taxonomy.{topic_label}: missing subtopics")
            labels: list[str] = []
            for sub_index, subtopic in enumerate(subtopics):
                require(isinstance(subtopic, dict), f"refined taxonomy.{topic_label}[{sub_index}]: expected object")
                subtopic_id = nonempty_string(subtopic.get("id"), f"refined taxonomy.{topic_label}[{sub_index}].id")
                label = nonempty_string(subtopic.get("label"), f"refined taxonomy.{topic_label}[{sub_index}].label")
                require(subtopic.get("filterable") is True, f"refined taxonomy.{label}: not filterable")
                require(subtopic.get("ownerTopicId") == topic_id, f"refined taxonomy.{label}: owner mismatch")
                require(subtopic_id not in subtopic_ids, f"refined taxonomy: duplicate subtopic ID {subtopic_id}")
                require(label not in labels, f"refined taxonomy.{topic_label}: duplicate subtopic label {label}")
                subtopic_ids.add(subtopic_id)
                labels.append(label)
            owners[topic_label] = labels
        return version, owners

    value: Any = payload.get(BANK)
    if value is None and isinstance(payload.get("taxonomy"), dict):
        value = payload["taxonomy"].get(BANK)
    if value is None and isinstance(payload.get("banks"), dict):
        value = payload["banks"].get(BANK)
    require(isinstance(value, dict) and bool(value), "refined taxonomy.igcse: expected non-empty object")
    mapping = cast(dict[Any, Any], value)
    owners: dict[str, list[str]] = {}
    for topic, labels in mapping.items():
        topic_label = nonempty_string(topic, "refined taxonomy topic")
        owners[topic_label] = string_list(labels, f"refined taxonomy.{topic_label}", allow_empty=False)
    return version, owners


def validate_classification(row: dict[str, Any], owners: dict[str, list[str]], label: str) -> tuple[str, list[str], list[str]]:
    primary = nonempty_string(row.get("primaryTopic"), f"{label}.primaryTopic")
    secondary = string_list(row.get("secondaryTopics"), f"{label}.secondaryTopics")
    skills = string_list(row.get("skills"), f"{label}.skills", allow_empty=False)
    require(primary in owners, f"{label}: primary topic is not in refined taxonomy")
    require(primary not in secondary, f"{label}: primary topic repeated as secondary")
    require(all(topic in owners for topic in secondary), f"{label}: secondary topic is not in refined taxonomy")
    selected = [primary, *secondary]
    owned = {skill for topic in selected for skill in owners[topic]}
    require(all(skill in owned for skill in skills), f"{label}: skill is not owned by a selected topic")
    gap = row.get("taxonomyGap")
    require(gap is None or (isinstance(gap, str) and not gap.strip()), f"{label}: unresolved taxonomy gap")
    return primary, secondary, skills


def topic_filter(records: list[dict[str, Any]], topic: str) -> list[dict[str, Any]]:
    return [record for record in records if topic in [record["primaryTopic"], *record["secondaryTopics"]]]


def subtopic_filter(records: list[dict[str, Any]], skill: str) -> list[dict[str, Any]]:
    return [record for record in records if skill in set(record.get("skills", [])) | set(record.get("subtopics", []))]


def sealed_nonclassification_record(question: dict[str, Any]) -> dict[str, Any]:
    return {key: value for key, value in question.items() if key not in CLASSIFICATION_FIELDS}


def sealed_nonclassification_hash(question: dict[str, Any]) -> str:
    return sha256_bytes(canonical_bytes(sealed_nonclassification_record(question)))


def real_runtime_skills(question: dict[str, Any], label: str) -> list[str]:
    """Mirror normalizeQuestion's union of the two stored 0580 vocabularies."""
    result: list[str] = []
    for field in ("detailedSubtopics", "subtopics"):
        for skill in string_list(question.get(field), f"{label}.{field}"):
            if skill not in result:
                result.append(skill)
    return result


def real_runtime_subtopics(question: dict[str, Any], label: str) -> list[str]:
    """Mirror the app's legacy subtopic fallback without adding source fields."""
    values = string_list(question.get("subtopics"), f"{label}.subtopics")
    return values


def real_runtime_search_text(question: dict[str, Any], skills: list[str]) -> str:
    """Build transient search text using the app's actual lower-case semantics."""
    accessible = question.get("accessibleText")
    summary = question.get("summary")
    if not isinstance(summary, str) or not summary:
        summary = accessible[:220] if isinstance(accessible, str) else ""
    solution = question.get("solution")
    if not isinstance(solution, str) or not solution:
        solution = question.get("independentSolution")
    if not isinstance(solution, str):
        solution = ""
    parts = [
        str(question["primaryTopic"]),
        *cast(list[str], question["secondaryTopics"]),
        *real_runtime_subtopics(question, f"question {question['id']}"),
        *skills,
        summary,
        accessible if isinstance(accessible, str) else "",
        solution,
    ]
    return " ".join(part for part in parts if part).lower()


def validate_generated_overlay(
    overlay_path: Path,
    overlay: dict[str, Any],
    rebuild_paths: list[Path],
) -> dict[str, Any]:
    """Validate the artifact emitted by generate_classification_v2_overlay."""
    require(overlay.get("overlayVersion") == REAL_OVERLAY_VERSION, "overlay: generator version drift")
    require(overlay.get("bank") == BANK, "overlay: bank mismatch")
    manifest_path = overlay_path.resolve()
    output_path = manifest_path.parent / "questions.json"
    report_path = manifest_path.parent / "overlay-report.json"
    require(output_path.is_file(), f"overlay output: missing file {output_path}")
    require(report_path.is_file(), f"overlay report: missing file {report_path}")
    output_hash = sha256_file(output_path)
    report_hash = sha256_file(report_path)
    require(overlay.get("questionsSha256") == output_hash, "overlay output hash drift")
    require(overlay.get("reportSha256") == report_hash, "overlay report hash drift")
    report = read_json(report_path, "overlay report")
    require(isinstance(report, dict), "overlay report: expected object")
    require(report.get("overlayVersion") == REAL_OVERLAY_VERSION, "overlay report: version drift")
    require(report.get("bank") == BANK, "overlay report: bank mismatch")
    require(overlay.get("counts") == report.get("counts"), "overlay counts drift")
    counts = report.get("counts")
    require(isinstance(counts, dict), "overlay report counts: expected object")
    require(counts.get("sourceQuestions") == EXPECTED_COUNT, "source: expected exactly 2,684 questions")
    require(counts.get("outputQuestions") == EXPECTED_COUNT, "output: expected exactly 2,684 questions")
    require(counts.get("reviewedDecisions") == REAL_EXPECTED_REVIEWED, "production review: expected 1,629 decisions")
    require(counts.get("sourceBlindExactMatches") == EXPECTED_COUNT - REAL_EXPECTED_REVIEWED, "source/blind exact coverage drift")

    provenance = report.get("provenance")
    require(isinstance(provenance, dict), "overlay report provenance: missing")
    source_meta = provenance.get("sourceQuestions")
    taxonomy_meta = provenance.get("refinedTaxonomy")
    review_meta = provenance.get("productionReviewRoot")
    require(isinstance(source_meta, dict), "source provenance: missing")
    require(isinstance(taxonomy_meta, dict), "taxonomy provenance: missing")
    require(isinstance(review_meta, dict), "production review provenance: missing")
    source_path = resolve_metadata_path(manifest_path.parent, source_meta, "source")
    taxonomy_path = resolve_metadata_path(manifest_path.parent, taxonomy_meta, "taxonomy")
    review_root = Path(nonempty_string(review_meta.get("path"), "production review.path")).expanduser().resolve()
    require(review_root.is_dir(), f"production review: missing root {review_root}")
    source_hash = sha256_file(source_path)
    taxonomy_hash = sha256_file(taxonomy_path)
    require(source_meta.get("sha256") == source_hash, "source hash drift")
    require(taxonomy_meta.get("sha256") == taxonomy_hash, "taxonomy hash drift")

    source_records = load_records(read_json(source_path, "source questions"), "source questions")
    output_records = load_records(read_json(output_path, "candidate output"), "candidate output questions")
    require(len(source_records) == len(output_records) == EXPECTED_COUNT, "overlay: expected exactly 2,684 questions")
    source_ids = [record["id"] for record in source_records]
    output_ids = [record["id"] for record in output_records]
    require(output_ids == source_ids, "candidate output IDs are not exactly the frozen ordered source IDs")
    require(overlay.get("orderedIdsSha256") == sha256_bytes(canonical_bytes(source_ids)), "ordered ID hash mismatch")

    taxonomy_payload_value = read_json(taxonomy_path, "refined taxonomy")
    taxonomy_version, owners = taxonomy_payload(taxonomy_payload_value)
    require(report.get("taxonomyVersion") == taxonomy_version, "taxonomy version drift")
    require(overlay.get("orderedIdsSha256") == report.get("hashes", {}).get("orderedIdsSha256"), "ordered ID hash drift")
    for gap_key in ("taxonomyGaps", "gaps", "unresolvedGaps"):
        if isinstance(taxonomy_payload_value, dict) and gap_key in taxonomy_payload_value:
            require(taxonomy_payload_value[gap_key] in (None, [], {}), "unresolved taxonomy gaps")

    hashes = report.get("hashes")
    require(isinstance(hashes, dict), "overlay report hashes: missing")
    require(hashes.get("sourceQuestionsSha256") == source_hash, "source questions hash drift")
    require(hashes.get("refinedTaxonomySha256") == taxonomy_hash, "refined taxonomy hash drift")
    require(hashes.get("outputQuestionsSha256") == output_hash, "output questions hash drift")
    source_nonclass = sha256_bytes(canonical_bytes([sealed_nonclassification_hash(row) for row in source_records]))
    output_nonclass = sha256_bytes(canonical_bytes([sealed_nonclassification_hash(row) for row in output_records]))
    require(source_nonclass == output_nonclass, "non-classification fields changed")
    require(hashes.get("sourceNonClassificationSha256") == source_nonclass, "source non-classification hash drift")
    require(hashes.get("outputNonClassificationSha256") == output_nonclass, "output non-classification hash drift")

    overlay_records = report.get("records")
    require(isinstance(overlay_records, list) and len(overlay_records) == EXPECTED_COUNT, "overlay report records: expected exactly 2,684")
    require([record.get("id") for record in overlay_records] == source_ids, "overlay report IDs/order drift")
    runtime_rows: list[dict[str, Any]] = []
    for index, (source, candidate, record) in enumerate(zip(source_records, output_records, overlay_records, strict=True)):
        label = f"question {source['id']}"
        require(isinstance(record, dict), f"overlay report record {index}: expected object")
        require("skills" not in source and "searchText" not in source, f"{label}: source schema unexpectedly synthesizes fields")
        require("skills" not in candidate and "searchText" not in candidate, f"{label}: synthesized stored runtime field")
        primary = nonempty_string(candidate.get("primaryTopic"), f"{label}.primaryTopic")
        secondary = string_list(candidate.get("secondaryTopics"), f"{label}.secondaryTopics")
        require(primary not in secondary, f"{label}: primary topic repeated as secondary")
        skills = sorted(real_runtime_skills(candidate, label))
        require(record.get("classification") == {"primaryTopic": primary, "secondaryTopics": secondary, "skills": skills}, f"{label}: classification drift")
        require(record.get("nonClassificationSha256") == sealed_nonclassification_hash(source), f"{label}: non-classification hash drift")
        require(sealed_nonclassification_record(candidate) == sealed_nonclassification_record(source), f"{label}: non-classification fields changed")
        require(primary in owners, f"{label}: primary topic is not in refined taxonomy")
        require(all(topic in owners for topic in secondary), f"{label}: secondary topic is not in refined taxonomy")
        owned = {skill for topic in [primary, *secondary] for skill in owners[topic]}
        require(all(skill in owned for skill in skills), f"{label}: skill is not owned by refined taxonomy")
        runtime_rows.append({"id": source["id"], "primaryTopic": primary, "secondaryTopics": secondary, "skills": skills})

        searchable = real_runtime_search_text(candidate, skills)
        for rich_label in [primary, *secondary, *skills]:
            query = rich_label.strip().lower()
            require(bool(query) and query in searchable, f"{label}: rich label is not discoverable by search")

    runtime_by_id = {row["id"]: row for row in runtime_rows}
    runtime_filter_values = {
        row["id"]: set(real_runtime_subtopics(output_records[index], f"question {row['id']}")) | set(row["skills"])
        for index, row in enumerate(runtime_rows)
    }
    for row in runtime_rows:
        for topic in [row["primaryTopic"], *row["secondaryTopics"]]:
            matches = [item["id"] for item in runtime_rows if topic in [item["primaryTopic"], *item["secondaryTopics"]]]
            require(row["id"] in matches, f"{row['id']}: topic filter cannot discover {topic}")
        for skill in row["skills"]:
            matches = [item["id"] for item in runtime_rows if skill in runtime_filter_values[item["id"]]]
            require(row["id"] in matches, f"{row['id']}: subtopic filter cannot discover {skill}")
    require(set(runtime_by_id) == set(source_ids), "runtime classification coverage drift")

    review_validation = validate_production_review(review_root, source_questions=source_path, refined_taxonomy=taxonomy_path)
    require(review_validation.get("status") == "PASS", "production review: validator did not PASS")
    require(review_validation.get("reviewed") == review_validation.get("expected") == REAL_EXPECTED_REVIEWED, "production review: expected PASS reviewed=expected=1629")
    require(review_meta.get("validation") == review_validation, "production review validation drift")
    review_manifest_path = review_root / "production-review-manifest.json"
    review_report_path = review_root / "production-review.json"
    require(hashes.get("productionReviewManifestSha256") == sha256_file(review_manifest_path), "production review manifest hash drift")
    require(hashes.get("productionReviewReportSha256") == sha256_file(review_report_path), "production review report hash drift")

    reviewed_ids: list[str] = []
    for result_path in sorted((review_root / "production-review-results").glob("batch-*.json")):
        result = read_json(result_path, "production review result")
        reviewed_ids.extend(row["id"] for row in result.get("decisions", []))
    require(len(reviewed_ids) == REAL_EXPECTED_REVIEWED and len(set(reviewed_ids)) == REAL_EXPECTED_REVIEWED, "production review ID coverage drift")
    report_decisions = {record["id"]: record.get("decision") for record in overlay_records}
    require(sum(decision == "source_blind_exact" for decision in report_decisions.values()) == EXPECTED_COUNT - REAL_EXPECTED_REVIEWED, "source/blind exact decision coverage drift")
    require({question_id for question_id, decision in report_decisions.items() if decision != "source_blind_exact"} == set(reviewed_ids), "reviewed decision coverage drift")

    require(len(rebuild_paths) == 1, "deterministic rebuilds: exactly two rebuilds required")
    for rebuild_path in rebuild_paths:
        rebuild_manifest_path = Path(rebuild_path).expanduser().resolve()
        require(rebuild_manifest_path.is_file(), f"deterministic rebuild: missing manifest {rebuild_manifest_path}")
        rebuild_manifest = read_json(rebuild_manifest_path, "deterministic rebuild manifest")
        require(isinstance(rebuild_manifest, dict), "deterministic rebuild manifest: expected object")
        require(rebuild_manifest.get("overlayVersion") == REAL_OVERLAY_VERSION, "deterministic rebuild: version drift")
        for key in ("bank", "counts", "orderedIdsSha256", "questionsSha256", "reportSha256"):
            require(rebuild_manifest.get(key) == overlay.get(key), f"deterministic rebuild: {key} drift")
        rebuild_output_path = rebuild_manifest_path.parent / "questions.json"
        rebuild_report_path = rebuild_manifest_path.parent / "overlay-report.json"
        require(sha256_file(rebuild_output_path) == output_hash, "deterministic rebuild: output hash mismatch")
        require(sha256_file(rebuild_report_path) == report_hash, "deterministic rebuild: report hash mismatch")
    return {
        "status": "PASS",
        "bank": BANK,
        "questionCount": EXPECTED_COUNT,
        "taxonomyVersion": taxonomy_version,
        "sourceSha256": source_hash,
        "taxonomySha256": taxonomy_hash,
        "outputSha256": output_hash,
        "productionReview": {"status": "PASS", "reviewed": REAL_EXPECTED_REVIEWED, "expected": REAL_EXPECTED_REVIEWED},
        "deterministicRebuilds": 2,
        "unresolvedTaxonomyGaps": 0,
        "complete": True,
    }


def validate_overlay(overlay_path: Path, rebuild_paths: list[Path] | None = None) -> dict[str, Any]:
    overlay_path = Path(overlay_path).expanduser().resolve()
    require(overlay_path.is_file(), f"overlay: missing file {overlay_path}")
    overlay = read_json(overlay_path, "overlay")
    require(isinstance(overlay, dict), "overlay: expected object")
    if overlay.get("overlayVersion") == REAL_OVERLAY_VERSION:
        return validate_generated_overlay(overlay_path, overlay, rebuild_paths or [])
    require(overlay.get("schemaVersion") == SCHEMA_VERSION, "overlay: schema version drift")
    require(overlay.get("bank") == BANK, "overlay: bank mismatch")
    require(overlay.get("questionCount") == EXPECTED_COUNT, "overlay: expected exactly 2,684 questions")

    source_meta = overlay.get("source")
    source_path = resolve_metadata_path(overlay_path.parent, source_meta, "source")
    source_commit = nonempty_string(source_meta.get("commit"), "source.commit")
    require(re.fullmatch(r"[0-9a-fA-F]{40}", source_commit) is not None, "source.commit: expected 40-hex commit")
    source_hash = sha256_file(source_path)
    require(source_meta.get("sha256") == source_hash, "source hash drift")
    source_records = load_records(read_json(source_path, "source"), "source questions")
    require(len(source_records) == EXPECTED_COUNT, "source: expected exactly 2,684 questions")
    source_ids = [record["id"] for record in source_records]

    taxonomy_meta = overlay.get("taxonomy")
    taxonomy_path = resolve_metadata_path(overlay_path.parent, taxonomy_meta, "taxonomy")
    taxonomy_hash = sha256_file(taxonomy_path)
    require(taxonomy_meta.get("sha256") == taxonomy_hash, "taxonomy hash drift")
    taxonomy_version, owners = taxonomy_payload(read_json(taxonomy_path, "refined taxonomy"))
    require(taxonomy_meta.get("version") == taxonomy_version, "taxonomy version drift")
    require(not (set(overlay.get("taxonomyGaps", [])) if isinstance(overlay.get("taxonomyGaps"), list) else overlay.get("taxonomyGaps")), "taxonomy gap inventory is not empty")

    output_meta = overlay.get("output")
    output_path = resolve_metadata_path(overlay_path.parent, output_meta, "output")
    output_hash = sha256_file(output_path)
    require(output_meta.get("sha256") == output_hash, "output hash drift")
    output_records = load_records(read_json(output_path, "candidate output"), "candidate output questions")
    require(len(output_records) == EXPECTED_COUNT, "candidate output: expected exactly 2,684 questions")
    output_ids = [record["id"] for record in output_records]
    require(output_ids == source_ids, "candidate output IDs are not exactly the frozen ordered source IDs")

    overlay_records = overlay.get("records")
    require(isinstance(overlay_records, list) and len(overlay_records) == EXPECTED_COUNT, "overlay classification record count: expected exactly 2,684")
    overlay_record_ids: list[str] = []
    for index, record in enumerate(cast(list[Any], overlay_records)):
        require(isinstance(record, dict), f"overlay.records[{index}]: expected object")
        overlay_record_ids.append(nonempty_string(record.get("id"), f"overlay.records[{index}].id"))
    require(len(overlay_record_ids) == len(set(overlay_record_ids)), "duplicate overlay classification ID")
    require(overlay_record_ids == source_ids, "overlay classification IDs are not ordered like the frozen source")
    overlay_ids: list[str] = []
    classifications: list[dict[str, Any]] = []
    for index, (source, candidate, row) in enumerate(zip(source_records, output_records, cast(list[dict[str, Any]], overlay_records), strict=True)):
        label = f"question {source['id']}"
        require(isinstance(row, dict), f"overlay.records[{index}]: expected object")
        require(row.get("id") == source["id"], f"{label}: overlay ID/order drift")
        overlay_ids.append(row["id"])
        primary, secondary, skills = validate_classification(row, owners, label)
        candidate_primary = nonempty_string(candidate.get("primaryTopic"), f"{label}.output.primaryTopic")
        candidate_secondary = string_list(candidate.get("secondaryTopics"), f"{label}.output.secondaryTopics")
        candidate_skills = string_list(candidate.get("skills"), f"{label}.output.skills", allow_empty=False)
        candidate_classification = {"primaryTopic": candidate_primary, "secondaryTopics": candidate_secondary, "skills": candidate_skills, "taxonomyGap": candidate.get("taxonomyGap")}
        require(candidate_classification == {"primaryTopic": primary, "secondaryTopics": secondary, "skills": skills, "taxonomyGap": row.get("taxonomyGap")}, f"{label}: output classification drift")
        require(nonclassification_record(candidate) == nonclassification_record(source), f"{label}: non-classification fields changed")
        expected_nonclass_hash = nonclassification_hash(source)
        require(row.get("nonClassificationSha256", expected_nonclass_hash) == expected_nonclass_hash, f"{label}: non-classification hash drift")
        if "nonClassificationSha256" in candidate:
            require(candidate["nonClassificationSha256"] == expected_nonclass_hash, f"{label}: output non-classification hash drift")
        search = candidate.get("searchText")
        require(isinstance(search, str) and bool(search.strip()), f"{label}: missing normalized search text")
        search_normalized = normalized_text(search)
        for rich_label in [primary, *secondary, *skills]:
            require(normalized_text(rich_label) in search_normalized, f"{label}: rich label is not discoverable by search")
        classifications.append({"id": source["id"], "primaryTopic": primary, "secondaryTopics": secondary, "skills": skills, "subtopics": candidate.get("subtopics", [])})

    require(overlay_ids == source_ids, "overlay IDs are not exactly the frozen ordered source IDs")
    for row in classifications:
        for topic in [row["primaryTopic"], *row["secondaryTopics"]]:
            require(row in topic_filter(classifications, topic), f"{row['id']}: topic filter cannot discover {topic}")
        for skill in row["skills"]:
            require(row in subtopic_filter(classifications, skill), f"{row['id']}: subtopic filter cannot discover {skill}")

    menus = overlay.get("menus")
    require(isinstance(menus, dict) and set(menus) == set(owners), "menus: topic coverage drift")
    for topic, expected in owners.items():
        actual = string_list(menus.get(topic), f"menus.{topic}", allow_empty=False)
        require(actual == expected, f"{topic}: menu leakage or refined ownership drift")

    delivery_meta = overlay.get("lockedDelivery")
    delivery_path = resolve_metadata_path(overlay_path.parent, delivery_meta, "locked delivery")
    delivery_records = load_records(read_json(delivery_path, "locked delivery"), "locked delivery questions")
    require(len(delivery_records) == EXPECTED_COUNT, "locked delivery: expected exactly 2,684 questions")
    require([record["id"] for record in delivery_records] == source_ids, "locked delivery IDs/order drift")
    for candidate, locked in zip(output_records, delivery_records, strict=True):
        label = f"locked delivery {locked['id']}"
        for key, expected in PROTECTED_FIELDS.items():
            require(locked.get(key) == expected, f"{label}: protected content was not stripped ({key})")
        candidate_primary = nonempty_string(candidate.get("primaryTopic"), f"{label}.output.primaryTopic")
        candidate_secondary = string_list(candidate.get("secondaryTopics"), f"{label}.output.secondaryTopics")
        candidate_skills = string_list(candidate.get("skills"), f"{label}.output.skills", allow_empty=False)
        require(locked.get("primaryTopic") == candidate_primary, f"{label}: classification label was stripped")
        require(locked.get("secondaryTopics") == candidate_secondary, f"{label}: classification label was stripped")
        require(locked.get("skills") == candidate_skills, f"{label}: classification label was stripped")
        search = locked.get("searchText")
        require(isinstance(search, str), f"{label}: missing searchable classification labels")
        search_normalized = normalized_text(search)
        for rich_label in [candidate_primary, *candidate_secondary, *candidate_skills]:
            require(normalized_text(rich_label) in search_normalized, f"{label}: locked classification label is not searchable")
        for key in ("accessibleText", "summary", "solution"):
            protected = candidate.get(key)
            if isinstance(protected, str) and protected.strip():
                require(normalized_text(protected) not in search_normalized, f"{label}: protected {key} leaked into search")

    rebuilds = overlay.get("rebuilds")
    require(isinstance(rebuilds, list) and len(rebuilds) == 2, "deterministic rebuilds: exactly two rebuilds required")
    for index, rebuild in enumerate(rebuilds, start=1):
        rebuild_path = resolve_metadata_path(overlay_path.parent, rebuild, f"rebuild {index}")
        rebuild_hash = sha256_file(rebuild_path)
        require(rebuild.get("sha256") == rebuild_hash == output_hash, f"deterministic rebuild {index}: hash mismatch")

    review_meta = overlay.get("productionReview")
    review_path = resolve_metadata_path(overlay_path.parent, review_meta, "production review")
    review_hash = sha256_file(review_path)
    require(review_meta.get("sha256") == review_hash, "production review hash drift")
    validation = read_json(review_path, "production review validation")
    require(isinstance(validation, dict), "production review validation: expected object")
    require(validation.get("schemaVersion") == REVIEW_SCHEMA_VERSION, "production review validation: schema drift")
    required_validation = {
        "status": "PASS",
        "complete": True,
        "bank": BANK,
        "reviewed": EXPECTED_COUNT,
        "expected": EXPECTED_COUNT,
        "sourceSha256": source_hash,
        "taxonomySha256": taxonomy_hash,
        "outputSha256": output_hash,
        "nonClassificationUnchanged": True,
        "deterministicRebuildsMatch": True,
        "unresolvedTaxonomyGaps": 0,
    }
    for key, expected in required_validation.items():
        require(validation.get(key) == expected, f"production review validation: {key} is not validated")
    validation_hash = sha256_bytes(canonical_bytes(validation))
    require(review_meta.get("validationSha256") == validation_hash, "production review validation hash drift")

    provenance = overlay.get("provenance")
    require(isinstance(provenance, dict), "provenance: missing")
    expected_provenance = {
        "sourceCommit": source_commit,
        "sourceSha256": source_hash,
        "taxonomySha256": taxonomy_hash,
        "productionReviewValidationSha256": validation_hash,
        "outputSha256": output_hash,
    }
    for key, expected in expected_provenance.items():
        require(provenance.get(key) == expected, f"provenance: {key} drift")

    return {
        "status": "PASS",
        "bank": BANK,
        "questionCount": EXPECTED_COUNT,
        "topicCount": len(owners),
        "taxonomyVersion": taxonomy_version,
        "sourceCommit": source_commit,
        "sourceSha256": source_hash,
        "taxonomySha256": taxonomy_hash,
        "outputSha256": output_hash,
        "deterministicRebuilds": 2,
        "unresolvedTaxonomyGaps": 0,
        "complete": True,
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("overlay", type=Path, help="candidate 0580 overlay manifest")
    parser.add_argument(
        "--rebuild",
        dest="rebuild_paths",
        type=Path,
        action="append",
        default=[],
        help="second deterministic generator manifest (required for generator output)",
    )
    args = parser.parse_args(argv)
    try:
        print(json.dumps(validate_overlay(args.overlay, args.rebuild_paths), ensure_ascii=False, indent=2, sort_keys=True))
    except (GateError, OSError, TypeError) as exc:
        print(f"FAIL: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
