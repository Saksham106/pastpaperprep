import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { getControlledSubtopics } from "@/lib/taxonomy";

type Row = Record<string, any>;
const root = process.cwd();
const load = (path: string) => JSON.parse(readFileSync(resolve(root, path), "utf8"));
const sha = (value: unknown) => createHash("sha256").update(typeof value === "string" ? value : JSON.stringify(value)).digest("hex");

// IB Maths AI May 2026 official papers (additions to the 2021-2025 banks).
const LEVELS = {
  hl: { slug: "ib-ai-hl", before: { papers: 48, questions: 409 }, added: { papers: 9, questions: 75, marks: 825, perPaper: { p1: [16, 15, 16], p2: [7, 7, 8], p3: [2, 2, 2] } },
    historicalQuestionsSha256: "fd45f96ed12eb60a5be08c1a4f5e653ce46d2406b29407b0773774732e2a9c03", historicalPapersSha256: "31cc5f67e00dfbce75ab00142889ce8d558c08fc76934b995444e036d5ba3265",
    adjudicationSha256: "ec267c6c6fa0397293a1e6a95b2d517f6e76650e813723fd59ce2d477c3962fd", counts: { agree: 50, adjudicated: 25, lowConfidence: 0 }, paperMarks: { 1: 110, 2: 110, 3: 55 } },
  sl: { slug: "ib-ai-sl", before: { papers: 38, questions: 334 }, added: { papers: 6, questions: 52, marks: 480, perPaper: { p1: [13, 12, 12], p2: [5, 5, 5] } },
    historicalQuestionsSha256: "53b042fc70573ba8c72caf13bbf906df8354475f3a02e14d66cafe623993ff03", historicalPapersSha256: "1dae40a20a67cbde4afe2abda08a0ad96d8e9c8f84e23bb73239bd44b190e3cf",
    adjudicationSha256: "18fe354ab28346d092287ca2c2062215759a8361b955ecb75ae849044ff58365", counts: { agree: 39, adjudicated: 13, lowConfidence: 1 }, paperMarks: { 1: 80, 2: 80 } },
} as const;

