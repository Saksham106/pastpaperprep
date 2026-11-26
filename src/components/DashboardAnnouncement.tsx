"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowRight, CalendarCheck, Pause, Play, Sparkle, X } from "@phosphor-icons/react/dist/ssr";
import { CourseIcon, type CourseTone } from "@/components/CourseIcon";
import { PAGE_NAVIGATION } from "@/components/PageTransition";
import { annualAnnouncement, annualOfferFrom, isDismissed, pruneDismissals, rankAnnouncements, type Announcement, type AnnualOffer, type Dismissals } from "@/lib/announcement-pick";
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
  /** Shown when there is no card (the free plan card), so the dashboard never stacks two banners. */
  fallback?: ReactNode;
};

/** How long each card stays before the strip slides on by itself. */
export const SLIDE_MS = 6000;

function prefersReducedMotion() {
  try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; }
}

/**
 * Up to three dismissible "for you" cards (new banks, the annual-plan nudge, new papers, features) in one sliding strip.
 * It moves on by itself once round, unless the reader swipes, points at it, focuses it, pauses it or prefers reduced motion.
 */
export function DashboardAnnouncement({ userId, candidates, boards, annualCheck, tones = {}, fallback = null }: DashboardAnnouncementProps) {
  const [ready, setReady] = useState(false);
  const [dismissals, setDismissals] = useState<Dismissals>({});
  const [board, setBoard] = useState<QualificationId | null>(null);
  const [annual, setAnnual] = useState<Announcement | null>(null);
  const [annualChecked, setAnnualChecked] = useState(false);
  const [index, setIndex] = useState(0);
  // Auto-slide: on until the reader takes over, pauses or it has gone round once.
  const [auto, setAuto] = useState(true);
  const [held, setHeld] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [emptied, setEmptied] = useState(false);
  const viewed = useRef(new Set<string>());
  const track = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stored = pruneDismissals(readDismissals(userId));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-off restore from localStorage after hydration
    setDismissals(stored);
    setBoard(readRememberedBoard());
    setReducedMotion(prefersReducedMotion());
    setReady(true);
  }, [userId]);

  const readerBoards = boards.length ? boards : board ? [board] : [];
  const wantsAnnual = ready && annualCheck && !isDismissed("annual", dismissals);
  useEffect(() => {
    if (!wantsAnnual) return;
    const controller = new AbortController();
    loadAnnualOffer(userId, controller.signal)
      .then((offer) => { if (!controller.signal.aborted && offer) setAnnual(annualAnnouncement(offer)); })
      .catch(() => {})
      .finally(() => { if (!controller.signal.aborted) setAnnualChecked(true); });
    return () => controller.abort();
  }, [wantsAnnual, userId]);

  // Wait for the billing check, so the strip never reorders (and counts views) when the nudge arrives.
  const slides = useMemo(() => ready && (!wantsAnnual || annualChecked)
    ? rankAnnouncements(annual ? [...candidates, annual] : candidates, { dismissals, boards: readerBoards })
    : [],
  // readerBoards is derived from boards and board.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [ready, wantsAnnual, annualChecked, annual, candidates, dismissals, boards, board]);
  const active = slides[Math.min(index, slides.length - 1)];

  useEffect(() => {
    if (!active || viewed.current.has(active.id)) return;
    viewed.current.add(active.id);
    trackProductEvent("announcement_view", { updateId: active.id, type: active.kind, bank: active.bank, position: slides.indexOf(active) + 1 });
  }, [active, slides]);

  const stride = () => {
    const children = track.current?.children;
    return children && children.length > 1 ? (children[1] as HTMLElement).offsetLeft - (children[0] as HTMLElement).offsetLeft : track.current?.clientWidth ?? 0;
  };
  const goTo = (next: number) => {
    setIndex(next);
    const width = stride();
    if (width) track.current?.scrollTo?.({ left: next * width, behavior: reducedMotion ? "auto" : "smooth" });
  };
  const takeOver = () => setAuto(false);

  useEffect(() => {
    if (!auto || held || reducedMotion || slides.length < 2) return;
    const timer = window.setTimeout(() => {
      const next = (index + 1) % slides.length;
      goTo(next);
      // Once round: back on the first card, it stays.
      if (next === 0) setAuto(false);
    }, SLIDE_MS);
    return () => window.clearTimeout(timer);
  // goTo only reads refs and reducedMotion.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, held, reducedMotion, slides.length, index]);

  if (!active) return emptied ? null : <>{fallback}</>;

  const log = (name: "announcement_click" | "announcement_dismiss", item: Announcement, target?: "primary" | "secondary") =>
    trackProductEvent(name, { updateId: item.id, type: item.kind, bank: item.bank, target, position: slides.indexOf(item) + 1 });
  function dismiss(item: Announcement) {
    const next = { ...dismissals, [item.id]: Date.now() };
    writeJson(DISMISS_KEY(userId), next);
    log("announcement_dismiss", item);
    setAuto(false);
    setDismissals(next);
    // The last card going leaves the slot empty for this visit rather than swapping in another banner.
    if (slides.length === 1) setEmptied(true);
    else goTo(Math.min(slides.indexOf(item), slides.length - 2));
  }
  const onScroll = () => {
    const width = stride();
    if (!width || !track.current) return;
    const at = Math.round(track.current.scrollLeft / width);
    if (at !== index && at >= 0 && at < slides.length) setIndex(at);
  };

  return (
    <aside className="dashboard-announcements" aria-label="For you" aria-roledescription={slides.length > 1 ? "carousel" : undefined}
      onMouseEnter={() => setHeld(true)} onMouseLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setHeld(false); }}>
      <div ref={track} className="dashboard-announcements-track" onScroll={onScroll} onPointerDown={takeOver} onWheel={takeOver} onTouchStart={takeOver}>
        {slides.map((item, at) => {
          const tone = item.bank ? tones[item.bank] : undefined;
          const icon = tone ? <CourseIcon tone={tone} /> : <span className="course-icon" aria-hidden="true">{item.kind === "annual" ? <CalendarCheck weight="bold" /> : <Sparkle weight="fill" />}</span>;
          const cta = item.cta;
          const offscreen = at !== index;
          return (
            <div key={item.id} className="dashboard-announcement" data-subject-tone={tone} data-kind={item.kind}
              role={slides.length > 1 ? "group" : undefined} aria-roledescription={slides.length > 1 ? "slide" : undefined} aria-label={slides.length > 1 ? `${at + 1} of ${slides.length}` : undefined}
              aria-hidden={offscreen || undefined} inert={offscreen || undefined}>
              {icon}
              <div className="dashboard-announcement-copy">
                <p className="dashboard-announcement-eyebrow">{item.eyebrow}</p>
                <strong>{item.title}</strong>
                {item.body ? <span>{item.body}</span> : null}
              </div>
              <div className="dashboard-announcement-actions">
                {"action" in cta
                  ? <button type="button" className="button primary" onClick={(event) => { log("announcement_click", item, "primary"); window.dispatchEvent(new CustomEvent<PepperOpenDetail>(PEPPER_OPEN_EVENT, { detail: { question: null, opener: event.currentTarget } })); }}>{cta.label}</button>
                  : <Link transitionTypes={PAGE_NAVIGATION} className="button primary" href={cta.href} onClick={() => log("announcement_click", item, "primary")}>{cta.label} <ArrowRight weight="bold" aria-hidden="true" /></Link>}
                {item.secondary ? <Link transitionTypes={PAGE_NAVIGATION} className="dashboard-announcement-secondary" href={item.secondary.href} onClick={() => log("announcement_click", item, "secondary")}>{item.secondary.label}</Link> : null}
              </div>
              <button type="button" className="dashboard-announcement-dismiss" aria-label={`Dismiss: ${item.title}`} onClick={() => dismiss(item)}><X weight="bold" aria-hidden="true" /></button>
            </div>
          );
        })}
      </div>
      {slides.length > 1 ? (
        <div className="dashboard-announcements-nav">
          {slides.map((item, at) => <button key={item.id} type="button" className="dashboard-announcements-dot" aria-label={`Show update ${at + 1} of ${slides.length}`} aria-current={at === index || undefined} onClick={() => { takeOver(); goTo(at); }} />)}
          {!reducedMotion ? <button type="button" className="dashboard-announcements-pause" aria-label={auto ? "Pause updates" : "Play updates"} onClick={() => setAuto((on) => !on)}>{auto ? <Pause weight="fill" aria-hidden="true" /> : <Play weight="fill" aria-hidden="true" />}</button> : null}
        </div>
      ) : null}
    </aside>
  );
}
