import { describe, expect, it } from "vitest";
import { CURRENT_ENTITLEMENT_FILTERS } from "@/lib/current-entitlements";

describe("current entitlement query filters", () => {
  it("uses PostgREST timestamp values rather than SQL expressions", () => {
    expect(CURRENT_ENTITLEMENT_FILTERS).toEqual({
      startsAt: "now",
      expiresAt: "expires_at.is.null,expires_at.gt.now",
    });
  });
});
