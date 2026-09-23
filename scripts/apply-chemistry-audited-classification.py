#!/usr/bin/env python3
"""Apply the independently audited Chemistry 0620 base classifications.

The 3,529-row 2021–2025 classification artifact replaces classification fields
only. Existing question text, marks, answers, source URLs, asset paths, and all
1,600 extension rows remain unchanged. The script is deterministic and
fail-closed on artifact, audit, taxonomy, identity, or provenance drift.
"""
from __future__ import annotations

import copy
import hashlib
import json
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RUNTIME_PATH = ROOT / "src/data/production/igcse-chemistry-0620.json"
PRIVATE_INDEX_PATH = ROOT / "src/data/private-index/igcse-chemistry-0620.json"
TAXONOMY_PATH = ROOT / "src/data/igcse-chemistry-0620-official-taxonomy.json"
ARTIFACT_PATH = ROOT / "data/release/chemistry-0620-audited-base/chemistry0620-final.json"
AUDIT_PATH = ROOT / "data/release/chemistry-0620-audited-base/final-assembled-artifact-audit.json"
RECEIPT_PATH = ROOT / "data/release/chemistry-0620-audited-base-classification-receipt.json"

EXPECTED_ARTIFACT_SHA256 = "c56b92729cdfbccd7ec0d835c924c708f9992b5b75b70e079ff1035e1dc62a1c"
EXPECTED_AUDIT_SHA256 = "fcf644c900f97b19498af43d61c508f0603d78e02dff2e0853d82acd7846e741"
EXPECTED_TAXONOMY_SHA256 = "269bc6f0c3d61c9f4bade7f453a6776d58f869b3e51aed7d6c8e71bb4663d9b0"
EXPECTED_PREVIOUS_RUNTIME_SHA256 = "eb2199305060fa0d19bacd30fbdb84e59a0cadc5058d2bde9bda9b6a3bc10930"
EXPECTED_GENERATED_RUNTIME_SHA256 = "89d67f190a33373ac8dfb41cadfe04876c4d1123e5e787b12af16d63bbf63b79"

BASE_COUNT = 3529
EXTENSION_COUNT = 1600
TOTAL_COUNT = BASE_COUNT + EXTENSION_COUNT
CLASSIFICATION_FIELDS = {
    "courseEra",
    "paperTier",
    "primaryTopic",
    "primaryTopicId",
    "secondaryTopics",
    "subtopics",
    "detailedSubtopics",
    "secondarySubtopics",
    "skills",
    "assessmentObjectives",
    "classificationReviewStatus",
    "classificationProvenance",
}


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def sha256_path(path: Path) -> str:
    return sha256_bytes(path.read_bytes())


def canonical_json(value: object) -> bytes:
    def javascript_numbers(item: object) -> object:
        if isinstance(item, float) and item.is_integer():
            return int(item)
        if isinstance(item, list):
            return [javascript_numbers(child) for child in item]
        if isinstance(item, dict):
            return {key: javascript_numbers(child) for key, child in item.items()}
        return item

    return json.dumps(
        javascript_numbers(value), separators=(",", ":"), ensure_ascii=False
    ).encode()


def canonical_sha256(value: object) -> str:
    return sha256_bytes(canonical_json(value))


def validate_runtime_source_hash(runtime_sha256: str) -> None:
    """Accept only the pinned baseline or this migration's exact output.

    The second hash makes deterministic reruns idempotent without allowing an
    unknown production runtime to be silently rewritten.
    """
    allowed = {
        EXPECTED_PREVIOUS_RUNTIME_SHA256,
        EXPECTED_GENERATED_RUNTIME_SHA256,
    }
    if runtime_sha256 not in allowed:
        raise ValueError(
            "production Chemistry runtime drift: expected the pinned pre-migration "
            "runtime or this migration's exact generated output"
        )


def unique(values: list[str]) -> list[str]:
    return list(dict.fromkeys(values))


def strip_classification(row: dict) -> dict:
    return {key: value for key, value in row.items() if key not in CLASSIFICATION_FIELDS}


def resolve_detail(
    value: dict | str | None,
    question_id: str,
    details: dict[str, dict],
    topics: dict[str, dict],
    subtopics: dict[tuple[str, str], dict],
) -> dict | None:
    if value is None:
        return None
    detail_id = value if isinstance(value, str) else value.get("detail_id")
    detail = details.get(detail_id)
    if detail is None:
        raise ValueError(f"unknown taxonomy detail {detail_id!r} for {question_id}")
    topic = topics.get(detail["ownerTopicId"])
    subtopic = subtopics.get((detail["ownerTopicId"], detail["ownerSubtopicCode"]))
    if topic is None or subtopic is None:
        raise ValueError(f"incomplete taxonomy mapping for {detail_id} ({question_id})")
    return {
        "id": detail_id,
        "topic_id": topic["id"],
        "topic_title": topic["title"],
        "subtopic_code": subtopic["id"],
        "subtopic_title": subtopic["title"],
    }


