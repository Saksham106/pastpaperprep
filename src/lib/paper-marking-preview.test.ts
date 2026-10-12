// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { PAPER_MARKING_PREVIEW } from "./paper-marking-preview";
import { project0620Sections, CHEMISTRY_0620_TOPICS } from "./igcse-0620-official.mjs";

const root = process.cwd();
const digest = (relative: string) => createHash("sha256").update(readFileSync(path.join(root, relative))).digest("hex");

describe("real Chemistry paper marking metadata", () => {
  it("matches exact original PDFs and pinned classification source", () => {
    expect(digest("private/paper-preview/question.pdf")).toBe(PAPER_MARKING_PREVIEW.provenance.questionPdfSha256);
    expect(digest("private/paper-preview/markscheme.pdf")).toBe(PAPER_MARKING_PREVIEW.provenance.markschemePdfSha256);
    expect(digest("src/data/production/igcse-chemistry-0620.json")).toBe(PAPER_MARKING_PREVIEW.provenance.runtimeSha256);
    expect(digest("src/lib/igcse-0620-official.mjs")).toBe(PAPER_MARKING_PREVIEW.provenance.projectorSha256);
  });
  it("is an exact projection of the sample's source IDs, maxima and routed official topics", () => {
    const raw = JSON.parse(readFileSync(path.join(root, "src/data/production/igcse-chemistry-0620.json"), "utf8")) as {questions: Array<Record<string, unknown>>};
    const expected = raw.questions.filter(q => String(q.id).startsWith(`${PAPER_MARKING_PREVIEW.id}-q`)).sort((a,b) => Number(a.number)-Number(b.number)).map(q => {
      const projected = project0620Sections(q);
      return {id:q.id, number:q.number, maxMarks:q.marks, topics:[...new Set([projected.primaryTopic, ...projected.secondaryTopics])].filter(t => CHEMISTRY_0620_TOPICS.includes(t))};
    });
    expect(PAPER_MARKING_PREVIEW.questions.map(q => ({ id: q.id, number: q.number, maxMarks: q.maxMarks, topics: q.topics }))).toEqual(expected);
    expect(new Set(PAPER_MARKING_PREVIEW.questions.map(q => q.id)).size).toBe(PAPER_MARKING_PREVIEW.questions.length);
    expect(PAPER_MARKING_PREVIEW.questions.reduce((total, q) => total + q.maxMarks, 0)).toBe(PAPER_MARKING_PREVIEW.maxMarks);
  });
  it("contains no protected content or asset locations", () => {
    const metadata = JSON.stringify(PAPER_MARKING_PREVIEW);
    for (const key of ["accessibleText", "questionImages", "sourceQuestionUrl", "markschemeImages", "answer", "questionAssetPaths"]) expect(metadata).not.toContain(`"${key}"`);
  });
});
