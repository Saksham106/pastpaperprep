"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { HelperFace } from "@/components/helper/HelperFace";
import { OPEN_EVENT } from "@/components/helper/HelperLauncher";
import { useSheetPresence } from "@/components/helper/useSheetPresence";
import { HELPER_NAME, helperConfigured } from "@/lib/helper/config";
import { siteHelperHidden } from "@/lib/helper/site-config";
import { helperPageKind } from "@/lib/helper/site-paths";
import { trackProductEvent } from "@/lib/product-analytics";
import styles from "./helper.module.css";

const PepperPanel = dynamic(() => import("@/components/helper/PepperPanel").then((mod) => mod.PepperPanel), { ssr: false });

/** Pepper says hello (a hop and a wink) once per browser session, the first time the button appears. */
const HELLO_KEY = "ppp:site-helper:hello";

/**
 * The site-wide helper: a floating button on every page that opens Pepper to find questions, papers and topics.
 * Mounted once in the root layout, so an open conversation survives client-side navigation.
 */
export function SiteHelper() {
  const pathname = usePathname() ?? "/";
  const sheet = useSheetPresence();
  const { hide } = sheet;
  const [hello, setHello] = useState(false);
  const id = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef(false);

  // A question's own helper opening closes this one; only one sheet at a time.
  useEffect(() => {
    const onOpen = (event: Event) => { if ((event as CustomEvent<string>).detail !== id) hide(); };
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, [id, hide]);

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

  // The button is back once the sheet has slid away: give it focus if the student closed the sheet themselves.
  useEffect(() => {
    if (sheet.mounted || !returnFocus.current) return;
    returnFocus.current = false;
    buttonRef.current?.focus();
  }, [sheet.mounted]);

  if (!helperConfigured() || siteHelperHidden(pathname)) return null;

  return <>
    {!sheet.mounted && <button
      ref={buttonRef}
      type="button"
      className={styles.siteLauncher}
      data-hello={hello || undefined}
      aria-label={`Ask ${HELPER_NAME} to find questions and papers`}
      onClick={() => {
        window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: id }));
        trackProductEvent("helper_open", { surface: "site", page: helperPageKind(pathname) });
        setHello(false);
        sheet.show();
      }}
    ><HelperFace size={32} /><span>Ask {HELPER_NAME}</span></button>}
    {sheet.mounted && <PepperPanel
      closing={sheet.closing}
      onExited={sheet.exited}
      onClose={() => { returnFocus.current = true; hide(); }}
      onNavigated={() => {
        // On phones the sheet covers the page it just opened: step aside so the student sees it.
        if (window.matchMedia("(max-width: 640px)").matches) hide();
      }}
    />}
  </>;
}
