import type { BankSlug } from "@/lib/banks";
import { FREE_PUBLIC_ASSET_ORIGIN } from "@/lib/free-asset-index";
import { premiumAssetSignOptions, previewAssetSignOptions } from "@/lib/private-asset-providers";

/** Image origins worth a preconnect on a bank page; signed URLs already reveal both hosts. */
export function assetOriginsForBank(bank: BankSlug, env: Record<string, string | undefined> = process.env): string[] {
  // Free-year questions, the common first view, load from the public free bucket.
  const origins: string[] = [FREE_PUBLIC_ASSET_ORIGIN];
  try {
    const supabase = new URL(env.NEXT_PUBLIC_SUPABASE_URL ?? "");
    if (supabase.protocol === "https:") origins.push(supabase.origin);
  } catch { /* not configured */ }
  const account = env.R2_ACCOUNT_ID?.trim();
  // Members' paid questions sign from the configured default store unless the bank pins one.
  const premiumProvider = premiumAssetSignOptions(bank).provider ?? env.ASSET_STORAGE_PROVIDER?.trim();
  const usesR2 = previewAssetSignOptions(bank).provider === "r2" || premiumProvider === "r2";
  if (usesR2 && account && /^[a-f0-9]{32}$/i.test(account)) {
    origins.push(`https://${account}.r2.cloudflarestorage.com`);
  }
  return origins;
}
