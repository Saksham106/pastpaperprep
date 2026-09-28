import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PaperBuilder } from "@/components/PaperBuilder";
import { hasBankAccess } from "@/lib/access";
import { getAvailableBanks } from "@/lib/banks";
import { PUBLIC_BANK_INDEX_FILES } from "@/lib/bank-index-manifest";
import { fetchAccessEntitlements } from "@/lib/custom-bundle-access";
import { publicBankIndexUrl } from "@/lib/question-index";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Build a paper", robots: { index: false, follow: false } };

export default async function BuildPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (typeof userId !== "string") redirect("/login?next=%2Fworksheets%2Fbuild");
  const access = await fetchAccessEntitlements(supabase as never, userId);
  if (access.error) throw access.error;
  const banks = getAvailableBanks()
    .filter((bank) => hasBankAccess(bank.slug, access.rows as never) && bank.slug in PUBLIC_BANK_INDEX_FILES)
    .map((bank) => ({ slug: bank.slug, label: bank.shortName, indexUrl: publicBankIndexUrl(bank.slug) }));

  return <main className="worksheet-library-page shell">
    <Link className="worksheet-library-back" href="/worksheets" aria-label="Back to my worksheets">← <span>My worksheets</span></Link>
    <header className="worksheet-library-header"><p className="eyebrow">Your work</p><h1>Build a paper</h1><p>Choose a bank, years, topic and how much to practise. Generate a random set, then save it to work through on the site.</p></header>
    <PaperBuilder banks={banks} />
  </main>;
}
