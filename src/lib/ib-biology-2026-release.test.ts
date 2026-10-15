import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import hlArchive from "@/data/paper-archives/ib-biology-hl.json";
import slArchive from "@/data/paper-archives/ib-biology-sl.json";
import { buildAssetRetentionPlan } from "@/lib/asset-retention";
import { loadBankQuestions } from "@/lib/question-fixtures";
import { REVIEWED_MCQ_ANSWER_LETTERS } from "@/lib/mcq-answer-letters";

const ROOT = process.cwd();
const BANKS = ["ib-biology-hl", "ib-biology-sl"] as const;
// Served rows and crops. HL's source has 161 questions and 383 uploaded crops; 2026-may-tz1-hl-p1b-q2 (3 crops) is withheld.
const COUNTS = { "ib-biology-hl": { questions: 160, papers: 9, mcq: 120, crops: 380 }, "ib-biology-sl": { questions: 123, papers: 9, mcq: 90, crops: 295 } } as const;
const WITHHELD_ID = "2026-may-tz1-hl-p1b-q2";
const read = (path: string) => JSON.parse(readFileSync(join(ROOT, path), "utf8"));

describe("IB Biology May 2026 official papers", () => {
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

  it("has an exact crop plan, recorded as uploaded, that equals the app's own 2026 asset paths plus the withheld question's crops", () => {
    const plan = read("docs/ib-biology-may-2026/r2-upload-plan-assets.json");
    expect(plan.status).toMatch(/^UPLOADED AND READ BACK/);
    expect(plan.method).toMatch(/not an atomic create/i);
    expect(plan.method).not.toMatch(/create-only/i);
    expect(plan.bucket).toBe("pastpaperprep-assets");
    expect(plan.objectCount).toBe(678);
    expect(plan.objects).toHaveLength(678);
    expect(new Set(plan.objects.map((object: { key: string }) => object.key)).size).toBe(678);
    expect(plan.objects.every((object: { sha256: string; bytes: number }) => /^[a-f0-9]{64}$/.test(object.sha256) && object.bytes > 0)).toBe(true);
    expect(plan.totalBytes).toBe(plan.objects.reduce((sum: number, object: { bytes: number }) => sum + object.bytes, 0));
    const app = new Set<string>();
    for (const slug of BANKS) {
      const rows = loadBankQuestions(slug).filter((question) => question.year === 2026);
      const paths = buildAssetRetentionPlan([{ slug, questions: rows }]).allPaths;
      expect(paths.size).toBe(COUNTS[slug].crops);
      for (const path of paths) app.add(path);
    }
    const withheld = plan.objects.filter((object: { withheldFromPractice?: boolean }) => object.withheldFromPractice);
    expect(withheld.map((object: { questionId: string }) => object.questionId)).toEqual([WITHHELD_ID, WITHHELD_ID, WITHHELD_ID]);
    expect(plan.servedObjectCount).toBe(675);
    expect(plan.withheldFromPractice).toMatchObject({ questionIds: [WITHHELD_ID], objectCount: 3 });
    for (const object of withheld) expect(app.has(object.key), object.key).toBe(false);
    expect(new Set(plan.objects.map((object: { key: string }) => object.key))).toEqual(new Set([...app, ...withheld.map((object: { key: string }) => object.key)]));
    // The 678 uploads are all recorded as verified; the withheld crops stay in storage, untouched.
    const log = readFileSync(join(ROOT, "docs/ib-biology-may-2026/r2-upload-log-assets.jsonl"), "utf8").trim().split("\n").map((line) => JSON.parse(line));
    expect(log).toHaveLength(678);
    expect(log.every((entry: { status: string }) => entry.status === "verified")).toBe(true);
    const logged = new Map(log.map((entry: { key: string; sha256: string; bytes: number }) => [entry.key, `${entry.sha256}:${entry.bytes}`]));
    for (const object of plan.objects) expect(logged.get(object.key), object.key).toBe(`${object.sha256}:${object.bytes}`);
  });

  it("withholds the graph-dependent HL Paper 1B Q2: recorded with a source-bound reason, counted, never served", () => {
    const hl = read("src/data/raw/ib-biology-hl.json");
    expect(hl.questions.some((row: { id: string }) => row.id === WITHHELD_ID)).toBe(false);
    expect(loadBankQuestions("ib-biology-hl").some((question) => question.id === WITHHELD_ID)).toBe(false);
    const release = hl.may2026Release;
    expect(release).toMatchObject({ sourceQuestionCount: 161, addedQuestionCount: 160, excludedQuestionCount: 1, combinedQuestionCount: 2071 });
    expect(release.excludedFromPractice).toHaveLength(1);
    const [row] = release.excludedFromPractice;
    expect(row).toMatchObject({ id: WITHHELD_ID, disposition: "excluded_from_practice", sourceStatus: "source_graph_removed_for_copyright" });
    expect(row.reason).toMatch(/Removed for copyright reasons/);
    expect(row.source).toMatchObject({ questionPaperPage: 5, affectedParts: "(a)(i)-(ii)", affectedMarks: 3, printedMarks: 8, questionCropSha256: "1d2c300c1d51eb2623f77a6228f6324fe12f90db6c8202f9840bf4e408fa874f" });
    // The printed maxima are untouched: the paper still prints Q2 as 8 marks and 35 in all.
    const entry = hlArchive.papers.find((paper) => paper.summary.id === "biology-2026-may-tz1-hl-p1b-english")!;
    expect(entry.summary.maxMarks).toBe(35);
    expect(entry.documents.question.sha256).toBe(row.source.questionPaperSha256);
    expect(entry.documents.markscheme.sha256).toBe(row.source.markschemeSha256);
    // The row stays reviewed and labelled, outside the served overlay.
    const review = read("docs/audits/ib-biology-may-2026-review.json");
    expect(review.withheldRows.map((r: { id: string }) => r.id)).toEqual([WITHHELD_ID]);
    expect(review.rows.some((r: { id: string }) => r.id === WITHHELD_ID)).toBe(false);
    const sl = read("src/data/raw/ib-biology-sl.json");
    expect(sl.may2026Release).toMatchObject({ sourceQuestionCount: 123, addedQuestionCount: 123, excludedQuestionCount: 0, excludedFromPractice: [] });
  });

  it("holds the Full past papers report of that paper, bound to both PDFs, and leaves every other 2026 report as before", () => {
    const holds = read("data/paper-archives/report-holds.json").holds as { bankSlug: string; paperId: string; questionSha256: string; markschemeSha256: string; reason: string }[];
    const hold = holds.find((entry) => entry.paperId === "biology-2026-may-tz1-hl-p1b-english")!;
    expect(hold.bankSlug).toBe("ib-biology-hl");
    expect(hold.reason).toMatch(/graph is missing/);
    const entry = hlArchive.papers.find((paper) => paper.summary.id === hold.paperId)!;
    expect(entry.documents.question.sha256).toBe(hold.questionSha256);
    expect(entry.documents.markscheme.sha256).toBe(hold.markschemeSha256);
    expect(entry.summary).toMatchObject({ reportAvailable: false, reportReason: hold.reason, maxMarks: 35, questionCount: 4 });
    expect(entry.questions).toEqual([]);
    // Held, not removed: both PDFs are still in the manifest, so both stay downloadable.
    expect(entry.documents.question.bytes).toBeGreaterThan(0);
    expect(entry.documents.markscheme.bytes).toBeGreaterThan(0);
    for (const archive of [hlArchive, slArchive]) {
      for (const paper of archive.papers.filter((p) => p.summary.year === 2026 && p.summary.id !== hold.paperId)) {
        expect(paper.summary.reportAvailable, paper.summary.id).toBe(paper.summary.component !== "P2");
      }
    }
  });

  it("has a PDF plan, recorded as uploaded, for exactly the 36 papers the manifests newly approve", () => {
    const plan = read("docs/ib-biology-may-2026/r2-upload-plan-free-papers.json");
    expect(plan.status).toMatch(/^UPLOADED AND READ BACK/);
    expect(plan.method).not.toMatch(/create-only/i);
    expect(plan.method).toMatch(/not an atomic create/i);
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
    for (const [archive, bank] of [[hlArchive, "ib-biology-hl"], [slArchive, "ib-biology-sl"]] as const) {
      const added = archive.papers.filter((entry) => entry.summary.year === 2026);
      expect(added).toHaveLength(COUNTS[bank].papers);
      expect(archive.coverage.paired).toBe(archive.papers.length);
      // Papers 1A and 1B are self-markable; Paper 2 stays held for its optional-question choices, and HL TZ1 Paper 1B
      // is held for its missing graph (next test).
      for (const paper of added) {
        if (paper.summary.id === "biology-2026-may-tz1-hl-p1b-english") continue;
        const held = paper.summary.component === "P2";
        expect(paper.summary.reportAvailable, paper.summary.id).toBe(!held);
        if (held) expect(paper.summary.reportReason).toBe("Optional question choices need review.");
      }
    }
  });

  it("records the reviewed label of every added row", () => {
    const review = read("docs/audits/ib-biology-may-2026-review.json");
    expect(review.reviewedQuestionCount).toBe(283);
    expect(review.rows).toHaveLength(283);
    expect(review.withheldQuestionCount).toBe(1);
    expect(review.rows.length + review.withheldRows.length).toBe(284);
    expect(review.rows.every((row: { codes: string[]; groups: string[] }) => row.codes.length > 0 && row.groups.length > 0)).toBe(true);
  });
});
