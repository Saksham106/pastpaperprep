import type { Metadata } from "next";
import { Young_Serif } from "next/font/google";
import { notFound } from "next/navigation";
import { PastPaperReader } from "@/components/PastPaperReader";
import { PaperMarkingWorkspace } from "@/components/PaperMarkingWorkspace";
import styles from "./page.module.css";

const editorial = Young_Serif({ subsets: ["latin"], weight: "400", variable: "--font-paper-editorial" });

export const metadata: Metadata = {
  title: "Chemistry 0620 Paper 42 | Local design preview",
  robots: { index: false, follow: false },
};

export default function PaperDesignPreview() {
  if (process.env.NODE_ENV !== "development" || process.env.LOCAL_PAPER_PREVIEW !== "true") notFound();
  return <div className={editorial.variable}>
    <PastPaperReader />
    <div className={styles.marking}><PaperMarkingWorkspace /></div>
    <aside style={{maxWidth: 1200, margin: "24px auto 40px", padding: "16px 24px", borderTop: "1px solid var(--line)", color: "var(--muted)", fontSize: 12, lineHeight: 1.7}}>
      <strong>Local design review only.</strong> One real Chemistry 0620 paper and its matching mark scheme. Not published or indexed. Archive navigation is illustrative; original-PDF distribution remains subject to rights review. Downloading here is only for this local review, not a released archive feature.
    </aside>
  </div>;
}
