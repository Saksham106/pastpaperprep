"use client";

import { useState } from "react";
import { ArrowSquareOut, FilePdf } from "@phosphor-icons/react/dist/ssr";
import { EXAM_STYLE_INDUCTION_SETS } from "@/lib/exam-style-induction";
import { EXAM_STYLE_BINOMIAL_COUNTING_SETS } from "@/lib/exam-style-binomial-counting";

const TOPICS = ["Proof by induction", "Binomial theorem", "Counting principle"] as const;
type Topic = (typeof TOPICS)[number];

export function ExamStyleAAHLWorkspace() {
  const [topic, setTopic] = useState<Topic>(TOPICS[0]);
  const [setSlug, setSetSlug] = useState<string>(EXAM_STYLE_INDUCTION_SETS[0].slug);
  const sets = topic === TOPICS[0]
    ? EXAM_STYLE_INDUCTION_SETS
    : [EXAM_STYLE_BINOMIAL_COUNTING_SETS.find((set) => set.slug === (topic === TOPICS[1] ? "binomial" : "counting"))!];
  const selected = sets.find((set) => set.slug === setSlug) ?? sets[0];
  const apiUrl = topic === TOPICS[0]
    ? `/api/exam-style/proof-by-induction/${selected.slug}`
    : `/api/exam-style/binomial-counting/${selected.slug}`;

  function selectTopic(next: Topic) {
    setTopic(next);
    setSetSlug(next === TOPICS[0] ? EXAM_STYLE_INDUCTION_SETS[0].slug : next === TOPICS[1] ? "binomial" : "counting");
  }

  return (
    <section className="exam-style-workspace" aria-labelledby="aa-hl-practice-set-heading">
      <nav className="exam-style-set-list" aria-label="AA HL exam-style topics">
        {TOPICS.map((item) => <button className={`exam-style-set-option${item === topic ? " is-selected" : ""}`} key={item} type="button" aria-pressed={item === topic} onClick={() => selectTopic(item)}>
          <span><strong>{item}</strong><small>{item === TOPICS[0] ? "3 practice sets" : "1 practice set"}</small></span>
        </button>)}
      </nav>
      <div className="exam-style-viewer">
        {sets.length > 1 && <div className="exam-style-topic-sets" role="group" aria-label={`${topic} practice sets`}>
          {sets.map((set) => <button className={`exam-style-set-option${set.slug === selected.slug ? " is-selected" : ""}`} key={set.slug} type="button" aria-pressed={set.slug === selected.slug} onClick={() => setSetSlug(set.slug)}><FilePdf aria-hidden="true" weight="duotone" /><span><strong>{set.title}</strong><small>{set.count} questions · worked solutions</small></span></button>)}
        </div>}
        <header><div><p className="eyebrow">{topic} · selected practice set</p><h2 id="aa-hl-practice-set-heading">{selected.title}</h2></div>
          <div className="exam-style-fallbacks"><a className="text-link" href={apiUrl} target="_blank" rel="noreferrer">Open in new tab <ArrowSquareOut aria-hidden="true" /></a></div>
        </header>
        <iframe className="exam-style-pdf" key={apiUrl} src={apiUrl} title={`${selected.title} practice PDF`} />
        <p className="exam-style-fallback-note">If the embedded viewer does not load, open the practice set in a new tab.</p>
      </div>
    </section>
  );
}
