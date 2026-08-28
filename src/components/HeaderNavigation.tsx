"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type MouseEvent, type ReactNode } from "react";

function current(pathname: string, destination: "banks" | "pricing" | "account" | "dashboard" | "login", banksHashActive = false) {
  if (destination === "banks") return pathname.startsWith("/banks/") || (pathname === "/" && banksHashActive);
  if (destination === "pricing") return pathname === "/pricing";
  if (destination === "account") return pathname === "/account" || pathname.startsWith("/account/");
  if (destination === "login") return pathname === "/login";
  return pathname === "/dashboard";
}

export function HeaderNavigation({ authenticated, workspaceIcon }: { authenticated: boolean; workspaceIcon: ReactNode }) {
  const pathname = usePathname();
  const banksHref = authenticated ? "/dashboard" : "/#question-banks";
  const [banksHashActive, setBanksHashActive] = useState(false);

  useEffect(() => {
    const syncHash = () => setBanksHashActive(window.location.hash === "#question-banks");
    syncHash();
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, [pathname]);

  function openLandingBanks(event: MouseEvent<HTMLAnchorElement>) {
    if (authenticated || pathname !== "/") return;
    const target = document.getElementById("question-banks");
    if (!target) return;
    event.preventDefault();
    window.history.replaceState(window.history.state, "", "/#question-banks");
    setBanksHashActive(true);
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  }

  return (
    <nav aria-label="Main navigation">
      <Link className={current(pathname, "banks", banksHashActive) ? "nav-active" : undefined} aria-current={current(pathname, "banks", banksHashActive) ? "page" : undefined} href={banksHref} onClick={openLandingBanks}>Question banks</Link>
      <Link className={`nav-pricing${current(pathname, "pricing") ? " nav-active" : ""}`} aria-current={current(pathname, "pricing") ? "page" : undefined} href="/pricing">Pricing</Link>
      <Link className={`${authenticated ? "" : "nav-login "}${current(pathname, authenticated ? "account" : "login") ? "nav-active" : ""}`.trim() || undefined} aria-current={current(pathname, authenticated ? "account" : "login") ? "page" : undefined} href={authenticated ? "/account" : "/login?next=/pricing"}>{authenticated ? "My account" : "Log in"}</Link>
      <Link
        className={`nav-cta${current(pathname, "dashboard") ? " nav-active" : ""}`}
        aria-current={current(pathname, "dashboard") ? "page" : undefined}
        href="/dashboard"
        title="Open question banks"
      >
        <span className="nav-cta-label">{authenticated ? "Dashboard" : "Start practising"}</span>
        {workspaceIcon}
      </Link>
    </nav>
  );
}
