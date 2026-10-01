import type { UnifiedQuestion } from "@/lib/questions";
import { MAX_PDF_QUESTIONS } from "@/lib/export-limits";
import type { SignedAsset } from "@/lib/signed-assets";
import type { SourcePrintSegment } from "@/lib/print-geometry";
import { fetchVerifiedImageBlob } from "@/lib/verified-asset-bytes";
import { verify0606PdfMetadata } from "@/lib/verified-0606-client";

export { MAX_PDF_QUESTIONS } from "@/lib/export-limits";

export type PdfContent = "questions" | "answers" | "both";
export type PdfAnswerPlacement = "all-answers-last" | "after-each-question";
export type PdfExportQuestion = UnifiedQuestion & {
  questionPrintSizesPt?: Array<[number, number] | null>;
  markschemePrintSizesPt?: Array<[number, number] | null>;
  questionPrintSegments?: Array<SourcePrintSegment[] | null>;
  markschemePrintSegments?: Array<SourcePrintSegment[] | null>;
  questionRasterSizesPx?: Array<[number, number] | null>;
  markschemeRasterSizesPx?: Array<[number, number] | null>;
};

export function attachPdfAssetMetadata(
  questions: UnifiedQuestion[],
  signed: Map<string, SignedAsset>,
): PdfExportQuestion[] {
  return questions.map((question) => {
    const questionAsset = signed.get(`${question.id}:question`);
    const answerAsset = signed.get(`${question.id}:answer`);
    return {
      ...question,
      questionImages: questionAsset?.urls ?? [],
      markschemeImages: answerAsset?.urls ?? [],
      questionPrintSizesPt: questionAsset?.printSizesPt,
      markschemePrintSizesPt: answerAsset?.printSizesPt,
      questionPrintSegments: questionAsset?.printSegments,
      markschemePrintSegments: answerAsset?.printSegments,
      questionRasterSizesPx: questionAsset?.rasterSizesPx,
      markschemeRasterSizesPx: answerAsset?.rasterSizesPx,
    };
  });
}

export type PdfJob<T> = { question: T; kind: "question" | "answer" };

export function orderPdfJobs<T>(questions: T[], content: PdfContent, placement: PdfAnswerPlacement): PdfJob<T>[] {
  const questionJobs = questions.map((question): PdfJob<T> => ({ question, kind: "question" }));
  const answerJobs = questions.map((question): PdfJob<T> => ({ question, kind: "answer" }));
  if (content === "questions") return questionJobs;
  if (content === "answers") return answerJobs;
  if (placement === "all-answers-last") return [...questionJobs, ...answerJobs];
  return questions.flatMap((question): PdfJob<T>[] => [
    { question, kind: "question" },
    { question, kind: "answer" },
  ]);
}

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
  const byId = new Map(allQuestions.map((question) => [question.id, question]));
  return [...selectedIds].map((id) => byId.get(id)).filter((question): question is UnifiedQuestion => Boolean(question)).slice(0, MAX_PDF_QUESTIONS);
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

export type PdfPageFormat = "a4" | "a3";
export type PdfPageOrientation = "portrait" | "landscape";
export type PdfHeldRow = {
  questionId: string;
  kind: "question" | "answer";
  imageIndex: number;
  reason: "fit-to-page";
  scale: number;
};
export function pdfHeldNotice(rows: readonly PdfHeldRow[]): string {
  return `Downloaded with ${rows.length} fit-to-page image${rows.length === 1 ? "" : "s"} held for print review: ` +
    rows.map((row) => `${row.questionId} ${row.kind} image ${row.imageIndex + 1}`).join("; ");
}
export type WholeImagePlacement = {
  format: PdfPageFormat;
  orientation: PdfPageOrientation;
  pageWidthMm: number;
  pageHeightMm: number;
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
  scale: number;
  headerMode: "standard" | "compact";
  heldReason: "fit-to-page" | null;
};

