"use client";

import { ArrowDown, ArrowsClockwise, ArrowsLeftRight, ArrowUp, X } from "@phosphor-icons/react/dist/ssr";
import { CalculatorBadge } from "@/components/CalculatorBadge";
import type { BuilderQuestion } from "@/lib/builder-topics";
import { pdfSourceLabel } from "@/lib/pdf-labels";
import { displayedQuestionSubtopics, formatQuestionTopic } from "@/lib/presentation";

type Props = {
  title: string;
  onTitle: (title: string) => void;
  questions: BuilderQuestion[];
  totalMarks: number;
  status: string;
  canSwap: (id: string) => boolean;
  /** Picked topics a question covers only in part, named so the student sees why it is here. */
  partlyCovers?: (id: string) => string[];
  onShuffle: () => void;
  onMove: (id: string, direction: -1 | 1) => void;
  onSwap: (id: string) => void;
  onRemove: (id: string) => void;
  onOpen: (index: number) => void;
  actions: React.ReactNode;
  busy?: boolean;
};

export function BuilderSheet({ title, onTitle, questions, totalMarks, status, canSwap, partlyCovers, onShuffle, onMove, onSwap, onRemove, onOpen, actions, busy }: Props) {
  return <section id="builder-sheet" className="builder-sheet" aria-label="Your paper">
    <header className="builder-sheet-head">
      <div>
        {/* A textarea so long names wrap; line breaks are not part of a name. */}
        <textarea className="builder-title" aria-label="Worksheet name" rows={1} maxLength={80} value={title} disabled={busy}
          onKeyDown={(event) => { if (event.key === "Enter") event.preventDefault(); }}
          onChange={(event) => onTitle(event.target.value.replace(/\s*\n\s*/g, " "))} />
        <p className="builder-sheet-meta">{questions.length} {questions.length === 1 ? "question" : "questions"} · {totalMarks} {totalMarks === 1 ? "mark" : "marks"}</p>
      </div>
      <button type="button" className="button secondary builder-shuffle" disabled={busy || !questions.length} onClick={onShuffle}><ArrowsClockwise aria-hidden="true" /> Shuffle</button>
    </header>
    {status && <p className="builder-sheet-status" role="status">{status}</p>}
    {questions.length ? <ol className="builder-rows" aria-label="Questions in this paper">{questions.map((question, index) => {
      const topic = formatQuestionTopic(question.bankSlug, question.primaryTopic);
      const subtopic = displayedQuestionSubtopics(question)[0];
      const covers = partlyCovers?.(question.id) ?? [];
      return <li key={question.id} className="builder-row">
        <button type="button" className="builder-row-open" onClick={() => onOpen(index)} aria-label={`Preview question ${index + 1}: ${topic}`}>
          <span className="builder-row-number">{index + 1}</span>
          <span className="builder-row-text"><strong>{topic}</strong><small>{covers.length ? `Also covers ${covers.join(", ")} · ` : subtopic && subtopic !== topic ? `${subtopic} · ` : ""}{pdfSourceLabel(question)}</small></span>
          <span className="builder-row-marks"><CalculatorBadge value={question.calculator} />{question.marks} {question.marks === 1 ? "mark" : "marks"}</span>
        </button>
        <span className="builder-row-actions">
          <button type="button" aria-label={`Move question ${index + 1} up`} disabled={busy || index === 0} onClick={() => onMove(question.id, -1)}><ArrowUp aria-hidden="true" /></button>
          <button type="button" aria-label={`Move question ${index + 1} down`} disabled={busy || index === questions.length - 1} onClick={() => onMove(question.id, 1)}><ArrowDown aria-hidden="true" /></button>
          <button type="button" aria-label={`Swap question ${index + 1}`} title={canSwap(question.id) ? "Swap for another question" : "No other matching question"} disabled={busy || !canSwap(question.id)} onClick={() => onSwap(question.id)}><ArrowsLeftRight aria-hidden="true" /></button>
          <button type="button" aria-label={`Remove question ${index + 1}`} disabled={busy} onClick={() => onRemove(question.id)}><X aria-hidden="true" /></button>
        </span>
      </li>;
    })}</ol> : <p className="builder-sheet-empty">Pick topics and a size to start your paper.</p>}
    <footer className="builder-sheet-actions">{actions}</footer>
  </section>;
}
