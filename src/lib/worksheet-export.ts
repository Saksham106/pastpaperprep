import type { BankSlug } from "@/lib/catalog";
import type { PublicQuestionMetadata } from "@/lib/question-index";
import type { UnifiedQuestion } from "@/lib/questions";

/**
 * Download a worksheet built from public index metadata. The sign route checks access and limits;
 * the bank page keeps its own path because it already holds full question records.
 */
export async function exportWorksheetPdf({ bank, questions, title, marker, onProgress, isCurrent = () => true }: {
  bank: BankSlug; questions: readonly PublicQuestionMetadata[]; title: string; marker?: string;
  onProgress?: (complete: number, total: number) => void;
  /** False once the page closed or the account changed: late signed links must never become a PDF. */
  isCurrent?: () => boolean;
}): Promise<{ heldNotice: string | null }> {
  const assertCurrent = () => { if (!isCurrent()) throw new DOMException("PDF request scope expired", "AbortError"); };
  const [{ attachPdfAssetMetadata, downloadQuestionPdf, pdfHeldNotice }, { fetchPdfAssets }] = await Promise.all([
    import("@/lib/pdf-export"), import("@/lib/signed-assets"),
  ]);
  const records = questions.map((question) => ({
    ...question, bankSlug: bank, skills: question.skills ?? [], secondarySubtopics: [], courseEra: "", searchText: "",
    solution: null, questionImages: [], markschemeImages: [],
  }) as unknown as UnifiedQuestion);
  const assets = await fetchPdfAssets(bank, records.map((question) => question.id), "both", fetch, false, isCurrent);
  assertCurrent();
  // Throwing from progress cancels a build whose image loads outlive the scope, before the final save.
  const progress = (complete: number, total: number) => { assertCurrent(); onProgress?.(complete, total); };
  const { heldRows } = await downloadQuestionPdf(attachPdfAssetMetadata(records, assets), "both", progress, marker, "all-answers-last", { title, bankSlug: bank });
  return { heldNotice: heldRows.length ? pdfHeldNotice(heldRows) : null };
}
