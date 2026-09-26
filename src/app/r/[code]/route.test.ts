import { beforeEach, describe, expect, it, vi } from "vitest";

const { partnerLookup } = vi.hoisted(() => ({ partnerLookup: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: partnerLookup }) }));
import { encodeReferral } from "@/lib/referral";
import { GET } from "./route";

describe("referral link", () => {
  beforeEach(() => { partnerLookup.mockReset(); });
  it("does not replace an existing first-touch cookie", async () => {
    process.env.REFERRAL_COOKIE_SECRET = "test-only-secret";
    partnerLookup.mockReturnValue({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { code: "pietro" }, error: null }) }) }) }) });
    const prior = encodeReferral("other", Date.now());
    const req = new Request("https://example.test/r/pietro", { headers: { cookie: `ppp_referral=${prior}` } });
    const response = await GET(req, { params: Promise.resolve({ code: "pietro" }) });
    expect(response.headers.get("set-cookie")).toBeNull();
  });
  it("never treats a customer-style code as a tutor partner", async () => {
    process.env.REFERRAL_COOKIE_SECRET = "test-only-secret";
    partnerLookup.mockReturnValue({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { code: "c_0123456789abcdef01234567" }, error: null }) }) }) }) });
    const response = await GET(new Request("https://example.test/r/c_0123456789abcdef01234567"), { params: Promise.resolve({ code: "c_0123456789abcdef01234567" }) });
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("does not issue attribution for an unknown or inactive partner", async () => {
    partnerLookup.mockReturnValue({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }) });
    const response = await GET(new Request("https://example.test/r/arbitrary"), { params: Promise.resolve({ code: "arbitrary" }) });
    expect(response.headers.get("set-cookie")).toBeNull();
  });
});