const PDF_PAGES: Array<{ format: PdfPageFormat; orientation: PdfPageOrientation; width: number; height: number }> = [
  { format: "a4", orientation: "portrait", width: 210, height: 297 },
  { format: "a4", orientation: "landscape", width: 297, height: 210 },
  { format: "a3", orientation: "portrait", width: 297, height: 420 },
  { format: "a3", orientation: "landscape", width: 420, height: 297 },
];
const PDF_TOP_MM = 22;
const PDF_BOTTOM_MM = 13;
const PDF_SIDE_MM = 8;
const PDF_FALLBACK_DPI = 150;
const SOURCE_RENDER_DPI = new Set([108, 126, 144]);

/** Generator raster rates are hints, not per-asset source-geometry receipts. */
export function inferredPdfDpiForBank(bank: UnifiedQuestion["bankSlug"]): number {
  if (["igcse-biology-0610", "igcse-chemistry-0620", "igcse-physics-0625",
    "igcse-coordinated-sciences-0654", "igcse-economics-0455"].includes(bank)) return 108;
  if (["ib-biology-hl", "ib-biology-sl", "ib-chemistry-hl", "ib-chemistry-sl",
    "ib-physics-hl", "ib-physics-sl"].includes(bank)) return 126;
  if (bank === "ib-economics-hl" || bank === "ib-economics-sl") return 144;
  return PDF_FALLBACK_DPI;
}

/** One indivisible image, never enlarged. Geometry wins; otherwise use a conservative raster size. */
export function planWholePdfImage(
  widthPx: number, heightPx: number, physicalSizePt?: readonly [number, number] | null,
  plainTextOnly = false, fallbackDpi = PDF_FALLBACK_DPI,
): WholeImagePlacement {
  if (!Number.isSafeInteger(widthPx) || widthPx <= 0 || !Number.isSafeInteger(heightPx) || heightPx <= 0) {
    throw new Error("PDF image dimensions must be positive");
  }
  if (physicalSizePt && (physicalSizePt.length !== 2 || physicalSizePt.some((v) => !Number.isFinite(v) || v <= 0))) {
    throw new Error("Signed physical image geometry is invalid");
  }
  if (!Number.isFinite(fallbackDpi) || fallbackDpi <= 0) throw new Error("PDF raster DPI must be positive");
  const inferredWidth = widthPx * 25.4 / fallbackDpi;
  // A rounded full-page raster can exceed A4 width by a fraction of one pixel.
  const sourcePageWidth = !physicalSizePt && SOURCE_RENDER_DPI.has(fallbackDpi)
    ? (inferredWidth > 210 && inferredWidth < 210.1 ? 210
      : inferredWidth > 297 && inferredWidth < 297.1 ? 297 : inferredWidth)
    : inferredWidth;
  const width = physicalSizePt ? physicalSizePt[0] * 25.4 / 72 : sourcePageWidth;
  const height = physicalSizePt ? physicalSizePt[1] * 25.4 / 72 : heightPx * 25.4 / fallbackDpi;
  const makePlacement = (page: typeof PDF_PAGES[number], scale: number, heldReason: WholeImagePlacement["heldReason"], headerMode: WholeImagePlacement["headerMode"] = "standard"): WholeImagePlacement => ({
    format: page.format, orientation: page.orientation, pageWidthMm: page.width, pageHeightMm: page.height,
    xMm: (page.width - width * scale) / 2, yMm: headerMode === "compact" ? 10 : PDF_TOP_MM,
    widthMm: width * scale, heightMm: height * scale, scale, headerMode, heldReason,
  });
  const fits = (page: typeof PDF_PAGES[number], scale: number) =>
    width * scale <= page.width - 2 * PDF_SIDE_MM + 0.001 &&
    height * scale <= page.height - PDF_TOP_MM - PDF_BOTTOM_MM + 0.001;
  if (!physicalSizePt && SOURCE_RENDER_DPI.has(fallbackDpi)) {
    if (width >= 209.5 && width <= 210) {
      if (height <= 297 - PDF_TOP_MM - PDF_BOTTOM_MM) return makePlacement(PDF_PAGES[0], 1, null);
      if (height <= 297 - 10 - PDF_BOTTOM_MM) return makePlacement(PDF_PAGES[0], 1, null, "compact");
    }
    if (width >= 296.5 && width <= 297) {
      if (height <= 210 - PDF_TOP_MM - PDF_BOTTOM_MM) return makePlacement(PDF_PAGES[1], 1, null);
      if (height <= 210 - 10 - PDF_BOTTOM_MM) return makePlacement(PDF_PAGES[1], 1, null, "compact");
    }
  }
  // A visibly plain answer row need not rotate the worksheet just to save 3% width.
  if (plainTextOnly && !physicalSizePt && fallbackDpi === 108 &&
    width > 210 && width <= 210 / 0.95 && height <= 297 - PDF_TOP_MM - PDF_BOTTOM_MM) {
    return makePlacement(PDF_PAGES[0], 210 / width, null);
  }
  for (const page of PDF_PAGES) if (fits(page, 1)) return makePlacement(page, 1, null);
  if (plainTextOnly) {
    for (const page of PDF_PAGES) if (fits(page, 0.95)) return makePlacement(page, 0.95, null);
  }
  const choices = PDF_PAGES.map((page) => ({
    page, scale: Math.min(1, (page.width - 2 * PDF_SIDE_MM) / width,
      (page.height - PDF_TOP_MM - PDF_BOTTOM_MM) / height),
  }));
  const best = choices.reduce((winner, option) => option.scale > winner.scale ? option : winner);
  return makePlacement(best.page, best.scale, "fit-to-page");
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
};

