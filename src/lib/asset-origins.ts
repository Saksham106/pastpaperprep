import type { BankSlug } from "@/lib/banks";
import { previewAssetSignOptions } from "@/lib/private-asset-providers";

/** Image origins worth a preconnect on a bank page; signed URLs already reveal both hosts. */
export function assetOriginsForBank(bank: BankSlug, env: Record<string, string | undefined> = process.env): string[] {
  const origins: string[] = [];
  try {
    const supabase = new URL(env.NEXT_PUBLIC_SUPABASE_URL ?? "");
    if (supabase.protocol === "https:") origins.push(supabase.origin);
  } catch { /* not configured */ }
  const account = env.R2_ACCOUNT_ID?.trim();
  if (previewAssetSignOptions(bank).provider === "r2" && account && /^[a-f0-9]{32}$/i.test(account)) {
    origins.push(`https://${account}.r2.cloudflarestorage.com`);
  }
  return origins;
}
