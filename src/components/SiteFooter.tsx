import Link from "next/link";
import { BookOpenText } from "@phosphor-icons/react/dist/ssr";
import { getCatalogBanksForDisplay } from "@/lib/catalog";

function FooterGroup({ title, links }: { title: string; links: readonly (readonly [string, string])[] }) {
  return <section className="footer-group"><h2>{title}</h2><div>{links.map(([href, label]) => <Link href={href} key={href}>{label}</Link>)}</div></section>;
}

export function SiteFooter() {
  const banks = getCatalogBanksForDisplay();
  const groups = new Map<string, [string, string][]>();
  for (const bank of banks) {
    const group = bank.qualification === "Cambridge IGCSE" ? "Cambridge" : bank.subject.startsWith("Mathematics") ? "IB Mathematics" : bank.subject;
    const links = groups.get(group) ?? [];
    const label = bank.title.replace(/ Higher Level$/, " HL").replace(/ Standard Level$/, " SL");
    links.push([bank.route, bank.qualification === "Cambridge IGCSE" ? `IGCSE ${label}` : label]);
    groups.set(group, links);
  }
  return (
    <footer className="site-footer">
      <div className="footer-brand"><Link href="/" aria-label="PastPaperPrep home"><BookOpenText weight="bold" /><strong>PastPaperPrep</strong></Link><p>Focused practice for Cambridge IGCSE and IB Diploma question banks.</p></div>
      <nav className="footer-links" aria-label="Footer navigation">
        {[...groups.entries()].map(([title, links]) => <FooterGroup title={title} links={links} key={title} />)}
        <FooterGroup title="Resources" links={[["/cambridge-igcse", "Cambridge IGCSE hub"], ["/ib", "IB Diploma hub"], ["/about", "About PastPaperPrep"], ["/articles", "Revision guides"], ["/faq", "Frequently asked questions"]]} />
      </nav>
      <div className="footer-base"><small>Independent practice platform. Exam-board names identify the relevant qualifications.</small><div className="footer-policy-links"><Link href="/terms">Terms</Link><Link href="/privacy">Privacy</Link><Link href="/refund-policy">Refunds</Link><a href="mailto:hello@pastpaperprep.com">hello@pastpaperprep.com</a></div></div>
    </footer>
  );
}
