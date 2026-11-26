"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, CalendarCheck, Sparkle, X } from "@phosphor-icons/react/dist/ssr";
import { CourseIcon, type CourseTone } from "@/components/CourseIcon";
import { PAGE_NAVIGATION } from "@/components/PageTransition";
import { annualAnnouncement, annualOfferFrom, isDismissed, pickAnnouncement, pruneDismissals, type Announcement, type AnnualOffer, type Dismissals } from "@/lib/announcement-pick";
import { PEPPER_OPEN_EVENT, type PepperOpenDetail } from "@/lib/helper/site-config";
import { trackProductEvent } from "@/lib/product-analytics";
import { readRememberedBoard } from "@/lib/remembered-board";
import type { QualificationId } from "@/lib/qualifications";

const DISMISS_KEY = (userId: string) => `ppp-announcements:${userId}`;
const ANNUAL_KEY = (userId: string) => `ppp-annual-offer:${userId}`;
/** The billing read calls Stripe, so a subscriber's monthly/annual state is re-checked at most weekly. */
const ANNUAL_CHECK_MS = 7 * 86_400_000;

function readJson<T>(key: string): T | null {
  try { const value = window.localStorage.getItem(key); return value ? JSON.parse(value) as T : null; } catch { return null; }
}
function writeJson(key: string, value: unknown) {
  try { window.localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode: the card just comes back next visit */ }
}
function readDismissals(userId: string): Dismissals {
  const value = readJson<unknown>(DISMISS_KEY(userId));
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([, at]) => typeof at === "number")) as Dismissals;
}

type CachedOffer = { at: number; offer: AnnualOffer | null };

/** Reads (and caches) whether this subscriber pays monthly on a plan that can switch to annual. */
async function loadAnnualOffer(userId: string, signal: AbortSignal): Promise<AnnualOffer | null> {
  const cached = readJson<CachedOffer>(ANNUAL_KEY(userId));
  if (cached && typeof cached.at === "number" && Date.now() - cached.at < ANNUAL_CHECK_MS) return cached.offer ?? null;
  const response = await fetch("/api/billing/subscription", { cache: "no-store", signal });
  // 404: no billing account. Anything else unexpected: try again on a later visit.
  if (!response.ok && response.status !== 404) return null;
  const offer = response.ok ? annualOfferFrom(await response.json()) : null;
  writeJson(ANNUAL_KEY(userId), { at: Date.now(), offer } satisfies CachedOffer);
  return offer;
}

export type DashboardAnnouncementProps = {
  userId: string;
  candidates: readonly Announcement[];
  /** Boards of the banks the reader owns; empty for free accounts and all-bank plans. */
  boards: readonly QualificationId[];
  /** Has a Stripe subscription that might be monthly. */
  annualCheck: boolean;
  tones?: Readonly<Record<string, CourseTone>>;
};

/** One dismissible "for you" card: a new bank, new papers, a feature, or the annual-plan nudge. */
export function DashboardAnnouncement({ userId, candidates, boards, annualCheck, tones = {} }: DashboardAnnouncementProps) {
  const [ready, setReady] = useState(false);
  const [dismissals, setDismissals] = useState<Dismissals>({});
  const [board, setBoard] = useState<QualificationId | null>(null);
  const [annual, setAnnual] = useState<Announcement | null>(null);
  const [annualChecked, setAnnualChecked] = useState(false);
  const [hidden, setHidden] = useState(false);
  const viewed = useRef(new Set<string>());

  useEffect(() => {
    const stored = pruneDismissals(readDismissals(userId));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-off restore from localStorage after hydration
    setDismissals(stored);
    setBoard(readRememberedBoard());
    setReady(true);
  }, [userId]);

  const readerBoards = boards.length ? boards : board ? [board] : [];
  const fromUpdates = ready ? pickAnnouncement(candidates, { dismissals, boards: readerBoards }) : null;
  // The billing read only runs when the annual card could be the one shown (no new bank waiting).
  const wantsAnnual = ready && annualCheck && !(fromUpdates && fromUpdates.tier < 1) && !isDismissed("annual", dismissals);
  useEffect(() => {
    if (!wantsAnnual) return;
    const controller = new AbortController();
    loadAnnualOffer(userId, controller.signal)
      .then((offer) => { if (!controller.signal.aborted && offer) setAnnual(annualAnnouncement(offer)); })
      .catch(() => {})
      .finally(() => { if (!controller.signal.aborted) setAnnualChecked(true); });
    return () => controller.abort();
  }, [wantsAnnual, userId]);

  // Wait for the billing check, so a lower card never flashes (and counts a view) before the nudge replaces it.
  const chosen = ready && !hidden && (!wantsAnnual || annualChecked) ? pickAnnouncement(annual ? [...candidates, annual] : candidates, { dismissals, boards: readerBoards }) : null;
  useEffect(() => {
    if (!chosen || viewed.current.has(chosen.id)) return;
    viewed.current.add(chosen.id);
    trackProductEvent("announcement_view", { updateId: chosen.id, type: chosen.kind, bank: chosen.bank });
  }, [chosen]);
  if (!chosen) return null;

  const track = (name: "announcement_click" | "announcement_dismiss", target?: "primary" | "secondary") =>
    trackProductEvent(name, { updateId: chosen.id, type: chosen.kind, bank: chosen.bank, target });
  function dismiss() {
    if (!chosen) return;
    const next = { ...dismissals, [chosen.id]: Date.now() };
    writeJson(DISMISS_KEY(userId), next);
    track("announcement_dismiss");
    setDismissals(next);
    // One card per visit: the next one waits for the next dashboard visit.
    setHidden(true);
  }
  const tone = chosen.bank ? tones[chosen.bank] : undefined;
  const icon = tone ? <CourseIcon tone={tone} /> : <span className="course-icon" aria-hidden="true">{chosen.kind === "annual" ? <CalendarCheck weight="bold" /> : <Sparkle weight="fill" />}</span>;
  const cta = chosen.cta;
  return (
    <aside className="dashboard-announcement" data-subject-tone={tone} data-kind={chosen.kind} aria-label="For you">
      {icon}
      <div className="dashboard-announcement-copy">
        <p className="dashboard-announcement-eyebrow">{chosen.eyebrow}</p>
        <strong>{chosen.title}</strong>
        {chosen.body ? <span>{chosen.body}</span> : null}
      </div>
      <div className="dashboard-announcement-actions">
        {"action" in cta
          ? <button type="button" className="button primary" onClick={(event) => { track("announcement_click", "primary"); window.dispatchEvent(new CustomEvent<PepperOpenDetail>(PEPPER_OPEN_EVENT, { detail: { question: null, opener: event.currentTarget } })); }}>{cta.label}</button>
          : <Link transitionTypes={PAGE_NAVIGATION} className="button primary" href={cta.href} onClick={() => track("announcement_click", "primary")}>{cta.label} <ArrowRight weight="bold" aria-hidden="true" /></Link>}
        {chosen.secondary ? <Link transitionTypes={PAGE_NAVIGATION} className="dashboard-announcement-secondary" href={chosen.secondary.href} onClick={() => track("announcement_click", "secondary")}>{chosen.secondary.label}</Link> : null}
      </div>
      <button type="button" className="dashboard-announcement-dismiss" aria-label={`Dismiss: ${chosen.title}`} onClick={dismiss}><X weight="bold" aria-hidden="true" /></button>
    </aside>
  );
}
