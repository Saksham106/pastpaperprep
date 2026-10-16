"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Atom, X } from "@phosphor-icons/react/dist/ssr";
import { PeriodicTable } from "@/components/PeriodicTable";
import type { PeriodicElement } from "@/lib/periodic-table";
import { trackProductEvent } from "@/lib/product-analytics";
import "./periodic-table.css";

type TableData = { elements: PeriodicElement[]; rtp: string };

/**
 * Opens Cambridge's Periodic Table in a dock along the bottom of the screen, so the question stays
 * readable above it. The table data loads on first open only. `floating` pins the button to the
 * corner of long, scrolling pages such as the bank page. The dock renders into <body>, so a
 * transformed or scrolling ancestor (a phone dock, a modal) can't move or clip it.
 */
export function PeriodicTableButton({ variant = "inline", source }: { variant?: "inline" | "floating"; source: string }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<TableData | null>(null);
  const [failed, setFailed] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const dock = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;
    dock.current?.focus();
    // Escape closes only this dock, even when it sits over a reader that also closes on Escape.
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopImmediatePropagation();
      close();
    };
    document.addEventListener("keydown", onKey, { capture: true });
    return () => document.removeEventListener("keydown", onKey, { capture: true });
  }, [open]);

  function show() {
    setOpen(true);
    trackProductEvent("periodic_table_open", { source });
    if (data) return;
    import("@/data/cambridge-periodic-table.json")
      .then((module) => setData({ elements: module.default.elements as PeriodicElement[], rtp: module.default.rtp }))
      .catch(() => setFailed(true));
  }

  function close() {
    setOpen(false);
    requestAnimationFrame(() => button.current?.focus());
  }

  return <>
    <button ref={button} type="button" className={`periodic-button is-${variant}`} aria-expanded={open} aria-controls="periodic-dock" onClick={open ? close : show}>
      <Atom aria-hidden="true" weight="bold" /> Periodic Table
    </button>
    {open && createPortal(<section id="periodic-dock" ref={dock} className="periodic-dock" role="dialog" aria-modal="false" aria-label="The Periodic Table of Elements" tabIndex={-1}>
      <header className="periodic-dock-head">
        <h2>The Periodic Table of Elements</h2>
        <button type="button" className="periodic-close" aria-label="Close the Periodic Table" onClick={close}><X aria-hidden="true" weight="bold" /></button>
      </header>
      <div className="periodic-dock-body">
        <p className="periodic-swipe">Swipe sideways to see the whole table.</p>
        {data ? <PeriodicTable elements={data.elements} rtp={data.rtp} />
          : <p className="periodic-status" role="status">{failed ? "Couldn’t load the Periodic Table. Try again." : "Loading…"}</p>}
      </div>
    </section>, document.body)}
  </>;
}
