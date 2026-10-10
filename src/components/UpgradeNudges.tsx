"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef } from "react";
import { trackProductEvent } from "@/lib/product-analytics";
import { UPGRADE_PRICE_LABEL, type BankYearFacts, type UpgradePlacement } from "@/lib/upgrade-copy";
import "./upgrade-nudges.css";

const FEED_DISMISSED_KEY = "ppp:feed-nudge-dismissed";
const EVENT_NAMES = { view: "upgrade_prompt_view", click: "upgrade_prompt_click", dismiss: "upgrade_prompt_dismiss" } as const;

export function trackUpgrade(kind: keyof typeof EVENT_NAMES, bank: string, placement: UpgradePlacement) {
  trackProductEvent(EVENT_NAMES[kind], { bank, placement });
}

/** Ref callback that reports one view per mount once half the prompt is on screen. */
export function useUpgradeView(bank: string, placement: UpgradePlacement) {
  const sentRef = useRef(false);
  const observerRef = useRef<IntersectionObserver | null>(null);
  useEffect(() => () => observerRef.current?.disconnect(), []);
  return useCallback((node: Element | null) => {
    observerRef.current?.disconnect();
    observerRef.current = null;
    if (!node || sentRef.current) return;
    const send = () => {
      if (sentRef.current) return;
      sentRef.current = true;
      trackUpgrade("view", bank, placement);
    };
    if (typeof IntersectionObserver === "undefined") { send(); return; }
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting && entry.intersectionRatio >= 0.5)) return;
      send();
      observer.disconnect();
    }, { threshold: 0.5 });
    observer.observe(node);
    observerRef.current = observer;
  }, [bank, placement]);
}

export function readFeedNudgeDismissed(): boolean {
  try { return window.sessionStorage.getItem(FEED_DISMISSED_KEY) === "1"; } catch { return false; }
}

export function writeFeedNudgeDismissed() {
  try { window.sessionStorage.setItem(FEED_DISMISSED_KEY, "1"); } catch { /* private mode: hidden until reload */ }
}

type CardProps = { bank: string; href: string; slot: number; onDismiss: () => void };

function Actions({ bank, placement, href, label, onDismiss }: { bank: string; placement: UpgradePlacement; href: string; label: string; onDismiss: () => void }) {
  return (
    <div className="upgrade-actions">
      <Link className="button primary" href={href} onClick={() => trackUpgrade("click", bank, placement)}>{label}</Link>
      <button className="upgrade-dismiss" type="button" onClick={() => { trackUpgrade("dismiss", bank, placement); onDismiss(); }}>Not now</button>
    </div>
  );
}

export function FeedTimelineCard({ bank, shortName, facts, href, onDismiss }: CardProps & { shortName: string; facts: BankYearFacts }) {
  const viewRef = useUpgradeView(bank, "feed_timeline");
  return (
    <aside ref={viewRef} className="upgrade-card is-timeline" aria-label="Upgrade">
      <p className="upgrade-eyebrow">Missing the latest papers</p>
      <h3>Exams change. Practise the newest papers.</h3>
      <p>{facts.newerPaidLabel} papers, with every mark scheme, are on any plan.</p>
      <ol className="upgrade-years" aria-label="Exam years">
        {facts.coverage.map((year) => <li key={year} className={facts.freeYears.includes(year) ? "is-free" : "is-paid"}>{year}</li>)}
      </ol>
      <Actions bank={bank} placement="feed_timeline" href={href} label={`Unlock ${shortName} · ${UPGRADE_PRICE_LABEL}`} onDismiss={onDismiss} />
    </aside>
  );
}

export type TeaserQuestion = { year: number; session: string; paper: string | number; number: string | number; marks: number | null; primaryTopic: string };

export function FeedTeaserCard({ bank, question, topicLabel, href, onDismiss }: CardProps & { question: TeaserQuestion; topicLabel: string }) {
  const viewRef = useUpgradeView(bank, "feed_teaser");
  return (
    <aside ref={viewRef} className="question-card upgrade-card is-teaser" aria-label="Upgrade">
      <header className="question-card-header">
        <div className="question-meta"><span>{question.year} {question.session}</span>{" "}<span>Paper {question.paper}</span>{" "}<span>Question {question.number}</span>{question.marks !== null && <>{" "}<span>{question.marks} {question.marks === 1 ? "mark" : "marks"}</span></>}</div>
        <span className="upgrade-lock">{question.year} paper</span>
      </header>
      <div className="question-topic"><strong>{topicLabel}</strong></div>
      <div className="upgrade-teaser-body">
        <div className="upgrade-skeleton" aria-hidden="true"><i /><i /><i /><i /><i /></div>
        <div className="upgrade-overlay">
          <strong>This is from the {question.year} paper</strong>
          <p>Practise the newest questions on {topicLabel}, with mark schemes.</p>
          <Actions bank={bank} placement="feed_teaser" href={href} label={`Unlock from ${UPGRADE_PRICE_LABEL}`} onDismiss={onDismiss} />
        </div>
      </div>
    </aside>
  );
}

export function PracticeMilestone({ bank, facts, href, onDismiss }: { bank: string; facts: BankYearFacts | null; href: string; onDismiss: () => void }) {
  const viewRef = useUpgradeView(bank, "practice_milestone");
  return (
    <div ref={viewRef} className="upgrade-milestone" role="status">
      <p><strong>10 practised. Nice.</strong> <span>{facts ? `Keep going with ${facts.newerPaidLabel} papers.` : "Keep going with every year."}</span></p>
      <Link href={href} onClick={() => trackUpgrade("click", bank, "practice_milestone")}>Unlock <span aria-hidden="true">→</span></Link>
      <button type="button" aria-label="Dismiss" onClick={() => { trackUpgrade("dismiss", bank, "practice_milestone"); onDismiss(); }}><span aria-hidden="true">×</span></button>
    </div>
  );
}
