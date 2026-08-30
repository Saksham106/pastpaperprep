#!/usr/bin/env python3
"""Build a fail-closed, durable 0580 classification overlay.

The generator validates the sealed production-aware review before reading its
final decisions. It writes a new canonical questions artifact and provenance
report only; source questions, taxonomy, and review artifacts are read-only.
"""
from __future__ import annotations

import argparse
import copy
import hashlib
import json
import os
import shutil
import tempfile
from collections import Counter
from pathlib import Path
from typing import Any, cast

from generate_classification_v2_production_review import (
    CLASSIFICATION_FIELDS,
    canonical_bytes,
    load_source_questions,
    sha_bytes,
    sha_file,
    tuple_from_source,
)
from validate_classification_v2_production_review import validate as validate_review

EXPECTED_SOURCE_COUNT = 2684
EXPECTED_REVIEWED_DECISIONS = 1629
EXPECTED_SOURCE_BLIND_EXACT = 1055
OVERLAY_VERSION = "classification-v2-0580-overlay-1.0"
RUNTIME_CLASSIFICATION_FIELDS = frozenset(CLASSIFICATION_FIELDS)


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def read_json(path: Path) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ValueError(f"cannot read JSON {path}: {exc}") from exc


def nonempty(value: Any, label: str) -> str:
    require(isinstance(value, str) and bool(value.strip()), f"{label}: expected non-empty string")
    return value


def labels(value: Any, label: str) -> list[str]:
    require(isinstance(value, list), f"{label}: expected list")
    result = [nonempty(item, f"{label}[{index}]") for index, item in enumerate(value)]
    require(len(result) == len(set(result)), f"{label}: duplicate labels")
    return result


def nonclassification_hash(question: dict[str, Any]) -> str:
    """Hash the fields an overlay is forbidden to mutate."""
    preserved = {
        key: value for key, value in question.items()
        if key not in RUNTIME_CLASSIFICATION_FIELDS
    }
    return sha_bytes(canonical_bytes(preserved))


def semantic_tuple(value: dict[str, Any]) -> tuple[str, tuple[str, ...], tuple[str, ...]]:
    return (
        value["primaryTopic"],
        tuple(value["secondaryTopics"]),
        tuple(value["skills"]),
    )


def final_tuple(row: dict[str, Any], label: str) -> dict[str, Any]:
    primary = nonempty(row.get("primaryTopic"), f"{label}.primaryTopic")
    secondary = labels(row.get("secondaryTopics"), f"{label}.secondaryTopics")
    skills = sorted(labels(row.get("skills"), f"{label}.skills"))
    require(primary not in secondary, f"{label}: primary in secondary topics")
    return {"primaryTopic": primary, "secondaryTopics": secondary, "skills": skills}


def load_review_decisions(review_root: Path) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """Load ordered decision rows after the production validator has passed."""
    input_dir = review_root / "production-review-inputs"
    result_dir = review_root / "production-review-results"
    input_paths = sorted(input_dir.glob("batch-*.json"))
    result_paths = sorted(result_dir.glob("batch-*.json"))
    require([p.name for p in input_paths] == [p.name for p in result_paths], "production review: result coverage drift")
    records_by_id: dict[str, dict[str, Any]] = {}
    decisions: list[dict[str, Any]] = []
    for input_path, result_path in zip(input_paths, result_paths, strict=True):
        packet = read_json(input_path)
        result = read_json(result_path)
        require(isinstance(packet, dict) and isinstance(result, dict), f"{input_path.name}: expected objects")
        packet_records_value = packet.get("records")
        rows_value = result.get("decisions")
        require(isinstance(packet_records_value, list) and isinstance(rows_value, list), f"{input_path.name}: missing records")
        packet_records = cast(list[dict[str, Any]], packet_records_value)
        rows = cast(list[dict[str, Any]], rows_value)
        require(len(packet_records) == len(rows), f"{input_path.name}: decision count drift")
        for packet_record, row in zip(packet_records, rows, strict=True):
            require(isinstance(packet_record, dict) and isinstance(row, dict), f"{input_path.name}: malformed row")
            question_id = nonempty(row.get("id"), f"{input_path.name}.decision.id")
            require(question_id == packet_record.get("id"), f"{question_id}: packet decision ID drift")
            require(question_id not in records_by_id, f"duplicate reviewed ID {question_id}")
            records_by_id[question_id] = {
                "row": row,
                "packet": packet_record,
            }
            decisions.append({"row": row, "packet": packet_record})
    return decisions, records_by_id