def apply_classification(
    current: dict,
    final_row: dict,
    details: dict[str, dict],
    topics: dict[str, dict],
    subtopics: dict[tuple[str, str], dict],
) -> dict:
    question_id = current["id"]
    primary = resolve_detail(final_row.get("primary"), question_id, details, topics, subtopics)
    secondary = [
        resolve_detail(item, question_id, details, topics, subtopics)
        for item in final_row.get("secondary", [])
    ]
    practical = [
        resolve_detail(item, question_id, details, topics, subtopics)
        for item in final_row.get("practical_skills", [])
    ]
    primary_is_practical = primary is not None and primary["topic_id"] == "practical-skills"

    skills = unique(
        ([primary["subtopic_title"]] if primary_is_practical else [])
        + [item["subtopic_title"] for item in practical]
    )
    subtopic_labels = unique(
        ([primary["subtopic_title"]] if primary is not None and not primary_is_practical else [])
        + [
            item["subtopic_title"]
            for item in secondary
            if item["topic_id"] != "practical-skills"
        ]
    )
    secondary_labels = unique([item["subtopic_title"] for item in secondary])
    secondary_topic_labels = unique([item["topic_title"] for item in secondary])
    gaps = unique([gap for gap in final_row.get("gaps", []) if gap])
    unresolved = final_row.get("status") != "classified" or primary is None
    if unresolved and not gaps:
        gaps = [
            "Source evidence was insufficient for a defensible taxonomy assignment."
            if final_row.get("source_status") == "source_insufficient"
            else "No exact syllabus taxonomy owner was identified from the available evidence."
        ]

    updated = copy.deepcopy(current)
    updated.update(
        {
            "courseEra": (final_row.get("primary") or {}).get("era") or final_row.get("era"),
            "paperTier": final_row.get("tier"),
            "primaryTopic": primary["topic_title"] if primary else "Other",
            "primaryTopicId": primary["topic_id"] if primary else None,
            "secondaryTopics": secondary_topic_labels,
            "subtopics": subtopic_labels,
            "detailedSubtopics": unique(subtopic_labels + skills),
            "secondarySubtopics": secondary_labels,
            "skills": skills,
            "assessmentObjectives": [],
            "classificationReviewStatus": "unresolved_taxonomy_gap" if unresolved else "classified",
            "classificationProvenance": {
                "selectedSource": "independently-audited-final-classification",
                "sourceRowId": question_id,
                "primaryDetailId": primary["id"] if primary else None,
                "secondaryDetailIds": [item["id"] for item in secondary],
                "practicalDetailIds": unique(
                    ([primary["id"]] if primary_is_practical else [])
                    + [item["id"] for item in practical]
                ),
                "officialCode": (final_row.get("primary") or {}).get("official_code"),
                "finalStatus": final_row.get("status"),
                "sourceStatus": final_row.get("source_status"),
                "gaps": gaps,
                "classificationArtifact": "data/release/chemistry-0620-audited-base/chemistry0620-final.json",
                "classificationArtifactSha256": EXPECTED_ARTIFACT_SHA256,
                "classificationAudit": "data/release/chemistry-0620-audited-base/final-assembled-artifact-audit.json",
                "classificationAuditSha256": EXPECTED_AUDIT_SHA256,
                "taxonomyPath": "src/data/igcse-chemistry-0620-official-taxonomy.json",
            },
        }
    )
    if strip_classification(current) != strip_classification(updated):
        raise ValueError(f"non-classification fields changed for {question_id}")
    return updated


