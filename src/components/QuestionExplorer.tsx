"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowSquareOut, BookmarkSimple, CheckCircle, DownloadSimple, Funnel, MagnifyingGlass, ShareNetwork, TextAlignLeft, X } from "@phosphor-icons/react";
import { downloadQuestionPdf, MAX_PDF_QUESTIONS, questionsForPdf, type PdfContent } from "@/lib/pdf-export";
import { isPreviewQuestion } from "@/lib/access";

import { filterQuestions } from "@/lib/question-filter";
import { EXPLORER_PAGE_SIZE, serializeExplorerState, type ExplorerFilterKey, type ExplorerState } from "@/lib/explorer-state";
import type { QuestionFilters, QuestionSort, UnifiedQuestion } from "@/lib/questions";
import { fetchPdfAssets, fetchSignedAssets, isSignedAssetFresh, signedAssetKey, type SignedAsset } from "@/lib/signed-assets";
import { getSubtopicGroups, getTopicOptions } from "@/lib/taxonomy";

type MultiKey = ExplorerFilterKey;

const SECONDARY_FILTER_KEYS: MultiKey[] = [
  "years", "sessions", "papers", "components", "calculator", "subjects", "courseEras", "options", "zones",
];

function unique(questions: UnifiedQuestion[], value: (question: UnifiedQuestion) => string | string[]): string[] {
  return [...new Set(questions.flatMap((question) => value(question)).filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

export type ExplorerAccess = { authenticated: boolean; bankAccess: boolean; canExportPdf: boolean };
export type ExplorerStudyState = { savedIds: string[]; attemptedIds: string[] };

const DEFAULT_EXPLORER_STATE: ExplorerState = { search: "", sort: "paper", filters: {}, freeOnly: false, savedOnly: false, visible: EXPLORER_PAGE_SIZE };
const EMPTY_STUDY_STATE: ExplorerStudyState = { savedIds: [], attemptedIds: [] };

export function QuestionExplorer({
  questions,
  access,
  exportMarker,
  initialState = DEFAULT_EXPLORER_STATE,
  studyState = EMPTY_STUDY_STATE,
}: {
  questions: UnifiedQuestion[];
  access: ExplorerAccess;
  exportMarker?: string;
  initialState?: ExplorerState;
  studyState?: ExplorerStudyState;
}) {
  const [search, setSearch] = useState(initialState.search);
  const [sort, setSort] = useState<QuestionSort>(initialState.sort);
  const [filters, setFilters] = useState<Pick<QuestionFilters, MultiKey>>(initialState.filters);
  const [visible, setVisible] = useState(initialState.visible);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [freeOnly, setFreeOnly] = useState(initialState.freeOnly);
  const [savedOnly, setSavedOnly] = useState(initialState.savedOnly);
  const [showAllSubtopics, setShowAllSubtopics] = useState(false);
  const [showMoreFilters, setShowMoreFilters] = useState(() => (
    SECONDARY_FILTER_KEYS.some((key) => Boolean(initialState.filters[key]?.length))
  ));
  const [selectedIds, setSelectedIds] = useState(new Set<string>());
  const [selectionIsExplicit, setSelectionIsExplicit] = useState(false);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [pdfContent, setPdfContent] = useState<PdfContent>("both");
  const [pdfStatus, setPdfStatus] = useState("");
  const [signedAssets, setSignedAssets] = useState(new Map<string, SignedAsset>());
  const [failedAssetKeys, setFailedAssetKeys] = useState(new Set<string>());
  const [assetError, setAssetError] = useState("");
  const [assetEpoch, setAssetEpoch] = useState(() => Date.now());
  const [savedIds, setSavedIds] = useState(new Set(studyState.savedIds));
  const [attemptedIds, setAttemptedIds] = useState(new Set(studyState.attemptedIds));
  const [studyError, setStudyError] = useState("");
  const [shareStatus, setShareStatus] = useState("");

  const bank = questions[0]?.bankSlug;
  const isCambridge = bank === "igcse" || bank === "igcse-additional";
  const subtopicGroups = useMemo(
    () => getSubtopicGroups(questions, filters.topics ?? [], filters.subtopics ?? []),
    [questions, filters.topics, filters.subtopics],
  );
  const visibleSubtopics = filters.topics?.length
    ? showAllSubtopics
      ? subtopicGroups.all
      : [...subtopicGroups.relevant, ...subtopicGroups.selectedOutsideContext]
    : subtopicGroups.all;
  const options = useMemo(() => ({
    topics: getTopicOptions(questions),
    years: unique(questions, (q) => String(q.year)).reverse(),
    papers: unique(questions, (q) => String(q.paper)),
    sessions: unique(questions, (q) => q.session),
    subjects: unique(questions, (q) => q.subject),
    zones: unique(questions, (q) => q.zone),
    courseEras: unique(questions, (q) => q.courseEra),
    options: unique(questions, (q) => q.option),
    components: unique(questions, (q) => q.component),
  }), [questions]);

  const filtered = useMemo(() => {
    const matching = filterQuestions(questions, { ...filters, search, sort });
    const accessible = freeOnly ? matching.filter((question) => isPreviewQuestion(question.bankSlug, question.id)) : matching;
    return savedOnly ? accessible.filter((question) => savedIds.has(question.id)) : accessible;
  }, [questions, filters, freeOnly, savedIds, savedOnly, search, sort]);
  const shownQuestions = useMemo(() => filtered.slice(0, visible), [filtered, visible]);
  const activeCount = Object.values(filters).reduce((count, values) => count + (values?.length ?? 0), (freeOnly ? 1 : 0) + (savedOnly ? 1 : 0));
  const questionAssetRequests = useMemo(() => shownQuestions
    .filter((question) => access.bankAccess || isPreviewQuestion(question.bankSlug, question.id))
    .filter((question) => !failedAssetKeys.has(signedAssetKey(question.id, "question")))
    .filter((question) => !isSignedAssetFresh(signedAssets.get(signedAssetKey(question.id, "question")), assetEpoch))
    .map((question) => ({ questionId: question.id, kind: "question" as const })),
  [access.bankAccess, assetEpoch, failedAssetKeys, shownQuestions, signedAssets]);

  useEffect(() => {
    const timer = window.setInterval(() => setAssetEpoch(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const query = serializeExplorerState({ search, sort, filters, freeOnly, savedOnly, visible });
    const nextUrl = `${window.location.pathname}${query.size ? `?${query}` : ""}${window.location.hash}`;
    window.history.replaceState(window.history.state, "", nextUrl);
  }, [filters, freeOnly, savedOnly, search, sort, visible]);

  useEffect(() => {
    if (!bank) return;
    if (!questionAssetRequests.length) return;
    let cancelled = false;
    fetchSignedAssets(bank, questionAssetRequests)
      .then((assets) => {
        if (cancelled) return;
        setSignedAssets((current) => new Map([...current, ...assets]));
        setAssetError("");
      })
      .catch(() => {
        if (cancelled) return;
        setFailedAssetKeys((current) => new Set([...current, ...questionAssetRequests.map((request) => signedAssetKey(request.questionId, request.kind))]));
        setAssetError("Some question images could not load. Try refreshing the page.");
      });
    return () => { cancelled = true; };
  }, [bank, questionAssetRequests]);

  const toggle = (key: MultiKey, value: string) => {
    if (key === "topics") setShowAllSubtopics(false);
    setFilters((current) => {
      const values = (current[key] ?? []) as string[];
      const next = values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
      return { ...current, [key]: next };
    });
    setVisible(EXPLORER_PAGE_SIZE);
  };

  const clearFilters = () => {
    setSearch("");
    setFilters({});
    setFreeOnly(false);
    setSavedOnly(false);
    setShowAllSubtopics(false);
    setVisible(EXPLORER_PAGE_SIZE);
  };

  const shareWorkspace = async () => {
    setShareStatus("");
    try {
      await navigator.clipboard.writeText(window.location.href);
      setShareStatus("Link copied");
    } catch {
      setShareStatus("Could not copy link");
    }
  };

  const updateStudyState = async (questionId: string, action: "save" | "unsave" | "attempt") => {
    if (!bank || !access.authenticated) return;
    const response = await fetch("/api/study-state", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ bank, questionId, action }),
    });
    if (!response.ok) throw new Error("Study progress could not be updated");
  };

  const toggleSaved = async (questionId: string) => {
    const saving = !savedIds.has(questionId);
    setStudyError("");
    try {
      await updateStudyState(questionId, saving ? "save" : "unsave");
      setSavedIds((current) => {
        const next = new Set(current);
        if (saving) next.add(questionId); else next.delete(questionId);
        return next;
      });
    } catch {
      setStudyError("Could not update saved questions. Try again.");
    }
  };

  const recordAttempt = async (questionId: string) => {
    if (attemptedIds.has(questionId)) return;
    try {
      await updateStudyState(questionId, "attempt");
      setAttemptedIds((current) => new Set(current).add(questionId));
    } catch {
      setStudyError("Your answer opened, but progress could not be saved.");
    }
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
    if (!access.canExportPdf || !bank) return;
    setPdfStatus(`Preparing ${exportQuestions.length} questions...`);
    try {
      const assets = await fetchPdfAssets(bank, exportQuestions.map((question) => question.id), pdfContent);
      const securedQuestions = exportQuestions.map((question) => ({
        ...question,
        questionImages: assets.get(signedAssetKey(question.id, "question"))?.urls ?? [],
        markschemeImages: assets.get(signedAssetKey(question.id, "answer"))?.urls ?? [],
      }));
      await downloadQuestionPdf(
        securedQuestions,
        pdfContent,
        (complete, total) => setPdfStatus(`Preparing ${complete} of ${total}...`),
        exportMarker,
      );
      setPdfStatus("Downloaded");
      setPdfOpen(false);
    } catch (error) {
      setPdfStatus(error instanceof Error ? error.message : "PDF export failed. Check your connection and try again.");
    }
  };

  return (
    <section className="explorer" aria-label="Question explorer">
      <div className="explorer-toolbar">
        <label className="search-field">
          <span className="sr-only">Search questions</span>
          <MagnifyingGlass aria-hidden="true" />
          <input value={search} onChange={(event) => { setSearch(event.target.value); setVisible(EXPLORER_PAGE_SIZE); }} placeholder="Search questions, topics, or methods" />
        </label>
        <button className="mobile-filter-button" onClick={() => setFiltersOpen(true)}><Funnel /> Filters {activeCount ? `(${activeCount})` : ""}</button>
        <label className="sort-field">Sort <select value={sort} onChange={(event) => setSort(event.target.value as QuestionSort)}><option value="paper">Newest papers</option><option value="topic">Topic</option><option value="marks-desc">Marks: high to low</option><option value="marks-asc">Marks: low to high</option></select></label>
        <button className="share-view-button toolbar-icon-button" title="Share this view" aria-label="Copy link to this view" onClick={shareWorkspace}><ShareNetwork aria-hidden="true" /></button>
        <button className="download-button toolbar-icon-button" title="Download PDF" aria-label="Download PDF" onClick={() => access.canExportPdf ? setPdfOpen(true) : setPdfStatus("upgrade-required")}><DownloadSimple aria-hidden="true" /></button>
      </div>
      {shareStatus && <p className="toolbar-status" role="status">{shareStatus}</p>}
      {pdfStatus === "upgrade-required" && <div className="access-notice"><span>PDF export is included with All-Access.</span><Link href={access.authenticated ? "/pricing" : "/login?next=/pricing"}>{access.authenticated ? "View pricing" : "Sign in and choose a plan"}</Link></div>}
      {assetError && <div className="access-notice" role="alert">{assetError}</div>}
      {studyError && <div className="access-notice" role="alert">{studyError}</div>}

      <div className="explorer-layout">
        <aside className={`filter-sidebar ${filtersOpen ? "is-open" : ""}`} aria-label="Question filters">
          <div className="filter-sidebar-heading"><strong>Filters</strong><button className="filter-close" aria-label="Close filters" onClick={() => setFiltersOpen(false)}><X /></button></div>
          {!access.bankAccess && <div className="filter-group" role="group" aria-labelledby="filter-access"><h3 id="filter-access">Access</h3><div className="filter-options"><label><input aria-label="Free questions only" type="checkbox" checked={freeOnly} onChange={() => { setFreeOnly((current) => !current); setVisible(EXPLORER_PAGE_SIZE); }} /><span>Free questions only</span></label></div></div>}
          {access.authenticated && <div className="filter-group" role="group" aria-labelledby="filter-study"><h3 id="filter-study">Study</h3><div className="filter-options"><label><input aria-label="Saved questions only" type="checkbox" checked={savedOnly} onChange={() => { setSavedOnly((current) => !current); setVisible(EXPLORER_PAGE_SIZE); }} /><span>Saved questions only</span></label></div></div>}
          <FilterGroup label="Topics" filterKey="topics" values={options.topics} selected={filters.topics ?? []} onToggle={toggle} />
          <FilterGroup label="Subtopics" filterKey="subtopics" values={visibleSubtopics} selected={filters.subtopics ?? []} onToggle={toggle} />
          {!!filters.topics?.length && !!subtopicGroups.other.length && <button className="text-button subtopic-more" aria-expanded={showAllSubtopics} onClick={() => setShowAllSubtopics((show) => !show)}>{showAllSubtopics ? "Hide other subtopics" : "Show other subtopics"}</button>}
          <button className="more-filters-button" type="button" aria-expanded={showMoreFilters} onClick={() => setShowMoreFilters((show) => !show)}><Funnel aria-hidden="true" /> {showMoreFilters ? "Fewer filters" : "More filters"}</button>
          {showMoreFilters && <div className="secondary-filters">
            <FilterGroup label="Years" filterKey="years" values={options.years} selected={filters.years ?? []} onToggle={toggle} />
            <FilterGroup label="Sessions" filterKey="sessions" values={options.sessions} selected={filters.sessions ?? []} onToggle={toggle} />
            <FilterGroup label="Papers" filterKey="papers" values={options.papers} selected={filters.papers ?? []} onToggle={toggle} />
            {isCambridge && <FilterGroup label="Components" filterKey="components" values={options.components} selected={filters.components ?? []} onToggle={toggle} />}
            {isCambridge && <FilterGroup label="Calculator" filterKey="calculator" values={["calculator", "non-calculator"]} selected={filters.calculator ?? []} onToggle={toggle} />}
            {!isCambridge && <FilterGroup label="Course" filterKey="subjects" values={options.subjects} selected={filters.subjects ?? []} onToggle={toggle} />}
            {bank === "ib-hl" && <FilterGroup label="Course era" filterKey="courseEras" values={options.courseEras} selected={filters.courseEras ?? []} onToggle={toggle} />}
            {bank === "ib-hl" && <FilterGroup label="Paper 3 option" filterKey="options" values={options.options} selected={filters.options ?? []} onToggle={toggle} />}
            {!isCambridge && <FilterGroup label="Time zone" filterKey="zones" values={options.zones} selected={filters.zones ?? []} onToggle={toggle} />}
          </div>}
        </aside>

        <div className="explorer-results">
          <div className="results-heading">
            <div><strong>{filtered.length.toLocaleString()} {filtered.length === 1 ? "question" : "questions"}</strong>{selectionIsExplicit && <span>{selectedIds.size} selected for PDF</span>}</div>
            <div>{selectionIsExplicit && <button className="text-button" onClick={() => { setSelectionIsExplicit(false); setSelectedIds(new Set()); }}>Use all results for PDF</button>}{(search || activeCount > 0) && <button className="text-button" onClick={clearFilters}>Clear filters</button>}</div>
          </div>
          {activeCount > 0 && <div className="active-filters">
            {freeOnly && <button aria-label="Remove free questions only filter" onClick={() => setFreeOnly(false)}>Free only <X /></button>}
            {savedOnly && <button aria-label="Remove saved questions only filter" onClick={() => setSavedOnly(false)}>Saved only <X /></button>}
            {Object.entries(filters).flatMap(([key, values]) => (values ?? []).map((value) => <button key={`${key}-${value}`} onClick={() => toggle(key as MultiKey, value)}>{value} <X /></button>))}
          </div>}
          <div className="question-list">
            {shownQuestions.map((question) => {
              const unlocked = access.bankAccess || isPreviewQuestion(question.bankSlug, question.id);
              const questionAsset = signedAssets.get(signedAssetKey(question.id, "question"));
              const answerAsset = signedAssets.get(signedAssetKey(question.id, "answer"));
              return <QuestionCard key={question.id} question={question} unlocked={unlocked} authenticated={access.authenticated} questionAsset={isSignedAssetFresh(questionAsset, assetEpoch) ? questionAsset : undefined} answerAsset={isSignedAssetFresh(answerAsset, assetEpoch) ? answerAsset : undefined} onAnswerAsset={(asset) => setSignedAssets((current) => new Map(current).set(signedAssetKey(question.id, "answer"), asset))} selected={selectedIds.has(question.id)} onSelect={() => toggleQuestion(question.id)} saved={savedIds.has(question.id)} attempted={attemptedIds.has(question.id)} onToggleSaved={() => toggleSaved(question.id)} onAttempt={() => recordAttempt(question.id)} />;
            })}
          </div>
          {filtered.length === 0 && <div className="empty-state"><strong>No questions match that combination.</strong><span>Clear a filter and try again.</span></div>}
          {visible < filtered.length && <button className="load-more" onClick={() => setVisible((count) => count + EXPLORER_PAGE_SIZE)}>Show 24 more questions</button>}
        </div>
      </div>

      {pdfOpen && <div className="pdf-backdrop" role="presentation"><section className="pdf-dialog" role="dialog" aria-modal="true" aria-labelledby="pdf-title"><button className="pdf-close" aria-label="Close PDF options" onClick={() => setPdfOpen(false)}><X /></button><p className="eyebrow">Worksheet builder</p><h2 id="pdf-title">Download {exportQuestions.length.toLocaleString()} questions</h2><p>{selectionIsExplicit ? "Using your selected questions, including selections outside the current filters." : filtered.length > MAX_PDF_QUESTIONS ? `Worksheets are limited to ${MAX_PDF_QUESTIONS} questions. Narrow your filters or make a selection for a different set.` : "No manual selection yet, so this uses every current result."}</p><div className="pdf-options">{(["questions", "answers", "both"] as PdfContent[]).map((value) => <label key={value}><input type="radio" name="pdf-content" checked={pdfContent === value} onChange={() => setPdfContent(value)} /> {value === "both" ? "Questions and answers" : value[0].toUpperCase() + value.slice(1)}</label>)}</div><button className="download-button pdf-download" disabled={!exportQuestions.length} onClick={handleDownload}><DownloadSimple /> Build PDF</button>{pdfStatus && <small>{pdfStatus}</small>}</section></div>}
    </section>
  );
}

function FilterGroup({ label, filterKey, values, selected, onToggle }: { label: string; filterKey: MultiKey; values: string[]; selected: string[]; onToggle: (key: MultiKey, value: string) => void }) {
  if (!values.length) return null;
  const headingId = `filter-${filterKey}`;
  return <div className="filter-group" role="group" aria-labelledby={headingId}><h3 id={headingId}>{label}</h3><div className="filter-options">{values.map((value) => <label key={value}><input aria-label={`${label}: ${value}`} type="checkbox" checked={selected.includes(value)} onChange={() => onToggle(filterKey, value)} /><span>{value.replace("non-calculator", "Non-calculator").replace("calculator", "Calculator")}</span></label>)}</div></div>;
}

function QuestionCard({ question, unlocked, authenticated, questionAsset, answerAsset, onAnswerAsset, selected, onSelect, saved, attempted, onToggleSaved, onAttempt }: {
  question: UnifiedQuestion;
  unlocked: boolean;
  authenticated: boolean;
  questionAsset?: SignedAsset;
  answerAsset?: SignedAsset;
  onAnswerAsset: (asset: SignedAsset) => void;
  selected: boolean;
  onSelect: () => void;
  saved: boolean;
  attempted: boolean;
  onToggleSaved: () => void;
  onAttempt: () => void;
}) {
  const [answerOpen, setAnswerOpen] = useState(false);
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [solutionOpen, setSolutionOpen] = useState(false);
  const [answerLoading, setAnswerLoading] = useState(false);
  const [answerError, setAnswerError] = useState("");

  const toggleAnswer = async () => {
    if (answerOpen) { setAnswerOpen(false); return; }
    if (question.markschemeImageCount > 0 && !answerAsset) {
      setAnswerLoading(true);
      setAnswerError("");
      try {
        const assets = await fetchSignedAssets(question.bankSlug, [{ questionId: question.id, kind: "answer" }]);
        const asset = assets.get(signedAssetKey(question.id, "answer"));
        if (!asset) throw new Error("Missing answer asset");
        onAnswerAsset(asset);
      } catch {
        setAnswerError("The answer could not load. Try again.");
        setAnswerLoading(false);
        return;
      }
      setAnswerLoading(false);
    }
    setAnswerOpen(true);
    if (authenticated) void onAttempt();
  };

  return (
    <article className="question-card">
      <header className="question-card-header"><div className="question-meta"><span>{question.year} {question.session}</span><span>Paper {question.paper}</span><span>Question {question.number}</span>{question.component && <span>Component {question.component}</span>}{question.zone && <span>{question.zone}</span>}{question.marks !== null && <span>{question.marks} {question.marks === 1 ? "mark" : "marks"}</span>}</div>{unlocked && <label className="pdf-select"><input aria-label={`Add question ${question.number} to PDF`} type="checkbox" checked={selected} onChange={onSelect} /> Add to PDF</label>}</header>
      <div className="question-topic"><strong>{question.primaryTopic}</strong>{question.subtopics.slice(0, 4).map((topic) => <span key={topic}>{topic}</span>)}</div>
      {unlocked ? <div className="question-images">{questionAsset ? questionAsset.urls.map((source, index) => <Image unoptimized width={1400} height={1000} key={source} src={source} alt={`Original question ${question.number}${questionAsset.urls.length > 1 ? ` page ${index + 1}` : ""}`} />) : <div className="asset-placeholder">Loading question image...</div>}</div> : <div className="question-locked"><strong>All-Access question</strong><span>Unlock the full question, answer, and PDF export.</span><Link href={authenticated ? "/pricing" : "/login?next=/pricing"}>{authenticated ? "View pricing" : "Sign in and choose a plan"}</Link></div>}
      <div className="question-actions">
        <div className="question-action-buttons">{unlocked ? ((question.solution || question.markschemeImageCount > 0) ? <button className="answer-toggle" disabled={answerLoading} aria-expanded={answerOpen} onClick={toggleAnswer}>{answerLoading ? "Loading answer..." : answerOpen ? "Hide answer" : "Show answer"}</button> : <span className="muted">Answer coming soon</span>) : null}{answerError && <span className="muted" role="alert">{answerError}</span>}</div>
        <div className="source-links">{attempted && <span className="study-state"><CheckCircle weight="fill" /> Practised</span>}{authenticated && unlocked && <button className={`study-icon-button ${saved ? "is-saved" : ""}`} title={saved ? "Remove from saved" : "Save question"} aria-label={saved ? `Remove question from saved ${question.id}` : `Save question ${question.id}`} onClick={onToggleSaved}><BookmarkSimple weight={saved ? "fill" : "regular"} aria-hidden="true" /></button>}{question.sourceQuestionUrl && <a href={question.sourceQuestionUrl} target="_blank" rel="noreferrer">Source paper <ArrowSquareOut /></a>}{question.sourceMarkSchemeUrl && <a href={question.sourceMarkSchemeUrl} target="_blank" rel="noreferrer">Mark scheme <ArrowSquareOut /></a>}{question.accessibleText && <button className="transcript-icon-button" title={transcriptOpen ? "Hide transcript" : "Show transcript"} aria-label={transcriptOpen ? "Hide transcript" : "Show transcript"} aria-expanded={transcriptOpen} onClick={() => setTranscriptOpen((open) => !open)}><TextAlignLeft aria-hidden="true" /></button>}</div>
      </div>
      {answerOpen && <div className="answer-panel">{answerAsset?.urls.map((source, index) => <Image unoptimized width={1400} height={1000} key={source} src={source} alt={`Official mark scheme page ${index + 1}`} />)}{question.solution && (answerAsset?.urls.length ? <div className="solution-wrap"><button className="text-button" aria-expanded={solutionOpen} onClick={() => setSolutionOpen((open) => !open)}>{solutionOpen ? "Hide worked text" : "Show worked text"}</button>{solutionOpen && <p>{question.solution}</p>}</div> : <p>{question.solution}</p>)}</div>}
      {transcriptOpen && <div className="transcript-panel"><strong>Searchable transcript may contain extraction errors.</strong><p>{question.accessibleText}</p></div>}
    </article>
  );
}