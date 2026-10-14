'use client';

import Link from 'next/link';
import { useState } from 'react';
import { PAGE_NAVIGATION } from '@/components/PageTransition';
import styles from './PastPaperPages.module.css';

/**
 * All / IGCSE / IB on the past-paper hubs. Each is its own page (for search), so the thumb slides
 * on click, before the next page arrives, and that page renders with the thumb already in place.
 */
export function ScopeSwitch({ scopes, current }: { scopes: readonly { label: string; href: string }[]; current: number }) {
  const [active, setActive] = useState(current);
  return <nav aria-label="Qualification" className={styles.scopes} style={{ '--scope-count': scopes.length, '--scope-index': active } as React.CSSProperties}>
    <span className={styles.scopeThumb} aria-hidden="true" />
    {scopes.map(({ label, href }, index) => <Link key={href} href={href} transitionTypes={PAGE_NAVIGATION} aria-current={index === current ? 'page' : undefined} data-active={index === active ? 'true' : undefined} onClick={() => setActive(index)}>{label}</Link>)}
  </nav>;
}
