import { describe, expect, it } from "vitest";
import type { AccessEntitlement } from "@/lib/access";
import { isCheckoutSettled, parseCheckoutPending, resolveCheckoutPending, serializeCheckoutPending } from "@/lib/checkout-pending";

const now = Date.parse("2026-10-22T12:00:00.000Z");
const grant = (productId: string, startsAt: string | null): AccessEntitlement => ({ productId, status: "active", startsAt, expiresAt: null } as AccessEntitlement);

describe("checkout pending state", () => {
  it("round-trips and rejects malformed, stale or future cookies", () => {
    const pending = { status: "lifetime-pending" as const, startedAt: now - 5_000 };
    expect(parseCheckoutPending(serializeCheckoutPending(pending), now)).toEqual(pending);
    expect(parseCheckoutPending("success.abc", now)).toBeNull();
    expect(parseCheckoutPending("paid.1761134400000", now)).toBeNull();
    expect(parseCheckoutPending(`success.${now - 31 * 60_000}`, now)).toBeNull();
    expect(parseCheckoutPending(`success.${now + 5 * 60_000}`, now)).toBeNull();
    expect(parseCheckoutPending(undefined, now)).toBeNull();
  });

  it("prefers the URL status but keeps an earlier start time for the same return", () => {
    const cookie = `success.${now - 40_000}`;
    expect(resolveCheckoutPending("success", cookie, now)).toEqual({ status: "success", startedAt: now - 40_000 });
    expect(resolveCheckoutPending("lifetime-pending", cookie, now)).toEqual({ status: "lifetime-pending", startedAt: now });
    expect(resolveCheckoutPending(undefined, cookie, now)).toEqual({ status: "success", startedAt: now - 40_000 });
    expect(resolveCheckoutPending("cancelled", undefined, now)).toBeNull();
  });

  it("settles a subscription only on access that started around the return", () => {
    const pending = { status: "success" as const, startedAt: now };
    expect(isCheckoutSettled(pending, [])).toBe(false);
    expect(isCheckoutSettled(pending, [grant("bank_ib_sl", "2026-01-01T00:00:00.000Z")])).toBe(false);
    expect(isCheckoutSettled(pending, [grant("bank_ib_sl", null)])).toBe(false);
    expect(isCheckoutSettled(pending, [grant("bank_ib_sl", new Date(now - 10_000).toISOString())])).toBe(true);
  });

  it("settles Lifetime only on a Lifetime entitlement", () => {
    const pending = { status: "lifetime-pending" as const, startedAt: now };
    expect(isCheckoutSettled(pending, [grant("bank_ib_sl", new Date(now - 10_000).toISOString())])).toBe(false);
    expect(isCheckoutSettled(pending, [grant("lifetime_all_access", "2026-10-22T11:59:00.000Z")])).toBe(true);
  });
});
