"use client";

import { IntentPrefetchLink as Link } from '@/components/IntentPrefetchLink';
import { useEffect, useState, type CSSProperties } from 'react';
import { filterMatrixByTier, type MatrixTier, type PaperMatrixData } from '@/lib/past-paper-catalog';
import styles from './PaperMatrix.module.css';

export type { MatrixTier };
const MARKS_PREFIX = 'pastpaperprep:marks:';

/** A key counts as marked when it holds an object with at least one numeric mark. Anything else is ignored. */
function markedKeys(): string[] {
  try {
    return Object.keys(localStorage).filter(key => {
      if (!key.startsWith(MARKS_PREFIX)) return false;
      try {
        const value: unknown = JSON.parse(localStorage.getItem(key) ?? 'null');
        return !!value && typeof value === 'object' && !Array.isArray(value) && Object.values(value).some(mark => typeof mark === 'number');
      } catch { return false; }
    });
  } catch { return []; }
}

export function PaperMatrix({ data: all, tier }: { data: PaperMatrixData; tier: MatrixTier }) {
  const data = filterMatrixByTier(all, tier);
  const [keys, setKeys] = useState<string[]>([]);
  // Marks live on this device only; read them after hydration so server and first client render match.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setKeys(markedKeys()), []);
  const done = (prefix: string) => keys.some(key => key.startsWith(prefix));
  const marked = data.years.flatMap(y => y.rows.flatMap(r => r.cells.flat())).filter(link => done(link.markPrefix)).length;
  return <section className={styles.card} data-tier={tier} data-dense={data.columns.length > 4 || undefined} style={{ '--cols': data.columns.length } as CSSProperties} aria-label="Papers by session">
    <div className={styles.cardTop}>
      {marked > 0 && <p className={styles.progress}><b>{marked}</b> of {data.total} marked</p>}
      <div className={styles.head}>
        <span aria-hidden="true" /><span className={styles.headLabel}>Session</span>
        {data.columns.map((column, i) => <Link key={column.paper} href={column.href} data-col={i} className={styles.column}><span className={styles.headLabel}>{column.label}</span>{column.note && <small>{column.note}</small>}</Link>)}
      </div>
    </div>
    {data.years.map(year => <section key={year.year} className={styles.year} aria-labelledby={`papers-${year.year}`}>
      <h2 id={`papers-${year.year}`} className={styles.yearLabel}><Link href={year.href}>{year.year}</Link></h2>
      <div className={styles.rows}>{year.rows.map(row => <div key={row.key} className={styles.row}>
        <h3 className={styles.session}>{row.label}{row.latest && <span className={styles.new}>New</span>}</h3>
        {row.cells.map((cell, i) => <div key={data.columns[i].paper} className={styles.cell} data-col={i}>{cell.length > 0 && <>
          <span className={styles.cellLabel}>{data.columns[i].label}{data.columns[i].note && ` · ${data.columns[i].note}`}</span>
          <span className={styles.pill}>{cell.map(link => <Link key={link.href} href={link.href} title={link.title} className={styles.paper} data-route={link.route ?? undefined} data-done={done(link.markPrefix) || undefined}>{link.label}</Link>)}</span>
        </>}</div>)}
      </div>)}</div>
    </section>)}
  </section>;
}
