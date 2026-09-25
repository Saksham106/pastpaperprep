"use client";

import { useState } from "react";
import { ArrowSquareOut, FilePdf } from "@phosphor-icons/react/dist/ssr";
import { EXAM_STYLE_INDUCTION_SETS } from "@/lib/exam-style-induction";

export function ExamStyleInductionSets() {
  const [selectedSlug, setSelectedSlug] = useState<string>(EXAM_STYLE_INDUCTION_SETS[0].slug);
  const selected = EXAM_STYLE_INDUCTION_SETS.find((set) => set.slug === selectedSlug) ?? EXAM_STYLE_INDUCTION_SETS[0];
  const apiUrl = `/api/exam-style/proof-by-induction/${selected.slug}`;
  return (
    <section className="exam-style-workspace" aria-labelledby="induction-practice-set-heading">
      <div className="exam-style-set-list" role="group" aria-label="Proof by induction practice sets">
        {EXAM_STYLE_INDUCTION_SETS.map((set) => (
          <button className={`exam-style-set-option${set.slug === selected.slug ? " is-selected" : ""}`} key={set.slug} type="button" aria-pressed={set.slug === selected.slug} onClick={() => setSelectedSlug(set.slug)}>
            <FilePdf aria-hidden="true" weight="duotone" />
            <span><strong>{set.title}</strong><small>{set.count} questions · worked solutions</small></span>
          </button>
        ))}
      </div>
      <div className="exam-style-viewer">
        <header><div><p className="eyebrow">Selected practice set</p><h2 id="induction-practice-set-heading">{selected.title}</h2></div>
          <div className="exam-style-fallbacks"><a className="text-link" href={apiUrl} target="_blank" rel="noreferrer">Open in new tab <ArrowSquareOut aria-hidden="true" /></a></div>
        </header>
        <iframe className="exam-style-pdf" key={selected.slug} src={apiUrl} title={`${selected.title} practice PDF`} />
        <p className="exam-style-fallback-note">If the embedded viewer does not load, open the practice set in a new tab.</p>
      </div>
    </section>
  );
}
