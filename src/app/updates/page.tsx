import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { getCatalogBanksForDisplay } from "@/lib/catalog";
import { pastPaperLinksEnabled } from "@/lib/past-paper-nav";
import { COMING_SOON, UPDATES, linkResolver } from "@/lib/updates";
import { UpdatesTimeline } from "./UpdatesTimeline";
import styles from "./updates.module.css";

export const metadata: Metadata = {
  title: "What's new",
  description: "New question banks, papers and features on PastPaperPrep, newest first.",
  alternates: { canonical: "/updates" },
  openGraph: { url: "/updates" },
};

export default function UpdatesPage() {
  const resolve = linkResolver({ pastPapers: pastPaperLinksEnabled(), liveBanks: new Set(getCatalogBanksForDisplay().map((bank) => bank.slug)) });
  const updates = UPDATES.map((update) => ({ ...update, links: resolve(update.links) }));

  return (
    <main className={`shell public-editorial ${styles.page}`}>
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "What's new" }]} />
      <header className={styles.header}>
        <p className="eyebrow">Updates</p>
        <h1>What&apos;s new</h1>
      </header>

      <UpdatesTimeline updates={updates} comingSoon={COMING_SOON} />

      <p className={styles.contact}>Something you&apos;d like to see? <a href="mailto:hello@pastpaperprep.com">hello@pastpaperprep.com</a></p>
    </main>
  );
}
