import Link from "next/link";
import { ArrowRight, BookOpenText } from "@phosphor-icons/react/dist/ssr";

export function SiteHeader({ authenticated = false }: { authenticated?: boolean }) {
  return (
    <header className="site-header">
      <Link className="brand" href="/" aria-label="PastPaperPrep home">
        <span className="brand-mark"><BookOpenText weight="bold" /></span>
        <span>PastPaperPrep</span>
      </Link>
      <nav aria-label="Main navigation">
        <Link href="/#question-banks">Question banks</Link>
        {!authenticated && <Link href="/pricing">Pricing</Link>}
        <Link href={authenticated ? "/account" : "/login?next=/pricing"}>{authenticated ? "My account" : "Log in"}</Link>
        <Link className="nav-cta" href="/banks/igcse">Start practising <ArrowRight weight="bold" /></Link>
      </nav>
    </header>
  );
}
