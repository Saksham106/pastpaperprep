import type { Metadata } from "next";
import { QualificationHub } from "@/components/SearchLanding";
export const metadata: Metadata = {
  title: "IB Past Papers by Topic: Maths, Sciences and Economics",
  description:
    "IB Diploma past-paper questions sorted by topic for Maths AA and AI, Biology, Chemistry, Physics and Economics at HL and SL.",
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
