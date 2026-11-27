import { describe, expect, it } from "vitest";
import { addBillingMonths, isPauseRelevant, pauseAccessExpiry, pauseStateOf, pauseWindow, readPauseWindow } from "./subscription-pause";

const unix = (iso: string) => Date.parse(iso) / 1000;

describe("subscription pause", () => {
  it("adds billing months on the anchor day, clamped to short months", () => {
    const anchor = new Date("2026-01-31T09:30:00Z");
    expect(addBillingMonths(new Date("2026-01-31T09:30:00Z"), anchor, 1).toISOString()).toBe("2026-02-28T09:30:00.000Z");
    expect(addBillingMonths(new Date("2026-02-28T09:30:00Z"), anchor, 1).toISOString()).toBe("2026-03-31T09:30:00.000Z");
    expect(addBillingMonths(new Date("2026-11-26T12:00:00Z"), new Date("2026-08-26T12:00:00Z"), 3).toISOString()).toBe("2027-02-26T12:00:00.000Z");
  });
  it("books the pause from the paid-through date and resumes collecting a day early", () => {
    const window = pauseWindow(unix("2026-12-26T00:00:00Z"), unix("2026-10-26T00:00:00Z"), 2);
    expect(window.metadata).toEqual({ pause_access_until: "2026-12-26T00:00:00.000Z", pause_resumes_at: "2027-02-26T00:00:00.000Z" });
    expect(window.stripeResumesAt).toBe(unix("2027-02-25T00:00:00Z"));
  });
  const metadata = { pause_access_until: "2026-12-26T00:00:00.000Z", pause_resumes_at: "2027-02-26T00:00:00.000Z" };
  const expiry = (expiresAt: string, start: string, meta: Record<string, string>, pauseCollectionSet: boolean, periodPaid: boolean) =>
    pauseAccessExpiry({ expiresAt, periodStartUnix: unix(start), metadata: meta, pauseCollectionSet, periodPaid });
  it("needs a verified payment for any period a pause touches", () => {
    // Paid period before the pause starts: verified paid, full access.
    expect(expiry("2026-12-26T00:00:00.000Z", "2026-11-26T00:00:00Z", metadata, true, true)).toBe("2026-12-26T00:00:00.000Z");
    // Voided period: no payment, capped at the paid-through date (at or before its own start, so revoked).
    expect(expiry("2027-01-26T00:00:00.000Z", "2026-12-26T00:00:00Z", metadata, true, false)).toBe("2026-12-26T00:00:00.000Z");
    // First resumed renewal, still a draft or past due: no access until the invoice is paid.
    expect(expiry("2027-03-26T00:00:00.000Z", "2027-02-26T00:00:00Z", metadata, false, false)).toBe("2026-12-26T00:00:00.000Z");
    // ...and full access once it is.
    expect(expiry("2027-03-26T00:00:00.000Z", "2027-02-26T00:00:00Z", metadata, false, true)).toBe("2027-03-26T00:00:00.000Z");
  });
  it("leaves a pause made outside the app to the usual rules", () => {
    // No app pause window: a missing exact match is never treated as nonpayment.
    expect(isPauseRelevant(true, {}, unix("2026-12-26T00:00:00Z"))).toBe(false);
    expect(expiry("2027-01-26T00:00:00.000Z", "2026-12-26T00:00:00Z", {}, true, false)).toBe("2027-01-26T00:00:00.000Z");
  });
  it("only applies near a pause", () => {
    expect(isPauseRelevant(false, {}, unix("2026-12-26T00:00:00Z"))).toBe(false);
    expect(isPauseRelevant(false, metadata, unix("2027-02-27T00:00:00Z"))).toBe(true);
    expect(isPauseRelevant(false, metadata, unix("2027-03-26T00:00:00Z"))).toBe(false);
    // Long after the pause, ordinary renewals behave as before.
    expect(expiry("2027-04-26T00:00:00.000Z", "2027-03-26T00:00:00Z", metadata, false, false)).toBe("2027-04-26T00:00:00.000Z");
    expect(pauseAccessExpiry({ expiresAt: null, periodStartUnix: 0, metadata, pauseCollectionSet: true, periodPaid: false })).toBeNull();
  });
  it("reads the pause state for the account page", () => {
    const sub = { pause_collection: { behavior: "void" }, metadata };
    expect(pauseStateOf(sub, new Date("2026-12-01T00:00:00Z"))).toMatchObject({ kind: "scheduled", resumesAt: "2027-02-26T00:00:00.000Z" });
    expect(pauseStateOf(sub, new Date("2027-01-05T00:00:00Z"))).toMatchObject({ kind: "paused" });
    expect(pauseStateOf({ pause_collection: null, metadata }, new Date("2027-01-05T00:00:00Z"))).toEqual({ kind: "none" });
    expect(readPauseWindow({ pause_access_until: "2027-02-26T00:00:00Z", pause_resumes_at: "2026-12-26T00:00:00Z" })).toBeNull();
  });
});
