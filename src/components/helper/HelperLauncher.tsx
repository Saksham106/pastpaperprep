"use client";

import dynamic from "next/dynamic";
import { useEffect, useId, useRef } from "react";
import { useSheetPresence } from "@/components/helper/useSheetPresence";
import { HelperFace } from "@/components/helper/HelperFace";
import { HELPER_NAME } from "@/lib/helper/config";
import { trackProductEvent } from "@/lib/product-analytics";
import styles from "./helper.module.css";

const PepperPanel = dynamic(() => import("@/components/helper/PepperPanel").then((mod) => mod.PepperPanel), { ssr: false });

/** One panel at a time: opening one closes any other. */
export const OPEN_EVENT = "pastpaperprep:helper-open";

export function HelperLauncher({ bank, questionId, questionLabel, freePreview }: {
  bank: string;
  questionId: string;
  questionLabel: string;
  authenticated: boolean;
  freePreview: boolean;
}) {
  const sheet = useSheetPresence();
  const { hide } = sheet;
  const id = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onOpen = (event: Event) => { if ((event as CustomEvent<string>).detail !== id) hide(); };
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, [id, hide]);

  const close = () => {
    hide();
    buttonRef.current?.focus();
  };

  return <>
    <button
      ref={buttonRef}
      type="button"
      className={styles.launcher}
      aria-expanded={sheet.open}
      onClick={() => {
        if (sheet.open) { close(); return; }
        window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: id }));
        trackProductEvent("helper_open", { bank, freePreview });
        sheet.show();
      }}
    ><HelperFace size={24} />Ask {HELPER_NAME}</button>
    {sheet.mounted && <PepperPanel question={{ bank, questionId, label: questionLabel, freePreview }} onClose={close} closing={sheet.closing} onExited={sheet.exited} />}
  </>;
}
