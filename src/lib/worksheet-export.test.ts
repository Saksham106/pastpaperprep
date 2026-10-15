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
    expect(fetchPdfAssets.mock.calls[0].slice(0, 3)).toEqual(["igcse-chemistry-0620", ["b", "a"], "both"]);
    const [questions, content, onProgress, marker, placement, cover] = downloadQuestionPdf.mock.calls[0];
    expect(questions.map((question: { id: string; bankSlug: string; solution: unknown }) => [question.id, question.bankSlug, question.solution]))
      .toEqual([["b", "igcse-chemistry-0620", null], ["a", "igcse-chemistry-0620", null]]);
    expect([content, marker, placement, cover]).toEqual(["both", "ABC", "all-answers-last", { title: "Atoms", bankSlug: "igcse-chemistry-0620" }]);
    onProgress(1, 2);
    expect(progress).toHaveBeenCalledWith(1, 2);
    expect(result).toEqual({ heldNotice: null });
  });

  it("stops before the download when the page or session ended during signing", async () => {
    let current = true;
    fetchPdfAssets.mockImplementation(async () => { current = false; return new Map(); });
    await expect(exportWorksheetPdf({ bank: "igcse", questions: [meta("a", 1)], title: "x", isCurrent: () => current })).rejects.toMatchObject({ name: "AbortError" });
    expect(fetchPdfAssets.mock.calls[0][5]()).toBe(false);
    expect(downloadQuestionPdf).not.toHaveBeenCalled();
  });

  it("aborts the PDF build if the scope ends while it is being prepared", async () => {
    let current = true;
    downloadQuestionPdf.mockImplementation(async (_questions, _content, onProgress) => { current = false; onProgress(1, 2); return { heldRows: [] }; });
    const progress = vi.fn();
    await expect(exportWorksheetPdf({ bank: "igcse", questions: [meta("a", 1)], title: "x", isCurrent: () => current, onProgress: progress })).rejects.toMatchObject({ name: "AbortError" });
    expect(progress).not.toHaveBeenCalled();
  });

  it("returns the print-review notice when images were held", async () => {
    downloadQuestionPdf.mockResolvedValue({ heldRows: [{}, {}] });
    expect(await exportWorksheetPdf({ bank: "igcse", questions: [meta("a", 1)], title: "x" })).toEqual({ heldNotice: "held 2" });
  });
});
