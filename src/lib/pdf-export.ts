import type { UnifiedQuestion } from "@/lib/questions";
import { MAX_PDF_QUESTIONS } from "@/lib/export-limits";
import { formatPublicLabel } from "@/lib/presentation";

export { MAX_PDF_QUESTIONS } from "@/lib/export-limits";

export type PdfContent = "questions" | "answers" | "both";

export const PDF_SITE_URL = "https://pastpaperprep.com";
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

export type PdfImageSlice = {
  sourceY: number;
  sourceHeight: number;
  renderedWidth: number;
  renderedHeight: number;
};

const PDF_IMAGE_MAX_WIDTH = 194;
const PDF_IMAGE_MAX_HEIGHT = 248;

export function planPdfImageSlices(
  width: number,
  height: number,
  rowInk: readonly number[] = [],
  maxWidth = PDF_IMAGE_MAX_WIDTH,
  maxHeight = PDF_IMAGE_MAX_HEIGHT,
): PdfImageSlice[] {
  if (width <= 0 || height <= 0) throw new Error("PDF image dimensions must be positive");

  const fullWidthScale = maxWidth / width;
  const fullWidthHeight = height * fullWidthScale;
  if (fullWidthHeight <= maxHeight * 1.03) {
    const scale = Math.min(fullWidthScale, maxHeight / height);
    return [{ sourceY: 0, sourceHeight: height, renderedWidth: width * scale, renderedHeight: height * scale }];
  }

  const maxSourceHeight = Math.max(1, Math.floor(maxHeight / fullWidthScale));
  const slices: PdfImageSlice[] = [];
  let sourceY = 0;
  while (sourceY < height) {
    const hardEnd = Math.min(height, sourceY + maxSourceHeight);
    let sourceEnd = hardEnd;
    if (hardEnd < height && rowInk.length === height) {
      const searchStart = sourceY + Math.floor(maxSourceHeight * 0.8);
      let bestInk = Number.POSITIVE_INFINITY;
      for (let candidate = searchStart; candidate <= hardEnd; candidate += 1) {
        const ink = rowInk[candidate] ?? Number.POSITIVE_INFINITY;
        if (ink <= bestInk) {
          bestInk = ink;
          sourceEnd = candidate;
        }
      }
    }
    const sourceHeight = Math.max(1, sourceEnd - sourceY);
    slices.push({
      sourceY,
      sourceHeight,
      renderedWidth: maxWidth,
      renderedHeight: sourceHeight * fullWidthScale,
    });
    sourceY = sourceEnd;
  }
  return slices;
}

export function darkenPdfPixel(value: number): number {
  const bounded = Math.max(0, Math.min(255, value));
  if (bounded >= 250) return 255;
  return Math.round(255 * Math.pow(bounded / 255, 1.35));
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
  return { data: canvas.toDataURL(format, 0.98), width: image.naturalWidth, height: image.naturalHeight };
}

type PreparedPdfImage = {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  rowInk: number[];
};

function preparePdfImage(image: HTMLImageElement): PreparedPdfImage {
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Canvas is unavailable");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0);

  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  const rowInk = Array.from({ length: canvas.height }, () => 0);
  const contentStart = Math.floor(canvas.width * 0.02);
  const contentEnd = Math.ceil(canvas.width * 0.98);
  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      const offset = (y * canvas.width + x) * 4;
      const red = pixels.data[offset];
      const green = pixels.data[offset + 1];
      const blue = pixels.data[offset + 2];
      if (x >= contentStart && x < contentEnd && (red + green + blue) / 3 < 245) rowInk[y] += 1;
      pixels.data[offset] = darkenPdfPixel(red);
      pixels.data[offset + 1] = darkenPdfPixel(green);
      pixels.data[offset + 2] = darkenPdfPixel(blue);
    }
  }
  context.putImageData(pixels, 0, 0);
  return { canvas, width: canvas.width, height: canvas.height, rowInk };
}

function pdfSliceData(image: PreparedPdfImage, slice: PdfImageSlice): string {
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = slice.sourceHeight;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is unavailable");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(
    image.canvas,
    0,
    slice.sourceY,
    image.width,
    slice.sourceHeight,
    0,
    0,
    image.width,
    slice.sourceHeight,
  );
  return canvas.toDataURL("image/jpeg", 0.98);
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

  const addImagePages = async (source: string, heading: string, detail: string) => {
    const image = preparePdfImage(await loadImage(source));
    const slices = planPdfImageSlices(image.width, image.height, image.rowInk);
    for (const [sliceIndex, slice] of slices.entries()) {
      addPage();
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(11);
      pdf.setTextColor(21, 52, 48);
      pdf.text(`${heading}${sliceIndex > 0 ? " (continued)" : ""}`, 8, 24);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      pdf.setTextColor(76, 88, 85);
      pdf.text(slices.length > 1 ? `${detail}  |  Part ${sliceIndex + 1} of ${slices.length}` : detail, 8, 29);
      const x = 8 + (PDF_IMAGE_MAX_WIDTH - slice.renderedWidth) / 2;
      pdf.addImage(pdfSliceData(image, slice), "JPEG", x, 32, slice.renderedWidth, slice.renderedHeight);
    }
  };

  for (const [index, question] of questions.entries()) {
    const label = `${question.year} ${question.session} Paper ${question.paper}, Question ${question.number}`;
    if (content !== "answers") {
      for (const source of question.questionImages) await addImagePages(source, label, [question.primaryTopic, ...question.subtopics.slice(0, 2)].map(formatPublicLabel).join("  |  "));
    }
    if (content !== "questions") {
      if (question.markschemeImages.length) {
        for (const source of question.markschemeImages) await addImagePages(source, `${label} - answer`, "Official mark scheme where available");
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
    pdf.addImage(brandMark.data, "PNG", 8, 7.5, 10, 10);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    pdf.setTextColor(21, 52, 48);
    pdf.text("PastPaperPrep", 22, 14.3);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(42, 74, 145);
    pdf.textWithLink("pastpaperprep.com", 202, 14.3, { align: "right", url: PDF_SITE_URL });
    pdf.setDrawColor(190, 204, 200);
    pdf.line(8, 19, 202, 19);
    pdf.setDrawColor(190, 204, 200);
    pdf.line(8, 285, 202, 285);
    pdf.setFontSize(7);
    pdf.setTextColor(76, 88, 85);
    if (accountMarker) pdf.text(pdfFooterText(accountMarker), 8, 290);
    pdf.text(pdfPageLabel(page, pages), 202, 290, { align: "right" });
  }
  pdf.save("pastpaperprep-questions.pdf");
}
