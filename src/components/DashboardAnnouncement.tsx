"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowRight, CalendarCheck, Pause, Play, Sparkle, X } from "@phosphor-icons/react/dist/ssr";
import { CourseIcon, type CourseTone } from "@/components/CourseIcon";
import { PAGE_NAVIGATION } from "@/components/PageTransition";
import { ANNOUNCEMENT_SLIDES, annualAnnouncement, annualOfferFrom, isDismissed, pruneDismissals, rankAnnouncements, type Announcement, type AnnualOffer, type Dismissals } from "@/lib/announcement-pick";
import { PEPPER_OPEN_EVENT, type PepperOpenDetail } from "@/lib/helper/site-config";
import { trackProductEvent } from "@/lib/product-analytics";
import { readRememberedBoard } from "@/lib/remembered-board";
import type { QualificationId } from "@/lib/qualifications";

const DISMISS_KEY = (userId: string) => `ppp-announcements:${userId}`;
const ANNUAL_KEY = (userId: string) => `ppp-annual-offer:${userId}`;
/** The billing read calls Stripe, so a "no offer" answer (annual already, no subscription, a coupon) is kept for a week. */
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

/** Only "no offer" is cached: the savings figures always come from a fresh read of what they pay now. */
type CachedNoOffer = { at: number; offer: null };

/** Whether this subscriber pays monthly, at full price, on a plan that can switch to annual. */
async function loadAnnualOffer(userId: string, signal: AbortSignal): Promise<AnnualOffer | null> {
  // An older entry holding an offer is ignored: only a fresh read may show figures.
  const cached = readJson<{ at?: unknown; offer?: unknown }>(ANNUAL_KEY(userId));
  if (cached && cached.offer === null && typeof cached.at === "number" && Date.now() - cached.at < ANNUAL_CHECK_MS) return null;
  const response = await fetch("/api/billing/subscription", { cache: "no-store", signal });
  // 404: no billing account. Anything else unexpected: try again on a later visit.
  if (!response.ok && response.status !== 404) return null;
  const offer = response.ok ? annualOfferFrom(await response.json()) : null;
  // A cached "yes" could outlive a coupon or a plan change and show savings they no longer get, so only "no" is kept.
  if (offer) { try { window.localStorage.removeItem(ANNUAL_KEY(userId)); } catch { /* private mode */ } }
  else writeJson(ANNUAL_KEY(userId), { at: Date.now(), offer: null } satisfies CachedNoOffer);
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
/** The longest the strip waits for the billing read before showing the cards it already has. */
export const ANNUAL_WAIT_MS = 1500;
/** Scrolling counts as settled on a card after this long without scroll events (smooth scrolls pass through others). */
const SCROLL_SETTLE_MS = 140;

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
  const [waitedForAnnual, setWaitedForAnnual] = useState(false);
  const [shownFrom, setShownFrom] = useState<"start" | "late" | null>(null);
  const viewed = useRef(new Set<string>());
  const track = useRef<HTMLDivElement>(null);
  const settle = useRef<number | undefined>(undefined);
  const refocus = useRef(false);

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

  // The cards that need no billing read. A new bank leads regardless, so it shows at once; otherwise the strip waits
  // briefly for the nudge (it ranks ahead of papers and features), but never longer than ANNUAL_WAIT_MS.
  const withoutOffer = useMemo(() => ready ? rankAnnouncements(candidates, { dismissals, boards: readerBoards }) : [],
  // readerBoards is derived from boards and board.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [ready, candidates, dismissals, boards, board]);
  const holding = wantsAnnual && !annualChecked && !waitedForAnnual && withoutOffer[0]?.tier !== 0;
  useEffect(() => {
    if (!holding) return;
    const timer = window.setTimeout(() => setWaitedForAnnual(true), ANNUAL_WAIT_MS);
    return () => window.clearTimeout(timer);
  }, [holding]);
  // The nudge only while it still applies (a later render can turn the billing check off).
  const offer = wantsAnnual ? annual : null;
  const slides = useMemo(() => {
    if (!ready || holding) return [];
    if (!offer) return withoutOffer;
    // Arriving after the strip was on screen, the nudge joins at the end instead of reordering what the reader sees.
    return shownFrom === "late"
      ? [...withoutOffer.filter((item) => item.id !== offer.id), ...rankAnnouncements([offer], { dismissals })].slice(0, ANNOUNCEMENT_SLIDES)
      : rankAnnouncements([...candidates, offer], { dismissals, boards: readerBoards });
  // readerBoards is derived from boards and board.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, holding, offer, withoutOffer, shownFrom, candidates, dismissals, boards, board]);
  // Remember whether the strip first appeared with the billing answer in or without it.
  useEffect(() => {
    if (shownFrom || !slides.length) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- records the first paint's order once
    setShownFrom(wantsAnnual && !annualChecked ? "late" : "start");
  }, [slides.length, shownFrom, wantsAnnual, annualChecked]);
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
    window.clearTimeout(settle.current);
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

  // After a dismissal, focus goes to the card now on show rather than falling to <body>.
  useEffect(() => {
    if (!refocus.current) return;
    refocus.current = false;
    track.current?.querySelector<HTMLElement>(".dashboard-announcement:not([inert]) .dashboard-announcement-dismiss")?.focus();
  }, [slides, index]);
  useEffect(() => () => window.clearTimeout(settle.current), []);

  if (!active) return emptied ? null : <>{fallback}</>;

  const log = (name: "announcement_click" | "announcement_dismiss", item: Announcement, target?: "primary" | "secondary") =>
    trackProductEvent(name, { updateId: item.id, type: item.kind, bank: item.bank, target, position: slides.indexOf(item) + 1 });
  function dismiss(item: Announcement) {
    const next = { ...dismissals, [item.id]: Date.now() };
    writeJson(DISMISS_KEY(userId), next);
    log("announcement_dismiss", item);
    setAuto(false);
    setDismissals(next);
    // The last card going leaves the slot empty for this visit rather than swapping in another banner;
    // focus moves to the page heading rather than falling to <body>.
    if (slides.length === 1) {
      setEmptied(true);
      const heading = document.querySelector<HTMLElement>("main h1, h1");
      if (heading) { if (!heading.hasAttribute("tabindex")) heading.setAttribute("tabindex", "-1"); heading.focus(); }
    } else {
      refocus.current = true;
      goTo(Math.min(slides.indexOf(item), slides.length - 2));
    }
  }
  // Only the card the scroll settles on counts, not the ones a smooth scroll passes.
  const onScroll = () => {
    window.clearTimeout(settle.current);
    settle.current = window.setTimeout(() => {
      const width = stride();
      if (!width || !track.current) return;
      const at = Math.round(track.current.scrollLeft / width);
      if (at >= 0 && at < slides.length) setIndex(at);
    }, SCROLL_SETTLE_MS);
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
