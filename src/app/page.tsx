import type { Metadata } from "next";
import { MarketingHome } from "@/components/MarketingHome";
import { InviteHandoff } from "@/components/InviteHandoff";
import { JsonLd } from "@/components/JsonLd";
import { SOCIAL_IMAGE } from "@/lib/seo";

export const metadata: Metadata = {
  title: { absolute: "IGCSE & IB Past Papers by Topic | PastPaperPrep" },
  description: "Practise real IGCSE and IB Maths, science and Economics questions by topic. Filter past papers, check answers and build printable revision sets.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "IGCSE & IB Past Papers by Topic | PastPaperPrep",
    description: "Practise Cambridge IGCSE, IB Mathematics, IB sciences, and IB Economics past-paper questions by topic and build focused revision sets.",
    url: "/",
    type: "website",
    images: [SOCIAL_IMAGE],
  },
};

export default function Home() {
  return (
    <>
      <InviteHandoff />
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
