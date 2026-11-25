"use client";

import { ArrowSquareOut, ArrowUp, X } from "@phosphor-icons/react";
import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState, type FormEvent, type SetStateAction } from "react";
import { HelperFace } from "@/components/helper/HelperFace";
import { HelperMessage } from "@/components/helper/HelperMessage";
import { forgetSiteChat, recallSiteChat, rememberSiteChat, type SiteOpened, type SiteTurn } from "@/components/helper/site-chat-memory";
import { HelperRequestError } from "@/lib/helper/client";
import { HELPER_MAX_TEXT, HELPER_MAX_TURNS, HELPER_NAME } from "@/lib/helper/config";
import { HELPER_SITE_STARTERS } from "@/lib/helper/site-config";
import { streamSiteHelper } from "@/lib/helper/site-events";
import { helperPageContext, helperPageKind } from "@/lib/helper/site-paths";
import { HELPER_OPENED_NOTE } from "@/lib/helper/site-prompt";
import { trackProductEvent } from "@/lib/product-analytics";
import { createClient } from "@/lib/supabase/browser";
import styles from "./helper.module.css";

/** What earlier replies send back: their words plus the pages they opened, so "open the next year" makes sense. */
function historyText(turn: SiteTurn): string {
  const notes = (turn.opened ?? []).map((o) => HELPER_OPENED_NOTE(o.label, o.path));
  return [turn.text, ...notes].filter(Boolean).join("\n");
}

/** "loading" until the session is read; after that, the signed-in account's id or null. */
type Identity = { status: "loading" } | { status: "signed-out" } | { status: "user"; id: string };

