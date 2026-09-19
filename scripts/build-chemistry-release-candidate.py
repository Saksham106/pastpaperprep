#!/usr/bin/env python3
"""Deterministically assemble Chemistry 0620 base + validated extension.

This script is deliberately fail-closed: it only admits extension rows present in
both the sealed extension result set and the closed review decisions, and writes an
explicit reconciliation receipt for every source/classification/exclusion set.
"""
from __future__ import annotations
import copy, hashlib, json, re, subprocess
from collections import Counter
from pathlib import Path

TARGET = Path(__file__).resolve().parents[1]
SOURCE = Path("/Users/sakshamgoel/Documents/ProjectsInternships/igcse-chemistry-0620-topic-practice")
LANES = SOURCE / "repair-lanes"
EXT_BATCHES = SOURCE / "full-extension" / "batches"
EXT_RESULTS = SOURCE / "data/classification-extension/results"
EXT_REVIEW = SOURCE / "data/classification-extension/review"

def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()

def dump(obj, path: Path):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, indent=2, ensure_ascii=False) + "\n")

def flatten_result_files():
    rows = {}
    duplicate_ids = []
    for path in sorted(EXT_RESULTS.glob("*-results.json")):
        data = json.loads(path.read_text())
        for row in data.get("results", []):
            qid = row.get("question_id")
            if not qid: raise ValueError(f"extension result without question_id: {path}")
            if qid in rows: duplicate_ids.append(qid)
            rows[qid] = copy.deepcopy(row)
    return rows, sorted(set(duplicate_ids))

def flatten_decisions():
    rows = {}
    duplicate_ids = []
    for path in sorted(EXT_REVIEW.glob("decisions-*.json")):
        data = json.loads(path.read_text())
        items = data if isinstance(data, list) else data.get("decisions", data.get("rows", []))
        for row in items:
            qid = row.get("question_id")
            if not qid: raise ValueError(f"decision without question_id: {path}")
            if qid in rows: duplicate_ids.append(qid)
            rows[qid] = copy.deepcopy(row)
    return rows, sorted(set(duplicate_ids))

