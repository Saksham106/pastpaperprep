"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { ArrowSquareOut, DownloadSimple, Funnel, MagnifyingGlass, X } from "@phosphor-icons/react";
import { downloadQuestionPdf, questionsForPdf, type PdfContent } from "@/lib/pdf-export";
import { filterQuestions, type QuestionFilters, type QuestionSort, type UnifiedQuestion } from "@/lib/questions";

const PAGE_SIZE = 24;
type MultiKey = "topics" | "subtopics" | "years" | "papers" | "sessions" | "subjects" | "zones" | "courseEras" | "options" | "components" | "calculator";

function unique(questions: UnifiedQuestion[], value: (question: UnifiedQuestion) => string | string[]): string[] {
  return [...new Set(questions.flatMap((question) => value(question)).filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

export function QuestionExplorer({ questions }: { questions: UnifiedQuestion[] }) {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<QuestionSort>("paper");
  const [filters, setFilters] = useState<Pick<QuestionFilters, MultiKey>>({});
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [showAllSubtopics, setShowAllSubtopics] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set<string>());
  const [selectionIsExplicit, setSelectionIsExplicit] = useState(false);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [pdfContent, setPdfContent] = useState<PdfContent>("both");
  const [pdfStatus, setPdfStatus] = useState("");

  const bank = questions[0]?.bankSlug;
  const topicFiltered = useMemo(() => filterQuestions(questions, { topics: filters.topics }), [questions, filters.topics]);
  const options = useMemo(() => ({
    topics: unique(questions, (q) => [q.primaryTopic, ...q.secondaryTopics]),
    subtopics: unique(topicFiltered, (q) => q.subtopics),
    years: unique(questions, (q) => String(q.year)).reverse(),
    papers: unique(questions, (q) => String(q.paper)),
    sessions: unique(questions, (q) => q.session),
    subjects: unique(questions, (q) => q.subject),
    zones: unique(questions, (q) => q.zone),
    courseEras: unique(questions, (q) => q.courseEra),
    options: unique(questions, (q) => q.option),
    components: unique(questions, (q) => q.component),
  }), [questions, topicFiltered]);

  const filtered = useMemo(() => filterQuestions(questions, { ...filters, search, sort }), [questions, filters, search, sort]);
  const activeCount = Object.values(filters).reduce((count, values) => count + (values?.length ?? 0), 0);

  const toggle = (key: MultiKey, value: string) => {
    setFilters((current) => {
      const values = (current[key] ?? []) as string[];
      const next = values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
      return { ...current, [key]: next };
    });
    setVisible(PAGE_SIZE);
  };

  const clearFilters = () => {
    setSearch("");
    setFilters({});
    setVisible(PAGE_SIZE);
  };

  const toggleQuestion = (id: string) => {
    setSelectionIsExplicit(true);
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const exportQuestions = questionsForPdf(filtered, selectedIds, selectionIsExplicit, questions);
  const handleDownload = async () => {
    setPdfStatus(`Preparing ${exportQuestions.length} questions...`);
    try {
      await downloadQuestionPdf(exportQuestions, pdfContent, (complete, total) => setPdfStatus(`Preparing ${complete} of ${total}...`));
      setPdfStatus("Downloaded");
      setPdfOpen(false);
    } catch {
      setPdfStatus("PDF export failed. Check your connection and try again.");
    }
  };

  return (
    <section className="explorer" aria-label="Question explorer">
      <div className="explorer-toolbar">
        <label className="search-field">
          <span className="sr-only">Search questions</span>
          <MagnifyingGlass aria-hidden="true" />
          <input value={search} onChange={(event) => { setSearch(event.target.value); setVisible(PAGE_SIZE); }} placeholder="Search questions, topics, or methods" />
        </label>
        <button className="mobile-filter-button" onClick={() => setFiltersOpen(true)}><Funnel /> Filters {activeCount ? `(${activeCount})` : ""}</button>
        <label className="sort-field">Sort <select value={sort} onChange={(event) => setSort(event.target.value as QuestionSort)}><option value="paper">Newest papers</option><option value="topic">Topic</option><option value="marks-desc">Marks: high to low</option><option value="marks-asc">Marks: low to high</option></select></label>
        <button className="download-button" onClick={() => setPdfOpen(true)}><DownloadSimple /> Download PDF</button>
      </div>

      <div className="explorer-layout">
        <aside className={`filter-sidebar ${filtersOpen ? "is-open" : ""}`} aria-label="Question filters">
          <div className="filter-sidebar-heading"><strong>Filters</strong><button className="filter-close" aria-label="Close filters" onClick={() => setFiltersOpen(false)}><X /></button></div>
          <FilterGroup label="Topics" filterKey="topics" values={options.topics} selected={filters.topics ?? []} onToggle={toggle} />
          <FilterGroup label="Subtopics" filterKey="subtopics" values={showAllSubtopics ? options.subtopics : options.subtopics.slice(0, 18)} selected={filters.subtopics ?? []} onToggle={toggle} />
          {options.subtopics.length > 18 && <button className="text-button subtopic-more" onClick={() => setShowAllSubtopics((show) => !show)}>{showAllSubtopics ? "Show fewer subtopics" : `Show ${options.subtopics.length - 18} other subtopics`}</button>}
          <FilterGroup label="Years" filterKey="years" values={options.years} selected={filters.years ?? []} onToggle={toggle} />
          <FilterGroup label="Sessions" filterKey="sessions" values={options.sessions} selected={filters.sessions ?? []} onToggle={toggle} />
          <FilterGroup label="Papers" filterKey="papers" values={options.papers} selected={filters.papers ?? []} onToggle={toggle} />
          {bank === "igcse" && <FilterGroup label="Components" filterKey="components" values={options.components} selected={filters.components ?? []} onToggle={toggle} />}
          {bank === "igcse" && <FilterGroup label="Calculator" filterKey="calculator" values={["calculator", "non-calculator"]} selected={filters.calculator ?? []} onToggle={toggle} />}
          {bank !== "igcse" && <FilterGroup label="Course" filterKey="subjects" values={options.subjects} selected={filters.subjects ?? []} onToggle={toggle} />}
          {bank === "ib-hl" && <FilterGroup label="Course era" filterKey="courseEras" values={options.courseEras} selected={filters.courseEras ?? []} onToggle={toggle} />}
          {bank === "ib-hl" && <FilterGroup label="Paper 3 option" filterKey="options" values={options.options} selected={filters.options ?? []} onToggle={toggle} />}
          {bank !== "igcse" && <FilterGroup label="Timezone" filterKey="zones" values={options.zones} selected={filters.zones ?? []} onToggle={toggle} />}
        </aside>

        <div className="explorer-results">
          <div className="results-heading">
            <div><strong>{filtered.length.toLocaleString()} {filtered.length === 1 ? "question" : "questions"}</strong>{selectionIsExplicit && <span>{selectedIds.size} selected for PDF</span>}</div>
            <div>{selectionIsExplicit && <button className="text-button" onClick={() => { setSelectionIsExplicit(false); setSelectedIds(new Set()); }}>Use all results for PDF</button>}{(search || activeCount > 0) && <button className="text-button" onClick={clearFilters}>Clear filters</button>}</div>
          </div>
          {activeCount > 0 && <div className="active-filters">{Object.entries(filters).flatMap(([key, values]) => (values ?? []).map((value) => <button key={`${key}-${value}`} onClick={() => toggle(key as MultiKey, value)}>{value} <X /></button>))}</div>}
          <div className="question-list">
            {filtered.slice(0, visible).map((question) => <QuestionCard key={question.id} question={question} selected={selectedIds.has(question.id)} onSelect={() => toggleQuestion(question.id)} />)}
          </div>
          {filtered.length === 0 && <div className="empty-state"><strong>No questions match that combination.</strong><span>Clear a filter and try again.</span></div>}
          {visible < filtered.length && <button className="load-more" onClick={() => setVisible((count) => count + PAGE_SIZE)}>Show 24 more questions</button>}
        </div>
      </div>

      {pdfOpen && <div className="pdf-backdrop" role="presentation"><section className="pdf-dialog" role="dialog" aria-modal="true" aria-labelledby="pdf-title"><button className="pdf-close" aria-label="Close PDF options" onClick={() => setPdfOpen(false)}><X /></button><p className="eyebrow">Worksheet builder</p><h2 id="pdf-title">Download {exportQuestions.length.toLocaleString()} questions</h2><p>{selectionIsExplicit ? "Using your selected questions, including selections outside the current filters." : "No manual selection yet, so this uses every current result."}</p><div className="pdf-options">{(["questions", "answers", "both"] as PdfContent[]).map((value) => <label key={value}><input type="radio" name="pdf-content" checked={pdfContent === value} onChange={() => setPdfContent(value)} /> {value === "both" ? "Questions and answers" : value[0].toUpperCase() + value.slice(1)}</label>)}</div><button className="download-button pdf-download" disabled={!exportQuestions.length} onClick={handleDownload}><DownloadSimple /> Build PDF</button>{pdfStatus && <small>{pdfStatus}</small>}</section></div>}
    </section>
  );
}

function FilterGroup({ label, filterKey, values, selected, onToggle }: { label: string; filterKey: MultiKey; values: string[]; selected: string[]; onToggle: (key: MultiKey, value: string) => void }) {
  if (!values.length) return null;
  return <fieldset className="filter-group" aria-label={label}><legend>{label}</legend>{values.map((value) => <label key={value}><input aria-label={`${label}: ${value}`} type="checkbox" checked={selected.includes(value)} onChange={() => onToggle(filterKey, value)} /><span>{value.replace("non-calculator", "Non-calculator").replace("calculator", "Calculator")}</span></label>)}</fieldset>;
}

function QuestionCard({ question, selected, onSelect }: { question: UnifiedQuestion; selected: boolean; onSelect: () => void }) {
  const [answerOpen, setAnswerOpen] = useState(false);
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [solutionOpen, setSolutionOpen] = useState(false);
  return (
    <article className="question-card">
      <header className="question-card-header"><div className="question-meta"><span>{question.year} {question.session}</span><span>Paper {question.paper}</span><span>Question {question.number}</span>{question.component && <span>Component {question.component}</span>}{question.zone && <span>{question.zone}</span>}{question.marks !== null && <span>{question.marks} {question.marks === 1 ? "mark" : "marks"}</span>}</div><label className="pdf-select"><input aria-label={`Add question ${question.number} to PDF`} type="checkbox" checked={selected} onChange={onSelect} /> Add to PDF</label></header>
      <div className="question-topic"><strong>{question.primaryTopic}</strong>{question.subtopics.slice(0, 4).map((topic) => <span key={topic}>{topic}</span>)}</div>
      <div className="question-images">{question.questionImages.map((source, index) => <Image unoptimized width={1400} height={1000} key={source} src={source} alt={`Original question ${question.number}${question.questionImages.length > 1 ? ` page ${index + 1}` : ""}`} />)}</div>
      {question.accessibleText && <div className="transcript-wrap"><button className="text-button transcript-toggle" aria-expanded={transcriptOpen} onClick={() => setTranscriptOpen((open) => !open)}>{transcriptOpen ? "Hide transcript" : "Show transcript"}</button>{transcriptOpen && <div className="transcript-panel"><strong>Searchable transcript may contain extraction errors.</strong><p>{question.accessibleText}</p></div>}</div>}
      <div className="question-actions">
        {(question.solution || question.markschemeImages.length > 0) ? <div className="answer-wrap"><button className="answer-toggle" aria-expanded={answerOpen} onClick={() => setAnswerOpen((open) => !open)}>{answerOpen ? "Hide answer" : "Show answer"}</button>{answerOpen && <div className="answer-panel">{question.markschemeImages.map((source, index) => <Image unoptimized width={1400} height={1000} key={source} src={source} alt={`Official mark scheme page ${index + 1}`} />)}{question.solution && (question.markschemeImages.length ? <div className="solution-wrap"><button className="text-button" aria-expanded={solutionOpen} onClick={() => setSolutionOpen((open) => !open)}>{solutionOpen ? "Hide worked text" : "Show worked text"}</button>{solutionOpen && <p>{question.solution}</p>}</div> : <p>{question.solution}</p>)}</div>}</div> : <span className="muted">Answer coming soon</span>}
        <div className="source-links">{question.sourceQuestionUrl && <a href={question.sourceQuestionUrl} target="_blank" rel="noreferrer">Source paper <ArrowSquareOut /></a>}{question.sourceMarkSchemeUrl && <a href={question.sourceMarkSchemeUrl} target="_blank" rel="noreferrer">Mark scheme <ArrowSquareOut /></a>}</div>
      </div>
    </article>
  );
}