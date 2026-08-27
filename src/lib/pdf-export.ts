import type { UnifiedQuestion } from "@/lib/questions";
import { MAX_PDF_QUESTIONS } from "@/lib/export-limits";

export { MAX_PDF_QUESTIONS } from "@/lib/export-limits";

export type PdfContent = "questions" | "answers" | "both";

export const PDF_BOOK_LOGO_PATH = "M232,48H160a40,40,0,0,0-32,16A40,40,0,0,0,96,48H24a8,8,0,0,0-8,8V200a8,8,0,0,0,8,8H96a24,24,0,0,1,24,24,8,8,0,0,0,16,0,24,24,0,0,1,24-24h72a8,8,0,0,0,8-8V56A8,8,0,0,0,232,48ZM96,192H32V64H96a24,24,0,0,1,24,24V200A39.81,39.81,0,0,0,96,192Zm128,0H160a39.81,39.81,0,0,0-24,8V88a24,24,0,0,1,24-24h64ZM160,88h40a8,8,0,0,1,0,16H160a8,8,0,0,1,0-16Zm48,40a8,8,0,0,1-8,8H160a8,8,0,0,1,0-16h40A8,8,0,0,1,208,128Zm0,32a8,8,0,0,1-8,8H160a8,8,0,0,1,0-16h40A8,8,0,0,1,208,160Z";

const PDF_BOOK_LOGO_DATA_URI = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><path fill="#15554a" d="${PDF_BOOK_LOGO_PATH}"/></svg>`)}`;

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

export function paginatePdfText(lines: string[], linesPerPage = 48): string[][] {
  if (!Number.isInteger(linesPerPage) || linesPerPage < 1) {
    throw new Error("linesPerPage must be a positive integer");
  }
  const pages: string[][] = [];
  for (let index = 0; index < lines.length; index += linesPerPage) {
    pages.push(lines.slice(index, index + linesPerPage));
  }
  return pages;
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

function imageData(image: HTMLImageElement, format: "image/jpeg" | "image/png" = "image/jpeg"): { data: string; width: number; height: number } {
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is unavailable");
  context.drawImage(image, 0, 0);
  return { data: canvas.toDataURL(format, 0.92), width: image.naturalWidth, height: image.naturalHeight };
}

export async function downloadQuestionPdf(
  questions: UnifiedQuestion[],
  content: PdfContent,
  onProgress?: (complete: number, total: number) => void,
  accountMarker?: string,
): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const brandMark = imageData(await loadImage(PDF_BOOK_LOGO_DATA_URI), "image/png");
  pdf.setProperties({ title: "PastPaperPrep worksheet", subject: "Past paper practice questions", author: "PastPaperPrep", creator: "PastPaperPrep" });
  let pages = 0;
  const total = questions.length;

  const addPage = () => {
    if (pages > 0) pdf.addPage();
    pages += 1;
  };

  const addImagePage = async (source: string, heading: string, detail: string) => {
    const image = imageData(await loadImage(source));
    addPage();
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(11);
    pdf.setTextColor(21, 52, 48);
    pdf.text(heading, 14, 24);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(96, 112, 108);
    pdf.text(detail, 14, 29);
    const maxWidth = 182;
    const maxHeight = 241;
    const scale = Math.min(maxWidth / image.width, maxHeight / image.height);
    const renderedWidth = image.width * scale;
    pdf.addImage(image.data, "JPEG", 14 + (maxWidth - renderedWidth) / 2, 34, renderedWidth, image.height * scale);
  };

  for (const [index, question] of questions.entries()) {
    const label = `${question.year} ${question.session} Paper ${question.paper}, Question ${question.number}`;
    if (content !== "answers") {
      for (const source of question.questionImages) await addImagePage(source, label, [question.primaryTopic, ...question.subtopics.slice(0, 2)].join("  |  "));
    }
    if (content !== "questions") {
      if (question.markschemeImages.length) {
        for (const source of question.markschemeImages) await addImagePage(source, `${label} - answer`, "Official mark scheme where available");
      } else if (question.solution) {
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(10);
        const solutionPages = paginatePdfText(pdf.splitTextToSize(question.solution, 182));
        for (const [solutionPage, lines] of solutionPages.entries()) {
          addPage();
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(12);
          pdf.setTextColor(21, 52, 48);
          pdf.text(`${label} - answer${solutionPage > 0 ? " (continued)" : ""}`, 14, 24);
          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(10);
          pdf.setTextColor(35, 45, 43);
          pdf.text(lines, 14, 34, { lineHeightFactor: 1.25 });
        }
      }
    }
    onProgress?.(index + 1, total);
  }

  if (pages === 0) throw new Error("There is nothing to export");
  for (let page = 1; page <= pages; page += 1) {
    pdf.setPage(page);
    pdf.addImage(brandMark.data, "PNG", 14, 7.5, 10, 10);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    pdf.setTextColor(21, 52, 48);
    pdf.text("PastPaperPrep", 28, 14.3);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7);
    pdf.setTextColor(96, 112, 108);
    pdf.text("Focused past-paper practice", 196, 14.3, { align: "right" });
    pdf.setDrawColor(205, 218, 214);
    pdf.line(14, 19, 196, 19);
    pdf.setDrawColor(205, 218, 214);
    pdf.line(14, 285, 196, 285);
    pdf.setFontSize(7);
    pdf.setTextColor(96, 112, 108);
    if (accountMarker) pdf.text(pdfFooterText(accountMarker), 14, 290);
    pdf.text(pdfPageLabel(page, pages), 196, 290, { align: "right" });
  }
  pdf.save("pastpaperprep-questions.pdf");
}
