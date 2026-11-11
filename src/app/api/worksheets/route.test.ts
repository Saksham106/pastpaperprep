import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClient, getClaims, from, loadBankQuestions } = vi.hoisted(() => ({ createClient: vi.fn(), getClaims: vi.fn(), from: vi.fn(), loadBankQuestions: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));
vi.mock("@/lib/question-loader", () => ({ loadBankQuestions }));
import { GET, POST } from "./route";

const questionIds = ["2017-may-p1-tz1-q1"];
const question = { id: questionIds[0] };
function req(body?: unknown) { return new Request("https://example.test/api/worksheets", { method: body === undefined ? "GET" : "POST", headers: { "content-type": "application/json" }, ...(body === undefined ? {} : { body: typeof body === "string" ? body : JSON.stringify(body) }) }); }
function setup({ userId = "user-id", entitlements = [{ product_id: "bundle_all", status: "active", starts_at: "2026-01-01T00:00:00Z", expires_at: null }], saved = null as unknown } = {}) {
  getClaims.mockResolvedValue({ data: { claims: userId ? { sub: userId } : {} } });
  const chain: Record<string, ReturnType<typeof vi.fn>> = { select: vi.fn(() => chain), eq: vi.fn(() => chain), order: vi.fn(() => Promise.resolve({ data: [], error: null })), insert: vi.fn(() => chain), single: vi.fn(() => Promise.resolve({ data: saved, error: null })) };
  from.mockImplementation((table: string) => table === "entitlements" ? { select: () => ({ eq: () => Promise.resolve({ data: entitlements, error: null }) }) } : chain);
  createClient.mockResolvedValue({ auth: { getClaims }, from, rpc: vi.fn().mockResolvedValue({ data: [], error: null }) });
  loadBankQuestions.mockResolvedValue([question]);
  return chain;
}
const body = { bank: "ib-sl", name: "Practice", questionIds, contentMode: "questions" };

describe("worksheet persistence routes", () => {
  beforeEach(() => { vi.clearAllMocks(); setup(); });
  it("requires authentication for listing", async () => { setup({ userId: "" }); expect((await GET()).status).toBe(401); });
  it("rejects JSON null and arrays without throwing", async () => { for (const value of [null, [], "x"]) { const response = await POST(req(value)); expect(response.status).toBe(400); } });
  it("rejects malformed JSON", async () => { expect((await POST(req("{"))).status).toBe(400); });
  it("requires authentication before persistence", async () => { setup({ userId: "" }); expect((await POST(req(body))).status).toBe(401); });
  it("denies creation without current bank entitlement", async () => { setup({ entitlements: [] }); expect((await POST(req(body))).status).toBe(403); });
  it("rejects question IDs absent from the current bank", async () => { loadBankQuestions.mockResolvedValue([]); expect((await POST(req(body))).status).toBe(400); });
  it("returns the exact persisted worksheet contract on create", async () => {
    const row = { id: "worksheet-id", bank_slug: "ib-sl", title: "Practice", question_ids: questionIds, content_mode: "questions", revision: 1, created_at: "created", updated_at: "updated" };
    const chain = setup({ saved: row });
    const response = await POST(req(body));
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ worksheet: row });
    expect(chain.insert).toHaveBeenCalledWith({ user_id: "user-id", bank_slug: "ib-sl", title: "Practice", question_ids: questionIds, content_mode: "questions" });
  });
  describe("cache headers", () => {
    const PRIVATE = "private, no-store, max-age=0";
    it("marks list success private", async () => { const r = await GET(); expect(r.status).toBe(200); expect(r.headers.get("cache-control")).toBe(PRIVATE); });
    it("marks list 401 private", async () => { setup({ userId: "" }); const r = await GET(); expect(r.status).toBe(401); expect(r.headers.get("cache-control")).toBe(PRIVATE); });
    it("marks list 503 private", async () => { setup(); const failed = { data: null, error: { message: "x" } }; from.mockImplementation(() => ({ select: () => ({ eq: () => Object.assign(Promise.resolve(failed), { order: () => Promise.resolve(failed) }) }) })); const r = await GET(); expect(r.status).toBe(503); expect(r.headers.get("cache-control")).toBe(PRIVATE); });
    it("marks create success, 400, 401, 403 private", async () => {
      const row = { id: "w", bank_slug: "ib-sl", title: "Practice", question_ids: questionIds, content_mode: "questions", revision: 1, created_at: "c", updated_at: "u" };
      setup({ saved: row }); expect((await POST(req(body))).headers.get("cache-control")).toBe(PRIVATE);
      expect((await POST(req("{"))).headers.get("cache-control")).toBe(PRIVATE);
      setup({ userId: "" }); expect((await POST(req(body))).headers.get("cache-control")).toBe(PRIVATE);
      setup({ entitlements: [] }); const denied = await POST(req(body)); expect(denied.status).toBe(403); expect(denied.headers.get("cache-control")).toBe(PRIVATE);
    });
  });
  it("loads the question corpus only when a save needs it, so listing cold-starts fast", () => {
    for (const file of ["src/app/api/worksheets/route.ts", "src/app/api/worksheets/[id]/route.ts"]) {
      const source = readFileSync(join(process.cwd(), file), "utf8");
      expect(source, file).not.toMatch(/^import[^;]*["']@\/lib\/question-loader["']/m);
      expect(source, file).toContain('await import("@/lib/question-loader")');
    }
  });
  it("reads entitlements and saved worksheets together", async () => {
    let releaseEntitlements!: () => void;
    const chain = setup();
    from.mockImplementation((table: string) => table === "entitlements"
      ? { select: () => ({ eq: () => new Promise((resolve) => { releaseEntitlements = () => resolve({ data: [{ product_id: "bundle_all", status: "active", starts_at: "2026-01-01T00:00:00Z", expires_at: null }], error: null }); }) }) }
      : chain);
    const pending = GET();
    await vi.waitFor(() => expect(chain.order).toHaveBeenCalled());
    releaseEntitlements();
    expect((await pending).status).toBe(200);
  });
  it("rejects null, array and primitive create bodies without creating a client", async () => {
    for (const value of [null, [], "x", 5, true]) { createClient.mockClear(); const r = await POST(req(value)); expect(r.status).toBe(400); expect(createClient).not.toHaveBeenCalled(); }
  });
});
