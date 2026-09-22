#!/usr/bin/env python3
"""Apply the sealed, fail-closed Jev 2026-09-21 classification overlay."""
from __future__ import annotations
import copy, hashlib, json, subprocess
from collections import Counter
from pathlib import Path

BANK_PATHS = {
    "igcse-biology-0610": "src/data/production/igcse-biology-0610.json",
    "igcse-chemistry-0620": "src/data/production/igcse-chemistry-0620.json",
    "igcse-economics-0455": "src/data/production/igcse-economics-0455.json",
    "igcse": "src/data/raw/igcse.json",
    "igcse-additional": "src/data/raw/igcse-additional.json",
}
OVERLAY = "data/classification/jev-2026-09-21/corrections.json"
IMMUTABLE_RELEASE_IDENTITIES = {
    "igcse-biology-0610": {
        "sourceCandidateSha256": "ae8d6aef098c380bcb3d221e152474d2ef10d666d61c472ee42b6d4077cd4e25",
        "originalCandidateRuntimeSha256": "9e97cd0c0455ae865b1d14dc462f74ce22d1c66fb734e7d4a8baaf414e0ff961",
    },
    "igcse-economics-0455": {
        "sourceCandidateSha256": "629eb2cd4ae77ad6fd7cade9b89380b0a8b41a45f42548dab822ce3f0aabcf81",
        "originalCandidateRuntimeSha256": "629eb2cd4ae77ad6fd7cade9b89380b0a8b41a45f42548dab822ce3f0aabcf81",
    },
    "igcse-chemistry-0620": {
        "sourceCandidateSha256": "81c706903aa94c6865336cf40027c26b33e0ba514082f4d8da2c576b9bb2cf87",
        "originalCandidateRuntimeSha256": "81c706903aa94c6865336cf40027c26b33e0ba514082f4d8da2c576b9bb2cf87",
    },
}


def read(path: Path):
    return json.loads(path.read_text())


def write_json(path: Path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, separators=(",", ":")) + "\n")


def _js_json(value):
    """The JSON.stringify form used by the release generators."""
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"), allow_nan=False)


def _refresh_runtime_seals(artifact, bank):
    """Refresh mutable seals without ever changing release/source identity."""
    runtime = artifact.get("runtimeArtifact")
    if not runtime:
        return
    runtime["sourceCandidateSha256"] = IMMUTABLE_RELEASE_IDENTITIES[bank]["sourceCandidateSha256"]
    runtime["originalCandidateRuntimeSha256"] = IMMUTABLE_RELEASE_IDENTITIES[bank]["originalCandidateRuntimeSha256"]
    runtime["contentSha256"] = hashlib.sha256(_js_json(artifact["questions"]).encode()).hexdigest()
    if bank == "igcse-economics-0455":
        runtime["finalizedContentSha256"] = runtime["contentSha256"]
    runtime_copy = copy.deepcopy(artifact)
    runtime_copy["runtimeArtifact"]["runtimeSha256"] = None
    runtime["runtimeSha256"] = hashlib.sha256(_js_json(runtime_copy).encode()).hexdigest()


def load_overlay(path: Path):
    data = read(path)
    if data.get("schemaVersion") != "pastpaperprep-jev-correction-overlay.v1":
        raise ValueError("overlay schema mismatch")
    return data


def _bio_taxonomy(root):
    out = {}
    data = read(root / "src/data/igcse-biology-0610-official-taxonomy.json")
    for era in data["eras"]:
        for topic in era["topics"]:
            for sub in topic["subtopics"]:
                out[sub["normalized_subtopic_id"]] = {"topicId": topic["normalized_topic_id"], "topic": topic["title"], "subtopic": sub["title"]}
    return out


def _chem_taxonomy(root):
    out = {}
    runtime = read(root / BANK_PATHS["igcse-chemistry-0620"])
    for q in runtime["questions"]:
        detail = q.get("classificationProvenance", {}).get("primaryDetailId")
        if detail and detail not in out:
            out[detail] = {"topicId": q.get("primaryTopicId"), "topic": q.get("primaryTopic"), "subtopic": (q.get("subtopics") or [q.get("primaryTopic")])[0]}
    taxonomy = read(root / "src/data/igcse-chemistry-0620-official-taxonomy.json")
    topics = {t["id"]: t["title"] for t in taxonomy["topics"]}
    subtopics = {s["id"]: s for s in taxonomy["subtopics"]}
    for detail in taxonomy["details"]:
        sub = subtopics[detail["ownerSubtopicCode"]]
        out.setdefault(detail["id"], {"topicId": detail["ownerTopicId"], "topic": topics[detail["ownerTopicId"]], "subtopic": sub["title"]})
    return out


def _econ_taxonomy(root):
    data = read(root / "src/data/igcse-economics-0455-taxonomy.json")
    topics = {t["id"]: t["label"] for t in data["student_topics"]}
    details = {}
    for topic in data["student_topics"]:
        for item in topic.get("detailed_subtopics", []):
            details[(topic["id"], item["code"], item["era"])] = item["label"]
    return topics, details


