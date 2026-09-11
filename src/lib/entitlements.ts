import type { AccessEntitlement, EntitlementStatus, ProductId } from "@/lib/access";

import { validateCustomBankIds } from "@/lib/custom-bundles";

const PRODUCT_IDS = new Set<ProductId>([
  "bank_igcse",
  "bank_igcse_additional",
  "bank_ib_hl",
  "bank_ib_sl",
  "bank_ib_ai_hl",
  "bank_ib_ai_sl",
  "bank_ib_chemistry_hl",
  "bank_ib_chemistry_sl",
  "bank_ib_physics_hl",
  "bank_ib_physics_sl",
  "bank_ib_biology_hl",
  "bank_ib_biology_sl",
  "bank_ib_economics_hl",
  "bank_ib_economics_sl",
  "bundle_igcse",
  "bundle_ib_aa",
  "bundle_ib_ai",
  "bundle_ib_chemistry",
  "bundle_ib_physics",
  "bundle_ib_biology",
  "bundle_ib_economics",
  "bundle_all",
  "bundle_custom",
]);
const STATUSES = new Set<EntitlementStatus>(["active", "trialing", "expired", "revoked"]);

type EntitlementRow = {
  product_id?: unknown;
  status?: unknown;
  starts_at?: unknown;
  expires_at?: unknown;
  selected_bank_ids?: unknown;
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

    let selectedBankIds: ReturnType<typeof validateCustomBankIds> | undefined;
    if (row.product_id === "bundle_custom") {
      try {
        selectedBankIds = validateCustomBankIds(row.selected_bank_ids);
      } catch {
        return [];
      }
    } else if (row.selected_bank_ids !== undefined && row.selected_bank_ids !== null) {
      return [];
    }

    return [{
      productId: row.product_id as ProductId,
      ...(selectedBankIds ? { selectedBankIds } : {}),
      status: row.status as EntitlementStatus,
      startsAt: row.starts_at,
      expiresAt: row.expires_at,
    }];
  });
}
