#!/usr/bin/env python3
"""Generate a deterministic, stratified blind semantic QA sample.

The staged blind packets contain source evidence and controlled aggregate taxonomy only.
They intentionally exclude all per-question production classifications and audit decisions.
"""
from __future__ import annotations

import hashlib
import json
import math
import shutil
from collections import Counter
from pathlib import Path
from typing import Any

APP_ROOT = Path(__file__).resolve().parents[1]
OUTPUT_ROOT = Path("/tmp/ppp-semantic-audit-2026-08")
PRODUCTION_COMMIT = "124e5c413c34e601a6e9d976e90a3a37ba96bf7b"
AUDIT_VERSION = "pastpaperprep-semantic-sample-2026.08.1"
CANONICAL_TAXONOMY_PATH = APP_ROOT / "scripts" / "classification-semantic-canonical-taxonomy.json"
UNIFORM_SHARE = 0.60
MINIMUM_SAMPLE = 30
SAMPLE_RATE = 0.05

BANKS = {
    "igcse": {
        "raw": "igcse.json",
        "sample": 135,
        "source": Path("/Users/sakshamgoel/Documents/ProjectsInternships/igcse-0580-topic-practice"),
        "report": "igcse-0580-consensus-reconciliation-2026-08.json",
    },
    "igcse-additional": {
        "raw": "igcse-additional.json",
        "sample": 82,
        "source": Path("/tmp/igcse-additional-source-review"),
        "report": "igcse-0606-consensus-reconciliation-2026-08.json",
    },
    "ib-hl": {
        "raw": "ib-hl.json",
        "sample": 43,
        "source": Path("/tmp/aa-hl-chat3"),
        "report": "ib-hl-consensus-reconciliation-2026-08.json",
    },
    "ib-sl": {
        "raw": "ib-sl.json",
        "sample": 30,
        "source": Path("/tmp/aa-sl-chat3"),
        "report": "ib-sl-consensus-reconciliation-2026-08.json",
    },
    "ib-ai-hl": {
        "raw": "ib-ai-hl.json",
        "sample": 30,
        "source": Path("/tmp/ib-ai-hl-chat3"),
        "report": "ib-ai-hl-consensus-reconciliation-2026-08.json",
    },
    "ib-ai-sl": {
        "raw": "ib-ai-sl.json",
        "sample": 30,
        "source": Path("/tmp/ib-ai-sl-audit-review-20260827"),
        "report": "ib-ai-sl-consensus-reconciliation-2026-08.json",
    },
}


