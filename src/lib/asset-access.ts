import {
  canViewAnswer,
  canViewQuestionAsset,
  type AccessEntitlement,
} from "@/lib/access";
import type { BankSlug } from "@/lib/banks";
import { loadBankQuestions } from "@/lib/questions";

export type AssetKind = "question" | "answer";
export type AssetRequest = { questionId: string; kind: AssetKind };
export type AuthorizedAssetRequest = AssetRequest & { paths: string[] };

export function authorizeAssetRequests(
  bankSlug: BankSlug,
  requests: readonly AssetRequest[],
  entitlements: readonly AccessEntitlement[],
  now = new Date(),
): AuthorizedAssetRequest[] {
  if (requests.length < 1 || requests.length > 20) {
    throw new Error("Asset request batch must contain between 1 and 20 items");
  }

  const questions = new Map(loadBankQuestions(bankSlug).map((question) => [question.id, question]));
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
      paths: request.kind === "question"
        ? question.questionAssetPaths
        : question.markschemeAssetPaths,
    };
  });
}
