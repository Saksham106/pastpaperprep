import { accountIdFromCookieHeader, documentHasSupabaseAuthCookie, isSupabaseAuthCookieName } from "@/lib/supabase/auth-cookie";
import { isSignedAssetFresh, type SignedAsset } from "@/lib/signed-assets";

/**
 * Per-tab memory that lets a signed-in member skip waiting on work this tab already did.
 * Both caches belong to one document-lifetime generation of the exact Supabase auth-cookie
 * snapshot, so sign-out, token changes, or a different account never reuse them. They are
 * hints only: the server still checks access on every paid request.
 */

export type MemberAccess = { authenticated: boolean; bankAccess: boolean; canExportPdf: boolean };
export type CachedMemberAccess = { access: MemberAccess; exportMarker?: string };

export const ACCESS_CACHE_TTL_MS = 30 * 60 * 1000;
const ACCESS_KEY = (bank: string) => `ppp:member-access:${bank}`;
const MAX_REMEMBERED_ASSETS = 600;

// Exact cookie identity lives only in this module's RAM, never in storage.
let sessionSnapshot: string | undefined;
let sessionOwner: string | null = null;

/**
 * Opaque document-lifetime cache generation, NOT a JWT or authentication authority.
 * Equivalent cookie orderings retain the generation; token changes rotate it.
 * A hard reload intentionally cold-misses persisted access flags.
 */
export function sessionFingerprint(cookieHeader: string): string | null {
  const parts = cookieHeader.split(";").map((part) => part.trim())
    .filter((part) => isSupabaseAuthCookieName(part.split("=")[0] ?? ""));
  const names = parts.map((part) => part.split("=")[0]);
  const ambiguous = new Set(names).size !== names.length;
  // Duplicate-cookie order can change which value Supabase reads first.
  const snapshot = JSON.stringify(ambiguous ? parts : parts.sort());
  if (snapshot !== sessionSnapshot) {
    sessionSnapshot = snapshot;
    sessionOwner = null;
    if (parts.length && !ambiguous) {
      try { sessionOwner = crypto.randomUUID().replaceAll("-", ""); }
      catch { /* No platform randomness: disable reuse, never fall back to a cookie hash. */ }
    }
    assets.clear();
    assetOwner = null;
  }
  return sessionOwner;
}

let lifecycleIdentity: string | undefined;
let lifecycleGeneration = 0;
let lifecycleHeader: string | undefined;

/** "signed-out", or the account the cookie names. A cookie we can't read keeps the last account. */
function lifecycleAccount(cookieHeader: string): string {
  if (!documentHasSupabaseAuthCookie(cookieHeader)) return "signed-out";
  const accountId = accountIdFromCookieHeader(cookieHeader);
  if (accountId) return `account:${accountId}`;
  return lifecycleIdentity?.startsWith("account:") || lifecycleIdentity === "member" ? lifecycleIdentity : "member";
}

/**
 * Page lifecycle identity: changes when the tab signs in or out or the account changes, even
 * with no signed-out moment in between (a direct switch, or a missed sign-out on a shared
 * computer). Supabase rewrites the auth cookie about hourly for the same person, so a token
 * refresh keeps the same account and must not reset an open page (closing answers and
 * re-signing paid images). The account id is read from the cookie for this client-side reset
 * only; the server still checks access on every request. Private caches still follow the exact
 * cookie via sessionFingerprint, so they reset on any cookie change.
 */
export function sessionLifecycleOwner(cookieHeader: string): string {
  if (cookieHeader !== lifecycleHeader || lifecycleIdentity === undefined) {
    lifecycleHeader = cookieHeader;
    const identity = lifecycleAccount(cookieHeader);
    if (identity !== lifecycleIdentity) {
      lifecycleIdentity = identity;
      lifecycleGeneration += 1;
    }
  }
  return `${lifecycleIdentity === "signed-out" ? "signed-out" : "member"}:${lifecycleGeneration}`;
}

