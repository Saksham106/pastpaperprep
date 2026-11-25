import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getClaims: vi.fn(),
  rpc: vi.fn(),
  adminRpc: vi.fn(),
  fetchAccessEntitlements: vi.fn(),
  stream: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getClaims: mocks.getClaims }, rpc: mocks.rpc }) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc: mocks.adminRpc }) }));
vi.mock("@/lib/custom-bundle-access", () => ({ fetchAccessEntitlements: mocks.fetchAccessEntitlements }));
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

import { POST } from "@/app/api/helper/site/route";

const request = (text = "what is a vector?") => new Request("https://pastpaperprep.com/api/helper/site", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ page: "/", messages: [{ role: "user", text }] }),
});

const events = async (response: Response) => (await response.text()).trim().split("\n").map((line) => JSON.parse(line) as { type: string });

describe("POST /api/helper/site", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
    vi.spyOn(console, "info").mockImplementation(() => {});
    mocks.getClaims.mockResolvedValue({ data: { claims: { sub: "user-1" } } });
    mocks.fetchAccessEntitlements.mockResolvedValue({ rows: [], error: null });
    mocks.rpc.mockResolvedValue({ data: { status: "ok", remaining: 4, usage_date: "2026-11-24" }, error: null });
    mocks.adminRpc.mockResolvedValue({ error: null });
  });
  afterEach(() => vi.unstubAllEnvs());

  it("needs a sign-in", async () => {
    mocks.getClaims.mockResolvedValue({ data: { claims: null } });
    expect((await POST(request())).status).toBe(401);
  });

  it("maps the shared allowance like /api/helper: paused and busy are 503, the limit is 429", async () => {
    for (const [status, code] of [["disabled", 503], ["busy", 503], ["limit", 429]] as const) {
      mocks.rpc.mockResolvedValueOnce({ data: { status }, error: null });
      expect((await POST(request())).status, status).toBe(code);
    }
    expect(mocks.stream).not.toHaveBeenCalled();
  });

  it("falls back to the v1 allowance while the v2 migration isn't applied", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: "PGRST202" } }).mockResolvedValueOnce({ data: 3, error: null });
    mocks.stream.mockReturnValue({
      async *[Symbol.asyncIterator]() { yield { type: "content_block_delta", delta: { type: "text_delta", text: "A vector has size and direction." } }; },
      finalMessage: async () => ({ model: "claude-opus-5-5", stop_reason: "end_turn", content: [], usage: { input_tokens: 1, output_tokens: 1 } }),
    });
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(await events(response)).toEqual([{ type: "text", text: "A vector has size and direction." }, { type: "done", remaining: 3, limit: 5 }]);
    expect(mocks.rpc.mock.calls.map(([name]) => name)).toEqual(["consume_helper_allowance_v2", "consume_helper_allowance"]);
  });

  it("refunds the charged day when no reply reaches the student", async () => {
    mocks.stream.mockReturnValue({
      async *[Symbol.asyncIterator]() { /* nothing */ },
      finalMessage: async () => ({ model: "claude-opus-5-5", stop_reason: "refusal", content: [], usage: { input_tokens: 1, output_tokens: 0 } }),
    });
    const response = await POST(request());
    expect((await events(response)).at(-1)).toMatchObject({ type: "error", status: 422 });
    expect(mocks.adminRpc).toHaveBeenCalledWith("release_helper_allowance_v2", { p_user_id: "user-1", p_usage_date: "2026-11-24" });
  });

  it("answers exact requests by rules without spending a message", async () => {
    const response = await POST(request("IGCSE Maths 0580"));
    expect(await events(response)).toEqual([
      { type: "navigate", kind: "bank", path: "/banks/igcse?free=1", label: "IGCSE Maths 0580", bank: "igcse" },
      { type: "text", text: expect.any(String) },
      { type: "done", rules: true },
    ]);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