def canonical_bytes(value: Any) -> bytes:
    return (json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n").encode()


def sha_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha_file(path: Path) -> str:
    return sha_bytes(path.read_bytes())


def stable_rank(seed: str, question_id: str) -> str:
    return sha_bytes(f"{seed}|{question_id}".encode())


def confidence(question: dict[str, Any]) -> str:
    evidence = question.get("classificationEvidence") or {}
    classification = question.get("classification") or {}
    return str(
        question.get("classificationConfidence")
        or classification.get("confidence")
        or evidence.get("confidence")
        or "unknown"
    )


def changed_ids(bank: str, report: dict[str, Any]) -> set[str]:
    if bank == "igcse-additional":
        return set(report["appliedIds"])
    decisions = report.get("decisions") or []
    return {row["id"] for row in decisions if row.get("applied") is True}


def era(year: int) -> str:
    if year <= 2019:
        return "legacy-through-2019"
    if year <= 2022:
        return "2020-2022"
    return "2023-present"


def choose_risk_balanced(
    candidates: list[dict[str, Any]], count: int, seed: str
) -> list[dict[str, Any]]:
    remaining = list(candidates)
    chosen: list[dict[str, Any]] = []
    topic_counts: Counter[str] = Counter()
    era_counts: Counter[str] = Counter()
    signature_counts: Counter[str] = Counter()
    while remaining and len(chosen) < count:
        def key(row: dict[str, Any]) -> tuple[int, int, int, str]:
            flags = row["riskFlags"]
            signature = "+".join(sorted(flags))
            return (
                signature_counts[signature],
                topic_counts[row["production"]["primaryTopic"]],
                era_counts[row["era"]],
                stable_rank(seed, row["id"]),
            )
        row = min(remaining, key=key)
        remaining.remove(row)
        chosen.append(row)
        topic_counts[row["production"]["primaryTopic"]] += 1
        era_counts[row["era"]] += 1
        signature_counts["+".join(sorted(row["riskFlags"]))] += 1
    return chosen


def ensure_topic_coverage(
    selected: list[dict[str, Any]], population: list[dict[str, Any]], seed: str
) -> list[dict[str, Any]]:
    all_topics = sorted({r["production"]["primaryTopic"] for r in population})
    counts = Counter(r["production"]["primaryTopic"] for r in selected)
    selected_ids = {r["id"] for r in selected}
    for topic in all_topics:
        while counts[topic] < 2:
            replacements = sorted(
                [r for r in population if r["id"] not in selected_ids and r["production"]["primaryTopic"] == topic],
                key=lambda r: stable_rank(seed + "|topic", r["id"]),
            )
            if not replacements:
                break
            removable = sorted(
                [r for r in selected if counts[r["production"]["primaryTopic"]] > 2 and r["sampleLayer"] == "risk-enriched"],
                key=lambda r: (-counts[r["production"]["primaryTopic"]], stable_rank(seed + "|remove", r["id"])),
            )
            if not removable:
                break
            add = replacements[0]
            drop = removable[0]
            add["sampleLayer"] = "risk-enriched"
            selected.remove(drop)
            selected.append(add)
            selected_ids.remove(drop["id"])
            selected_ids.add(add["id"])
            counts[drop["production"]["primaryTopic"]] -= 1
            counts[topic] += 1
    return selected


def staged_assets(
    bank: str, source_root: Path, source_question: dict[str, Any], question_id: str
) -> tuple[list[str], list[str]]:
    question_rel = source_question.get("questionImages") or []
    markscheme_rel = source_question.get("markschemeImages") or (
        (source_question.get("officialMarkscheme") or {}).get("images") or []
    )
    destination = OUTPUT_ROOT / "evidence" / bank / question_id
    destination.mkdir(parents=True, exist_ok=True)

    def copy_assets(paths: list[str], prefix: str) -> list[str]:
        output: list[str] = []
        for index, relative in enumerate(paths, start=1):
            source = source_root / "site" / relative
            if not source.is_file():
                raise FileNotFoundError(source)
            target = destination / f"{prefix}-{index}{source.suffix.lower()}"
            shutil.copyfile(source, target)
            output.append(str(target))
        return output

    return copy_assets(question_rel, "question"), copy_assets(markscheme_rel, "markscheme")


def main() -> None:
    if OUTPUT_ROOT.exists():
        shutil.rmtree(OUTPUT_ROOT)
    (OUTPUT_ROOT / "blind-inputs").mkdir(parents=True)
    (OUTPUT_ROOT / "blind-results").mkdir(parents=True)

    selection: list[dict[str, Any]] = []
    taxonomy_by_bank: dict[str, dict[str, list[str]]] = json.loads(CANONICAL_TAXONOMY_PATH.read_text())
    if set(taxonomy_by_bank) != set(BANKS):
        raise ValueError("canonical taxonomy bank coverage mismatch")
    source_hashes: dict[str, dict[str, str]] = {}
    bank_summaries: dict[str, Any] = {}

    for bank, config in BANKS.items():
        raw_path = APP_ROOT / "src" / "data" / "raw" / config["raw"]
        report_path = APP_ROOT / "docs" / "audits" / config["report"]
        source_json_path = config["source"] / "site" / "data" / "questions.json"
        raw = json.loads(raw_path.read_text())
        report = json.loads(report_path.read_text())
        source = json.loads(source_json_path.read_text())
        questions = raw["questions"]
        source_by_id = {row["id"]: row for row in source["questions"]}
        if len(source_by_id) != len(source["questions"]):
            raise ValueError(f"{bank}: duplicate source IDs")
        if set(source_by_id) != {row["id"] for row in questions}:
            raise ValueError(f"{bank}: production/source ID mismatch")

        changes = changed_ids(bank, report)
        population: list[dict[str, Any]] = []
        for question in questions:
            primary = question["primaryTopic"]
            skills = list(question.get("skills") or question.get("subtopics") or [])

            risk_flags: list[str] = []
            if question["id"] in changes:
                risk_flags.append("changed")
            if confidence(question) != "high":
                risk_flags.append("non-high-confidence")
            if question.get("secondaryTopics"):
                risk_flags.append("cross-topic")
            population.append({
                "id": question["id"],
                "bank": bank,
                "era": era(int(question["year"])),
                "riskFlags": risk_flags,
                "production": {
                    "primaryTopic": primary,
                    "secondaryTopics": list(question.get("secondaryTopics") or []),
                    "skills": skills,
                    "confidence": confidence(question),
                },
                "metadata": {
                    "year": question["year"],
                    "session": question.get("session"),
                    "paper": question.get("paper"),
                    "component": question.get("component"),
                    "courseEra": question.get("courseEra"),
                    "option": question.get("option") or question.get("p3Option"),
                },
            })
        controlled_topics = taxonomy_by_bank[bank]
        for question in population:
            selected_topics = [question["production"]["primaryTopic"], *question["production"]["secondaryTopics"]]
            allowed_skills = {
                skill
                for topic in selected_topics
                for skill in controlled_topics.get(topic, [])
            }
            if not set(question["production"]["skills"]).issubset(allowed_skills):
                raise ValueError(f"{bank}/{question['id']}: production skills violate canonical ownership")
        raw_hash = sha_file(raw_path)
        seed = sha_bytes(f"{AUDIT_VERSION}|{PRODUCTION_COMMIT}|{bank}|{raw_hash}".encode())
        sample_count = int(config["sample"])
        expected = max(MINIMUM_SAMPLE, math.ceil(len(population) * SAMPLE_RATE))
        if sample_count != expected:
            raise ValueError(f"{bank}: configured sample {sample_count} != expected {expected}")
        uniform_count = math.ceil(sample_count * UNIFORM_SHARE)
        uniform = sorted(population, key=lambda r: stable_rank(seed + "|uniform", r["id"]))[:uniform_count]
        for row in uniform:
            row["sampleLayer"] = "uniform"
        uniform_ids = {row["id"] for row in uniform}
        risk_pool = [row for row in population if row["id"] not in uniform_ids and row["riskFlags"]]
        enriched = choose_risk_balanced(risk_pool, sample_count - uniform_count, seed + "|risk")
        for row in enriched:
            row["sampleLayer"] = "risk-enriched"
        selected = ensure_topic_coverage(uniform + enriched, population, seed)
        if len(selected) != sample_count or len({r["id"] for r in selected}) != sample_count:
            raise ValueError(f"{bank}: invalid selected count")
        selected.sort(key=lambda r: stable_rank(seed + "|final-order", r["id"]))

        for row in selected:
            sq = source_by_id[row["id"]]
            question_assets, markscheme_assets = staged_assets(bank, config["source"], sq, row["id"])
            row["sourceTextSha256"] = sha_bytes(str(sq.get("accessibleText") or sq.get("summary") or "").encode())
            row["questionAssetSha256"] = [sha_file(Path(path)) for path in question_assets]
            row["markschemeAssetSha256"] = [sha_file(Path(path)) for path in markscheme_assets]
            row["blindEvidence"] = {
                "accessibleText": sq.get("accessibleText") or sq.get("summary") or "",
                "markschemeTranscript": sq.get("markschemeTranscript") or "",
                "independentSolutionText": sq.get("solution") or sq.get("independentSolution") or "",
                "questionAssets": question_assets,
                "markschemeAssets": markscheme_assets,
                "officialMarkschemeUnavailable": not bool(markscheme_assets),
            }
        selection.extend(selected)
        source_hashes[bank] = {
            "productionRawSha256": raw_hash,
            "sourceQuestionsSha256": sha_file(source_json_path),
            "reconciliationReportSha256": sha_file(report_path),
            "selectionSeedSha256": seed,
        }
        bank_summaries[bank] = {
            "population": len(population),
            "sample": sample_count,
            "uniform": sum(r["sampleLayer"] == "uniform" for r in selected),
            "riskEnriched": sum(r["sampleLayer"] == "risk-enriched" for r in selected),
            "changed": sum("changed" in r["riskFlags"] for r in selected),
            "nonHighConfidence": sum("non-high-confidence" in r["riskFlags"] for r in selected),
            "crossTopic": sum("cross-topic" in r["riskFlags"] for r in selected),
            "officialMarkschemeUnavailable": sum(r["blindEvidence"]["officialMarkschemeUnavailable"] for r in selected),
            "topicCounts": dict(sorted(Counter(r["production"]["primaryTopic"] for r in selected).items())),
            "eraCounts": dict(sorted(Counter(r["era"] for r in selected).items())),
        }

    if len(selection) != 350 or len({(r["bank"], r["id"]) for r in selection}) != 350:
        raise ValueError("global sample must contain 350 unique bank/ID pairs")

    # Hidden manifest contains production answers and risk strata. Never give this file to blind reviewers.
    hidden_manifest = {
        "auditVersion": AUDIT_VERSION,
        "productionCommit": PRODUCTION_COMMIT,
        "method": {
            "sampleRate": SAMPLE_RATE,
            "minimumPerBank": MINIMUM_SAMPLE,
            "uniformShare": UNIFORM_SHARE,
            "uniformSelection": "deterministic SHA-256 rank over the complete bank",
            "riskSelection": "deterministic balanced selection across changed, non-high-confidence, and cross-topic strata",
            "topicCoverage": "at least two sampled questions per production parent topic",
        },
        "sourceHashes": source_hashes,
        "bankSummaries": bank_summaries,
        "count": len(selection),
        "records": selection,
    }
    hidden_path = OUTPUT_ROOT / "selection-hidden.json"
    hidden_path.write_bytes(canonical_bytes(hidden_manifest))

    # Mix banks deterministically across ten isolated reviewer batches.
    ordered = sorted(selection, key=lambda r: stable_rank(AUDIT_VERSION + "|batch", f"{r['bank']}|{r['id']}"))
    batches: list[list[dict[str, Any]]] = [[] for _ in range(10)]
    for index, row in enumerate(ordered):
        batches[index % 10].append(row)
    for index, rows in enumerate(batches, start=1):
        blind_records = []
        for row in rows:
            evidence = row["blindEvidence"]
            blind_records.append({
                "id": row["id"],
                "bank": row["bank"],
                "metadata": row["metadata"],
                "accessibleText": evidence["accessibleText"],
                "markschemeTranscript": evidence["markschemeTranscript"],
                "independentSolutionText": evidence["independentSolutionText"],
                "questionAssets": evidence["questionAssets"],
                "markschemeAssets": evidence["markschemeAssets"],
                "officialMarkschemeUnavailable": evidence["officialMarkschemeUnavailable"],
            })
        packet = {
            "auditVersion": AUDIT_VERSION,
            "batch": index,
            "count": len(blind_records),
            "taxonomyByBank": taxonomy_by_bank,
            "records": blind_records,
        }
        packet["inputSha256"] = sha_bytes(canonical_bytes(packet))
        (OUTPUT_ROOT / "blind-inputs" / f"batch-{index:02d}.json").write_bytes(canonical_bytes(packet))

    public_manifest = {
        "auditVersion": AUDIT_VERSION,
        "productionCommit": PRODUCTION_COMMIT,
        "count": 350,
        "bankSummaries": bank_summaries,
        "sourceHashes": source_hashes,
        "hiddenSelectionSha256": sha_file(hidden_path),
        "blindInputSha256": {
            path.name: sha_file(path) for path in sorted((OUTPUT_ROOT / "blind-inputs").glob("*.json"))
        },
    }
    (OUTPUT_ROOT / "sample-manifest.json").write_bytes(canonical_bytes(public_manifest))
    print(json.dumps(public_manifest, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
