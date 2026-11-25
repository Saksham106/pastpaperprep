import "server-only";
import { isPreviewQuestion, type AccessEntitlement } from "@/lib/access";
import { authorizeAssetRequests, type AssetRequest } from "@/lib/asset-access";
import { getBank, type BankSlug } from "@/lib/banks";
import { parseExplanation, type Explanation } from "@/lib/explanation-format";
import { formatMcqAnswer, type McqAnswer } from "@/lib/mcq-answer";
import { freePublicAssetUrl } from "@/lib/free-asset-index";
import { isSafeFreeAssetPath } from "@/lib/free-public-assets";
import { explanationAssetSignOptions, premiumAssetSignOptions, previewAssetSignOptions, signPrivateAssetUrls } from "@/lib/private-assets";
import type { SignPrivateAssetOptions } from "@/lib/private-asset-providers";

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
  /** Crops left out because the question is larger than the request budget. Marking is refused when any are missing. */
  omitted: { question: number; markscheme: number };
};

export class HelperAccessError extends Error {}

/**
 * Request budget for official crops. The API takes up to 100 images and 32 MB per request; we stay well under both and
 * leave room for the student's photo. Questions over budget are sent as far as they fit and flagged as incomplete.
 */
export const HELPER_MAX_CROPS = 40;
export const HELPER_MAX_CROP_BASE64 = 16_000_000;
const FETCH_TIMEOUT_MS = 10_000;

async function fetchOk(url: string): Promise<Response> {
  const response = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS), cache: "no-store" });
  if (!response.ok) throw new Error(`Asset fetch failed: ${response.status}`);
  return response;
}

/** Free-year files are public on free.pastpaperprep.com: read them there first, so no signing is needed. */
async function fetchPublic(path: string): Promise<Response | null> {
  if (!isSafeFreeAssetPath(path)) return null;
  try {
    return await fetchOk(freePublicAssetUrl(path));
  } catch {
    return null;
  }
}

async function fetchSigned(paths: string[], options: SignPrivateAssetOptions): Promise<Map<string, Response>> {
  if (!paths.length) return new Map();
  const urls = await signPrivateAssetUrls(paths, 60, options);
  return new Map(await Promise.all(paths.map(async (path) => {
    const url = urls.get(path);
    if (!url) throw new Error("Unsigned asset");
    return [path, await fetchOk(url)] as const;
  })));
}

/** Base64 bytes for each path, in order: public copies for free questions, signed private reads otherwise. */
async function loadImages(paths: string[], free: boolean, options: SignPrivateAssetOptions): Promise<string[]> {
  const responses = new Map<string, Response>();
  if (free) {
    const publicResponses = await Promise.all(paths.map(fetchPublic));
    paths.forEach((path, index) => { const response = publicResponses[index]; if (response) responses.set(path, response); });
  }
  const missing = paths.filter((path) => !responses.has(path));
  for (const [path, response] of await fetchSigned(missing, options)) responses.set(path, response);
  return Promise.all(paths.map(async (path) => Buffer.from(await responses.get(path)!.arrayBuffer()).toString("base64")));
}

async function loadExplanation(bank: BankSlug, questionId: string, free: boolean, paths: string[]): Promise<Explanation | null> {
  if (!paths.length) return null;
  try {
    const response = (free ? await fetchPublic(paths[0]) : null) ?? (await fetchSigned([paths[0]], explanationAssetSignOptions())).get(paths[0]);
    if (!response) return null;
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
  // The question comes first: without it nothing else makes sense. Mark-scheme crops fill what is left.
  const questionPaths = question.paths.slice(0, HELPER_MAX_CROPS);
  const answerPaths = answer.paths.slice(0, Math.max(0, HELPER_MAX_CROPS - questionPaths.length));
  const signOptions = free ? previewAssetSignOptions(bank) : premiumAssetSignOptions(bank);
  const [questionLoaded, markschemeLoaded, explanation] = await Promise.all([
    loadImages(questionPaths, free, signOptions),
    loadImages(answerPaths, free, signOptions),
    question.question.hasExplanation ? loadExplanation(bank, questionId, free, explanationRequest.paths) : Promise.resolve(null),
  ]);
  const { kept: questionImages, rest } = withinBudget(questionLoaded, HELPER_MAX_CROP_BASE64);
  const { kept: markschemeImages } = withinBudget(markschemeLoaded, rest);
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
    omitted: { question: question.paths.length - questionImages.length, markscheme: answer.paths.length - markschemeImages.length },
  };
}

/** The leading images that fit in `budget` base64 characters, and what budget is left. */
export function withinBudget(images: string[], budget: number): { kept: string[]; rest: number } {
  const kept: string[] = [];
  let rest = budget;
  for (const image of images) {
    if (image.length > rest) break;
    kept.push(image);
    rest -= image.length;
  }
  return { kept, rest };
}

function mcqAnswerText(answer: McqAnswer): string {
  return `${formatMcqAnswer(answer.answers)}${answer.note ? ` (${answer.note})` : ""}`;
}
