import { describe, expect, it } from "vitest";
import { hasSupabaseAuthCookie } from "@/lib/supabase/proxy";

describe("Supabase auth cookie detection", () => {
  it("recognizes normal and chunked Supabase session cookies", () => {
    expect(hasSupabaseAuthCookie([{ name: "sb-project-auth-token" }])).toBe(true);
    expect(hasSupabaseAuthCookie([{ name: "sb-project-auth-token.0" }])).toBe(true);
  });

  it("does not treat unrelated cookies as sessions", () => {
    expect(hasSupabaseAuthCookie([{ name: "theme" }, { name: "sb-project-code-verifier" }])).toBe(false);
  });
});
