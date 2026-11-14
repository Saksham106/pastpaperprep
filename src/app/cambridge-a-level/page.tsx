import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { QualificationHub } from "@/components/SearchLanding";
import { getCatalogBanksForDisplay } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "A Level Past Papers by Topic: Maths 9709",
  description: "Cambridge International AS & A Level past-paper questions sorted by topic and paper, with mark schemes.",
  alternates: { canonical: "/cambridge-a-level" },
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
