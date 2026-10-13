"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { Flag } from "@phosphor-icons/react";
import { trackProductEvent } from "@/lib/product-analytics";

export type QuestionReportIssue = "question_image" | "mark_scheme" | "explanation" | "other";

const ISSUES: readonly { issue: QuestionReportIssue; label: string }[] = [
  { issue: "question_image", label: "Question image is wrong or cut off" },
  { issue: "mark_scheme", label: "Mark scheme is wrong or cut off" },
  { issue: "explanation", label: "Explanation is wrong or unclear" },
  { issue: "other", label: "Something else" },
];

// One report per question per page session, even when a filter change remounts the card.
const reportedQuestions = new Set<string>();

/** Quiet per-card control that sends a code-controlled `question_report` event (no free text). */
export function QuestionReport({ bank, questionId, hasExplanation, freePreview }: { bank: string; questionId: string; hasExplanation: boolean; freePreview: boolean }) {
  const key = `${bank}/${questionId}`;
  const [reported, setReported] = useState(() => reportedQuestions.has(key));
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const thanksRef = useRef<HTMLSpanElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const focusThanks = useRef(false);
  const menuId = useId();
  const labelId = useId();
  const issues = ISSUES.filter((item) => item.issue !== "explanation" || hasExplanation);

  useEffect(() => {
    if (!open) return;
    itemRefs.current[0]?.focus();
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  useEffect(() => {
    if (reported && focusThanks.current) {
      focusThanks.current = false;
      thanksRef.current?.focus();
    }
  }, [reported]);

  const close = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  const report = (issue: QuestionReportIssue) => {
    if (!reportedQuestions.has(key)) {
      reportedQuestions.add(key);
      trackProductEvent("question_report", { bank, questionId, issue, freePreview, hasExplanation });
    }
    focusThanks.current = true;
    setOpen(false);
    setReported(true);
  };

  const onMenuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    if (event.key === "Tab") {
      setOpen(false);
      return;
    }
    const current = itemRefs.current.findIndex((item) => item === document.activeElement);
    const last = issues.length - 1;
    const next = event.key === "ArrowDown" ? (current + 1) % issues.length
      : event.key === "ArrowUp" ? (current <= 0 ? last : current - 1)
        : event.key === "Home" ? 0
          : event.key === "End" ? last
            : null;
    if (next === null) return;
    event.preventDefault();
    itemRefs.current[next]?.focus();
  };

  if (reported) {
    return <span ref={thanksRef} className="question-report-thanks" role="status" tabIndex={-1}>Thanks — we&apos;ll check it.</span>;
  }

  return (
    <div className="question-report" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="study-icon-button question-report-trigger"
        title="Report a problem"
        aria-label="Report a problem"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === "Escape" && open) { event.preventDefault(); close(); }
        }}
      >
        <Flag aria-hidden="true" />
      </button>
      {open && (
        <div className="question-report-popover">
          <p className="question-report-label" id={labelId}>What&apos;s wrong?</p>
          <div className="question-report-menu" id={menuId} role="menu" aria-labelledby={labelId} onKeyDown={onMenuKeyDown}>
            {issues.map((item, index) => (
              <button
                key={item.issue}
                ref={(element) => { itemRefs.current[index] = element; }}
                type="button"
                role="menuitem"
                className="question-report-option"
                onClick={() => report(item.issue)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
