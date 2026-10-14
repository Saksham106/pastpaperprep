import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import receipt from "../../docs/igcse-0606-2026-march-addition.json";
import plan from "../../docs/igcse-0606-2026-march-r2-upload-plan.json";
import { getBank } from "@/lib/banks";
import { isPreviewQuestion } from "@/lib/access";
import { loadBankQuestions } from "@/lib/question-fixtures";
import { filterQuestions } from "@/lib/question-filter";
import { ADDED_0606_QUESTION_IDS, BASE_0606_RAW_SHA256, split0606Raw } from "@/lib/igcse-0606-additions.mjs";
import { metadataFromRaw } from "../../scripts/generate-bank-index.mjs";

const RAW_PATH = "src/data/raw/igcse-additional.json";
const TRANSCRIPTS_PATH = "docs/igcse-0606-2026-march-transcripts.json";
// C0 and C1 controls (the delivered PDF text carried barcode bytes U+0001 to U+0008).
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f]/;
const transcripts = JSON.parse(readFileSync(TRANSCRIPTS_PATH, "utf8")) as {
  supersedes: { sha256: string };
  rows: Array<{ id: string; deliveredTextSha256: string; questionImageSha256: string; accessibleText: string }>;
};
const sha = (bytes: Buffer | string) => createHash("sha256").update(bytes).digest("hex");
const rawBytes = readFileSync(RAW_PATH);
const raw = JSON.parse(rawBytes.toString("utf8"));
type Row = { id: string; paperId: string; accessibleText: string; reviewStatus: string; questionImages: string[]; markschemeImages: string[] };