def explicit_exact_ids(review_root: Path) -> list[str] | None:
    """Read optional exact-match IDs without inventing them from labels."""
    report = read_json(review_root / "production-review.json")
    manifest = read_json(review_root / "production-review-manifest.json")
    for payload in (report, manifest):
        if not isinstance(payload, dict):
            continue
        for key in ("sourceBlindExactIds", "exactMatchIds", "exactIds"):
            if key in payload:
                return labels(payload[key], f"production review.{key}")
    return None


def extract_context_tags(row: dict[str, Any], packet: dict[str, Any]) -> list[str] | None:
    """Return only explicitly prescribed gap tags, never taxonomy-derived tags."""
    for payload in (row, packet):
        if not isinstance(payload, dict) or "contextTags" not in payload:
            continue
        return labels(payload["contextTags"], "review contextTags")
    return None


def runtime_search_text(question: dict[str, Any], candidate: dict[str, Any]) -> str:
    solution = question.get("solution") or question.get("independentSolution") or ""
    parts = [
        candidate["primaryTopic"],
        *candidate["secondaryTopics"],
        *candidate["skills"],
        str(question.get("summary") or ""),
        str(question.get("accessibleText") or ""),
        str(solution),
    ]
    return " ".join(part for part in parts if part).lower()


def apply_runtime_fields(
    source: dict[str, Any],
    candidate: dict[str, Any],
    *,
    taxonomy_version: str,
    reviewed_row: dict[str, Any] | None,
    context_tags: list[str] | None,
) -> dict[str, Any]:
    result = copy.deepcopy(source)
    if reviewed_row is not None:
        if "primaryTopic" in source:
            result["primaryTopic"] = candidate["primaryTopic"]
        if "secondaryTopics" in source:
            result["secondaryTopics"] = candidate["secondaryTopics"]
        for field in ("subtopics", "detailedSubtopics"):
            if field in source:
                result[field] = candidate["skills"]
    # These fields are updated only when the frozen source schema already has
    # them. v2-only metadata and context tags are never added to a raw source
    # record merely because the refined taxonomy contains those concepts.
    if reviewed_row is not None:
        confidence = reviewed_row.get("confidence")
        if "classificationEvidence" in source:
            evidence = source["classificationEvidence"]
            require(isinstance(evidence, dict), f"{source['id']}.classificationEvidence: expected object")
            evidence = copy.deepcopy(evidence)
            evidence["confidence"] = confidence
            evidence["reviewStatus"] = "classification-v2-production-reviewed"
            evidence["version"] = taxonomy_version
            result["classificationEvidence"] = evidence
        if "classificationConfidence" in source:
            result["classificationConfidence"] = confidence
        if "classificationReviewStatus" in source:
            result["classificationReviewStatus"] = "classification-v2-production-reviewed"
        if "classificationVersion" in source:
            result["classificationVersion"] = taxonomy_version
        if context_tags is not None and "contextTags" in source:
            result["contextTags"] = context_tags
    return result


def category(before: dict[str, Any], after: dict[str, Any], taxonomy_gap: Any) -> str:
    changed = [
        short for field, short in (("primaryTopic", "primary"), ("secondaryTopics", "secondary"), ("skills", "skill"))
        if before[field] != after[field]
    ]
    if taxonomy_gap is not None:
        changed.append("taxonomy-gap")
    return "+".join(changed) if changed else "unchanged"


