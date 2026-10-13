"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { MagnifyingGlass } from "@phosphor-icons/react/dist/ssr";
import { trackProductEvent } from "@/lib/product-analytics";
import { getCatalogBank } from "@/lib/catalog";
import { courseToneForBank } from "@/components/CourseIcon";
import {
  SEARCH_INDEX_PATH, SEARCH_PAPERS_PATH, looksLikePaper, searchSite, validSearchIndex, validSearchPapers,
  type SearchIndex, type SearchPapers, type SearchResults,
} from "@/lib/site-search";
import styles from "./SmartSearch.module.css";

/** One keyboard stop: every link in the dropdown, in reading order. */
type Option = { href: string; kind: "paper" | "topics" | "papers" | "topic" };
type Section = "paper" | "subject" | "topic";

let indexLoad: Promise<SearchIndex | null> | null = null;
let papersLoad: Promise<SearchPapers | null> | null = null;
const loadJson = <T,>(path: string, valid: (value: unknown) => value is T) =>
  fetch(path).then(response => response.ok ? response.json() : null).then(value => valid(value) ? value : null).catch(() => null);
/** Static files from the CDN; loaded once per tab, the paper list only when a query looks like a paper. */
const loadIndex = () => indexLoad ??= loadJson(SEARCH_INDEX_PATH, validSearchIndex).then(value => { if (!value) indexLoad = null; return value; });
const loadPapers = () => papersLoad ??= loadJson(SEARCH_PAPERS_PATH, validSearchPapers).then(value => { if (!value) papersLoad = null; return value; });

const toneFor = (bank: string) => { const catalog = getCatalogBank(bank as never); return catalog ? courseToneForBank(catalog) : "math"; };
const sectionsFor = (results: SearchResults): Section[] =>
  (results.intent === "paper" ? ["paper", "subject"] : results.intent === "topic" ? ["topic", "subject"] : ["subject", "topic"] as Section[])
    .filter(section => section === "paper" ? results.papers.length : section === "topic" ? results.topics.length : results.subjects.length);
/** Every link in the dropdown, in the order the sections show them. */
function optionsFor(results: SearchResults | null): Option[] {
  const options: Option[] = [];
  for (const section of results ? sectionsFor(results) : []) {
    if (section === "paper") for (const p of results!.papers) options.push({ href: p.href, kind: "paper" });
    if (section === "topic") for (const t of results!.topics) options.push({ href: t.href, kind: "topic" });
    if (section === "subject") for (const s of results!.subjects) {
      if (s.practiceHref) options.push({ href: s.practiceHref, kind: "topics" });
      if (s.papersHref) options.push({ href: s.papersHref, kind: "papers" });
    }
  }
  return options;
}

