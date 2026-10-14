import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import receipt from "../../docs/igcse-0580-2026-core-addition.json";
import plan from "../../docs/igcse-0580-2026-core-r2-upload-plan.json";
import review from "../../docs/0580-2026-core-addition-sections-v4.json";
import overlay from "@/data/igcse-0580-section-retrieval-v3.json";
import { getBank } from "@/lib/banks";
import { isPreviewQuestion } from "@/lib/access";
import { matchesCourseRoute } from "@/lib/course-route";
import { loadBankQuestions } from "@/lib/question-fixtures";
import { filterQuestions } from "@/lib/question-filter";
import { project0580Sections } from "@/lib/igcse-0580-section-retrieval-v3.mjs";
import { ADDED_0580_QUESTION_IDS, BASE_0580_RAW_SHA256, reconstruct0580BaseText, split0580Raw } from "@/lib/igcse-0580-additions.mjs";
import { metadataFromRaw } from "../../scripts/generate-bank-index.mjs";

const RAW_PATH = "src/data/raw/igcse.json";
const sha = (bytes: Buffer | string) => createHash("sha256").update(bytes).digest("hex");
const rawBytes = readFileSync(RAW_PATH);
const rawText = rawBytes.toString("utf8");
const raw = JSON.parse(rawText);
type Row = { id: string; paperId: string; year: number; route?: string; accessibleText: string; reviewStatus: string; questionImages: string[]; markschemeImages: string[]; subtopics: string[]; classificationEvidence: { model: string } };
const UNRESOLVED = ["0580-2026-june-12-q4", "0580-2026-march-32-q2"];

