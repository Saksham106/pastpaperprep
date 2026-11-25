"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { HelperFace } from "@/components/helper/HelperFace";
import { usePepperLayout } from "@/components/helper/usePepperLayout";
import { useSheetPresence } from "@/components/helper/useSheetPresence";
import { HELPER_NAME, helperConfigured } from "@/lib/helper/config";
import { PEPPER_OPEN_EVENT, siteHelperHidden, type PepperOpenDetail, type PepperQuestion } from "@/lib/helper/site-config";
import { helperPageKind } from "@/lib/helper/site-paths";
import { trackProductEvent } from "@/lib/product-analytics";
import styles from "./helper.module.css";

const PepperPanel = dynamic(() => import("@/components/helper/PepperPanel").then((mod) => mod.PepperPanel), { ssr: false });

/** Pepper says hello (a hop and a wink) once per browser session, the first time the button appears. */
const HELLO_KEY = "ppp:site-helper:hello";

/**
 * The one Pepper: a floating button on every page, and the single panel every Ask Pepper button opens (with its question
 * attached). Mounted once in the root layout, so a conversation survives client-side navigation, including pages Pepper
 * opens from a question's chat.
 */
export function SiteHelper() {
  const pathname = usePathname() ?? "/";
  const sheet = useSheetPresence();
  const { hide, show } = sheet;
  const [question, setQuestion] = useState<PepperQuestion | null>(null);
  const layout = usePepperLayout();
  const [expanded, setExpanded] = useState(false);
  // Full screen from a question: a copy of its card (with its mark scheme if revealed), taken when expanding.
  const [beside, setBeside] = useState<HTMLElement | null>(null);
  const [hello, setHello] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  /** Where focus goes back to when the student closes Pepper: the button they opened it with. */
  const openerRef = useRef<HTMLElement | null>(null);
  const returnFocus = useRef(false);
  const stateRef = useRef({ open: false, thread: "" });
  useEffect(() => { stateRef.current = { open: sheet.open, thread: question ? `${question.bank}:${question.questionId}` : "" }; }, [sheet.open, question]);

  // Ask Pepper buttons on questions open this same panel with their question attached; again on the same one closes it.
  useEffect(() => {
    const onOpen = (event: Event) => {
      const detail = (event as CustomEvent<PepperOpenDetail>).detail;
      const next = detail?.question ?? null;
      const thread = next ? `${next.bank}:${next.questionId}` : "";
      if (stateRef.current.open && stateRef.current.thread === thread) { returnFocus.current = true; hide(); return; }
      openerRef.current = detail?.opener ?? null;
      setQuestion(next);
      setExpanded(false);
      setBeside(null);
      // Phones: the sheet takes the bottom half, so bring the question to the top half, just under the header.
      const card = detail?.opener?.closest<HTMLElement>(".question-card");
      if (card && window.matchMedia?.("(max-width: 640px)").matches) {
        requestAnimationFrame(() => window.scrollTo({ top: card.getBoundingClientRect().top + window.scrollY - 76, behavior: "smooth" }));
      }
      trackProductEvent("helper_open", next ? { surface: "question", bank: next.bank, freePreview: next.freePreview } : { surface: "site", page: helperPageKind(window.location.pathname) });
      show();
    };
    window.addEventListener(PEPPER_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(PEPPER_OPEN_EVENT, onOpen);
  }, [hide, show]);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(HELLO_KEY)) return;
      sessionStorage.setItem(HELLO_KEY, "1");
    } catch {
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-off, after hydration
    setHello(true);
  }, []);

  // Once the sheet has slid away, focus goes back to the button that opened it (if it is still on the page).
  useEffect(() => {
    if (sheet.mounted || !returnFocus.current) return;
    returnFocus.current = false;
    const opener = openerRef.current;
    if (opener?.isConnected) opener.focus(); else buttonRef.current?.focus();
  }, [sheet.mounted]);

  // Docked on desktop: the page narrows beside Pepper instead of being covered. It widens again as Pepper slides out.
  const docked = sheet.mounted && !sheet.closing && layout === "docked" && !expanded && !siteHelperHidden(pathname);
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.pepper = docked ? "docked" : "off";
    return () => { root.dataset.pepper = "off"; };
  }, [docked]);

  const changeExpanded = (next: boolean) => {
    if (next && layout !== "phone") {
      const card = openerRef.current?.closest<HTMLElement>(".question-card");
      if (card && question) {
        const copy = card.cloneNode(true) as HTMLElement;
        // A picture of the question, not a second set of controls.
        copy.querySelectorAll("button, input, label, a, .question-action-buttons, .pdf-select").forEach((node) => node.remove());
        copy.removeAttribute("id");
        setBeside(copy);
      } else setBeside(null);
    }
    trackProductEvent("helper_expand", { expanded: next, layout });
    setExpanded(next);
  };

  if (!helperConfigured()) return null;
  const hidden = siteHelperHidden(pathname);

  return <>
    {!sheet.mounted && !hidden && <button
      ref={buttonRef}
      type="button"
      className={styles.siteLauncher}
      data-hello={hello || undefined}
      aria-label={`Ask ${HELPER_NAME} to find questions and papers`}
      onClick={() => {
        setHello(false);
        window.dispatchEvent(new CustomEvent<PepperOpenDetail>(PEPPER_OPEN_EVENT, { detail: { question: null } }));
      }}
    ><HelperFace size={32} /><span>Ask {HELPER_NAME}</span></button>}
    {sheet.mounted && !hidden && <PepperPanel
      // A different question (or the site chat) is a different conversation.
      key={question ? `${question.bank}:${question.questionId}` : "site"}
      {...(question ? { question } : {})}
      layout={layout}
      expanded={expanded}
      onExpandedChange={changeExpanded}
      beside={beside}
      closing={sheet.closing}
      onExited={sheet.exited}
      onClose={() => { returnFocus.current = true; setExpanded(false); hide(); }}
      onNavigated={() => {
        // On phones the sheet covers the page it just opened: step aside so the student sees it.
        if (window.matchMedia("(max-width: 640px)").matches) hide();
      }}
    />}
  </>;
}
