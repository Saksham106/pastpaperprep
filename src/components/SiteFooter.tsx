import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div>
        <strong>PastPaperPrep</strong>
        <p>Real questions. Focused practice. Better exam decisions.</p>
      </div>
      <div className="footer-links">
        <Link href="/banks/igcse">IGCSE</Link>
        <Link href="/banks/ib-hl">IB HL</Link>
        <Link href="/banks/ib-sl">IB SL</Link>
        <Link href="/terms">Terms</Link>
        <Link href="/privacy">Privacy</Link>
        <Link href="/refund-policy">Refunds</Link>
      </div>
      <small>Independent practice platform. Exam-board names identify the relevant qualifications.</small>
    </footer>
  );
}