def main() -> None:
    artifact_bytes = ARTIFACT_PATH.read_bytes()
    audit_bytes = AUDIT_PATH.read_bytes()
    taxonomy_bytes = TAXONOMY_PATH.read_bytes()
    if sha256_bytes(artifact_bytes) != EXPECTED_ARTIFACT_SHA256:
        raise ValueError("audited Chemistry classification artifact drift")
    if sha256_bytes(audit_bytes) != EXPECTED_AUDIT_SHA256:
        raise ValueError("Chemistry classification audit drift")
    if sha256_bytes(taxonomy_bytes) != EXPECTED_TAXONOMY_SHA256:
        raise ValueError("Chemistry app taxonomy drift")

    artifact = json.loads(artifact_bytes)
    audit = json.loads(audit_bytes)
    taxonomy = json.loads(taxonomy_bytes)
    runtime_bytes_before = RUNTIME_PATH.read_bytes()
    validate_runtime_source_hash(sha256_bytes(runtime_bytes_before))
    runtime = json.loads(runtime_bytes_before)

    if audit.get("verdict") != "PASS":
        raise ValueError("Chemistry final artifact audit is not PASS")
    if audit.get("artifact", {}).get("sha256") != EXPECTED_ARTIFACT_SHA256:
        raise ValueError("audit does not bind the imported artifact hash")
    if artifact.get("row_count") != BASE_COUNT or len(artifact.get("rows", [])) != BASE_COUNT:
        raise ValueError("audited Chemistry artifact must contain 3,529 rows")
    if runtime.get("questionCount") != TOTAL_COUNT or len(runtime.get("questions", [])) != TOTAL_COUNT:
        raise ValueError("production Chemistry runtime must contain 5,129 rows")

    final_ids = [row["question_id"] for row in artifact["rows"]]
    if len(set(final_ids)) != BASE_COUNT:
        raise ValueError("audited Chemistry artifact contains duplicate IDs")
    current_by_id = {row["id"]: row for row in runtime["questions"]}
    if len(current_by_id) != TOTAL_COUNT:
        raise ValueError("production Chemistry runtime contains duplicate IDs")
    missing = sorted(set(final_ids) - set(current_by_id))
    if missing:
        raise ValueError(f"audited Chemistry IDs missing from production runtime: {missing[:5]}")

    topics = {item["id"]: item for item in taxonomy["topics"]}
    subtopics = {(item["ownerTopicId"], item["id"]): item for item in taxonomy["subtopics"]}
    details = {item["id"]: item for item in taxonomy["details"]}
    final_by_id = {row["question_id"]: row for row in artifact["rows"]}

    extension_before = [copy.deepcopy(row) for row in runtime["questions"] if row["id"] not in final_by_id]
    if len(extension_before) != EXTENSION_COUNT:
        raise ValueError(f"expected 1,600 extension rows, got {len(extension_before)}")
    extension_sha256 = canonical_sha256(extension_before)

    questions = []
    base_rows = []
    for row in runtime["questions"]:
        final_row = final_by_id.get(row["id"])
        if final_row is None:
            questions.append(copy.deepcopy(row))
            continue
        updated = apply_classification(row, final_row, details, topics, subtopics)
        questions.append(updated)
        base_rows.append(updated)

    extension_after = [row for row in questions if row["id"] not in final_by_id]
    if extension_after != extension_before or canonical_sha256(extension_after) != extension_sha256:
        raise ValueError("extension rows changed while applying base classification")
    if len(base_rows) != BASE_COUNT:
        raise ValueError("not all audited base rows were applied")

    expected_null_ids = {row["question_id"] for row in artifact["rows"] if not row.get("primary")}
    actual_unresolved_ids = {
        row["id"] for row in base_rows if row["classificationReviewStatus"] == "unresolved_taxonomy_gap"
    }
    if expected_null_ids != actual_unresolved_ids:
        raise ValueError("audited null-primary rows were not preserved exactly")
    if any(
        row["classificationReviewStatus"] == "unresolved_taxonomy_gap"
        and not row["classificationProvenance"]["gaps"]
        for row in base_rows
    ):
        raise ValueError("unresolved audited Chemistry row lacks an explicit gap")

    status_counts = Counter(row["classificationReviewStatus"] for row in base_rows)
    final_status_counts = Counter(row["status"] for row in artifact["rows"])
    source_status_counts = Counter(row["source_status"] for row in artifact["rows"])
    if status_counts != Counter({"classified": 2804, "unresolved_taxonomy_gap": 725}):
        raise ValueError(f"unexpected base classification counts: {status_counts}")

    runtime["questions"] = questions
    runtime["version"] = "igcse-chemistry-0620-release-candidate-v3-audited-base"
    runtime["questionCount"] = TOTAL_COUNT
    runtime["releaseStatus"] = "production"
    runtime["publicationStatus"] = "production"
    runtime["assetVerification"] = "verified_readback"
    runtime["auditedBaseClassification"] = {
        "artifactPath": "data/release/chemistry-0620-audited-base/chemistry0620-final.json",
        "artifactSha256": EXPECTED_ARTIFACT_SHA256,
        "auditPath": "data/release/chemistry-0620-audited-base/final-assembled-artifact-audit.json",
        "auditSha256": EXPECTED_AUDIT_SHA256,
        "auditVerdict": "PASS",
        "rowCount": BASE_COUNT,
        "classifiedCount": status_counts["classified"],
        "unresolvedCount": status_counts["unresolved_taxonomy_gap"],
        "sourceStatusCounts": dict(sorted(source_status_counts.items())),
        "finalStatusCounts": dict(sorted(final_status_counts.items())),
        "extensionRowsPreserved": EXTENSION_COUNT,
        "assetMutation": False,
    }
    runtime_artifact = runtime.setdefault("runtimeArtifact", {})
    runtime_artifact.update(
        {
            "auditedBaseClassificationSha256": EXPECTED_ARTIFACT_SHA256,
            "auditedBaseClassificationAuditSha256": EXPECTED_AUDIT_SHA256,
            "auditedBaseQuestionCount": BASE_COUNT,
            "auditedBaseClassifiedCount": status_counts["classified"],
            "auditedBaseUnresolvedCount": status_counts["unresolved_taxonomy_gap"],
        }
    )
    runtime_artifact["runtimeSha256"] = None
    runtime_artifact["runtimeSha256"] = canonical_sha256(runtime)

    runtime_output = canonical_json(runtime) + b"\n"
    runtime_output_sha256 = sha256_bytes(runtime_output)
    RUNTIME_PATH.write_bytes(runtime_output)

    private_rows = [
        {
            key: question.get(key)
            for key in [
                "id",
                "number",
                "paper",
                "year",
                "session",
                "primaryTopic",
                "secondaryTopics",
                "skills",
                "subtopics",
                "subject",
                "zone",
                "component",
                "marks",
            ]
        }
        for question in questions
    ]
    private = {"version": 2, "bank": "igcse-chemistry-0620", "questions": private_rows}
    PRIVATE_INDEX_PATH.write_text(json.dumps(private, indent=2, ensure_ascii=False) + "\n")

    receipt = {
        "schemaVersion": "chemistry-0620-audited-base-classification-v1",
        "bank": "igcse-chemistry-0620",
        "status": "PASS",
        "productionRuntime": {
            "path": "src/data/production/igcse-chemistry-0620.json",
            "previousSha256": EXPECTED_PREVIOUS_RUNTIME_SHA256,
            "sha256": runtime_output_sha256,
            "runtimeSha256": runtime_artifact["runtimeSha256"],
            "questionCount": TOTAL_COUNT,
            "releaseStatus": runtime["releaseStatus"],
            "publicationStatus": runtime["publicationStatus"],
            "assetVerification": runtime["assetVerification"],
        },
        "auditedBase": {
            "artifactPath": "data/release/chemistry-0620-audited-base/chemistry0620-final.json",
            "artifactSha256": EXPECTED_ARTIFACT_SHA256,
            "auditPath": "data/release/chemistry-0620-audited-base/final-assembled-artifact-audit.json",
            "auditSha256": EXPECTED_AUDIT_SHA256,
            "auditVerdict": "PASS",
            "rowsApplied": BASE_COUNT,
            "classified": status_counts["classified"],
            "unresolved": status_counts["unresolved_taxonomy_gap"],
            "nonClassificationFieldsPreserved": BASE_COUNT,
        },
        "extension": {
            "rowsPreserved": EXTENSION_COUNT,
            "canonicalSha256": extension_sha256,
            "byteEquivalentInContent": True,
        },
        "assets": {
            "mutation": False,
            "manifestPath": "data/storage/igcse-chemistry-0620.manifest.json",
            "manifestSha256": sha256_path(ROOT / "data/storage/igcse-chemistry-0620.manifest.json"),
            "receiptPath": "data/storage/igcse-chemistry-0620.receipt.json",
            "receiptSha256": sha256_path(ROOT / "data/storage/igcse-chemistry-0620.receipt.json"),
            "storageState": "verified_readback",
        },
        "taxonomy": {
            "path": "src/data/igcse-chemistry-0620-official-taxonomy.json",
            "sha256": EXPECTED_TAXONOMY_SHA256,
        },
        "invariants": {
            "exactAuditedIdCoverage": True,
            "duplicateQuestionIds": 0,
            "unresolvedRowsHaveNoFallbackPrimary": True,
            "unresolvedRowsHaveExplicitGaps": True,
            "sourceAssetsMarksAnswersPreserved": True,
            "extensionRowsUnchanged": True,
            "storageObjectsUnchanged": True,
        },
    }
    RECEIPT_PATH.write_text(json.dumps(receipt, indent=2, ensure_ascii=False) + "\n")

    print(
        json.dumps(
            {
                "status": "PASS",
                "runtime_sha256": runtime_output_sha256,
                "rows": TOTAL_COUNT,
                "base_classified": status_counts["classified"],
                "base_unresolved": status_counts["unresolved_taxonomy_gap"],
                "extension_preserved": EXTENSION_COUNT,
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
