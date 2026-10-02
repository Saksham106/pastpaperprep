import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
import { createClient } from "@/lib/supabase/server";
import { POST } from "./route";
const mockCreate = vi.mocked(createClient);
function request(body: unknown, origin = "https://app.example") {
  return new NextRequest("https://app.example/api/analytics-consent", { method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(body) });
}
describe("analytics preference endpoint", () => {
  afterEach(() => vi.clearAllMocks());
  it("rejects origin and malformed shapes", async () => {
    expect((await POST(request({ accepted: true }, "https://attacker.test"))).status).toBe(403);
    expect((await POST(request({ accepted: true, userId: "other" }))).status).toBe(400);
    expect(mockCreate).not.toHaveBeenCalled();
  });
  it.each([true, false])("sets the %s guest preference cookie", async accepted => {
    mockCreate.mockResolvedValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }) } } as never);
    const response = await POST(request({ accepted }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ accepted, version: 1 });
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.cookies.get("ppp_analytics_consent")?.value).toBe(`v1.${accepted ? "accepted" : "rejected"}`);
  });
  it("writes metadata only to the authenticated account and fails without cookie on update error", async () => {
    const updateUser = vi.fn().mockResolvedValue({ error: null });
    mockCreate.mockResolvedValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "self", user_metadata: { name: "A" } }, error: null } }), updateUser } } as never);
    const ok = await POST(request({ accepted: true }));
    expect(updateUser).toHaveBeenCalledWith({ data: expect.objectContaining({ name: "A", analytics_consent: expect.objectContaining({ accepted: true, version: 1 }) }) });
    expect(ok.cookies.get("ppp_analytics_consent")?.value).toBe("v1.accepted");
    updateUser.mockResolvedValue({ error: new Error("failed") });
    const failed = await POST(request({ accepted: false }));
    expect(failed.status).toBe(500);
    expect(failed.cookies.get("ppp_analytics_consent")).toBeUndefined();
  });
});
