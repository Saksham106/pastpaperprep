"use client";

import { useEffect, useRef } from "react";
import type { PdfAnswerPlacement } from "@/lib/pdf-export";

/** Asked once Download is pressed for a questions-and-answers PDF: each choice starts the download. */
export function AnswerPlacementPrompt({ onChoose }: { onChoose: (placement: PdfAnswerPlacement) => void }) {
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => { first.current?.focus(); }, []);
  return <div className="answer-placement-prompt" role="group" aria-labelledby="answer-placement-title">
    <span id="answer-placement-title">Where should the answers go?</span>
    <button ref={first} type="button" className="button secondary" onClick={() => onChoose("all-answers-last")}>At the end</button>
    <button type="button" className="button secondary" onClick={() => onChoose("after-each-question")}>After each question</button>
  </div>;
}
