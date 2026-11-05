import { describe, expect, it } from "vitest";
import retrieval from "@/data/igcse-0580-section-retrieval-v3.json";
import { buildPack as buildPackUntyped, findResearchDir, loadSources, PACK_BYTES_TARGET, QUESTIONS_PER_PACK } from "./build-source-pack-0580.mjs";

// The packs read private sources in ../research; skip where that folder is absent (CI, other machines).
const researchDir = findResearchDir();

// The builder is untyped JavaScript; read its packs loosely.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const buildPack = buildPackUntyped as (code: string, sources: unknown) => any;

type Block = { code: string; taggedTotal: number; paperCounts: Record<string, number>; questions: { id: string; paper: string }[] };

describe.skipIf(!researchDir)("build-source-pack-0580", () => {
  const sources = researchDir ? loadSources(researchDir) : null;
  // Number (both tiers), statistics (both tiers, one tier thin) and an Extended-only section.
  const codes = ["1.13", "9.3", "2.12"];
  const packs = new Map(codes.map((code) => [code, sources ? buildPack(code, sources) : null]));
  const tierOfPaper = (id: string) => (/-[13]\d-q/.test(id) ? "Core" : "Extended");

  it("counts every tagged question per paper, before selection", () => {
    for (const code of codes) {
      const pack = packs.get(code)!;
      for (const [tier, block] of (Object.entries(pack.questions) as [string, Block][]).filter(([key]) => key !== "label")) {
        const tagged = retrieval.rows.filter((row) => row.sectionCodes.includes(block.code) && sources!.bank.has(row.id));
        const expected: Record<string, number> = {};
        for (const row of tagged) {
          const paper = `P${sources!.bank.get(row.id).paper}`;
          expected[paper] = (expected[paper] ?? 0) + 1;
        }
        const nonZero = Object.fromEntries(Object.entries(block.paperCounts).filter(([, count]) => count > 0));
        expect(nonZero, `${code} ${tier}`).toEqual(expected);
        expect(block.taggedTotal, `${code} ${tier}`).toBe(tagged.length);
        expect(Object.values(block.paperCounts).reduce((a, b) => a + b, 0), `${code} ${tier}`).toBe(block.taggedTotal);
        // Selection takes at most the per-pack budget, so the counts must exceed what was picked for these busy sections.
        expect(block.taggedTotal, `${code} ${tier}`).toBeGreaterThanOrEqual(block.questions.length);
      }
    }
  });

  it("selects only questions tagged to this section, on the tier's own papers, within the budget", () => {
    for (const code of codes) {
      const pack = packs.get(code)!;
      let total = 0;
      for (const [tier, block] of (Object.entries(pack.questions) as [string, Block][]).filter(([key]) => key !== "label")) {
        for (const question of block.questions) {
          const row = retrieval.rows.find((candidate) => candidate.id === question.id);
          expect(row?.sectionCodes, `${code} ${question.id}`).toContain(block.code);
          expect(tierOfPaper(question.id), `${code} ${question.id}`).toBe(tier);
          expect(tier === "Core" ? ["P1", "P3"] : ["P2", "P4"]).toContain(question.paper);
        }
        total += block.questions.length;
      }
      expect(total, code).toBeLessThanOrEqual(QUESTIONS_PER_PACK);
      expect(total, code).toBeGreaterThan(0);
    }
  });

  it("stays under the size target", () => {
    for (const code of codes) expect(Buffer.byteLength(JSON.stringify(packs.get(code), null, 2)), code).toBeLessThan(PACK_BYTES_TARGET);
  });

  it("gives an Extended-only section no Core questions and marks Extended-only notes to teach", () => {
    const extendedOnly = packs.get("2.12")!;
    expect(extendedOnly.section.coreCode).toBeNull();
    expect(extendedOnly.questions.Core).toBeUndefined();
    expect(extendedOnly.questions.Extended.questions.length).toBe(QUESTIONS_PER_PACK);
    const notes = packs.get("1.13")!.section.notes;
    expect(notes.filter((note: { scope: string; teach?: string }) => note.scope === "Extended only").every((note: { teach?: string }) => note.teach === "Extended content to teach")).toBe(true);
    expect(notes.some((note: { text: string }) => note.text.startsWith("Extended only"))).toBe(false);
  });

  it("carries the calculator rules, the relevant formulas and glossary ownership", () => {
    const pack = packs.get("1.13")!;
    expect(pack.assessment.papers.map((paper: { paper: string; calculator: boolean }) => [paper.paper, paper.calculator])).toEqual([
      ["P1", false],
      ["P2", false],
      ["P3", true],
      ["P4", true],
    ]);
    expect(pack.formulaList).toEqual([]);
    expect(buildPack("2.5", sources!).formulaList.map((entry: { printedOn: string }) => entry.printedOn)).toEqual(["Extended list only"]);
    for (const term of pack.glossary.owns) expect(sources!.glossary.find((entry: { id: string }) => entry.id === term.id).owner).toBe("1.13");
    expect(pack.mistakes.entries.length).toBeLessThanOrEqual(12);
  });
});
