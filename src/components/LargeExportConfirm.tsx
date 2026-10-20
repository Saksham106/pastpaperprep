"use client";

import { useEffect, useRef } from "react";

/** Asks once before building a very large PDF; large exports are often a mis-click and use a daily download. */
export function LargeExportConfirm({ count, onConfirm, onCancel }: { count: number; onConfirm: () => void; onCancel: () => void }) {
  const confirm = useRef<HTMLButtonElement>(null);
  useEffect(() => { confirm.current?.focus(); }, []);
  return <div className="answer-placement-prompt" role="group" aria-labelledby="large-export-title">
    <span id="large-export-title">Download all {count} questions? Big PDFs take a minute and use one of your daily downloads.</span>
    <button ref={confirm} type="button" className="button secondary" onClick={onConfirm}>Download {count}</button>
    <button type="button" className="button secondary" onClick={onCancel}>Go back</button>
  </div>;
}
