import { describe, expect, it } from "vitest";
import type { AccessEntitlement } from "@/lib/access";
import { isCheckoutSettled, parseCheckoutPending, resolveCheckoutPending, serializeCheckoutPending } from "@/lib/checkout-pending";

const now = Date.parse("2026-10-22T12:00:00.000Z");
const minutesAgo = (minutes: number) => new Date(now - minutes * 60_000).toISOString();
const grant = (productId: string, startsAt: string, selectedBankIds?: string[]): AccessEntitlement =>
  ({ productId, status: "active", startsAt, expiresAt: null, ...(selectedBankIds ? { selectedBankIds } : {}) } as AccessEntitlement);

describe("checkout pending state", () => {
  it("round-trips with and without a session id and rejects malformed, stale or future cookies", () => {
    const pending = { status: "lifetime-pending" as const, startedAt: now - 5_000, sessionId: "cs_test_a1B2" };
    expect(parseCheckoutPending(serializeCheckoutPending(pending), now)).toEqual(pending);
    expect(parseCheckoutPending(`success.${now - 5_000}`, now)).toEqual({ status: "success", startedAt: now - 5_000 });
    expect(parseCheckoutPending(`success.${now}.cs_test_bad-id`, now)).toBeNull();
    expect(parseCheckoutPending(`success.${now}.sub_123`, now)).toBeNull();
    expect(parseCheckoutPending("success.abc", now)).toBeNull();
    expect(parseCheckoutPending(`success.${now - 31 * 60_000}`, now)).toBeNull();
    expect(parseCheckoutPending(`success.${now + 5 * 60_000}`, now)).toBeNull();
    expect(parseCheckoutPending(undefined, now)).toBeNull();
  });

  it("keeps the start time only for the same return", () => {
    const cookie = `success.${now - 40_000}.cs_test_first`;
    expect(resolveCheckoutPending("success", "cs_test_first", cookie, now)).toEqual({ status: "success", startedAt: now - 40_000, sessionId: "cs_test_first" });
    expect(resolveCheckoutPending("success", "cs_test_second", cookie, now)).toEqual({ status: "success", startedAt: now, sessionId: "cs_test_second" });
    expect(resolveCheckoutPending("success", "not-a-session", undefined, now)).toEqual({ status: "success", startedAt: now });
    expect(resolveCheckoutPending(undefined, undefined, cookie, now)).toEqual({ status: "success", startedAt: now - 40_000, sessionId: "cs_test_first" });
    expect(resolveCheckoutPending("cancelled", undefined, undefined, now)).toBeNull();
  });

  it("never settles an unverified purchase, however recent the access", () => {
    expect(isCheckoutSettled(null, [grant("bank_ib_sl", minutesAgo(1))])).toBe(false);
  });

  it("settles only on the product that was bought", () => {
    const expected = { productId: "bank_ib_hl" };
    // Regression (owner review of 42a22145): a bank bought ten minutes earlier is not this purchase.
    expect(isCheckoutSettled(expected, [grant("bank_ib_sl", minutesAgo(10))])).toBe(false);
    expect(isCheckoutSettled(expected, [grant("bank_ib_sl", minutesAgo(10)), grant("bank_ib_hl", minutesAgo(0))])).toBe(true);
  });

  it("settles a custom bundle only on the same banks", () => {
    const expected = { productId: "bundle_custom", bankIds: ["igcse", "ib-sl"] };
    expect(isCheckoutSettled(expected, [grant("bundle_custom", minutesAgo(5), ["ib-hl", "ib-ai-sl"])])).toBe(false);
    expect(isCheckoutSettled(expected, [grant("bundle_custom", minutesAgo(0), ["ib-sl", "igcse"])])).toBe(true);
  });

  it("settles Lifetime only on a Lifetime entitlement", () => {
    const expected = { productId: "lifetime_all_access" };
    expect(isCheckoutSettled(expected, [grant("bundle_all", minutesAgo(1))])).toBe(false);
    expect(isCheckoutSettled(expected, [grant("lifetime_all_access", minutesAgo(1))])).toBe(true);
  });
});
