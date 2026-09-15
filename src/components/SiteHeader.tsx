"use client";

import Link from "next/link";
import { BookOpenText, SquaresFour } from "@phosphor-icons/react/dist/ssr";
import { useEffect, useRef, useState } from "react";
import { HeaderNavigation } from "@/components/HeaderNavigation";

export function SiteHeader({ authenticated = false }: { authenticated?: boolean }) {
  const homeHref = authenticated ? "/dashboard" : "/";
  const [scrolled, setScrolled] = useState(false);
  const sentinelRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setScrolled(!entry.isIntersecting), { threshold: 0 });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);
  return <>
    <span ref={sentinelRef} className="header-scroll-sentinel" aria-hidden="true" />
    <header className={`site-header${scrolled ? " is-scrolled" : ""}`}>
      <Link className="brand" href={homeHref} aria-label="PastPaperPrep home">
        <span className="brand-mark"><BookOpenText weight="bold" /></span>
        <span>PastPaperPrep</span>
      </Link>
      <div className="header-actions">
        <HeaderNavigation authenticated={authenticated} workspaceIcon={<SquaresFour data-testid="workspace-icon" aria-hidden="true" weight="bold" />} />
      </div>
    </header>
  </>;
}