def generate(
    source_questions: Path,
    refined_taxonomy: Path,
    production_review_root: Path,
    output_root: Path,
    *,
    expected_source_count: int = EXPECTED_SOURCE_COUNT,
    expected_reviewed: int = EXPECTED_REVIEWED_DECISIONS,
    expected_exact: int | None = EXPECTED_SOURCE_BLIND_EXACT,
    asset_root: Path | None = None,
) -> dict[str, Any]:
    source_questions = Path(source_questions).resolve()
    refined_taxonomy = Path(refined_taxonomy).resolve()
    production_review_root = Path(production_review_root).resolve()
    output_root = Path(output_root).resolve()
    require(not output_root.exists(), "output root already exists; refusing to overwrite output")
    require(source_questions.is_file(), "source questions: missing file")
    require(refined_taxonomy.is_file(), "refined taxonomy: missing file")
    require(production_review_root.is_dir(), "production review: missing root")
    require(output_root != source_questions and not source_questions.is_relative_to(output_root), "output must not contain source")
    require(output_root != refined_taxonomy and not refined_taxonomy.is_relative_to(output_root), "output must not contain taxonomy")
    require(output_root != production_review_root and not output_root.is_relative_to(production_review_root), "output must not contain review root")

    source_payload = read_json(source_questions)
    require(isinstance(source_payload, dict) and isinstance(source_payload.get("questions"), list), "source questions: expected 0580 object with questions list")
    source = load_source_questions(source_payload)
    require(len(source) == expected_source_count, f"source questions: expected {expected_source_count}, got {len(source)}")
    source_by_id = {question["id"]: question for question in source}

    review_validation = validate_review(
        production_review_root,
        source_questions=source_questions,
        refined_taxonomy=refined_taxonomy,
        asset_root=asset_root,
    )
    require(review_validation.get("status") == "PASS", "production review: validator did not PASS")
    require(review_validation.get("reviewed") == review_validation.get("expected") == expected_reviewed,
            f"production review: expected PASS reviewed=expected={expected_reviewed}")

    manifest = read_json(production_review_root / "production-review-manifest.json")
    report = read_json(production_review_root / "production-review.json")
    bank = nonempty(manifest.get("bank"), "production review manifest.bank")
    require(bank == "igcse", f"production review: expected 0580 bank igcse, got {bank}")
    taxonomy_report = report.get("provenance", {}).get("refinedTaxonomy", {}) if isinstance(report, dict) else {}
    taxonomy_version = nonempty(taxonomy_report.get("version"), "refined taxonomy version")

    decisions, decisions_by_id = load_review_decisions(production_review_root)
    reviewed_ids = [item["row"]["id"] for item in decisions]
    require(len(reviewed_ids) == expected_reviewed, "production review: decision coverage drift")
    require(len(set(reviewed_ids)) == len(reviewed_ids), "duplicate reviewed IDs")
    require(set(reviewed_ids).issubset(source_by_id), "production review: decision references missing source ID")

    exact_ids = explicit_exact_ids(production_review_root)
    if exact_ids is None:
        exact_ids = [question["id"] for question in source if question["id"] not in decisions_by_id]
    require(len(exact_ids) == len(set(exact_ids)), "duplicate source/blind exact IDs")
    require(set(exact_ids).issubset(source_by_id), "source/blind exact ID missing from source")
    require(set(exact_ids).isdisjoint(decisions_by_id), "source/blind exact ID overlaps reviewed decision")
    if expected_exact is not None:
        require(len(exact_ids) == expected_exact,
                f"source/blind exact coverage: expected {expected_exact}, got {len(exact_ids)}")

    covered = set(reviewed_ids) | set(exact_ids)
    require(covered == set(source_by_id), "overlay ID coverage does not equal source IDs")
    require(len(covered) == expected_source_count, "overlay output ID count mismatch")

    output_questions: list[dict[str, Any]] = []
    report_records: list[dict[str, Any]] = []
    category_counts: Counter[str] = Counter()
    changed_count = 0
    for question in source:
        question_id = question["id"]
        before = tuple_from_source(question)
        decision_item = decisions_by_id.get(question_id)
        if decision_item is None:
            after = before
            decision_name = "source_blind_exact"
            confidence = None
            gap = None
            context_tags = None
            pinned_hash = nonclassification_hash(question)
        else:
            row = decision_item["row"]
            packet = decision_item["packet"]
            after = final_tuple(row["final"], f"{question_id}.final")
            decision_name = nonempty(row.get("decision"), f"{question_id}.decision")
            confidence = row.get("confidence")
            gap = packet.get("taxonomyGap")
            context_tags = extract_context_tags(row, packet) if gap is not None else None
            pinned_hash = row.get("nonClassificationSha256")
            require(pinned_hash == nonclassification_hash(question), f"{question_id}: non-classification hash drift")
        changed_fields = category(before, after, gap).split("+") if category(before, after, gap) != "unchanged" else []
        row_category = category(before, after, gap)
        category_counts[row_category] += 1
        if before != after:
            changed_count += 1
        output_question = apply_runtime_fields(
            question,
            after,
            taxonomy_version=taxonomy_version,
            reviewed_row=decision_item["row"] if decision_item else None,
            context_tags=context_tags,
        )
        source_nonclassification = {
            key: value for key, value in question.items()
            if key not in RUNTIME_CLASSIFICATION_FIELDS
        }
        output_nonclassification = {
            key: value for key, value in output_question.items()
            if key not in RUNTIME_CLASSIFICATION_FIELDS
        }
        require(output_nonclassification == source_nonclassification, f"{question_id}: non-classification fields changed")
        output_questions.append(output_question)
        report_records.append({
            "id": question_id,
            "decision": decision_name,
            "changedFields": changed_fields,
            "classification": after,
            "nonClassificationSha256": pinned_hash,
        })

    output_payload = copy.deepcopy(source_payload) if isinstance(source_payload, dict) else {"questions": []}
    output_payload["questions"] = output_questions
    output_bytes = canonical_bytes(output_payload)
    ordered_ids = [question["id"] for question in output_questions]
    output_nonclass_hash = sha_bytes(canonical_bytes([nonclassification_hash(question) for question in output_questions]))
    source_nonclass_hash = sha_bytes(canonical_bytes([nonclassification_hash(question) for question in source]))
    hashes = {
        "sourceQuestionsSha256": sha_file(source_questions),
        "refinedTaxonomySha256": sha_file(refined_taxonomy),
        "productionReviewManifestSha256": sha_file(production_review_root / "production-review-manifest.json"),
        "productionReviewReportSha256": sha_file(production_review_root / "production-review.json"),
        "orderedIdsSha256": sha_bytes(canonical_bytes(ordered_ids)),
        "sourceNonClassificationSha256": source_nonclass_hash,
        "outputNonClassificationSha256": output_nonclass_hash,
        "outputQuestionsSha256": sha_bytes(output_bytes),
    }
    report_payload = {
        "overlayVersion": OVERLAY_VERSION,
        "bank": bank,
        "taxonomyVersion": taxonomy_version,
        "hashes": hashes,
        "counts": {
            "sourceQuestions": len(source),
            "reviewedDecisions": len(decisions),
            "sourceBlindExactMatches": len(exact_ids),
            "changedQuestions": changed_count,
            "unchangedQuestions": len(source) - changed_count,
            "outputQuestions": len(output_questions),
            "changeCategories": dict(sorted(category_counts.items())),
        },
        "provenance": {
            "sourceQuestions": {"path": str(source_questions), "sha256": sha_file(source_questions)},
            "refinedTaxonomy": {"path": str(refined_taxonomy), "sha256": sha_file(refined_taxonomy)},
            "productionReviewRoot": {"path": str(production_review_root), "validation": review_validation},
            "productionReviewManifestSha256": sha_file(production_review_root / "production-review-manifest.json"),
            "productionReviewReportSha256": sha_file(production_review_root / "production-review.json"),
            "orderedIdsSha256": sha_bytes(canonical_bytes(ordered_ids)),
            "sourceNonClassificationSha256": source_nonclass_hash,
            "outputNonClassificationSha256": output_nonclass_hash,
            "outputQuestionsSha256": sha_bytes(output_bytes),
        },
        "records": report_records,
    }
    report_bytes = canonical_bytes(report_payload)
    manifest_payload = {
        "overlayVersion": OVERLAY_VERSION,
        "bank": bank,
        "questionsSha256": sha_bytes(output_bytes),
        "reportSha256": sha_bytes(report_bytes),
        "orderedIdsSha256": report_payload["provenance"]["orderedIdsSha256"],
        "counts": report_payload["counts"],
    }

    require(output_root.parent.is_dir(), "output parent directory is missing")
    stage = Path(tempfile.mkdtemp(prefix="classification-v2-0580-overlay-", dir=str(output_root.parent)))
    published = False
    try:
        (stage / "questions.json").write_bytes(output_bytes)
        (stage / "overlay-report.json").write_bytes(report_bytes)
        (stage / "overlay-manifest.json").write_bytes(canonical_bytes(manifest_payload))
        # mkdir is the no-replace publication primitive: unlike os.replace on
        # a directory, it cannot clobber an output created after the preflight.
        output_root.mkdir()
        published = True
        for name in ("questions.json", "overlay-report.json", "overlay-manifest.json"):
            os.replace(stage / name, output_root / name)
        stage.rmdir()
    except Exception:
        if published:
            shutil.rmtree(output_root, ignore_errors=True)
        shutil.rmtree(stage, ignore_errors=True)
        raise
    return report_payload


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-questions", "--source", dest="source_questions", type=Path, required=True)
    parser.add_argument("--refined-taxonomy", "--taxonomy", dest="refined_taxonomy", type=Path, required=True)
    parser.add_argument("--production-review-root", "--review-root", dest="production_review_root", type=Path, required=True)
    parser.add_argument("--output-root", type=Path, required=True)
    parser.add_argument("--asset-root", type=Path)
    parser.add_argument("--expected-source-count", type=int, default=EXPECTED_SOURCE_COUNT)
    parser.add_argument("--expected-reviewed", type=int, default=EXPECTED_REVIEWED_DECISIONS)
    parser.add_argument("--expected-exact", type=int, default=EXPECTED_SOURCE_BLIND_EXACT)
    args = parser.parse_args()
    report = generate(
        args.source_questions,
        args.refined_taxonomy,
        args.production_review_root,
        args.output_root,
        expected_source_count=args.expected_source_count,
        expected_reviewed=args.expected_reviewed,
        expected_exact=args.expected_exact,
        asset_root=args.asset_root,
    )
    print(json.dumps({"status": "PASS", "counts": report["counts"], "output": str(args.output_root.resolve())}, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
