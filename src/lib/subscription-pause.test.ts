import { describe, expect, it } from "vitest";
import { addBillingMonths, capExpiryForPause, pauseStateOf, pauseWindow, readPauseWindow } from "./subscription-pause";

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
  it("keeps the paid period, caps voided periods and restores the first paid one", () => {
    // Paid period before the pause starts: unchanged.
    expect(capExpiryForPause("2026-12-26T00:00:00.000Z", unix("2026-11-26T00:00:00Z"), metadata, true)).toBe("2026-12-26T00:00:00.000Z");
    // Voided periods during the pause: capped at the paid-through date (before their own start).
    expect(capExpiryForPause("2027-01-26T00:00:00.000Z", unix("2026-12-26T00:00:00Z"), metadata, true)).toBe("2026-12-26T00:00:00.000Z");
    // Stripe already resumed collecting (a day early) but the voided period is still current: still capped.
    expect(capExpiryForPause("2027-02-26T00:00:00.000Z", unix("2027-01-26T00:00:00Z"), metadata, false)).toBe("2026-12-26T00:00:00.000Z");
    // First period from the resume boundary was charged normally: full access.
    expect(capExpiryForPause("2027-03-26T00:00:00.000Z", unix("2027-02-26T00:00:00Z"), metadata, false)).toBe("2027-03-26T00:00:00.000Z");
  });
  it("never grants voided periods for a pause set outside the app", () => {
    expect(capExpiryForPause("2027-01-26T00:00:00.000Z", unix("2026-12-26T00:00:00Z"), {}, true)).toBe("2026-12-26T00:00:00.000Z");
    expect(capExpiryForPause("2027-01-26T00:00:00.000Z", unix("2026-12-26T00:00:00Z"), {}, false)).toBe("2027-01-26T00:00:00.000Z");
    expect(capExpiryForPause(null, unix("2026-12-26T00:00:00Z"), metadata, true)).toBeNull();
  });
  it("reads the pause state for the account page", () => {
    const sub = { pause_collection: { behavior: "void" }, metadata };
    expect(pauseStateOf(sub, new Date("2026-12-01T00:00:00Z"))).toMatchObject({ kind: "scheduled", resumesAt: "2027-02-26T00:00:00.000Z" });
    expect(pauseStateOf(sub, new Date("2027-01-05T00:00:00Z"))).toMatchObject({ kind: "paused" });
    expect(pauseStateOf({ pause_collection: null, metadata }, new Date("2027-01-05T00:00:00Z"))).toEqual({ kind: "none" });
    expect(readPauseWindow({ pause_access_until: "2027-02-26T00:00:00Z", pause_resumes_at: "2026-12-26T00:00:00Z" })).toBeNull();
  });
});
