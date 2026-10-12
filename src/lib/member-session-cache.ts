import { isSupabaseAuthCookieName } from "@/lib/supabase/auth-cookie";
import { isSignedAssetFresh, type SignedAsset } from "@/lib/signed-assets";

/**
 * Per-tab memory that lets a signed-in member skip waiting on work this tab already did.
 * Both caches belong to one login session (a fingerprint of the Supabase auth cookie), so a
 * sign-out or a different account never sees them. They are hints only: the server still
 * checks access on every paid request.
 */

export type MemberAccess = { authenticated: boolean; bankAccess: boolean; canExportPdf: boolean };
export type CachedMemberAccess = { access: MemberAccess; exportMarker?: string };

export const ACCESS_CACHE_TTL_MS = 30 * 60 * 1000;
const ACCESS_KEY = (bank: string) => `ppp:member-access:${bank}`;
const MAX_REMEMBERED_ASSETS = 600;

/** FNV-1a over the session's auth cookies; changes with the account (and on token refresh). */
export function sessionFingerprint(cookieHeader: string): string | null {
  const parts = cookieHeader.split(";").map((part) => part.trim())
    .filter((part) => isSupabaseAuthCookieName(part.split("=")[0] ?? ""))
    .sort();
  if (!parts.length) return null;
  let hash = 0x811c9dc5;
  for (const char of parts.join(";")) hash = Math.imul(hash ^ char.charCodeAt(0), 0x01000193);
  return (hash >>> 0).toString(16);
}

function validAccess(value: unknown): value is MemberAccess {
  if (!value || typeof value !== "object") return false;
  const access = value as Record<string, unknown>;
  return typeof access.authenticated === "boolean" && typeof access.bankAccess === "boolean" && typeof access.canExportPdf === "boolean";
}

/** Access flags only (no question data, no links), kept for this tab and bank. */
export function readCachedAccess(bank: string, owner: string): CachedMemberAccess | null {
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
  try {
    sessionStorage.setItem(ACCESS_KEY(bank), JSON.stringify({ owner, savedAt: Date.now(), ...value }));
  } catch { /* storage unavailable: just slower next time */ }
}

// Signed links stay in memory only, never on disk.
let assetOwner: string | null = null;
const assets = new Map<string, SignedAsset>();

function adoptOwner(owner: string) {
  if (assetOwner === owner) return;
  assets.clear();
  assetOwner = owner;
}

export function rememberAssets(owner: string, bank: string, signed: ReadonlyMap<string, SignedAsset>): void {
  adoptOwner(owner);
  for (const [key, asset] of signed) {
    const cacheKey = `${bank}|${key}`;
    assets.delete(cacheKey);
    assets.set(cacheKey, asset);
  }
  while (assets.size > MAX_REMEMBERED_ASSETS) assets.delete(assets.keys().next().value as string);
}

/** Still-valid links this session signed for the bank, keyed like signedAssetKey. */
export function readCachedAssets(owner: string, bank: string): Map<string, SignedAsset> {
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

/** A link that failed to load must be re-signed, not reused. */
export function forgetAsset(bank: string, key: string): void {
  assets.delete(`${bank}|${key}`);
}

export function clearMemberCaches(): void {
  assets.clear();
  assetOwner = null;
  try {
    for (let index = sessionStorage.length - 1; index >= 0; index -= 1) {
      const key = sessionStorage.key(index);
      if (key?.startsWith("ppp:member-access:")) sessionStorage.removeItem(key);
    }
  } catch { /* storage unavailable */ }
}
