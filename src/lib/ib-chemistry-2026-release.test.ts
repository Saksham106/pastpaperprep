import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import hlArchive from "@/data/paper-archives/ib-chemistry-hl.json";
import slArchive from "@/data/paper-archives/ib-chemistry-sl.json";
import { buildAssetRetentionPlan } from "@/lib/asset-retention";
import { loadBankQuestions } from "@/lib/question-fixtures";
import { filterQuestions } from "@/lib/question-filter";
import { getControlledSubtopics } from "@/lib/taxonomy";
import { REVIEWED_MCQ_ANSWER_LETTERS } from "@/lib/mcq-answer-letters";

const ROOT = process.cwd();
const BANKS = ["ib-chemistry-hl", "ib-chemistry-sl"] as const;
const COUNTS = { "ib-chemistry-hl": { questions: 144, papers: 9, mcq: 120, crops: 409 }, "ib-chemistry-sl": { questions: 109, papers: 9, mcq: 90, crops: 288 } } as const;
const read = (path: string) => JSON.parse(readFileSync(join(ROOT, path), "utf8"));

describe("IB Chemistry May 2026 official papers", () => {
  it("adds every official question with its crops, topic, subtopic and mark-scheme image", () => {
    for (const bank of BANKS) {
      const rows = loadBankQuestions(bank).filter((question) => question.year === 2026);
      expect(rows).toHaveLength(COUNTS[bank].questions);
      for (const row of rows) {
        expect(row.primaryTopic, row.id).toBeTruthy();
        expect(row.subtopics.length, row.id).toBeGreaterThan(0);
        expect(row.questionAssetPaths.length, row.id).toBeGreaterThan(0);
        expect(row.markschemeAssetPaths.length, row.id).toBeGreaterThan(0);
        expect(row.classificationProvenance?.status, row.id).not.toBe("blocked");
      }
    }
  });

  it("gives every Paper 1A question its official letter and no other question one", () => {
    for (const bank of BANKS) {
      const letters = REVIEWED_MCQ_ANSWER_LETTERS.banks[bank] ?? {};
      const mcq = Object.keys(letters).filter((id) => id.startsWith("2026-"));
      expect(mcq).toHaveLength(COUNTS[bank].mcq);
      expect(mcq.every((id) => /-p1a-q\d+$/.test(id))).toBe(true);
    }
  });

  it("has an exact create-only crop plan that equals the app's own 2026 asset paths", () => {
    const plan = read("docs/ib-chemistry-may-2026/r2-upload-plan-assets.json");
    expect(plan.status).toMatch(/NOT UPLOADED/);
    expect(plan.bucket).toBe("pastpaperprep-assets");
    expect(plan.objectCount).toBe(697);
    expect(plan.objects).toHaveLength(697);
    expect(new Set(plan.objects.map((object: { key: string }) => object.key)).size).toBe(697);
    expect(plan.objects.every((object: { sha256: string; bytes: number }) => /^[a-f0-9]{64}$/.test(object.sha256) && object.bytes > 0)).toBe(true);
    expect(plan.totalBytes).toBe(plan.objects.reduce((sum: number, object: { bytes: number }) => sum + object.bytes, 0));
    const app = new Set<string>();
    for (const slug of BANKS) {
      const rows = loadBankQuestions(slug).filter((question) => question.year === 2026);
      const paths = buildAssetRetentionPlan([{ slug, questions: rows }]).allPaths;
      expect(paths.size).toBe(COUNTS[slug].crops);
      for (const path of paths) app.add(path);
    }
    expect(new Set(plan.objects.map((object: { key: string }) => object.key))).toEqual(app);
  });

  it("has a PDF plan for exactly the 36 papers the manifests newly approve", () => {
    const plan = read("docs/ib-chemistry-may-2026/r2-upload-plan-free-papers.json");
    expect(plan.status).toMatch(/NOT UPLOADED/);
    expect(plan.bucket).toBe("pastpaperprep-free");
    expect(plan.objects).toHaveLength(36);
    const hashes = new Set<string>();
    for (const archive of [hlArchive, slArchive]) {
      for (const paper of archive.papers.filter((entry) => entry.summary.year === 2026)) {
        hashes.add(paper.documents.question.sha256);
        hashes.add(paper.documents.markscheme.sha256);
      }
    }
    expect(new Set(plan.objects.map((object: { sha256: string }) => object.sha256))).toEqual(hashes);
    for (const object of plan.objects) expect(object.key).toBe(`papers/v1/${object.sha256}.pdf`);
  });

  it("adds 9 papers per level to Full past papers and leaves earlier entries alone", () => {
    for (const [archive, bank] of [[hlArchive, "ib-chemistry-hl"], [slArchive, "ib-chemistry-sl"]] as const) {
      const added = archive.papers.filter((entry) => entry.summary.year === 2026);
      expect(added).toHaveLength(COUNTS[bank].papers);
      expect(archive.coverage.paired).toBe(archive.papers.length);
      // Every 2026 paper (1A, 1B and 2) has no optional questions and is self-markable.
      for (const paper of added) {
        expect(paper.summary.reportAvailable, paper.summary.id).toBe(true);
        expect(paper.questions.length, paper.summary.id).toBe(paper.summary.questionCount);
      }
    }
  });

  it("records the reviewed label of every added row", () => {
    const review = read("docs/audits/ib-chemistry-may-2026-review.json");
    expect(review.reviewedQuestionCount).toBe(253);
    expect(review.rows).toHaveLength(253);
    expect(review.rows.every((row: { codes: string[]; primary: string }) => row.codes.length > 0 && Boolean(row.primary))).toBe(true);
  });

  // Post-review additions: separately credited parts whose concept the stored labels did not retrieve.
  it("retrieves rows by the secondary topic/subtopic of a separately credited part through the real normalization and filter path", () => {
    const MOLE = ["Matter, amounts and stoichiometry", "The mole and reacting quantities"] as const;
    const GIBBS = ["Energetics, thermodynamics and fuels", "Entropy, Gibbs energy and spontaneity"] as const;
    const cases = [
      { bank: "ib-chemistry-sl", id: "2026-may-tz1-sl-p2-q4", primary: "Acids and bases", via: MOLE },
      { bank: "ib-chemistry-hl", id: "2026-may-tz1-hl-p2-q4", primary: "Acids and bases", via: MOLE },
      { bank: "ib-chemistry-hl", id: "2026-may-tz1-hl-p1b-q2", primary: "Measurement, data and practical work", via: MOLE },
      { bank: "ib-chemistry-hl", id: "2026-may-tz2-hl-p1a-q40", primary: "Redox and electrochemistry", via: GIBBS },
    ] as const;
    for (const { bank, id, primary, via } of cases) {
      const [topic, subtopic] = via;
      const all = loadBankQuestions(bank);
      const row = all.find((question) => question.id === id)!;
      expect(row.primaryTopic, id).toBe(primary);
      expect(getControlledSubtopics(bank, topic), id).toContain(subtopic);
      for (const filters of [{ topics: [topic] }, { subtopics: [subtopic] }, { topics: [topic], subtopics: [subtopic] }, { topics: [topic], years: ["2026"] }]) {
        expect(filterQuestions(all, filters).map((question) => question.id), `${id} ${JSON.stringify(filters)}`).toContain(id);
      }
    }
  });
});
