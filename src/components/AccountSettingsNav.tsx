"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const sections = [
  { href: "/account", label: "Overview" },
  { href: "/account/billing", label: "Subscription & billing" },
  { href: "/account/referrals", label: "Referrals" },
  { href: "/account/security", label: "Security" },
] as const;

export function AccountSettingsNav({ activePath }: { activePath?: string } = {}) {
  const actualPath = usePathname();
  const pathname = activePath ?? actualPath;
  return (
    <nav className="account-settings-nav" aria-label="Account settings">
      {sections.map(({ href, label }) => {
        const active = href === "/account/security"
          ? pathname === href || pathname === "/account/password"
          : pathname === href;
        return <Link key={href} href={href} aria-current={active ? "page" : undefined}>{label}</Link>;
      })}
    </nav>
  );
}
