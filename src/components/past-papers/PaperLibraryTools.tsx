"use client";

import { useState } from 'react';
import type { PaperMatrixData } from '@/lib/past-paper-catalog';
import type { WholePaperSummary } from '@/lib/whole-paper-types';
import { PaperFinder } from './PaperFinder';
import { PaperMatrix, type MatrixTier } from './PaperMatrix';
import styles from './PaperLibraryTools.module.css';

const TIERS: [MatrixTier, string][] = [['all', 'All'], ['core', 'Core'], ['ext', 'Extended']];

/** Search and the Core/Extended toggle sit side by side above the matrix they control. */
export function PaperLibraryTools({ data, papers }: { data: PaperMatrixData; papers: readonly WholePaperSummary[] }) {
  const [tier, setTier] = useState<MatrixTier>('all');
  return <>
    <div className={styles.tools}>
      <PaperFinder mode="papers" papers={papers} />
      {data.tiers && <div className={styles.toggle} role="group" aria-label="Course route">
        {TIERS.map(([value, label]) => <button key={value} type="button" aria-pressed={tier === value} onClick={() => setTier(value)}>{label}</button>)}
      </div>}
    </div>
    <PaperMatrix data={data} tier={tier} />
  </>;
}
