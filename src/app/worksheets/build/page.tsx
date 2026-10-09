import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PaperBuilder } from "@/components/PaperBuilder";
import { hasBankAccess } from "@/lib/access";
import { getAvailableBanks, type BankSlug } from "@/lib/banks";
import { PUBLIC_BANK_INDEX_FILES } from "@/lib/bank-index-manifest";
import { fetchAccessEntitlements } from "@/lib/custom-bundle-access";
import { publicBankIndexUrl } from "@/lib/question-index";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Build a paper", robots: { index: false, follow: false } };

export default async function BuildPage({ searchParams }: { searchParams: Promise<{ bank?: string | string[] }> }) {
  const requested = (await searchParams).bank;
  const requestedBank = typeof requested === "string" && /^[a-z0-9-]{1,40}$/.test(requested) ? requested : undefined;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (typeof userId !== "string") redirect(`/login?next=${encodeURIComponent(`/worksheets/build${requestedBank ? `?bank=${requestedBank}` : ""}`)}`);
  const access = await fetchAccessEntitlements(supabase as never, userId);
  if (access.error) throw access.error;
  const banks = getAvailableBanks()
    .filter((bank) => hasBankAccess(bank.slug, access.rows as never) && bank.slug in PUBLIC_BANK_INDEX_FILES)
    .map((bank) => ({ slug: bank.slug, label: bank.shortName, indexUrl: publicBankIndexUrl(bank.slug) }));

  return <main className="worksheet-library-page shell">
    <Link className="worksheet-library-back" href="/worksheets" aria-label="Back to my worksheets">← <span>My worksheets</span></Link>
    <header className="worksheet-library-header"><p className="eyebrow">Your work</p><h1>Build a paper</h1><p>Pick the questions that matter to your course. Preview the set here, then save it when it feels right.</p></header>
    <PaperBuilder banks={banks} initialBank={banks.some((bank) => bank.slug === requestedBank) ? requestedBank as BankSlug : undefined} />
  </main>;
}
