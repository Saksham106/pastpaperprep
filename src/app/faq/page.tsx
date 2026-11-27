import type { Metadata } from "next";
import { socialPreview } from "@/lib/seo";
import { FaqContent, FAQS } from "@/components/FaqContent";
import { JsonLd } from "@/components/JsonLd";

export const metadata: Metadata = {
  title: "Frequently Asked Questions",
  description: "How PastPaperPrep's free full papers, topical question banks, official mark schemes, worked explanations, account access and PDF worksheets work.",
  alternates: { canonical: "/faq" },
  openGraph: { url: "/faq", type: "website", ...socialPreview() },
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
