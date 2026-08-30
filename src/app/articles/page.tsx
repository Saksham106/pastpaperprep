import type { Metadata } from "next";
import { ArticlesIndex } from "@/components/Articles";

export const metadata: Metadata = {
  title: "Past Paper Revision Guides",
  description: "Practical IGCSE and IB Mathematics revision guides for using topical questions, mark schemes, mixed sets, and timed past papers effectively.",
  alternates: { canonical: "/articles" },
  openGraph: {
    title: "Past Paper Revision Guides | PastPaperPrep",
    description: "Practical methods for turning IGCSE and IB Mathematics past papers into focused revision.",
    url: "/articles",
    type: "website",
  },
};

export default function ArticlesPage() {
  return <ArticlesIndex />;
}