describe.each(Object.entries(LEVELS))("IB Maths AI %s May 2026 official papers", (level, spec) => {
  const bank = load(`src/data/raw/${spec.slug}.json`);
  const questions = bank.questions as Row[];
  const papers = bank.papers as Row[];
  const added = questions.filter((q) => String(q.id).startsWith("2026-may-"));
  const historical = questions.filter((q) => !String(q.id).startsWith("2026-may-"));
  const review = load(`docs/audits/${spec.slug}-official-2026-review.json`);

  it("adds the official rows and leaves every existing row and paper byte-identical", () => {
    expect(historical).toHaveLength(spec.before.questions);
    expect(papers.filter((p) => !String(p.id).startsWith("2026-may-"))).toHaveLength(spec.before.papers);
    expect(sha(historical)).toBe(spec.historicalQuestionsSha256);
    expect(sha(papers.filter((p) => !String(p.id).startsWith("2026-may-")))).toBe(spec.historicalPapersSha256);
    expect(added).toHaveLength(spec.added.questions);
    expect(papers.filter((p) => String(p.id).startsWith("2026-may-"))).toHaveLength(spec.added.papers);
    expect(added.reduce((sum, q) => sum + q.marks, 0)).toBe(spec.added.marks);
    expect(new Set(questions.map((q) => q.id)).size).toBe(questions.length);
    for (const [paper, counts] of Object.entries(spec.added.perPaper)) {
      const number = Number(paper.slice(1));
      expect(["tz1", "tz2", "tz3"].map((tz) => added.filter((q) => q.id.startsWith(`2026-may-${tz}-p${number}-q`)).length), paper).toEqual(counts);
    }
  });

  it("uses official IB originals with official mark-scheme crops, never reconstructions or independent solutions", () => {
    for (const q of added) {
      expect(q.imageStatus, q.id).toBe("original");
      expect(q.independentSolution, q.id).toBe("");
      expect(q.officialMarkscheme?.images?.length, q.id).toBeGreaterThan(0);
      expect(q.questionImages.length, q.id).toBeGreaterThan(0);
      expect(q.markschemeTranscript?.length, q.id).toBeGreaterThan(20);
      expect(q.accessibleText.length, q.id).toBeGreaterThan(30);
      // Screen-reader text: no control, format or private-use characters (the transcript keeps the repo's existing convention).
      expect(/[\p{Cc}\p{Cf}\p{Co}]/u.test(q.accessibleText.replace(/\n/g, "")), q.id).toBe(false);
      expect(q.questionImages.every((p: string) => p.startsWith(`questions/${q.id}-page-`) && p.endsWith(".webp")), q.id).toBe(true);
      expect(q.officialMarkscheme.images.every((p: string) => p.startsWith(`markschemes/${q.id}-page-`) && p.endsWith(".webp")), q.id).toBe(true);
    }
    for (const p of papers.filter((paper) => String(paper.id).startsWith("2026-may-"))) {
      expect(p.source_url.startsWith("https://papers.xtremepape.rs/IB/2026%20Examination%20Session/May%202026%20Examination%20Session/Mathematics/"), p.id).toBe(true);
      expect(p.markscheme_url, p.id).toMatch(/_markscheme\.pdf$/);
      expect(added.filter((q) => q.id.startsWith(`${p.id}-q`)).length, p.id).toBe(p.question_count);
    }
  });

  it("classifies every row from the adjudicated, controlled taxonomy and matches the review receipt", () => {
    expect(review.manifestVersion).toBe(`${spec.slug}-official-2026-review.1`);
    expect(review.adjudicationSha256).toBe(spec.adjudicationSha256);
    expect(review.counts).toEqual(spec.counts);
    expect(review.reviewedQuestionCount).toBe(spec.added.questions);
    expect(Object.keys(review.corrections).sort()).toEqual(added.map((q) => q.id).sort());
    for (const q of added) {
      const selected = [q.primaryTopic, ...q.secondaryTopics];
      const owned = new Set(selected.flatMap((topic: string) => getControlledSubtopics(spec.slug, topic)));
      expect(q.skills.length, q.id).toBeGreaterThan(0);
      expect(q.skills.every((skill: string) => owned.has(skill)), q.id).toBe(true);
      expect(selected.every((topic: string) => q.skills.some((skill: string) => getControlledSubtopics(spec.slug, topic).includes(skill))), q.id).toBe(true);
      expect(q.subtopics).toEqual(q.skills);
      expect(q.classificationVersion).toBe(`${spec.slug}-may-2026-addition.1`);
      expect(q.classificationReviewStatus).toBe("manually-reviewed");
      expect(q.classificationEvidence.provenance.adjudicationSha256).toBe(spec.adjudicationSha256);
      expect(review.corrections[q.id]).toEqual({
        primaryTopic: q.primaryTopic, subtopics: q.subtopics, secondaryTopics: q.secondaryTopics,
        sourceTextSha256: sha(q.accessibleText), confidence: q.classificationConfidence, status: q.classificationEvidence.provenance.status,
      });
    }
    // Only one addition is low confidence anywhere: AI SL TZ2 Paper 2 Q1 (both passes low, closest fit kept, flagged to the owner).
    expect(added.filter((q) => q.classificationConfidence === "low").map((q) => q.id)).toEqual(level === "sl" ? ["2026-may-tz2-p2-q1"] : []);
  });

  it("adds every May 2026 paper to the whole-paper archive with an official pair and reconciled marks", () => {
    const manifest = load(`src/data/paper-archives/${spec.slug}.json`);
    const entries = manifest.papers.filter((p: Row) => p.summary.year === 2026);
    expect(manifest.papers).toHaveLength(spec.before.papers + spec.added.papers);
    expect(entries).toHaveLength(spec.added.papers);
    expect(manifest.runtimeSha256).toBe(sha256File(`src/data/raw/${spec.slug}.json`));
    expect(manifest.coverage).toMatchObject({ paired: manifest.papers.length, unpaired: 0, runtimeWithoutPair: 0 });
    for (const entry of entries) {
      const ids = added.filter((q) => q.id.startsWith(`${entry.summary.id}-q`)).map((q) => q.id);
      expect(entry.summary.reportAvailable, entry.summary.id).toBe(true);
      expect(entry.summary.maxMarks, entry.summary.id).toBe((spec.paperMarks as Record<number, number>)[Number(entry.summary.paper)]);
      expect(entry.questions.map((q: Row) => q.id), entry.summary.id).toEqual(ids);
      expect(entry.questions.reduce((sum: number, q: Row) => sum + q.maxMarks, 0), entry.summary.id).toBe(entry.summary.maxMarks);
    }
  });
});

function sha256File(path: string) {
  return createHash("sha256").update(readFileSync(resolve(root, path))).digest("hex");
}
