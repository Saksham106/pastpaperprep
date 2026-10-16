"use client";

import { useState } from "react";
import { CalculatorBadge } from "@/components/CalculatorBadge";
import type { TopicNode } from "@/lib/builder-topics";
import type { PaperDraftTarget } from "@/lib/paper-draft";

export type SizeTarget = { kind: "questions" | "marks"; amount: number };
const QUICK: Record<SizeTarget["kind"], number[]> = { questions: [5, 10, 20], marks: [25, 50, 80] };
const LIMIT: Record<SizeTarget["kind"], number> = { questions: 50, marks: 200 };

type Props = {
  tree: TopicNode[];
  counts: ReadonlyMap<string, number>;
  selection: ReadonlySet<string>;
  onToggle: (key: string) => void;
  onClearTopics: () => void;
  years: number[];
  from?: number; to?: number;
  onYears: (from: number | undefined, to: number | undefined) => void;
  size: SizeTarget;
  onSize: (size: SizeTarget) => void;
  papers: { paper: number; available: number; calculator: boolean | null }[];
  paperTargets: PaperDraftTarget[];
  paperMode: "questions" | "marks";
  onPaperTargets: (targets: PaperDraftTarget[], mode: "questions" | "marks") => void;
  matching: number;
  disabled?: boolean;
};

function TopicRow({ node, counts, selection, onToggle }: { node: TopicNode; counts: Props["counts"]; selection: Props["selection"]; onToggle: Props["onToggle"] }) {
  const partial = node.subtopics.filter((subtopic) => selection.has(subtopic.key)).length;
  const [open, setOpen] = useState(partial > 0);
  const count = counts.get(node.key) ?? 0;
  const checked = selection.has(node.key);
  return <li className="builder-topic">
    <div className="builder-topic-row" data-selected={checked || partial > 0 || undefined}>
      <label className={count || checked ? undefined : "is-empty"}>
        <input type="checkbox" checked={checked} disabled={!count && !checked}
          ref={(input) => { if (input) input.indeterminate = !checked && partial > 0; }} onChange={() => onToggle(node.key)} />
        <span>{node.label}</span>
      </label>
      <span className="builder-count">{count}</span>
      {node.subtopics.length > 0 && <button type="button" className="builder-expand" aria-expanded={open} aria-label={`${open ? "Hide" : "Show"} ${node.label} subtopics`} onClick={() => setOpen(!open)}>{open ? "−" : "+"}</button>}
    </div>
    {open && <ul className="builder-subtopics" aria-label={`${node.label} subtopics`}>{node.subtopics.map((subtopic) => {
      const subCount = counts.get(subtopic.key) ?? 0;
      const subChecked = selection.has(subtopic.key);
      return <li key={subtopic.key} className="builder-topic-row" data-selected={subChecked || undefined}>
        <label className={subCount || subChecked ? undefined : "is-empty"}>
          <input type="checkbox" checked={subChecked} disabled={!subCount && !subChecked} onChange={() => onToggle(subtopic.key)} />
          <span>{subtopic.label}</span>
        </label>
        <span className="builder-count">{subCount}</span>
      </li>;
    })}</ul>}
  </li>;
}

export function BuilderChoices(props: Props) {
  const { tree, counts, selection, onToggle, onClearTopics, years, from, to, onYears, size, onSize, papers, paperTargets, paperMode, onPaperTargets, matching, disabled } = props;
  const [papersOpen, setPapersOpen] = useState(paperTargets.length > 0);
  const amountFor = (paper: number) => paperTargets.find((item) => item.paper === paper)?.amount ?? 0;
  const setPaperAmount = (paper: number, amount: number) => {
    const rest = paperTargets.filter((item) => item.paper !== paper);
    const next = amount > 0 ? [...rest, { paper, mode: paperMode, amount: Math.min(amount, LIMIT[paperMode]) }] : rest;
    onPaperTargets(next.sort((a, b) => a.paper - b.paper), paperMode);
  };
  return <section className="builder-choices" aria-label="What to practise">
    <fieldset className="builder-field" disabled={disabled}>
      <legend>Topics{selection.size > 0 && <button type="button" className="builder-link" onClick={onClearTopics}>All topics</button>}</legend>
      <ul className="builder-topics" aria-label="Topics">{tree.map((node) => <TopicRow key={node.key} node={node} counts={counts} selection={selection} onToggle={onToggle} />)}</ul>
    </fieldset>

    <fieldset className="builder-field builder-years" disabled={disabled}>
      <legend>Years</legend>
      <label>From<select value={from ?? ""} onChange={(event) => onYears(event.target.value ? Number(event.target.value) : undefined, to)}><option value="">Any</option>{[...years].reverse().map((year) => <option key={year}>{year}</option>)}</select></label>
      <label>To<select value={to ?? ""} onChange={(event) => onYears(from, event.target.value ? Number(event.target.value) : undefined)}><option value="">Any</option>{years.map((year) => <option key={year}>{year}</option>)}</select></label>
    </fieldset>

    {paperTargets.length === 0 && <fieldset className="builder-field" disabled={disabled}>
      <legend>Size</legend>
      <div className="builder-segment" role="group" aria-label="Size by">{(["questions", "marks"] as const).map((kind) => <button key={kind} type="button" aria-pressed={size.kind === kind}
        onClick={() => size.kind !== kind && onSize({ kind, amount: kind === "questions" ? 10 : 50 })}>{kind === "questions" ? "Questions" : "Marks"}</button>)}</div>
      <div className="builder-size">
        {QUICK[size.kind].map((amount) => <button key={amount} type="button" className="builder-chip" aria-pressed={size.amount === amount} onClick={() => onSize({ ...size, amount })}>{amount}</button>)}
        <label className="builder-size-custom">
          <input type="number" inputMode="numeric" min={1} max={LIMIT[size.kind]} value={size.amount || ""} aria-label={`Number of ${size.kind}`}
            onChange={(event) => onSize({ ...size, amount: Math.max(0, Math.min(LIMIT[size.kind], Math.floor(Number(event.target.value) || 0))) })} />
        </label>
      </div>
    </fieldset>}

    <details className="builder-field builder-papers" open={papersOpen} onToggle={(event) => setPapersOpen((event.currentTarget as HTMLDetailsElement).open)}>
      <summary>Match a real paper</summary>
      <div className="builder-segment" role="group" aria-label="Paper targets in">{(["questions", "marks"] as const).map((mode) => <button key={mode} type="button" aria-pressed={paperMode === mode} disabled={disabled}
        onClick={() => onPaperTargets(paperTargets.map((item) => ({ ...item, mode })), mode)}>{mode === "questions" ? "Questions" : "Marks"}</button>)}</div>
      <ul className="builder-paper-list">{papers.map(({ paper, available, calculator }) => <li key={paper}>
        <label>Paper {paper}<input type="number" inputMode="numeric" min={0} max={LIMIT[paperMode]} value={amountFor(paper) || ""} placeholder="0" disabled={disabled}
          aria-label={`Paper ${paper} ${paperMode}`} onChange={(event) => setPaperAmount(paper, Math.max(0, Math.floor(Number(event.target.value) || 0)))} /></label>
        <span className="builder-count" title="Matching questions">{available}</span><CalculatorBadge value={calculator} />
      </li>)}</ul>
    </details>

    <p className={`builder-summary${matching ? "" : " is-empty"}`} role="status">{matching ? `✓ ${matching} ${matching === 1 ? "question matches" : "questions match"}` : "No questions match. Widen your topics or years."}</p>
  </section>;
}
