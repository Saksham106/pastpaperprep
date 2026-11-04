import type { Metadata } from "next";
import { NotesHome } from "@/components/NotesHome";
import { getCatalogRuntimeBanks } from "@/lib/catalog";

export const metadata: Metadata = {
  title: { absolute: "Free Revision Notes for IGCSE and IB | PastPaperPrep" },
  description: "Free revision notes that follow the syllabus, linked to past-paper practice. IB Maths AA course notes are out now, with more subjects coming soon.",
  alternates: { canonical: "/revision-notes" },
};

export default function RevisionNotesHomePage() {
  return <NotesHome banks={getCatalogRuntimeBanks()} />;
}
