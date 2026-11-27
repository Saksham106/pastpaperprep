import "server-only";
import { randomUUID } from "node:crypto";
import { stableAnalyticsDistinctId } from "@/lib/analytics-consent";
import { hasCurrentConsent } from "@/lib/server-conversion-analytics";

/**
 * PostHog LLM analytics for Pepper: one `$ai_generation` event per model call.
 * Property names follow https://posthog.com/docs/llm-analytics/manual-capture.
 *
 * PRIVACY: counts and fixed vocabularies only. Prompts, replies, tool inputs/outputs, photos and question text are
 * never read here: every property is picked by name from a typed allowlist, so extra fields passed in are dropped.
 */

/** One model call, as reported by runSiteAgent's `onRound`. */
export type HelperRoundStats = {
  /** Zero-based, same as the helper_usage log. */
  round: number;
  model: string;
  stopReason: string | null;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  latencyMs: number;
  error: boolean;
  /** The student stopped the reply (stream aborted); not counted as an error. */
  cancelled?: boolean;
  httpStatus?: number;
};

/** Bounded per-message context. */
export type HelperTraceMeta = {
  surface: "question" | "site";
  mode?: string;
  photo?: boolean;
  bank?: string;
  refused?: boolean;
  navigated?: boolean;
  /** Credits reserved for the message when it started. */
  creditsReserved?: number;
  /** Credits actually charged: 0 when they were given back (nothing reached the student). */
  creditsSpent?: number;
  tier?: string;
};

const SURFACES = new Set(["question", "site"]);
const SAFE_WORD = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const num = (value: unknown, fallback = 0) => (typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : fallback);

/** Pure: the `$ai_generation` property bag for one round. Exported for tests. */
export function buildGenerationProperties(
  traceId: string,
  round: HelperRoundStats,
  roundsTotal: number,
  meta: HelperTraceMeta,
  consented: boolean,
): Record<string, string | number | boolean> {
  const properties: Record<string, string | number | boolean> = {
    $ai_trace_id: traceId,
    $ai_span_id: randomUUID(),
    $ai_span_name: "pepper_round",
    $ai_model: typeof round.model === "string" ? round.model.slice(0, 100) : "unknown",
    $ai_provider: "anthropic",
    $ai_input_tokens: num(round.inputTokens),
    $ai_output_tokens: num(round.outputTokens),
    $ai_cache_read_input_tokens: num(round.cacheReadTokens),
    $ai_cache_creation_input_tokens: num(round.cacheWriteTokens),
    $ai_latency: Math.round(num(round.latencyMs)) / 1000,
    $ai_stream: true,
    $ai_is_error: round.error === true && round.cancelled !== true,
    $process_person_profile: consented,
    $geoip_disable: true,
    round: num(round.round),
    rounds_total: num(roundsTotal),
    surface: SURFACES.has(meta.surface) ? meta.surface : "site",
  };
  if (typeof round.stopReason === "string" && SAFE_WORD.test(round.stopReason)) properties.$ai_stop_reason = round.stopReason;
  if (typeof round.httpStatus === "number" && Number.isInteger(round.httpStatus) && round.httpStatus >= 100 && round.httpStatus < 600) properties.$ai_http_status = round.httpStatus;
  if (typeof meta.mode === "string" && SAFE_WORD.test(meta.mode)) properties.mode = meta.mode;
  if (typeof meta.photo === "boolean") properties.photo = meta.photo;
  if (typeof meta.bank === "string" && SAFE_WORD.test(meta.bank)) properties.bank = meta.bank;
  if (typeof meta.refused === "boolean") properties.refused = meta.refused;
  if (typeof meta.navigated === "boolean") properties.navigated = meta.navigated;
  if (round.cancelled === true) properties.cancelled = true;
  if (typeof meta.creditsReserved === "number" && Number.isFinite(meta.creditsReserved) && meta.creditsReserved >= 0) properties.credits_reserved = meta.creditsReserved;
  if (typeof meta.creditsSpent === "number" && Number.isFinite(meta.creditsSpent) && meta.creditsSpent >= 0) properties.credits_spent = meta.creditsSpent;
  if (typeof meta.tier === "string" && SAFE_WORD.test(meta.tier)) properties.tier = meta.tier;
  return properties;
}

/**
 * Best-effort: one batched POST for all rounds of a message. Never throws, no token means no-op. One consent lookup
 * per message, and only when the request's own browser has opted in. Linked to the account only when the browser's
 * consent cookie accepts AND the account's stored acceptance is current; otherwise a random per-trace anonymous id.
 */
export async function captureHelperGenerations(input: { userId: string; browserConsent: boolean; rounds: HelperRoundStats[]; meta: HelperTraceMeta }): Promise<void> {
  try {
    const token = process.env.POSTHOG_PROJECT_TOKEN ?? process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
    if (!token || !input.rounds.length) return;
    const base = new URL(process.env.POSTHOG_HOST || process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com");
    if (base.protocol !== "https:" || base.username || base.password || base.search || base.hash) return;
    // Linked to the account only like browser analytics: this browser opted in AND the account's acceptance is current.
    const consented = input.browserConsent === true && input.userId ? await hasCurrentConsent(input.userId) : false;
    const traceId = randomUUID();
    const distinctId = (consented ? stableAnalyticsDistinctId(input.userId) : null) ?? `anon:${randomUUID()}`;
    const timestamp = new Date().toISOString();
    const batch = input.rounds.map((round) => ({
      event: "$ai_generation",
      distinct_id: distinctId,
      timestamp,
      properties: buildGenerationProperties(traceId, round, input.rounds.length, input.meta, consented),
    }));
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1_500);
    try {
      await fetch(new URL("/batch/", base), {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({ api_key: token, batch }),
      });
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    // Analytics must never affect the helper.
  }
}