describe("0606 Feb/March 2026 reviewed addition", () => {
  it("is the pinned 1,633-row historical bank plus exactly 23 delivered rows and 2 papers", () => {
    expect(sha(rawBytes)).toBe(receipt.merged.rawSha256);
    expect(BASE_0606_RAW_SHA256).toBe("4d385d4ee951a313608075415b95e5e7fb63805823760328b1853c3e145ce87f");
    const { base, added, addedPapers } = split0606Raw(raw);
    expect(base.questions).toHaveLength(1633);
    expect(base.papers).toHaveLength(145);
    expect(added.map((row: Row) => row.id)).toEqual(receipt.addedQuestionIds);
    expect(addedPapers.map((paper: { id: string }) => paper.id)).toEqual(["0606-2026-march-12", "0606-2026-march-22"]);
    expect(raw.questions).toHaveLength(1656);
    expect(raw.papers).toHaveLength(147);
    expect(receipt.questionsByPaper).toEqual({ "0606-2026-march-12": 12, "0606-2026-march-22": 11 });
    expect(receipt.marksByPaper).toEqual({ "0606-2026-march-12": 80, "0606-2026-march-22": 80 });
    expect(receipt.source.appAdditionsSha256).toBe("890ab91dc2868ad11081809d8958635b29ad9f30282e62b4f3ab625b48f8b091");
  });

  it("fails closed when a historical or added row changes", () => {
    const historical = structuredClone(raw);
    historical.questions[30].marks += 1;
    expect(() => split0606Raw(historical)).toThrow(/historical base drift/);
    const addition = structuredClone(raw);
    addition.questions[0].subtopics = ["Calculus"];
    expect(() => split0606Raw(addition)).toThrow(/addition rows drift/);
    const moved = structuredClone(raw);
    moved.questions.push(moved.questions.shift());
    expect(() => split0606Raw(moved)).toThrow(/drift/);
  });

  it("keeps the delivered review status and serves the pinned reviewed transcripts without relabelling history", () => {
    const { base, added } = split0606Raw(raw);
    expect(new Set(added.map((row: Row) => row.reviewStatus))).toEqual(new Set(["source-structured-draft"]));
    expect(new Set(base.questions.map((row: Row) => row.reviewStatus))).toEqual(new Set(["independently-reviewed"]));
    expect(receipt.accessibleTextOverlay).toMatchObject({ path: TRANSCRIPTS_PATH, rowCount: 23 });
    expect(sha(readFileSync(TRANSCRIPTS_PATH)), TRANSCRIPTS_PATH).toBe(receipt.accessibleTextOverlay.sha256);
    expect(transcripts.supersedes.sha256).toBe(receipt.source.appAdditionsSha256);
    expect(transcripts.rows.map((entry) => entry.id)).toEqual(receipt.addedQuestionIds);
    for (const row of added as Row[]) {
      const pinned = receipt.rows.find((entry) => entry.id === row.id)!;
      const transcript = transcripts.rows.find((entry) => entry.id === row.id)!;
      expect(row.accessibleText, row.id).toBe(transcript.accessibleText);
      expect(sha(row.accessibleText), row.id).toBe(pinned.sourceTextSha256);
      expect(transcript.deliveredTextSha256, row.id).toBe(pinned.deliveredTextSha256);
      expect(transcript.questionImageSha256, row.id).toBe(pinned.questionImageSha256);
    }
  });

  it("serves screen-reader text without control characters and with faithful notation", () => {
    const { added } = split0606Raw(raw);
    const served = loadBankQuestions("igcse-additional").filter((row) => ADDED_0606_QUESTION_IDS.includes(row.id));
    expect(served).toHaveLength(23);
    const strings = (value: unknown): string[] => typeof value === "string" ? [value]
      : Array.isArray(value) ? value.flatMap(strings)
        : value && typeof value === "object" ? Object.values(value).flatMap(strings) : [];
    for (const row of [...added, ...served] as Array<Row & { number: number; marks: number }>) {
      for (const text of strings(row)) expect(CONTROL_CHARACTERS.test(text), `${row.id}: ${JSON.stringify(text)}`).toBe(false);
    }
    for (const row of added as Array<Row & { number: number; marks: number }>) {
      expect(row.accessibleText.startsWith(`${row.number} `), row.id).toBe(true);
      const marks = [...row.accessibleText.matchAll(/\[(\d+)\]/g)].reduce((sum, match) => sum + Number(match[1]), 0);
      expect(marks, row.id).toBe(row.marks);
    }
    const q2 = served.find((row) => row.id === "0606-2026-march-12-q2")!;
    for (const text of [q2.accessibleText, q2.summary]) {
      expect(text).toContain("y = |x^2 - 2x - 3|");
      expect(text).not.toContain("y x x 2 3 2 = - -");
    }
    expect(q2.accessibleText).toContain("g(x) = 4e^(x-2) - 1 for all real x");
    expect(q2.accessibleText).toContain("Find an expression for g^-1(x). [2]");
    expect(q2.accessibleText).toMatch(/^2 \(a\) On the axes, sketch the graph of y = \|x\^2 - 2x - 3\|\. State the intercepts with the coordinate axes\. \[4\]/);
  });

  it("serves the added papers through the catalog, runtime filters and public index", () => {
    expect(getBank("igcse-additional")).toMatchObject({ questionCount: 1656, paperCount: 147 });
    const rows = loadBankQuestions("igcse-additional");
    const march = filterQuestions(rows, { years: ["2026"], sessions: ["February/March"] })
      .filter((row) => ADDED_0606_QUESTION_IDS.includes(row.id));
    expect(march).toHaveLength(23);
    for (const row of raw.questions.slice(0, 23)) {
      const index = metadataFromRaw(row, { bank: "igcse-additional" });
      expect(index.id).toBe(row.id);
      expect(index.subtopics).toEqual(expect.arrayContaining(row.subtopics));
      expect((index.officialCodeRefs ?? []).length, row.id).toBeGreaterThan(0);
    }
  });

  it("pins the reviewed statement input, print geometry and the executed R2 plan", () => {
    for (const artifact of [receipt.numberedStatementReview, receipt.printGeometry, receipt.r2UploadPlan]) {
      expect(sha(readFileSync(artifact.path)), artifact.path).toBe(artifact.sha256);
    }
    // Uploaded and read back on 13 October 2026; the status is derived from the committed readback log.
    expect(plan).toMatchObject({ mode: "executed-upload-plan", status: "UPLOADED AND VERIFIED", bucket: "pastpaperprep-assets", objectCount: 46, upload: { objects: 46, createdNew: 46, overwritten: 0, readbackLog: "docs/2026-paper-gaps-r2-upload-log.jsonl" } });
    const rows = loadBankQuestions("igcse-additional").filter((row) => ADDED_0606_QUESTION_IDS.includes(row.id));
    const keys = rows.flatMap((row) => [...row.questionAssetPaths, ...row.markschemeAssetPaths]).sort();
    expect(plan.objects.map((object) => object.key).sort()).toEqual(keys);
    expect(rows.some((row) => isPreviewQuestion("igcse-additional", row.id))).toBe(false);
    for (const object of plan.objects) {
      const pinned = receipt.rows.find((entry) => entry.id === object.questionId)!;
      expect(object.sha256, object.key).toBe(object.kind === "question" ? pinned.questionImageSha256 : pinned.markschemeImageSha256);
    }
  });
});
