import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getClaims: vi.fn(),
  rpc: vi.fn(),
  adminRpc: vi.fn(),
  fetchAccessEntitlements: vi.fn(),
  loadHelperContext: vi.fn(),
  stream: vi.fn(),
  after: vi.fn(),
  capture: vi.fn<(input: unknown) => Promise<void>>(async () => {}),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/server", async (importOriginal) => ({ ...(await importOriginal<typeof import("next/server")>()), after: mocks.after }));
vi.mock("@/lib/helper/llm-analytics", () => ({ captureHelperGenerations: mocks.capture }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getClaims: mocks.getClaims }, rpc: mocks.rpc }) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc: mocks.adminRpc }) }));
vi.mock("@/lib/custom-bundle-access", () => ({ fetchAccessEntitlements: mocks.fetchAccessEntitlements }));
vi.mock("@/lib/helper/context", () => {
  class HelperAccessError extends Error {}
  return { HelperAccessError, loadHelperContext: mocks.loadHelperContext };
});
vi.mock("@/lib/helper/site-tools", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/helper/site-tools")>();
  const base = {
    index: { version: 2 as const, subjects: [{ bank: "igcse", name: "IGCSE Maths 0580", qualification: "igcse" as const, practiceHref: "/banks/igcse?free=1", questionCount: 1, papersHref: null, paperCount: 0, terms: ["igcse", "maths", "0580"] }], topics: [] },
    papers: { version: 2 as const, papers: [] },
    facets: { version: 2 as const, banks: {} },
    pages: [],
  };
  return { ...actual, loadSiteData: async () => ({ ...base, destinations: actual.siteDestinations(base) }) };
});
vi.mock("@anthropic-ai/sdk", () => {
  class APIError extends Error { status?: number; constructor(status?: number) { super("api"); this.status = status; } }
  class RateLimitError extends APIError {}
  class Anthropic {
    static APIError = APIError;
    static RateLimitError = RateLimitError;
    beta = { messages: { stream: mocks.stream } };
  }
  return { default: Anthropic };
});

import { POST } from "@/app/api/helper/route";
import { HelperAccessError } from "@/lib/helper/context";
import { HELPER_INCOMPLETE_MARKING, HELPER_MODE_INSTRUCTIONS } from "@/lib/helper/prompt";

const CHARGE = "11111111-1111-4111-8111-111111111111";
const charged = { status: "ok", charge_id: CHARGE, week_start: "2026-11-23", plan_left: 140, pack_left: 0 };
const credits = (tier: string, weekly: number, planLeft = 140, packLeft = 0) => ({ tier, weekly, planLeft, packLeft, resetsAt: expect.any(String) });
const consumeWith = (data: unknown) => mocks.adminRpc.mockImplementation(async (name: string) => name === "consume_helper_credits" ? { data, error: null } : { data: true, error: null });
const consumeCalls = () => mocks.adminRpc.mock.calls.filter(([name]) => name === "consume_helper_credits");
const siteBody = (text = "what is a vector?") => ({ page: "/", messages: [{ role: "user", text }] });
const questionBody = (mode = "hint", text = "Give me a hint.") => ({ page: "/banks/igcse", question: { bank: "igcse", questionId: "q1" }, mode, messages: [{ role: "user", text }] });
const request = (body: unknown) => new Request("https://pastpaperprep.com/api/helper", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});
const events = async (response: Response) => (await response.text()).trim().split("\n").map((line) => JSON.parse(line) as Record<string, unknown>);

function fakeStream(texts: string[], stop = "end_turn") {
  return {
    async *[Symbol.asyncIterator]() { for (const text of texts) yield { type: "content_block_delta", delta: { type: "text_delta", text } }; },
    finalMessage: async () => ({ model: "claude-sonnet-5-5", stop_reason: stop, content: texts.map((text) => ({ type: "text", text })), usage: { input_tokens: 1, output_tokens: 1 } }),
  };
}

