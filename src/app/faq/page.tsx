import type { Metadata } from "next";
import { FaqContent, FAQS } from "@/components/FaqContent";
import { JsonLd } from "@/components/JsonLd";

export const metadata: Metadata = {
  title: "Frequently Asked Questions",
  description: "How PastPaperPrep's free full papers, topical question banks, official mark schemes, worked explanations, account access and PDF worksheets work.",
  alternates: { canonical: "/faq" },
};

export default function FaqPage() {
  return (
    <>
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: FAQS.map(({ question, answer }) => ({
          "@type": "Question",
          name: question,
          acceptedAnswer: { "@type": "Answer", text: answer },
        })),
      }} />
      <FaqContent />
    </>
  );
}
