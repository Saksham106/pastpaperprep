import { describe, expect, test } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import ledger from "../data/igcse-0606-offline-candidate-ledger.json" with { type: "json" };
import raw from "../data/raw/igcse-additional.json";
import modelOverlay from "../data/igcse-0606-multilabel-section-overlay.json";
import taxonomy from "../data/igcse-0606-numbered-subtopics.json" with { type: "json" };
import { filterQuestions } from "./question-filter";
import { loadBankQuestions } from "./question-fixtures";
import { project0606Sections } from "./igcse-0606-subtopics.mjs";
import { validateSourceIds } from "../../scripts/0606-offline-reconciliation.mjs";

const root = process.cwd();
const sha = (path: string) => createHash("sha256").update(readFileSync(resolve(root, path))).digest("hex");
const sorted = (ids: string[]) => [...ids].sort();
describe("0606 offline candidate ledger", () => {
  test("preserves real primary owners and does not call current-year unresolved content Earlier",()=>{
    const originals=new Map(raw.questions.map(q=>[q.id,q]));
    for(const row of ledger.rows){
      expect(row.existingPrimaryTopic).toBe(originals.get(row.id)!.primaryTopic);
      if(row.year>=2025&&row.statementCodes.length===0)expect(row.officialTopics).not.toContain("Earlier syllabus topics");
    }
  });

  test("retains existing model overlay links as proposals rather than invented deterministic evidence",()=>{
    const byId=new Map(ledger.rows.map(row=>[row.id,row]));
    expect(ledger.rows.filter(row=>row.modelProposals.length>0)).toHaveLength(modelOverlay.rows.length);
    for(const source of modelOverlay.rows){
      const row=byId.get(source.id)!;
      expect(row.modelProposals).toEqual(source.codes.map(code=>({code,model:source.model,score:source.scores[code as keyof typeof source.scores]})));
      expect(row.deterministicRuleEvidence.codes.some(code=>source.codes.includes(code))).toBe(false);
    }
  });

  test("pins exact source and rebuilds byte-identically without model calls", () => {
    expect(sha(ledger.sourceRaw.path)).toBe(ledger.sourceRaw.sha256);
    for (const input of Object.values(ledger.inputs)) expect(sha(input.path)).toBe(input.sha256);
    const script = resolve(root, "scripts/0606-offline-reconciliation.mjs");
    const first = execFileSync(process.execPath, [script], { encoding: "utf8" });
    const bytes1 = readFileSync(resolve(root, "src/data/igcse-0606-offline-candidate-ledger.json"));
    execFileSync(process.execPath, [script], { encoding: "utf8" });
    const bytes2 = readFileSync(resolve(root, "src/data/igcse-0606-offline-candidate-ledger.json"));
    expect(first.trim()).toContain("igcse-0606-offline-candidate-ledger.json");
    expect(bytes2.equals(bytes1)).toBe(true);
  });
  test("exactly equals every source ID, rejects duplicates/missing IDs, keeps proposals unapproved", () => {
    const ids = raw.questions.map(q => q.id);
    expect(ledger.candidateOnly).toBe(true); expect(ledger.releaseEnabled).toBe(false);
    expect(ledger.rows.map(r => r.id).sort()).toEqual(sorted(ids));
    expect(new Set(ledger.rows.map(r => r.id)).size).toBe(ids.length);
    expect(() => validateSourceIds([...ids.slice(1)])).toThrow();
    expect(() => validateSourceIds([...ids.slice(0, -1), ids[0]])).toThrow();
    expect(ledger.rows.every(r => r.evidenceClass === "unadjudicated_projection_candidate")).toBe(true);
    expect(ledger.counts.sourceAdjudicated).toBe(0);
  });
  test("all 17 legacy filters retrieve exactly their source ID sets through current runtime semantics", () => {
    const runtime = loadBankQuestions("igcse-additional");
    const labels = [...new Set(raw.questions.flatMap(q => q.subtopics))].sort();
    expect(ledger.counts.oldFineFilterSet).toEqual(labels);
    for (const label of labels) expect(sorted(filterQuestions(runtime, { subtopics: [label] }).map(q => q.id))).toEqual(sorted(raw.questions.filter(q => q.subtopics.includes(label)).map(q => q.id)));
  });
  test("all 67 candidate section retrieval sets equal projector output through runtime filtering", () => {
    const runtime = loadBankQuestions("igcse-additional");
    const projected = runtime.map(q => {
      const source = raw.questions.find(row => row.id === q.id)!;
      const projection = project0606Sections(source);
      // Isolate the historical offline projector from the new accepted runtime overlay.
      return { ...q, subtopics: projection.subtopics, skills: [...source.subtopics, ...projection.subtopics], officialCodeRefs: projection.codeRefs };
    });
    const rows = new Map(ledger.rows.map(r => [r.id, r]));
    expect(new Set(taxonomy.sections.map(s => s.topic)).size).toBe(14);
    expect(taxonomy.sections).toHaveLength(67);
    for (const section of taxonomy.sections) {
      const expected = raw.questions.filter(q => project0606Sections(q).codes.includes(section.code)).map(q => q.id);
      expect(sorted(filterQuestions(projected, { subtopics: [section.displayTitle] }).map(q => q.id)), section.code).toEqual(sorted(expected));
      for (const q of raw.questions) expect(rows.get(q.id)?.statementCodes.includes(section.code)).toBe(project0606Sections(q).codes.includes(section.code));
    }
    expect(filterQuestions(loadBankQuestions("igcse-additional"), { subtopics: ["Calculus"] })).toHaveLength(454);
  });
});
