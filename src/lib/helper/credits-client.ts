// Browser side: the signed-in student's Pepper balance for the panel footer. Null on any failure (the footer just hides).
import { parseHelperCredits, type HelperCredits } from "@/lib/helper/credits";

export async function loadHelperCredits(): Promise<HelperCredits | null> {
  try {
    const response = await fetch("/api/helper/credits", { cache: "no-store" });
    if (!response.ok) return null;
    return parseHelperCredits(((await response.json()) as { credits?: unknown } | null)?.credits);
  } catch {
    return null;
  }
}
