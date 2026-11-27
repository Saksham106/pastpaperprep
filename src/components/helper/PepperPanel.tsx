"use client";

import { ArrowSquareOut, ArrowsInSimple, ArrowsOutSimple, ArrowUp, Camera, Check, DeviceMobile, Lightbulb, PencilSimpleLine, X, type Icon as PhosphorIcon } from "@phosphor-icons/react";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState, type FormEvent, type SetStateAction } from "react";
import { courseToneForBank } from "@/components/CourseIcon";
import { HelperFace } from "@/components/helper/HelperFace";
import { HelperMessage } from "@/components/helper/HelperMessage";
import { creditsLeft, CreditsLine, OutOfCredits } from "@/components/helper/PepperCredits";
import type { PepperLayout } from "@/components/helper/usePepperLayout";
import { forgetSiteChat, PHOTO_SENT, questionThread, recallSiteChat, rememberSiteChat, siteThread, type SiteOpened, type SiteTurn } from "@/components/helper/site-chat-memory";
import { getCatalogBank } from "@/lib/catalog";
import { HelperRequestError, photoToDataUrl } from "@/lib/helper/client";
import { HELPER_CREDIT_COST, helperCreditCost, type HelperCredits } from "@/lib/helper/credits";
import { loadHelperCredits } from "@/lib/helper/credits-client";
import { HELPER_CHIP_PROMPTS, HELPER_CHIPS, HELPER_MAX_TEXT, HELPER_MAX_TURNS, HELPER_NAME, HELPER_PHOTO_NOTE, helperPhonePath, type HelperMode } from "@/lib/helper/config";
import { parseMarkLine } from "@/lib/helper/marking";
import { HELPER_OPENED_NOTE } from "@/lib/helper/pepper-prompt";
import { HELPER_SITE_STARTERS } from "@/lib/helper/site-config";
import { streamPepper } from "@/lib/helper/site-events";
import { helperPageContext, helperPageKind } from "@/lib/helper/site-paths";
import { trackProductEvent } from "@/lib/product-analytics";
import { createClient } from "@/lib/supabase/browser";
import styles from "./helper.module.css";

// One Pepper on every surface. Opened from a question, it has that question (and its mark scheme) attached and offers
// hints, explanations and marking; opened from the floating button, it has none. Either way it can find, open and build.

export type { PepperQuestion } from "@/lib/helper/site-config";
import type { PepperQuestion } from "@/lib/helper/site-config";

const CHIP_ICONS: Readonly<Record<Exclude<HelperMode, "chat">, PhosphorIcon>> = { mark: Camera, hint: Lightbulb, explain: PencilSimpleLine };
const CHIP_HINTS: Readonly<Record<Exclude<HelperMode, "chat">, string>> = {
  mark: "Snap your working, get it marked point by point",
  hint: "A nudge, not the answer",
  explain: "Every mark, step by step",
};

const toneFor = (bank: string) => {
  const catalog = getCatalogBank(bank as never);
  return catalog ? courseToneForBank(catalog) : "math";
};

/** What earlier turns send back: their words, the pages they opened, and a note where a photo was. */
function historyText(turn: SiteTurn): string {
  const notes = (turn.opened ?? []).map((o) => HELPER_OPENED_NOTE(o.label, o.path));
  return [turn.text, turn.photo ? HELPER_PHOTO_NOTE : "", ...notes].filter(Boolean).join("\n");
}

/** Finished steps with a tick, then the current one shimmering. Shown only until the reply starts. */
function Working({ steps, opened, idle }: { steps: string[]; opened: boolean; idle: string }) {
  // Once a page has opened every step is done; until then the latest is still running.
  const done = opened ? steps : steps.slice(0, -1);
  const current = opened ? "Almost done" : steps.at(-1) ?? idle;
  return <div className={styles.working}>
    {done.length > 0 && <ol className={styles.steps} aria-label="Done so far">
      {done.map((step, index) => <li key={index}><Check weight="bold" aria-hidden="true" />{step}</li>)}
    </ol>}
    <p className={styles.thinking}><HelperFace thinking size={26} /><span key={current} className={styles.shimmer}>{current}</span></p>
  </div>;
}

/** "loading" until the session is read; after that, the signed-in account's id or null. */
type Identity = { status: "loading" } | { status: "signed-out" } | { status: "user"; id: string };

