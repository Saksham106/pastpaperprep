import { describe, expect, it } from "vitest";
import { documentHasSupabaseAuthCookie, isSupabaseAuthCookieName } from "@/lib/supabase/auth-cookie";
import { hasSupabaseAuthCookie } from "@/lib/supabase/proxy";

describe("Supabase auth cookie detection", () => {
  it("matches whole and chunked auth cookies only", () => {
    expect(isSupabaseAuthCookieName("sb-abc-auth-token")).toBe(true);
    expect(isSupabaseAuthCookieName("sb-abc-auth-token.0")).toBe(true);
    expect(isSupabaseAuthCookieName("sb-abc-auth-token-code-verifier")).toBe(false);
    expect(isSupabaseAuthCookieName("ph_session")).toBe(false);
  });

  it("reads a document.cookie string", () => {
    expect(documentHasSupabaseAuthCookie("")).toBe(false);
    expect(documentHasSupabaseAuthCookie("a=1; sb-xyz-auth-token.1=abc")).toBe(true);
    expect(documentHasSupabaseAuthCookie("pastpaperprep-theme=dark")).toBe(false);
  });

  it("agrees with the server-side proxy check", () => {
    expect(hasSupabaseAuthCookie([{ name: "sb-xyz-auth-token.1" }])).toBe(true);
    expect(hasSupabaseAuthCookie([{ name: "sb-xyz-auth-token-code-verifier" }])).toBe(false);
  });
});
