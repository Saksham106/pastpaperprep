import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchPdfAssets, downloadQuestionPdf, attachPdfAssetMetadata } = vi.hoisted(() => ({
  fetchPdfAssets: vi.fn(), downloadQuestionPdf: vi.fn(), attachPdfAssetMetadata: vi.fn((questions: unknown[]) => questions),
}));
vi.mock("@/lib/signed-assets", () => ({ fetchPdfAssets }));
vi.mock("@/lib/pdf-export", () => ({ downloadQuestionPdf, attachPdfAssetMetadata, pdfHeldNotice: (rows: unknown[]) => `held ${rows.length}` }));

import { exportWorksheetPdf } from "@/lib/worksheet-export";

const meta = (id: string, number: number) => ({
  id, number, paper: 2, year: 2024, session: "June", primaryTopic: "Atoms", secondaryTopics: [], skills: [], subtopics: [], granularLabels: [],
  subject: "Chemistry", option: "", zone: "", component: "22", calculator: null, marks: 3, questionImageCount: 1, markschemeImageCount: 1,
});

describe("exportWorksheetPdf", () => {
  beforeEach(() => { vi.clearAllMocks(); fetchPdfAssets.mockResolvedValue(new Map()); downloadQuestionPdf.mockResolvedValue({ heldRows: [] }); });

  it("signs and exports the sheet in order with its title and marker", async () => {
    const progress = vi.fn();
    const result = await exportWorksheetPdf({ bank: "igcse-chemistry-0620", questions: [meta("b", 2), meta("a", 1)], title: "Atoms", marker: "ABC", onProgress: progress });
    expect(fetchPdfAssets).toHaveBeenCalledWith("igcse-chemistry-0620", ["b", "a"], "both");
    const [questions, content, onProgress, marker, placement, cover] = downloadQuestionPdf.mock.calls[0];
    expect(questions.map((question: { id: string; bankSlug: string; solution: unknown }) => [question.id, question.bankSlug, question.solution]))
      .toEqual([["b", "igcse-chemistry-0620", null], ["a", "igcse-chemistry-0620", null]]);
    expect([content, onProgress, marker, placement, cover]).toEqual(["both", progress, "ABC", "all-answers-last", { title: "Atoms", bankSlug: "igcse-chemistry-0620" }]);
    expect(result).toEqual({ heldNotice: null });
  });

  it("returns the print-review notice when images were held", async () => {
    downloadQuestionPdf.mockResolvedValue({ heldRows: [{}, {}] });
    expect(await exportWorksheetPdf({ bank: "igcse", questions: [meta("a", 1)], title: "x" })).toEqual({ heldNotice: "held 2" });
  });
});
