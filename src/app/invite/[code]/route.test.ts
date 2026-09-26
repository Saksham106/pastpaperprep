import { beforeEach, describe, expect, it, vi } from "vitest";
import { decodeReferral, encodeReferral, REFERRAL_COOKIE } from "@/lib/referral";

const { lookup } = vi.hoisted(() => ({ lookup: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: lookup }) }));
import { GET } from "./route";

const code = "c_0123456789abcdef01234567";
const request = (cookie?: string) => new Request(`https://pastpaperprep.com/invite/${code}`, {
  headers: cookie ? { cookie } : undefined,
});

describe("customer invite link", () => {
  beforeEach(() => {
    process.env.REFERRAL_COOKIE_SECRET = "test-only-secret";
    lookup.mockReset();
    lookup.mockReturnValue({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { code }, error: null }) }) }) });
  });

  it("redirects and signs a first-party invite cookie for a real customer code", async () => {
    const response = await GET(request(), { params: Promise.resolve({ code }) });
    expect(response.headers.get("location")).toBe("https://pastpaperprep.com/");
    const cookie = response.cookies.get(REFERRAL_COOKIE);
    expect(cookie).toBeDefined();
    expect(decodeReferral(cookie?.value)?.code).toBe(code);
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.secure).toBe(true);
  });

  it("never replaces a valid tutor-first attribution", async () => {
    const partner = encodeReferral("pietro")!;
    const response = await GET(request(`${REFERRAL_COOKIE}=${partner}`), { params: Promise.resolve({ code }) });
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("does not sign an unknown or malformed code", async () => {
    lookup.mockReturnValue({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) });
    const missing = await GET(request(), { params: Promise.resolve({ code }) });
    expect(missing.headers.get("set-cookie")).toBeNull();
    const malformed = await GET(request(), { params: Promise.resolve({ code: "pietro" }) });
    expect(malformed.headers.get("set-cookie")).toBeNull();
  });
});
