import type { Metadata } from "next";
import { MarketingHome } from "@/components/MarketingHome";
import { JsonLd } from "@/components/JsonLd";
import { SOCIAL_IMAGE } from "@/lib/seo";

export const metadata: Metadata = {
  title: { absolute: "IGCSE, IB Maths, Chemistry, Physics & Biology Past Papers by Topic | PastPaperPrep" },
  description: "Practise Cambridge IGCSE, IB Mathematics, IB Chemistry, IB Physics, and IB Biology past-paper questions by topic. Filter exact questions, check answers, and build printable sets.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "IGCSE, IB Maths, Chemistry, Physics & Biology Past Papers by Topic | PastPaperPrep",
    description: "Practise Cambridge IGCSE, IB Mathematics, IB Chemistry, IB Physics, and IB Biology past-paper questions by topic and build focused revision sets.",
    url: "/",
    type: "website",
    images: [SOCIAL_IMAGE],
  },
};

export default function Home() {
  return (
    <>
      <JsonLd data={{
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "Organization",
            "@id": "https://pastpaperprep.com/#organization",
            name: "PastPaperPrep",
            url: "https://pastpaperprep.com/",
            logo: "https://pastpaperprep.com/icon.svg",
          },
          {
            "@type": "WebSite",
            "@id": "https://pastpaperprep.com/#website",
            url: "https://pastpaperprep.com/",
            name: "PastPaperPrep",
            description: metadata.description,
            publisher: { "@id": "https://pastpaperprep.com/#organization" },
          },
        ],
      }} />
      <MarketingHome />
    </>
  );
}
