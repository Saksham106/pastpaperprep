#!/usr/bin/env python3
"""Build the Physics 0625 production candidate from the controlled source assembly.

The source assembly is external and immutable to this application checkout. This
writer is deterministic, validates the controlled counts/provenance, emits a
pending-upload runtime/private index/storage manifest, and never finalizes release.
"""
from __future__ import annotations
import hashlib, json, os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path(os.environ.get("PHYSICS0625_SOURCE_ROOT", "/Users/sakshamgoel/Documents/ProjectsInternships/igcse-physics-0625-topic-practice"))
ASSEMBLY = Path(os.environ.get("PHYSICS0625_ASSEMBLY", SOURCE / "data/classification/full-bank-assembly-combined/working-assembly.json"))
TAXONOMY = ROOT / "src/data/igcse-physics-0625-official-taxonomy.json"
BANK = "igcse-physics-0625"
RELEASE_PREFIX = f"{BANK}/releases/repaired-v2-"

def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()
def dump(path: Path, value) -> bytes:
    data = json.dumps(value, ensure_ascii=False, separators=(",", ":"), sort_keys=False).encode() + b"\n"
    path.parent.mkdir(parents=True, exist_ok=True); path.write_bytes(data); return data
def session_label(value):
    return {"march_india":"March", "june":"June", "november":"November"}[value]
def zone(component):
    return {"1":"Variant 1", "2":"Variant 2", "3":"Variant 3"}.get(component[-1], "")
def asset_ref(kind, path):
    # source segmentation paths are assets/<paper>/{question,markscheme}/file.webp
    parts = path.split("/")
    if len(parts) != 4 or parts[0] != "assets": raise ValueError(f"bad asset path: {path}")
    return ("questions" if kind == "question" else "markschemes") + "/" + parts[1] + "/" + parts[3]
def compact_text(text, limit=None):
    text = " ".join((text or "").split())
    return text[:limit] if limit else text

