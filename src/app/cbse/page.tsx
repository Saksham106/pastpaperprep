import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { QualificationHub } from "@/components/SearchLanding";
import { getCatalogBanksForDisplay } from "@/lib/catalog";
import { socialPreview } from "@/lib/seo";

// CBSE students search for "previous year questions" (PYQs) "chapter-wise", so the hub uses their words.
export const metadata: Metadata = {
  title: "CBSE Previous Year Questions Chapter-wise: Class 10 & 12",
  description: "Real CBSE Class 10 and Class 12 board questions sorted by chapter, with the marking scheme for each.",
  alternates: { canonical: "/cbse" },
  openGraph: {
    title: "CBSE Previous Year Questions Chapter-wise | PastPaperPrep",
    description: "Real CBSE Class 10 and Class 12 board questions sorted by chapter, with the marking scheme for each.",
    url: "/cbse",
    type: "website",
    ...socialPreview("CBSE"),
  },
};

export default function CbsePage() {
  // Hidden (404, so never indexed) until a CBSE bank is displayed.
  if (!getCatalogBanksForDisplay().some((bank) => bank.qualification === "CBSE")) notFound();
  return (
    <QualificationHub
      qualification="CBSE"
      title="CBSE previous year questions by chapter"
      intro="Real CBSE Class 10 and Class 12 board questions sorted by chapter, with the marking scheme for each."
    />
  );
}
