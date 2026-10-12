// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createServerClient } from "@supabase/ssr";
import { createHash } from "node:crypto";
import { NextRequest } from "next/server";
vi.mock("server-only", () => ({}));
const { createClient, redirect } = vi.hoisted(() => ({ createClient: vi.fn(), redirect: vi.fn((url: string) => { throw new Error(`REDIRECT:${url}`); }) }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/lib/referral-account", () => ({ bindReferralToAuthenticatedUser: vi.fn().mockResolvedValue(false) }));
vi.mock("@/lib/server-conversion-analytics", () => ({ captureConversionOutcome: vi.fn().mockResolvedValue(undefined) }));
import { signInWithGoogle } from "./actions";
import { GET } from "./callback/route";

describe("Google PKCE with the installed SDK (all fetches mocked)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://pastpaperprep.com");
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

  it("carries each SDK flow ID and redeems two outstanding starts with their own verifier", async () => {
    const jar = new Map<string, string>();
    const challenges = new Map<string, string>();
    const exchanged: string[] = [];
    const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/token")) {
        const body = JSON.parse(String(init?.body));
        expect(createHash("sha256").update(body.code_verifier).digest("base64url")).toBe(challenges.get(body.auth_code));
        exchanged.push(body.auth_code);
        const payload = Buffer.from(JSON.stringify({ sub: "sdk-user", exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url");
        return new Response(JSON.stringify({ access_token: `e30.${payload}.signature`, refresh_token: "offline-refresh", token_type: "bearer", expires_in: 3600, user: { id: "sdk-user" } }), { headers: { "content-type": "application/json" } });
      }
      expect(url).toContain("/user");
      return new Response(JSON.stringify({ id: "sdk-user", app_metadata: { provider: "google" } }), { headers: { "content-type": "application/json" } });
    });
    createClient.mockImplementation(() => createServerClient("https://offline.example.test", "offline-publishable-key", {
      cookies: {
        getAll: () => Array.from(jar, ([name, value]) => ({ name, value })),
        setAll: (values) => values.forEach(({ name, value }) => { if (value) jar.set(name, value); else jar.delete(name); }),
      }, global: { fetch },
    }));
    const starts: URL[] = [];
    for (const next of ["/banks/ib-hl", "/account"]) {
      const form = new FormData(); form.set("next", next);
      await expect(signInWithGoogle(form)).rejects.toThrow("REDIRECT:");
      const authorization = new URL(redirect.mock.calls.at(-1)![0]);
      const callback = new URL(authorization.searchParams.get("redirect_to")!);
      expect(callback.pathname).toBe("/auth/callback");
      expect(callback.searchParams.get("sb_flow_id") ?? "").toMatch(/^[a-zA-Z0-9_-]{8,64}$/);
      expect(callback.searchParams.get("next")).toBe(next);
      const code = `offline-${starts.length}`;
      challenges.set(code, authorization.searchParams.get("code_challenge")!);
      callback.searchParams.set("code", code);
      starts.push(callback);
    }
    expect(fetch).not.toHaveBeenCalled();
    expect(starts[0].searchParams.get("sb_flow_id")).not.toBe(starts[1].searchParams.get("sb_flow_id"));
    for (const callback of starts) {
      const response = await GET(new NextRequest(callback));
      expect(response.headers.get("location")).toBe(`https://pastpaperprep.com${callback.searchParams.get("next")}`);
    }
    expect(exchanged).toEqual(["offline-0", "offline-1"]);
  });
});
