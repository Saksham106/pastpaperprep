import { describe, expect, it, vi } from "vitest";
import type { ReminderSubscription } from "@/lib/access-end-reminder";
import { MAX_REMINDERS_PER_RUN, runAccessEndReminders, type ReminderJobDeps } from "@/lib/access-end-reminder-job";

const NOW = 1_800_000_000;
const DAY = 86_400;
const USER = "00000000-0000-4000-8000-000000000001";
const SITE = "https://pastpaperprep.com";

function sub(overrides: Partial<ReminderSubscription> & { periodEnd?: number } = {}): ReminderSubscription {
  const { periodEnd = NOW + 2 * DAY, ...rest } = overrides;
  return {
    id: "sub_ending00001", status: "active", customer: "cus_1", metadata: { user_id: USER, product_id: "bank_igcse" },
    cancel_at_period_end: true, cancel_at: periodEnd, items: { data: [{ current_period_end: periodEnd, price: { recurring: { interval: "month", interval_count: 1 } } }] },
    ...rest,
  };
}

function deps(overrides: Partial<ReminderJobDeps> = {}, subscriptions = [sub()]) {
  const claimed = new Set<string>();
  const base: ReminderJobDeps = {
    listCancellingSubscriptions: vi.fn(async () => subscriptions),
    listCustomerSubscriptions: vi.fn(async () => subscriptions),
    hasOpenBilling: vi.fn(async () => false),
    planEditable: () => true,
    customerIdFor: vi.fn(async () => "cus_1"),
    entitlementsFor: vi.fn(async () => []),
    emailFor: vi.fn(async () => ({ email: "student@example.com", confirmed: true })),
    previewRenewal: vi.fn(async () => ({ cents: 600, currency: "usd" })),
    alreadyReminded: vi.fn(async (id: string, endsAt: string) => claimed.has(`${id}|${endsAt}`)),
    claim: vi.fn(async (id: string, endsAt: string) => {
      const key = `${id}|${endsAt}`;
      if (claimed.has(key)) return false;
      claimed.add(key);
      return true;
    }),
    finish: vi.fn(async () => undefined),
    send: vi.fn(async () => ({ ok: true as const })),
  };
  return { ...base, ...overrides };
}

const run = (d: ReminderJobDeps, dryRun = false) => runAccessEndReminders(d, { nowSeconds: NOW, dryRun, siteUrl: SITE });

