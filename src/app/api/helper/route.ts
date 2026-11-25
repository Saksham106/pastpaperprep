import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { hasBankAccess, type AccessEntitlement } from "@/lib/access";
import { BANKS, getBank, type BankSlug } from "@/lib/banks";
import { fetchAccessEntitlements } from "@/lib/custom-bundle-access";
import { HELPER_BOARDS, HELPER_DAILY_LIMITS, helperBoard, type HelperMode } from "@/lib/helper/config";
import { consumeHelperAllowance, releaseHelperAllowance } from "@/lib/helper/allowance";
import { HelperAccessError, loadHelperContext } from "@/lib/helper/context";
import { buildHelperMessages, HELPER_SYSTEM_PROMPT } from "@/lib/helper/prompt";
import { parseHelperRequest } from "@/lib/helper/request";
import { currentQuestionId } from "@/lib/question-id-aliases";
import { withFailureReporting } from "@/lib/route-failure-reporting";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 120;

const NO_STORE = { "Cache-Control": "private, no-store, max-age=0" } as const;
const DEFAULT_MODEL = "claude-opus-5-5";
const EFFORT: Readonly<Record<HelperMode, "low" | "medium">> = { hint: "low", chat: "low", explain: "low", mark: "medium" };
const CUT_OFF_NOTE = "\n\n_Sorry, that answer was cut off. Try again._";

const jsonError = (error: string, status: number) => NextResponse.json({ error }, { status, headers: NO_STORE });

function helperModel(): string {
  return process.env.HELPER_MODEL?.trim() || DEFAULT_MODEL;
}

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
  const parsed = parseHelperRequest(body);
  if (!parsed || !getBank(parsed.bank)) return jsonError("Invalid helper request", 400);
  const bank = parsed.bank as BankSlug;
  if (!HELPER_BOARDS[helperBoard(bank)]) return jsonError("The study helper isn't available for this subject yet.", 403);
  const questionId = currentQuestionId(bank, parsed.questionId);

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = typeof claimsData?.claims?.sub === "string" ? claimsData.claims.sub : null;
  if (!userId) return jsonError("Sign in required", 401);

  const accessResult = await fetchAccessEntitlements(supabase as never, userId);
  if (accessResult.error) return jsonError("Could not verify access", 503);
  const entitlements = accessResult.rows as AccessEntitlement[];

  let context;
  try {
    context = await loadHelperContext(bank, questionId, entitlements);
  } catch (error) {
    if (error instanceof HelperAccessError) return jsonError("Access required", 403);
    console.error(JSON.stringify({ event: "helper_context_failed", bank, error: error instanceof Error ? error.message.slice(0, 200) : "unknown" }));
    return jsonError("The question could not load. Try again.", 503);
  }

  const paid = BANKS.some((entry) => hasBankAccess(entry.slug, entitlements));
  const limit = paid ? HELPER_DAILY_LIMITS.paid : HELPER_DAILY_LIMITS.free;
  const allowance = await consumeHelperAllowance(supabase as never, limit);
  if (allowance.status !== "ok") {
    if (allowance.status === "disabled") return jsonError("The study helper is paused right now. Try again later.", 503);
    if (allowance.status === "busy") return jsonError("The helper is very busy today. Try again tomorrow.", 503);
    if (allowance.status === "error") return jsonError("Could not check your daily allowance", 503);
    return NextResponse.json(
      { error: paid ? "You've used today's helper messages. Try again tomorrow." : `You've used today's ${limit} free helper messages. Try again tomorrow, or upgrade for more.`, limit },
      { status: 429, headers: NO_STORE },
    );
  }
  const { charge } = allowance;
  const remaining = charge.remaining;

  const model = helperModel();
  const stream = anthropic().beta.messages.stream({
    model,
    max_tokens: 16000,
    system: [{ type: "text", text: HELPER_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
    messages: buildHelperMessages(context, parsed),
    output_config: { effort: EFFORT[parsed.mode] },
    // Haiku has no server-side refusal fallback.
    ...(model.includes("haiku") ? {} : { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const }),
  });

  // Wait for the first words before answering, so a failed or refused call returns a real error and gives the
  // message back instead of streaming an empty reply.
  const iterator = stream[Symbol.asyncIterator]();
  let first = "";
  try {
    while (!first) {
      const next = await iterator.next();
      if (next.done) break;
      const event = next.value;
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") first = event.delta.text;
    }
  } catch (error) {
    await releaseHelperAllowance(userId, charge);
    const busy = error instanceof Anthropic.RateLimitError || (error instanceof Anthropic.APIError && (error.status ?? 0) >= 500);
    return jsonError(busy ? "The helper is busy right now. Try again in a minute." : "The helper couldn't answer. Try again.", busy ? 503 : 502);
  }
  if (!first) {
    await releaseHelperAllowance(userId, charge);
    return jsonError("I can't help with that one. Try asking about the question in a different way.", 422);
  }

  const encoder = new TextEncoder();
  const body$ = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(encoder.encode(first));
      try {
        for (;;) {
          const next = await iterator.next();
          if (next.done) break;
          const event = next.value;
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") controller.enqueue(encoder.encode(event.delta.text));
        }
        const final = await stream.finalMessage();
        if (final.stop_reason === "max_tokens" || final.stop_reason === "refusal") controller.enqueue(encoder.encode(CUT_OFF_NOTE));
        const usage = final.usage;
        // Counts only, never message text: lets us watch cost per mode.
        console.info(JSON.stringify({
          event: "helper_usage", bank, mode: parsed.mode, model: final.model, photo: Boolean(parsed.image),
          input_tokens: usage.input_tokens, output_tokens: usage.output_tokens,
          cache_read_tokens: usage.cache_read_input_tokens ?? 0, cache_write_tokens: usage.cache_creation_input_tokens ?? 0,
        }));
      } catch {
        controller.enqueue(encoder.encode(CUT_OFF_NOTE));
      } finally {
        controller.close();
      }
    },
    cancel() {
      stream.abort();
    },
  });

  return new Response(body$, {
    headers: {
      ...NO_STORE,
      "Content-Type": "text/plain; charset=utf-8",
      "X-Helper-Remaining": String(remaining),
      "X-Helper-Limit": String(limit),
      "X-Helper-Free-Preview": context.freePreview ? "1" : "0",
    },
  });
}

export const POST = withFailureReporting("/api/helper", handlePOST);
