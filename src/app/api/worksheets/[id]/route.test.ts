import { beforeEach, describe, expect, it, vi } from "vitest";
const { createClient, getClaims, from, loadBankQuestions } = vi.hoisted(() => ({ createClient: vi.fn(), getClaims: vi.fn(), from: vi.fn(), loadBankQuestions: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));
vi.mock("@/lib/question-loader", () => ({ loadBankQuestions }));
import { GET, PATCH } from "./route";
const id = "worksheet-id";
const savedRow = { id, bank_slug: "ib-sl", title: "Old", question_ids: ["q1"], content_mode: "questions", revision: 4, created_at: "created", updated_at: "updated" };
const editBody = { revision: 4, bank: "ib-sl", name: "New", questionIds: ["q1"], contentMode: "both" };
const ctx = { params: Promise.resolve({ id }) };
function request(body: unknown) { return new Request("https://example.test", { method: "PATCH", headers: { "content-type": "application/json" }, body: typeof body === "string" ? body : JSON.stringify(body) }); }
function setup({ userId = "user-id", row: current = savedRow as typeof savedRow | null, entitlements = [{ product_id: "bundle_all", status: "active", starts_at: "2026-01-01T00:00:00Z", expires_at: null }], updated = { ...savedRow, title: "New", content_mode: "both", revision: 5 } } = {}) {
 getClaims.mockResolvedValue({ data: { claims: userId ? { sub: userId } : {} } });
 const q: any = { select: vi.fn(() => q), eq: vi.fn(() => q), maybeSingle: vi.fn(async () => ({ data: current, error: null })), update: vi.fn(() => q) };
 let savedQueryCount = 0;
 from.mockImplementation((table: string) => table === "entitlements" ? { select: () => ({ eq: async () => ({ data: entitlements, error: null }) }) } : (savedQueryCount++ === 0 ? q : q));
 q.maybeSingle.mockImplementation(async () => ({ data: current, error: null }));
 q.select.mockImplementation(() => q); q.eq.mockImplementation(() => q);
 createClient.mockResolvedValue({ auth: { getClaims }, from }); loadBankQuestions.mockResolvedValue([{ id: "q1" }]);
 // Last maybeSingle is the update's readback; override by counting calls.
 q.maybeSingle.mockImplementation(async () => ({ data: current, error: null }));
 return q;
}
describe("worksheet item routes", () => {
 beforeEach(() => { vi.clearAllMocks(); setup(); });
 it("requires authentication", async () => { setup({ userId: "" }); expect((await PATCH(request(editBody), ctx)).status).toBe(401); });
 it("returns 404 for an unknown or foreign-owned worksheet", async () => { setup({ row: null }); expect((await GET(new Request("https://example.test"), ctx)).status).toBe(404); });
 it("rejects changing the worksheet bank", async () => { setup({ row: { ...savedRow, bank_slug: "ib-sl" } }); expect((await PATCH(request({ ...editBody, bank: "ib-hl" }), ctx)).status).toBe(400); });
 it("denies edits after bank entitlement lapses", async () => { setup({ entitlements: [] }); expect((await PATCH(request(editBody), ctx)).status).toBe(403); });
 it("returns conflict when revision compare-and-swap changes no row", async () => { const q = setup(); q.maybeSingle.mockResolvedValueOnce({ data: savedRow, error: null }).mockResolvedValueOnce({ data: null, error: null }); expect((await PATCH(request(editBody), ctx)).status).toBe(409); });
 it("does not expose another owner's worksheet", async () => { const q = setup({ row: null }); expect((await GET(new Request("https://example.test"), ctx)).status).toBe(404); expect(q.eq).toHaveBeenCalledWith("user_id", "user-id"); });
});
