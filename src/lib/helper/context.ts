import "server-only";
import { isPreviewQuestion, type AccessEntitlement } from "@/lib/access";
import { authorizeAssetRequests, type AssetRequest } from "@/lib/asset-access";
import { getBank, type BankSlug } from "@/lib/banks";
import { parseExplanation, type Explanation } from "@/lib/explanation-format";
import { freeExplanations } from "@/lib/free-explanations";
import { formatMcqAnswer, type McqAnswer } from "@/lib/mcq-answer";
import { explanationAssetSignOptions, premiumAssetSignOptions, previewAssetSignOptions, signPrivateAssetUrls } from "@/lib/private-assets";

/** Everything the helper knows about one question. Images are base64 WebP crops of the official papers. */
export type HelperContext = {
  bank: BankSlug;
  questionId: string;
  freePreview: boolean;
  label: string;
  subject: string;
  qualification: string;
  marks: number | null;
  questionImages: string[];
  markschemeImages: string[];
  mcqAnswer?: string;
  explanation: Explanation | null;
};

export class HelperAccessError extends Error {}

/** Crops per question kept under the API's image limits and our cost budget. */
const MAX_IMAGES_PER_KIND = 8;
const FETCH_TIMEOUT_MS = 10_000;

async function fetchBase64(url: string): Promise<string> {
  const response = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS), cache: "no-store" });
  if (!response.ok) throw new Error(`Asset fetch failed: ${response.status}`);
  return Buffer.from(await response.arrayBuffer()).toString("base64");
}

async function loadExplanation(bank: BankSlug, questionId: string, free: boolean, paths: string[]): Promise<Explanation | null> {
  if (free) {
    const local = freeExplanations(bank).get(questionId);
    if (local) return local;
  }
  if (!paths.length) return null;
  try {
    const urls = await signPrivateAssetUrls(paths, 60, explanationAssetSignOptions());
    const url = urls.get(paths[0]);
    if (!url) return null;
    const response = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS), cache: "no-store" });
    if (!response.ok) return null;
    return parseExplanation(await response.json(), bank, questionId);
  } catch {
    // The official question and mark scheme are enough to help; a missing worked solution is not an error.
    return null;
  }
}

/**
 * Loads the question, its mark scheme and our worked solution for a student who may see the answer.
 * Throws HelperAccessError when they may not, so the route can answer 403.
 */
export async function loadHelperContext(bank: BankSlug, questionId: string, entitlements: readonly AccessEntitlement[]): Promise<HelperContext> {
  const requests: AssetRequest[] = [{ questionId, kind: "question" }, { questionId, kind: "answer" }];
  let authorized;
  try {
    authorized = await authorizeAssetRequests(bank, [...requests, { questionId, kind: "explanation" }], entitlements);
  } catch (error) {
    throw new HelperAccessError(error instanceof Error ? error.message : "Not authorized");
  }
  const [question, answer, explanationRequest] = authorized;
  const free = isPreviewQuestion(bank, questionId);
  const questionPaths = question.paths.slice(0, MAX_IMAGES_PER_KIND);
  const answerPaths = answer.paths.slice(0, MAX_IMAGES_PER_KIND);
  const paths = [...questionPaths, ...answerPaths];
  const urls = paths.length ? await signPrivateAssetUrls(paths, 60, free ? previewAssetSignOptions(bank) : premiumAssetSignOptions(bank)) : new Map<string, string>();
  const fetchAll = (list: string[]) => Promise.all(list.map((path) => {
    const url = urls.get(path);
    if (!url) throw new Error("Unsigned asset");
    return fetchBase64(url);
  }));
  const [questionImages, markschemeImages, explanation] = await Promise.all([
    fetchAll(questionPaths),
    fetchAll(answerPaths),
    question.question.hasExplanation ? loadExplanation(bank, questionId, free, explanationRequest.paths) : Promise.resolve(null),
  ]);
  const meta = getBank(bank);
  const q = question.question;
  return {
    bank,
    questionId,
    freePreview: free,
    label: `${q.year} ${q.session}, Paper ${q.paper}, Question ${q.number}`,
    subject: meta?.subject ?? q.subject,
    qualification: meta?.qualification ?? "",
    marks: q.marks,
    questionImages,
    markschemeImages,
    ...(answer.mcqAnswer ? { mcqAnswer: mcqAnswerText(answer.mcqAnswer) } : {}),
    explanation,
  };
}

function mcqAnswerText(answer: McqAnswer): string {
  return `${formatMcqAnswer(answer.answers)}${answer.note ? ` (${answer.note})` : ""}`;
}
