#!/usr/bin/env python3
"""Fail-closed validator for classification-v2 production-aware second reviews."""
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Any

from generate_classification_v2_production_review import (
    AUDIT_VERSION,
    CLASSIFICATION_FIELDS,
    REVIEW_VERSION,
    asset_refs,
    canonical_bytes,
    corpus_files,
    load_adjudication_rows,
    load_source_questions,
    nonclassification_hash,
    owned_by_taxonomy,
    resolve_asset,
    semantic,
    sha_bytes,
    sha_file,
    taxonomy_payload,
    tuple_from_row,
    tuple_from_source,
    validate_adjudication,
)

DECISIONS = {"keep_current", "accept_recommended", "modify"}
CONFIDENCES = {"high", "medium", "low"}
MANIFEST_KEYS = {"reviewVersion", "auditVersion", "bank", "count", "batchSize", "batchCount", "reportSha256", "orderedIdSha256", "provenance", "batches"}
PACKET_KEYS = {"reviewVersion", "auditVersion", "bank", "batch", "count", "refinedTaxonomy", "records", "inputSha256"}
PACKET_RECORD_KEYS = {
    "bank", "id", "adjudicationVerdict", "mismatchTypes", "candidateBefore", "candidateAfter", "taxonomyGap",
    "evidence", "rationale", "questionAssets", "markschemeAssets", "officialMarkschemeUnavailable",
    "assetSha256", "nonClassificationSha256",
}
RESULT_KEYS = {"reviewVersion", "batch", "inputSha256", "count", "decisions"}
RESULT_ROW_REQUIRED_KEYS = {
    "id", "decision", "final", "confidence", "evidence", "rationale", "inspectedQuestionAssets",
    "inspectedMarkschemeAssets", "nonClassificationSha256",
}
RESULT_ROW_OPTIONAL_KEYS = {"contextTags"}


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def read_json(path: Path) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ValueError(f"cannot read JSON {path}: {exc}") from exc


def exact_keys(value: Any, expected: set[str], label: str) -> None:
    require(isinstance(value, dict), f"{label}: expected object")
    require(set(value) == expected, f"{label}: keys")


def nonempty_evidence(value: Any) -> bool:
    if isinstance(value, str):
        return bool(value.strip())
    if isinstance(value, list):
        return bool(value) and all(nonempty_evidence(item) for item in value)
    if isinstance(value, dict):
        return bool(value) and all(isinstance(key, str) and bool(key.strip()) and nonempty_evidence(item) for key, item in value.items())
    return False


