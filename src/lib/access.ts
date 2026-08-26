import type { BankSlug } from "@/lib/banks";

export type ProductId = "bank_igcse" | "bank_ib_hl" | "bank_ib_sl" | "bank_ib_ai_hl" | "bank_ib_ai_sl" | "bundle_all";
export type EntitlementStatus = "active" | "trialing" | "expired" | "revoked";

export type AccessEntitlement = {
  productId: ProductId;
  status: EntitlementStatus;
  startsAt: string | null;
  expiresAt: string | null;
};

const BANK_PRODUCTS: Record<BankSlug, ProductId> = {
  igcse: "bank_igcse",
  "ib-hl": "bank_ib_hl",
  "ib-sl": "bank_ib_sl",
  "ib-ai-hl": "bank_ib_ai_hl",
  "ib-ai-sl": "bank_ib_ai_sl",
};

export const PREVIEW_QUESTION_IDS: Record<BankSlug, readonly string[]> = {
  igcse: [
    "0580-2026-march-22-q1",
    "0580-2026-march-22-q2",
    "0580-2026-march-22-q3",
  ],
  "ib-hl": [
    "2026-may-tza-p1-q1",
    "2026-may-tza-p1-q2",
    "2026-may-tza-p1-q3",
  ],
  "ib-sl": [
    "m26-math-aasl-p1-tza-q1",
    "m26-math-aasl-p1-tza-q2",
    "m26-math-aasl-p1-tza-q3",
  ],
  "ib-ai-hl": [
    "2025-november-tz0-p1-q1",
    "2025-november-tz0-p1-q2",
    "2025-november-tz0-p1-q3",
  ],
  "ib-ai-sl": [
    "2025-november-tz1-p1-q1",
    "2025-november-tz1-p1-q2",
    "2025-november-tz1-p1-q3",
  ],
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
  return PREVIEW_QUESTION_IDS[bankSlug].includes(questionId);
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
