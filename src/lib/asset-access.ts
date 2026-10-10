import {
  canViewAnswer,
  canViewQuestionAsset,
  type AccessEntitlement,
} from "@/lib/access";
import { isLocalEconomicsBank, type BankSlug } from "@/lib/banks";
import { loadBankQuestionMap } from "@/lib/question-loader";
import { loadBankAssetManifest } from "@/lib/asset-manifest";
import type { QuestionRichDetails, UnifiedQuestion } from "@/lib/questions";

export type AssetKind = "question" | "answer";
export type AssetRequest = { questionId: string; kind: AssetKind };
export type AuthorizedAssetRequest = AssetRequest & { paths: string[]; question: UnifiedQuestion };

export async function authorizeAssetRequests(
  bankSlug: BankSlug,
  requests: readonly AssetRequest[],
  entitlements: readonly AccessEntitlement[],
  now = new Date(),
): Promise<AuthorizedAssetRequest[]> {
  if (requests.length < 1 || requests.length > 20) {
    throw new Error("Asset request batch must contain between 1 and 20 items");
  }

  const questions = await loadBankQuestionMap(bankSlug);
  const seen = new Set<string>();

  return requests.map((request) => {
    if (
      !request ||
      typeof request.questionId !== "string" ||
      (request.kind !== "question" && request.kind !== "answer")
    ) {
      throw new Error("Asset request is invalid");
    }

    const requestKey = `${request.questionId}:${request.kind}`;
    if (seen.has(requestKey)) throw new Error("Duplicate asset request");
    seen.add(requestKey);

    const question = questions.get(request.questionId);
    if (!question) throw new Error("Unknown question");

    const allowed = request.kind === "question"
      ? canViewQuestionAsset(bankSlug, request.questionId, entitlements, now)
      : canViewAnswer(bankSlug, request.questionId, entitlements, now);
    if (!allowed) throw new Error("User is not authorized for this asset");

    return {
      ...request,
      question,
      paths: request.kind === "question"
        ? question.questionAssetPaths
        : question.markschemeAssetPaths,
    };
  });
}

/** Authorize only the explicitly gated local-preview asset path; no entitlements are consulted. */
export async function authorizeLocalPreviewAssetRequests(
  bankSlug: BankSlug,
  requests: readonly AssetRequest[],
): Promise<AuthorizedAssetRequest[]> {
  if (!isLocalEconomicsBank(bankSlug)) throw new Error("Local preview bank is invalid");
  if (requests.length < 1 || requests.length > 20) {
    throw new Error("Asset request batch must contain between 1 and 20 items");
  }

  const questions = await loadBankQuestionMap(bankSlug);
  const seen = new Set<string>();
  return requests.map((request) => {
    if (!request || typeof request.questionId !== "string" || (request.kind !== "question" && request.kind !== "answer")) {
      throw new Error("Asset request is invalid");
    }
    const requestKey = `${request.questionId}:${request.kind}`;
    if (seen.has(requestKey)) throw new Error("Duplicate asset request");
    seen.add(requestKey);
    const question = questions.get(request.questionId);
    if (!question) throw new Error("Unknown question");
    return {
      ...request,
      question,
      paths: request.kind === "question" ? question.questionAssetPaths : question.markschemeAssetPaths,
    };
  });
}

export type ManifestAuthorizedAssetRequest = AssetRequest & { paths: string[]; details: QuestionRichDetails };

/** The hot-path variant: same checks as authorizeAssetRequests, read from the prebuilt manifest. */
export async function authorizeManifestAssetRequests(
  bankSlug: BankSlug,
  requests: readonly AssetRequest[],
  entitlements: readonly AccessEntitlement[],
  now = new Date(),
): Promise<ManifestAuthorizedAssetRequest[]> {
  if (requests.length < 1 || requests.length > 20) {
    throw new Error("Asset request batch must contain between 1 and 20 items");
  }
  const manifest = await loadBankAssetManifest(bankSlug);
  const seen = new Set<string>();
  return requests.map((request) => {
    if (!request || typeof request.questionId !== "string" || (request.kind !== "question" && request.kind !== "answer")) {
      throw new Error("Asset request is invalid");
    }
    const requestKey = `${request.questionId}:${request.kind}`;
    if (seen.has(requestKey)) throw new Error("Duplicate asset request");
    seen.add(requestKey);
    const entry = manifest.get(request.questionId);
    if (!entry) throw new Error("Unknown question");
    const allowed = request.kind === "question"
      ? canViewQuestionAsset(bankSlug, request.questionId, entitlements, now)
      : canViewAnswer(bankSlug, request.questionId, entitlements, now);
    if (!allowed) throw new Error("User is not authorized for this asset");
    return {
      questionId: request.questionId,
      kind: request.kind,
      details: entry.details,
      paths: request.kind === "question" ? entry.questionAssetPaths : entry.markschemeAssetPaths,
    };
  });
}
