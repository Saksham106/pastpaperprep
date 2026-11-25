"use client";

import { ArrowSquareOut, ArrowUp, X } from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { HelperFace } from "@/components/helper/HelperFace";
import { HelperMessage } from "@/components/helper/HelperMessage";
import { HelperRequestError } from "@/lib/helper/client";
import { HELPER_MAX_TEXT, HELPER_MAX_TURNS, HELPER_NAME } from "@/lib/helper/config";
import { HELPER_SITE_STARTERS, HELPER_SITE_STORAGE_KEY } from "@/lib/helper/site-config";
import { streamSiteHelper, type SiteNavigationEvent } from "@/lib/helper/site-events";
import { helperPageKind, safeHelperPath } from "@/lib/helper/site-paths";
import { HELPER_OPENED_NOTE } from "@/lib/helper/site-prompt";
import { trackProductEvent } from "@/lib/product-analytics";
import { createClient } from "@/lib/supabase/browser";
import styles from "./helper.module.css";

type Opened = Pick<SiteNavigationEvent, "path" | "label">;
type Turn = { role: "user" | "assistant"; text: string; opened?: Opened[] };

function loadTurns(): Turn[] {
  try {
    const value = JSON.parse(sessionStorage.getItem(HELPER_SITE_STORAGE_KEY) ?? "[]") as unknown;
    if (!Array.isArray(value)) return [];
    return value.filter((turn): turn is Turn => Boolean(turn) && (turn.role === "user" || turn.role === "assistant") && typeof turn.text === "string")
      .map((turn) => ({ ...turn, opened: (turn.opened ?? []).filter((o) => safeHelperPath(o?.path) && typeof o.label === "string") }))
      .slice(-HELPER_MAX_TURNS * 2);
  } catch {
    return [];
  }
}

/** What earlier replies send back: their words plus the pages they opened, so "open the next year" makes sense. */
function historyText(turn: Turn): string {
  const notes = (turn.opened ?? []).map((o) => HELPER_OPENED_NOTE(o.label, o.path));
  return [turn.text, ...notes].filter(Boolean).join("\n");
}

const currentPage = () => `${window.location.pathname}${window.location.search}`.slice(0, 600);

