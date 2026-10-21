import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getCatalogBank } from "@/lib/catalog";

const readJson = (path: string) => JSON.parse(readFileSync(path, "utf8"));
const NEW_OPTIONS = ["calculus", "discrete-mathematics", "sets-relations-and-groups"].map((option) => `2020-november-tz0-p3-${option}`);

describe("IB paper-count gaps (docs/ib-paper-count-gaps-2026-10-21.md)", () => {
  it("lists every AA HL question-bank paper in Full past papers, including the November 2020 Paper 3 options", () => {
    const archive = readJson("src/data/paper-archives/ib-hl.json");
    const runtime = readJson("src/data/raw/ib-hl.json");
    expect(archive.papers).toHaveLength(runtime.papers.length);
    expect(archive.papers).toHaveLength(getCatalogBank("ib-hl")!.paperCount);
    const acquisition = readJson("docs/ib-hl-nov2020-p3/acquisition.json");
    const reviews = readJson("docs/ib-hl-nov2020-p3/identity-review.json");
    for (const id of NEW_OPTIONS) {
      const entry = archive.papers.find((paper: { summary: { id: string } }) => paper.summary.id === id);
      expect(entry.summary).toMatchObject({ maxMarks: 50, durationMinutes: 60, reportAvailable: true });
      for (const kind of ["question", "markscheme"] as const) {
        const pinned = acquisition.files.find((file: { runtimePaperId: string; kind: string }) => file.runtimePaperId === id && file.kind === kind);
        expect(entry.documents[kind].sha256).toBe(pinned.sha256);
      }
      const review = reviews.cases.find((item: { paperId: string }) => item.paperId === id);
      expect([review.questionSha256, review.markschemeSha256]).toEqual([entry.documents.question.sha256, entry.documents.markscheme.sha256]);
    }
  });

  it("counts only Chemistry HL papers that hold questions", () => {
    const runtime = readJson("src/data/raw/ib-chemistry-hl.json");
    const withQuestions = new Set(runtime.questions.map((question: { id: string }) => question.id.replace(/-q\d+$/, "")));
    expect(runtime.papers.filter((paper: { id: string }) => withQuestions.has(paper.id))).toHaveLength(getCatalogBank("ib-chemistry-hl")!.paperCount);
  });
});
