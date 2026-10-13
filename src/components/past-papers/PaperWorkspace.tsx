"use client";

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { CheckSquare } from '@phosphor-icons/react/dist/ssr';
import { PastPaperReader, type PaperDocumentKind } from '@/components/PastPaperReader';
import { PaperMarkingWorkspace, type PaperMarkingPaper } from '@/components/PaperMarkingWorkspace';
import type { PaperReaderConfig } from '@/lib/paper-reader-config';
import { trackProductEvent } from '@/lib/product-analytics';
import styles from './PaperWorkspace.module.css';

/** Paper page client shell: the reader, a rail (server-rendered children) and marking, which replaces the rail. */
export function PaperWorkspace({ reader, marking, bank, practice = true, children }: { reader: PaperReaderConfig; marking: PaperMarkingPaper | null; bank: string; practice?: boolean; children: ReactNode }) {
  const [kind, setKind] = useState<PaperDocumentKind>('question');
  const [markingOpen, setMarkingOpen] = useState(false);
  const markButton = useRef<HTMLButtonElement>(null);
  const main = useRef<HTMLDivElement>(null);
  const reopened = useRef(false);
  useEffect(() => { trackProductEvent('past_paper_open', { bank, paper: reader.id }); }, [bank, reader.id]);
  useEffect(() => {
    if (!markingOpen && reopened.current) markButton.current?.focus();
  }, [markingOpen]);
  function openMarking() {
    setMarkingOpen(true); setKind('markscheme'); reopened.current = true;
    // On phones the sheet covers the lower screen, so bring the mark scheme to the top above it.
    if (window.matchMedia?.('(max-width: 760px)').matches) main.current?.scrollIntoView?.({ block: 'start' });
    trackProductEvent('past_paper_mark_open', { bank });
  }
  return <div className={styles.workspace} data-marking={markingOpen || undefined}>
    <div ref={main} className={styles.main}><PastPaperReader paper={reader} kind={kind} onKindChange={setKind} analyticsBank={bank} /></div>
    <aside className={styles.rail} aria-label={markingOpen ? 'Marking' : 'About this paper'}>
      {markingOpen && marking ? <div className={styles.markPanel}><PaperMarkingWorkspace paper={marking} practice={practice} onClose={() => setMarkingOpen(false)} /></div> : <>
        {marking ? <section className={styles.finished}>
          <h2>Finished?</h2>
          <p>Mark it with the scheme and see which topics cost you marks.</p>
          <button ref={markButton} type="button" className={styles.markButton} onClick={openMarking}><CheckSquare aria-hidden="true" weight="bold" />Mark this paper</button>
        </section> : <p className={styles.held}>Self-marking isn&apos;t available for this paper yet.</p>}
        {children}
      </>}
    </aside>
    <nav className={styles.dock} aria-label="Paper shortcuts">
      <div className={styles.dockSwitch}>{(['question', 'markscheme'] as const).map(type => <button key={type} type="button" aria-pressed={kind === type} onClick={() => setKind(type)}>{type === 'question' ? 'Paper' : 'Scheme'}</button>)}</div>
      {marking && !markingOpen && <button type="button" className={styles.dockMark} onClick={openMarking}><CheckSquare aria-hidden="true" weight="bold" />Mark it</button>}
    </nav>
  </div>;
}
