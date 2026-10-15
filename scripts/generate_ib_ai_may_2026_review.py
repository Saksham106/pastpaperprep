#!/usr/bin/env python3
"""Write docs/audits/ib-ai-{hl,sl}-official-2026-review.json: the reviewed classification receipt for the May 2026 rows.

Deterministic: reads the spliced raw banks (src/data/raw/ib-ai-*.json) and the immutable adjudication receipts that the
classification evidence points at, and fails if a row's evidence does not match its receipt.
"""
import hashlib, json, subprocess
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
WORKSPACE = Path(subprocess.check_output(["git", "-C", str(REPO), "rev-parse", "--path-format=absolute", "--git-common-dir"], text=True).strip()).parent.parent
PREFIX = "2026-may-"
OUT_METHOD = ("Official May 2026 TZ1-TZ3 questions (additions, no earlier rows replaced): two independent source-grounded passes "
              "(a primary pass and a blind pass by a separate reviewer that never saw the primary labels) from the question and official IB "
              "markscheme crops, adjudicated row by row from the two immutable result files; Drex was triage only. Recorded as manual reviews "
              "in the source repository. Not part of the 2026-08 blind consensus audit.")

OVERLAY = json.loads((REPO / "docs/audits/ib-ai-may-2026-review-overlay.json").read_text(encoding="utf-8"))["rows"]

for level, expected in (("hl", 75), ("sl", 52)):
    raw = json.loads((REPO / f"src/data/raw/ib-ai-{level}.json").read_text(encoding="utf-8"))
    adj_path = WORKSPACE / f"ib-maths-ai-{level}-topic-practice-may-2026/data/audits/may-2026-official/adjudication-{level}.json"
    adj_sha = hashlib.sha256(adj_path.read_bytes()).hexdigest()
    adj = {r["id"]: r for r in json.loads(adj_path.read_text(encoding="utf-8"))["questions"]}
    rows = [q for q in raw["questions"] if q["id"].startswith(PREFIX)]
    assert len(rows) == expected == len(adj), (level, len(rows), len(adj))
    corrections = {}
    for q in sorted(rows, key=lambda q: q["id"]):
        a = adj[q["id"]]
        prov = q["classificationEvidence"]["provenance"]
        assert prov["adjudicationSha256"] == adj_sha and q["classificationVersion"] == f"ib-ai-{level}-may-2026-addition.1"
        patch = OVERLAY.get(f"ib-ai-{level}", {}).get(q["id"])
        exp_sec = [*a["secondary_topics"], *patch["addSecondaryTopics"]] if patch else a["secondary_topics"]
        exp_skills = sorted({*a["skills"], *patch["addSkills"]}) if patch else a["skills"]
        assert (q["primaryTopic"], q["secondaryTopics"], q["skills"]) == (a["primary_topic"], exp_sec, exp_skills) and q["subtopics"] == q["skills"]
        corrections[q["id"]] = {
            "primaryTopic": q["primaryTopic"], "subtopics": q["subtopics"], "secondaryTopics": q["secondaryTopics"],
            "sourceTextSha256": hashlib.sha256(q["accessibleText"].encode("utf-8")).hexdigest(),
            "confidence": q["classificationConfidence"], "status": a["status"],
        }
    payload = {"manifestVersion": f"ib-ai-{level}-official-2026-review.1", "reviewedQuestionCount": len(rows),
               "reviewMethod": OUT_METHOD, "adjudicationSha256": adj_sha,
               "counts": {"agree": sum(c["status"] == "agree" for c in corrections.values()),
                          "adjudicated": sum(c["status"] != "agree" for c in corrections.values()),
                          "lowConfidence": sum(c["confidence"] == "low" for c in corrections.values())},
               "corrections": corrections}
    out = REPO / f"docs/audits/ib-ai-{level}-official-2026-review.json"
    out.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(out.name, payload["counts"])
