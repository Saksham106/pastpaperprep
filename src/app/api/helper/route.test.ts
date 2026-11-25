import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getClaims: vi.fn(),
  rpc: vi.fn(),
  adminRpc: vi.fn(),
  fetchAccessEntitlements: vi.fn(),
  loadHelperContext: vi.fn(),
  stream: vi.fn(),
}));

vi.mock("server-only", () => ({}));
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
    mocks.rpc.mockResolvedValue({ data: { status: "ok", remaining: 4, usage_date: "2026-11-24" }, error: null });
    mocks.adminRpc.mockResolvedValue({ error: null });
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
    expect(mocks.rpc).not.toHaveBeenCalled();
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

  it("streams a question reply with the mode instruction and the messages left", async () => {
    const response = await POST(request(questionBody("hint")));
    expect(response.headers.get("X-Helper-Free-Preview")).toBe("1");
    expect(await events(response)).toEqual([{ type: "text", text: "Try " }, { type: "text", text: "expanding." }, { type: "done", remaining: 4, limit: 5 }]);
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

  it("gives paid members the higher limit", async () => {
    mocks.fetchAccessEntitlements.mockResolvedValue({ rows: [{ product_id: "all_access", status: "active" }], error: null });
    await (await POST(request(siteBody()))).text();
    expect(mocks.rpc).toHaveBeenCalledWith("consume_helper_allowance_v2", { p_limit: expect.any(Number) });
  });

  it("maps the allowance: paused and busy are 503, the limit is 429, all without calling the model", async () => {
    for (const [status, code] of [["disabled", 503], ["busy", 503], ["limit", 429]] as const) {
      mocks.rpc.mockResolvedValueOnce({ data: { status }, error: null });
      expect((await POST(request(questionBody()))).status, status).toBe(code);
    }
    expect(mocks.stream).not.toHaveBeenCalled();
  });

  it("falls back to the v1 allowance while the v2 migration isn't applied", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: "PGRST202" } }).mockResolvedValueOnce({ data: 3, error: null });
    expect((await events(await POST(request(siteBody())))).at(-1)).toEqual({ type: "done", remaining: 3, limit: 5 });
    expect(mocks.rpc.mock.calls.map(([name]) => name)).toEqual(["consume_helper_allowance_v2", "consume_helper_allowance"]);
  });

  it("charges once and refunds the charged day only when no words reached the student", async () => {
    mocks.stream.mockImplementation(() => fakeStream([], "refusal"));
    expect((await events(await POST(request(questionBody())))).at(-1)).toMatchObject({ type: "error", status: 422 });
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.adminRpc).toHaveBeenCalledWith("release_helper_allowance_v2", { p_user_id: "user-1", p_usage_date: "2026-11-24" });

    mocks.adminRpc.mockClear();
    mocks.stream.mockImplementation(() => fakeStream(["Partly "], "max_tokens"));
    await (await POST(request(questionBody()))).text();
    expect(mocks.adminRpc).not.toHaveBeenCalled();
  });

  it("answers exact site requests by rules without spending a message", async () => {
    expect(await events(await POST(request(siteBody("IGCSE Maths 0580"))))).toEqual([
      { type: "navigate", kind: "bank", path: "/banks/igcse?free=1", label: "IGCSE Maths 0580", bank: "igcse" },
      { type: "text", text: expect.any(String) },
      { type: "done", rules: true },
    ]);
    expect(mocks.rpc).not.toHaveBeenCalled();
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
});
