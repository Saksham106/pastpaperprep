"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

function current(pathname: string, destination: "banks" | "pricing" | "account" | "dashboard") {
  if (destination === "banks") return pathname.startsWith("/banks/");
  if (destination === "pricing") return pathname === "/pricing";
  if (destination === "account") return pathname === "/account" || pathname.startsWith("/account/");
  return pathname === "/dashboard";
}

export function HeaderNavigation({ authenticated, workspaceIcon }: { authenticated: boolean; workspaceIcon: ReactNode }) {
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
        {authenticated ? "Dashboard" : "Start practising"}{workspaceIcon}
      </Link>
    </nav>
  );
}