def _label_data(root):
    return _bio_taxonomy(root), _chem_taxonomy(root), _econ_taxonomy(root)


def _current_signature(q):
    return {k: q.get(k) for k in ["primaryTopic", "primaryTopicId", "secondaryTopics", "subtopics", "detailedSubtopics", "courseEra", "era"]}


def _row_already_applied(q, row, labels):
    provenance = q.get("classificationProvenance", {}).get("jevCorrection")
    if not isinstance(provenance, dict):
        return False
    if provenance.get("audit") != "jev-audit-2026-09-21" or provenance.get("decision") != row["decision"]:
        raise ValueError(f"invalid Jev provenance: {row['id']}")
    if provenance.get("original") != row["expected"]:
        raise ValueError(f"Jev original provenance mismatch: {row['id']}")
    probe = copy.deepcopy(q)
    _apply_row(probe, row, labels, record_provenance=False)
    return _current_signature(q) == _current_signature(probe)


def _validate_targets(root, overlay):
    seen = set()
    qmaps = {}
    for bank, rel in BANK_PATHS.items():
        qs = read(root / rel)["questions"]
        qmaps[bank] = {q["id"]: q for q in qs}
        if len(qmaps[bank]) != len(qs): raise ValueError(f"duplicate source IDs: {bank}")
    for row in overlay["rows"]:
        if row["id"] in seen: raise ValueError(f"duplicate overlay ID: {row['id']}")
        seen.add(row["id"])
        q = qmaps[row["bank"]].get(row["id"])
        if q is None: raise ValueError(f"missing overlay ID: {row['id']}")
        labels = _label_data(root)
        if "jevCorrection" in q.get("classificationProvenance", {}):
            if not _row_already_applied(q, row, labels):
                raise ValueError(f"applied-value mismatch: {row['id']}")
        elif _current_signature(q) != row["expected"]:
            raise ValueError(f"current-value mismatch: {row['id']}")
    if len(seen) != overlay["scope"]["targetCount"]: raise ValueError("target count mismatch")
    held_seen = set()
    for row in overlay.get("heldRows", []):
        if row["id"] in held_seen or row["id"] in seen: raise ValueError(f"duplicate/overlapping held row: {row['id']}")
        held_seen.add(row["id"])
        if row.get("decision") not in overlay["scope"].get("heldDecisions", []): raise ValueError(f"invalid held decision: {row['id']}")
        q = qmaps[row["bank"]].get(row["id"])
        if q is None or _current_signature(q) != row["expected"]: raise ValueError(f"held-row mismatch: {row['id']}")
        if row["id"] == "0580-2026-june-23-q25":
            if "evidence" not in row or q.get("classificationProvenance", {}).get("jevCorrection") is not None: raise ValueError("0580 held evidence/provenance mismatch")
    if len(overlay.get("heldRows", [])) != overlay["scope"]["heldCount"]: raise ValueError("held count mismatch")
    return qmaps


def validate_overlay(root: Path, overlay):
    qmaps = _validate_targets(root, overlay)
    decisions = Counter(row["decision"] for row in overlay["rows"])
    banks = Counter(row["bank"] for row in overlay["rows"])
    return {"targetCount": len(overlay["rows"]), "changedCount": len(overlay["rows"]), "decisionCounts": dict(sorted(decisions.items())), "bankCounts": dict(sorted(banks.items())), "heldCount": overlay["scope"]["heldCount"]}


