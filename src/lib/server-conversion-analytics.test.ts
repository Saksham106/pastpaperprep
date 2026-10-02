import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import { captureConversionOutcome } from "./server-conversion-analytics";

describe("captureConversionOutcome", () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

  it("is a no-op without server project configuration", async () => {
    vi.stubEnv("POSTHOG_PROJECT_TOKEN", "");
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    await captureConversionOutcome({ outcome: "signup_confirmed", eventKey: "signup:user-a", occurredAt: "2026-10-02T04:00:00Z" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends an anonymous, bounded, event-deduplicated outcome and no sensitive values", async () => {
    vi.stubEnv("POSTHOG_PROJECT_TOKEN", "phc_test");
    vi.stubEnv("POSTHOG_HOST", "https://us.i.posthog.com");
    const fetchMock = vi.fn().mockResolvedValue(new Response("ok", { status: 200 })); vi.stubGlobal("fetch", fetchMock);
    const event = { outcome: "payment_initial_paid" as const, eventKey: "stripe:invoice:in_123", occurredAt: "2026-10-02T04:00:00Z", product: "bundle_all", interval: "annual", email: "private@example.com", accountId: "acct-secret", rawUrl: "https://secret" };
    await captureConversionOutcome(event);
    await captureConversionOutcome(event);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("https://us.i.posthog.com/i/v0/e/");
    const sent = JSON.parse(String(init.body));
    expect(sent.event).toBe("conversion_outcome");
    expect(sent.distinct_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(sent.properties).toEqual(expect.objectContaining({ outcome: "payment_initial_paid", product: "bundle_all", interval: "annual", $process_person_profile: false, $insert_id: expect.any(String) }));
    expect(sent.properties.$uuid).toMatch(/^[0-9a-f-]{36}$/);
    expect(sent.properties.$insert_id).toBe(JSON.parse(String(fetchMock.mock.calls[1][1].body)).properties.$insert_id);
    expect(sent.properties.$uuid).toBe(JSON.parse(String(fetchMock.mock.calls[1][1].body)).properties.$uuid);
    expect(JSON.stringify(sent)).not.toMatch(/private@example|acct-secret|https:\/\/secret/);
  });

  it("preserves the complete documented dedup tuple across retries", async () => {
    vi.stubEnv("POSTHOG_PROJECT_TOKEN", "phc_test");
    const fetchMock = vi.fn().mockResolvedValue(new Response("ok")); vi.stubGlobal("fetch", fetchMock);
    const input = { outcome: "payment_initial_paid" as const, eventKey: "stripe:invoice:in_once", occurredAt: "2026-10-02T04:00:00Z" };
    await captureConversionOutcome(input);
    await captureConversionOutcome(input);
    const first = JSON.parse(fetchMock.mock.calls[0][1].body);
    const second = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(first.uuid).toMatch(/^[0-9a-f-]{36}$/);
    expect(first.timestamp).toBe("2026-10-02T04:00:00.000Z");
    expect(second).toEqual(first);
  });

  it("fails open on timeout or provider rejection", async () => {
    vi.stubEnv("POSTHOG_PROJECT_TOKEN", "phc_test");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("sensitive provider error")));
    await expect(captureConversionOutcome({ outcome: "signup_confirmed", eventKey: "signup:user-b", occurredAt: "2026-10-02T04:00:00Z" })).resolves.toBeUndefined();
  });
});
