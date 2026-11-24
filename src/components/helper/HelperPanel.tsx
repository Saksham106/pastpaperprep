"use client";

import { Camera, DeviceMobile, PaperPlaneRight, Sparkle, X } from "@phosphor-icons/react";
import Image from "next/image";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { HelperMessage } from "@/components/helper/HelperMessage";
import { HELPER_CHIP_PROMPTS, HELPER_PHOTO_NOTE, HELPER_CHIPS, HELPER_MAX_TEXT, HELPER_MAX_TURNS, HELPER_NAME, helperPhonePath, type HelperMode } from "@/lib/helper/config";
import { HelperRequestError, photoToDataUrl, streamHelperReply } from "@/lib/helper/client";
import { parseMarkLine } from "@/lib/helper/marking";
import { trackProductEvent } from "@/lib/product-analytics";
import styles from "./helper.module.css";

type Turn = { role: "user" | "assistant"; text: string; photo?: string };

export type HelperPanelProps = {
  bank: string;
  questionId: string;
  questionLabel: string;
  authenticated: boolean;
  freePreview: boolean;
  /** "sheet" slides in beside the question; "page" fills the phone page opened from the QR code. */
  variant?: "sheet" | "page";
  onClose?: () => void;
};

export function HelperPanel({ bank, questionId, questionLabel, authenticated, freePreview, variant = "sheet", onClose }: HelperPanelProps) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [remaining, setRemaining] = useState<number | null>(null);
  const [qr, setQr] = useState<{ open: boolean; src?: string }>({ open: false });
  const fileRef = useRef<HTMLInputElement>(null);
  const pendingMode = useRef<HelperMode | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const titleId = useId();
  const busyRef = useRef(false);

  useEffect(() => () => abortRef.current?.abort(), []);
  useEffect(() => {
    if (variant !== "sheet") return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [variant, onClose]);
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [turns]);

  const send = async (mode: HelperMode, text: string, image: string | null) => {
    if (busyRef.current) return;
    busyRef.current = true;
    // Photos go only with their own message; later turns say one was there, so the model trusts its earlier reading.
    const history = turns.filter((turn) => turn.text).slice(-HELPER_MAX_TURNS).map(({ role, text: turnText, photo: hadPhoto }) => ({ role, text: hadPhoto ? `${turnText}\n${HELPER_PHOTO_NOTE}` : turnText }));
    const userTurn: Turn = { role: "user", text, ...(image ? { photo: image } : {}) };
    setTurns((current) => [...current, userTurn, { role: "assistant", text: "" }]);
    setBusy(true);
    setError("");
    setDraft("");
    setPhoto(null);
    trackProductEvent("helper_send", { bank, mode, photo: Boolean(image), freePreview });
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      let reply = "";
      const result = await streamHelperReply({
        bank, questionId, mode,
        messages: [...history, { role: "user", text }],
        ...(image ? { image } : {}),
      }, (partial) => {
        reply = partial;
        setTurns((current) => [...current.slice(0, -1), { role: "assistant", text: partial }]);
      }, controller.signal);
      if (result.remaining !== null && Number.isFinite(result.remaining)) setRemaining(result.remaining);
      const mark = mode === "mark" ? parseMarkLine(reply) : null;
      trackProductEvent("helper_result", { bank, mode, freePreview, ...(mark ? { score: mark.score, total: mark.total } : {}) });
    } catch (caught) {
      if (controller.signal.aborted) return;
      const status = caught instanceof HelperRequestError ? caught.status : 0;
      // Drop the failed exchange so the next message isn't sent with a half-finished history.
      setTurns((current) => current.slice(0, -2));
      setDraft(text === HELPER_CHIP_PROMPTS.mark || text === HELPER_CHIP_PROMPTS.hint || text === HELPER_CHIP_PROMPTS.explain ? "" : text);
      if (image) setPhoto(image);
      setError(caught instanceof HelperRequestError ? caught.message : "The helper couldn't answer. Check your connection and try again.");
      if (status === 429) {
        setRemaining(0);
        trackProductEvent("helper_limit", { bank, freePreview });
      } else {
        trackProductEvent("helper_error", { bank, mode, code: status, freePreview });
      }
    } finally {
      busyRef.current = false;
      abortRef.current = null;
      setBusy(false);
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
      // The "Mark my photo" chip sends straight away; the camera button attaches the photo to the next message.
      if (mode === "mark") void send("mark", HELPER_CHIP_PROMPTS.mark, dataUrl);
      else { setPhoto(dataUrl); inputRef.current?.focus(); }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "That photo couldn't be read. Try another one.");
    }
  };

  const pickChip = (mode: Exclude<HelperMode, "chat">) => {
    trackProductEvent("helper_chip", { bank, chip: mode, freePreview });
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

  const toggleQr = async () => {
    if (qr.open) { setQr({ open: false, src: qr.src }); return; }
    trackProductEvent("helper_phone_qr", { bank, freePreview });
    if (qr.src) { setQr({ open: true, src: qr.src }); return; }
    setQr({ open: true });
    try {
      const QRCode = await import("qrcode");
      const src = await QRCode.toDataURL(`${window.location.origin}${helperPhonePath(bank, questionId)}`, { margin: 1, width: 180 });
      setQr({ open: true, src });
    } catch {
      setQr({ open: false });
      setError("The QR code couldn't be made. Open this page on your phone instead.");
    }
  };

  const returnPath = typeof window === "undefined" ? "/" : `${window.location.pathname}${window.location.search}`;
  const empty = turns.length === 0;

  return (
    <section className={`${styles.panel} ${variant === "page" ? styles.page : styles.sheet}`} role={variant === "sheet" ? "dialog" : undefined} aria-labelledby={titleId}>
      <header className={styles.header}>
        <span className={styles.avatar} aria-hidden="true"><Sparkle weight="fill" /></span>
        <div className={styles.heading}>
          <h2 id={titleId}>{HELPER_NAME}</h2>
          <p>{questionLabel}</p>
        </div>
        {onClose && <button type="button" className={styles.close} aria-label={`Close ${HELPER_NAME}`} onClick={onClose}><X weight="bold" /></button>}
      </header>

      {!authenticated ? (
        <div className={styles.signin}>
          <p>Sign in to ask {HELPER_NAME} about this question: hints, full explanations, and marking from a photo of your working.</p>
          <a className="button primary" href={`/login?mode=sign-up&next=${encodeURIComponent(returnPath)}`} onClick={() => trackProductEvent("helper_signin_click", { bank, action: "sign_up" })}>Create free account</a>
          <p className={styles.muted}>Have an account? <a href={`/login?next=${encodeURIComponent(returnPath)}`} onClick={() => trackProductEvent("helper_signin_click", { bank, action: "sign_in" })}>Sign in</a></p>
        </div>
      ) : (
        <>
          <div className={styles.list} ref={listRef} aria-live="polite">
            {empty && (
              <div className={styles.intro}>
                <p>Hi! I&apos;ve read this question and its official mark scheme. What would help?</p>
              </div>
            )}
            {turns.map((turn, index) => turn.role === "user"
              ? <div key={index} className={styles.user}>{turn.photo && <Image unoptimized width={0} height={0} src={turn.photo} alt="Your working" className={styles.thumb} />}{turn.text && <p>{turn.text}</p>}</div>
              : <div key={index} className={styles.assistant}>{turn.text ? <HelperMessage text={turn.text} /> : <p className={styles.thinking}>{HELPER_NAME} is thinking…</p>}</div>)}
          </div>

          <div className={styles.chips}>
            {HELPER_CHIPS.map((chip) => <button key={chip.mode} type="button" className={`${styles.chip} ${chip.mode === "mark" ? styles.chipPrimary : ""}`} disabled={busy} onClick={() => pickChip(chip.mode)}>{chip.mode === "mark" && <Camera weight="bold" aria-hidden="true" />}{chip.label}</button>)}
            {variant === "sheet" && <button type="button" className={styles.phone} aria-expanded={qr.open} onClick={toggleQr}><DeviceMobile weight="bold" aria-hidden="true" />Use your phone&apos;s camera</button>}
          </div>
          {qr.open && (
            <div className={styles.qr}>
              {qr.src ? <Image unoptimized src={qr.src} width={180} height={180} alt="QR code that opens this question on your phone" /> : <span className={styles.muted}>Making QR code…</span>}
              <p>Scan with your phone, sign in, then take a photo. The marking shows on your phone.</p>
            </div>
          )}

          {error && <p className={styles.error} role="alert">{error}</p>}

          <form className={styles.composer} onSubmit={submit}>
            {photo && (
              <div className={styles.attached}>
                <Image unoptimized width={0} height={0} src={photo} alt="Photo to send" />
                <button type="button" className={styles.removePhoto} aria-label="Remove photo" onClick={() => setPhoto(null)}><X weight="bold" /></button>
              </div>
            )}
            <div className={styles.inputRow}>
              <button type="button" className={styles.iconButton} aria-label="Attach a photo of your working" disabled={busy} onClick={() => choosePhoto(null)}><Camera weight="bold" /></button>
              <textarea
                ref={inputRef}
                className={styles.input}
                rows={1}
                maxLength={HELPER_MAX_TEXT}
                placeholder={photo ? "Add a note, or just send" : `Ask ${HELPER_NAME} about this question`}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }}
                aria-label={`Message ${HELPER_NAME}`}
              />
              <button type="submit" className={styles.iconButton} aria-label="Send" disabled={busy || (!draft.trim() && !photo)}><PaperPlaneRight weight="fill" /></button>
            </div>
            <p className={styles.footnote}>{remaining !== null ? `${remaining} ${remaining === 1 ? "message" : "messages"} left today · ` : ""}{HELPER_NAME} can make mistakes; the mark scheme has the final say.</p>
          </form>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(event) => void onPhotoChosen(event.target.files?.[0])} />
        </>
      )}
    </section>
  );
}
