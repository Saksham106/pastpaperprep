import type { Metadata } from "next";
import { ArticlesIndex } from "@/components/Articles";

export const metadata: Metadata = {
  title: "Past Paper Practice Guides and Question Bank Comparisons",
  description: "Practical IGCSE and IB Mathematics, Chemistry, Physics, and Biology guides for topical practice, past papers, mark schemes, and question banks.",
  alternates: { canonical: "/articles" },
  openGraph: {
    title: "Past Paper Practice Guides and Question Bank Comparisons | PastPaperPrep",
    description: "Compare question banks and learn how to use topical IGCSE and IB past-paper practice effectively.",
    url: "/articles",
    type: "website",
  },
};

export default function ArticlesPage() {
  return <ArticlesIndex />;
}
