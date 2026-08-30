import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { MarketingHome } from "@/components/MarketingHome";
import { JsonLd } from "@/components/JsonLd";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: { absolute: "IGCSE & IB Maths Past Papers by Topic | PastPaperPrep" },
  description: "Practise Cambridge IGCSE and IB Mathematics past-paper questions by topic. Filter exact questions, check answers, and build printable sets.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "IGCSE & IB Maths Past Papers by Topic | PastPaperPrep",
    description: "Practise Cambridge IGCSE and IB Mathematics past-paper questions by topic and build focused revision sets.",
    url: "/",
    type: "website",
  },
};

export default async function Home() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (typeof claimsData?.claims?.sub === "string") redirect("/dashboard");
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
