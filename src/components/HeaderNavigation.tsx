"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function current(pathname: string, destination: "banks" | "pricing" | "account" | "dashboard") {
  if (destination === "banks") return pathname.startsWith("/banks/");
  if (destination === "pricing") return pathname === "/pricing";
  if (destination === "account") return pathname === "/account" || pathname.startsWith("/account/");
  return pathname === "/dashboard";
}

export function HeaderNavigation({ authenticated }: { authenticated: boolean }) {
  const pathname = usePathname();
  const banksHref = authenticated ? "/dashboard" : "/#question-banks";

  return (
    <nav aria-label="Main navigation">
      <Link className={current(pathname, "banks") ? "nav-active" : undefined} aria-current={current(pathname, "banks") ? "page" : undefined} href={banksHref}>Question banks</Link>
      <Link className={`nav-pricing${current(pathname, "pricing") ? " nav-active" : ""}`} aria-current={current(pathname, "pricing") ? "page" : undefined} href="/pricing">Pricing</Link>
      <Link className={current(pathname, "account") ? "nav-active" : undefined} aria-current={current(pathname, "account") ? "page" : undefined} href={authenticated ? "/account" : "/login?next=/pricing"}>{authenticated ? "My account" : "Log in"}</Link>
      <Link
        className={`nav-cta${current(pathname, "dashboard") ? " nav-active" : ""}`}
        aria-current={current(pathname, "dashboard") ? "page" : undefined}
        href="/dashboard"
        title="Open question banks"
      >
        {authenticated ? "Dashboard" : "Start practising"}{" "}
        <svg aria-hidden="true" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4.5 5.5h5.25A2.25 2.25 0 0 1 12 7.75V19a2.75 2.75 0 0 0-2.75-2.75H4.5V5.5Z" />
          <path d="M19.5 5.5h-5.25A2.25 2.25 0 0 0 12 7.75V19a2.75 2.75 0 0 1 2.75-2.75h4.75V5.5Z" />
        </svg>
      </Link>
    </nav>
  );
}
