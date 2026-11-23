'use client';

import Link from 'next/link';
import { useState } from 'react';
import { PAGE_NAVIGATION } from '@/components/PageTransition';
import styles from './PastPaperPages.module.css';

/**
 * IGCSE / IB / A Level on the past-paper hubs (no thumb on /past-papers, which is no single board). Each is its own page (for search), so the thumb slides
 * on click, before the next page arrives, and that page renders with the thumb already in place.
 */
export function ScopeSwitch({ scopes, current }: { scopes: readonly { label: string; href: string }[]; current: number }) {
  const [active, setActive] = useState(current);
  return <nav aria-label="Qualification" className={styles.scopes} data-unset={active < 0 ? 'true' : undefined} style={{ '--scope-count': scopes.length, '--scope-index': Math.max(active, 0) } as React.CSSProperties}>
    <span className={styles.scopeThumb} aria-hidden="true" />
    {scopes.map(({ label, href }, index) => <Link key={href} href={href} transitionTypes={PAGE_NAVIGATION} aria-current={index === current ? 'page' : undefined} data-active={index === active ? 'true' : undefined} onClick={() => setActive(index)}>{label}</Link>)}
  </nav>;
}