function validAccess(value: unknown): value is MemberAccess {
  if (!value || typeof value !== "object") return false;
  const access = value as Record<string, unknown>;
  return typeof access.authenticated === "boolean" && typeof access.bankAccess === "boolean" && typeof access.canExportPdf === "boolean";
}

/** Access flags only (no question data, no links), kept for this tab and bank. */
export function readCachedAccess(bank: string, owner: string): CachedMemberAccess | null {
  if (owner !== sessionOwner) return null;
  try {
    const stored = JSON.parse(sessionStorage.getItem(ACCESS_KEY(bank)) ?? "null") as Record<string, unknown> | null;
    if (!stored || stored.owner !== owner || typeof stored.savedAt !== "number") return null;
    const age = Date.now() - stored.savedAt;
    if (age < 0 || age > ACCESS_CACHE_TTL_MS || !validAccess(stored.access)) return null;
    return { access: stored.access, ...(typeof stored.exportMarker === "string" ? { exportMarker: stored.exportMarker } : {}) };
  } catch {
    return null;
  }
}

export function writeCachedAccess(bank: string, owner: string, value: CachedMemberAccess): void {
  if (owner !== sessionOwner) return;
  try {
    sessionStorage.setItem(ACCESS_KEY(bank), JSON.stringify({ owner, savedAt: Date.now(), ...value }));
  } catch { /* storage unavailable: just slower next time */ }
}

// Signed links stay in memory only, never on disk.
let assetOwner: string | null = null;
const assets = new Map<string, SignedAsset>();

function isCurrentOwner(owner: string): boolean {
  return owner === sessionOwner || (owner === "anonymous" && sessionSnapshot === "[]");
}

function adoptOwner(owner: string) {
  if (assetOwner === owner) return;
  assets.clear();
  assetOwner = owner;
}

/** Anonymous writes require IDs confirmed free by the caller's route data, not auth authority. */
export function rememberAssets(owner: string, bank: string, signed: ReadonlyMap<string, SignedAsset>, freeQuestionIds?: ReadonlySet<string>): void {
  if (!isCurrentOwner(owner)) return;
  adoptOwner(owner);
  for (const [key, asset] of signed) {
    if (owner === "anonymous" && !freeQuestionIds?.has(asset.questionId)) continue;
    const cacheKey = `${bank}|${key}`;
    assets.delete(cacheKey);
    assets.set(cacheKey, asset);
  }
  while (assets.size > MAX_REMEMBERED_ASSETS) assets.delete(assets.keys().next().value as string);
}

/** Still-valid links this session signed for the bank, keyed like signedAssetKey. */
export function readCachedAssets(owner: string, bank: string): Map<string, SignedAsset> {
  if (!isCurrentOwner(owner)) return new Map();
  adoptOwner(owner);
  const prefix = `${bank}|`;
  const fresh = new Map<string, SignedAsset>();
  for (const [cacheKey, asset] of assets) {
    if (!cacheKey.startsWith(prefix)) continue;
    if (isSignedAssetFresh(asset)) fresh.set(cacheKey.slice(prefix.length), asset);
    else assets.delete(cacheKey);
  }
  return fresh;
}

/** A link that failed to load must be re-signed, not reused. Only that exact link is forgotten. */
export function forgetAsset(bank: string, key: string, failedUrl?: string): void {
  const cacheKey = `${bank}|${key}`;
  if (failedUrl !== undefined && assets.get(cacheKey)?.urls[0] !== failedUrl) return;
  assets.delete(cacheKey);
}

/** Pass a captured owner for async failures; omit only for an intentional global clear. */
export function clearMemberCaches(expectedOwner?: string): void {
  if (expectedOwner !== undefined && !isCurrentOwner(expectedOwner)) return;
  sessionSnapshot = undefined;
  sessionOwner = null;
  lifecycleIdentity = undefined;
  lifecycleHeader = undefined;
  assets.clear();
  assetOwner = null;
  try {
    for (let index = sessionStorage.length - 1; index >= 0; index -= 1) {
      const key = sessionStorage.key(index);
      if (key?.startsWith("ppp:member-access:")) sessionStorage.removeItem(key);
    }
  } catch { /* storage unavailable */ }
}
