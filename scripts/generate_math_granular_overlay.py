#!/usr/bin/env python3
"""Generate the fail-closed, additive math granular-label release artifact."""
from __future__ import annotations

import argparse
import hashlib
import json
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

BANK_FILES = {
    "0606": "igcse-additional.json",
    "ib-aa-hl": "ib-hl.json",
    "ib-aa-sl": "ib-sl.json",
    "ib-ai-hl": "ib-ai-hl.json",
    "ib-ai-sl": "ib-ai-sl.json",
}
SOURCE_REVIEW_FILES = {
    "0606": "review-0606.json",
    "ib-aa-hl": "review-aa-hl.json",
    "ib-aa-sl": "review-aa-sl.json",
    "ib-ai-hl": "review-ai.json",
    "ib-ai-sl": "review-ai.json",
}
EXPECTED_BANKS = set(BANK_FILES)
EXPECTED_SOURCE_COUNTS = {"0606": 1633, "ib-aa-hl": 841, "ib-aa-sl": 578, "ib-ai-hl": 409, "ib-ai-sl": 334}


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def load(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def payload_sha256(raw: dict[str, Any], bank: str, taxonomy: dict[str, Any]) -> str:
    labels = [x for x in taxonomy["registry"] if bank in x["bankApplicability"]]
    questions = {
        x["id"]: {
            "type": "noul",
            "instructions": f"Does this question materially assess {x['studentFacingName']}? {x['decisionBoundary']} Answer yes only when that operation/object is materially assessed, not merely incidental context.",
        }
        for x in labels
    }
    text = raw.get("accessibleText") or ""
    payload = {"state": {"accessibleText": text[:6000], "truncated": len(text) > 6000}, "questions": questions}
    encoded = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()
    return hashlib.sha256(encoded).hexdigest()


def checkpoint(raw: dict[str, Any], bank: str, taxonomy_sha: str, taxonomy: dict[str, Any]) -> str:
    return f"{bank}:{raw['id']}:{taxonomy_sha}:{payload_sha256(raw, bank, taxonomy)}"


def build_overlay(repo: Path, research: Path) -> dict[str, Any]:
    taxonomy_path = research / "canonical-taxonomy-v1.json"
    proposed_path = research / "full-run/proposed-additive-overlay.json"
    taxonomy = load(taxonomy_path)
    proposed = load(proposed_path)
    taxonomy_sha = sha256(taxonomy_path)
    raws: dict[tuple[str, str], dict[str, Any]] = {}
    for bank, filename in BANK_FILES.items():
        rows = load(repo / "src/data/raw" / filename)["questions"]
        if len(rows) != EXPECTED_SOURCE_COUNTS[bank]:
            raise ValueError(f"source row loss for {bank}: {len(rows)}")
        for row in rows:
            key = (bank, row.get("id"))
            if key in raws:
                raise ValueError(f"duplicate source ID: {key}")
            raws[key] = row

    candidates = {}
    for row in proposed["candidates"]:
        key = (row.get("bank"), row.get("id"), row.get("label"))
        if key in candidates:
            raise ValueError(f"duplicate candidate: {key}")
        bank, question_id, label = key
        if bank not in EXPECTED_BANKS or key[:2] not in raws:
            raise ValueError(f"candidate source mismatch: {key}")
        if label not in {x["id"] for x in taxonomy["registry"]}:
            raise ValueError(f"unknown taxonomy label: {label}")
        if bank not in next(x for x in taxonomy["registry"] if x["id"] == label)["bankApplicability"]:
            raise ValueError(f"invalid bank applicability: {key}")
        expected = checkpoint(raws[key[:2]], bank, taxonomy_sha, taxonomy)
        if row.get("checkpointKey") != expected:
            raise ValueError(f"checkpoint/source mismatch: {key}")
        candidates[key] = row

    selected: set[tuple[str, str, str]] = set()
    # 0606: the final review promotes every emitted family except the exact held row.
    selected.update(key for key in candidates if key[0] == "0606" and key[1] != "0606-2026-june-12-q8")
    # AA HL: two families are promoted wholesale; domain/range uses the exhaustive review only.
    selected.update(key for key in candidates if key[0] == "ib-aa-hl" and key[2] in {
        "math.aa.calculus.related-rates",
        "math.aa.statistics-probability.expected-value-variance",
    })
    complete = load(research / "full-run/review-aa-hl-domain-range-complete.json")
    accepted_domain = set(complete["acceptedIds"])
    selected.update(key for key in candidates if key[0] == "ib-aa-hl" and key[2] == "math.aa.functions.domain-range-restrictions" and key[1] in accepted_domain)

    # AA SL and AI are exact accepted-decision sets, never inferred from scores.
    for filename, decision_key, accepted_value in [
        ("review-aa-sl.json", "verdict", "accept"),
        ("review-ai.json", "decision", "accept"),
    ]:
        review = load(research / "full-run" / filename)
        rows = review["reviews"] if filename == "review-aa-sl.json" else review["decisions"]
        for row in rows:
            if row.get(decision_key) == accepted_value:
                bank = row["bank"]
                label = row.get("label") or row.get("candidateLabel")
                key = (bank, row["id"], label)
                if key not in candidates:
                    raise ValueError(f"accepted decision is not an emitted candidate: {key}")
                selected.add(key)

    labels = [{"bank": bank, "id": question_id, "label": label} for bank, question_id, label in sorted(selected)]
    counts_by_bank = dict(sorted(Counter(row["bank"] for row in labels).items()))
    counts_by_label: dict[str, dict[str, int]] = defaultdict(Counter)
    for row in labels:
        counts_by_label[row["bank"]][row["label"]] += 1
    return {
        "schemaVersion": "math-granular-additive-overlay-v1",
        "preservesExistingLabels": True,
        "sourceHashes": {
            "taxonomy": taxonomy_sha,
            "proposedOverlay": sha256(proposed_path),
            **{name[:-5]: sha256(research / "full-run" / name) for name in ["review-0606.json", "review-aa-hl.json", "review-aa-hl-domain-range-complete.json", "review-aa-sl.json", "review-ai.json"]},
        },
        "countsByBank": counts_by_bank,
        "countsByLabel": {bank: dict(sorted(values.items())) for bank, values in sorted(counts_by_label.items())},
        "labels": labels,
    }


def validate_overlay(overlay: dict[str, Any]) -> None:
    rows = overlay.get("labels")
    if overlay.get("schemaVersion") != "math-granular-additive-overlay-v1" or overlay.get("preservesExistingLabels") is not True:
        raise ValueError("invalid overlay seal")
    if not isinstance(rows, list) or len({(r["bank"], r["id"], r["label"]) for r in rows}) != len(rows):
        raise ValueError("duplicate or malformed overlay rows")
    if "0580" in overlay.get("countsByBank", {}):
        raise ValueError("0580 must not receive granular labels")
    if sum(overlay["countsByBank"].values()) != len(rows):
        raise ValueError("row count mismatch")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo", type=Path, default=Path(__file__).parents[1])
    parser.add_argument("--research", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    overlay = build_overlay(args.repo, args.research)
    validate_overlay(overlay)
    args.output.write_text(json.dumps(overlay, indent=2, sort_keys=True, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps(overlay["countsByBank"], sort_keys=True))


if __name__ == "__main__":
    main()
