#!/usr/bin/env python3
"""Validate adjudications, apply canonical-ownership repairs, and emit QA metrics."""
from __future__ import annotations

import hashlib
import json
import math
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

ROOT = Path("/tmp/ppp-semantic-audit-2026-08")
REPO_ROOT = Path(__file__).resolve().parents[1]
TAXONOMY_PATH = REPO_ROOT / "scripts" / "classification-semantic-canonical-taxonomy.json"
ADJ_TOP = {"auditVersion", "batch", "inputSha256", "count", "judgments"}
ADJ_ROW = {
    "bank", "id", "verdict", "primaryTopic", "secondaryTopics", "skills", "confidence",
    "taxonomyGap", "evidence", "rationale", "inspectedQuestionAssets", "inspectedMarkschemeAssets",
}
REPAIR_TOP = {"auditVersion", "batch", "inputSha256", "count", "repairs"}
REPAIR_ROW = {
    "bank", "id", "primaryTopic", "secondaryTopics", "skills", "confidence", "evidence",
    "rationale", "inspectedQuestionAssets", "inspectedMarkschemeAssets",
}
VERDICTS = {"production_correct", "blind_correct", "modified", "taxonomy_gap"}
CONFIDENCE = {"high", "medium", "low"}


def canonical_bytes(value: Any) -> bytes:
    return (json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n").encode()


def sha_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def semantic(value: dict[str, Any]) -> tuple[str, tuple[str, ...], tuple[str, ...]]:
    return (
        value["primaryTopic"],
        tuple(sorted(set(value.get("secondaryTopics") or []))),
        tuple(sorted(set(value.get("skills") or value.get("subtopics") or []))),
    )


def evidence_length(value: Any) -> int:
    if isinstance(value, str):
        return len(value.strip())
    if isinstance(value, list) and all(isinstance(item, str) for item in value):
        return len(" ".join(item.strip() for item in value).strip())
    return 0


def validate_labels(row: dict[str, Any], taxonomy: dict[str, dict[str, list[str]]]) -> None:
    bank = row["bank"]
    if bank not in taxonomy:
        raise ValueError(f"{row['id']}: unknown bank")
    bank_taxonomy = taxonomy[bank]
    secondary = row["secondaryTopics"]
    skills = row["skills"]
    if not isinstance(secondary, list) or not all(isinstance(v, str) for v in secondary):
        raise ValueError(f"{row['id']}: invalid secondary topics")
    if not isinstance(skills, list) or not all(isinstance(v, str) for v in skills):
        raise ValueError(f"{row['id']}: invalid skills")
    if len(secondary) != len(set(secondary)) or len(skills) != len(set(skills)):
        raise ValueError(f"{row['id']}: duplicate labels")
    selected = [row["primaryTopic"], *secondary]
    if row["primaryTopic"] not in bank_taxonomy or row["primaryTopic"] in secondary:
        raise ValueError(f"{row['id']}: invalid primary/secondary relationship")
    if any(topic not in bank_taxonomy for topic in secondary):
        raise ValueError(f"{row['id']}: uncontrolled topic")
    owned = {skill for topic in selected for skill in bank_taxonomy[topic]}
    if not set(skills).issubset(owned):
        raise ValueError(f"{row['id']}: skills not owned by selected topics: {set(skills) - owned}")


def wilson(successes: int, total: int, z: float = 1.96) -> tuple[float, float]:
    if total == 0:
        return (0.0, 0.0)
    p = successes / total
    denominator = 1 + z * z / total
    center = (p + z * z / (2 * total)) / denominator
    margin = z * math.sqrt((p * (1 - p) + z * z / (4 * total)) / total) / denominator
    return (max(0.0, center - margin), min(1.0, center + margin))


def load_adjudications(taxonomy: dict[str, dict[str, list[str]]]) -> tuple[dict[tuple[str, str], dict[str, Any]], dict[str, str]]:
    queue = json.loads((ROOT / "adjudication-queue.json").read_text())
    manifest = json.loads((ROOT / "adjudication-manifest.json").read_text())
    queued = {(row["bank"], row["id"]): row for row in queue["records"]}
    adjudicated: dict[tuple[str, str], dict[str, Any]] = {}
    hashes: dict[str, str] = {}
    for index in range(1, manifest["batchCount"] + 1):
        input_path = ROOT / "adjudication-inputs" / f"batch-{index:02d}.json"
        result_path = ROOT / "adjudication-results" / f"batch-{index:02d}.json"
        packet = json.loads(input_path.read_text())
        result = json.loads(result_path.read_text())
        hashes[result_path.name] = sha_file(result_path)
        if set(result) != ADJ_TOP or result["batch"] != packet["batch"] or result["auditVersion"] != packet["auditVersion"] or result["inputSha256"] != packet["inputSha256"]:
            raise ValueError(f"adjudication batch {index}: top/provenance mismatch")
        if result["count"] != len(packet["records"]) or len(result["judgments"]) != len(packet["records"]):
            raise ValueError(f"adjudication batch {index}: count mismatch")
        expected_ids = [(row["bank"], row["id"]) for row in packet["records"]]
        actual_ids = [(row["bank"], row["id"]) for row in result["judgments"]]
        if expected_ids != actual_ids:
            raise ValueError(f"adjudication batch {index}: ordered IDs mismatch")
        packet_by_id = {(row["bank"], row["id"]): row for row in packet["records"]}
        for row in result["judgments"]:
            if set(row) != ADJ_ROW or row["verdict"] not in VERDICTS or row["confidence"] not in CONFIDENCE:
                raise ValueError(f"{row.get('id')}: adjudication schema/enum mismatch")
            original = packet_by_id[(row["bank"], row["id"])]
            if row["inspectedQuestionAssets"] != original["questionAssets"] or row["inspectedMarkschemeAssets"] != original["markschemeAssets"]:
                raise ValueError(f"{row['id']}: adjudication asset mismatch")
            if evidence_length(row["evidence"]) < 30 or evidence_length(row["rationale"]) < 30:
                raise ValueError(f"{row['id']}: weak adjudication evidence/rationale")
            final = semantic(row)
            production = semantic(original["production"])
            blind = semantic(original["blind"])
            if row["verdict"] == "production_correct" and final != production:
                raise ValueError(f"{row['id']}: production verdict mismatch")
            if row["verdict"] == "blind_correct" and final != blind:
                raise ValueError(f"{row['id']}: blind verdict mismatch")
            if row["verdict"] == "modified" and (final == production or final == blind):
                raise ValueError(f"{row['id']}: no-op modified verdict")
            gap = row["taxonomyGap"]
            if row["verdict"] == "taxonomy_gap" and (not isinstance(gap, str) or not gap.strip()):
                raise ValueError(f"{row['id']}: taxonomy gap missing detail")
            if row["verdict"] != "taxonomy_gap" and gap is not None:
                raise ValueError(f"{row['id']}: gap detail on non-gap verdict")
            adjudicated[(row["bank"], row["id"])] = row
    if set(adjudicated) != set(queued):
        raise ValueError("adjudication coverage mismatch")
    return adjudicated, hashes


def apply_repairs(
    adjudicated: dict[tuple[str, str], dict[str, Any]],
    taxonomy: dict[str, dict[str, list[str]]],
) -> tuple[dict[str, str], dict[str, str], int]:
    input_dir = ROOT / "canonical-ownership-repair-inputs"
    result_dir = ROOT / "canonical-ownership-repair-results"
    input_files = sorted(input_dir.glob("batch-*.json"))
    result_files = sorted(result_dir.glob("batch-*.json"))
    if not input_files or [path.name for path in result_files] != [path.name for path in input_files]:
        raise ValueError("canonical ownership repair batches incomplete")
    input_hashes: dict[str, str] = {}
    result_hashes: dict[str, str] = {}
    repaired_keys: list[tuple[str, str]] = []
    for input_path, result_path in zip(input_files, result_files):
        packet = json.loads(input_path.read_text())
        result = json.loads(result_path.read_text())
        input_hashes[input_path.name] = sha_file(input_path)
        result_hashes[result_path.name] = sha_file(result_path)
        if set(result) != REPAIR_TOP or result["batch"] != packet["batch"] or result["auditVersion"] != packet["auditVersion"] or result["inputSha256"] != packet["inputSha256"]:
            raise ValueError(f"{result_path.name}: repair top/provenance mismatch")
        if result["count"] != len(packet["records"]) or len(result["repairs"]) != len(packet["records"]):
            raise ValueError(f"{result_path.name}: repair count mismatch")
        expected_ids = [(row["bank"], row["id"]) for row in packet["records"]]
        actual_ids = [(row["bank"], row["id"]) for row in result["repairs"]]
        if expected_ids != actual_ids:
            raise ValueError(f"{result_path.name}: repair ordered IDs mismatch")
        packet_by_id = {(row["bank"], row["id"]): row for row in packet["records"]}
        for repair in result["repairs"]:
            if set(repair) != REPAIR_ROW or repair["confidence"] not in CONFIDENCE:
                raise ValueError(f"{repair.get('id')}: repair schema/enum mismatch")
            key = (repair["bank"], repair["id"])
            original = packet_by_id[key]
            if key not in adjudicated:
                raise ValueError(f"{repair['id']}: repair not in adjudication")
            if repair["inspectedQuestionAssets"] != original["questionAssets"] or repair["inspectedMarkschemeAssets"] != original["markschemeAssets"]:
                raise ValueError(f"{repair['id']}: repair asset mismatch")
            if evidence_length(repair["evidence"]) < 30 or evidence_length(repair["rationale"]) < 30:
                raise ValueError(f"{repair['id']}: weak repair evidence/rationale")
            validate_labels(repair, taxonomy)
            old = adjudicated[key]
            production = semantic(original["production"])
            blind = semantic(original["blind"])
            final = semantic(repair)
            if old["verdict"] == "taxonomy_gap":
                verdict = "taxonomy_gap"
                gap = old["taxonomyGap"]
            elif final == production:
                verdict = "production_correct"
                gap = None
            elif final == blind:
                verdict = "blind_correct"
                gap = None
            else:
                verdict = "modified"
                gap = None
            adjudicated[key] = {
                **repair,
                "verdict": verdict,
                "taxonomyGap": gap,
                "canonicalOwnershipRepair": True,
            }
            repaired_keys.append(key)
    if len(repaired_keys) != len(set(repaired_keys)):
        raise ValueError("duplicate ownership repairs")
    return input_hashes, result_hashes, len(repaired_keys)


def main() -> None:
    comparison = json.loads((ROOT / "pre-adjudication-comparison.json").read_text())
    taxonomy = json.loads(TAXONOMY_PATH.read_text())
    adjudicated, adjudication_hashes = load_adjudications(taxonomy)
    repair_input_hashes, repair_result_hashes, repair_count = apply_repairs(adjudicated, taxonomy)

    bank_metrics: dict[str, Any] = {}
    overall_uniform_total = overall_uniform_defects = 0
    final_rows: list[dict[str, Any]] = []
    by_bank: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for original in comparison["rows"]:
        key = (original["bank"], original["id"])
        judgment = adjudicated.get(key)
        production_sem = semantic(original["production"])
        if judgment is None:
            verdict = "blind_exact_production"
            defect = "none"
            adjudicated_final = None
        else:
            validate_labels(judgment, taxonomy)
            verdict = judgment["verdict"]
            final_sem = semantic(judgment)
            if verdict == "production_correct":
                defect = "none"
            elif verdict == "taxonomy_gap":
                defect = "taxonomy-gap"
            elif final_sem[0] != production_sem[0]:
                defect = "wrong-primary"
            elif final_sem[1] != production_sem[1]:
                defect = "secondary-topic"
            elif final_sem[2] != production_sem[2]:
                defect = "skill-subtopic"
            else:
                raise ValueError(f"{original['id']}: defect verdict produced no semantic delta")
            adjudicated_final = {
                "primaryTopic": judgment["primaryTopic"],
                "secondaryTopics": judgment["secondaryTopics"],
                "skills": judgment["skills"],
                "confidence": judgment["confidence"],
                "taxonomyGap": judgment["taxonomyGap"],
                "evidence": judgment["evidence"],
                "rationale": judgment["rationale"],
                "canonicalOwnershipRepair": bool(judgment.get("canonicalOwnershipRepair")),
            }
        row = {
            "bank": original["bank"], "id": original["id"], "sampleLayer": original["sampleLayer"],
            "riskFlags": original["riskFlags"], "preAdjudicationCategory": original["category"],
            "verdict": verdict, "productionDefect": defect, "production": original["production"],
            "adjudicatedFinal": adjudicated_final,
        }
        final_rows.append(row)
        by_bank[row["bank"]].append(row)

    for bank, rows in sorted(by_bank.items()):
        uniform = [row for row in rows if row["sampleLayer"] == "uniform"]
        enriched = [row for row in rows if row["sampleLayer"] == "risk-enriched"]
        uniform_defects = sum(row["productionDefect"] != "none" for row in uniform)
        total_defects = sum(row["productionDefect"] != "none" for row in rows)
        primary_defects = sum(row["productionDefect"] == "wrong-primary" for row in rows)
        taxonomy_gaps = sum(row["productionDefect"] == "taxonomy-gap" for row in rows)
        rate = uniform_defects / len(uniform)
        ci = wilson(uniform_defects, len(uniform))
        if primary_defects >= 2 or taxonomy_gaps >= 2:
            status = "fail-systemic-review-required"
        elif primary_defects or taxonomy_gaps or rate > 0.05:
            status = "expand-to-10-percent"
        else:
            status = "pass"
        bank_metrics[bank] = {
            "status": status, "sample": len(rows), "uniformSample": len(uniform),
            "riskEnrichedSample": len(enriched),
            "preAdjudicationExact": sum(row["preAdjudicationCategory"] == "exact" for row in rows),
            "adjudicatedDisagreements": sum(row["preAdjudicationCategory"] != "exact" for row in rows),
            "productionCorrectAfterDisagreement": sum(row["verdict"] == "production_correct" for row in rows),
            "productionDefects": total_defects,
            "defectsBySeverity": dict(Counter(row["productionDefect"] for row in rows if row["productionDefect"] != "none")),
            "uniformDefects": uniform_defects, "uniformDefectRate": rate,
            "uniformDefectRate95Wilson": list(ci),
            "riskEnrichedDefects": sum(row["productionDefect"] != "none" for row in enriched),
        }
        overall_uniform_total += len(uniform)
        overall_uniform_defects += uniform_defects

    statuses = {metrics["status"] for metrics in bank_metrics.values()}
    overall_status = "pass" if statuses == {"pass"} else ("fail-systemic-review-required" if "fail-systemic-review-required" in statuses else "expand-to-10-percent")
    final = {
        "auditVersion": "pastpaperprep-semantic-sample-2026.08.2",
        "productionCommit": "124e5c413c34e601a6e9d976e90a3a37ba96bf7b",
        "status": overall_status, "sampleCount": len(final_rows),
        "blindExactCount": sum(row["preAdjudicationCategory"] == "exact" for row in final_rows),
        "adjudicatedCount": len(adjudicated), "canonicalOwnershipRepairCount": repair_count,
        "productionDefectCount": sum(row["productionDefect"] != "none" for row in final_rows),
        "overallUniformSample": overall_uniform_total, "overallUniformDefects": overall_uniform_defects,
        "overallUniformDefectRate": overall_uniform_defects / overall_uniform_total,
        "overallUniformDefectRate95Wilson": list(wilson(overall_uniform_defects, overall_uniform_total)),
        "canonicalTaxonomySha256": sha_file(TAXONOMY_PATH), "bankMetrics": bank_metrics,
        "adjudicationResultHashes": adjudication_hashes,
        "canonicalOwnershipRepairInputHashes": repair_input_hashes,
        "canonicalOwnershipRepairResultHashes": repair_result_hashes,
        "rows": final_rows,
    }
    (ROOT / "final-report.json").write_bytes(canonical_bytes(final))
    print(json.dumps({key: value for key, value in final.items() if key != "rows"}, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