def _apply_row(q, row, labels, record_provenance=True):
    if record_provenance and _row_already_applied(q, row, labels):
        return
    # A source row that already equals the reviewed expected state is a no-op;
    # adding provenance would change the non-classification release seal.
    if record_provenance and _current_signature(q) == row["expected"] and "jevCorrection" not in q.get("classificationProvenance", {}):
        return
    original = _current_signature(q)
    final = row["final"]
    bank = row["bank"]
    if bank == "igcse-biology-0610":
        p = labels[0][final["primary"]]
        second = [labels[0][x] for x in final.get("secondaries", [])]
        q.update(primaryTopic=p["topic"], primaryTopicId=p["topicId"], secondaryTopics=list(dict.fromkeys(x["topic"] for x in second)), subtopics=[p["subtopic"]], detailedSubtopics=[p["subtopic"]], secondarySubtopics=[x["subtopic"] for x in second])
    elif bank == "igcse-chemistry-0620":
        p = labels[1][final["primary"]]
        second = [labels[1][x] for x in final.get("secondaries", [])]
        q.update(primaryTopic=p["topic"], primaryTopicId=p["topicId"], secondaryTopics=list(dict.fromkeys(x["topic"] for x in second)), subtopics=[p["subtopic"]] + [x["subtopic"] for x in second], detailedSubtopics=[p["subtopic"]] + [x["subtopic"] for x in second], secondarySubtopics=[x["subtopic"] for x in second])
        q.setdefault("classificationProvenance", {})["primaryDetailId"] = final["primary"]
        q["classificationProvenance"]["secondaryDetailIds"] = final.get("secondaries", [])
    elif bank == "igcse-economics-0455":
        topics, details = labels[2]
        topic_id, detail, era = final["primary"], final["detail"], final["era"]
        if (topic_id, "5.1.1", era) not in details: raise ValueError(f"economics taxonomy miss: {row['id']}")
        q.update(primaryTopic=final["label"], primaryTopicId=topic_id, secondaryTopics=[], subtopics=[detail], detailedSubtopics=[detail], secondarySubtopics=[], courseEra=era, era=era, officialCodes=[{"official_code":"5.1.1", "era":era, "normalized_detail_id":"5.1.1"}])
    elif bank == "igcse":
        q.update(primaryTopic=final["label"], subtopics=[final["detail"]], detailedSubtopics=[final["detail"]])
    else: raise ValueError(f"unsupported bank: {bank}")
    if record_provenance:
        q.setdefault("classificationProvenance", {})["jevCorrection"] = {"audit": "jev-audit-2026-09-21", "decision": row["decision"], "original": original, "rationale": row.get("rationale")}


def _private_index(runtime, bank):
    version = 2 if bank == "igcse-chemistry-0620" else 1
    return {"version": version, "bank": bank, "questions": [{k: q.get(k) for k in ["id","number","paper","year","session","primaryTopic","secondaryTopics","skills","subtopics","subject","zone","component","marks"]} for q in runtime["questions"]]}


def _write_private(path, value, bank):
    if bank == "igcse-biology-0610":
        payload = json.dumps(value, ensure_ascii=False, separators=(",", ":"))
    else:
        indent = 2 if bank == "igcse-chemistry-0620" else 1
        payload = json.dumps(value, ensure_ascii=False, indent=indent)
    path.write_text(payload + "\n")


def apply_corrections(root: Path, overlay, write=True):
    qmaps = _validate_targets(root, overlay)
    labels = _label_data(root)
    before = {b: copy.deepcopy(read(root / p)) for b, p in BANK_PATHS.items()}
    targets = {(r["bank"], r["id"]): r for r in overlay["rows"]}
    after = copy.deepcopy(before)
    for bank, artifact in after.items():
        for q in artifact["questions"]:
            row = targets.get((bank, q["id"]))
            if row: _apply_row(q, row, labels)
        if bank in IMMUTABLE_RELEASE_IDENTITIES and any(r["bank"] == bank for r in overlay["rows"]):
            _refresh_runtime_seals(artifact, bank)
    duplicate = []
    for artifact in after.values():
        ids = [q["id"] for q in artifact["questions"]]; duplicate += [x for x, n in Counter(ids).items() if n > 1]
    changed = sorted(r["id"] for r in overlay["rows"])
    held = [q["id"] for q in overlay.get("heldRows", [])]
    held_unchanged = all(before[r["bank"]]["questions"][[q["id"] for q in before[r["bank"]]["questions"]].index(r["id"])] == after[r["bank"]]["questions"][[q["id"] for q in after[r["bank"]]["questions"]].index(r["id"])] for r in overlay.get("heldRows", []))
    target_pairs = set(targets)
    unchanged_non_targets = all(
        before[bank]["questions"][i] == after[bank]["questions"][i]
        for bank, artifact in before.items()
        for i, q in enumerate(artifact["questions"])
        if (bank, q["id"]) not in target_pairs
    )
    result = {"changedIds": changed, "rowCounts": {b: len(a["questions"]) for b,a in after.items()}, "baselineRowCounts": {b: len(a["questions"]) for b,a in before.items()}, "duplicateIds": sorted(set(duplicate)), "unchangedNonTargets": unchanged_non_targets, "heldUnchanged": held_unchanged, "taxonomyErrors": [], "targetIds": sorted(r["id"] for r in overlay["rows"]), "heldIds": held}
    if write:
        target_banks = {row["bank"] for row in overlay["rows"]}
        for bank in target_banks:
            artifact = after[bank]
            if artifact != before[bank]:
                write_json(root / BANK_PATHS[bank], artifact)
                if bank != "igcse": _write_private(root / "src/data/private-index" / f"{bank}.json", _private_index(artifact, bank), bank)
        if "igcse" in target_banks and after["igcse"] != before["igcse"]:
            subprocess.run(["node", "scripts/generate-bank-index.mjs"], cwd=root, check=True)
    return result


if __name__ == "__main__":
    root = Path(__file__).resolve().parents[1]
    overlay = load_overlay(root / OVERLAY)
    print(json.dumps({"validation": validate_overlay(root, overlay), "application": apply_corrections(root, overlay)}, indent=2))
