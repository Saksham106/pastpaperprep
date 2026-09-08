import type { AccessEntitlement, EntitlementStatus, ProductId } from "@/lib/access";

const PRODUCT_IDS = new Set<ProductId>([
  "bank_igcse",
  "bank_igcse_additional",
  "bank_ib_hl",
  "bank_ib_sl",
  "bank_ib_ai_hl",
  "bank_ib_ai_sl",
  "bank_ib_chemistry_hl",
  "bank_ib_chemistry_sl",
  "bundle_igcse",
  "bundle_ib_aa",
  "bundle_ib_ai",
  "bundle_ib_chemistry",
  "bundle_all",
]);
const STATUSES = new Set<EntitlementStatus>(["active", "trialing", "expired", "revoked"]);

type EntitlementRow = {
  product_id?: unknown;
  status?: unknown;
  starts_at?: unknown;
  expires_at?: unknown;
};

function validDate(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

export function normalizeEntitlements(rows: unknown[]): AccessEntitlement[] {
  return rows.flatMap((value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return [];
    const row = value as EntitlementRow;
    if (
      typeof row.product_id !== "string" ||
      !PRODUCT_IDS.has(row.product_id as ProductId) ||
      typeof row.status !== "string" ||
      !STATUSES.has(row.status as EntitlementStatus) ||
      !validDate(row.starts_at) ||
      (row.expires_at !== null && !validDate(row.expires_at))
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
