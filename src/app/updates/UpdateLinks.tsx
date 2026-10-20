import Link from "next/link";
import type { UpdateLink } from "@/lib/updates";
import styles from "./updates.module.css";

export function UpdateLinks({ links = [] }: { links?: readonly UpdateLink[] }) {
  if (!links.length) return null;
  return (
    <div className={styles.links}>
      {links.map((link) => "options" in link
        ? <span className={styles.linkGroup} key={link.label}>{link.label}{link.options.map((option) => <Link key={option.href} href={option.href} aria-label={`${link.label} ${option.label}`}>{option.label}</Link>)}</span>
        : <Link key={link.href} href={link.href}>{link.label}</Link>)}
    </div>
  );
}
