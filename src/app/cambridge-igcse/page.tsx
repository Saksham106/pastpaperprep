import type { Metadata } from "next";
import { QualificationHub } from "@/components/SearchLanding";
export const metadata: Metadata = {
  title: "IGCSE Past Papers by Topic: Maths, Sciences and Economics",
  description:
    "Cambridge IGCSE past-paper questions sorted by topic for Maths 0580, Add Maths 0606, Biology 0610, Chemistry 0620, Physics 0625, 0654 and Economics 0455.",
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
