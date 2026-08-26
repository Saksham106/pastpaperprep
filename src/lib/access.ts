import type { BankSlug } from "@/lib/banks";

export type ProductId = "bank_igcse" | "bank_igcse_additional" | "bank_ib_hl" | "bank_ib_sl" | "bank_ib_ai_hl" | "bank_ib_ai_sl" | "bundle_all";
export type EntitlementStatus = "active" | "trialing" | "expired" | "revoked";

export type AccessEntitlement = {
  productId: ProductId;
  status: EntitlementStatus;
  startsAt: string | null;
  expiresAt: string | null;
};

const BANK_PRODUCTS: Record<BankSlug, ProductId> = {
  igcse: "bank_igcse",
  "igcse-additional": "bank_igcse_additional",
  "ib-hl": "bank_ib_hl",
  "ib-sl": "bank_ib_sl",
  "ib-ai-hl": "bank_ib_ai_hl",
  "ib-ai-sl": "bank_ib_ai_sl",
};

export const PREVIEW_QUESTION_IDS: Record<BankSlug, readonly string[]> = {
  igcse: [
    "0580-2016-march-22-q1",
    "0580-2016-march-22-q2",
    "0580-2016-march-22-q3",
  ],
  "igcse-additional": [
    "0606-2016-march-12-q1",
    "0606-2016-march-12-q2",
    "0606-2016-march-12-q3",
  ],
  "ib-hl": [
    "2017-may-tz1-p1-q1",
    "2017-may-tz1-p1-q2",
    "2017-may-tz1-p1-q3",
  ],
  "ib-sl": [
    "2017-may-p1-tz1-q1",
    "2017-may-p1-tz1-q2",
    "2017-may-p1-tz1-q3",
  ],
  "ib-ai-hl": [
    "2021-may-tz1-p1-q1",
    "2021-may-tz1-p1-q2",
    "2021-may-tz1-p1-q3",
  ],
  "ib-ai-sl": [
    "2021-may-tz1-p1-q1",
    "2021-may-tz1-p1-q2",
    "2021-may-tz1-p1-q3",
  ],
};

export const FREE_QUESTION_YEARS: Record<BankSlug, readonly number[]> = {
  igcse: [2016, 2017, 2018],
  "igcse-additional": [2016, 2017, 2018],
  "ib-hl": [2017],
  "ib-sl": [2017],
  "ib-ai-hl": [2021],
  "ib-ai-sl": [2021],
};

function isCurrent(entitlement: AccessEntitlement, now: Date): boolean {
  if (entitlement.status !== "active" && entitlement.status !== "trialing") return false;
  if (!entitlement.startsAt) return false;
  const startsAt = new Date(entitlement.startsAt).getTime();
  if (!Number.isFinite(startsAt) || startsAt > now.getTime()) return false;
  if (!entitlement.expiresAt) return true;
  const expiresAt = new Date(entitlement.expiresAt).getTime();
  return Number.isFinite(expiresAt) && expiresAt > now.getTime();
}

export function hasBankAccess(
  bankSlug: BankSlug,
  entitlements: readonly AccessEntitlement[],
  now = new Date(),
): boolean {
  const bankProduct = BANK_PRODUCTS[bankSlug];
  return entitlements.some(
    (entitlement) =>
      isCurrent(entitlement, now) &&
      (entitlement.productId === bankProduct || entitlement.productId === "bundle_all"),
  );
}

export function isPreviewQuestion(bankSlug: BankSlug, questionId: string): boolean {
  const match = bankSlug === "igcse"
    ? /^0580-(\d{4})-/.exec(questionId)
    : bankSlug === "igcse-additional"
      ? /^0606-(\d{4})-/.exec(questionId)
      : /^(\d{4})-/.exec(questionId);
  if (!match) return false;
  return FREE_QUESTION_YEARS[bankSlug].includes(Number(match[1]));
}

export function canViewQuestionAsset(
  bankSlug: BankSlug,
  questionId: string,
  entitlements: readonly AccessEntitlement[],
  now = new Date(),
): boolean {
  return isPreviewQuestion(bankSlug, questionId) || hasBankAccess(bankSlug, entitlements, now);
}

export function canViewAnswer(
  bankSlug: BankSlug,
  questionId: string,
  entitlements: readonly AccessEntitlement[],
  now = new Date(),
): boolean {
  return isPreviewQuestion(bankSlug, questionId) || hasBankAccess(bankSlug, entitlements, now);
}

export function canExportPdf(
  bankSlug: BankSlug,
  entitlements: readonly AccessEntitlement[],
  now = new Date(),
): boolean {
  return hasBankAccess(bankSlug, entitlements, now);
}
