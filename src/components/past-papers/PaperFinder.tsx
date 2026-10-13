"use client";

import { useEffect, useId, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MagnifyingGlass } from '@phosphor-icons/react/dist/ssr';
import { matchPapers, paperHref, paperName, parsePaperQuery, shortSession } from '@/lib/past-paper-catalog';
import { trackProductEvent } from '@/lib/product-analytics';
import type { WholePaperSummary } from '@/lib/whole-paper-types';
import styles from './PaperFinder.module.css';

export type FinderSubject = { name: string; code: string; href: string };
type Props = { mode: 'papers'; papers: readonly WholePaperSummary[] } | { mode: 'subjects'; subjects: readonly FinderSubject[] };
type Option = { href: string; label: string; detail?: string };

function papersFor(papers: readonly WholePaperSummary[], q: string): Option[] {
  return matchPapers(papers, parsePaperQuery(q), 6).map(p => ({ href: paperHref(p), label: `${paperName(p)} · ${shortSession(p.session)} ${p.year}` }));
}
function subjectsFor(subjects: readonly FinderSubject[], q: string): Option[] {
  const query = parsePaperQuery(q);
  const text = q.trim().toLowerCase();
  const paperDetails = Object.keys(query).some(key => key !== 'code');
  return subjects.filter(s => s.name.toLowerCase().includes(text) || s.code === query.code).slice(0, 6).map(s =>
    s.code === query.code && paperDetails ? { href: `${s.href}?q=${encodeURIComponent(q.trim())}`, label: s.name, detail: `Find ${q.trim()}` } : { href: s.href, label: s.name });
}

/** Search box for a subject or a paper code. Suggestions are plain links; Enter opens the highlighted one. */
export function PaperFinder(props: Props) {
  const router = useRouter();
  const id = useId();
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const handed = new URLSearchParams(window.location.search).get('q');
    // The hub hands paper codes over in ?q=; read it once after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (handed) { setQ(handed.slice(0, 120)); setOpen(true); }
  }, []);
  const ready = open && q.trim().length >= 2;
  const options = !ready ? [] : props.mode === 'papers' ? papersFor(props.papers, q) : subjectsFor(props.subjects, q);
  const current = Math.min(active, Math.max(options.length - 1, 0));
  const optionId = (i: number) => `${id}-option-${i}`;
  function commit(option: Option | undefined) {
    trackProductEvent('past_paper_search', { found: !!option });
    if (option) router.push(option.href);
  }
  return <div className={styles.finder}>
    <label className={styles.box}>
      <MagnifyingGlass aria-hidden="true" />
      <input
        role="combobox" aria-label="Find a paper" aria-expanded={options.length > 0} aria-controls={`${id}-list`} aria-autocomplete="list"
        aria-activedescendant={options.length ? optionId(current) : undefined}
        type="search" autoComplete="off" spellCheck={false} maxLength={120} value={q}
        placeholder={props.mode === 'papers' ? 'Paper code, e.g. 0580/42/M/J/24' : 'Subject or paper code'}
        onChange={event => { setQ(event.target.value); setActive(0); setOpen(true); }}
        onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}
        onKeyDown={event => {
          if (event.key === 'ArrowDown' && options.length) { event.preventDefault(); setActive((current + 1) % options.length); }
          else if (event.key === 'ArrowUp' && options.length) { event.preventDefault(); setActive((current - 1 + options.length) % options.length); }
          else if (event.key === 'Enter' && ready) { event.preventDefault(); commit(options[current]); }
          else if (event.key === 'Escape') { setQ(''); setActive(0); setOpen(false); }
        }}
      />
    </label>
    <div className={styles.popover} hidden={!ready}>
      <div role="listbox" id={`${id}-list`} aria-label="Matching papers">
        {options.map((option, i) => <a key={option.href} id={optionId(i)} role="option" aria-selected={i === current} href={option.href} className={styles.option} onMouseEnter={() => setActive(i)} onMouseDown={event => event.preventDefault()} onClick={event => { event.preventDefault(); commit(option); }}>
          <span>{option.label}</span>{option.detail && <small>{option.detail}</small>}
        </a>)}
      </div>
      {ready && !options.length && <p className={styles.empty}>{props.mode === 'papers' ? 'No paper matches. Try 0580/42/M/J/24.' : 'No match. Try a subject or 0580/42/M/J/24.'}</p>}
    </div>
  </div>;
}