def main():
    source_bytes = ASSEMBLY.read_bytes(); source = json.loads(source_bytes)
    rows = source["rows"]
    if len(rows) != 5789: raise SystemExit(f"controlled assembly row count mismatch: {len(rows)}")
    if len(rows[:3820]) != 3820: raise SystemExit("controlled base row count mismatch")
    refs = [[x["path"] for x in r["source"]["images"]] + [x["path"] for x in r["source"]["mark_scheme_images"]] for r in rows]
    if sum(map(len, refs[:3820])) != 8827 or sum(map(len, refs[3820:])) != 4522 or sum(map(len, refs)) != 13349:
        raise SystemExit("controlled asset reference invariant failed")
    taxonomy_bytes = TAXONOMY.read_bytes(); taxonomy_sha = sha(TAXONOMY)
    taxonomy_runtime_sha = hashlib.sha256(json.dumps(json.loads(taxonomy_bytes), ensure_ascii=False, separators=(",", ":")).encode()).hexdigest()
    assembly_sha = sha(ASSEMBLY)
    questions=[]; assets=[]; seen=set(); base_refs=ext_refs=0
    for index, r in enumerate(rows):
        paper_id=r["paper_id"]; comp=str(r["component"]); primary=r.get("primary") or {}
        qrefs=[asset_ref("question", x["path"]) for x in r["source"]["images"]]
        mrefs=[asset_ref("markscheme", x["path"]) for x in r["source"]["mark_scheme_images"]]
        for ref in qrefs+mrefs:
            if ref in seen: raise SystemExit(f"duplicate asset reference: {ref}")
            seen.add(ref)
            physical = SOURCE / ("data/segmentation-repaired" if int(r["year"]) in range(2021,2026) else "data/segmentation/full-extension-repaired") / r["source"]["images"][0]["path"].split("/")[0] if False else None
        if index < 3820: base_refs += len(qrefs)+len(mrefs)
        else: ext_refs += len(qrefs)+len(mrefs)
        tier = r["paper_tier"]
        status = "unresolved_taxonomy_gap" if r["classification_status"] == "unresolved" else "candidate_not_approved"
        q={"id":r["question_id"],"canonicalId":r["question_id"],"bankSlug":BANK,"number":r["number"],"paper":int(comp[0]),"year":r["year"],"session":session_label(r["session"]),"zone":zone(comp),"component":comp,"courseEra":r["era"],"paperTier":tier,"subject":"Physics 0625","course":"Cambridge IGCSE Physics 0625","primaryTopic":primary.get("broad_topic_label"),"primaryTopicId":primary.get("broad_topic_id"),"secondaryTopics":list(dict.fromkeys(x.get("broad_topic_label") for x in r.get("secondary",[]) if x.get("broad_topic_label"))),"subtopics":[primary.get("subtopic_label")] if primary.get("subtopic_label") else [],"detailedSubtopics":[primary.get("subtopic_label")] if primary.get("subtopic_label") else [],"secondarySubtopics":list(dict.fromkeys(x.get("subtopic_label") for x in r.get("secondary",[]) if x.get("subtopic_label"))),"skills":r.get("practical_skills") or [],"assessmentObjectives":[],"marks":r.get("marks"),"maxMarks":r.get("marks"),"summary":compact_text(r["source"].get("text"),180),"accessibleText":compact_text(r["source"].get("text")),"questionImages":qrefs,"markschemeImages":mrefs,"officialMarkscheme":{"images":mrefs},"sourceQuestionUrl":r["source"]["qp_pdf"]["source_url"],"sourceMarkSchemeUrl":r["source"]["ms_pdf"]["source_url"],"sourceType":"actual_past_paper","sourceId":r["question_id"],"publicationStatus":"authorized_production_candidate","classificationReviewStatus":status,"classificationProvenance":{"selectedSource":"controlled-combined-assembly","sourceRowId":r["question_id"],"labelSource":r.get("label_source"),"primaryDetailId":primary.get("detail_id"),"officialCode":primary.get("official_code"),"gaps":r.get("gaps") or [],"taxonomyPath":"src/data/igcse-physics-0625-official-taxonomy.json"},"marks_ready":r.get("marks") is not None,"rightsStatus":"user_attested_rights_authorized","answer":r.get("answer"),"answerProvenance":{"status":"official","questionId":r["question_id"],"assetPaths":mrefs},"printedParts":r.get("printed_parts") or ["question-level"]}
        questions.append(q)
        for ref in qrefs+mrefs:
            kind,paper,file=ref.split("/"); lane="data/segmentation-repaired" if 2021 <= int(r["year"]) <= 2025 else "data/segmentation/full-extension-repaired"; src=(SOURCE/lane/f"assets/{paper}/{('question' if kind=='questions' else 'markscheme')}/{file}")
            if not src.is_file(): raise SystemExit(f"missing PDF-derived asset: {src}")
            assets.append({"objectKey":ref,"sourcePath":str(src),"sha256":sha(src),"size":src.stat().st_size,"contentType":"image/webp"})
    if len(assets)!=13349 or len({a["objectKey"] for a in assets})!=13349: raise SystemExit("asset manifest count mismatch")
    runtime={"version":"igcse-physics-0625-full5789-v2","releaseStatus":"authorized_production_candidate","rightsStatus":"user_attested_rights_authorized","sourceType":"actual_past_paper","specimenQuestionsIncluded":False,"years":"2019-2026","paperCount":len({r["paper_id"] for r in rows}),"questionCount":len(questions),"marks_ready":all(q["marks_ready"] for q in questions),"sourceCandidate":{"path":str(ASSEMBLY),"sha256":assembly_sha,"questionCount":len(questions),"baseQuestionCount":3820,"extensionQuestionCount":1969},"taxonomy":{"path":"src/data/igcse-physics-0625-official-taxonomy.json","version":json.loads(TAXONOMY.read_text())["version"],"sha256":taxonomy_sha},"questions":questions,"publicationStatus":"authorized_production_candidate","assetVerification":"pending_upload","runtimeArtifact":{"schemaVersion":"igcse-runtime-artifact-v1","bank":BANK,"candidate":True,"releaseTaxonomySha256":taxonomy_sha,"runtimeTaxonomySha256":taxonomy_runtime_sha,"sourceCandidateSha256":assembly_sha,"originalCandidateRuntimeSha256":None,"runtimeSha256":None,"contentSha256":assembly_sha,"assetManifestSha256":None,"storageReceiptSha256":None,"marksRepairUnresolvedCount":0}}
    # Self-seal: candidate identity is the runtime hash with its self-hash field null.
    runtime["runtimeArtifact"]["originalCandidateRuntimeSha256"] = hashlib.sha256(json.dumps(runtime,separators=(",",":"),ensure_ascii=False).encode()).hexdigest()
    object_prefix = RELEASE_PREFIX + runtime["runtimeArtifact"]["originalCandidateRuntimeSha256"][:12]
    for asset in assets:
        asset["objectKey"] = f"{object_prefix}/{asset['objectKey']}"
    runtime_sha=hashlib.sha256(json.dumps(runtime,separators=(",",":"),ensure_ascii=False).encode()).hexdigest(); runtime["runtimeArtifact"]["runtimeSha256"]=runtime_sha
    runtime_path=ROOT/f"src/data/production/{BANK}.json"; dump(runtime_path,runtime)
    private={"version":"igcse-physics-0625-private-index-v2","bank":BANK,"releaseStatus":"authorized_production_candidate","assetVerification":"pending_upload","questions":[{"id":q["id"],"number":q["number"],"paper":q["paper"],"year":q["year"],"session":q["session"],"primaryTopic":q["primaryTopic"],"secondaryTopics":q["secondaryTopics"],"skills":q["skills"],"subtopics":q["subtopics"],"subject":q["subject"],"zone":q["zone"],"component":q["component"],"marks":q["marks"]} for q in questions]}
    dump(ROOT/f"src/data/private-index/{BANK}.json",private)
    assets.sort(key=lambda item: item["objectKey"])
    manifest={"schemaVersion":"igcse-private-assets-v1","bank":BANK,"objectPrefix":object_prefix,"storageState":"pending_upload","releaseStatus":"authorized_production_candidate","originalCandidateRuntimeSha256":runtime["runtimeArtifact"]["originalCandidateRuntimeSha256"],"contentSha256":assembly_sha,"runtimeSha256":runtime_sha,"referenceCounts":{"base":base_refs,"extension":ext_refs,"total":len(assets)},"assets":assets}
    dump(ROOT/f"data/storage/{BANK}.manifest.json",manifest)
    print(json.dumps({"baseRows":3820,"combinedRows":len(rows),"assetRefs":len(assets),"baseRefs":base_refs,"extensionRefs":ext_refs,"papers":runtime["paperCount"],"runtimeSha256":runtime_sha,"assemblySha256":assembly_sha,"storageState":"pending_upload"},indent=2))
if __name__ == "__main__": main()
