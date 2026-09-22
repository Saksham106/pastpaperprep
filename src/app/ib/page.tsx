import type { Metadata } from "next";
import { QualificationHub } from "@/components/SearchLanding";
export const metadata: Metadata = {
  title: "IB Diploma past-paper banks",
  description:
    "Browse IB Diploma past-paper question banks by subject and level, then practise focused topics and papers.",
  alternates: { canonical: "/ib" },
};
export default function IbPage() {
  return (
    <QualificationHub
      qualification="IB Diploma"
      title="IB Diploma past-paper practice"
      intro="Browse active IB Diploma banks by subject and level, then move into focused practice."
    />
  );
}