describe("POST /api/helper (one Pepper for every surface)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
    vi.spyOn(console, "info").mockImplementation(() => {});
    mocks.getClaims.mockResolvedValue({ data: { claims: { sub: "user-1" } } });
    mocks.fetchAccessEntitlements.mockResolvedValue({ rows: [], error: null });
    consumeWith(charged);
    mocks.loadHelperContext.mockResolvedValue({
      bank: "igcse", questionId: "q1", freePreview: true, label: "L", subject: "Maths", qualification: "Cambridge IGCSE",
      marks: 3, questionImages: [], markschemeImages: ["ms"], explanation: null, omitted: { question: 0, markscheme: 0 },
    });
    mocks.stream.mockImplementation(() => fakeStream(["Try ", "expanding."]));
  });
  afterEach(() => vi.unstubAllEnvs());

  it("is unavailable without an API key", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    expect((await POST(request(siteBody()))).status).toBe(503);
  });

  it("rejects malformed requests before anything else", async () => {
    expect((await POST(request({ ...questionBody(), mode: "essay" }))).status).toBe(400);
    expect((await POST(request({ ...questionBody(), question: { bank: "not-a-bank", questionId: "q1" } }))).status).toBe(400);
    expect((await POST(request({ ...siteBody(), mode: "hint" }))).status).toBe(400);
    expect(mocks.getClaims).not.toHaveBeenCalled();
  });

  it("needs a sign-in, and answer access for an attached question", async () => {
    mocks.getClaims.mockResolvedValueOnce({ data: { claims: null } });
    expect((await POST(request(siteBody()))).status).toBe(401);
    mocks.loadHelperContext.mockRejectedValueOnce(new HelperAccessError("no"));
    expect((await POST(request(questionBody()))).status).toBe(403);
    expect(mocks.adminRpc).not.toHaveBeenCalled();
  });

  it("uses one shared cached prefix: the same system prompt and tools with or without a question", async () => {
    await (await POST(request(siteBody()))).text();
    await (await POST(request(questionBody()))).text();
    const [site, question] = mocks.stream.mock.calls.map(([params]) => params as Record<string, unknown>);
    expect(site.system).toEqual(question.system);
    expect(site.tools).toEqual(question.tools);
    expect(site).toMatchObject({ model: "claude-sonnet-5-5", output_config: { effort: "medium" }, cache_control: { type: "ephemeral" } });
    // The question's materials come after the shared prefix, as their own cached block.
    const first = (question.messages as Array<{ role: string; content: unknown }>)[0];
    expect(first.role).toBe("user");
    expect(JSON.stringify(first.content)).toContain("ephemeral");
    expect(JSON.stringify((site.messages as unknown[])[0])).not.toContain("Official question paper");
  });

  it("streams a question reply with the mode instruction and the credits left", async () => {
    const response = await POST(request(questionBody("hint")));
    expect(response.headers.get("X-Helper-Free-Preview")).toBe("1");
    expect(await events(response)).toEqual([{ type: "text", text: "Try " }, { type: "text", text: "expanding." }, { type: "done", credits: credits("free", 150), cost: 10 }]);
    const messages = mocks.stream.mock.calls[0][0].messages as Array<{ role: string; content: unknown }>;
    expect(String(messages.at(-1)!.content)).toContain(HELPER_MODE_INSTRUCTIONS.hint);
  });

  it("never asks for a score when the mark scheme was cut short", async () => {
    mocks.loadHelperContext.mockResolvedValueOnce({
      bank: "igcse", questionId: "q1", freePreview: true, label: "L", subject: "Maths", qualification: "Cambridge IGCSE",
      marks: 3, questionImages: [], markschemeImages: ["ms"], explanation: null, omitted: { question: 0, markscheme: 1 },
    });
    await (await POST(request(questionBody("mark", "x = 4")))).text();
    const note = String((mocks.stream.mock.calls[0][0].messages as Array<{ content: unknown }>).at(-1)!.content);
    expect(note).toContain(HELPER_INCOMPLETE_MARKING);
    expect(note).not.toContain(HELPER_MODE_INSTRUCTIONS.mark);
  });

  it("charges the plan's weekly credits, worked out on the server from entitlements", async () => {
    await (await POST(request(siteBody()))).text();
    expect(consumeCalls()[0][1]).toEqual({ p_user_id: "user-1", p_weekly_credits: 150, p_cost: 10 });
    const allAccess = { productId: "bundle_all", status: "active", startsAt: "2020-01-01T00:00:00Z", expiresAt: null };
    mocks.fetchAccessEntitlements.mockResolvedValue({ rows: [allAccess], error: null });
    await (await POST(request(siteBody()))).text();
    expect(consumeCalls()[1][1]).toEqual({ p_user_id: "user-1", p_weekly_credits: 3000, p_cost: 10 });
  });

  it("maps the charge: paused and busy are 503, out of credits is 429 with the balance, all without calling the model", async () => {
    for (const [status, code] of [["disabled", 503], ["busy", 503]] as const) {
      consumeWith({ status });
      expect((await POST(request(questionBody()))).status, status).toBe(code);
    }
    consumeWith({ status: "limit", reason: "week", week_start: "2026-11-23", plan_left: 0, pack_left: 0 });
    const limited = await POST(request(questionBody()));
    expect(limited.status).toBe(429);
    expect(await limited.json()).toEqual({ error: "You've used this week's credits.", reason: "week", cost: 10, credits: credits("free", 150, 0, 0) });
    consumeWith({ status: "limit", reason: "day", week_start: "2026-11-23", plan_left: 0, pack_left: 500 });
    expect((await (await POST(request(questionBody()))).json()).error).toContain("today's limit");
    expect(mocks.stream).not.toHaveBeenCalled();
  });

  it("fails closed when the credit check errors or answers in an unknown shape", async () => {
    for (const data of [null, { status: "ok" }, { status: "ok", charge_id: "not-a-uuid", plan_left: 1, pack_left: 0 }, { status: "limit", reason: "month", plan_left: 0, pack_left: 0 }]) {
      consumeWith(data);
      expect((await POST(request(siteBody()))).status).toBe(503);
    }
    mocks.adminRpc.mockResolvedValueOnce({ data: null, error: { code: "PGRST202" } });
    expect((await POST(request(siteBody()))).status).toBe(503);
    expect(mocks.stream).not.toHaveBeenCalled();
  });

  it("charges once and refunds that charge only when no words reached the student", async () => {
    mocks.stream.mockImplementation(() => fakeStream([], "refusal"));
    expect((await events(await POST(request(questionBody())))).at(-1)).toMatchObject({ type: "error", status: 422 });
    expect(consumeCalls()).toHaveLength(1);
    expect(mocks.adminRpc).toHaveBeenCalledWith("release_helper_credits", { p_user_id: "user-1", p_charge_id: CHARGE });

    mocks.adminRpc.mockClear();
    mocks.stream.mockImplementation(() => fakeStream(["Partly "], "max_tokens"));
    await (await POST(request(questionBody()))).text();
    expect(mocks.adminRpc.mock.calls.map(([name]) => name)).toEqual(["consume_helper_credits"]);
  });

  it("answers exact site requests by rules without spending credits", async () => {
    expect(await events(await POST(request(siteBody("IGCSE Maths 0580"))))).toEqual([
      { type: "navigate", kind: "bank", path: "/banks/igcse?free=1", label: "IGCSE Maths 0580", bank: "igcse" },
      { type: "text", text: expect.any(String) },
      { type: "done", rules: true },
    ]);
    expect(mocks.adminRpc).not.toHaveBeenCalled();
    expect(mocks.stream).not.toHaveBeenCalled();
  });

  it("never uses the rules shortcut with a question attached", async () => {
    await (await POST(request({ ...questionBody("chat", "IGCSE Maths 0580") }))).text();
    expect(mocks.stream).toHaveBeenCalled();
  });

  it("logs counts only, never message text", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    await (await POST(request(questionBody("hint", "my secret working")))).text();
    const logged = info.mock.calls.map(([line]) => String(line)).join("\n");
    expect(logged).toContain('"surface":"question"');
    expect(logged).not.toContain("secret");
  });

  it("schedules one analytics capture with after(), carrying per-round counts and no text", async () => {
    const response = await POST(request(siteBody()));
    await events(response);
    expect(mocks.after).toHaveBeenCalledTimes(1);
    await mocks.after.mock.calls[0][0];
    expect(mocks.capture).toHaveBeenCalledTimes(1);
    const arg = mocks.capture.mock.calls[0][0] as { userId: string; browserConsent: boolean; rounds: Array<Record<string, unknown>>; meta: Record<string, unknown> };
    expect(arg.userId).toBe("user-1");
    expect(arg.rounds).toHaveLength(1);
    expect(arg.rounds[0]).toMatchObject({ round: 0, stopReason: "end_turn", inputTokens: 1, outputTokens: 1, error: false });
    expect(arg.meta).toMatchObject({ surface: "site", photo: false, refused: false, navigated: false, creditsReserved: expect.any(Number), creditsSpent: expect.any(Number) });
    expect(arg.browserConsent).toBe(false);
    expect(JSON.stringify(arg)).not.toContain("expanding");
  });

  it("passes this browser's analytics choice, read from its consent cookie", async () => {
    for (const [cookie, expected] of [["ppp_analytics_consent=v2.accepted", true], ["ppp_analytics_consent=v2.rejected", false], ["ppp_analytics_consent=v1.accepted", false]] as const) {
      mocks.capture.mockClear(); mocks.after.mockClear();
      const base = request(siteBody());
      const withCookie = new Request(base, { headers: { "content-type": "application/json", cookie: `other=1; ${cookie}` } });
      await events(await POST(withCookie));
      await mocks.after.mock.calls[0][0];
      expect((mocks.capture.mock.calls[0][0] as { browserConsent: boolean }).browserConsent, cookie).toBe(expected);
    }
  });

  it("still resolves the capture when the model call fails, flagging the round as an error", async () => {
    mocks.stream.mockImplementation(() => { throw Object.assign(new Error("api"), { status: 529 }); });
    await events(await POST(request(siteBody())));
    await mocks.after.mock.calls[0][0];
    const arg = mocks.capture.mock.calls[0][0] as { rounds: Array<Record<string, unknown>> };
    expect(arg.rounds).toEqual([expect.objectContaining({ error: true, httpStatus: 529 })]);
  });

  it("sends no analytics for the rules shortcut", async () => {
    await POST(request({ page: "/", messages: [{ role: "user", text: "igcse maths 0580" }] }));
    expect(mocks.capture).not.toHaveBeenCalled();
  });
});
