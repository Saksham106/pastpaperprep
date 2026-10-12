import { describe, expect, it } from "vitest";
import { accountIdFromCookieHeader, documentHasSupabaseAuthCookie, isSupabaseAuthCookieName } from "@/lib/supabase/auth-cookie";

const USER_ID = "7f1b6a2e-0000-4000-8000-000000000000";
const session = (id = USER_ID) => `base64-${Buffer.from(JSON.stringify({ access_token: "a.b.c", user: { id, email: "student@example.com" } })).toString("base64url")}`;

describe("accountIdFromCookieHeader", () => {
  it("reads the account id from a whole or chunked Supabase session cookie", () => {
    expect(accountIdFromCookieHeader(`theme=dark; sb-wrig-auth-token=${session()}`)).toBe(USER_ID);
    const value = session();
    const header = `sb-wrig-auth-token.1=${encodeURIComponent(value.slice(40))}; other=1; sb-wrig-auth-token.0=${encodeURIComponent(value.slice(0, 40))}`;
    expect(accountIdFromCookieHeader(header)).toBe(USER_ID);
  });
  it("falls back to the access token subject when the session has no user object", () => {
    const token = ["x", Buffer.from(JSON.stringify({ sub: USER_ID })).toString("base64url"), "sig"].join(".");
    const value = `base64-${Buffer.from(JSON.stringify({ access_token: token })).toString("base64url")}`;
    expect(accountIdFromCookieHeader(`sb-wrig-auth-token=${value}`)).toBe(USER_ID);
  });
  it("returns only a UUID, never other session fields, and nothing for anonymous or malformed cookies", () => {
    expect(accountIdFromCookieHeader("")).toBeUndefined();
    expect(accountIdFromCookieHeader(undefined)).toBeUndefined();
    expect(accountIdFromCookieHeader("sb-wrig-auth-token=base64-%%%")).toBeUndefined();
    expect(accountIdFromCookieHeader(`sb-wrig-auth-token=${session("student@example.com")}`)).toBeUndefined();
    expect(accountIdFromCookieHeader(`sb-wrig-auth-token-code-verifier=${session()}`)).toBeUndefined();
  });
});
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
