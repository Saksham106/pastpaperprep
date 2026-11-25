import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { hasBankAccess, type AccessEntitlement } from "@/lib/access";
import { BANKS } from "@/lib/banks";
import { fetchAccessEntitlements } from "@/lib/custom-bundle-access";
import { HELPER_DAILY_LIMITS } from "@/lib/helper/config";
import { HELPER_SITE_CUT_OFF, runSiteAgent, type Send } from "@/lib/helper/site-agent";
import { buildSiteMessages } from "@/lib/helper/site-prompt";
import { parseSiteHelperRequest } from "@/lib/helper/site-request";
import { siteShortcut } from "@/lib/helper/site-shortcut";
import { loadSiteData, type SiteData } from "@/lib/helper/site-tools";
import { withFailureReporting } from "@/lib/route-failure-reporting";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 120;

const NO_STORE = { "Cache-Control": "private, no-store, max-age=0" } as const;
const DEFAULT_MODEL = "claude-opus-5-5";
const BUSY = "The helper is busy right now. Try again in a minute.";
const FAILED = "The helper couldn't answer. Try again.";
const REFUSED = "I can't help with that one. Try asking in a different way.";

const jsonError = (error: string, status: number, extra: Record<string, unknown> = {}) => NextResponse.json({ error, ...extra }, { status, headers: NO_STORE });

let client: Anthropic | undefined;
function anthropic(): Anthropic {
  client ??= new Anthropic();
  return client;
}

async function releaseAllowance(userId: string) {
  try {
    await createAdminClient().rpc("release_helper_allowance", { p_user_id: userId });
  } catch {
    // A lost refund costs the student one message at worst.
  }
}

async function handlePOST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) return jsonError("The study helper isn't available yet.", 503);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON", 400);
  }
  const parsed = parseSiteHelperRequest(body);
  if (!parsed) return jsonError("Invalid helper request", 400);

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = typeof claimsData?.claims?.sub === "string" ? claimsData.claims.sub : null;
  if (!userId) return jsonError("Sign in required", 401);

  const accessResult = await fetchAccessEntitlements(supabase as never, userId);
  if (accessResult.error) return jsonError("Could not verify access", 503);
  const entitlements = accessResult.rows as AccessEntitlement[];

  let data: SiteData;
  try {
    data = await loadSiteData();
  } catch (error) {
    console.error(JSON.stringify({ event: "helper_site_data_failed", error: error instanceof Error ? error.message.slice(0, 200) : "unknown" }));
    return jsonError(FAILED, 503);
  }

  // Rules first: an exact paper, topic or subject opens with no model call and costs the student nothing.
  const last = parsed.messages[parsed.messages.length - 1].text;
  const shortcut = siteShortcut(data, last, parsed.page, parsed.messages.length > 1);
  if (shortcut) {
    console.info(JSON.stringify({ event: "helper_usage", surface: "site", rules: true, kind: shortcut.navigation.kind }));
    const lines = [{ type: "navigate", ...shortcut.navigation }, { type: "text", text: shortcut.reply }, { type: "done", rules: true }];
    return new Response(lines.map((line) => JSON.stringify(line)).join("\n") + "\n", { headers: { ...NO_STORE, "Content-Type": "application/x-ndjson; charset=utf-8" } });
  }

  const paid = BANKS.some((entry) => hasBankAccess(entry.slug, entitlements));
  const limit = paid ? HELPER_DAILY_LIMITS.paid : HELPER_DAILY_LIMITS.free;
  const { data: remaining, error: quotaError } = await supabase.rpc("consume_helper_allowance", { p_limit: limit });
  if (quotaError || typeof remaining !== "number") return jsonError("Could not check your daily allowance", 503);
  if (remaining < 0) {
    return jsonError(paid ? "You've used today's helper messages. Try again tomorrow." : `You've used today's ${limit} free helper messages. Try again tomorrow, or upgrade for more.`, 429, { limit });
  }

  const encoder = new TextEncoder();
  const abort = new AbortController();
  const body$ = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send: Send = (event) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      let sentText = false;
      try {
        const result = await runSiteAgent({
          api: anthropic().beta.messages,
          model: process.env.HELPER_MODEL?.trim() || DEFAULT_MODEL,
          data,
          messages: buildSiteMessages(parsed),
          send: (event) => { if (event.type === "text") sentText = true; send(event); },
          signal: abort.signal,
        });
        if (!result.sentText && !result.navigated) {
          // Nothing reached the student: give the message back.
          await releaseAllowance(userId);
          send({ type: "error", message: REFUSED, status: 422 });
        } else {
          send({ type: "done", remaining, limit });
        }
      } catch (error) {
        if (abort.signal.aborted) return;
        if (!sentText) await releaseAllowance(userId);
        const busy = error instanceof Anthropic.RateLimitError || (error instanceof Anthropic.APIError && (error.status ?? 0) >= 500);
        if (sentText) send({ type: "text", text: HELPER_SITE_CUT_OFF });
        send({ type: "error", message: busy ? BUSY : FAILED, status: busy ? 503 : 502 });
      } finally {
        try { controller.close(); } catch { /* already closed by a cancel */ }
      }
    },
    cancel() {
      abort.abort();
    },
  });

  return new Response(body$, {
    headers: {
      ...NO_STORE,
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "X-Helper-Remaining": String(remaining),
      "X-Helper-Limit": String(limit),
    },
  });
}

export const POST = withFailureReporting("/api/helper/site", handlePOST);
