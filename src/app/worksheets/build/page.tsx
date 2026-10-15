import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AccessReadRecovery } from "@/components/AccessReadRecovery";
import { PaperBuilder } from "@/components/PaperBuilder";
import { hasBankAccess } from "@/lib/access";
import { getAvailableBanks, type BankSlug } from "@/lib/banks";
import { PUBLIC_BANK_INDEX_FILES } from "@/lib/bank-index-manifest";
import { isFutureIssuedJwtError } from "@/lib/access-recovery";
import { fetchAccessEntitlements } from "@/lib/custom-bundle-access";
import { publicBankIndexUrl } from "@/lib/question-index";
import { captureServerException } from "@/lib/server-error-tracking";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Build a paper", robots: { index: false, follow: false } };

// Only used to number default names ("Atoms 2"); a failed read just skips the numbering.
async function readWorksheetTitles(supabase: Awaited<ReturnType<typeof createClient>>, userId: string): Promise<string[]> {
  try {
    const { data } = await supabase.from("saved_worksheets").select("title").eq("user_id", userId);
    return (data ?? []).map((row: { title: unknown }) => row.title).filter((title): title is string => typeof title === "string");
  } catch {
    return [];
  }
}

export default async function BuildPage({ searchParams }: { searchParams: Promise<{ bank?: string | string[] }> }) {
  const requested = (await searchParams).bank;
  const requestedBank = typeof requested === "string" && /^[a-z0-9-]{1,40}$/.test(requested) ? requested : undefined;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (typeof userId !== "string") redirect(`/login?next=${encodeURIComponent(`/worksheets/build${requestedBank ? `?bank=${requestedBank}` : ""}`)}`);
  const access = await fetchAccessEntitlements(supabase as never, userId);
  if (access.error) {
    if (isFutureIssuedJwtError(access.error)) {
      captureServerException(new Error("Access verification failed"), {
        route: "/worksheets/build", route_type: "render", stage: "entitlement",
        storage_provider: "supabase", error_code: "PGRST303", user_id: userId,
      });
      return <AccessReadRecovery retryPath={requestedBank ? `/worksheets/build?bank=${requestedBank}` : "/worksheets/build"} />;
    }
    throw access.error;
  }
  const banks = getAvailableBanks()
    .filter((bank) => hasBankAccess(bank.slug, access.rows as never) && bank.slug in PUBLIC_BANK_INDEX_FILES)
    .map((bank) => ({ slug: bank.slug, label: bank.shortName, indexUrl: publicBankIndexUrl(bank.slug) }));
  const existingTitles = await readWorksheetTitles(supabase, userId);

  return <main className="worksheet-library-page shell">
    <Link className="worksheet-library-back" href="/worksheets" aria-label="Back to my worksheets">← <span>My worksheets</span></Link>
    <header className="worksheet-library-header"><p className="eyebrow">Your work</p><h1>Build a paper</h1><p>Pick the questions that matter to your course. Preview the set here, then save it when it feels right.</p></header>
    <PaperBuilder banks={banks} existingTitles={existingTitles} initialBank={banks.some((bank) => bank.slug === requestedBank) ? requestedBank as BankSlug : undefined} />
  </main>;
}
