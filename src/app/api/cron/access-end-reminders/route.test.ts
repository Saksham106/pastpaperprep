import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const run = vi.fn();
vi.mock("@/lib/access-end-reminder-job", () => ({ runAccessEndReminders: (...args: unknown[]) => run(...args) }));
vi.mock("@/lib/stripe", () => ({ createStripeClient: vi.fn(() => ({})) }));
vi.mock("@/lib/stripe-config", () => ({ isStripeBillingEnabled: () => true, getStripeConfig: () => ({ secretKey: "sk_test_x", siteUrl: "https://pastpaperprep.com" }) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn(() => ({})) }));
import { GET } from "@/app/api/cron/access-end-reminders/route";

const SECRET = "a-long-random-cron-secret";
const request = (query = "", auth: string | null = `Bearer ${SECRET}`) =>
  new Request(`https://pastpaperprep.com/api/cron/access-end-reminders${query}`, { headers: auth ? { authorization: auth } : {} });

beforeEach(() => {
  run.mockReset();
  run.mockResolvedValue({ dryRun: true, scanned: 0, notDue: 0, rows: [], counts: {} });
  vi.stubEnv("CRON_SECRET", SECRET);
  vi.stubEnv("ACCESS_END_REMINDER_MODE", "send");
  vi.stubEnv("STRIPE_PLAN_EDITOR_ENABLED", "true");
  vi.stubEnv("RESEND_API_KEY", "re_test_key");
  vi.stubEnv("ACCESS_END_REMINDER_FROM", "PastPaperPrep <hello@pastpaperprep.com>");
});
afterEach(() => vi.unstubAllEnvs());

describe("GET /api/cron/access-end-reminders", () => {
  it("refuses without the exact cron secret, and when no secret is configured", async () => {
    for (const auth of [null, "Bearer wrong", `Bearer ${SECRET}x`, SECRET]) expect((await GET(request("", auth))).status).toBe(401);
    vi.stubEnv("CRON_SECRET", "");
    expect((await GET(request("", "Bearer "))).status).toBe(401);
    vi.stubEnv("CRON_SECRET", "short");
    expect((await GET(request("", "Bearer short"))).status).toBe(401);
    expect(run).not.toHaveBeenCalled();
  });

  it("does nothing while the mode is off, unless a dry run is asked for", async () => {
    vi.stubEnv("ACCESS_END_REMINDER_MODE", "");
    expect(await (await GET(request())).json()).toEqual({ status: "off" });
    expect(run).not.toHaveBeenCalled();
    expect((await GET(request("?dry_run=1"))).status).toBe(200);
    expect(run).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ dryRun: true, siteUrl: "https://pastpaperprep.com" }));
  });

  it("dry_run mode and ?dry_run=1 never send", async () => {
    vi.stubEnv("ACCESS_END_REMINDER_MODE", "dry_run");
    await GET(request());
    vi.stubEnv("ACCESS_END_REMINDER_MODE", "send");
    await GET(request("?dry_run=1"));
    expect(run.mock.calls.map(([, options]) => options.dryRun)).toEqual([true, true]);
  });

  it("sends only in send mode, with email configured and the undo available", async () => {
    await GET(request());
    expect(run).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ dryRun: false }));

    run.mockClear();
    vi.stubEnv("RESEND_API_KEY", "");
    expect((await GET(request())).status).toBe(503);
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    vi.stubEnv("ACCESS_END_REMINDER_FROM", "Someone <someone@gmail.com>");
    expect((await GET(request())).status).toBe(503);
    vi.stubEnv("ACCESS_END_REMINDER_FROM", "hello@pastpaperprep.com");
    vi.stubEnv("STRIPE_PLAN_EDITOR_ENABLED", "false");
    expect((await GET(request())).status).toBe(409);
    expect(run).not.toHaveBeenCalled();
  });

  it("answers 503 without detail when the run fails", async () => {
    run.mockRejectedValue(new Error("stripe said cus_secret"));
    const response = await GET(request());
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("cus_secret");
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
});
