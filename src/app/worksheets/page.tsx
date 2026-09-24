import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { WorksheetList } from "@/components/WorksheetList";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "My worksheets", robots: { index: false, follow: false } };

export default async function WorksheetsPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) redirect("/login?next=%2Fworksheets");
  return <main className="worksheet-library-page shell"><Link className="worksheet-library-back" href="/" aria-label="Back to dashboard">← <span>Back to dashboard</span></Link><header className="worksheet-library-header"><p className="eyebrow">Your work</p><h1>My worksheets</h1><p>Pick up where you left off, or edit a saved question set.</p></header><WorksheetList /></main>;
}
