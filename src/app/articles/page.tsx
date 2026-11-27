import type { Metadata } from "next";
import { ArticlesIndex } from "@/components/Articles";
import { socialPreview } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Past Paper Guides and Bank Comparisons",
  description: "Practical IGCSE, A Level and IB Mathematics, Biology, Chemistry, Physics and Economics guides for topical practice, past papers, mark schemes and question banks.",
  alternates: { canonical: "/articles" },
  openGraph: {
    title: "Past Paper Guides and Bank Comparisons | PastPaperPrep",
    description: "Compare question banks and learn how to use topical IGCSE, A Level and IB past-paper practice effectively.",
    url: "/articles",
    type: "website",
    ...socialPreview(),
  },
};

export default function ArticlesPage() {
  return <ArticlesIndex />;
}
