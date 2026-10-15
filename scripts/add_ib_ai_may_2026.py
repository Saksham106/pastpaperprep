#!/usr/bin/env python3
"""Splice the IB Maths AI May 2026 official papers into src/data/raw/ib-ai-{hl,sl}.json.

Additive and deterministic: every existing paper and question is kept byte-identical (the app's own row object is
reused), the new rows come from the reviewed source banks' site/data/questions.json with `subtopics` mirroring `skills`
(the app convention, see scripts/ai_hl_production_audit.py), and the merged order follows the source bank's order.

    python3 scripts/add_ib_ai_may_2026.py [--check]

--check verifies the committed files instead of writing them.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
WORKSPACE = Path(
    __import__("subprocess").check_output(
        ["git", "-C", str(REPO), "rev-parse", "--path-format=absolute", "--git-common-dir"], text=True
    ).strip()
).parent.parent
SOURCES = {
    "hl": WORKSPACE / "ib-maths-ai-hl-topic-practice-may-2026" / "site" / "data" / "questions.json",
    "sl": WORKSPACE / "ib-maths-ai-sl-topic-practice-may-2026" / "site" / "data" / "questions.json",
}
EXPECTED = {"hl": (9, 75), "sl": (6, 52)}
PREFIX = "2026-may-"


def with_subtopics(row: dict) -> dict:
    out: dict = {}
    for key, value in row.items():
        out[key] = value
        if key == "skills":
            out["subtopics"] = list(value)
    if "subtopics" not in out:
        raise ValueError(f"{row['id']}: no skills to mirror")
    return out


def merge(level: str, current: dict, source: dict) -> dict:
    existing_q = {q["id"]: q for q in current["questions"]}
    existing_p = {p["id"]: p for p in current["papers"]}
    if any(i.startswith(PREFIX) for i in {*existing_q, *existing_p}):
        raise ValueError(f"{level}: May 2026 rows are already present")
    new_q = [q for q in source["questions"] if q["id"].startswith(PREFIX)]
    new_p = [p for p in source["papers"] if p["id"].startswith(PREFIX)]
    if (len(new_p), len(new_q)) != EXPECTED[level]:
        raise ValueError(f"{level}: expected {EXPECTED[level]} papers/questions, got {(len(new_p), len(new_q))}")
    new_q_ids = {q["id"] for q in new_q}
    new_p_ids = {p["id"] for p in new_p}
    for q in new_q:
        if q.get("imageStatus") != "original" or not q.get("officialMarkscheme") or q.get("independentSolution"):
            raise ValueError(f"{q['id']}: not an official original row")
    questions, papers = [], []
    for q in source["questions"]:
        if q["id"] in new_q_ids:
            questions.append(with_subtopics(q))
        elif q["id"] in existing_q:
            questions.append(existing_q[q["id"]])
        else:
            raise ValueError(f"{level}: source question {q['id']} unknown to the app bank")
    for p in source["papers"]:
        if p["id"] in new_p_ids:
            papers.append(p)
        elif p["id"] in existing_p:
            papers.append(existing_p[p["id"]])
        else:
            raise ValueError(f"{level}: source paper {p['id']} unknown to the app bank")
    if len(questions) != len(existing_q) + len(new_q) or len(papers) != len(existing_p) + len(new_p):
        raise ValueError(f"{level}: merged counts drift (existing rows missing from the source bank)")
    merged = dict(current)
    merged["papers"], merged["questions"] = papers, questions
    return merged


def serialize(payload: dict) -> str:
    return json.dumps(payload, indent=2, ensure_ascii=False) + "\n"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    for level in ("hl", "sl"):
        path = REPO / "src" / "data" / "raw" / f"ib-ai-{level}.json"
        source = json.loads(SOURCES[level].read_text(encoding="utf-8"))
        if args.check:
            current = json.loads(path.read_text(encoding="utf-8"))
            base = {**current, "papers": [p for p in current["papers"] if not p["id"].startswith(PREFIX)],
                    "questions": [q for q in current["questions"] if not q["id"].startswith(PREFIX)]}
            if serialize(merge(level, base, source)) != path.read_text(encoding="utf-8"):
                raise SystemExit(f"{path} drifts from the reviewed source bank")
            print(f"ok {level}")
            continue
        current = json.loads(path.read_text(encoding="utf-8"))
        path.write_text(serialize(merge(level, current, source)), encoding="utf-8")
        print(f"wrote {path}")


if __name__ == "__main__":
    main()
