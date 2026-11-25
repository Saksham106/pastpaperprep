import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { hasBankAccess, type AccessEntitlement } from "@/lib/access";
import { BANKS, type BankSlug } from "@/lib/banks";
import { fetchAccessEntitlements } from "@/lib/custom-bundle-access";
import { consumeHelperAllowance, releaseHelperAllowance } from "@/lib/helper/allowance";
import { HELPER_DAILY_LIMITS } from "@/lib/helper/config";
import { HELPER_SITE_CUT_OFF, runSiteAgent, type Send } from "@/lib/helper/site-agent";
import { buildSiteMessages } from "@/lib/helper/site-prompt";
import { parseSiteHelperRequest } from "@/lib/helper/site-request";
import { siteShortcut } from "@/lib/helper/site-shortcut";
import { loadSiteData, type SiteData } from "@/lib/helper/site-tools";
import { withFailureReporting } from "@/lib/route-failure-reporting";
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
  // The shared allowance (src/lib/helper/allowance.ts): same counter, kill switch and site-wide cap as /api/helper.
  const allowance = await consumeHelperAllowance(supabase as never, limit);
  if (allowance.status !== "ok") {
    if (allowance.status === "disabled") return jsonError("The study helper is paused right now. Try again later.", 503);
    if (allowance.status === "busy") return jsonError("The helper is very busy today. Try again tomorrow.", 503);
    if (allowance.status === "error") return jsonError("Could not check your daily allowance", 503);
    return jsonError(paid ? "You've used today's helper messages. Try again tomorrow." : `You've used today's ${limit} free helper messages. Try again tomorrow, or upgrade for more.`, 429, { limit });
  }
  const { charge } = allowance;

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
          // Practice sets follow the paper builder's rule: only banks the student's plan covers.
          tools: { canBuild: (bank) => hasBankAccess(bank as BankSlug, entitlements) },
        });
        if (!result.sentText && !result.navigated) {
          // Nothing reached the student: give the message back.
          await releaseHelperAllowance(userId, charge);
          send({ type: "error", message: REFUSED, status: 422 });
        } else {
          send({ type: "done", remaining: charge.remaining, limit });
        }
      } catch (error) {
        if (abort.signal.aborted) return;
        if (!sentText) await releaseHelperAllowance(userId, charge);
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
      "X-Helper-Remaining": String(charge.remaining),
      "X-Helper-Limit": String(limit),
    },
  });
}

export const POST = withFailureReporting("/api/helper/site", handlePOST);
