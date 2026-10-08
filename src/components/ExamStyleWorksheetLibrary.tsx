"use client";

import { useState } from "react";
import { ExamStylePdfViewer } from "@/components/ExamStylePdfViewer";
import type { ExamStyleWorksheet } from "@/lib/exam-style-worksheets";

export function ExamStyleWorksheetLibrary({ worksheets }: { worksheets: readonly ExamStyleWorksheet[] }) {
  const [selectedSlug, setSelectedSlug] = useState(worksheets[0]?.slug ?? "");
  const selected = worksheets.find((worksheet) => worksheet.slug === selectedSlug) ?? worksheets[0];
  if (!selected) return null;
  return (
    <section className="exam-style-workspace" aria-labelledby="worksheet-heading">
      <div className="exam-style-set-list" role="group" aria-label="Exam-style practice sets">
        {worksheets.map((worksheet) => (
          <button className={`exam-style-set-option${worksheet.slug === selected.slug ? " is-selected" : ""}`} key={worksheet.slug} type="button" aria-pressed={worksheet.slug === selected.slug} onClick={() => setSelectedSlug(worksheet.slug)}>
            <span><strong>{worksheet.title}</strong><small>{worksheet.topics.join(" · ")}</small></span>
          </button>
        ))}
      </div>
      <div className="exam-style-viewer">
        <ExamStylePdfViewer key={selected.slug} src={`/api/exam-style/worksheets/${selected.course}/${selected.slug}`} title={selected.title} eyebrow="Selected practice set" headingId="worksheet-heading" />
      </div>
    </section>
  );
}
