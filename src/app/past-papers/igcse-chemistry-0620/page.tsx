import type { Metadata } from "next";
import { Young_Serif } from "next/font/google";
import { notFound } from "next/navigation";
import { ChemistryPaperBrowser } from "@/components/ChemistryPaperBrowser";
import { getChemistryPaperSummaries } from "@/lib/chemistry-paper-archive";

const editorial = Young_Serif({ subsets: ["latin"], weight: "400", variable: "--font-paper-editorial" });
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Chemistry 0620 past papers | Local bank preview",
  robots: { index: false, follow: false },
};

export default async function ChemistryPaperDirectory() {
  if (process.env.NODE_ENV !== "development" || process.env.LOCAL_PAPER_PREVIEW !== "true") notFound();
  const papers = await getChemistryPaperSummaries();
  return <div className={editorial.variable}><ChemistryPaperBrowser papers={papers}/></div>;
}
