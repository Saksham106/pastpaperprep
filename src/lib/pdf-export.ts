import type { UnifiedQuestion } from "@/lib/questions";
import { MAX_PDF_QUESTIONS } from "@/lib/export-limits";

export { MAX_PDF_QUESTIONS } from "@/lib/export-limits";

export type PdfContent = "questions" | "answers" | "both";

export function questionsForPdf(
  matching: UnifiedQuestion[],
  selectedIds: Set<string>,
  selectionIsExplicit: boolean,
  allQuestions: UnifiedQuestion[] = matching,
): UnifiedQuestion[] {
  if (!selectionIsExplicit) return matching.slice(0, MAX_PDF_QUESTIONS);
  return allQuestions.filter((question) => selectedIds.has(question.id)).slice(0, MAX_PDF_QUESTIONS);
}

export function pdfFooterText(accountMarker: string) {
  return `PastPaperPrep • Account ${accountMarker} • Personal study only`;
}

export function pdfPageLabel(page: number, total: number) {
  return `Page ${page} of ${total}`;
}

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new window.Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Could not load ${source}`));
    image.src = source;
  });
}

function imageData(image: HTMLImageElement): { data: string; width: number; height: number } {
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is unavailable");
  context.drawImage(image, 0, 0);
  return { data: canvas.toDataURL("image/jpeg", 0.92), width: image.naturalWidth, height: image.naturalHeight };
}

export async function downloadQuestionPdf(
  questions: UnifiedQuestion[],
  content: PdfContent,
  onProgress?: (complete: number, total: number) => void,
  accountMarker?: string,
): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  let pages = 0;
  const total = questions.length;

  const addPage = () => {
    if (pages > 0) pdf.addPage();
    pages += 1;
  };

  const addImagePage = async (source: string, heading: string) => {
    const image = imageData(await loadImage(source));
    addPage();
    pdf.setFontSize(10);
    pdf.text(heading, 14, 24);
    const maxWidth = 182;
    const maxHeight = 248;
    const scale = Math.min(maxWidth / image.width, maxHeight / image.height);
    pdf.addImage(image.data, "JPEG", 14, 30, image.width * scale, image.height * scale);
  };

  for (const [index, question] of questions.entries()) {
    const label = `${question.year} ${question.session} Paper ${question.paper}, Question ${question.number}`;
    if (content !== "answers") {
      for (const source of question.questionImages) await addImagePage(source, label);
    }
    if (content !== "questions") {
      if (question.markschemeImages.length) {
        for (const source of question.markschemeImages) await addImagePage(source, `${label} - answer`);
      } else if (question.solution) {
        addPage();
        pdf.setFontSize(12);
        pdf.text(`${label} - answer`, 14, 24);
        pdf.setFontSize(10);
        pdf.text(pdf.splitTextToSize(question.solution, 182), 14, 34);
      }
    }
    onProgress?.(index + 1, total);
  }

  if (pages === 0) throw new Error("There is nothing to export");
  for (let page = 1; page <= pages; page += 1) {
    pdf.setPage(page);
    pdf.setFillColor(21, 85, 74);
    pdf.roundedRect(14, 8, 9, 9, 2, 2, "F");
    pdf.setFontSize(8);
    pdf.setTextColor(255, 255, 255);
    pdf.text("P", 18.5, 14.2, { align: "center" });
    pdf.setFontSize(10);
    pdf.setTextColor(21, 52, 48);
    pdf.text("PastPaperPrep", 27, 14.2);
    pdf.setDrawColor(205, 218, 214);
    pdf.line(14, 19, 196, 19);
    pdf.setFontSize(7);
    pdf.setTextColor(100);
    if (accountMarker) pdf.text(pdfFooterText(accountMarker), 14, 290);
    pdf.text(pdfPageLabel(page, pages), 196, 290, { align: "right" });
  }
  pdf.save("pastpaperprep-questions.pdf");
}
