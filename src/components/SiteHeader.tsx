"use client";

import Link from "next/link";
import { PAGE_NAVIGATION } from "@/components/PageTransition";
import { BookOpenText, SquaresFour } from "@phosphor-icons/react/dist/ssr";
import { useEffect, useRef, useState } from "react";
import { HeaderNavigation } from "@/components/HeaderNavigation";
import { ThemeToggle } from "@/components/ThemeToggle";

export function SiteHeader({ authenticated = false, pastPapers = false }: { authenticated?: boolean; pastPapers?: boolean }) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const sentinelRef = useRef<HTMLSpanElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const menuToggleRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setScrolled(!entry.isIntersecting), { threshold: 0 });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);
  // Phone menu: Escape or a tap outside the header closes it; choosing a link closes it too.
  useEffect(() => {
    if (!menuOpen) return;
    headerRef.current?.querySelector<HTMLAnchorElement>("#site-menu a")?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setMenuOpen(false); menuToggleRef.current?.focus(); }
    };
    const onPointerDown = (event: PointerEvent) => { if (!headerRef.current?.contains(event.target as Node)) setMenuOpen(false); };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [menuOpen]);
  return <>
    <span ref={sentinelRef} className="header-scroll-sentinel" aria-hidden="true" />
    <header ref={headerRef} className={`site-header${scrolled ? " is-scrolled" : ""}${menuOpen ? " menu-open" : ""}`}>
      <Link transitionTypes={PAGE_NAVIGATION} className="brand" href="/" aria-label="PastPaperPrep home">
        <span className="brand-mark"><BookOpenText weight="bold" /></span>
        <span>PastPaperPrep</span>
      </Link>
      <div className="header-actions">
        <HeaderNavigation authenticated={authenticated} pastPapers={pastPapers} menuOpen={menuOpen} onNavigate={() => setMenuOpen(false)} workspaceIcon={<SquaresFour data-testid="workspace-icon" aria-hidden="true" weight="bold" />} trailing={<ThemeToggle showLabel />} />
        {/* Phones: the bar keeps the one action that matters, opening the question banks. */}
        <Link transitionTypes={PAGE_NAVIGATION} className="nav-quick" href="/dashboard" aria-label="Open question banks" title="Open question banks" onClick={() => setMenuOpen(false)}><SquaresFour aria-hidden="true" weight="bold" /></Link>
        <button ref={menuToggleRef} className="menu-toggle" type="button" aria-expanded={menuOpen} aria-controls="site-menu" aria-label={menuOpen ? "Close menu" : "Open menu"} onClick={() => setMenuOpen((open) => !open)}>
          <span className="menu-toggle-bars" aria-hidden="true"><i /><i /></span>
        </button>
      </div>
    </header>
  </>;
}