export function SiteHelperPanel({ onClose, onNavigated }: { onClose: () => void; onNavigated: () => void }) {
  const router = useRouter();
  const [turns, setTurns] = useState<Turn[]>(loadTurns);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [remaining, setRemaining] = useState<number | null>(null);
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const busyRef = useRef(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const titleId = useId();

  useEffect(() => {
    let active = true;
    void createClient().auth.getSession().then(({ data }) => { if (active) setAuthenticated(Boolean(data.session?.user)); });
    return () => { active = false; abortRef.current?.abort(); };
  }, []);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
    try {
      // Only finished turns: a reply still streaming is saved when it ends.
      if (!busyRef.current) sessionStorage.setItem(HELPER_SITE_STORAGE_KEY, JSON.stringify(turns));
    } catch {
      // Private mode or full storage: the chat still works, it just won't survive a reload.
    }
  }, [turns]);
  useEffect(() => { if (authenticated) inputRef.current?.focus(); }, [authenticated]);

  const send = async (text: string) => {
    if (busyRef.current || !text) return;
    busyRef.current = true;
    const page = currentPage();
    const history = turns.filter((turn) => turn.text || turn.opened?.length).slice(-HELPER_MAX_TURNS).map((turn) => ({ role: turn.role, text: historyText(turn) }));
    setTurns((current) => [...current, { role: "user", text }, { role: "assistant", text: "" }]);
    setBusy(true);
    setError("");
    setDraft("");
    trackProductEvent("helper_send", { surface: "site", page: helperPageKind(window.location.pathname) });
    const controller = new AbortController();
    abortRef.current = controller;
    let reply = "";
    let rules = false;
    const opened: Opened[] = [];
    const update = () => setTurns((current) => [...current.slice(0, -1), { role: "assistant", text: reply, opened: [...opened] }]);
    try {
      const outcome: { failure: { message: string; status: number } | null } = { failure: null };
      await streamSiteHelper({ messages: [...history.filter((turn) => turn.text), { role: "user", text }], page }, (event) => {
        if (event.type === "text") { reply += event.text; update(); }
        else if (event.type === "navigate") {
          opened.push({ path: event.path, label: event.label });
          update();
          trackProductEvent("helper_navigate", { surface: "site", kind: event.kind, ...(event.bank ? { bank: event.bank } : {}) });
          router.push(event.path);
        } else if (event.type === "done") {
          if (event.remaining !== undefined) setRemaining(event.remaining);
          rules = Boolean(event.rules);
        }
        else if (event.type === "error") outcome.failure = { message: event.message, status: event.status };
      }, controller.signal);
      const { failure } = outcome;
      if (failure && !reply && !opened.length) throw new HelperRequestError(failure.message, failure.status);
      if (failure) setError(failure.message);
      trackProductEvent("helper_result", { surface: "site", opened: opened.length, rules });
      if (opened.length) onNavigated();
    } catch (caught) {
      if (controller.signal.aborted) return;
      const status = caught instanceof HelperRequestError ? caught.status : 0;
      // Drop the failed exchange so the next message isn't sent with a half-finished history.
      setTurns((current) => current.slice(0, -2));
      setDraft(text);
      setError(caught instanceof HelperRequestError ? caught.message : "The helper couldn't answer. Check your connection and try again.");
      if (status === 429) { setRemaining(0); trackProductEvent("helper_limit", { surface: "site" }); }
      else trackProductEvent("helper_error", { surface: "site", code: status });
    } finally {
      busyRef.current = false;
      abortRef.current = null;
      setBusy(false);
      // Save the finished exchange now that streaming is over.
      setTurns((current) => [...current]);
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void send(draft.trim());
  };

  const returnPath = typeof window === "undefined" ? "/" : currentPage();
  const empty = turns.length === 0;

  return (
    <section className={`${styles.panel} ${styles.sheet}`} role="dialog" aria-labelledby={titleId}>
      <header className={styles.header}>
        <span className={styles.faceWrap}><HelperFace thinking={busy} /></span>
        <div className={styles.heading}>
          <h2 id={titleId}>{HELPER_NAME}</h2>
          <p>Questions · papers · topics</p>
        </div>
        <button type="button" className={styles.close} aria-label={`Close ${HELPER_NAME}`} onClick={onClose}><X weight="bold" /></button>
      </header>

      {authenticated === false ? (
        <div className={styles.signin}>
          <p className={styles.greet}>Tell me what to practise. <em>I&apos;ll take you there.</em></p>
          <p className={styles.muted}>Questions by topic and year, full past papers, and quick explanations. Free with an account.</p>
          <a className="button primary" href={`/login?mode=sign-up&next=${encodeURIComponent(returnPath)}`} onClick={() => trackProductEvent("helper_signin_click", { surface: "site", action: "sign_up" })}>Create free account</a>
          <p className={styles.muted}>Have an account? <a href={`/login?next=${encodeURIComponent(returnPath)}`} onClick={() => trackProductEvent("helper_signin_click", { surface: "site", action: "sign_in" })}>Sign in</a></p>
        </div>
      ) : (
        <>
          <div className={styles.list} ref={listRef} aria-live="polite">
            {empty && (
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
                {turn.text ? <HelperMessage text={turn.text} /> : !turn.opened?.length && <p className={styles.thinking}><HelperFace thinking size={26} />Looking<span className={styles.dots} aria-hidden="true"><i /><i /><i /></span></p>}
                {turn.opened?.map((page) => (
                  <Link key={page.path} className={styles.opened} href={page.path}>
                    <ArrowSquareOut weight="bold" aria-hidden="true" />
                    <span><small>Opened</small><b>{page.label}</b></span>
                  </Link>
                ))}
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
                disabled={authenticated === null}
              />
              <button type="submit" className={styles.send} aria-label="Send" disabled={busy || !draft.trim()}><ArrowUp weight="bold" /></button>
            </div>
            <p className={styles.footnote}>{remaining !== null ? `${remaining} left today` : `${HELPER_NAME} can make mistakes. Check the mark scheme.`}</p>
          </form>
        </>
      )}
    </section>
  );
}