/** Hero search: subjects, topics and full past papers from one box, sorted by what the text looks like. */
export function SmartSearch() {
  const router = useRouter();
  const id = useId();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [index, setIndex] = useState<SearchIndex | null>(null);
  const [papers, setPapers] = useState<SearchPapers | null>(null);
  const [failed, setFailed] = useState(false);
  const [papersFailed, setPapersFailed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const warm = () => { if (!index) void loadIndex().then(value => { if (value) setIndex(value); else setFailed(true); }); };
  const fetchPapers = () => loadPapers().then(value => { if (value) setPapers(value); else setPapersFailed(true); return value; });
  const paperLike = looksLikePaper(q);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- starts a fetch; state lands when it answers
    if (open && paperLike && !papers && !papersFailed) void fetchPapers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, paperLike, papers, papersFailed]);

  // Results follow the text, not focus: the Search button blurs the box but must still open them.
  const typed = q.trim().length >= 2;
  const ready = open && typed;
  const results = typed && index ? searchSite(index, papers, q) : null;
  const sections = results ? sectionsFor(results) : [];
  const options = optionsFor(results);
  const waitingForPapers = typed && paperLike && !papers && !papersFailed;
  const current = Math.min(active, Math.max(options.length - 1, 0));
  const optionId = (i: number) => `${id}-option-${i}`;
  const position = (href: string, kind: Option["kind"]) => options.findIndex(o => o.href === href && o.kind === kind);

  function go(option: Option | undefined, intent = results?.intent ?? "none") {
    trackProductEvent("home_search", { found: !!option, kind: option?.kind ?? "none", intent });
    if (option) router.push(option.href);
  }
  /** Enter or Search. A paper code waits for the paper list, so it never falls through to a topic link. */
  async function submit() {
    if (submitting) return;
    if (!paperLike || papers) return go(options[current]);
    setSubmitting(true);
    setOpen(true);
    const [loadedIndex, loadedPapers] = await Promise.all([index ?? loadIndex(), fetchPapers()]);
    setSubmitting(false);
    if (!loadedIndex || !loadedPapers) return;
    if (!index) setIndex(loadedIndex);
    const fresh = searchSite(loadedIndex, loadedPapers, q);
    go(optionsFor(fresh)[0], fresh.intent);
  }
  function retryPapers() { setPapersFailed(false); input.current?.focus(); void fetchPapers(); }
  const link = (href: string, kind: Option["kind"], className: string, children: React.ReactNode, label?: string) => {
    const i = position(href, kind);
    return <a id={optionId(i)} role="option" aria-label={label} aria-selected={i === current} href={href} className={className} data-active={i === current ? "true" : undefined}
      onMouseEnter={() => setActive(i)} onMouseDown={event => event.preventDefault()} onClick={event => { event.preventDefault(); go(options[i]); }}>{children}</a>;
  };

  return <div className={styles.search}>
    <form className={styles.box} role="search" onSubmit={event => { event.preventDefault(); void submit(); }}>
      <MagnifyingGlass aria-hidden="true" weight="bold" />
      <input
        ref={input} role="combobox" aria-label="Search subjects, topics and past papers" aria-expanded={options.length > 0} aria-controls={`${id}-list`}
        aria-autocomplete="list" aria-activedescendant={options.length ? optionId(current) : undefined}
        type="search" autoComplete="off" spellCheck={false} maxLength={120} value={q} placeholder="Search a subject, topic or paper code"
        onChange={event => { setQ(event.target.value); setActive(0); setOpen(true); }}
        onFocus={() => { setOpen(true); warm(); }} onBlur={() => setOpen(false)}
        onKeyDown={event => {
          if (event.key === "ArrowDown" && options.length) { event.preventDefault(); setActive((current + 1) % options.length); }
          else if (event.key === "ArrowUp" && options.length) { event.preventDefault(); setActive((current - 1 + options.length) % options.length); }
          else if (event.key === "Escape") { setQ(""); setActive(0); setOpen(false); }
        }}
      />
      <button type="submit" className={styles.go}>Search</button>
    </form>
    <div className={styles.popover} hidden={!ready}>
      <div role="listbox" id={`${id}-list`} aria-label="Search results">
        {sections.map(section => <div key={section} role="group" aria-label={section === "paper" ? "Papers" : section === "topic" ? "Topics" : "Subjects"} className={styles.group}>
          <p className={styles.groupLabel} aria-hidden="true">{section === "paper" ? "Papers" : section === "topic" ? "Topics" : "Subjects"}</p>
          {section === "paper" && results!.papers.map(p => <div key={p.id} className={styles.row} data-subject-tone={toneFor(p.bankSlug)}>
            {link(p.href, "paper", styles.rowLink, <><span className={styles.tile}>{p.qualification === "Cambridge IGCSE" ? p.component : `P${p.paper.toUpperCase()}`}</span><span className={styles.main}><strong>{p.title}</strong><small>{p.detail}</small></span><span className={styles.cta}>Open paper</span></>)}
          </div>)}
          {section === "topic" && results!.topics.map(t => { const subject = index!.subjects.find(s => s.bank === t.bank); return <div key={`${t.bank}:${t.label}`} className={styles.row} data-subject-tone={toneFor(t.bank)}>
            {link(t.href, "topic", styles.rowLink, <><span className={styles.tile} aria-hidden="true">#</span><span className={styles.main}><strong>{t.label}</strong><small>{subject?.name ?? ""} · {t.count.toLocaleString("en-US")} questions</small></span><span className={styles.cta}>Practise</span></>)}
          </div>; })}
          {section === "subject" && results!.subjects.map(s => <div key={s.bank} className={`${styles.row} ${styles.subjectRow}`} data-subject-tone={toneFor(s.bank)}>
            <span className={styles.tile} aria-hidden="true">{s.name.split(" ").find(word => /^\d{4}$/.test(word)) ?? (s.name.match(/\b(HL|SL)\b/)?.[0] ?? "IB")}</span>
            <span className={styles.main}><strong>{s.name}</strong><small>{[s.questionCount && `${s.questionCount.toLocaleString("en-US")} questions by topic`, s.paperCount && `${s.paperCount.toLocaleString("en-US")} full papers`].filter(Boolean).join(" · ")}</small></span>
            <span className={styles.pair}>
              {s.practiceHref && link(s.practiceHref, "topics", styles.pairLink, "By topic", `${s.name}: practice by topic`)}
              {s.papersHref && link(s.papersHref, "papers", styles.pairLink, "Full papers", `${s.name}: full past papers`)}
            </span>
          </div>)}
        </div>)}
      </div>
      {ready && waitingForPapers && <p className={styles.empty} role="status">Finding that paper…</p>}
      {ready && paperLike && papersFailed && <p className={styles.empty} role="alert">Couldn&apos;t load past papers. <button type="button" className={styles.retry} onMouseDown={event => event.preventDefault()} onClick={retryPapers}>Try again</button></p>}
      {ready && index && !options.length && !waitingForPapers && !(paperLike && papersFailed) && <p className={styles.empty}>No match. Try a subject, a topic or a code like 0580/42/M/J/24.</p>}
      {ready && !index && <p className={styles.empty}>{failed ? "Search isn't available right now." : "Loading…"}</p>}
    </div>
  </div>;
}
