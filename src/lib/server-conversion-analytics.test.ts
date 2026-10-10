import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const getUserById = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ auth: { admin: { getUserById } } }) }));
import { captureConversionOutcome } from "./server-conversion-analytics";

describe("captureConversionOutcome consent gating", () => {
  beforeEach(() => {
    vi.stubEnv("POSTHOG_PROJECT_TOKEN", "phc_test");
    vi.stubEnv("SUPABASE_SECRET_KEY", "test-secret");
    getUserById.mockResolvedValue({ data: { user: { id: "auth-user-123", user_metadata: { analytics_consent: { accepted: true, version: 2, updated_at: new Date().toISOString() } } } }, error: null });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("ok")));
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.clearAllMocks(); });
  const input = { userId: "auth-user-123", outcome: "signup_confirmed" as const, eventKey: "signup:event-1", occurredAt: "2026-10-02T04:00:00Z" };
  it("requires accepted current consent and uses stable account identity", async () => {
    await captureConversionOutcome(input);
    const sent = JSON.parse(String((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body));
    expect(sent.distinct_id).toBe("account:auth-user-123");
    expect(sent.properties.$process_person_profile).toBe(true);
    expect(sent.properties.identified).toBe(true);
  });
  const sentAnonymously = () => {
    expect(fetch).toHaveBeenCalledTimes(1);
    const raw = String((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    const sent = JSON.parse(raw);
    expect(sent.distinct_id).toMatch(/^anon:[0-9a-f-]{36}$/);
    expect(sent.properties.$process_person_profile).toBe(false);
    expect(sent.properties.identified).toBe(false);
    expect(raw).not.toContain("account:");
    expect(raw).not.toContain("auth-user-123");
    return sent;
  };
  it.each([
    ["unknown", null], ["legacy accepted", { accepted: true, version: 1, updated_at: new Date().toISOString() }],
    ["rejected", { accepted: false, version: 2, updated_at: new Date().toISOString() }],
    ["expired", { accepted: true, version: 2, updated_at: new Date(Date.now() - 181 * 86400000).toISOString() }],
    ["future", { accepted: true, version: 2, updated_at: new Date(Date.now() + 300000).toISOString() }],
    ["malformed", { accepted: true, version: 8, updated_at: "bad" }],
  ])("counts %s consent anonymously without identity", async (_label, consent) => {
    getUserById.mockResolvedValue({ data: { user: { user_metadata: consent ? { analytics_consent: consent } : {} } }, error: null });
    await captureConversionOutcome(input);
    expect(sentAnonymously().properties.outcome).toBe("signup_confirmed");
  });
  it("counts anonymously when the account lookup fails", async () => {
    getUserById.mockRejectedValue(new Error("no"));
    await captureConversionOutcome(input);
    sentAnonymously();
  });
  it("keeps the same anonymous id for retries of one event", async () => {
    getUserById.mockResolvedValue({ data: { user: { user_metadata: {} } }, error: null });
    await captureConversionOutcome(input);
    await captureConversionOutcome(input);
    const [first, second] = (fetch as ReturnType<typeof vi.fn>).mock.calls.map((call) => JSON.parse(String(call[1].body)));
    expect(first.distinct_id).toBe(second.distinct_id);
    expect(first.uuid).toBe(second.uuid);
  });
  it("records lifetime purchases with their product", async () => {
    await captureConversionOutcome({ ...input, outcome: "lifetime_paid", eventKey: "stripe:checkout:cs_1", product: "lifetime_all_access", interval: null });
    const sent = JSON.parse(String((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body));
    expect(sent.properties).toMatchObject({ outcome: "lifetime_paid", product: "lifetime_all_access" });
  });

  const anonymousIds = async (eventKey: string) => {
    (fetch as ReturnType<typeof vi.fn>).mockClear();
    getUserById.mockResolvedValue({ data: { user: { user_metadata: {} } }, error: null });
    await captureConversionOutcome({ ...input, eventKey });
    const sent = JSON.parse(String((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body));
    return [sent.distinct_id, sent.uuid, sent.properties.$insert_id, sent.properties.$uuid].join("|");
  };

  it("keys anonymous ids with a server secret so they cannot be traced to the account", async () => {
    vi.stubEnv("SUPABASE_SECRET_KEY", "secret-a");
    const first = await anonymousIds("signup:auth-user-123");
    expect(await anonymousIds("signup:auth-user-123")).toBe(first);
    vi.stubEnv("SUPABASE_SECRET_KEY", "secret-b");
    expect(await anonymousIds("signup:auth-user-123")).not.toBe(first);
  });

  it("uses one-off random anonymous ids when no server secret is configured", async () => {
    vi.stubEnv("SUPABASE_SECRET_KEY", "");
    expect(await anonymousIds("signup:auth-user-123")).not.toBe(await anonymousIds("signup:auth-user-123"));
  });

  it("does not geo-tag conversions with the server location", async () => {
    await captureConversionOutcome(input);
    expect(JSON.parse(String((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body)).properties.$geoip_disable).toBe(true);
  });
});
