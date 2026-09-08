import Link from "next/link";
import { BookOpenText } from "@phosphor-icons/react/dist/ssr";

const CAMBRIDGE_LINKS = [
  ["/banks/igcse", "IGCSE Mathematics 0580"],
  ["/banks/igcse-additional", "IGCSE Additional Mathematics 0606"],
] as const;

const IB_LINKS = [
  ["/banks/ib-hl", "IB Mathematics AA HL"],
  ["/banks/ib-sl", "IB Mathematics AA SL"],
  ["/banks/ib-ai-hl", "IB Mathematics AI HL"],
  ["/banks/ib-ai-sl", "IB Mathematics AI SL"],
] as const;

const CHEMISTRY_LINKS = [
  ["/banks/ib-chemistry-hl", "IB Chemistry HL"],
  ["/banks/ib-chemistry-sl", "IB Chemistry SL"],
] as const;

const RESOURCE_LINKS = [["/articles", "Revision guides"]] as const;

function FooterGroup({ title, links }: { title: string; links: readonly (readonly [string, string])[] }) {
  return (
    <section className="footer-group">
      <h2>{title}</h2>
      <div>{links.map(([href, label]) => <Link href={href} key={href}>{label}</Link>)}</div>
    </section>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-brand">
        <Link href="/" aria-label="PastPaperPrep home"><BookOpenText weight="bold" /><strong>PastPaperPrep</strong></Link>
        <p>Real questions, focused practice, and printable revision sets for IGCSE, IB Mathematics, and IB Chemistry.</p>
      </div>
      <nav className="footer-links" aria-label="Footer navigation">
        <FooterGroup title="Cambridge" links={CAMBRIDGE_LINKS} />
        <FooterGroup title="IB Mathematics" links={IB_LINKS} />
        <FooterGroup title="IB Chemistry" links={CHEMISTRY_LINKS} />
        <FooterGroup title="Resources" links={RESOURCE_LINKS} />
      </nav>
      <div className="footer-base">
        <small>Independent practice platform. Exam-board names identify the relevant qualifications.</small>
        <div className="footer-policy-links">
          <Link href="/terms">Terms</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/refund-policy">Refunds</Link>
          <a href="mailto:hello@pastpaperprep.com">Help</a>
        </div>
      </div>
    </footer>
  );
}
