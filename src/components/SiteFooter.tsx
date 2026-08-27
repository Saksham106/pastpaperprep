import Link from "next/link";

const BANK_LINKS = [
  ["/banks/igcse", "IGCSE Mathematics 0580"],
  ["/banks/igcse-additional", "IGCSE Additional Mathematics 0606"],
  ["/banks/ib-hl", "IB Mathematics AA HL"],
  ["/banks/ib-sl", "IB Mathematics AA SL"],
  ["/banks/ib-ai-hl", "IB Mathematics AI HL"],
  ["/banks/ib-ai-sl", "IB Mathematics AI SL"],
] as const;

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div>
        <strong>PastPaperPrep</strong>
        <p>Real questions. Focused practice. Better exam decisions.</p>
      </div>
      <nav className="footer-links" aria-label="Footer navigation">
        <div className="footer-bank-links">
          {BANK_LINKS.map(([href, label]) => <Link href={href} key={href}>{label}</Link>)}
        </div>
        <div className="footer-policy-links">
          <Link href="/terms">Terms</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/refund-policy">Refunds</Link>
          <a href="mailto:hello@pastpaperprep.com">Help</a>
        </div>
      </nav>
      <small>Independent practice platform. Exam-board names identify the relevant qualifications.</small>
    </footer>
  );
}
