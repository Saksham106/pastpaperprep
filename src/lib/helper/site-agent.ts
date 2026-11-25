import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { HELPER_SITE_MAX_ROUNDS } from "@/lib/helper/site-config";
import type { SiteHelperEvent } from "@/lib/helper/site-events";
import { HELPER_SITE_SYSTEM_PROMPT } from "@/lib/helper/site-prompt";
import { runSiteTool, SITE_TOOLS, type SiteData, type ToolContext } from "@/lib/helper/site-tools";

/** Per model call. Site replies are short; this leaves room for an explanation. */
const MAX_TOKENS = 4000;
export const HELPER_SITE_CUT_OFF = "\n\n_Sorry, that answer was cut off. Try again._";

export type Send = (event: SiteHelperEvent) => void;

/**
 * The agent loop: stream a reply, run any tool calls, send their results back, repeat. Text streams to the student as
 * it arrives; navigations go out as their own events. Returns whether any text reached the student.
 */
export async function runSiteAgent(options: {
  api: Pick<Anthropic["beta"]["messages"], "stream">;
  model: string;
  data: SiteData;
  messages: Anthropic.Beta.BetaMessageParam[];
  send: Send;
  signal?: AbortSignal;
}): Promise<{ sentText: boolean; navigated: boolean; refused: boolean }> {
  const { api, model, data, send, signal } = options;
  const messages = [...options.messages];
  const context: ToolContext = { data, navigations: 0 };
  let sentText = false;
  for (let round = 0; round < HELPER_SITE_MAX_ROUNDS; round += 1) {
    const lastRound = round === HELPER_SITE_MAX_ROUNDS - 1;
    const stream = api.stream({
      model,
      max_tokens: MAX_TOKENS,
      system: [{ type: "text", text: HELPER_SITE_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      // Also cache the conversation so far: each tool round re-sends it, and the next round reads it from cache.
      cache_control: { type: "ephemeral" },
      tools: SITE_TOOLS,
      // The last round must answer in words, so a looping model still ends with a reply.
      ...(lastRound ? { tool_choice: { type: "none" as const } } : {}),
      messages,
      output_config: { effort: "low" },
      // Haiku has no server-side refusal fallback.
      ...(model.includes("haiku") ? {} : { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const }),
    }, { signal });
    let roundText = false;
    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta" && event.delta.text) {
        // Words from an earlier round stay on screen: start this round's on a new paragraph.
        if (!roundText && sentText) send({ type: "text", text: "\n\n" });
        roundText = true;
        sentText = true;
        send({ type: "text", text: event.delta.text });
      }
    }
    const final = await stream.finalMessage();
    console.info(JSON.stringify({
      event: "helper_usage", surface: "site", round, model: final.model, stop: final.stop_reason,
      input_tokens: final.usage.input_tokens, output_tokens: final.usage.output_tokens,
      cache_read_tokens: final.usage.cache_read_input_tokens ?? 0, cache_write_tokens: final.usage.cache_creation_input_tokens ?? 0,
    }));
    if (final.stop_reason === "refusal") return { sentText, navigated: context.navigations > 0, refused: true };
    const toolUses = final.content.filter((block): block is Anthropic.Beta.BetaToolUseBlock => block.type === "tool_use");
    if (final.stop_reason === "max_tokens") {
      // A tool call cut off mid-input must never run.
      if (sentText) send({ type: "text", text: HELPER_SITE_CUT_OFF });
      return { sentText, navigated: context.navigations > 0, refused: !sentText };
    }
    if (final.stop_reason !== "tool_use" || !toolUses.length) return { sentText, navigated: context.navigations > 0, refused: false };
    messages.push({ role: "assistant", content: final.content });
    const results: Anthropic.Beta.BetaToolResultBlockParam[] = toolUses.map((use) => {
      const outcome = runSiteTool(use.name, use.input, context);
      if (outcome.navigation) send({ type: "navigate", ...outcome.navigation });
      return { type: "tool_result", tool_use_id: use.id, content: outcome.content, ...(outcome.isError ? { is_error: true } : {}) };
    });
    // All results in one message, so parallel calls stay parallel.
    messages.push({ role: "user", content: results });
  }
  return { sentText, navigated: context.navigations > 0, refused: false };
}

