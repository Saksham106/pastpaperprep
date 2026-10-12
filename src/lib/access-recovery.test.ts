import { describe, expect, it } from "vitest";
import { isFutureIssuedJwtError } from "@/lib/access-recovery";

describe("exact future-issued JWT classification", () => {
  it("recognizes only the provider's exact code and message", () => {
    expect(isFutureIssuedJwtError({ code: "PGRST303", message: "JWT issued at future" })).toBe(true);
  });
  it.each([
    null, undefined, "JWT issued at future", 303, [],
    { code: "PGRST303" }, { message: "JWT issued at future" },
    { code: "42501", message: "JWT issued at future" },
    { code: "PGRST303", message: "JWT expired" },
    { code: "PGRST303", message: "JWT issued at future " },
  ])("rejects malformed or unrelated failure %j", (failure) => {
    expect(isFutureIssuedJwtError(failure)).toBe(false);
  });
});