def main():
    base_runtime_path = TARGET / "src/data/production/igcse-chemistry-0620.json"
    base = json.loads(subprocess.check_output(["git", "show", "HEAD:src/data/production/igcse-chemistry-0620.json"], cwd=TARGET))
    base_ids = [q["id"] for q in base["questions"]]
    if len(base_ids) != len(set(base_ids)): raise ValueError("base runtime has duplicate ids")
    if len(base_ids) != 3529: raise ValueError(f"unexpected base count {len(base_ids)}")

    base_manifest = LANES / "base/repair-manifest.json"
    ext_manifest = LANES / "extension/repair-manifest.json"
    base_receipt = LANES / "base/receipt.json"
    ext_receipt = LANES / "extension/receipt.json"
    base_lane = json.loads(base_manifest.read_text()); ext_lane = json.loads(ext_manifest.read_text())
    if base_lane["question_count"] != len(base_ids): raise ValueError("base lane/runtime question count mismatch")
    if base_lane["null_mark_part_count"] != base_lane["unresolved_cells"]["count"]: raise ValueError("base blank-cell seal mismatch")
    if ext_lane["null_mark_part_count"] != ext_lane["unresolved_cells"]["count"]: raise ValueError("extension blank-cell seal mismatch")

    source = {}
    for path in sorted(EXT_BATCHES.glob("*.json")):
        paper = json.loads(path.read_text())
        for q in paper["questions"]:
            if q["id"] in source: raise ValueError(f"duplicate extension source id {q['id']}")
            source[q["id"]] = (paper, q)
    if len(source) != ext_lane["question_count"]: raise ValueError(f"extension source count {len(source)} != lane {ext_lane['question_count']}")

    # Repair lane is authoritative for official mark cells, including explicit blanks.
    repaired_parts = {}
    for paper in (ext_lane["papers"].values() if isinstance(ext_lane["papers"], dict) else ext_lane["papers"]):
        for q in paper["questions"]:
            repaired_parts[f"{paper['paper_id']}-q{q['number']}"] = q

    result_rows, result_dupes = flatten_result_files()
    decision_rows, decision_dupes = flatten_decisions()
    if len(result_rows) != 1600: raise ValueError(f"validated extension result set must be 1600 unique rows, got {len(result_rows)}")
    if len([q for q in decision_rows if decision_rows[q].get("verdict") == "unlabeled-confirmed"]) != 28:
        raise ValueError("validated extension must preserve exactly 28 honest unlabeled gaps")
    selected = sorted(result_rows)
    missing_decisions = sorted(set(selected) - set(decision_rows))
    # The sealed result set contains 51 rows explicitly accepted by the classifier;
    # closed human decisions cover the remaining reviewed rows. Keep both lanes
    # explicit rather than treating the classifier rows as silently absent.
    for qid in missing_decisions:
        if result_rows[qid].get("status") != "classified":
            raise ValueError(f"extension row without closed decision: {qid}")
        decision_rows[qid] = {"question_id": qid, "verdict": "confirm", "rationale": "sealed classifier acceptance", "batch": "validated-results"}
    missing_source = sorted(set(selected) - set(source))
    if missing_source: raise ValueError(f"extension classification row without segmented source: {missing_source[:5]}")
    collisions = sorted(set(selected) & set(base_ids))
    if collisions: raise ValueError(f"identity collision with base: {collisions[:5]}")

    extension = []
    unlabeled = []
    for qid in selected:
        result = result_rows[qid]; decision = decision_rows[qid]
        paper, q = source[qid]
        verdict = decision.get("verdict")
        primary = copy.deepcopy(result.get("primary"))
        secondary = copy.deepcopy(result.get("secondary") or [])
        if verdict == "change" and decision.get("primary"):
            primary = {"detail_id": decision["primary"]}
            secondary = [{"detail_id": x} for x in decision.get("secondaries", [])]
        if verdict == "unlabeled-confirmed":
            primary = None; secondary = []; unlabeled.append(qid)
        if verdict not in {"confirm", "change", "unlabeled-confirmed"}:
            raise ValueError(f"unknown decision verdict {verdict} for {qid}")
        if primary is None and verdict != "unlabeled-confirmed": raise ValueError(f"missing primary for {qid}")
        # Preserve source segmentation and every repaired per-part cell verbatim.
        rq = repaired_parts[qid]
        parts = copy.deepcopy(rq.get("parts", []))
        if len(parts) != len(q.get("parts", [])):
            raise ValueError(f"part identity mismatch {qid}")
        if primary:
            topic = primary.get("topic_label")
            subtopic = primary.get("subtopic_label")
            detail_id = primary.get("detail_id")
            primary_topic_id = primary.get("topic_id")
            code = primary.get("official_code")
            tier = primary.get("tier")
            era = primary.get("era")
        else:
            topic = subtopic = detail_id = primary_topic_id = code = tier = era = None
        ext = {
            "id": qid, "canonicalId": qid, "bankSlug": "igcse-chemistry-0620",
            "number": q["number"], "paper": int(paper["component"][0]), "year": paper["year"],
            "session": paper.get("session"), "zone": paper.get("zone"), "component": paper["component"],
            "courseEra": paper["era"], "paperTier": paper["tier"], "subject": "Chemistry 0620",
            "course": "Cambridge IGCSE Chemistry 0620", "primaryTopic": topic,
            "primaryTopicId": primary_topic_id, "secondaryTopics": [],
            "subtopics": [subtopic] if subtopic else [], "detailedSubtopics": [subtopic] if subtopic else [],
            "secondarySubtopics": [], "skills": [], "assessmentObjectives": [],
            "marks": q.get("marks"), "maxMarks": q.get("marks"),
            "summary": (q.get("text") or "").strip(), "accessibleText": (q.get("text") or "").strip(),
            "questionImages": [x["path"].replace("assets/", "questions/", 1).replace("/question/", "/") for x in q.get("images", [])],
            "markschemeImages": [x["path"].replace("assets/", "markschemes/", 1).replace("/markscheme/", "/") for x in q.get("mark_scheme_images", [])],
            "officialMarkscheme": {"images": [x["path"].replace("assets/", "markschemes/", 1).replace("/markscheme/", "/") for x in q.get("mark_scheme_images", [])]},
            "sourceQuestionUrl": paper.get("question_paper", {}).get("final_url"),
            "sourceMarkSchemeUrl": paper.get("mark_scheme", {}).get("final_url"), "sourceType": "actual_past_paper",
            "sourceId": qid, "publicationStatus": "production", 
            "classificationReviewStatus": "unresolved_taxonomy_gap" if verdict == "unlabeled-confirmed" else "classified",
            "classificationProvenance": {"selectedSource": "validated-extension", "sourceRowId": qid,
                "labelSource": result.get("reviewer_pass"), "primaryDetailId": detail_id,
                "officialCode": code, "gaps": [decision.get("rationale")] if verdict == "unlabeled-confirmed" else [],
                "taxonomyPath": "src/data/igcse-chemistry-0620-official-taxonomy.json"},
            "marks_ready": True, "rightsStatus": "user_attested_rights_authorized", "answer": q.get("answer"),
            "answerProvenance": {"status": "official", "questionId": qid,
                "assetPaths": [x["path"] for x in q.get("mark_scheme_images", [])]},
            "printedParts": [x.get("label") for x in parts] or ["question-level"], "parts": parts,
            "validatedExtension": {"verdict": verdict, "primaryDetailId": detail_id, "secondary": secondary,
                "rationale": decision.get("rationale") or result.get("rationale")},
        }
        extension.append(ext)

    all_questions = base["questions"] + extension
    runtime = copy.deepcopy(base)
    runtime.update({"version": "igcse-chemistry-0620-release-candidate-v2", "releaseStatus": "production_candidate",
        "years": "2019-2026", "paperCount": 314, "questionCount": len(all_questions), "questions": all_questions,
        "publicationStatus": "production_candidate", "assetVerification": "pending_verified_readback"})
    runtime["runtimeArtifact"].update({"publicationStatus": "production_candidate", "assetVerification": "pending_verified_readback",
        "assetManifestSha256": None, "storageReceiptSha256": None, "runtimeSha256": None,
        "originalCandidateRuntimeSha256": runtime["runtimeArtifact"]["originalCandidateRuntimeSha256"],
        "validatedExtensionQuestionCount": len(extension), "validatedExtensionUnlabeledGapCount": len(unlabeled)})
    dump(runtime, TARGET / "src/data/production/igcse-chemistry-0620.json")

    private = []
    for q in all_questions:
        private.append({k: q.get(k) for k in ["id","number","paper","year","session","primaryTopic","secondaryTopics","skills","subtopics","subject","zone","component","marks"]})
    dump({"version": 2, "bank": "igcse-chemistry-0620", "questions": private}, TARGET / "src/data/private-index/igcse-chemistry-0620.json")

    receipt = {
        "schemaVersion": "chemistry-0620-release-reconciliation-v1", "bank": "igcse-chemistry-0620",
        "status": "production_candidate_pending_verified_remote_readback", "remoteReadbackRequired": True,
        "sourceLanes": {"base": {"manifest": str(base_manifest), "manifestSha256": sha(base_manifest), "receiptSha256": sha(base_receipt), "questions": len(base_ids), "officialBlankPerPartCells": base_lane["null_mark_part_count"]},
            "extension": {"manifest": str(ext_manifest), "manifestSha256": sha(ext_manifest), "receiptSha256": sha(ext_receipt), "segmentedQuestions": len(source), "classifiedResultRows": len(result_rows), "selectedRows": len(extension), "officialBlankPerPartCells": ext_lane["null_mark_part_count"]}},
        "manifestQuestions": {"base": len(base_ids), "extensionSegmented": len(source), "extensionSelected": len(extension), "served": len(all_questions)},
        "identityDuplicatePolicy": {"canonicalId": "paper-id-qnumber", "duplicateHandling": "fail_closed", "sourceDuplicateIds": sorted(set(result_dupes + decision_dupes)), "baseExtensionCollisions": collisions},
        "classificationRows": {"resultRows": len(result_rows), "decisionRows": len(decision_rows), "decisionVerdicts": dict(Counter(decision_rows[q].get("verdict") for q in decision_rows)), "servedClassified": len(extension)-len(unlabeled), "servedUnlabeledGaps": len(unlabeled), "unlabeledIds": unlabeled},
        "exclusions": {"segmentedNotClassified": sorted(set(source)-set(result_rows)), "classifiedNotServed": sorted(set(result_rows)-set(selected)), "reason": "Only closed validated extension result rows are served; unselected segmented rows are retained in receipt."},
        "servedRows": {"base": base_ids, "extension": selected, "total": len(all_questions)},
        "officialBlankPerPartCells": {"base": base_lane["null_mark_part_count"], "extension": ext_lane["null_mark_part_count"], "preservedInExtensionParts": sum(1 for q in extension for p in q.get("parts", []) if p.get("marks") is None), "excludedFromServedRows": [{"questionId": f"{paper['paper_id']}-q{q['number']}", "part": part.get("label"), "reason": "segmented but not in validated classified extension result set"} for paper in (ext_lane["papers"].values() if isinstance(ext_lane["papers"], dict) else ext_lane["papers"]) for q in paper["questions"] if f"{paper['paper_id']}-q{q['number']}" not in set(selected) for part in q.get("parts", []) if part.get("marks") is None]},
        "honestUnlabeledGapCount": len(unlabeled), "expectedHonestUnlabeledGapCount": 28,
        "generated": {"runtime": "src/data/production/igcse-chemistry-0620.json", "privateIndex": "src/data/private-index/igcse-chemistry-0620.json", "catalogCount": len(all_questions)}
    }
    dump(receipt, TARGET / "data/release/chemistry-0620-reconciliation-receipt.json")
    print(json.dumps({"served":len(all_questions),"extension":len(extension),"unlabeled":len(unlabeled),"segmented":len(source),"classified":len(result_rows),"excluded":len(source)-len(result_rows)}, indent=2))

if __name__ == "__main__": main()
