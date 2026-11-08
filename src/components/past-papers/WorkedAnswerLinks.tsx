"use client";

import { useEffect, useState, type MouseEvent } from 'react';
import { Check, LinkSimple } from '@phosphor-icons/react';
import { trackProductEvent } from '@/lib/product-analytics';
import styles from './PastPaperPaperPage.module.css';

const WORKED = /^#worked-q(\d+)$/;

/** Opens the worked answer a link points at (`#worked-q2`), on load and when the hash changes. */
export function WorkedAnswerHashOpener() {
  useEffect(() => {
    const open = () => {
      if (!WORKED.test(window.location.hash)) return;
      const target = document.getElementById(window.location.hash.slice(1));
      if (!(target instanceof HTMLDetailsElement)) return;
      target.open = true;
      target.scrollIntoView({ block: 'start' });
    };
    open();
    window.addEventListener('hashchange', open);
    return () => window.removeEventListener('hashchange', open);
  }, []);
  return null;
}

/** Copies a link straight to one worked answer, for sharing in a chat or forum reply. */
export function CopyWorkedAnswerLink({ number, bank, paper }: { number: number; bank: string; paper: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async (event: MouseEvent<HTMLButtonElement>) => {
    // The button sits in the row's <summary>: don't open or close the answer.
    event.preventDefault();
    event.stopPropagation();
    const url = `${window.location.origin}${window.location.pathname}#worked-q${number}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.location.hash = `worked-q${number}`;
    }
    trackProductEvent('worked_answer_link_copy', { bank, paper, question: number });
  };
  return <button type="button" className={styles.copyLink} onClick={copy} aria-label={copied ? `Link to Q${number} copied` : `Copy link to Q${number}'s worked answer`} title={copied ? 'Copied' : 'Copy link to this answer'}>
    {copied ? <Check aria-hidden="true" weight="bold" /> : <LinkSimple aria-hidden="true" weight="bold" />}
  </button>;
}
