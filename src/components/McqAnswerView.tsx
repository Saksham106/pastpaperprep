import { Fragment } from "react";
import { formatMcqAnswer, type McqAnswer } from "@/lib/mcq-answer";

/** A verified multiple-choice answer: "Answer B", or "Answer A or B" when both were accepted. */
export function McqAnswerView({ answer }: { answer: McqAnswer }) {
  return <div className="mcq-answer">
    <p className="mcq-answer-row">
      <span className="answer-panel-label">Answer</span>
      <span className="sr-only">{formatMcqAnswer(answer.answers)}</span>
      <span className="mcq-answer-letters" aria-hidden="true">
        {answer.answers.map((letter, index) => <Fragment key={letter}>
          {index > 0 && <span className="mcq-answer-or">{index === answer.answers.length - 1 ? "or" : ","}</span>}
          <span className="mcq-answer-chip">{letter}</span>
        </Fragment>)}
      </span>
    </p>
    {answer.note && <p className="mcq-answer-note">{answer.note}</p>}
  </div>;
}
