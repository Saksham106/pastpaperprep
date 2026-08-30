#!/usr/bin/env python3
"""Generate deterministic blind packets for classification-contract-v2 review."""
from __future__ import annotations

import argparse
import hashlib
import json
import math
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
BASE_TAXONOMY = ROOT / "scripts" / "classification-semantic-canonical-taxonomy.json"
AUDIT_VERSION = "classification-contract-v2.0"

# The old sample snapshot inferred 0580 ownership from observed primary labels.
# v2 uses stable syllabus ownership instead.
IGCSE_TAXONOMY = {
    "Number": ["Bounds and estimation", "Fractions, decimals and percentages", "Indices and surds", "Number properties", "Ratio, proportion and rates", "Standard form"],
    "Algebra and graphs": ["Algebraic manipulation", "Calculus", "Equations and inequalities", "Functions and graphs", "Sequences"],
    "Coordinate geometry": ["Coordinates and geometry", "Straight-line graphs"],
    "Geometry": ["Angles and polygons", "Circle theorems", "Constructions and loci", "Similarity and congruence"],
    "Mensuration": ["Area and perimeter", "Volume and surface area"],
    "Trigonometry": ["3D trigonometry", "Pythagoras and right-angle trigonometry", "Sine/cosine rules and bearings"],
    "Transformations and vectors": ["Transformations", "Vectors"],
    "Probability": ["Basic probability", "Combined and conditional probability", "Venn and tree diagrams"],
    "Statistics": ["Averages and spread", "Data charts and diagrams", "Histograms and cumulative frequency", "Scatter graphs"],
}


def canonical_bytes(value: Any) -> bytes:
    return (json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n").encode()


def sha_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def strings(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    return [item for item in value if isinstance(item, str) and item]


def resolve_assets(source_root: Path, question: dict[str, Any], key: str) -> list[str]:
    paths = strings(question.get(key))
    if key == "markschemeImages" and not paths:
        paths = strings((question.get("officialMarkscheme") or {}).get("images"))
    resolved: list[str] = []
    for relative in paths:
        path = Path(relative)
        if not path.is_absolute():
            path = source_root / "site" / relative
        if not path.is_file():
            raise FileNotFoundError(f"missing evidence asset: {path}")
        resolved.append(str(path.resolve()))
    return resolved


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--bank", required=True)
    parser.add_argument("--source-root", type=Path, required=True)
    parser.add_argument("--output-root", type=Path, required=True)
    parser.add_argument("--batch-size", type=int, default=75)
    parser.add_argument("--sample-count", type=int, default=0, help="0 reviews the full bank")
    parser.add_argument("--exclude-ids", type=Path)
    args = parser.parse_args()

    source_json = args.source_root / "site" / "data" / "questions.json"
    source = json.loads(source_json.read_text())
    questions = source["questions"] if isinstance(source, dict) else source
    if len({q.get("id") for q in questions}) != len(questions):
        raise ValueError("source IDs are missing or duplicated")

    taxonomy = json.loads(BASE_TAXONOMY.read_text())
    taxonomy["igcse"] = IGCSE_TAXONOMY
    if args.bank not in taxonomy:
        raise ValueError(f"no taxonomy for {args.bank}")

    excluded: set[str] = set()
    if args.exclude_ids:
        payload = json.loads(args.exclude_ids.read_text())
        rows = payload.get("selection", payload.get("records", payload.get("rows", payload))) if isinstance(payload, dict) else payload
        excluded = {str(row.get("id")) if isinstance(row, dict) else str(row) for row in rows}

    population_ids = {str(q["id"]) for q in questions}
    excluded &= population_ids
    eligible = [q for q in questions if str(q["id"]) not in excluded]
    if args.sample_count:
        if args.sample_count > len(eligible):
            raise ValueError("sample exceeds eligible population")
        seed = f"{AUDIT_VERSION}|{args.bank}|{sha_bytes(source_json.read_bytes())}"
        eligible.sort(key=lambda q: sha_bytes(f"{seed}|{q['id']}".encode()))
        selected = eligible[: args.sample_count]
    else:
        selected = sorted(eligible, key=lambda q: str(q["id"]))

    records = []
    for question in selected:
        q_assets = resolve_assets(args.source_root, question, "questionImages")
        m_assets = resolve_assets(args.source_root, question, "markschemeImages")
        records.append({
            "bank": args.bank,
            "id": str(question["id"]),
            "metadata": {key: question.get(key) for key in ("year", "session", "paper", "component", "courseEra", "p3Option", "timezone")},
            "accessibleText": str(question.get("accessibleText") or question.get("text") or ""),
            "independentSolutionText": str(question.get("independentSolution") or question.get("solution") or ""),
            "questionAssets": q_assets,
            "markschemeAssets": m_assets,
            "officialMarkschemeUnavailable": not bool(m_assets),
        })

    args.output_root.mkdir(parents=True, exist_ok=True)
    inputs = args.output_root / "blind-inputs"
    inputs.mkdir(exist_ok=True)
    packet_hashes: dict[str, str] = {}
    for index in range(0, len(records), args.batch_size):
        batch = index // args.batch_size + 1
        batch_records = records[index : index + args.batch_size]
        core = {
            "auditVersion": AUDIT_VERSION,
            "bank": args.bank,
            "batch": batch,
            "count": len(batch_records),
            "taxonomy": taxonomy[args.bank],
            "records": batch_records,
        }
        input_hash = sha_bytes(canonical_bytes(core))
        packet = {**core, "inputSha256": input_hash}
        name = f"batch-{batch:02d}.json"
        data = canonical_bytes(packet)
        (inputs / name).write_bytes(data)
        packet_hashes[name] = sha_bytes(data)

    manifest = {
        "auditVersion": AUDIT_VERSION,
        "bank": args.bank,
        "sourceQuestions": str(source_json.resolve()),
        "sourceQuestionsSha256": sha_bytes(source_json.read_bytes()),
        "taxonomySha256": sha_bytes(canonical_bytes(taxonomy[args.bank])),
        "population": len(questions),
        "excludedCount": len(excluded),
        "reviewCount": len(records),
        "batchSize": args.batch_size,
        "batchCount": math.ceil(len(records) / args.batch_size),
        "orderedIdSha256": sha_bytes(canonical_bytes([row["id"] for row in records])),
        "packetSha256": packet_hashes,
    }
    (args.output_root / "manifest.json").write_bytes(canonical_bytes(manifest))
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
