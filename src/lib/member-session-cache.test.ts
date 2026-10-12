import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ACCESS_CACHE_TTL_MS,
  clearMemberCaches,
  forgetAsset,
  readCachedAccess,
  readCachedAssets,
  rememberAssets,
  sessionFingerprint,
  writeCachedAccess,
} from "@/lib/member-session-cache";
import type { SignedAsset } from "@/lib/signed-assets";

const member = { access: { authenticated: true, bankAccess: true, canExportPdf: true }, exportMarker: "ABC123" };
const asset = (questionId: string, expiresAt = Date.now() + 60_000): SignedAsset => ({ questionId, kind: "question", urls: [`https://assets.example/${questionId}.webp`], expiresAt });

afterEach(() => {
  clearMemberCaches();
  sessionStorage.clear();
  vi.useRealTimers();
});

describe("sessionFingerprint", () => {
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
  it("returns the access saved for this bank and session", () => {
    writeCachedAccess("ib-sl", "fp1", member);
    expect(readCachedAccess("ib-sl", "fp1")).toEqual(member);
  });

  it("is scoped to the bank and the session", () => {
    writeCachedAccess("ib-sl", "fp1", member);
    expect(readCachedAccess("ib-hl", "fp1")).toBeNull();
    expect(readCachedAccess("ib-sl", "fp2")).toBeNull();
  });

  it("expires after the TTL", () => {
    vi.useFakeTimers({ now: 1_000_000 });
    writeCachedAccess("ib-sl", "fp1", member);
    vi.setSystemTime(1_000_000 + ACCESS_CACHE_TTL_MS + 1);
    expect(readCachedAccess("ib-sl", "fp1")).toBeNull();
  });

  it("ignores malformed storage", () => {
    sessionStorage.setItem("ppp:member-access:ib-sl", "{not json");
    expect(readCachedAccess("ib-sl", "fp1")).toBeNull();
    sessionStorage.setItem("ppp:member-access:ib-sl", JSON.stringify({ owner: "fp1", savedAt: Date.now(), access: { bankAccess: "yes" } }));
    expect(readCachedAccess("ib-sl", "fp1")).toBeNull();
  });
});

describe("remembered signed assets", () => {
  it("returns fresh assets for the same session and bank", () => {
    rememberAssets("fp1", "ib-sl", new Map([["a:question", asset("a")]]));
    expect([...readCachedAssets("fp1", "ib-sl").keys()]).toEqual(["a:question"]);
    expect(readCachedAssets("fp1", "ib-hl").size).toBe(0);
  });

  it("drops everything when the session changes", () => {
    rememberAssets("fp1", "ib-sl", new Map([["a:question", asset("a")]]));
    expect(readCachedAssets("fp2", "ib-sl").size).toBe(0);
    expect(readCachedAssets("fp1", "ib-sl").size).toBe(0);
  });

  it("forgets a link that failed to load", () => {
    rememberAssets("fp1", "ib-sl", new Map([["a:question", asset("a")], ["b:question", asset("b")]]));
    forgetAsset("ib-sl", "a:question");
    expect([...readCachedAssets("fp1", "ib-sl").keys()]).toEqual(["b:question"]);
  });

  it("never returns expired links", () => {
    rememberAssets("fp1", "ib-sl", new Map([["a:question", asset("a", Date.now() - 1)]]));
    expect(readCachedAssets("fp1", "ib-sl").size).toBe(0);
  });

  it("stays bounded", () => {
    rememberAssets("fp1", "ib-sl", new Map(Array.from({ length: 700 }, (_, index) => [`q${index}:question`, asset(`q${index}`)])));
    const kept = readCachedAssets("fp1", "ib-sl");
    expect(kept.size).toBe(600);
    expect(kept.has("q699:question")).toBe(true);
    expect(kept.has("q0:question")).toBe(false);
  });
});
