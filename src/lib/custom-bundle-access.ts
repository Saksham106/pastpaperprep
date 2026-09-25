import type { AccessEntitlement } from "@/lib/access";
import { normalizeEntitlements } from "@/lib/entitlements";

/** Merge the RLS-protected subscription RPC with ordinary/manual entitlement rows.
 * Stripe's one-row-per-product projection is deliberately ignored for bundle_custom. */
export function mergeCustomBundleAccess(entitlementRows: unknown[], subscriptionRows: unknown[]): AccessEntitlement[] {
  const rowsWithoutStripeProjection = entitlementRows.filter((value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return true;
    const row = value as { product_id?: unknown; source?: unknown };
    return row.product_id !== "bundle_custom" || row.source !== "stripe";
  });
  const normalizedSubscriptionRows = subscriptionRows.map((value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return value;
    const row = value as { status?: unknown };
    return row.status === "canceled" ? { ...value, status: "revoked" } : value;
  });
  const normalizedEntitlements = rowsWithoutStripeProjection.flatMap((value) => normalizeEntitlements([value]).map((entitlement) => ({
    ...entitlement,
    ...(value && typeof value === "object" && !Array.isArray(value) ? {
      source: (value as { source?: unknown }).source,
      products: (value as { products?: unknown }).products,
    } : {}),
  }))) as AccessEntitlement[];
  return [...normalizedEntitlements, ...normalizeEntitlements(normalizedSubscriptionRows).map((grant) => ({ ...grant, source: "stripe" }))];
}

/** Must be called with an authenticated, RLS-scoped Supabase client and that session's user ID. */
export async function fetchAccessEntitlements(client: {
  from: (table: string) => { select: (columns: string) => { eq: (column: string, value: string) => Promise<{ data: unknown[] | null; error: unknown }> } };
  rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown[] | null; error: unknown }>;
}, userId: string): Promise<{ rows: unknown[]; error: unknown }> {
  const [entitlements, customBundles] = await Promise.all([
    client.from("entitlements").select("product_id, selected_bank_ids, status, starts_at, expires_at, source, products(name)").eq("user_id", userId),
    client.rpc("get_custom_bundle_access", { p_user_id: userId }),
  ]);
  if (entitlements.error || customBundles.error) {
    return { rows: [], error: entitlements.error ?? customBundles.error };
  }
  if (!Array.isArray(entitlements.data) || !Array.isArray(customBundles.data)) {
    return { rows: [], error: new Error("Invalid billing access response") };
  }
  return { rows: mergeCustomBundleAccess(entitlements.data, customBundles.data), error: null };
}
