import Link from "next/link";
import { BookOpenText, SquaresFour } from "@phosphor-icons/react/dist/ssr";
import { HeaderNavigation } from "@/components/HeaderNavigation";

export function SiteHeader({ authenticated = false }: { authenticated?: boolean }) {
  const homeHref = authenticated ? "/dashboard" : "/";
  return (
    <header className="site-header">
      <Link className="brand" href={homeHref} aria-label="PastPaperPrep home">
        <span className="brand-mark"><BookOpenText weight="bold" /></span>
        <span>PastPaperPrep</span>
      </Link>
      <div className="header-actions">
        <HeaderNavigation authenticated={authenticated} workspaceIcon={<SquaresFour data-testid="workspace-icon" aria-hidden="true" weight="bold" />} />
      </div>
    </header>
  );
}