/** Only a verified final furniture tail may shorten the displayed raster. */
function preparePdfImage(image: HTMLImageElement, visibleHeight = image.naturalHeight): PreparedPdfImage {
  if (!Number.isSafeInteger(visibleHeight) || visibleHeight < 1 || visibleHeight > image.naturalHeight) {
    throw new Error("Reviewed image height is invalid");
  }
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = visibleHeight;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Canvas is unavailable");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  for (let offset = 0; offset < pixels.data.length; offset += 4) {
    pixels.data[offset] = darkenPdfPixel(pixels.data[offset]);
    pixels.data[offset + 1] = darkenPdfPixel(pixels.data[offset + 1]);
    pixels.data[offset + 2] = darkenPdfPixel(pixels.data[offset + 2]);
  }
  context.putImageData(pixels, 0, 0);
  return { canvas, width: canvas.width, height: canvas.height };
}

export async function downloadQuestionPdf(
  questions: PdfExportQuestion[],
  content: PdfContent,
  onProgress?: (complete: number, total: number) => void,
  accountMarker?: string,
  answerPlacement: PdfAnswerPlacement = "all-answers-last",
): Promise<{ heldRows: PdfHeldRow[] }> {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const brandMark = imageData(await loadImage(PDF_BOOK_LOGO_DATA_URI), "image/png");
  pdf.setProperties({ title: "PastPaperPrep worksheet", subject: "Past paper practice questions", author: "PastPaperPrep", creator: "PastPaperPrep" });
  let pages = 0;
  let nextImageY = PDF_TOP_MM;
  let currentSection = content === "answers" ? "Answers" : content === "both" && answerPlacement === "after-each-question" ? "Questions and answers" : "Questions";
  let startAnswerPage = false;
  const pageSpecs: Array<{ format: PdfPageFormat; orientation: PdfPageOrientation; width: number; height: number; headerMode: WholeImagePlacement["headerMode"]; section: string }> = [];
  const heldRows: PdfHeldRow[] = [];
  const total = questions.length;

  const addPage = (format: PdfPageFormat = "a4", orientation: PdfPageOrientation = "portrait", headerMode: WholeImagePlacement["headerMode"] = "standard") => {
    if (pages > 0) pdf.addPage(format, orientation);
    else if (format !== "a4" || orientation !== "portrait") {
      pdf.addPage(format, orientation);
      pdf.deletePage(1);
    }
    pages += 1;
    const spec = PDF_PAGES.find((candidate) => candidate.format === format && candidate.orientation === orientation)!;
    pageSpecs.push({ ...spec, headerMode, section: currentSection });
    startAnswerPage = false;
    nextImageY = headerMode === "compact" ? 10 : PDF_TOP_MM;
  };

  const addImagePage = async (
    bankSlug: UnifiedQuestion["bankSlug"], questionId: string, kind: "question" | "answer", imageIndex: number, source: string,
    label: string, marks: number | null,
    physicalSizePt?: readonly [number, number] | null,
    sourceSegments?: readonly SourcePrintSegment[] | null,
    expectedRaster?: readonly [number, number] | null,
  ) => {
    const excluded = sourceSegments?.filter((part) => part.include === false) ?? [];
    let loaded: HTMLImageElement;
    if (excluded.length) {
      if (excluded.length !== 1 || sourceSegments?.at(-1) !== excluded[0] ||
        !excluded[0].imageSha256 || !physicalSizePt || !expectedRaster) {
        throw new Error("Reviewed furniture exclusion lacks a bound source image hash");
      }
      const blob = await fetchVerifiedImageBlob(source, excluded[0].imageSha256);
      const objectUrl = URL.createObjectURL(blob);
      try { loaded = await loadImage(objectUrl); }
      finally { URL.revokeObjectURL(objectUrl); }
    } else {
      loaded = await loadImage(source);
    }
    if (expectedRaster && (loaded.naturalWidth !== expectedRaster[0] || loaded.naturalHeight !== expectedRaster[1])) {
      throw new Error("Signed image raster dimensions differ from verified source geometry");
    }
    let visibleHeight = loaded.naturalHeight;
    let size = physicalSizePt;
    if (excluded.length) {
      let cursor = 0;
      let physicalTotal = 0;
      for (const part of sourceSegments!) {
        if (part.sourceY !== cursor || !Number.isSafeInteger(part.sourceHeight) || part.sourceHeight <= 0 ||
          !Number.isFinite(part.physicalHeightPt) || part.physicalHeightPt <= 0) {
          throw new Error("Verified source segments do not cover the original raster");
        }
        cursor += part.sourceHeight;
        physicalTotal += part.physicalHeightPt;
      }
      if (cursor !== loaded.naturalHeight || Math.abs(physicalTotal - physicalSizePt![1]) > 0.1) {
        throw new Error("Verified source segments disagree with image geometry");
      }
      visibleHeight = excluded[0].sourceY;
      size = [physicalSizePt![0], physicalSizePt![1] - excluded[0].physicalHeightPt];
    }
    const image = preparePdfImage(loaded, visibleHeight);
    const fallbackDpi = inferredPdfDpiForBank(bankSlug);
    const shortAnswerRow = kind === "answer" && !size && fallbackDpi === 108 &&
      image.height <= 48 && image.width >= 890;
    const placement = planWholePdfImage(image.width, image.height, size, shortAnswerRow, fallbackDpi);
    // Omit the extra crop label only when it would prevent source-size placement.
    const labelSpace = placement.yMm + 5 + placement.heightMm <= placement.pageHeightMm - PDF_BOTTOM_MM + 0.001 ? 5 : 0;
    const current = pageSpecs[pages - 1];
    if (startAnswerPage || !current || current.format !== placement.format || current.orientation !== placement.orientation ||
      nextImageY + labelSpace + placement.heightMm > current.height - PDF_BOTTOM_MM + 0.001) {
      addPage(placement.format, placement.orientation, placement.headerMode);
    }
    if (labelSpace) {
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      pdf.setTextColor(76, 88, 85);
      pdf.text(`${label}${imageIndex > 0 ? " (continued)" : ""}`, Math.max(8, placement.xMm), nextImageY + 3);
      const detail = kind === "answer" ? "Official answer" : Number.isFinite(marks) && marks !== null ? `${marks} marks` : "";
      if (detail) pdf.text(detail, Math.min(placement.pageWidthMm - 8, placement.xMm + placement.widthMm), nextImageY + 3, { align: "right" });
      nextImageY += labelSpace;
    }
    pdf.addImage(image.canvas.toDataURL("image/jpeg", 0.98), "JPEG",
      placement.xMm, nextImageY, placement.widthMm, placement.heightMm);
    nextImageY += placement.heightMm + 4;
    if (placement.heldReason) heldRows.push({ questionId, kind, imageIndex, reason: placement.heldReason, scale: placement.scale });
  };

  let completed = 0;
  for (const { question, kind } of orderPdfJobs(questions, content, answerPlacement)) {
    if (content === "both" && answerPlacement === "all-answers-last" && kind === "answer" && currentSection !== "Answers") {
      currentSection = "Answers";
      startAnswerPage = true;
    }
    const component = question.component || question.id.match(/-(\d{2})-q\d+$/)?.[1] || String(question.paper);
    const label = `${question.year} ${question.session} / Paper ${component} / Q${question.number}`;
    if (kind === "question") {
      if (!question.questionImages.length) throw new Error(`Question image is missing for ${question.id}`);
      for (const [index, source] of question.questionImages.entries()) {
        if (question.bankSlug === "igcse-additional" && question.questionPrintSizesPt?.[index] &&
          question.questionPrintSegments?.[index] && question.questionRasterSizesPx?.[index]) {
          await verify0606PdfMetadata(question, "question", index);
        }
        await addImagePage(question.bankSlug, question.id, "question", index, source, label, question.marks,
          question.questionPrintSizesPt?.[index], question.questionPrintSegments?.[index], question.questionRasterSizesPx?.[index]);
      }
    } else {
      if (question.markschemeImages.length) {
        for (const [index, source] of question.markschemeImages.entries()) {
          if (question.bankSlug === "igcse-additional" && question.markschemePrintSizesPt?.[index] &&
            question.markschemePrintSegments?.[index] && question.markschemeRasterSizesPx?.[index]) {
            await verify0606PdfMetadata(question, "answer", index);
          }
          await addImagePage(question.bankSlug, question.id, "answer", index, source, label, question.marks,
            question.markschemePrintSizesPt?.[index], question.markschemePrintSegments?.[index], question.markschemeRasterSizesPx?.[index]);
        }
      } else if (question.solution) {
        if (question.bankSlug === "igcse-additional") {
          throw new Error(`Official answer image is missing for ${question.id}`);
        }
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
          nextImageY = 284;
        }
      }
    }
    if (kind === "answer" || content === "questions") onProgress?.(++completed, total);
  }

  if (pages === 0) throw new Error("There is nothing to export");
  for (let page = 1; page <= pages; page += 1) {
    pdf.setPage(page);
    const spec = pageSpecs[page - 1];
    const right = spec.width - 8;
    const footerLine = spec.height - 12;
    const footerTextY = spec.height - 7;
    if (spec.headerMode === "compact") {
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8);
      pdf.setTextColor(21, 52, 48);
      pdf.text(`PastPaperPrep / ${spec.section}`, 8, 6);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(42, 74, 145);
      pdf.textWithLink("pastpaperprep.com", right, 6, { align: "right", url: PDF_SITE_URL });
      pdf.setDrawColor(190, 204, 200);
      pdf.line(8, 8, right, 8);
    } else {
      pdf.addImage(brandMark.data, "PNG", 8, 7.5, 10, 10);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(10);
      pdf.setTextColor(21, 52, 48);
      pdf.text("PastPaperPrep", 22, 14.3);
      pdf.text(spec.section, 65, 14.3);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      pdf.setTextColor(42, 74, 145);
      pdf.textWithLink("pastpaperprep.com", right, 14.3, { align: "right", url: PDF_SITE_URL });
      pdf.setDrawColor(190, 204, 200);
      pdf.line(8, 19, right, 19);
    }
    pdf.line(8, footerLine, right, footerLine);
    pdf.setFontSize(7);
    pdf.setTextColor(76, 88, 85);
    if (accountMarker) pdf.text(pdfFooterText(accountMarker), 8, footerTextY);
    pdf.text(pdfPageLabel(page, pages), right, footerTextY, { align: "right" });
  }
  pdf.save("pastpaperprep-questions.pdf");
  return { heldRows };
}
