import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { WorksheetList } from "@/components/WorksheetList";
import { getAvailableBanks } from "@/lib/banks";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "My worksheets", robots: { index: false, follow: false } };

export default async function WorksheetsPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) redirect("/login?next=%2Fworksheets");
  const bankLabels = Object.fromEntries(getAvailableBanks().map((bank) => [bank.slug, bank.shortName]));
  return <main className="worksheet-library-page shell">
    <Link className="worksheet-library-back" href="/dashboard" aria-label="Back to dashboard">← <span>Back to dashboard</span></Link>
    <header className="worksheet-library-header"><p className="eyebrow">Your work</p><h1>My worksheets</h1></header>
    <section className="worksheet-build-panel" aria-labelledby="worksheet-build-title">
      <span className="worksheet-build-icon" aria-hidden="true" />
      <div><h2 id="worksheet-build-title">Build a paper</h2><p>A printable mock from any bank, with its mark scheme.</p></div>
      <Link className="button primary" href="/worksheets/build">Start building <span aria-hidden="true">→</span></Link>
    </section>
    <WorksheetList bankLabels={bankLabels} />
  </main>;
}