describe("runAccessEndReminders", () => {
  it("dry run lists who would be emailed and writes or sends nothing", async () => {
    const d = deps();
    const result = await run(d, true);
    expect(result.rows).toEqual([{ outcome: "would_send", email: "s***@example.com", plan: "One Bank", interval: "monthly", endsAt: new Date((NOW + 2 * DAY) * 1000).toISOString(), daysLeft: 2, renewal: "$6.00/month" }]);
    expect(d.claim).not.toHaveBeenCalled();
    expect(d.send).not.toHaveBeenCalled();
    expect(d.finish).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain("student@example.com");
  });

  it("sends once per subscription period, however often it runs", async () => {
    const d = deps();
    expect((await run(d)).counts).toEqual({ sent: 1 });
    expect((await run(d)).counts).toEqual({ already_reminded: 1 });
    expect(d.send).toHaveBeenCalledTimes(1);
    expect(d.send).toHaveBeenCalledWith(expect.objectContaining({
      to: "student@example.com",
      subject: "Your PastPaperPrep access ends on January 17",
      idempotencyKey: `access-end-reminder/sub_ending00001/${NOW + 2 * DAY}`,
    }));
    expect(d.finish).toHaveBeenCalledWith("sub_ending00001", new Date((NOW + 2 * DAY) * 1000).toISOString(), "sent");
  });

  it("a real run lets the claim decide, so a timed-out send is retried by a later run", async () => {
    let attempts = 0;
    const d = deps({
      alreadyReminded: vi.fn(async () => true),
      claim: vi.fn(async () => true), // the database hands back a stale claim
      send: vi.fn(async () => (++attempts === 1 ? { ok: false as const, retryable: true } : { ok: true as const })),
    });
    expect((await run(d)).counts).toEqual({ send_retry_later: 1 });
    expect((await run(d)).counts).toEqual({ sent: 1 });
    expect(d.alreadyReminded).not.toHaveBeenCalled();
    const keys = (d.send as ReturnType<typeof vi.fn>).mock.calls.map(([message]) => message.idempotencyKey);
    expect(new Set(keys).size).toBe(1);
  });

  it("only reminds students whose Keep my plan link works", async () => {
    expect((await run(deps({ planEditable: () => false }))).counts).toEqual({ undo_unavailable: 1 });
    expect((await run(deps({ hasOpenBilling: vi.fn(async () => true) }))).counts).toEqual({ undo_unavailable: 1 });
    const old = sub({ id: "sub_old0000001", status: "canceled", metadata: {} });
    expect((await run(deps({ listCustomerSubscriptions: vi.fn(async () => [sub(), old]) }))).counts).toEqual({ undo_unavailable: 1 });
  });

  it("a lost claim race never sends", async () => {
    const d = deps({ alreadyReminded: vi.fn(async () => false), claim: vi.fn(async () => false) });
    expect((await run(d)).counts).toEqual({ already_reminded: 1 });
    expect(d.send).not.toHaveBeenCalled();
  });

  it("keeps the claim for a retryable failure and closes it for a permanent one", async () => {
    const retry = deps({ send: vi.fn(async () => ({ ok: false as const, retryable: true })) });
    expect((await run(retry)).counts).toEqual({ send_retry_later: 1 });
    expect(retry.finish).not.toHaveBeenCalled();

    const permanent = deps({ send: vi.fn(async () => ({ ok: false as const, retryable: false })) });
    expect((await run(permanent)).counts).toEqual({ send_failed: 1 });
    expect(permanent.finish).toHaveBeenCalledWith("sub_ending00001", expect.any(String), "failed");
  });

  it("a failed bookkeeping write after a send still reports sent", async () => {
    const d = deps({ finish: vi.fn(async () => { throw new Error("db down"); }) });
    expect((await run(d)).counts).toEqual({ sent: 1 });
  });

  it("skips accounts whose owner doesn't match the customer mapping", async () => {
    expect((await run(deps({ customerIdFor: vi.fn(async () => "cus_other") }))).counts).toEqual({ owner_mismatch: 1 });
    expect((await run(deps({}, [sub({ metadata: { product_id: "bank_igcse" } })]))).counts).toEqual({ owner_mismatch: 1 });
    const foreign = sub({ id: "sub_foreign00001", metadata: { user_id: "00000000-0000-4000-8000-000000000002" }, cancel_at_period_end: false, cancel_at: null });
    expect((await run(deps({ listCustomerSubscriptions: vi.fn(async () => [sub(), foreign]) }))).counts).toEqual({ owner_mismatch: 1 });
  });

  it("skips students who keep access another way", async () => {
    const lifetime = deps({ entitlementsFor: vi.fn(async () => [{ product_id: "lifetime_all_access", status: "active", source: "stripe", expires_at: null }]) });
    expect((await run(lifetime)).counts).toEqual({ other_access: 1 });
    const renewing = sub({ id: "sub_renewing0001", cancel_at_period_end: false, cancel_at: null });
    expect((await run(deps({ listCustomerSubscriptions: vi.fn(async () => [sub(), renewing]) }))).counts).toEqual({ other_access: 1 });
  });

  it("only emails confirmed addresses", async () => {
    expect((await run(deps({ emailFor: vi.fn(async () => ({ email: "student@example.com", confirmed: false })) }))).counts).toEqual({ no_confirmed_email: 1 });
    expect((await run(deps({ emailFor: vi.fn(async () => null) }))).counts).toEqual({ no_confirmed_email: 1 });
  });

  it("a failed lookup skips that student without sending, and the run carries on", async () => {
    const second = sub({ id: "sub_second00001", periodEnd: NOW + DAY });
    const d = deps({ entitlementsFor: vi.fn().mockRejectedValueOnce(new Error("timeout")).mockResolvedValue([]), listCustomerSubscriptions: vi.fn(async () => [sub(), second]) }, [sub(), second]);
    // The first lookup fails; for the second plan, the first one ends later, so it keeps access going.
    const result = await run(d);
    expect(result.counts).toEqual({ lookup_failed: 1, other_access: 1 });
  });

  it("a renewal preview failure leaves the amount out and still sends", async () => {
    const d = deps({ previewRenewal: vi.fn(async () => { throw new Error("stripe"); }) });
    const result = await run(d);
    expect(result.counts).toEqual({ sent: 1 });
    expect(d.send).toHaveBeenCalledWith(expect.objectContaining({ text: expect.stringContaining("at your current price.") }));
  });

  it("ignores plans outside the window and refuses an implausibly large run", async () => {
    const result = await run(deps({}, [sub({ periodEnd: NOW + 20 * DAY })]));
    expect(result).toMatchObject({ scanned: 1, notDue: 1, rows: [] });
    const many = Array.from({ length: MAX_REMINDERS_PER_RUN + 1 }, (_, i) => sub({ id: `sub_bulk${String(i).padStart(8, "0")}` }));
    await expect(run(deps({}, many))).rejects.toThrow("safety cap");
  });
});
