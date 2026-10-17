import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ACCESS_CACHE_TTL_MS,
  clearMemberCaches,
  forgetAsset,
  readCachedAccess,
  readCachedAssets,
  rememberAssets,
  sessionFingerprint,
  sessionLifecycleOwner,
  writeCachedAccess,
} from "@/lib/member-session-cache";
import type { SignedAsset } from "@/lib/signed-assets";

const member = { access: { authenticated: true, bankAccess: true, canExportPdf: true }, exportMarker: "ABC123" };
const asset = (questionId: string, expiresAt = Date.now() + 60_000): SignedAsset => ({ questionId, kind: "question", urls: [`https://assets.example/${questionId}.webp`], expiresAt });

let owner: string;
beforeEach(() => { owner = sessionFingerprint("sb-x-auth-token=A")!; });

afterEach(() => {
  clearMemberCaches();
  sessionStorage.clear();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("sessionFingerprint", () => {
  it("keeps same-tab navigation warm but cold-misses a fresh module", async () => {
    writeCachedAccess("ib-sl", owner, member);
    rememberAssets(owner, "ib-sl", new Map([["a:question", asset("a")]]));
    const navigationOwner = sessionFingerprint("theme=dark; sb-x-auth-token=A")!;
    expect(navigationOwner).toBe(owner);
    expect(readCachedAccess("ib-sl", navigationOwner)).toEqual(member);
    expect(readCachedAssets(navigationOwner, "ib-sl").size).toBe(1);
    vi.resetModules();
    const freshModule = await import("@/lib/member-session-cache");
    const reloadOwner = freshModule.sessionFingerprint("sb-x-auth-token=A")!;
    expect(reloadOwner).not.toBe(owner);
    expect(freshModule.readCachedAccess("ib-sl", reloadOwner)).toBeNull();
    expect(freshModule.readCachedAssets(reloadOwner, "ib-sl").size).toBe(0);
    freshModule.clearMemberCaches();
  });

  it("rotates the generation on an A-to-B-to-A session transition", () => {
    const intermediate = sessionFingerprint("sb-x-auth-token=B")!;
    const returning = sessionFingerprint("sb-x-auth-token=A")!;
    expect(returning).not.toBe(owner);
    expect(returning).not.toBe(intermediate);
    writeCachedAccess("ib-sl", returning, member);
    writeCachedAccess("ib-sl", owner, { ...member, exportMarker: "STALE" });
    expect(readCachedAccess("ib-sl", returning)).toEqual(member);
  });

  it("fails closed if platform randomness is unavailable", () => {
    rememberAssets(owner, "ib-sl", new Map([["a:question", asset("a")]]));
    vi.spyOn(crypto, "randomUUID").mockImplementation(() => { throw new Error("randomness unavailable"); });
    expect(() => sessionFingerprint("sb-x-auth-token=B")).not.toThrow();
    expect(sessionFingerprint("sb-x-auth-token=B")).toBeNull();
    expect(readCachedAssets(owner, "ib-sl").size).toBe(0);
    writeCachedAccess("ib-sl", owner, member);
    expect(readCachedAccess("ib-sl", owner)).toBeNull();
  });

  it("keeps the page lifecycle through token refreshes and rotates it on sign-out and sign-in", () => {
    const first = sessionLifecycleOwner("sb-x-auth-token=token-1");
    expect(sessionLifecycleOwner("sb-x-auth-token=token-2")).toBe(first);
    const signedOut = sessionLifecycleOwner("");
    expect(signedOut).not.toBe(first);
    expect(sessionLifecycleOwner("sb-x-auth-token=token-3")).not.toBe(first);
  });

  it("rotates the page lifecycle on a direct account switch but not on a same-account refresh", () => {
    const cookie = (id: string, token: string) => `sb-x-auth-token=base64-${Buffer.from(JSON.stringify({ access_token: token, user: { id } })).toString("base64url")}`;
    const A = "7f1b6a2e-0000-4000-8000-00000000000a";
    const B = "7f1b6a2e-0000-4000-8000-00000000000b";
    const first = sessionLifecycleOwner(cookie(A, "t1"));
    expect(sessionLifecycleOwner(cookie(A, "t2"))).toBe(first);
    // A cookie that can't be read (e.g. mid-rewrite) keeps the last known account.
    expect(sessionLifecycleOwner("sb-x-auth-token=garbled")).toBe(first);
    const second = sessionLifecycleOwner(cookie(B, "t3"));
    expect(second).not.toBe(first);
    const third = sessionLifecycleOwner(cookie(A, "t4"));
    expect(third).not.toBe(first);
    expect(third).not.toBe(second);
  });

  it("refuses private cache reuse when duplicate cookies make the session ambiguous", () => {
    expect(sessionFingerprint("sb-x-auth-token=B; sb-x-auth-token=A")).toBeNull();
  });

  it("invalidates captured generations on an intentional clear", () => {
    clearMemberCaches(owner);
    writeCachedAccess("ib-sl", owner, member);
    rememberAssets(owner, "ib-sl", new Map([["a:question", asset("a")]]));
    expect(readCachedAccess("ib-sl", owner)).toBeNull();
    expect(readCachedAssets(owner, "ib-sl").size).toBe(0);
    expect(sessionFingerprint("sb-x-auth-token=A")).not.toBe(owner);
  });
  it("isolates sessions whose former 32-bit fingerprints collide", () => {
    const first = sessionFingerprint("sb-x-auth-token=session-2479")!;
    writeCachedAccess("ib-sl", first, member);
    rememberAssets(first, "ib-sl", new Map([["a:question", asset("a")]]));
    const second = sessionFingerprint("sb-x-auth-token=session-262826")!;
    expect(second).not.toBe(first);
    expect(readCachedAccess("ib-sl", second)).toBeNull();
    expect(readCachedAssets(second, "ib-sl").size).toBe(0);
    expect(sessionStorage.getItem("ppp:member-access:ib-sl")).not.toContain("session-2479");
  });
  it("rejects duplicate auth-cookie names regardless of values or order", () => {
    sessionFingerprint("sb-x-auth-token=A");
    expect(sessionFingerprint("sb-x-auth-token=A; sb-x-auth-token=B")).toBeNull();
    expect(sessionFingerprint("sb-x-auth-token=B; sb-x-auth-token=A")).toBeNull();
    expect(sessionFingerprint("sb-x-auth-token.0=A; sb-x-auth-token.0=A")).toBeNull();
  });

  it("is null without a Supabase session cookie", () => {
    expect(sessionFingerprint("")).toBeNull();
    expect(sessionFingerprint("pastpaperprep-theme=dark; ppp_analytics_consent=v2.accepted")).toBeNull();
  });

  it("changes when the session changes and ignores unrelated cookies", () => {
    const a = sessionFingerprint("sb-x-auth-token.0=aaa; sb-x-auth-token.1=bbb");
    expect(a).toMatch(/^[0-9a-f]+$/);
    expect(sessionFingerprint("theme=dark; sb-x-auth-token.1=bbb; sb-x-auth-token.0=aaa")).toBe(a);
    expect(sessionFingerprint("sb-x-auth-token.0=aaa; sb-x-auth-token.1=ccc")).not.toBe(a);
  });
});

describe("cached member access", () => {
  it("does not persist privileged flags under the anonymous namespace", () => {
    sessionFingerprint("");
    writeCachedAccess("ib-sl", "anonymous", member);
    expect(readCachedAccess("ib-sl", "anonymous")).toBeNull();
    expect(sessionStorage.getItem("ppp:member-access:ib-sl")).toBeNull();
  });
  it("rejects late previous-owner access writes without replacing current flags", () => {
    const current = sessionFingerprint("sb-x-auth-token=B")!;
    const currentValue = { ...member, exportMarker: "CURRENT" };
    writeCachedAccess("ib-sl", current, currentValue);
    writeCachedAccess("ib-sl", owner, member);
    expect(readCachedAccess("ib-sl", current)).toEqual(currentValue);
    expect(readCachedAccess("ib-sl", owner)).toBeNull();
  });
  it("returns the access saved for this bank and session", () => {
    writeCachedAccess("ib-sl", owner, member);
    expect(readCachedAccess("ib-sl", owner)).toEqual(member);
  });

  it("is scoped to the bank and the session", () => {
    writeCachedAccess("ib-sl", owner, member);
    expect(readCachedAccess("ib-hl", owner)).toBeNull();
    expect(readCachedAccess("ib-sl", "fp2")).toBeNull();
  });

  it("expires after the TTL", () => {
    vi.useFakeTimers({ now: 1_000_000 });
    writeCachedAccess("ib-sl", owner, member);
    vi.setSystemTime(1_000_000 + ACCESS_CACHE_TTL_MS + 1);
    expect(readCachedAccess("ib-sl", owner)).toBeNull();
  });

  it("ignores malformed storage", () => {
    sessionStorage.setItem("ppp:member-access:ib-sl", "{not json");
    expect(readCachedAccess("ib-sl", owner)).toBeNull();
    sessionStorage.setItem("ppp:member-access:ib-sl", JSON.stringify({ owner: owner, savedAt: Date.now(), access: { bankAccess: "yes" } }));
    expect(readCachedAccess("ib-sl", owner)).toBeNull();
  });
});

describe("remembered signed assets", () => {
  it("requires explicit per-question free provenance for anonymous assets", () => {
    sessionFingerprint("");
    const signed = new Map([["free:question", asset("free")], ["paid:question", asset("paid")]]);
    rememberAssets("anonymous", "ib-sl", signed);
    expect(readCachedAssets("anonymous", "ib-sl").size).toBe(0);
    rememberAssets("anonymous", "ib-sl", signed, new Set(["free"]));
    expect([...readCachedAssets("anonymous", "ib-sl").keys()]).toEqual(["free:question"]);
    sessionFingerprint("sb-x-auth-token=A; sb-x-auth-token=B");
    rememberAssets("anonymous", "ib-sl", signed, new Set(["free"]));
    expect(readCachedAssets("anonymous", "ib-sl").size).toBe(0);
  });
  it("ignores a late previous-generation clear", () => {
    const current = sessionFingerprint("sb-x-auth-token=B")!;
    writeCachedAccess("ib-sl", current, member);
    rememberAssets(current, "ib-sl", new Map([["a:question", asset("a")]]));
    clearMemberCaches(owner);
    expect(readCachedAccess("ib-sl", current)).toEqual(member);
    expect(readCachedAssets(current, "ib-sl").size).toBe(1);
  });
  it("rejects late previous-owner reads and writes without evicting the current cache", () => {
    rememberAssets(owner, "ib-sl", new Map([["old:question", asset("old")]]));
    const current = sessionFingerprint("sb-x-auth-token=B")!;
    rememberAssets(current, "ib-sl", new Map([["new:question", asset("new")]]));
    rememberAssets(owner, "ib-sl", new Map([["late:question", asset("late")]]));
    expect(readCachedAssets(owner, "ib-sl").size).toBe(0);
    expect([...readCachedAssets(current, "ib-sl").keys()]).toEqual(["new:question"]);
  });
  it("returns fresh assets for the same session and bank", () => {
    rememberAssets(owner, "ib-sl", new Map([["a:question", asset("a")]]));
    expect([...readCachedAssets(owner, "ib-sl").keys()]).toEqual(["a:question"]);
    expect(readCachedAssets(owner, "ib-hl").size).toBe(0);
  });

  it("drops everything when the session changes", () => {
    rememberAssets(owner, "ib-sl", new Map([["a:question", asset("a")]]));
    const next = sessionFingerprint("sb-x-auth-token=B")!;
    expect(readCachedAssets(next, "ib-sl").size).toBe(0);
    expect(readCachedAssets(owner, "ib-sl").size).toBe(0);
  });

  it("ignores a late failure for a link that has since been replaced", () => {
    rememberAssets(owner, "ib-sl", new Map([["a:question", asset("a")]]));
    forgetAsset("ib-sl", "a:question", "https://assets.example/old-a.webp");
    expect(readCachedAssets(owner, "ib-sl").size).toBe(1);
    forgetAsset("ib-sl", "a:question", "https://assets.example/a.webp");
    expect(readCachedAssets(owner, "ib-sl").size).toBe(0);
  });

  it("forgets a link that failed to load", () => {
    rememberAssets(owner, "ib-sl", new Map([["a:question", asset("a")], ["b:question", asset("b")]]));
    forgetAsset("ib-sl", "a:question");
    expect([...readCachedAssets(owner, "ib-sl").keys()]).toEqual(["b:question"]);
  });

  it("never returns expired links", () => {
    rememberAssets(owner, "ib-sl", new Map([["a:question", asset("a", Date.now() - 1)]]));
    expect(readCachedAssets(owner, "ib-sl").size).toBe(0);
  });

  it("stays bounded", () => {
    rememberAssets(owner, "ib-sl", new Map(Array.from({ length: 700 }, (_, index) => [`q${index}:question`, asset(`q${index}`)])));
    const kept = readCachedAssets(owner, "ib-sl");
    expect(kept.size).toBe(600);
    expect(kept.has("q699:question")).toBe(true);
    expect(kept.has("q0:question")).toBe(false);
  });
});
