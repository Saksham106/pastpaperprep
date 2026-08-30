#!/usr/bin/env python3
"""Archive the completed semantic sample audit without duplicating image assets."""
from __future__ import annotations

import hashlib
import json
import shutil
from pathlib import Path

SOURCE = Path("/tmp/ppp-semantic-audit-2026-08")
DESTINATION = Path("docs/audits/classification-semantic-sample-2026-08")
CANONICAL_TAXONOMY = Path(__file__).resolve().parent / "classification-semantic-canonical-taxonomy.json"
FILES = (
    "sample-manifest.json",
    "selection-hidden.json",
    "pre-adjudication-comparison.json",
    "adjudication-queue.json",
    "adjudication-manifest.json",
    "final-report.json",
)
DIRECTORIES = (
    "blind-inputs",
    "blind-results",
    "adjudication-inputs",
    "adjudication-results",
    "canonical-ownership-repair-inputs",
    "canonical-ownership-repair-results",
)


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def canonical_bytes(value: object) -> bytes:
    return (json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n").encode()


def main() -> None:
    missing = [name for name in (*FILES, *DIRECTORIES) if not (SOURCE / name).exists()]
    if missing:
        raise FileNotFoundError(f"incomplete audit; missing: {missing}")

    if DESTINATION.exists():
        shutil.rmtree(DESTINATION)
    DESTINATION.mkdir(parents=True)

    for name in FILES:
        shutil.copy2(SOURCE / name, DESTINATION / name)
    shutil.copy2(CANONICAL_TAXONOMY, DESTINATION / "canonical-taxonomy.json")
    for name in DIRECTORIES:
        shutil.copytree(SOURCE / name, DESTINATION / name)

    artifacts: dict[str, str] = {}
    for path in sorted(DESTINATION.rglob("*.json")):
        relative = path.relative_to(DESTINATION).as_posix()
        if relative != "artifact-manifest.json":
            artifacts[relative] = sha256(path)

    final_report = json.loads((DESTINATION / "final-report.json").read_text())
    sample_manifest = json.loads((DESTINATION / "sample-manifest.json").read_text())
    bank_labels = {
        "igcse": "Cambridge IGCSE Mathematics 0580",
        "igcse-additional": "Cambridge IGCSE Additional Mathematics 0606",
        "ib-hl": "IB Mathematics AA HL",
        "ib-sl": "IB Mathematics AA SL",
        "ib-ai-hl": "IB Mathematics AI HL",
        "ib-ai-sl": "IB Mathematics AI SL",
    }
    table_rows = []
    for bank, metrics in final_report["bankMetrics"].items():
        ci_low, ci_high = metrics["uniformDefectRate95Wilson"]
        table_rows.append(
            f"| {bank_labels[bank]} | {metrics['sample']} | {metrics['productionDefects']} | "
            f"{metrics['uniformDefectRate']:.1%} ({ci_low:.1%}–{ci_high:.1%}) | {metrics['status']} |"
        )
    missing_markschemes = sum(
        summary["officialMarkschemeUnavailable"] for summary in sample_manifest["bankSummaries"].values()
    )
    readme = f"""# Classification semantic sample — August 2026

This is a deterministic, blind, stratified semantic QA audit of the classifications shipped at production commit `{final_report['productionCommit']}`.

## Design

- **350 questions across all six banks** (about 5% overall).
- **60% deterministic uniform sample** for an unbiased defect estimate.
- **40% risk-enriched sample** balanced across changed, non-high-confidence, and cross-topic records.
- Minimum topic coverage per bank.
- Blind reviewers saw the question, available official markscheme, and controlled taxonomy, but not production labels or risk flags.
- Every disagreement was freshly adjudicated from the staged source images with production and blind outputs treated only as proposals.
- The initial blind packet accidentally exposed an observed union of valid labels rather than canonical topic-to-skill ownership. This did not expose production answers, but it was too permissive: 66 blind rows used a skill under the wrong selected topic, and every one entered the disagreement queue. Initial adjudication resolved 23, carried 43 forward, and introduced one different ownership error. All 44 final ownership violations were freshly image-reviewed again and repaired against the app's canonical taxonomy; the final report fails closed unless every skill is owned by a selected topic.

## Result

**Overall status: `{final_report['status']}`**

- Production defects: **{final_report['productionDefectCount']} / {final_report['sampleCount']}**
- Uniform-sample defects: **{final_report['overallUniformDefects']} / {final_report['overallUniformSample']} ({final_report['overallUniformDefectRate']:.1%})**
- Blind exact matches: **{final_report['blindExactCount']}**
- Fresh adjudications: **{final_report['adjudicatedCount']}**
- Canonical-ownership repairs after fresh image review: **{final_report['canonicalOwnershipRepairCount']}**
- Sampled questions without an official markscheme: **{missing_markschemes}**; those used the question plus the stored independent solution and remain explicitly flagged.

| Bank | Sample | Production defects | Uniform defect rate (95% Wilson CI) | Status |
|---|---:|---:|---:|---|
{chr(10).join(table_rows)}

## Interpretation

`pass` means no adjudicated primary-topic or taxonomy-gap defect and a uniform defect rate no higher than 5%. `expand-to-10-percent` means the bank needs a larger confirmatory sample. `fail-systemic-review-required` means the sample found at least two primary-topic defects or taxonomy gaps and the bank needs systematic review rather than random spot fixes.

This audit **does not mutate production classifications**. The final report identifies confirmed defects and determines the next review scope. Staged WebP evidence is not duplicated here; `selection-hidden.json` retains the original evidence paths and hashes for reproducibility.
"""
    (DESTINATION / "README.md").write_text(readme)
    manifest = {
        "manifestVersion": "pastpaperprep-semantic-sample-archive-2026.08.1",
        "auditVersion": final_report["auditVersion"],
        "productionCommit": final_report["productionCommit"],
        "sampleCount": final_report["sampleCount"],
        "evidencePolicy": "Question and markscheme WebPs are not duplicated; selection-hidden.json retains source paths and SHA-256 hashes.",
        "artifacts": artifacts,
    }
    (DESTINATION / "artifact-manifest.json").write_bytes(canonical_bytes(manifest))
    print(json.dumps({
        "destination": str(DESTINATION),
        "artifactCount": len(artifacts),
        "artifactManifestSha256": sha256(DESTINATION / "artifact-manifest.json"),
    }, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
