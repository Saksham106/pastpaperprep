import type { Metadata } from "next";
import { QualificationHub } from "@/components/SearchLanding";
export const metadata: Metadata = {
  title: "Cambridge IGCSE past-paper banks",
  description:
    "Browse Cambridge IGCSE past-paper question banks by subject, then practise exact topics and papers.",
  alternates: { canonical: "/cambridge-igcse" },
};
export default function CambridgeIgcsePage() {
  return (
    <QualificationHub
      qualification="Cambridge IGCSE"
      title="Cambridge IGCSE past-paper practice"
      intro="Browse the active Cambridge IGCSE banks, then move directly into topic and paper practice."
    />
  );
}