def validate(
    root: Path,
    *,
    source_questions: Path | None = None,
    refined_taxonomy: Path | None = None,
    asset_root: Path | None = None,
) -> dict[str, Any]:
    root = Path(root).resolve()
    manifest_path = root / "production-review-manifest.json"
    manifest = read_json(manifest_path)
    exact_keys(manifest, MANIFEST_KEYS, "production review manifest")
    require(manifest["reviewVersion"] == REVIEW_VERSION, "manifest: review version drift")
    require(manifest["auditVersion"] == AUDIT_VERSION, "manifest: audit version drift")
    bank = manifest["bank"]
    require(isinstance(bank, str) and bool(bank.strip()), "manifest.bank: expected non-empty string")
    require(isinstance(manifest["count"], int) and manifest["count"] >= 0, "manifest.count: invalid")
    require(isinstance(manifest["batchCount"], int) and manifest["batchCount"] > 0, "manifest.batchCount: invalid")

    provenance = manifest["provenance"]
    require(isinstance(provenance, dict), "manifest provenance: expected object")
    source_provenance = provenance.get("source")
    taxonomy_provenance = provenance.get("refinedTaxonomy")
    corpus_provenance = provenance.get("adjudicationCorpus")
    require(isinstance(source_provenance, dict), "source provenance: missing")
    require(isinstance(taxonomy_provenance, dict), "refined taxonomy provenance: missing")
    require(isinstance(corpus_provenance, dict) and corpus_provenance.get("validated") is True, "adjudication corpus: not validated")
    commit = source_provenance.get("commit")
    require(isinstance(commit, str) and re.fullmatch(r"[0-9a-fA-F]{40}", commit) is not None, "source provenance: invalid commit")

    source_path = Path(source_questions or source_provenance.get("path", "")).resolve()
    taxonomy_path = Path(refined_taxonomy or taxonomy_provenance.get("path", "")).resolve()
    require(source_path.is_file(), "source questions: missing file")
    require(taxonomy_path.is_file(), "refined taxonomy: missing file")
    require(source_provenance.get("path") == str(source_path), "source provenance: path drift")
    require(taxonomy_provenance.get("path") == str(taxonomy_path), "refined taxonomy provenance: path drift")
    require(source_provenance.get("sha256") == sha_file(source_path), "source provenance: hash drift")
    require(taxonomy_provenance.get("sha256") == sha_file(taxonomy_path), "refined taxonomy provenance: hash drift")

    source = load_source_questions(read_json(source_path))
    source_by_id = {question["id"]: question for question in source}
    taxonomy, taxonomy_version = taxonomy_payload(read_json(taxonomy_path), bank)
    require(taxonomy_provenance.get("version") == taxonomy_version, "refined taxonomy provenance: version drift")
    require(taxonomy_provenance.get("canonicalBankSha256") == sha_bytes(canonical_bytes(taxonomy)), "refined taxonomy provenance: canonical hash drift")
    report_path = root / "production-review.json"
    require(report_path.is_file() and sha_file(report_path) == manifest["reportSha256"], "report hash drift")

    corpus_root = Path(corpus_provenance.get("root", "")).resolve()
    require(corpus_root.is_dir(), "adjudication corpus: missing root")
    current_corpus_files = corpus_files(corpus_root)
    require(corpus_provenance.get("files") == current_corpus_files, "adjudication corpus: file hash drift")
    require(corpus_provenance.get("sha256") == sha_bytes(canonical_bytes(current_corpus_files)), "adjudication corpus: hash drift")
    adjudication_validation = validate_adjudication(corpus_root)
    require(corpus_provenance.get("validation") == adjudication_validation, "adjudication corpus: validation result drift")
    queue, adjudication_rows = load_adjudication_rows(corpus_root, adjudication_validation)
    adjudication_by_id = {row["id"]: row for row in adjudication_rows}
    queue_by_id = {record["id"]: record for record in queue["records"]}

    input_dir = root / "production-review-inputs"
    result_dir = root / "production-review-results"
    input_paths = sorted(input_dir.glob("batch-*.json")) if input_dir.is_dir() else []
    require([path.name for path in input_paths] == [f"batch-{index:02d}.json" for index in range(1, manifest["batchCount"] + 1)], "input batch coverage drift")
    manifest_batches = manifest["batches"]
    require(isinstance(manifest_batches, dict) and set(manifest_batches) == {path.name for path in input_paths}, "manifest batch set drift")

    packet_records: list[dict[str, Any]] = []
    for index, input_path in enumerate(input_paths, start=1):
        packet = read_json(input_path)
        exact_keys(packet, PACKET_KEYS, f"{input_path.name}")
        require(packet["reviewVersion"] == REVIEW_VERSION and packet["auditVersion"] == AUDIT_VERSION, f"{input_path.name}: version")
        require(packet["bank"] == bank and packet["batch"] == index, f"{input_path.name}: identity")
        require(packet["count"] == len(packet["records"]), f"{input_path.name}: count")
        require(packet["inputSha256"] == sha_bytes(canonical_bytes({key: packet[key] for key in packet if key != "inputSha256"})), f"{input_path.name}: input hash drift")
        metadata = manifest_batches[input_path.name]
        require(isinstance(metadata, dict) and metadata.get("sha256") == sha_file(input_path), f"{input_path.name}: manifest hash drift")
        require(metadata.get("count") == packet["count"], f"{input_path.name}: manifest count drift")
        require(packet["refinedTaxonomy"] == taxonomy, f"{input_path.name}: taxonomy drift")
        for index_in_batch, record in enumerate(packet["records"]):
            exact_keys(record, PACKET_RECORD_KEYS, f"{input_path.name}.records[{index_in_batch}]")
            question_id = record["id"]
            require(isinstance(question_id, str) and question_id in source_by_id, f"{input_path.name}: unknown source ID {question_id}")
            require(question_id in adjudication_by_id and question_id in queue_by_id, f"{question_id}: missing adjudication corpus row")
            question = source_by_id[question_id]
            before = tuple_from_source(question)
            after = record["candidateAfter"]
            exact_keys(after, {"primaryTopic", "secondaryTopics", "skills"}, f"{question_id}.candidateAfter")
            require(semantic(record["candidateBefore"]) == semantic(before), f"{question_id}: candidate before drift")
            require(semantic(after) == semantic(tuple_from_row(adjudication_by_id[question_id], f"{question_id}.adjudication")), f"{question_id}: candidate after drift")
            require(record["mismatchTypes"] == queue_by_id[question_id]["mismatchTypes"], f"{question_id}: mismatch provenance drift")
            require(record["adjudicationVerdict"] == adjudication_by_id[question_id]["verdict"], f"{question_id}: adjudication verdict drift")
            require(record["taxonomyGap"] == adjudication_by_id[question_id].get("taxonomyGap"), f"{question_id}: taxonomy gap drift")
            if record["taxonomyGap"] is not None:
                require(isinstance(record["taxonomyGap"], str) and bool(record["taxonomyGap"].strip()), f"{question_id}: taxonomy gap")
            require(semantic(before) != semantic(after) or record["taxonomyGap"] is not None, f"{question_id}: no proposed change")
            owned_by_taxonomy(after, taxonomy, f"{question_id}.candidateAfter")
            question_assets = asset_refs(question, "questionImages")
            markscheme_assets = asset_refs(question, "markschemeImages")
            require(record["questionAssets"] == question_assets and record["markschemeAssets"] == markscheme_assets, f"{question_id}: asset references drift")
            require(record["officialMarkschemeUnavailable"] == (not bool(markscheme_assets)), f"{question_id}: markscheme flag drift")
            require(isinstance(record["assetSha256"], dict), f"{question_id}: asset hashes")
            expected_asset_hashes: dict[str, str] = {}
            for reference in [*question_assets, *markscheme_assets]:
                path = resolve_asset(reference, source_path, asset_root, f"{question_id} asset")
                expected_asset_hashes[reference] = sha_file(path)
            require(record["assetSha256"] == expected_asset_hashes, f"{question_id}: asset hash drift")
            require(record["nonClassificationSha256"] == nonclassification_hash(question), f"{question_id}: non-classification drift")
            require(nonempty_evidence(record["evidence"]) and isinstance(record["rationale"], str) and bool(record["rationale"].strip()), f"{question_id}: evidence")
            packet_records.append(record)

    ordered_ids = [record["id"] for record in packet_records]
    require(len(ordered_ids) == len(set(ordered_ids)), "duplicate production-review IDs")
    require(len(ordered_ids) == manifest["count"], "review packet coverage mismatch")
    require(sha_bytes(canonical_bytes(ordered_ids)) == manifest["orderedIdSha256"], "ordered ID hash mismatch")
    require(provenance.get("orderedIdsSha256") == manifest["orderedIdSha256"], "ordered ID provenance drift")
    expected_nonclass_hash = sha_bytes(canonical_bytes([nonclassification_hash(source_by_id[question_id]) for question_id in ordered_ids]))
    require(provenance.get("nonClassificationSha256") == expected_nonclass_hash, "non-classification aggregate hash drift")

    result_paths = sorted(result_dir.glob("batch-*.json")) if result_dir.is_dir() else []
    require([path.name for path in result_paths] == [path.name for path in input_paths], "result batch coverage mismatch")
    reviewed_ids: list[str] = []
    decision_counts = {decision: 0 for decision in sorted(DECISIONS)}
    cursor = 0
    for input_path, result_path in zip(input_paths, result_paths, strict=True):
        packet = read_json(input_path)
        result = read_json(result_path)
        exact_keys(result, RESULT_KEYS, f"{result_path.name}: top keys")
        require(result["reviewVersion"] == REVIEW_VERSION and result["batch"] == packet["batch"], f"{result_path.name}: identity")
        require(result["inputSha256"] == packet["inputSha256"], f"{result_path.name}: input hash drift")
        expected = packet["records"]
        require(result["count"] == len(expected) == len(result["decisions"]), f"{result_path.name}: count")
        require([row.get("id") for row in result["decisions"]] == [row["id"] for row in expected], f"{result_path.name}: ordered IDs")
        for row, record in zip(result["decisions"], expected, strict=True):
            question_id = record["id"]
            require(set(row).issubset(RESULT_ROW_REQUIRED_KEYS | RESULT_ROW_OPTIONAL_KEYS), f"{result_path.name}/{question_id}: keys")
            require(RESULT_ROW_REQUIRED_KEYS.issubset(row), f"{result_path.name}/{question_id}: keys")
            require(row["decision"] in DECISIONS, f"{question_id}: invalid decision")
            exact_keys(row["final"], {"primaryTopic", "secondaryTopics", "skills"}, f"{question_id}.final")
            final = tuple_from_row(row["final"], f"{question_id}.final")
            before = record["candidateBefore"]
            after = record["candidateAfter"]
            owned_by_taxonomy(final, taxonomy, f"{question_id}.final")
            require(row["confidence"] in CONFIDENCES, f"{question_id}: confidence")
            require(nonempty_evidence(row["evidence"]) and isinstance(row["rationale"], str) and bool(row["rationale"].strip()), f"{question_id}: evidence")
            require(row["inspectedQuestionAssets"] == record["questionAssets"], f"{question_id}: question assets")
            require(row["inspectedMarkschemeAssets"] == record["markschemeAssets"], f"{question_id}: markscheme assets")
            require(row["nonClassificationSha256"] == record["nonClassificationSha256"], f"{question_id}: non-classification hash")
            if "contextTags" in row:
                require(record.get("taxonomyGap") is not None, f"{question_id}: context tags require taxonomy gap")
                require(isinstance(row["contextTags"], list) and bool(row["contextTags"]), f"{question_id}: context tags")
                require(all(isinstance(tag, str) and bool(tag.strip()) for tag in row["contextTags"]), f"{question_id}: context tags")
                require(len(row["contextTags"]) == len(set(row["contextTags"])), f"{question_id}: duplicate context tags")
            if row["decision"] == "keep_current":
                require(semantic(final) == semantic(before), f"{question_id}: keep_current tuple mismatch")
            elif row["decision"] == "accept_recommended":
                require(semantic(before) != semantic(after), f"{question_id}: accept_recommended is a no-op")
                require(semantic(final) == semantic(after), f"{question_id}: accept_recommended tuple mismatch")
            else:
                require(semantic(final) != semantic(before) and semantic(final) != semantic(after), f"{question_id}: modify must be distinct")
            reviewed_ids.append(question_id)
            decision_counts[row["decision"]] += 1
        cursor += result["count"]
    require(cursor == len(packet_records) and reviewed_ids == ordered_ids, "review coverage mismatch")
    return {
        "status": "PASS",
        "reviewVersion": REVIEW_VERSION,
        "bank": bank,
        "reviewed": len(reviewed_ids),
        "expected": manifest["count"],
        "decisions": decision_counts,
        "complete": True,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("root", type=Path)
    parser.add_argument("--source-questions", type=Path)
    parser.add_argument("--refined-taxonomy", type=Path)
    parser.add_argument("--asset-root", type=Path)
    args = parser.parse_args()
    print(json.dumps(validate(args.root, source_questions=args.source_questions, refined_taxonomy=args.refined_taxonomy, asset_root=args.asset_root), indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
