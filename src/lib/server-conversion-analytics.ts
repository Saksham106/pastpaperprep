import "server-only";
import { createHash, createHmac, randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { ANALYTICS_CONSENT_MAX_AGE_SECONDS, stableAnalyticsDistinctId } from "@/lib/analytics-consent";
import { hasBankAccess, type ProductId } from "@/lib/access";
import { BANK_CATALOG } from "@/lib/catalog";
import { validateCustomBankIds } from "@/lib/custom-bundles";
import type { BankSlug } from "@/lib/banks";

type ConversionOutcome = "signup_confirmed" | "payment_initial_paid" | "payment_renewal_paid" | "lifetime_paid";
type ConversionInput = {
  /** Canonical app account ID resolved by the authenticated/server billing path. */
  userId: string;
  outcome: ConversionOutcome;
  /** Stable only for this exact source event; never an account identifier. */
  eventKey: string;
  occurredAt: string;
  product?: string | null;
  interval?: string | null;
  /** Custom bundles only: the banks the buyer picked (Stripe subscription `selected_bank_ids`). */
  selectedBankIds?: unknown;
};

const UUID_NAMESPACE = "a88d86f5-91e9-5c98-bf52-92e5f33193a1";
const PRODUCTS = new Set([
  "bank_igcse", "bank_igcse_additional", "bank_ib_hl", "bank_ib_sl", "bank_ib_ai_hl", "bank_ib_ai_sl",
  "bank_ib_chemistry_hl", "bank_ib_chemistry_sl", "bank_ib_physics_hl", "bank_ib_physics_sl", "bank_ib_biology_hl", "bank_ib_biology_sl", "bank_ib_economics_hl", "bank_ib_economics_sl",
  "bank_igcse_biology_0610", "bank_igcse_economics_0455", "bank_igcse_chemistry_0620", "bank_igcse_physics_0625", "bank_igcse_coordinated_sciences_0654", "bank_igcse_computer_science_0478",
  "bundle_igcse", "bundle_ib_aa", "bundle_ib_ai", "bundle_ib_chemistry", "bundle_ib_physics", "bundle_ib_biology", "bundle_ib_economics", "bundle_all", "bundle_custom",
  "lifetime_all_access",
]);
const INTERVALS = new Set(["monthly", "annual"]);

/**
 * Which banks a purchase covers, using the same rule as access checks (`hasBankAccess`), so
 * "what do people pay for" can be broken down by bank. All-access products are summarised as
 * `scope: "all"` instead of listing every bank.
 */
export function purchasedBanks(product: string | null | undefined, selectedBankIds?: unknown): { banks: BankSlug[]; scope: "all" | "banks" } | null {
  if (!product || !PRODUCTS.has(product)) return null;
  if (product === "bundle_all" || product === "lifetime_all_access") return { banks: [], scope: "all" };
  let selected: BankSlug[] | undefined;
  if (product === "bundle_custom") {
    try { selected = validateCustomBankIds(typeof selectedBankIds === "string" ? JSON.parse(selectedBankIds) : selectedBankIds); } catch { return null; }
  }
  const entitlement = { productId: product as ProductId, selectedBankIds: selected, status: "active" as const, startsAt: "2000-01-01T00:00:00Z", expiresAt: null };
  const banks = BANK_CATALOG.map(bank => bank.slug).filter(slug => hasBankAccess(slug, [entitlement]));
  return banks.length ? { banks, scope: "banks" } : null;
}

function eventUuid(eventKey: string): string {
  const namespace = Buffer.from(UUID_NAMESPACE.replaceAll("-", ""), "hex");
  const digest = createHash("sha1").update(namespace).update(eventKey).digest().subarray(0, 16);
  digest[6] = (digest[6] & 0x0f) | 0x50;
  digest[8] = (digest[8] & 0x3f) | 0x80;
  const hex = digest.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Best-effort, bounded PostHog capture. Never throws or logs provider data.
 * With current analytics consent the event is tied to the account; otherwise it is an
 * anonymous count (no account ID, no person profile) so the funnel stays measurable.
 */
export async function captureConversionOutcome(input: ConversionInput): Promise<void> {
  const token = process.env.POSTHOG_PROJECT_TOKEN ?? process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
  if (!token || !input.userId || input.eventKey.length < 1 || input.eventKey.length > 256) return;
  try {
    const consented = await hasCurrentConsent(input.userId);
    const timestamp = new Date(input.occurredAt);
    if (!Number.isFinite(timestamp.getTime())) return;
    const host = process.env.POSTHOG_HOST ?? process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";
    const base = new URL(host);
    if (base.protocol !== "https:" || base.username || base.password || base.search || base.hash) return;
    // Without consent, ids come from a keyed hash of the event key: retries still dedupe, but
    // nobody holding an account or invoice ID can recompute them and link the count to a person.
    const idSource = consented ? input.eventKey : anonymousIdSource(input.eventKey);
    const eventId = eventUuid(`uuid:${idSource}`);
    const properties: Record<string, string | boolean | number | string[]> = {
      outcome: input.outcome,
      $insert_id: eventUuid(`insert:${idSource}`),
      // PostHog's documented event UUID deduplication property; key by invoice ID upstream.
      $uuid: eventId,
      $process_person_profile: consented,
      $geoip_disable: true,
      identified: consented,
    };
    if (input.product && PRODUCTS.has(input.product)) properties.product = input.product;
    if (input.interval && INTERVALS.has(input.interval)) properties.interval = input.interval;
    const covered = input.outcome === "signup_confirmed" ? null : purchasedBanks(input.product, input.selectedBankIds);
    if (covered) {
      properties.bank_scope = covered.scope;
      properties.bank_count = covered.banks.length;
      if (covered.scope === "banks") properties.banks = covered.banks;
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1_500);
    try {
      await fetch(new URL("/i/v0/e/", base), {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          api_key: token,
          event: "conversion_outcome",
          distinct_id: consented ? stableAnalyticsDistinctId(input.userId) : `anon:${eventUuid(`anon:${idSource}`)}`,
          uuid: eventId,
          timestamp: timestamp.toISOString(),
          properties,
        }),
      });
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    // Analytics must not change the outcome of auth, billing, or webhook processing.
  }
}

/** Keyed by a server-only secret; a one-off random id when none is configured (no dedupe, never linkable). */
function anonymousIdSource(eventKey: string): string {
  const secret = process.env.SUPABASE_SECRET_KEY;
  return secret ? createHmac("sha256", secret).update(`ppp-analytics-anon-v1:${eventKey}`).digest("hex") : randomUUID();
}

/** True only for an accepted v2 consent recorded in the last twelve months. Any lookup problem is "no". */
async function hasCurrentConsent(userId: string): Promise<boolean> {
  try {
    const lookup = createAdminClient().auth.admin.getUserById(userId);
    let lookupTimer: ReturnType<typeof setTimeout> | undefined;
    let result;
    try {
      result = await Promise.race([
        lookup,
        new Promise<null>((resolve) => { lookupTimer = setTimeout(() => resolve(null), 500); }),
      ]);
    } finally { if (lookupTimer) clearTimeout(lookupTimer); }
    const consent = result && "data" in result ? result.data.user?.user_metadata?.analytics_consent : null;
    const updatedAt = typeof consent?.updated_at === "string" ? Date.parse(consent.updated_at) : NaN;
    return Boolean(result && "data" in result && !result.error && result.data.user && result.data.user.id === userId && consent?.accepted === true && consent?.version === 2 &&
      Number.isFinite(updatedAt) && updatedAt <= Date.now() + 120_000 && Date.now() - updatedAt <= ANALYTICS_CONSENT_MAX_AGE_SECONDS * 1000);
  } catch {
    return false;
  }
}
