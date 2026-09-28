"use client";

import { useState } from "react";
import { CaretDown, FilePdf } from "@phosphor-icons/react/dist/ssr";
import { EXAM_STYLE_INDUCTION_SETS } from "@/lib/exam-style-induction";
import { EXAM_STYLE_BINOMIAL_COUNTING_SETS } from "@/lib/exam-style-binomial-counting";
import { ExamStylePdfViewer } from "@/components/ExamStylePdfViewer";

const TOPICS = ["Proof by induction", "Binomial theorem", "Counting principle"] as const;
type Topic = (typeof TOPICS)[number];

export function ExamStyleAAHLWorkspace() {
  const [topic, setTopic] = useState<Topic>(TOPICS[0]);
  const [inductionOpen, setInductionOpen] = useState(true);
  const [setSlug, setSetSlug] = useState<string>(EXAM_STYLE_INDUCTION_SETS[0].slug);
  const sets = topic === TOPICS[0]
    ? EXAM_STYLE_INDUCTION_SETS
    : [EXAM_STYLE_BINOMIAL_COUNTING_SETS.find((set) => set.slug === (topic === TOPICS[1] ? "binomial" : "counting"))!];
  const selected = sets.find((set) => set.slug === setSlug) ?? sets[0];
  const apiUrl = topic === TOPICS[0]
    ? `/api/exam-style/proof-by-induction/${selected.slug}`
    : `/api/exam-style/binomial-counting/${selected.slug}`;

  function selectTopic(next: Topic) {
    if (next === TOPICS[0]) {
      setInductionOpen((open) => !open);
      setTopic(next);
      setSetSlug(EXAM_STYLE_INDUCTION_SETS[0].slug);
    } else {
      setTopic(next);
      setInductionOpen(false);
      setSetSlug(next === TOPICS[1] ? "binomial" : "counting");
    }
  }

  return (
    <section className="exam-style-workspace" aria-labelledby="aa-hl-practice-set-heading">
      <nav className="exam-style-set-list exam-style-topic-tree" aria-label="AA HL exam-style topics">
        {TOPICS.map((item) => (
          <div className="exam-style-topic-branch" key={item}>
            <button className={`exam-style-set-option${item === topic ? " is-selected" : ""}`} type="button"
              aria-pressed={item === topic} aria-expanded={item === TOPICS[0] ? inductionOpen : undefined}
              aria-controls={item === TOPICS[0] ? "induction-practice-sets" : undefined}
              onClick={() => selectTopic(item)}>
              <span><strong>{item}</strong><small>{item === TOPICS[0] ? "3 practice sets" : "1 practice set"}</small></span>
              {item === TOPICS[0] && <CaretDown className={`exam-style-branch-caret${inductionOpen ? " is-open" : ""}`} aria-hidden="true" />}
            </button>
            {item === TOPICS[0] && inductionOpen && (
              <div id="induction-practice-sets" className="exam-style-tree-children" role="group" aria-label="Proof by induction practice sets">
                {EXAM_STYLE_INDUCTION_SETS.map((set) => (
                  <button className={`exam-style-set-option exam-style-tree-child${topic === TOPICS[0] && set.slug === selected.slug ? " is-selected" : ""}`}
                    key={set.slug} type="button" aria-pressed={topic === TOPICS[0] && set.slug === selected.slug}
                    onClick={() => { setTopic(TOPICS[0]); setSetSlug(set.slug); }}>
                    <FilePdf aria-hidden="true" weight="duotone" />
                    <span><strong>{set.title}</strong><small>{set.count} questions · worked solutions</small></span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </nav>
      <div className="exam-style-viewer">
        <ExamStylePdfViewer key={apiUrl} src={apiUrl} title={selected.title} eyebrow={`${topic} · selected practice set`} headingId="aa-hl-practice-set-heading" />
      </div>
    </section>
  );
}
