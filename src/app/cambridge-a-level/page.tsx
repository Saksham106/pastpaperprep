import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { QualificationHub } from "@/components/SearchLanding";
import { getCatalogBanksForDisplay } from "@/lib/catalog";
import { socialPreview } from "@/lib/seo";

export const metadata: Metadata = {
  // Board-level, so it stays right as subjects are added.
  title: "Cambridge A Level Past Papers by Topic",
  description: "Cambridge International AS & A Level past-paper questions sorted by topic and paper, with mark schemes.",
  alternates: { canonical: "/cambridge-a-level" },
  openGraph: {
    title: "Cambridge A Level Past Papers by Topic | PastPaperPrep",
    description: "Cambridge International AS & A Level past-paper questions sorted by topic and paper, with mark schemes.",
    url: "/cambridge-a-level",
    type: "website",
    ...socialPreview("Cambridge A Level"),
  },
};

export default function CambridgeALevelPage() {
  // Hidden until an A Level bank is displayed.
  if (!getCatalogBanksForDisplay().some((bank) => bank.qualification === "Cambridge A Level")) notFound();
  return (
    <QualificationHub
      qualification="Cambridge A Level"
      title="Cambridge A Level past-paper practice"
      intro="Real Cambridge International AS & A Level past-paper questions sorted by topic and paper, with mark schemes."
    />
  );
}
