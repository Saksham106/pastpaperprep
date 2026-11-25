"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { HelperFace } from "@/components/helper/HelperFace";
import { OPEN_EVENT } from "@/components/helper/HelperLauncher";
import { HELPER_NAME, helperConfigured } from "@/lib/helper/config";
import { siteHelperHidden } from "@/lib/helper/site-config";
import { helperPageKind } from "@/lib/helper/site-paths";
import { trackProductEvent } from "@/lib/product-analytics";
import styles from "./helper.module.css";

const SiteHelperPanel = dynamic(() => import("@/components/helper/SiteHelperPanel").then((mod) => mod.SiteHelperPanel), { ssr: false });

/**
 * The site-wide helper: a floating button on every page that opens Pepper to find questions, papers and topics.
 * Mounted once in the root layout, so an open conversation survives client-side navigation.
 */
export function SiteHelper() {
  const pathname = usePathname() ?? "/";
  const [open, setOpen] = useState(false);
  const id = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);

  // A question's own helper opening closes this one; only one sheet at a time.
  useEffect(() => {
    const onOpen = (event: Event) => { if ((event as CustomEvent<string>).detail !== id) setOpen(false); };
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, [id]);

  if (!helperConfigured() || siteHelperHidden(pathname)) return null;

  const close = () => {
    setOpen(false);
    // The button is back once the sheet is gone; focus it on the next frame.
    requestAnimationFrame(() => buttonRef.current?.focus());
  };

  return <>
    {!open && <button
      ref={buttonRef}
      type="button"
      className={styles.siteLauncher}
      aria-label={`Ask ${HELPER_NAME} to find questions and papers`}
      onClick={() => {
        window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: id }));
        trackProductEvent("helper_open", { surface: "site", page: helperPageKind(pathname) });
        setOpen(true);
      }}
    ><HelperFace size={32} /><span>Ask {HELPER_NAME}</span></button>}
    {open && <SiteHelperPanel onClose={close} onNavigated={() => {
      // On phones the sheet covers the page it just opened: step aside so the student sees it.
      if (window.matchMedia("(max-width: 640px)").matches) setOpen(false);
    }} />}
  </>;
}
