import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ consent: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/server-conversion-analytics", () => ({ hasCurrentConsent: mocks.consent }));

import { buildGenerationProperties, captureHelperGenerations, type HelperRoundStats } from "@/lib/helper/llm-analytics";

const round: HelperRoundStats = { round: 0, model: "claude-sonnet-5-5", stopReason: "end_turn", inputTokens: 10, outputTokens: 20, cacheReadTokens: 5, cacheWriteTokens: 2, latencyMs: 1234, error: false };
const meta = { surface: "question" as const, mode: "hint", photo: true, bank: "igcse", refused: false, navigated: false, creditsCost: 20, tier: "free" };
const fetchMock = vi.fn();
const sent = () => JSON.parse(fetchMock.mock.calls[0][1].body as string) as { api_key: string; batch: Array<{ event: string; distinct_id: string; properties: Record<string, unknown> }> };

describe("helper LLM analytics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("POSTHOG_PROJECT_TOKEN", "phc_test");
    vi.stubEnv("POSTHOG_HOST", "");
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_HOST", "");
    vi.stubGlobal("fetch", fetchMock.mockResolvedValue(new Response("{}")));
    mocks.consent.mockResolvedValue(false);
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

  it("uses PostHog's documented $ai_generation property names", () => {
    const p = buildGenerationProperties("trace", { ...round, httpStatus: 529, error: true }, 2, meta, false);
    expect(p).toMatchObject({
      $ai_trace_id: "trace", $ai_model: "claude-sonnet-5-5", $ai_provider: "anthropic", $ai_input_tokens: 10, $ai_output_tokens: 20,
      $ai_cache_read_input_tokens: 5, $ai_cache_creation_input_tokens: 2, $ai_latency: 1.234, $ai_stop_reason: "end_turn",
      $ai_is_error: true, $ai_http_status: 529, $geoip_disable: true, $process_person_profile: false,
      surface: "question", mode: "hint", photo: true, bank: "igcse", round: 0, rounds_total: 2, refused: false, navigated: false, credits_cost: 20, tier: "free",
    });
  });

  it("never carries content fields, even when passed", () => {
    const dirty = { ...round, $ai_input: "secret", prompt: "secret", text: "secret" } as unknown as HelperRoundStats;
    const dirtyMeta = { ...meta, reply: "secret", question: "secret", bank: "secret question text!" } as never;
    const p = buildGenerationProperties("t", dirty, 1, dirtyMeta, false);
    expect(JSON.stringify(p)).not.toContain("secret");
    for (const key of ["$ai_input", "$ai_output_choices", "$ai_output", "prompt", "text", "reply", "question", "bank"]) expect(p).not.toHaveProperty(key);
  });

  it("ties events to the account with consent, one lookup per message, one batched request", async () => {
    mocks.consent.mockResolvedValue(true);
    await captureHelperGenerations({ userId: "u1", rounds: [round, { ...round, round: 1 }], meta });
    expect(mocks.consent).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toBe("https://us.i.posthog.com/batch/");
    const body = sent();
    expect(body.api_key).toBe("phc_test");
    expect(body.batch).toHaveLength(2);
    expect(body.batch.every((e) => e.event === "$ai_generation" && e.distinct_id === "account:u1" && e.properties.$process_person_profile === true)).toBe(true);
    expect(new Set(body.batch.map((e) => e.properties.$ai_trace_id)).size).toBe(1);
  });

  it("is anonymous without consent", async () => {
    await captureHelperGenerations({ userId: "u1", rounds: [round], meta });
    const [event] = sent().batch;
    expect(event.distinct_id).toMatch(/^anon:[0-9a-f-]{36}$/);
    expect(JSON.stringify(event)).not.toContain("u1");
    expect(event.properties.$process_person_profile).toBe(false);
  });

  it("does nothing without a token and swallows fetch failures", async () => {
    vi.stubEnv("POSTHOG_PROJECT_TOKEN", "");
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN", "");
    await captureHelperGenerations({ userId: "u1", rounds: [round], meta });
    expect(fetchMock).not.toHaveBeenCalled();
    vi.stubEnv("POSTHOG_PROJECT_TOKEN", "phc_test");
    fetchMock.mockRejectedValue(new Error("down"));
    await expect(captureHelperGenerations({ userId: "u1", rounds: [round], meta })).resolves.toBeUndefined();
  });
});
