import { FREE_PUBLIC_ASSET_ORIGIN } from "@/lib/free-asset-index";

/** Which store served an image, for telemetry; hostnames and signatures never leave the browser. */
export function assetHost(url: string | undefined): "r2" | "supabase" | "free" | "self" | "blob" | "other" | "unknown" {
  try {
    const parsed = new URL(url ?? "");
    if (parsed.protocol === "blob:") return "blob";
    const host = parsed.hostname;
    return host.endsWith(".r2.cloudflarestorage.com") ? "r2" : host.endsWith(".supabase.co") ? "supabase" : host === new URL(FREE_PUBLIC_ASSET_ORIGIN).hostname ? "free" : host === window.location.hostname ? "self" : "other";
  } catch { return "unknown"; }
}
