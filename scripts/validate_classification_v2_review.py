#!/usr/bin/env python3
"""Fail-closed validator for classification-contract-v2 blind review outputs."""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from typing import Any

TOP_KEYS = ["auditVersion", "bank", "batch", "inputSha256", "count", "judgments"]
ROW_KEYS = [
    "id", "primaryTopic", "secondaryTopics", "skills", "confidence", "taxonomyGap",
    "evidence", "rationale", "inspectedQuestionAssets", "inspectedMarkschemeAssets",
    "officialMarkschemeUnavailable",
]
CONFIDENCE = {"high", "medium", "low"}


def canonical_bytes(value: Any) -> bytes:
    return (json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n").encode()


def sha_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("root", type=Path)
    parser.add_argument("--allow-incomplete", action="store_true")
    args = parser.parse_args()

    manifest = json.loads((args.root / "manifest.json").read_text())
    inputs = sorted((args.root / "blind-inputs").glob("batch-*.json"))
    results_dir = args.root / "blind-results"
    result_paths = sorted(results_dir.glob("batch-*.json")) if results_dir.exists() else []
    result_by_name = {path.name: path for path in result_paths}
    errors: list[str] = []
    reviewed_ids: list[str] = []
    gaps: list[str] = []

    for input_path in inputs:
        if input_path.name not in result_by_name:
            if not args.allow_incomplete:
                errors.append(f"missing result {input_path.name}")
            continue
        try:
            packet = json.loads(input_path.read_text())
            result = json.loads(result_by_name[input_path.name].read_text())
            require(list(result) == TOP_KEYS, f"{input_path.name}: top keys")
            require(result["auditVersion"] == packet["auditVersion"], f"{input_path.name}: auditVersion")
            require(result["bank"] == packet["bank"], f"{input_path.name}: bank")
            require(result["batch"] == packet["batch"], f"{input_path.name}: batch")
            require(result["inputSha256"] == packet["inputSha256"], f"{input_path.name}: input hash")
            require(result["count"] == packet["count"] == len(result["judgments"]), f"{input_path.name}: count")
            require([row["id"] for row in result["judgments"]] == [row["id"] for row in packet["records"]], f"{input_path.name}: ID order")

            taxonomy = packet["taxonomy"]
            for source, row in zip(packet["records"], result["judgments"], strict=True):
                prefix = f"{packet['bank']}/{row.get('id')}"
                require(list(row) == ROW_KEYS, f"{prefix}: row keys")
                primary = row["primaryTopic"]
                secondaries = row["secondaryTopics"]
                skills = row["skills"]
                require(primary in taxonomy, f"{prefix}: uncontrolled primary {primary}")
                require(isinstance(secondaries, list) and len(secondaries) == len(set(secondaries)), f"{prefix}: secondary topics")
                require(primary not in secondaries and all(topic in taxonomy for topic in secondaries), f"{prefix}: uncontrolled secondary")
                require(isinstance(skills, list) and len(skills) == len(set(skills)), f"{prefix}: skills")
                owned = {skill for topic in [primary, *secondaries] for skill in taxonomy[topic]}
                require(all(skill in owned for skill in skills), f"{prefix}: unowned skill")
                require(row["confidence"] in CONFIDENCE, f"{prefix}: confidence")
                require(row["taxonomyGap"] is None or isinstance(row["taxonomyGap"], str), f"{prefix}: taxonomy gap")
                require(row["inspectedQuestionAssets"] == source["questionAssets"], f"{prefix}: question assets")
                require(row["inspectedMarkschemeAssets"] == source["markschemeAssets"], f"{prefix}: markscheme assets")
                require(row["officialMarkschemeUnavailable"] == source["officialMarkschemeUnavailable"], f"{prefix}: markscheme flag")
                require(all(Path(path).is_file() for path in [*row["inspectedQuestionAssets"], *row["inspectedMarkschemeAssets"]]), f"{prefix}: missing asset")
                require(bool(str(row["evidence"]).strip()) and bool(str(row["rationale"]).strip()), f"{prefix}: evidence")
                reviewed_ids.append(row["id"])
                if row["taxonomyGap"]:
                    gaps.append(row["id"])
        except Exception as exc:  # report all bad batches together
            errors.append(str(exc))

    require(len(reviewed_ids) == len(set(reviewed_ids)), "duplicate reviewed IDs")
    if not args.allow_incomplete:
        require(len(reviewed_ids) == manifest["reviewCount"], "review coverage mismatch")
        require(sha_bytes(canonical_bytes(reviewed_ids)) == manifest["orderedIdSha256"], "ordered ID hash mismatch")
    require(not errors, "\n".join(errors))
    print(json.dumps({
        "status": "PASS",
        "bank": manifest["bank"],
        "reviewed": len(reviewed_ids),
        "expected": manifest["reviewCount"],
        "taxonomyGaps": len(gaps),
        "complete": len(reviewed_ids) == manifest["reviewCount"],
    }, indent=2))


if __name__ == "__main__":
    main()
