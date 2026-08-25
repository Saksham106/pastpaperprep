import type { UnifiedQuestion } from "@/lib/questions";

export type PdfContent = "questions" | "answers" | "both";

export function questionsForPdf(
  matching: UnifiedQuestion[],
  selectedIds: Set<string>,
  selectionIsExplicit: boolean,
  allQuestions: UnifiedQuestion[] = matching,
): UnifiedQuestion[] {
  if (!selectionIsExplicit) return matching;
  return allQuestions.filter((question) => selectedIds.has(question.id));
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
    pdf.text(heading, 14, 12);
    const maxWidth = 182;
    const maxHeight = 263;
    const scale = Math.min(maxWidth / image.width, maxHeight / image.height);
    pdf.addImage(image.data, "JPEG", 14, 18, image.width * scale, image.height * scale);
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
        pdf.text(`${label} - answer`, 14, 18);
        pdf.setFontSize(10);
        pdf.text(pdf.splitTextToSize(question.solution, 182), 14, 28);
      }
    }
    onProgress?.(index + 1, total);
  }

  if (pages === 0) throw new Error("There is nothing to export");
  pdf.save("pastpaperprep-questions.pdf");
}
