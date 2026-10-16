"use client";

import Link from "next/link";
import { PAGE_NAVIGATION } from "@/components/PageTransition";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

function current(pathname: string, destination: "papers" | "banks" | "articles" | "pricing" | "account" | "worksheets" | "dashboard" | "login") {
  if (destination === "papers") return pathname === "/past-papers" || pathname.startsWith("/past-papers/");
  // Topic practice lives on the course picker (/dashboard) and the banks it opens.
  if (destination === "banks") return pathname === "/dashboard" || pathname.startsWith("/banks/");
  if (destination === "articles") return pathname === "/articles" || pathname.startsWith("/articles/");
  if (destination === "pricing") return pathname === "/pricing";
  if (destination === "account") return pathname === "/account" || pathname.startsWith("/account/");
  if (destination === "worksheets") return pathname === "/worksheets" || pathname.startsWith("/worksheets/");
  if (destination === "login") return pathname === "/login";
  return pathname === "/dashboard";
}

export function HeaderNavigation({ authenticated, workspaceIcon, menuOpen = false, onNavigate, trailing, pastPapers = false }: { authenticated: boolean; workspaceIcon: ReactNode; menuOpen?: boolean; onNavigate?: () => void; trailing?: ReactNode; pastPapers?: boolean }) {
  const pathname = usePathname();
  return (
    <nav id="site-menu" className="site-menu" data-open={menuOpen ? "true" : "false"} aria-label="Main navigation" onClick={(event) => { if ((event.target as Element).closest("a")) onNavigate?.(); }}>
      {/* Desktop: page links sit in the bar's center column, account actions on the right. The phone menu lists both. */}
      <div className="nav-pages">
        {pastPapers && <Link transitionTypes={PAGE_NAVIGATION} className={current(pathname, "papers") ? "nav-active" : undefined} aria-current={current(pathname, "papers") ? "page" : undefined} href="/past-papers">Full past papers</Link>}
        <Link transitionTypes={PAGE_NAVIGATION} className={current(pathname, "banks") ? "nav-active" : undefined} aria-current={current(pathname, "banks") ? "page" : undefined} href="/dashboard">Practice by topic</Link>
        <Link transitionTypes={PAGE_NAVIGATION} className={current(pathname, "articles") ? "nav-active" : undefined} aria-current={current(pathname, "articles") ? "page" : undefined} href="/articles">Articles</Link>
        <Link transitionTypes={PAGE_NAVIGATION} className={`nav-pricing${current(pathname, "pricing") ? " nav-active" : ""}`} aria-current={current(pathname, "pricing") ? "page" : undefined} href="/pricing">Pricing</Link>
      </div>
      <div className="nav-actions">
        {authenticated && <Link transitionTypes={PAGE_NAVIGATION} className={`nav-worksheets${current(pathname, "worksheets") ? " nav-active" : ""}`} aria-current={current(pathname, "worksheets") ? "page" : undefined} href="/worksheets">My worksheets</Link>}
        <Link transitionTypes={PAGE_NAVIGATION} className={`${authenticated ? "" : "nav-login "}${current(pathname, authenticated ? "account" : "login") ? "nav-active" : ""}`.trim() || undefined} aria-current={current(pathname, authenticated ? "account" : "login") ? "page" : undefined} href={authenticated ? "/account" : "/login?next=/pricing"}>{authenticated ? "My account" : "Log in"}</Link>
        <Link transitionTypes={PAGE_NAVIGATION}
          className={`nav-cta${current(pathname, "dashboard") ? " nav-active" : ""}`}
          aria-current={current(pathname, "dashboard") ? "page" : undefined}
          href="/dashboard"
          title="Open question banks"
        >
          <span className="nav-cta-label">{authenticated ? "Dashboard" : "Start practising"}</span>
          {workspaceIcon}
        </Link>
        {trailing}
      </div>
    </nav>
  );
}
