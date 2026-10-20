import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const getUserById = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ auth: { admin: { getUserById } } }) }));
import { captureConversionOutcome, purchasedBanks } from "./server-conversion-analytics";

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
  it("keeps an accepted consent identified for twelve months", async () => {
    getUserById.mockResolvedValue({ data: { user: { id: "auth-user-123", user_metadata: { analytics_consent: { accepted: true, version: 2, updated_at: new Date(Date.now() - 200 * 86400000).toISOString() } } } }, error: null });
    await captureConversionOutcome(input);
    expect(JSON.parse(String((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body)).distinct_id).toBe("account:auth-user-123");
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
    ["expired", { accepted: true, version: 2, updated_at: new Date(Date.now() - 366 * 86400000).toISOString() }],
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

  it("records which banks a purchase covers, by the same rule as access checks", async () => {
    const paid = { ...input, outcome: "payment_initial_paid" as const, eventKey: "stripe:invoice:in_1", interval: "monthly" };
    await captureConversionOutcome({ ...paid, product: "bundle_custom", selectedBankIds: JSON.stringify(["ib-hl", "igcse-chemistry-0620"]) });
    await captureConversionOutcome({ ...paid, eventKey: "stripe:invoice:in_2", product: "bank_ib_physics_hl" });
    await captureConversionOutcome({ ...paid, eventKey: "stripe:invoice:in_3", product: "bundle_all" });
    const [custom, single, all] = (fetch as ReturnType<typeof vi.fn>).mock.calls.map((call) => JSON.parse(String(call[1].body)).properties);
    expect(custom).toMatchObject({ product: "bundle_custom", bank_scope: "banks", bank_count: 2 });
    expect([...custom.banks].sort()).toEqual(["ib-hl", "igcse-chemistry-0620"]);
    expect(single).toMatchObject({ bank_scope: "banks", bank_count: 1, banks: ["ib-physics-hl"] });
    expect(all).toMatchObject({ bank_scope: "all", bank_count: 0 });
    expect(all.banks).toBeUndefined();
  });

  it("omits banks when a custom selection is missing or invalid, and for sign-ups", async () => {
    expect(purchasedBanks("bundle_custom", "not json")).toBeNull();
    expect(purchasedBanks("bundle_custom", JSON.stringify(["not-a-bank"]))).toBeNull();
    expect(purchasedBanks("unknown_product")).toBeNull();
    expect(purchasedBanks("bundle_ib_physics")?.banks.sort()).toEqual(["ib-physics-hl", "ib-physics-sl"]);
    await captureConversionOutcome(input);
    expect(JSON.parse(String((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body)).properties.bank_scope).toBeUndefined();
  });

  it("does not geo-tag conversions with the server location", async () => {
    await captureConversionOutcome(input);
    expect(JSON.parse(String((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body)).properties.$geoip_disable).toBe(true);
  });
});
