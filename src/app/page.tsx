import type { Metadata } from "next";
import { MarketingHome, type HomePaperLinks } from "@/components/MarketingHome";
import { hubBanks } from "@/lib/past-paper-pages";
import { InviteHandoff } from "@/components/InviteHandoff";
import { JsonLd } from "@/components/JsonLd";
import { SOCIAL_IMAGE } from "@/lib/seo";
import { COMING_SOON, recentNews } from "@/lib/updates";

export const metadata: Metadata = {
  title: { absolute: "Free IGCSE & IB Past Papers by Topic | PastPaperPrep" },
  description: "Free IGCSE & IB past papers and mark schemes. Practise Maths, science and Economics by topic, with worked explanations and printable sets.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Free IGCSE & IB Past Papers by Topic | PastPaperPrep",
    description: "Free IGCSE & IB past papers and mark schemes. Practise Maths, science and Economics by topic, with worked explanations and printable sets.",
    url: "/",
    type: "website",
    images: [SOCIAL_IMAGE],
  },
};

export default async function Home() {
  // Read at build: the page stays static.
  const papers: HomePaperLinks = Object.fromEntries((await hubBanks()).map((bank) => [bank.bankSlug, { href: `/past-papers/${bank.subjectSlug}`, count: bank.paperCount }]));
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
      <MarketingHome papers={papers} news={recentNews(1)} comingSoon={COMING_SOON} />
    </>
  );
}
