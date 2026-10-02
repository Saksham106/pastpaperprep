import "server-only";
import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { stableAnalyticsDistinctId } from "@/lib/analytics-consent";

type ConversionOutcome = "signup_confirmed" | "payment_initial_paid" | "payment_renewal_paid";
type ConversionInput = {
  /** Canonical app account ID resolved by the authenticated/server billing path. */
  userId: string;
  outcome: ConversionOutcome;
  /** Stable only for this exact source event; never an account identifier. */
  eventKey: string;
  occurredAt: string;
  product?: string | null;
  interval?: string | null;
};

const UUID_NAMESPACE = "a88d86f5-91e9-5c98-bf52-92e5f33193a1";
const PRODUCTS = new Set([
  "bank_igcse", "bank_igcse_additional", "bank_ib_hl", "bank_ib_sl", "bank_ib_ai_hl", "bank_ib_ai_sl",
  "bank_ib_chemistry_hl", "bank_ib_chemistry_sl", "bank_ib_physics_hl", "bank_ib_physics_sl", "bank_ib_biology_hl", "bank_ib_biology_sl", "bank_ib_economics_hl", "bank_ib_economics_sl",
  "bank_igcse_biology_0610", "bank_igcse_economics_0455", "bank_igcse_chemistry_0620", "bank_igcse_physics_0625", "bank_igcse_coordinated_sciences_0654",
  "bundle_igcse", "bundle_ib_aa", "bundle_ib_ai", "bundle_ib_chemistry", "bundle_ib_physics", "bundle_ib_biology", "bundle_ib_economics", "bundle_all", "bundle_custom",
]);
const INTERVALS = new Set(["monthly", "annual"]);

function eventUuid(eventKey: string): string {
  const namespace = Buffer.from(UUID_NAMESPACE.replaceAll("-", ""), "hex");
  const digest = createHash("sha1").update(namespace).update(eventKey).digest().subarray(0, 16);
  digest[6] = (digest[6] & 0x0f) | 0x50;
  digest[8] = (digest[8] & 0x3f) | 0x80;
  const hex = digest.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Best-effort, bounded PostHog capture. Never throws or logs provider data. */
export async function captureConversionOutcome(input: ConversionInput): Promise<void> {
  const token = process.env.POSTHOG_PROJECT_TOKEN ?? process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
  if (!token || !input.userId || input.eventKey.length < 1 || input.eventKey.length > 256) return;
  try {
    const lookup = createAdminClient().auth.admin.getUserById(input.userId);
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
    if (!result || !("data" in result) || result.error || !result.data.user || result.data.user.id !== input.userId || consent?.accepted !== true || consent?.version !== 1 ||
      !Number.isFinite(updatedAt) || updatedAt > Date.now() + 120_000 || Date.now() - updatedAt > 180 * 24 * 60 * 60 * 1000) return;
    const timestamp = new Date(input.occurredAt);
    if (!Number.isFinite(timestamp.getTime())) return;
    const host = process.env.POSTHOG_HOST ?? process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";
    const base = new URL(host);
    if (base.protocol !== "https:" || base.username || base.password || base.search || base.hash) return;
    const properties: Record<string, string | boolean> = {
      outcome: input.outcome,
      $insert_id: eventUuid(`insert:${input.eventKey}`),
      // PostHog's documented event UUID deduplication property; key by invoice ID upstream.
      $uuid: eventUuid(`uuid:${input.eventKey}`),
      $process_person_profile: true,
    };
    if (input.product && PRODUCTS.has(input.product)) properties.product = input.product;
    if (input.interval && INTERVALS.has(input.interval)) properties.interval = input.interval;
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
          distinct_id: stableAnalyticsDistinctId(input.userId),
          uuid: eventUuid(`uuid:${input.eventKey}`),
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
