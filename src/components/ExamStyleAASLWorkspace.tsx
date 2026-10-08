"use client";

import { useState } from "react";
import { FilePdf } from "@phosphor-icons/react/dist/ssr";
import { ExamStylePdfViewer } from "@/components/ExamStylePdfViewer";
import { EXAM_STYLE_TRIGONOMETRY_SETS } from "@/lib/exam-style-trigonometry";
import { EXAM_STYLE_COURSES, type ExamStyleWorksheet } from "@/lib/exam-style-worksheets";

type WorksheetOption = { type: "worksheet"; worksheet: ExamStyleWorksheet };
type TrigonometryOption = { type: "trigonometry"; slug: string; title: string; count: number };
type Option = WorksheetOption | TrigonometryOption;

const worksheets = EXAM_STYLE_COURSES["ib-math-aa-sl"].worksheets.map((worksheet): WorksheetOption => ({ type: "worksheet", worksheet }));
const trigonometry = EXAM_STYLE_TRIGONOMETRY_SETS.map((set): TrigonometryOption => ({ type: "trigonometry", ...set }));
const OPTIONS: Option[] = [...trigonometry, ...worksheets];

function getSlug(option: Option) {
  return option.type === "worksheet" ? option.worksheet.slug : option.slug;
}

function getTitle(option: Option) {
  return option.type === "worksheet" ? option.worksheet.title : option.title;
}

export function ExamStyleAASLWorkspace() {
  const [selectedSlug, setSelectedSlug] = useState(getSlug(OPTIONS[0]));
  const selected = OPTIONS.find((option) => getSlug(option) === selectedSlug) ?? OPTIONS[0];
  const src = selected.type === "worksheet"
    ? `/api/exam-style/worksheets/${selected.worksheet.course}/${selected.worksheet.slug}`
    : `/api/exam-style/trigonometry/${selected.slug}`;

  return (
    <section className="exam-style-workspace" aria-labelledby="aa-sl-practice-heading">
      <div className="exam-style-set-list" role="group" aria-label="IB Mathematics AA SL exam-style PDFs">
        <h2 className="exam-style-topic-heading">Trigonometry</h2>
        {trigonometry.map((set) => (
          <button className={`exam-style-set-option${set.slug === getSlug(selected) ? " is-selected" : ""}`} key={set.slug} type="button" aria-pressed={set.slug === getSlug(selected)} onClick={() => setSelectedSlug(set.slug)}>
            <FilePdf aria-hidden="true" weight="duotone" /><span><strong>{set.title}</strong><small>{set.count} questions</small></span>
          </button>
        ))}
        <h2 className="exam-style-topic-heading">Probability distributions</h2>
        {worksheets.map(({ worksheet }) => (
          <button className={`exam-style-set-option${worksheet.slug === getSlug(selected) ? " is-selected" : ""}`} key={worksheet.slug} type="button" aria-pressed={worksheet.slug === getSlug(selected)} onClick={() => setSelectedSlug(worksheet.slug)}>
            <FilePdf aria-hidden="true" weight="duotone" /><span><strong>{worksheet.title}</strong><small>{worksheet.topics.join(" · ")}</small></span>
          </button>
        ))}
      </div>
      <div className="exam-style-viewer">
        <ExamStylePdfViewer key={getSlug(selected)} src={src} title={getTitle(selected)} eyebrow="Selected practice set" headingId="aa-sl-practice-heading" />
      </div>
    </section>
  );
}
