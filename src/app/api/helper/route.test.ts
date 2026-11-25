import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getClaims: vi.fn(),
  rpc: vi.fn(),
  adminRpc: vi.fn(),
  fetchAccessEntitlements: vi.fn(),
  loadHelperContext: vi.fn(),
  stream: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc: mocks.adminRpc }) }));
vi.mock("@/lib/custom-bundle-access", () => ({ fetchAccessEntitlements: mocks.fetchAccessEntitlements }));
vi.mock("@/lib/helper/context", () => {
  class HelperAccessError extends Error {}
  return { HelperAccessError, loadHelperContext: mocks.loadHelperContext };
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

const body = { bank: "igcse", questionId: "q1", mode: "hint", messages: [{ role: "user", text: "Give me a hint." }] };
const request = (value: unknown = body) => new Request("https://pastpaperprep.com/api/helper", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(value),
});

function fakeStream(texts: string[], options: { throwFirst?: Error; stopReason?: string } = {}) {
  return {
    async *[Symbol.asyncIterator]() {
      if (options.throwFirst) throw options.throwFirst;
      for (const text of texts) yield { type: "content_block_delta", delta: { type: "text_delta", text } };
    },
    finalMessage: async () => ({ model: "claude-opus-5-5", stop_reason: options.stopReason ?? "end_turn", usage: { input_tokens: 10, output_tokens: 5 } }),
    abort: vi.fn(),
  };
}

describe("POST /api/helper", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
    vi.spyOn(console, "info").mockImplementation(() => {});
    mocks.getClaims.mockResolvedValue({ data: { claims: { sub: "user-1" } } });
    mocks.rpc.mockResolvedValue({ data: 4, error: null });
    mocks.adminRpc.mockResolvedValue({ error: null });
    mocks.createClient.mockResolvedValue({ auth: { getClaims: mocks.getClaims }, rpc: mocks.rpc });
    mocks.fetchAccessEntitlements.mockResolvedValue({ rows: [], error: null });
    mocks.loadHelperContext.mockResolvedValue({
      bank: "igcse", questionId: "q1", freePreview: true, label: "L", subject: "Maths", qualification: "Cambridge IGCSE",
      marks: 3, questionImages: [], markschemeImages: [], explanation: null,
    });
    mocks.stream.mockReturnValue(fakeStream(["Try ", "expanding."]));
  });
  afterEach(() => vi.unstubAllEnvs());

  it("is unavailable without an API key", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    expect((await POST(request())).status).toBe(503);
  });

  it("rejects malformed requests", async () => {
    expect((await POST(request({ ...body, mode: "essay" }))).status).toBe(400);
    expect((await POST(request({ ...body, bank: "not-a-bank" }))).status).toBe(400);
    expect(mocks.getClaims).not.toHaveBeenCalled();
  });

  it("requires sign-in and answer access", async () => {
    mocks.getClaims.mockResolvedValueOnce({ data: { claims: {} } });
    expect((await POST(request())).status).toBe(401);
    mocks.loadHelperContext.mockRejectedValueOnce(new HelperAccessError("no"));
    expect((await POST(request())).status).toBe(403);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("streams the reply with the free limit and messages left", async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("Try expanding.");
    expect(response.headers.get("X-Helper-Remaining")).toBe("4");
    expect(mocks.rpc).toHaveBeenCalledWith("consume_helper_allowance", { p_limit: 5 });
    const params = mocks.stream.mock.calls[0][0];
    expect(params.model).toBe("claude-opus-5-5");
    expect(params.output_config).toEqual({ effort: "low" });
    expect(params.fallbacks).toBe("default");
  });

  it("gives paid members the higher limit", async () => {
    mocks.fetchAccessEntitlements.mockResolvedValueOnce({ rows: [{ productId: "bundle_all", status: "active", startsAt: "2026-01-01T00:00:00Z", expiresAt: null }], error: null });
    await POST(request());
    expect(mocks.rpc).toHaveBeenCalledWith("consume_helper_allowance", { p_limit: 30 });
  });

  it("answers 429 at the daily limit without calling the model", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: -1, error: null });
    const response = await POST(request());
    expect(response.status).toBe(429);
    expect(mocks.stream).not.toHaveBeenCalled();
  });

  it("gives the message back when the model fails before answering", async () => {
    mocks.stream.mockReturnValueOnce(fakeStream([], { throwFirst: new Error("boom") }));
    expect((await POST(request())).status).toBe(502);
    expect(mocks.adminRpc).toHaveBeenCalledWith("release_helper_allowance", { p_user_id: "user-1" });

    mocks.stream.mockReturnValueOnce(fakeStream([], { stopReason: "refusal" }));
    expect((await POST(request())).status).toBe(422);
    expect(mocks.adminRpc).toHaveBeenCalledTimes(2);
  });

  it("marks with medium effort and notes a cut-off reply", async () => {
    mocks.stream.mockReturnValueOnce(fakeStream(["Mark: 1 / 3"], { stopReason: "max_tokens" }));
    const response = await POST(request({ ...body, mode: "mark", messages: [{ role: "user", text: "x = 2" }] }));
    expect(await response.text()).toContain("cut off");
    expect(mocks.stream.mock.calls[0][0].output_config).toEqual({ effort: "medium" });
  });
});