export function SiteHelperPanel({ onClose, onNavigated }: { onClose: () => void; onNavigated: () => void }) {
  const [identity, setIdentity] = useState<Identity>({ status: "loading" });
  const [turns, setTurnState] = useState<SiteTurn[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [remaining, setRemaining] = useState<number | null>(null);
  // A page to open by clicking its card, so the site's own navigation guards (unsaved worksheets) apply.
  const pendingOpenRef = useRef<string | null>(null);
  const [openTick, setOpenTick] = useState(0);
  const userRef = useRef<string | null>(null);
  /** Bumped to cancel a reply: events from an older run are ignored. */
  const runRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const busyRef = useRef(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const titleId = useId();

  /** Updates the chat and keeps the in-memory copy owned by the current account. */
  const setTurns = useCallback((update: SetStateAction<SiteTurn[]>) => {
    setTurnState((current) => {
      const next = typeof update === "function" ? update(current) : update;
      if (userRef.current) rememberSiteChat(userRef.current, next);
      return next;
    });
  }, []);

  const cancelRun = useCallback(() => {
    runRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    busyRef.current = false;
    setBusy(false);
    pendingOpenRef.current = null;
  }, []);

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
      setTurnState(userId ? recallSiteChat(userId) : []);
      setRemaining(null);
      setError("");
      setDraft("");
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
  }, [cancelRun]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [turns]);
  useEffect(() => { if (identity.status === "user") inputRef.current?.focus(); }, [identity.status]);
  useEffect(() => {
    const path = pendingOpenRef.current;
    pendingOpenRef.current = null;
    if (!path) return;
    const card = [...(listRef.current?.querySelectorAll<HTMLAnchorElement>("a[data-helper-open]") ?? [])].find((link) => link.dataset.helperOpen === path);
    // A real click on the card's link: the unsaved-worksheet guard and any other link guard see it like any other link.
    card?.click();
  }, [openTick]);

  const send = async (text: string) => {
    if (busyRef.current || !text || identity.status !== "user") return;
    busyRef.current = true;
    const run = ++runRef.current;
    const current = () => runRef.current === run;
    const page = helperPageContext(window.location.pathname, window.location.search);
    const history = turns.filter((turn) => turn.text || turn.opened?.length).slice(-HELPER_MAX_TURNS).map((turn) => ({ role: turn.role, text: historyText(turn) }));
    setTurns((existing) => [...existing, { role: "user", text }, { role: "assistant", text: "" }]);
    setBusy(true);
    setError("");
    setDraft("");
    trackProductEvent("helper_send", { surface: "site", page: helperPageKind(window.location.pathname) });
    const controller = new AbortController();
    abortRef.current = controller;
    let reply = "";
    let rules = false;
    const opened: SiteOpened[] = [];
    const update = () => setTurns((existing) => [...existing.slice(0, -1), { role: "assistant", text: reply, opened: [...opened] }]);
    try {
      const outcome: { failure: { message: string; status: number } | null } = { failure: null };
      await streamSiteHelper({ messages: [...history.filter((turn) => turn.text), { role: "user", text }], page }, (event) => {
        if (!current()) return;
        if (event.type === "text") { reply += event.text; update(); }
        else if (event.type === "navigate") {
          // One page per message: anything after the first stays unopened.
          if (opened.length) return;
          opened.push({ path: event.path, label: event.label });
          update();
          trackProductEvent("helper_navigate", { surface: "site", kind: event.kind, ...(event.bank ? { bank: event.bank } : {}) });
          pendingOpenRef.current = event.path;
          setOpenTick((tick) => tick + 1);
        } else if (event.type === "done") {
          if (event.remaining !== undefined) setRemaining(event.remaining);
          rules = Boolean(event.rules);
        } else if (event.type === "error") outcome.failure = { message: event.message, status: event.status };
      }, controller.signal);
      if (!current()) return;
      const { failure } = outcome;
      if (failure && !reply && !opened.length) throw new HelperRequestError(failure.message, failure.status);
      if (failure) setError(failure.message);
      trackProductEvent("helper_result", { surface: "site", opened: opened.length, rules });
      if (opened.length) onNavigated();
    } catch (caught) {
      if (controller.signal.aborted || !current()) return;
      const status = caught instanceof HelperRequestError ? caught.status : 0;
      // Drop the failed exchange so the next message isn't sent with a half-finished history.
      setTurns((existing) => existing.slice(0, -2));
      setDraft(text);
      setError(caught instanceof HelperRequestError ? caught.message : "The helper couldn't answer. Check your connection and try again.");
      if (status === 429) { setRemaining(0); trackProductEvent("helper_limit", { surface: "site" }); }
      else trackProductEvent("helper_error", { surface: "site", code: status });
    } finally {
      if (current()) {
        busyRef.current = false;
        abortRef.current = null;
        setBusy(false);
      }
    }
  };

  const clearChat = () => {
    cancelRun();
    setTurns([]);
    setError("");
    trackProductEvent("helper_clear", { surface: "site" });
    inputRef.current?.focus();
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void send(draft.trim());
  };

  const returnPath = typeof window === "undefined" ? "/" : helperPageContext(window.location.pathname, window.location.search);
  const empty = turns.length === 0;

  return (
    <section className={`${styles.panel} ${styles.sheet}`} role="dialog" aria-labelledby={titleId}>
      <header className={styles.header}>
        <span className={styles.faceWrap}><HelperFace thinking={busy} /></span>
        <div className={styles.heading}>
          <h2 id={titleId}>{HELPER_NAME}</h2>
          <p>Questions · papers · topics</p>
        </div>
        {identity.status === "user" && !empty && <button type="button" className={styles.clear} onClick={clearChat}>Clear chat</button>}
        <button type="button" className={styles.close} aria-label={`Close ${HELPER_NAME}`} onClick={onClose}><X weight="bold" /></button>
      </header>

      {identity.status === "signed-out" ? (
        <div className={styles.signin}>
          <p className={styles.greet}>Tell me what to practise. <em>I&apos;ll take you there.</em></p>
          <p className={styles.muted}>Questions by topic and year, full past papers, and quick explanations. Free with an account.</p>
          <a className="button primary" href={`/login?mode=sign-up&next=${encodeURIComponent(returnPath)}`} onClick={() => trackProductEvent("helper_signin_click", { surface: "site", action: "sign_up" })}>Create free account</a>
          <p className={styles.muted}>Have an account? <a href={`/login?next=${encodeURIComponent(returnPath)}`} onClick={() => trackProductEvent("helper_signin_click", { surface: "site", action: "sign_in" })}>Sign in</a></p>
        </div>
      ) : (
        <>
          <div className={styles.list} ref={listRef} aria-live="polite">
            {identity.status === "user" && empty && (
              <div className={styles.start}>
                <p className={styles.greet}>What do you want to practise? <em>I&apos;ll open it.</em></p>
                <div className={styles.starters}>
                  {HELPER_SITE_STARTERS.map((starter) => (
                    <button key={starter.id} type="button" className={styles.starter} onClick={() => {
                      trackProductEvent("helper_chip", { surface: "site", chip: starter.id });
                      setDraft(starter.fill);
                      inputRef.current?.focus();
                    }}>{starter.label}</button>
                  ))}
                </div>
              </div>
            )}
            {turns.map((turn, index) => turn.role === "user"
              ? <div key={index} className={`${styles.user} ${styles.enter}`}><p>{turn.text}</p></div>
              : <div key={index} className={`${styles.assistant} ${styles.enter}`}>
                {turn.text && <HelperMessage text={turn.text} />}
                {turn.opened?.map((page) => (
                  <Link key={page.path} className={styles.opened} href={page.path} data-helper-open={page.path}>
                    <ArrowSquareOut weight="bold" aria-hidden="true" />
                    <span><small>Opened</small><b>{page.label}</b></span>
                  </Link>
                ))}
                {/* Still working until words arrive, even once a page has opened. */}
                {busy && index === turns.length - 1 && !turn.text && <p className={styles.thinking}><HelperFace thinking size={26} />{turn.opened?.length ? "Almost done" : "Looking"}<span className={styles.dots} aria-hidden="true"><i /><i /><i /></span></p>}
              </div>)}
          </div>

          {error && <p className={styles.error} role="alert">{error}</p>}

          <form className={styles.composer} onSubmit={submit}>
            <div className={styles.inputRow}>
              <textarea
                ref={inputRef}
                className={styles.input}
                rows={1}
                maxLength={HELPER_MAX_TEXT}
                placeholder={empty ? "e.g. 2023 Paper 2 vectors questions" : "Ask a follow-up"}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }}
                aria-label={`Message ${HELPER_NAME}`}
                disabled={identity.status !== "user"}
              />
              <button type="submit" className={styles.send} aria-label="Send" disabled={busy || !draft.trim() || identity.status !== "user"}><ArrowUp weight="bold" /></button>
            </div>
            <p className={styles.footnote}>{remaining !== null ? `${remaining} left today` : `${HELPER_NAME} can make mistakes. Check the mark scheme.`}</p>
          </form>
        </>
      )}
    </section>
  );
}