export type PepperPanelProps = {
  question?: PepperQuestion;
  /** "sheet" slides in over the page; "page" fills the phone page opened from a question's QR code. */
  variant?: "sheet" | "page";
  onClose?: () => void;
  /** After a reply opened a page (the floating button steps aside on phones). */
  onNavigated?: () => void;
  /** The sheet is sliding out: the run is already cancelled and the sheet is inert; only the visuals linger. */
  closing?: boolean;
  onExited?: () => void;
  /** Where the sheet sits (docked side panel, overlay, phone bottom sheet); the "page" variant ignores it. */
  layout?: PepperLayout;
  /** Full screen on desktop, full height on phones. */
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  /** Full screen from a question: that question's card, shown beside the chat (a copy taken when expanding). */
  beside?: HTMLElement | null;
};

export function PepperPanel({ question, variant = "sheet", onClose, onNavigated, closing = false, onExited, layout = "overlay", expanded = false, onExpandedChange, beside = null }: PepperPanelProps) {
  const thread = question ? questionThread(question.bank, question.questionId) : siteThread;
  const analytics = question ? { surface: "question", bank: question.bank, freePreview: question.freePreview } : { surface: "site" };
  const [identity, setIdentity] = useState<Identity>({ status: "loading" });
  const [turns, setTurnState] = useState<SiteTurn[]>([]);
  const [draft, setDraft] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [credits, setCredits] = useState<HelperCredits | null>(null);
  const [qr, setQr] = useState<{ open: boolean; src?: string }>({ open: false });
  // Bumped when a reply lands, so the face gives a small hop.
  const [hop, setHop] = useState(0);
  // The reply (by turn index) that just earned full marks on a marking request; only it celebrates.
  const [celebrate, setCelebrate] = useState<number | null>(null);
  // What Pepper is doing for the reply in progress (not kept in the chat).
  const [steps, setSteps] = useState<string[]>([]);
  // A page to open by clicking its card, so the site's own navigation guards (unsaved worksheets) apply.
  const pendingOpenRef = useRef<string | null>(null);
  const [openTick, setOpenTick] = useState(0);
  const userRef = useRef<string | null>(null);
  /** Bumped to cancel a reply: events from an older run are ignored. */
  const runRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const busyRef = useRef(false);
  const pendingMode = useRef<HelperMode | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const titleId = useId();

  /** Updates the chat and keeps the in-memory copy owned by the current account. */
  const setTurns = useCallback((update: SetStateAction<SiteTurn[]>) => {
    setTurnState((current) => {
      const next = typeof update === "function" ? update(current) : update;
      if (userRef.current) rememberSiteChat(userRef.current, next, thread);
      return next;
    });
  }, [thread]);

  /** Stops the reply in flight: its request is aborted and any event still on its way is ignored. */
  const stopRun = useCallback(() => {
    runRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    busyRef.current = false;
    pendingOpenRef.current = null;
  }, []);
  const cancelRun = useCallback(() => {
    stopRun();
    setBusy(false);
  }, [stopRun]);

  // Whose chat this is. Nothing renders until the session is known, and a change of account (or signing out) stops any
  // reply in flight and shows only that account's conversation.
  useEffect(() => {
    const supabase = createClient();
    let active = true;
    let resolved = false;
    const apply = (userId: string | null) => {
      if (!active || (resolved && userRef.current === userId)) return;
      resolved = true;
      cancelRun();
      userRef.current = userId;
      if (!userId) forgetSiteChat();
      setTurnState(userId ? recallSiteChat(userId, thread) : []);
      setCredits(null);
      setError("");
      setDraft("");
      setPhoto(null);
      setIdentity(userId ? { status: "user", id: userId } : { status: "signed-out" });
    };
    void supabase.auth.getSession().then(({ data }) => apply(data.session?.user?.id ?? null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => apply(session?.user?.id ?? null));
    return () => {
      active = false;
      subscription.unsubscribe();
      runRef.current += 1;
      abortRef.current?.abort();
    };
  }, [cancelRun, thread]);
  // The balance for the footer, read when the account is known; replies and limits keep it current after that.
  const accountId = identity.status === "user" ? identity.id : null;
  useEffect(() => {
    if (!accountId) return;
    let live = true;
    void loadHelperCredits().then((balance) => {
      // Only fills an empty footer: a reply that landed first carries the newer balance.
      if (live && balance && userRef.current === accountId) setCredits((current) => current ?? balance);
    });
    return () => { live = false; };
  }, [accountId]);
  // Close means close: stop the reply now and ignore anything still on its way, before the exit animation ends.
  useEffect(() => { if (closing) stopRun(); }, [closing, stopRun]);
  useEffect(() => {
    if (closing || variant !== "sheet" || !onClose) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, closing, variant]);
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [turns]);
  // Typing comes first: the message box takes focus on open (not on touch screens, where it would pop the keyboard).
  useEffect(() => {
    if (identity.status === "user" && window.matchMedia?.("(pointer: fine)").matches) inputRef.current?.focus();
  }, [identity.status]);
  useEffect(() => {
    const path = pendingOpenRef.current;
    pendingOpenRef.current = null;
    if (!path) return;
    const card = [...(listRef.current?.querySelectorAll<HTMLAnchorElement>("a[data-helper-open]") ?? [])].find((link) => link.dataset.helperOpen === path);
    // A real click on the card's link: the unsaved-worksheet guard and any other link guard see it like any other link.
    card?.click();
  }, [openTick]);

  const send = async (mode: HelperMode, text: string, image: string | null) => {
    if (busyRef.current || (!text && !image) || identity.status !== "user") return;
    busyRef.current = true;
    const run = ++runRef.current;
    const current = () => runRef.current === run;
    const page = helperPageContext(window.location.pathname, window.location.search);
    const history = turns.filter((turn) => turn.text || turn.opened?.length).slice(-HELPER_MAX_TURNS).map((turn) => ({ role: turn.role, text: historyText(turn) }));
    const replyIndex = turns.length + 1;
    setTurns((existing) => [...existing, { role: "user", text, ...(image ? { photo: image } : {}) }, { role: "assistant", text: "" }]);
    setSteps([]);
    setBusy(true);
    setError("");
    setDraft("");
    setPhoto(null);
    trackProductEvent("helper_send", { ...analytics, mode, photo: Boolean(image), page: helperPageKind(window.location.pathname) });
    const controller = new AbortController();
    abortRef.current = controller;
    let reply = "";
    let rules = false;
    const opened: SiteOpened[] = [];
    const update = () => setTurns((existing) => [...existing.slice(0, -1), { role: "assistant", text: reply, opened: [...opened] }]);
    try {
      const outcome: { failure: { message: string; status: number } | null } = { failure: null };
      await streamPepper({
        messages: [...history.filter((turn) => turn.text), { role: "user", text }],
        page,
        mode,
        ...(question ? { question: { bank: question.bank, questionId: question.questionId } } : {}),
        ...(image ? { image } : {}),
      }, (event) => {
        if (!current()) return;
        if (event.type === "text") { reply += event.text; update(); }
        else if (event.type === "step") setSteps((existing) => [...existing, event.label]);
        else if (event.type === "navigate") {
          // One page per message: anything after the first stays unopened.
          if (opened.length) return;
          opened.push({ path: event.path, label: event.label, kind: event.kind });
          update();
          trackProductEvent("helper_navigate", { ...analytics, kind: event.kind, ...(event.bank ? { bank: event.bank } : {}) });
          pendingOpenRef.current = event.path;
          setOpenTick((tick) => tick + 1);
        } else if (event.type === "done") {
          if (event.credits) setCredits(event.credits);
          rules = Boolean(event.rules);
        } else if (event.type === "error") outcome.failure = { message: event.message, status: event.status };
      }, controller.signal);
      if (!current()) return;
      const { failure } = outcome;
      if (failure && !reply && !opened.length) throw new HelperRequestError(failure.message, failure.status);
      if (failure) setError(failure.message);
      const mark = mode === "mark" ? parseMarkLine(reply) : null;
      if (mark && mark.score >= mark.total) setCelebrate(replyIndex);
      trackProductEvent("helper_result", { ...analytics, mode, opened: opened.length, rules, ...(mark ? { score: mark.score, total: mark.total } : {}) });
      setHop((count) => count + 1);
      if (opened.length) onNavigated?.();
    } catch (caught) {
      if (controller.signal.aborted || !current()) return;
      const status = caught instanceof HelperRequestError ? caught.status : 0;
      // Drop the failed exchange so the next message isn't sent with a half-finished history.
      setTurns((existing) => existing.slice(0, -2));
      setDraft((Object.values(HELPER_CHIP_PROMPTS) as string[]).includes(text) ? "" : text);
      if (image) setPhoto(image);
      setError(caught instanceof HelperRequestError ? caught.message : "The helper couldn't answer. Check your connection and try again.");
      if (status === 429) {
        if (caught instanceof HelperRequestError && caught.credits) setCredits(caught.credits);
        trackProductEvent("helper_limit", analytics);
      }
      else trackProductEvent("helper_error", { ...analytics, mode, code: status });
    } finally {
      if (current()) {
        busyRef.current = false;
        abortRef.current = null;
        setBusy(false);
      }
    }
  };

  const choosePhoto = (mode: HelperMode | null) => {
    pendingMode.current = mode;
    fileRef.current?.click();
  };

  const onPhotoChosen = async (file: File | undefined) => {
    if (fileRef.current) fileRef.current.value = "";
    if (!file) return;
    try {
      const dataUrl = await photoToDataUrl(file);
      const mode = pendingMode.current;
      pendingMode.current = null;
      // The "Mark my photo" tile sends straight away; the camera button attaches the photo to the next message.
      if (mode === "mark") void send("mark", HELPER_CHIP_PROMPTS.mark, dataUrl);
      else { setPhoto(dataUrl); inputRef.current?.focus(); }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "That photo couldn't be read. Try another one.");
    }
  };

  const pickChip = (mode: Exclude<HelperMode, "chat">) => {
    trackProductEvent("helper_chip", { ...analytics, chip: mode });
    if (mode === "mark") {
      if (photo) void send("mark", draft.trim() || HELPER_CHIP_PROMPTS.mark, photo);
      else if (draft.trim()) void send("mark", draft.trim(), null);
      else choosePhoto("mark");
      return;
    }
    void send(mode, HELPER_CHIP_PROMPTS[mode], null);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text && !photo) return;
    void send(photo && !text ? "mark" : "chat", text || HELPER_CHIP_PROMPTS.mark, photo);
  };

  const clearChat = () => {
    cancelRun();
    setTurns([]);
    setError("");
    setCelebrate(null);
    trackProductEvent("helper_clear", analytics);
    inputRef.current?.focus();
  };

  const toggleQr = async () => {
    if (!question) return;
    if (qr.open) { setQr({ open: false, src: qr.src }); return; }
    trackProductEvent("helper_phone_qr", analytics);
    if (qr.src) { setQr({ open: true, src: qr.src }); return; }
    setQr({ open: true });
    try {
      const QRCode = await import("qrcode");
      const src = await QRCode.toDataURL(`${window.location.origin}${helperPhonePath(question.bank, question.questionId)}`, { margin: 1, width: 180 });
      setQr({ open: true, src });
    } catch {
      setQr({ open: false });
      setError("The QR code couldn't be made. Open this page on your phone instead.");
    }
  };

  // Phones: drag the handle up for full height, down to go back to half height (or close from half).
  const dragRef = useRef<number | null>(null);
  const onGrabEnd = (y: number) => {
    const start = dragRef.current;
    dragRef.current = null;
    if (start === null || !onExpandedChange) return;
    const moved = y - start;
    if (moved < -40) onExpandedChange(true);
    else if (moved > 60) { if (expanded) onExpandedChange(false); else onClose?.(); }
  };

  const returnPath = typeof window === "undefined" ? "/" : helperPageContext(window.location.pathname, window.location.search);
  const empty = turns.length === 0;
  const tone = question ? toneFor(question.bank) : null;
  const lastUser = [...turns].reverse().find((turn) => turn.role === "user");

  return (
    <section
      className={[
        styles.panel,
        variant === "page" ? styles.page : styles.sheet,
        variant === "sheet" ? { docked: styles.layoutDocked, overlay: styles.layoutOverlay, phone: styles.layoutPhone }[layout] : "",
        variant === "sheet" && expanded ? styles.expanded : "",
        variant === "sheet" && expanded && beside ? styles.withBeside : "",
        closing ? styles.leaving : "",
      ].filter(Boolean).join(" ")}
      role={variant === "sheet" ? "dialog" : undefined}
      aria-labelledby={titleId}
      inert={closing}
      onAnimationEnd={(event) => { if (closing && event.target === event.currentTarget) onExited?.(); }}
    >
      {variant === "sheet" && expanded && beside && <div className={styles.beside} aria-label="The question" ref={(node) => { if (node && node.firstChild !== beside) node.replaceChildren(beside); }} />}
      <div className={styles.chatCol}>
      {variant === "sheet" && layout === "phone" && onExpandedChange && (
        <div
          className={styles.grab}
          role="button"
          tabIndex={0}
          aria-label={expanded ? "Half height" : "Full height"}
          onPointerDown={(event) => { dragRef.current = event.clientY; }}
          onPointerUp={(event) => onGrabEnd(event.clientY)}
          onClick={() => onExpandedChange(!expanded)}
          onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onExpandedChange(!expanded); } }}
        ><i aria-hidden="true" /></div>
      )}
      <header className={`${styles.header}${tone ? ` course-tone-${tone}` : ""}`} data-subject-tone={tone ?? undefined}>
        <span key={hop} className={`${styles.faceWrap}${hop ? ` ${styles.faceHop}` : ""}`}><HelperFace thinking={busy} /></span>
        <div className={styles.heading}>
          <h2 id={titleId}>{HELPER_NAME}</h2>
          <p>{question ? question.label : "Questions · papers · topics"}</p>
        </div>
        {identity.status === "user" && !empty && <button type="button" className={styles.clear} onClick={clearChat}>Clear chat</button>}
        {variant === "sheet" && onExpandedChange && layout !== "overlay" && (
          <button type="button" className={styles.close} aria-label={expanded ? (layout === "phone" ? "Half height" : "Back to side panel") : (layout === "phone" ? "Full height" : "Full screen")} title={expanded ? "Shrink" : "Expand"} onClick={() => onExpandedChange(!expanded)}>
            {expanded ? <ArrowsInSimple weight="bold" /> : <ArrowsOutSimple weight="bold" />}
          </button>
        )}
        {onClose && <button type="button" className={styles.close} aria-label={`Close ${HELPER_NAME}`} onClick={onClose}><X weight="bold" /></button>}
      </header>

      {identity.status === "signed-out" ? (
        <div className={styles.signin}>
          {question
            ? <><p className={styles.greet}>Stuck on this one? <em>I can help.</em></p><p className={styles.muted}>Hints, full explanations, and marking from a photo of your working. Free with an account.</p></>
            : <><p className={styles.greet}>Tell me what to practise. <em>I&apos;ll take you there.</em></p><p className={styles.muted}>Questions by topic and year, full past papers, practice sets and quick explanations. Free with an account.</p></>}
          <a className="button primary" href={`/login?mode=sign-up&next=${encodeURIComponent(returnPath)}`} onClick={() => trackProductEvent("helper_signin_click", { ...analytics, action: "sign_up" })}>Create free account</a>
          <p className={styles.muted}>Have an account? <a href={`/login?next=${encodeURIComponent(returnPath)}`} onClick={() => trackProductEvent("helper_signin_click", { ...analytics, action: "sign_in" })}>Sign in</a></p>
        </div>
      ) : (
        <>
          <div className={styles.list} ref={listRef} aria-live="polite">
            {identity.status === "user" && empty && (question ? (
              <div className={styles.start}>
                <p className={styles.greet}>I&apos;ve read this question <em>and its mark scheme.</em></p>
                <div className={styles.tiles}>
                  {HELPER_CHIPS.map((chip) => {
                    const Icon = CHIP_ICONS[chip.mode];
                    return <button key={chip.mode} type="button" className={styles.tile} disabled={busy} onClick={() => pickChip(chip.mode)}>
                      <span className={styles.tileIcon}><Icon weight="fill" aria-hidden="true" /></span>
                      <span><b>{chip.label}</b><span>{CHIP_HINTS[chip.mode]}</span></span>
                    </button>;
                  })}
                </div>
                {variant === "sheet" && <button type="button" className={styles.phone} aria-expanded={qr.open} onClick={toggleQr}><DeviceMobile weight="bold" aria-hidden="true" />On a laptop? <span>Use your phone&apos;s camera</span></button>}
                {qr.open && (
                  <div className={styles.qr}>
                    {qr.src ? <Image unoptimized src={qr.src} width={180} height={180} alt="QR code that opens this question on your phone" /> : <span className={styles.muted}>Making QR code…</span>}
                    <p>Scan with your phone, sign in, then take a photo. The marking shows on your phone.</p>
                  </div>
                )}
              </div>
            ) : (
              <div className={styles.start}>
                <p className={styles.greet}>What do you want to practise? <em>I&apos;ll open it.</em></p>
                <div className={styles.starters}>
                  {HELPER_SITE_STARTERS.map((starter) => (
                    <button key={starter.id} type="button" className={styles.starter} onClick={() => {
                      trackProductEvent("helper_chip", { ...analytics, chip: starter.id });
                      setDraft(starter.fill);
                      inputRef.current?.focus();
                    }}>{starter.label}</button>
                  ))}
                </div>
              </div>
            ))}
            {turns.map((turn, index) => turn.role === "user"
              ? <div key={index} className={`${styles.user} ${styles.enter}`}>{turn.photo && (turn.photo === PHOTO_SENT
                ? <span className={styles.photoSent}><Camera weight="bold" aria-hidden="true" />Photo of your working</span>
                : <Image unoptimized width={0} height={0} src={turn.photo} alt="Your working" className={styles.thumb} />)}{turn.text && <p>{turn.text}</p>}</div>
              : <div key={index} className={`${styles.assistant} ${styles.enter}`}>
                {turn.text && <HelperMessage text={turn.text} complete={!(busy && index === turns.length - 1)} celebrate={celebrate === index} />}
                {turn.opened?.map((page) => (
                  <Link key={page.path} className={styles.opened} href={page.path} data-helper-open={page.path}>
                    <ArrowSquareOut weight="bold" aria-hidden="true" />
                    <span><small>{page.kind === "build" ? "Built · check and save" : "Opened"}</small><b>{page.label}</b></span>
                  </Link>
                ))}
                {/* Still working until words arrive: what Pepper has done so far, then what it is doing now. */}
                {busy && index === turns.length - 1 && !turn.text && <Working steps={steps} opened={Boolean(turn.opened?.length)} idle={lastUser?.photo ? "Reading your working" : question ? "Thinking" : "Looking"} />}
              </div>)}
          </div>

          {error && <p className={styles.error} role="alert">{error}</p>}
          {credits && creditsLeft(credits) < (photo ? helperCreditCost(true) : HELPER_CREDIT_COST.message) && <OutOfCredits credits={credits} surface={analytics.surface} />}

          <form className={styles.composer} onSubmit={submit}>
            {photo && (
              <div className={styles.attached}>
                <Image unoptimized width={0} height={0} src={photo} alt="Photo to send" />
                <button type="button" className={styles.removePhoto} aria-label="Remove photo" onClick={() => setPhoto(null)}><X weight="bold" /></button>
              </div>
            )}
            <div className={styles.inputRow}>
              <textarea
                ref={inputRef}
                className={styles.input}
                rows={1}
                maxLength={HELPER_MAX_TEXT}
                placeholder={photo ? "Add a note, or just send" : !empty ? "Ask a follow-up" : question ? "Ask anything about this question" : "e.g. 2023 Paper 2 vectors questions"}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }}
                aria-label={`Message ${HELPER_NAME}`}
                disabled={identity.status !== "user"}
              />
              {question && <button type="button" className={styles.iconButton} aria-label="Attach a photo of your working" disabled={busy || identity.status !== "user"} onClick={() => choosePhoto(null)}><Camera weight="bold" /></button>}
              <button type="submit" className={styles.send} aria-label="Send" disabled={busy || (!draft.trim() && !photo) || identity.status !== "user"}><ArrowUp weight="bold" /></button>
            </div>
            {credits && <CreditsLine credits={credits} cost={photo ? helperCreditCost(true) : undefined} surface={analytics.surface} />}
            <p className={styles.footnote}>{question ? "The mark scheme has the final say." : `${HELPER_NAME} can make mistakes.`}</p>
          </form>
          {question && <input ref={fileRef} type="file" accept="image/*" hidden onChange={(event) => void onPhotoChosen(event.target.files?.[0])} />}
        </>
      )}
      </div>
    </section>
  );
}
