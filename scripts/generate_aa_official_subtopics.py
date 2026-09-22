#!/usr/bin/env python3
"""Build the pinned current-AA classification overlay; fail closed on drift."""
from __future__ import annotations
import argparse, hashlib, json
from pathlib import Path

EXPECTED = {"SL": 378, "HL": 489}

def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()

def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--research-root", type=Path, required=True)
    parser.add_argument("--repo-root", type=Path, default=Path(__file__).resolve().parents[1])
    args = parser.parse_args()
    research = args.research_root
    repo = args.repo_root
    taxonomy_path = research / "official-aa-filter-groups.json"
    source_overlay_path = research / "classification/final-reviewed-overlay.json"
    taxonomy = json.loads(taxonomy_path.read_text())
    source = json.loads(source_overlay_path.read_text())
    groups = {group["id"]: group for group in taxonomy["groups"]}
    if len(groups) != 50 or len(groups) != len(taxonomy["groups"]):
        raise SystemExit("taxonomy must contain exactly 50 unique groups")
    records = source["records"]
    ids = [record["id"] for record in records]
    if len(ids) != len(set(ids)):
        raise SystemExit("duplicate classification IDs")
    counts = {level: sum(record["level"] == level for record in records) for level in EXPECTED}
    if counts != EXPECTED or len(records) != 867:
        raise SystemExit(f"target coverage drift: {counts}")
    raw_sl = json.loads((repo / "src/data/raw/ib-sl.json").read_text())["questions"]
    raw_hl = json.loads((repo / "src/data/raw/ib-hl.json").read_text())["questions"]
    if sha(repo / "src/data/raw/ib-sl.json") != source["sourceTruth"]["rawSL"]["sha256"]:
        raise SystemExit("ib-sl source hash mismatch")
    if sha(repo / "src/data/raw/ib-hl.json") != source["sourceTruth"]["rawHL"]["sha256"]:
        raise SystemExit("ib-hl source hash mismatch")
    target_ids = {
        "SL": {row["id"] for row in raw_sl if row.get("subject", "").lower() == "mathematics: analysis and approaches sl"},
        "HL": {row["id"] for row in raw_hl if row.get("courseEra") == "aa-hl" and row.get("course", "").lower() == "mathematics: analysis and approaches hl"},
    }
    record_ids = {level: {row["id"] for row in records if row["level"] == level} for level in EXPECTED}
    if target_ids != record_ids:
        raise SystemExit("classification/source ID coverage mismatch")
    for record in records:
        if record["status"] == "accepted" and not record["subtopics"]:
            raise SystemExit(f"accepted row has no subtopic: {record['id']}")
        if record["status"] == "blocked" and record["subtopics"]:
            raise SystemExit(f"blocked row has subtopics: {record['id']}")
        for group_id in record["subtopics"]:
            if group_id not in groups:
                raise SystemExit(f"unknown taxonomy group: {group_id}")
            if record["level"] not in groups[group_id]["applicability"]:
                raise SystemExit(f"invalid applicability: {record['id']} -> {group_id}")
    output = {
        "schemaVersion": "aa-official-subtopics-runtime-v1",
        "sourceOverlaySchema": source["schemaVersion"],
        "taxonomySha256": sha(taxonomy_path),
        "sourceHashes": source["inputHashes"],
        "sourceTruth": source["sourceTruth"],
        "records": [{key: record[key] for key in ("id", "bank", "level", "primaryTopic", "secondaryTopics", "groupIds", "subtopics", "status", "blockedReason", "provenance")} for record in records],
    }
    out_dir = repo / "src/data/aa-official-subtopics"
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "taxonomy.json").write_text(taxonomy_path.read_text())
    (out_dir / "overlay.json").write_text(json.dumps(output, indent=2, ensure_ascii=False) + "\n")
    print(f"AA overlay: {len(records)} rows ({counts['SL']} SL, {counts['HL']} HL); taxonomy sha256={output['taxonomySha256']}")

if __name__ == "__main__":
    main()
