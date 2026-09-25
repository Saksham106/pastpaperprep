import { afterEach, describe, expect, it, vi } from "vitest";
import { validateAdminConfig } from "@/lib/supabase/admin-config";

afterEach(() => vi.unstubAllEnvs());

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

  it("allows an explicitly opted-in loopback Supabase only outside production", () => {
    vi.stubEnv("LOCAL_SUPABASE_TEST_MODE", "true");
    vi.stubEnv("NODE_ENV", "development");
    const local = { url: "http://127.0.0.1:54321", secretKey: "sb_secret_test-only" };
    expect(validateAdminConfig(local)).toEqual(local);
    vi.stubEnv("NODE_ENV", "production");
    expect(() => validateAdminConfig(local)).toThrow();
    vi.stubEnv("NODE_ENV", "development");
    expect(() => validateAdminConfig({ ...local, url: "http://192.168.1.4:54321" })).toThrow();
    vi.stubEnv("LOCAL_SUPABASE_TEST_MODE", "false");
    expect(() => validateAdminConfig(local)).toThrow();
  });

  it("rejects missing, public, and non-Supabase credentials", () => {
    expect(() => validateAdminConfig({ url: "", secretKey: "" })).toThrow();
    expect(() => validateAdminConfig({ url: "https://example.supabase.co", secretKey: "sb_publishable_test" })).toThrow();
    expect(() => validateAdminConfig({ url: "https://evil.example", secretKey: "sb_secret_test" })).toThrow();
  });
});