describe("0580 Core 2026 reviewed addition", () => {
  it("is the pinned 3,967-row historical bank plus exactly 207 delivered rows and 8 papers", () => {
    expect(sha(rawBytes)).toBe(receipt.merged.rawSha256);
    expect(BASE_0580_RAW_SHA256).toBe("74f919b57dfba129a6c523da09148e3cd3347f7972aa5b7b4808630f5abe814b");
    // Byte-level: cutting the three inserted blocks out of the text restores the historical file.
    expect(sha(reconstruct0580BaseText(rawText))).toBe(BASE_0580_RAW_SHA256);
    const { base, added, addedPapers } = split0580Raw(raw);
    expect(base.questions).toHaveLength(3967);
    expect(base.papers).toHaveLength(217);
    expect(added.map((row: Row) => row.id)).toEqual(receipt.addedQuestionIds);
    expect(addedPapers.map((paper: { id: string }) => paper.id)).toEqual(receipt.paperIds);
    expect(raw.questions).toHaveLength(4174);
    expect(raw.papers).toHaveLength(225);
    expect(receipt.questionsByPaper).toEqual({
      "0580-2026-june-11": 23, "0580-2026-june-12": 29, "0580-2026-june-13": 23, "0580-2026-june-31": 28,
      "0580-2026-june-32": 26, "0580-2026-june-33": 26, "0580-2026-march-12": 27, "0580-2026-march-32": 25,
    });
    expect(Object.values(receipt.marksByPaper)).toEqual(Array(8).fill(80));
    expect(added.every((row: Row) => row.route === "Core" && row.year === 2026)).toBe(true);
  });

  it("fails closed when a historical or added row changes or moves", () => {
    const historical = structuredClone(raw);
    historical.questions[0].marks += 1;
    expect(() => split0580Raw(historical)).toThrow(/historical base drift/);
    const addition = structuredClone(raw);
    addition.questions[receipt.insertion.questionStartIndex].subtopics = ["Calculus"];
    expect(() => split0580Raw(addition)).toThrow(/addition rows drift/);
    const moved = structuredClone(raw);
    moved.questions.push(moved.questions.splice(receipt.insertion.questionStartIndex, 1)[0]);
    expect(() => split0580Raw(moved)).toThrow(/drift/);
    const header = structuredClone(raw);
    header.coreClassificationArtifacts[1].rows = 206;
    expect(() => split0580Raw(header)).toThrow(/header drift/);
    expect(() => reconstruct0580BaseText(rawText.replace('"marks": 5,', '"marks": 6,'))).toThrow(/historical base drift/);
  });

  it("keeps the honest manual-review provenance and source text hashes without relabelling history", () => {
    const { base, added } = split0580Raw(raw);
    expect(new Set(added.map((row: Row) => row.reviewStatus))).toEqual(new Set(["manually-classified-mvp"]));
    expect(new Set(added.map((row: Row) => row.classificationEvidence.model))).toEqual(new Set(["manual-two-pass-review-v1"]));
    expect(base.questions.some((row: Row) => row.reviewStatus === "manually-classified-mvp")).toBe(false);
    for (const row of added as Row[]) {
      const pinned = receipt.rows.find((entry) => entry.id === row.id)!;
      expect(sha(row.accessibleText), row.id).toBe(pinned.sourceTextSha256);
    }
  });

  it("serves 207 questions across the 8 papers for year 2026 + Core through the catalog, filters and public index", () => {
    expect(getBank("igcse")).toMatchObject({ questionCount: 4174, paperCount: 225 });
    const rows = loadBankQuestions("igcse");
    const core2026 = filterQuestions(rows, { years: ["2026"] }).filter((row) => matchesCourseRoute(row.syllabusRoute, "core"));
    expect(core2026.map((row) => row.id).sort()).toEqual([...ADDED_0580_QUESTION_IDS].sort());
    expect(new Set(core2026.map((row) => row.id.replace(/-q\d+$/, "")))).toEqual(new Set(receipt.paperIds));
    const { added } = split0580Raw(raw);
    for (const row of added as Row[]) {
      const index = metadataFromRaw(row, { bank: "igcse" });
      expect(index.id).toBe(row.id);
      expect(index.subtopics).toEqual(expect.arrayContaining(row.subtopics));
      if (!UNRESOLVED.includes(row.id)) expect((index.officialCodeRefs ?? []).length, row.id).toBeGreaterThan(0);
    }
  });

  it("links each reviewed row to exactly its reviewed Core statements with model-review provenance", () => {
    const { added } = split0580Raw(raw);
    expect(review.reviews.map((entry) => entry.id)).toEqual(receipt.addedQuestionIds);
    for (const entry of review.reviews) {
      const row = added.find((candidate: Row) => candidate.id === entry.id);
      const codes = [...new Set(entry.parts.flatMap((part) => part.codes))].sort();
      const result = project0580Sections(row);
      if (entry.disposition === "unresolved") {
        // Fail closed exactly like existing unresolved rows: legacy topic retrieval only.
        expect(codes, entry.id).toEqual([]);
        expect(result, entry.id).toBeNull();
        continue;
      }
      if (!result) throw new Error(`Missing reviewed projection: ${entry.id}`);
      expect(codes.every((code) => /^C\d+\.\d+$/.test(code)), entry.id).toBe(true);
      expect(result.codeRefs.filter((ref: string) => ref.startsWith("current_2025:")).map((ref: string) => ref.slice(13)).sort(), entry.id).toEqual(codes);
      expect(result.codeRefs.filter((ref: string) => !ref.startsWith("current_2025:")).every((ref: string) => ref.startsWith("source_image_model_0580_v4:")), entry.id).toBe(true);
    }
    expect(review.reviews.filter((entry) => entry.disposition === "unresolved").map((entry) => entry.id)).toEqual(UNRESOLVED);
    expect(overlay.rows.filter((row) => ADDED_0580_QUESTION_IDS.includes(row.id))).toHaveLength(205);
    expect(overlay.additions).toEqual([expect.objectContaining({ addition: "0580-2026-core", linkedRows: 205, unresolvedIds: UNRESOLVED })]);
  });

  it("pins the reviewed statement input, print geometry and the executed R2 plan", () => {
    for (const artifact of [receipt.numberedStatementReview!, receipt.printGeometry!, receipt.r2UploadPlan]) {
      expect(sha(readFileSync(artifact.path)), artifact.path).toBe(artifact.sha256);
    }
    // Uploaded and read back on 13 October 2026; the status is derived from the committed readback log.
    expect(plan).toMatchObject({ mode: "executed-upload-plan", status: "UPLOADED AND VERIFIED", bucket: "pastpaperprep-assets", objectCount: 414, upload: { objects: 414, createdNew: 414, overwritten: 0, readbackLog: "docs/2026-paper-gaps-r2-upload-log.jsonl" } });
    const rows = loadBankQuestions("igcse").filter((row) => ADDED_0580_QUESTION_IDS.includes(row.id));
    const keys = rows.flatMap((row) => [...row.questionAssetPaths, ...row.markschemeAssetPaths]).sort();
    expect(keys).toHaveLength(414);
    expect(plan.objects.map((object) => object.key).sort()).toEqual(keys);
    expect(rows.some((row) => isPreviewQuestion("igcse", row.id))).toBe(false);
    for (const object of plan.objects) {
      const pinned = receipt.rows.find((entry) => entry.id === object.questionId)!;
      expect(object.sha256, object.key).toBe(object.kind === "question" ? pinned.questionImageSha256 : pinned.markschemeImageSha256);
    }
  });
});
