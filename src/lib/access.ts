import type { BankSlug, ProductionBankSlug } from "@/lib/banks";
import { BANK_CATALOG } from "@/lib/catalog";

export type ProductId = "bank_igcse" | "bank_igcse_additional" | "bank_ib_hl" | "bank_ib_sl" | "bank_ib_ai_hl" | "bank_ib_ai_sl" | "bank_ib_chemistry_hl" | "bank_ib_chemistry_sl" | "bank_ib_physics_hl" | "bank_ib_physics_sl" | "bank_ib_biology_hl" | "bank_ib_biology_sl" | "bank_ib_economics_hl" | "bank_ib_economics_sl" | "bank_igcse_biology_0610" | "bank_igcse_economics_0455" | "bank_igcse_chemistry_0620" | "bank_igcse_physics_0625" | "bank_igcse_coordinated_sciences_0654" | "bundle_igcse" | "bundle_ib_aa" | "bundle_ib_ai" | "bundle_ib_chemistry" | "bundle_ib_physics" | "bundle_ib_biology" | "bundle_ib_economics" | "bundle_all" | "bundle_custom";
export type EntitlementStatus = "active" | "trialing" | "expired" | "revoked";

export type AccessEntitlement = {
  productId: ProductId;
  selectedBankIds?: readonly BankSlug[];
  status: EntitlementStatus;
  startsAt: string | null;
  expiresAt: string | null;
};

export const BANK_PRODUCTS: Partial<Record<BankSlug, ProductId>> = Object.fromEntries(
  BANK_CATALOG.filter((bank) => bank.productId).map((bank) => [bank.slug, bank.productId]),
) as Partial<Record<BankSlug, ProductId>>;

const BANK_BUNDLES: Partial<Record<BankSlug, readonly ProductId[]>> = Object.fromEntries(
  BANK_CATALOG.filter((bank) => bank.bundleProductId).map((bank) => [bank.slug, [bank.bundleProductId as ProductId]]),
) as Partial<Record<BankSlug, readonly ProductId[]>>;

export const PREVIEW_QUESTION_IDS: Record<ProductionBankSlug, readonly string[]> = {
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
  "ib-chemistry-hl": [
    "2020-november-tz0-hl-p1-q1",
    "2020-november-tz0-hl-p1-q2",
    "2020-november-tz0-hl-p1-q3",
  ],
  "ib-chemistry-sl": [
    "2020-november-tz0-sl-p1-q1",
    "2020-november-tz0-sl-p1-q2",
    "2020-november-tz0-sl-p1-q3",
  ],
  "ib-physics-hl": [
    "2020-november-tz0-hl-p1-q1",
    "2020-november-tz0-hl-p1-q2",
    "2020-november-tz0-hl-p1-q3",
  ],
  "ib-physics-sl": [
    "2020-november-tz0-sl-p1-q1",
    "2020-november-tz0-sl-p1-q2",
    "2020-november-tz0-sl-p1-q3",
  ],
  "ib-biology-hl": [
    "2020-november-tz0-hl-p1-q1",
    "2020-november-tz0-hl-p1-q2",
    "2020-november-tz0-hl-p1-q3",
  ],
  "ib-biology-sl": [
    "2020-november-tz0-sl-p1-q1",
    "2020-november-tz0-sl-p1-q2",
    "2020-november-tz0-sl-p1-q3",
  ],
};

export const FREE_QUESTION_YEARS: Record<ProductionBankSlug, readonly number[]> = {
  igcse: [2016, 2017, 2018],
  "igcse-additional": [2016, 2017, 2018],
  "ib-hl": [2017],
  "ib-sl": [2017],
  "ib-ai-hl": [2021],
  "ib-ai-sl": [2021],
  "ib-chemistry-hl": [2020],
  "ib-chemistry-sl": [2020],
  "ib-physics-hl": [2020],
  "ib-physics-sl": [2020],
  "ib-biology-hl": [2020],
  "ib-biology-sl": [2020],
};

/**
 * The free funnel must be uniform across every bank the dashboard advertises with
 * `?free=1`. Published banks already carry explicit free years; the private release
 * banks (gated IGCSE and the gated IB Economics banks) reuse the SAME semantics with
 * their own explicit, documented, deterministic subset, so an anonymous visitor who
 * clicks an advertised free link always gets a non-empty set of real questions whose
 * assets are signed, while every other question, answer, and PDF stays gated.
 *
 * `PRIVATE_FREE_QUESTION_YEARS` — one documented older exam year per private bank.
 * `PRIVATE_PREVIEW_QUESTION_IDS` — an explicit ID set, used only where a bank has no
 * usable year semantics. Both are authoritative, never inferred from the corpus.
 */
export const PRIVATE_FREE_QUESTION_YEARS: Partial<Record<BankSlug, readonly number[]>> = {
  "igcse-biology-0610": [2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026],
  "igcse-economics-0455": [2021],
  "igcse-chemistry-0620": [2021],
  "igcse-physics-0625": [2021],
  "igcse-coordinated-sciences-0654": [2021],
  "ib-economics-hl": [2021],
  "ib-economics-sl": [2021],
};

export const PRIVATE_PREVIEW_QUESTION_IDS: Partial<Record<BankSlug, readonly string[]>> = {};

/** Pure syllabus-prefixed id (`0580-2016-…`, `0654-2021-…`), then the IB year-first form. */
const SYLLABUS_PREFIXED_ID = /^(?:\d{4})-(\d{4})-/;
const YEAR_FIRST_ID = /^(\d{4})-/;

export function questionYear(questionId: string): number | null {
  const prefixed = SYLLABUS_PREFIXED_ID.exec(questionId);
  if (prefixed) return Number(prefixed[1]);
  const yearFirst = YEAR_FIRST_ID.exec(questionId);
  return yearFirst ? Number(yearFirst[1]) : null;
}

export function freeQuestionYears(bankSlug: BankSlug): readonly number[] | undefined {
  return PRIVATE_FREE_QUESTION_YEARS[bankSlug] ?? FREE_QUESTION_YEARS[bankSlug as ProductionBankSlug];
}

/** True when the bank genuinely has a non-empty free subset to advertise. */
export function hasFreeTier(bankSlug: BankSlug): boolean {
  return Boolean(freeQuestionYears(bankSlug)?.length) || Boolean(PRIVATE_PREVIEW_QUESTION_IDS[bankSlug]?.length);
}

/** The canonical free-bank link, or the plain bank link when a bank has no free tier. */
export function bankEntryHref(bankSlug: BankSlug): string {
  return hasFreeTier(bankSlug) ? `/banks/${bankSlug}?free=1` : `/banks/${bankSlug}`;
}

export function countFreeQuestions(bankSlug: BankSlug, questions: readonly { id: string }[]): number {
  return questions.filter((question) => isPreviewQuestion(bankSlug, question.id)).length;
}

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
      (Boolean(bankProduct) && entitlement.productId === bankProduct || BANK_BUNDLES[bankSlug]?.includes(entitlement.productId) || entitlement.productId === "bundle_all" ||
        (entitlement.productId === "bundle_custom" && entitlement.selectedBankIds?.includes(bankSlug))),
  );
}

export function isPreviewQuestion(bankSlug: BankSlug, questionId: string): boolean {
  const explicit = PRIVATE_PREVIEW_QUESTION_IDS[bankSlug];
  if (explicit) return explicit.includes(questionId);
  const years = freeQuestionYears(bankSlug);
  if (!years?.length) return false;
  const year = questionYear(questionId);
  return year !== null && years.includes(year);
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
