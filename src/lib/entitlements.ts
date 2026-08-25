import type { AccessEntitlement, EntitlementStatus, ProductId } from "@/lib/access";

const PRODUCT_IDS = new Set<ProductId>([
  "bank_igcse",
  "bank_ib_hl",
  "bank_ib_sl",
  "bundle_all",
]);
const STATUSES = new Set<EntitlementStatus>(["active", "trialing", "expired", "revoked"]);

type EntitlementRow = {
  product_id?: unknown;
  status?: unknown;
  starts_at?: unknown;
  expires_at?: unknown;
};

export function normalizeEntitlements(rows: unknown[]): AccessEntitlement[] {
  return rows.flatMap((value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return [];
    const row = value as EntitlementRow;
    if (
      typeof row.product_id !== "string" ||
      !PRODUCT_IDS.has(row.product_id as ProductId) ||
      typeof row.status !== "string" ||
      !STATUSES.has(row.status as EntitlementStatus) ||
      (row.starts_at !== null && typeof row.starts_at !== "string") ||
      (row.expires_at !== null && typeof row.expires_at !== "string")
    ) {
      return [];
    }

    return [{
      productId: row.product_id as ProductId,
      status: row.status as EntitlementStatus,
      startsAt: row.starts_at,
      expiresAt: row.expires_at,
    }];
  });
}
