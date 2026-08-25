import { describe, expect, it } from "vitest";
import { validateAdminConfig } from "@/lib/supabase/admin-config";

describe("Supabase admin configuration", () => {
  it("accepts a Supabase URL and server secret key", () => {
    expect(validateAdminConfig({
      url: "https://example.supabase.co",
      secretKey: "sb_secret_test-only",
    })).toEqual({
      url: "https://example.supabase.co",
      secretKey: "sb_secret_test-only",
    });
  });

  it("rejects missing, public, and non-Supabase credentials", () => {
    expect(() => validateAdminConfig({ url: "", secretKey: "" })).toThrow();
    expect(() => validateAdminConfig({ url: "https://example.supabase.co", secretKey: "sb_publishable_test" })).toThrow();
    expect(() => validateAdminConfig({ url: "https://evil.example", secretKey: "sb_secret_test" })).toThrow();
  });
});
