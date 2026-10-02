#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { SECTIONS_0606, project0606Sections } from "../src/lib/igcse-0606-subtopics.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const paths = {
  source: "src/data/raw/igcse-additional.json",
  taxonomy: "src/data/igcse-0606-numbered-subtopics.json",
  multiOverlay: "src/data/igcse-0606-multilabel-section-overlay.json",
  granularOverlay: "src/data/math-granular-label-overlay.json",
};
const expected = {
  source: "4d385d4ee951a313608075415b95e5e7fb63805823760328b1853c3e145ce87f",
  taxonomy: "d6c30fcb6afce7545be125c1baee2c77c93f1b9ab748649a06cdc9e83d8f3772",
  multiOverlay: "04f5d04045909e026ae5a467a48fd27dddb379698a7d181da79d74e3b1483c83",
  granularOverlay: "b6e4d6d62baada65de7a9f9e6fd84275f4e011c3835cdf456994944774daf6e3",
};
const load = (p) => JSON.parse(readFileSync(resolve(root, p), "utf8"));
const hash = (p) => createHash("sha256").update(readFileSync(resolve(root, p))).digest("hex");
export function validateSourceIds(ids) {
  if (ids.length !== 1633 || ids.some((id) => !id) || new Set(ids).size !== 1633) throw new Error("0606 raw source row/ID integrity failure");
  return true;
}
export function buildLedger() {
  for (const [key, path] of Object.entries(paths)) if (hash(path) !== expected[key]) throw new Error(`${key} source hash drift: ${hash(path)}`);
  const raw = load(paths.source).questions;
  const taxonomy = load(paths.taxonomy);
  const ids = raw.map((q) => q.id);
  validateSourceIds(ids);
  if (taxonomy.sections.length !== 67 || new Set(taxonomy.sections.map((s) => s.topic)).size !== 14) throw new Error("0606 syllabus taxonomy drift");
  const modelById=new Map(load(paths.multiOverlay).rows.map(row=>[row.id,row]));
  const currentTopics=new Set(SECTIONS_0606.map(section=>section.topic));
  const rows = raw.map((q) => {
    const projected = project0606Sections(q);
    const matched = projected.codes.length > 0;
    const model=modelById.get(q.id);
    const modelProposals=(model?.codes??[]).map(code=>({code,model:model.model,score:model.scores[code]}));
    // Conservative partition: overlapping model links remain proposals until
    // an independent rule-only or source check establishes their evidence.
    const rules=projected.codes.filter(code=>!modelProposals.some(proposal=>proposal.code===code));
    return {
      id: q.id, year: q.year, paperId: q.paperId, component: q.component,
      existingPrimaryTopic: q.primaryTopic, existingSecondaryTopics: q.secondaryTopics ?? [], existingFineFilters: q.subtopics ?? [],
      officialTopics: matched ? projected.topics : (q.subtopics??[]).filter(label=>currentTopics.has(label)),
      reviewDisposition: matched ? "candidate_not_source_adjudicated" : q.year>=2025 ? "current_section_review" : "legacy_section_review",
      statementCodes: projected.codes, statementTitles: projected.codes.map((code) => taxonomy.sections.find((s) => s.code === code).displayTitle),
      disposition: rules.length && modelProposals.length ? "mixed_projection_candidate" : rules.length ? "deterministic_projection_candidate" : modelProposals.length ? "model_proposal_candidate" : "unresolved_no_supported_section",
      evidenceClass: "unadjudicated_projection_candidate",
      deterministicRuleEvidence: { method: projected.method, category: "non_model_only_code_correspondence_unadjudicated", codes: rules },
      modelProposals,
      sourceEvidence: { questionImages: q.questionImages ?? [], markschemeImages: q.markschemeImages ?? [], accessibleTextPresent: Boolean(q.accessibleText) },
    };
  });
  const fineFilters = [...new Set(raw.flatMap((q) => q.subtopics ?? []))].sort();
  if (fineFilters.length !== 17) throw new Error(`legacy filter inventory drift: ${fineFilters.length}`);
  const perStatementCandidateRows = Object.fromEntries(SECTIONS_0606.map((s) => [s.code, rows.filter((r) => r.statementCodes.includes(s.code)).length]));
  const perOfficialTopicRows = Object.fromEntries([...new Set(SECTIONS_0606.map((s) => s.topic))].map((topic) => [topic, rows.filter((r) => r.officialTopics.includes(topic)).length]));
  return {
    schemaVersion: "0606-offline-candidate-reconciliation-v2", candidateOnly: true, releaseEnabled: false,
    syllabus: { url: taxonomy.sourcePdfUrl, sha256: taxonomy.sourcePdfSha256, examYears: [2025, 2026, 2027], topicCount: 14, numberedStatementCount: 67 },
    sourceRaw: { path: paths.source, sha256: expected.source, rowCount: raw.length },
    inputs: Object.fromEntries(Object.entries(paths).map(([k,p]) => [k, { path:p, sha256:expected[k] }])),
    method: "Pinned raw source plus existing deterministic projector and overlays; stored model overlay links are explicit unapproved proposals; no new model calls.",
    counts: { sourceQuestionRows: rows.length, uniqueQuestionIds: new Set(ids).size, topics: 14, statements: 67, oldFineFilterSet: fineFilters, anyProjectionCandidate: rows.filter((r) => r.statementCodes.length).length, deterministicProjectionCandidate: rows.filter((r) => r.deterministicRuleEvidence.codes.length).length, modelProposalCandidate: rows.filter(r=>r.modelProposals.length).length, unresolvedNoSupportedSection: rows.filter((r) => !r.statementCodes.length).length, sourceAdjudicated: 0, perStatementCandidateRows, perOfficialTopicRows }, rows,
  };
}
const output = resolve(root, "src/data/igcse-0606-offline-candidate-ledger.json");
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  writeFileSync(output, `${JSON.stringify(buildLedger(), null, 2)}\n`);
  process.stdout.write(`${output}\n`);
}
