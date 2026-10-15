import type { BankSlug } from "@/lib/catalog";
import type { PublicQuestionMetadata } from "@/lib/question-index";
import type { UnifiedQuestion } from "@/lib/questions";

/**
 * Download a worksheet built from public index metadata. The sign route checks access and limits;
 * the bank page keeps its own path because it already holds full question records.
 */
export async function exportWorksheetPdf({ bank, questions, title, marker, onProgress }: {
  bank: BankSlug; questions: readonly PublicQuestionMetadata[]; title: string; marker?: string;
  onProgress?: (complete: number, total: number) => void;
}): Promise<{ heldNotice: string | null }> {
  const [{ attachPdfAssetMetadata, downloadQuestionPdf, pdfHeldNotice }, { fetchPdfAssets }] = await Promise.all([
    import("@/lib/pdf-export"), import("@/lib/signed-assets"),
  ]);
  const records = questions.map((question) => ({
    ...question, bankSlug: bank, skills: question.skills ?? [], secondarySubtopics: [], courseEra: "", searchText: "",
    solution: null, questionImages: [], markschemeImages: [],
  }) as unknown as UnifiedQuestion);
  const assets = await fetchPdfAssets(bank, records.map((question) => question.id), "both");
  const { heldRows } = await downloadQuestionPdf(attachPdfAssetMetadata(records, assets), "both", onProgress, marker, "all-answers-last", { title, bankSlug: bank });
  return { heldNotice: heldRows.length ? pdfHeldNotice(heldRows) : null };
}
