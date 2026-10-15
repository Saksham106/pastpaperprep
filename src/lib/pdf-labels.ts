import { BANK_CATALOG, type BankSlug } from "@/lib/catalog";
import { deriveCourseRoute } from "@/lib/course-route";
import { formatQuestionTopic } from "@/lib/presentation";

export type PdfLabelQuestion = {
  id: string; bankSlug: BankSlug; year: number; session: string; paper: number; number: number;
  component?: string; marks: number | null; primaryTopic: string;
};

// Cambridge banks store the month, the full series name or the s/w/m file-name code; IB names are already readable.
const CAMBRIDGE_SESSIONS: Record<string, string> = {
  june: "May/June", s: "May/June", "may/june": "May/June",
  march: "Feb/March", m: "Feb/March", "february/march": "Feb/March",
  november: "Oct/Nov", w: "Oct/Nov", "october/november": "Oct/Nov",
};
const catalogEntry = (bankSlug: BankSlug) => BANK_CATALOG.find((entry) => entry.slug === bankSlug);

export function pdfSessionLabel(bankSlug: BankSlug, session: string): string {
  return catalogEntry(bankSlug)?.qualification === "Cambridge IGCSE" ? CAMBRIDGE_SESSIONS[session.toLowerCase()] ?? session : session;
}

/** Where a question came from, e.g. "2024 May/June · Paper 22 · Q5". */
export function pdfSourceLabel(question: Pick<PdfLabelQuestion, "bankSlug" | "year" | "session" | "paper" | "component" | "id" | "number">): string {
  const component = question.component || question.id.match(/-(\d{2})-q\d+$/)?.[1] || String(question.paper);
  return `${question.year} ${pdfSessionLabel(question.bankSlug, question.session)} · Paper ${component} · Q${question.number}`;
}

export function rankedTopicLabels(questions: readonly Pick<PdfLabelQuestion, "bankSlug" | "primaryTopic">[]): string[] {
  const counts = new Map<string, number>();
  for (const question of questions) {
    const label = question.primaryTopic ? formatQuestionTopic(question.bankSlug, question.primaryTopic) : "";
    if (label) counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([label]) => label);
}

/** The text of the page-1 title block, apart from the worksheet name itself. */
export function pdfCoverSummary(questions: readonly PdfLabelQuestion[], bankSlug: BankSlug, content: "questions" | "answers" | "both") {
  const entry = catalogEntry(bankSlug);
  // Practicals (Papers 5 and 6) suit both routes, so they never decide it.
  const routes = new Set(questions.map((question) => deriveCourseRoute(bankSlug, question.paper)).filter((route) => route !== "both"));
  const route = routes.size === 1 ? [...routes][0] : "";
  const name = entry ? `${entry.qualification === "Cambridge IGCSE" ? "IGCSE " : ""}${entry.title}` : bankSlug;
  const eyebrow = [name, route === "core" ? "Core" : route === "extended" ? "Extended" : "", content === "answers" ? "Mark scheme" : ""]
    .filter(Boolean).join(" · ").toUpperCase();
  const totalMarks = questions.length && questions.every((question) => Number.isInteger(question.marks) && question.marks! > 0)
    ? questions.reduce((sum, question) => sum + question.marks!, 0) : null;
  const years = questions.map((question) => question.year);
  const low = Math.min(...years), high = Math.max(...years);
  const meta = [`${questions.length} ${questions.length === 1 ? "question" : "questions"}`,
    totalMarks === null ? "" : `${totalMarks} ${totalMarks === 1 ? "mark" : "marks"}`,
    years.length ? (low === high ? String(low) : `${low}–${high}`) : ""].filter(Boolean).join(" · ");
  const ranked = rankedTopicLabels(questions);
  const chips = ranked.length > 5 ? [...ranked.slice(0, 5), `+${ranked.length - 5} more`] : ranked;
  return { eyebrow, meta, chips, totalMarks, showScore: content !== "answers" };
}

const slugify = (value: string) => value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
  .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

export function pdfFileName(bankSlug: BankSlug, title: string): string {
  const titleSlug = slugify(title);
  if (!titleSlug) return "pastpaperprep-worksheet.pdf";
  const bankPart = slugify(catalogEntry(bankSlug)?.shortName ?? "");
  return `${[bankPart, titleSlug].filter(Boolean).join("-").slice(0, 80).replace(/-+$/, "")}.pdf`;
}
