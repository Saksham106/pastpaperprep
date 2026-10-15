"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { DownloadSimple } from "@phosphor-icons/react/dist/ssr";
import type { BankSlug } from "@/lib/banks";
import { BuilderChoices, type SizeTarget } from "@/components/BuilderChoices";
import { BuilderSheet } from "@/components/BuilderSheet";
import { PaperPreview } from "@/components/PaperPreview";
import { buildTopicIndex, countNodes, knownKeys, selectionMatcher, toggleKey, type BuilderQuestion, type TopicIndex } from "@/lib/builder-topics";
import { parseBuilderState, serializeBuilderState } from "@/lib/builder-url";
import { deriveCourseRoute, matchesCourseRoute, supportsCourseRoute, type CourseRouteSelection } from "@/lib/course-route";
import { paperCalculator } from "@/lib/paper-builder";
import { lowerTarget, reconcileDraft, swapCandidate, type DraftResult, type DraftTarget, type PaperDraftTarget } from "@/lib/paper-draft";
import { trackProductEvent } from "@/lib/product-analytics";
import type { PublicBankIndex } from "@/lib/question-index";
import { exportWorksheetPdf } from "@/lib/worksheet-export";
import { suggestWorksheetTitle } from "@/lib/worksheet-title";
import "./paper-builder.css";

type BuilderBank = { slug: BankSlug; label: string; indexUrl: string };
type Saved = { id: string; revision: number; title: string; ids: string };
type DraftState = { pool: readonly BuilderQuestion[] | null; target: DraftTarget | null; seed: number; manualOrder: boolean; draft: DraftResult };

const EMPTY_DRAFT: DraftResult = { ids: [], totalMarks: 0, exact: true, shortBy: 0 };
const EMPTY_INDEX: TopicIndex = { tree: [], keysById: new Map() };
const ROUTES = [["all", "All papers"], ["core", "Core"], ["extended", "Extended"]] as const;
const randomSeed = () => crypto.getRandomValues(new Uint32Array(1))[0];

export function PaperBuilder({ banks, initialBank, existingTitles = [], exportMarker }: { banks: BuilderBank[]; initialBank?: BankSlug; existingTitles?: string[]; exportMarker?: string }) {
  const startBank = banks.find((item) => item.slug === initialBank) ?? banks[0];
  const [bank, setBank] = useState<BankSlug | "">(startBank?.slug ?? "");
  const [questions, setQuestions] = useState<BuilderQuestion[]>([]);
  const [loading, setLoading] = useState(Boolean(banks.length));
  const [loadError, setLoadError] = useState("");
  const [reload, setReload] = useState(0);
  const [route, setRoute] = useState<CourseRouteSelection>("all");
  const [from, setFrom] = useState<number>();
  const [to, setTo] = useState<number>();
  const [selection, setSelection] = useState<Set<string>>(() => new Set());
  const [pendingKeys, setPendingKeys] = useState<string[] | null>(null);
  const [size, setSize] = useState<SizeTarget>({ kind: "questions", amount: 10 });
  const [paperTargets, setPaperTargets] = useState<PaperDraftTarget[]>([]);
  const [paperMode, setPaperMode] = useState<"questions" | "marks">("questions");
  const [seed, setSeed] = useState(randomSeed);
  const [manualOrder, setManualOrder] = useState(false);
  const [removed, setRemoved] = useState<Set<string>>(() => new Set());
  const [swaps, setSwaps] = useState(0);
  const [title, setTitle] = useState("");
  const [titleEdited, setTitleEdited] = useState(false);
  const [takenTitles, setTakenTitles] = useState(existingTitles);
  const [saved, setSaved] = useState<Saved | null>(null);
  const [busy, setBusy] = useState<"" | "saving" | "exporting">("");
  const [message, setMessage] = useState<{ kind: "error" | "info"; text: string } | null>(null);
  const [reader, setReader] = useState<number | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const readerOpener = useRef<HTMLElement | null>(null);
  const readerRef = useRef<HTMLDivElement>(null);
  const selectedBank = banks.find((item) => item.slug === bank);

  // Restore the choices from a shared or reloaded link once, after hydration.
  useEffect(() => {
    const state = parseBuilderState(new URLSearchParams(window.location.search));
    /* eslint-disable react-hooks/set-state-in-effect -- one-off restore from the URL */
    if (state.bank && state.bank !== startBank?.slug && banks.some((item) => item.slug === state.bank)) {
      setBank(state.bank as BankSlug); setQuestions([]); setLoading(true);
    }
    setRoute(state.route); setFrom(state.from); setTo(state.to);
    if (state.target.kind === "papers") { setPaperTargets(state.target.targets); setPaperMode(state.target.targets[0].mode); } else setSize(state.target);
    if (state.seed !== undefined) setSeed(state.seed);
    if (state.selection.length) setPendingKeys(state.selection);
    setHydrated(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [banks, startBank?.slug]);

  useEffect(() => {
    if (!selectedBank) return;
    const controller = new AbortController();
    fetch(selectedBank.indexUrl, { cache: "force-cache", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Index unavailable");
        return response.json() as Promise<PublicBankIndex>;
      })
      .then((index) => {
        if (index.version !== 1 || index.bank !== selectedBank.slug || !Array.isArray(index.questions)) throw new Error("Index unavailable");
        if (controller.signal.aborted) return;
        setQuestions(index.questions.filter((question) => question.questionImageCount > 0 && Number.isInteger(question.marks) && question.marks! > 0)
          .map((question) => ({ ...question, bankSlug: selectedBank.slug })));
        setLoadError("");
      })
      .catch(() => { if (!controller.signal.aborted) setLoadError("Could not load this bank’s questions."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [selectedBank, reload]);

  const topicIndex = useMemo(() => questions.length && bank ? buildTopicIndex(questions, bank) : EMPTY_INDEX, [questions, bank]);
  if (pendingKeys && topicIndex.tree.length) {
    setSelection(knownKeys(topicIndex.tree, pendingKeys));
    setPendingKeys(null);
  }
  const routed = supportsCourseRoute(bank || undefined);
  const inRoute = (paper: number) => !routed || route === "all" || matchesCourseRoute(deriveCourseRoute(bank as BankSlug, paper), route);
  const basePool = useMemo(() => questions.filter((question) => inRoute(question.paper) && (!from || question.year >= from) && (!to || question.year <= to)),
    // inRoute only reads bank, route and routed, which are listed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [questions, bank, route, routed, from, to]);
  const counts = useMemo(() => countNodes(topicIndex, basePool.map((question) => question.id)), [topicIndex, basePool]);
  const matching = useMemo(() => {
    const match = selectionMatcher(topicIndex, selection);
    return basePool.filter((question) => match(question.id));
  }, [topicIndex, selection, basePool]);
  const pool = useMemo(() => matching.filter((question) => !removed.has(question.id)), [matching, removed]);
  const target = useMemo<DraftTarget>(() => paperTargets.length ? { kind: "papers", targets: paperTargets } : size, [paperTargets, size]);

  // The paper follows the choices: rework it whenever they change, keeping what still fits.
  const [draftState, setDraftState] = useState<DraftState>({ pool: null, target: null, seed, manualOrder, draft: EMPTY_DRAFT });
  let draft = draftState.draft;
  if (questions.length && (draftState.pool !== pool || draftState.target !== target || draftState.seed !== seed || draftState.manualOrder !== manualOrder)) {
    draft = reconcileDraft(draftState.draft.ids, pool, target, seed, manualOrder);
    setDraftState({ pool, target, seed, manualOrder, draft });
  }
  const setIds = (ids: string[]) => setDraftState((current) => ({ ...current, draft: { ...current.draft, ids, totalMarks: ids.reduce((sum, id) => sum + (byId.get(id)?.marks ?? 0), 0) } }));

  const byId = useMemo(() => new Map(questions.map((question) => [question.id, question])), [questions]);
  const sheet = draft.ids.map((id) => byId.get(id)).filter((question): question is BuilderQuestion => Boolean(question));
  const suggestion = useMemo(() => suggestWorksheetTitle(sheet, takenTitles), [sheet, takenTitles]);
  const shownTitle = titleEdited ? title : suggestion;
  const years = useMemo(() => [...new Set(questions.map((question) => question.year))].sort((a, b) => a - b), [questions]);
  const papers = useMemo(() => [...new Set(questions.map((question) => question.paper))].sort((a, b) => a - b).filter(inRoute)
    .map((paper) => ({ paper, available: pool.filter((question) => question.paper === paper).length, calculator: paperCalculator(basePool, paper) })),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [questions, pool, basePool, bank, route, routed]);
  const dirty = Boolean(saved && (saved.title !== shownTitle.trim() || saved.ids !== draft.ids.join(",")));

  // Keep the link shareable: the choices and seed rebuild the same paper.
  useEffect(() => {
    if (!hydrated || pendingKeys) return;
    const query = serializeBuilderState({ bank: bank || undefined, route, from, to, selection: [...selection], target, seed });
    window.history.replaceState(window.history.state, "", `${window.location.pathname}?${query}`);
  }, [hydrated, pendingKeys, bank, route, from, to, selection, target, seed]);

  useEffect(() => {
    if (reader === null) return;
    readerRef.current?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") closeReader(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [reader]);

  function closeReader() {
    setReader(null);
    requestAnimationFrame(() => readerOpener.current?.focus());
  }

  function changeBank(slug: string) {
    const next = banks.find((item) => item.slug === slug);
    if (!next || next.slug === bank) return;
    setBank(next.slug); setQuestions([]); setLoading(true); setLoadError("");
    setRoute("all"); setFrom(undefined); setTo(undefined); setSelection(new Set()); setPendingKeys(null);
    setPaperTargets([]); setRemoved(new Set()); setManualOrder(false); setSeed(randomSeed());
    setTitleEdited(false); setTitle(""); setSaved(null); setMessage(null);
    setDraftState({ pool: null, target: null, seed, manualOrder: false, draft: EMPTY_DRAFT });
  }

  function changeRoute(next: CourseRouteSelection) {
    setRoute(next);
    setPaperTargets((current) => current.filter((item) => next === "all" || matchesCourseRoute(deriveCourseRoute(bank as BankSlug, item.paper), next)));
  }

  function shuffle() {
    setSeed(randomSeed()); setManualOrder(false);
    setDraftState((current) => ({ ...current, draft: EMPTY_DRAFT }));
  }

  function move(id: string, direction: -1 | 1) {
    const ids = [...draft.ids];
    const index = ids.indexOf(id);
    const next = index + direction;
    if (index < 0 || next < 0 || next >= ids.length) return;
    [ids[index], ids[next]] = [ids[next], ids[index]];
    setManualOrder(true);
    setIds(ids);
  }

  function swap(id: string) {
    const replacement = swapCandidate(draft.ids, id, pool, target, (seed + swaps + 1) >>> 0);
    setSwaps((count) => count + 1);
    if (!replacement) return;
    setManualOrder(true);
    setRemoved((current) => new Set(current).add(id));
    setIds(draft.ids.map((item) => item === id ? replacement : item));
  }

  function remove(id: string) {
    const question = byId.get(id);
    if (!question) return;
    const next = lowerTarget(target, question);
    if (next.kind === "papers") {
      if (next.targets.length) setPaperTargets(next.targets);
      else { setPaperTargets([]); setSize({ kind: paperMode, amount: 0 }); }
    } else setSize(next);
    setRemoved((current) => new Set(current).add(id));
    setIds(draft.ids.filter((item) => item !== id));
  }

  async function save() {
    const name = shownTitle.trim();
    if (!bank || !draft.ids.length || busy) return;
    if (!name) { setMessage({ kind: "error", text: "Give your paper a name." }); return; }
    setBusy("saving"); setMessage(null);
    try {
      const response = await fetch(saved ? `/api/worksheets/${encodeURIComponent(saved.id)}` : "/api/worksheets", {
        method: saved ? "PATCH" : "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ bank, name, questionIds: draft.ids, contentMode: "both", ...(saved ? { revision: saved.revision } : {}) }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || typeof payload.worksheet?.id !== "string") throw new Error(typeof payload.error === "string" ? payload.error : "Could not save this paper.");
      setSaved({ id: payload.worksheet.id, revision: Number(payload.worksheet.revision) || 1, title: name, ids: draft.ids.join(",") });
      setTitle(name); setTitleEdited(true);
      setTakenTitles((current) => [...current, name]);
    } catch (reason) {
      setMessage({ kind: "error", text: reason instanceof Error ? reason.message : "Could not save this paper." });
    } finally { setBusy(""); }
  }

  async function download() {
    if (!bank || !sheet.length || busy) return;
    const properties = { bank, questionCount: sheet.length, content: "both", source: "builder" };
    setBusy("exporting"); setMessage({ kind: "info", text: `Preparing ${sheet.length} questions…` });
    trackProductEvent("pdf_export_attempt", properties);
    try {
      const { heldNotice } = await exportWorksheetPdf({ bank, questions: sheet, title: shownTitle.trim() || suggestion, marker: exportMarker,
        onProgress: (complete, total) => setMessage({ kind: "info", text: `Preparing ${complete} of ${total}…` }) });
      trackProductEvent("pdf_export_success", properties);
      setMessage({ kind: "info", text: heldNotice ?? "PDF downloaded." });
    } catch (reason) {
      trackProductEvent("pdf_export_error", properties);
      setMessage({ kind: "error", text: reason instanceof Error ? reason.message : "Could not make the PDF." });
    } finally { setBusy(""); }
  }

  if (!banks.length) return <div className="paper-builder-empty"><h2>Build papers with a plan</h2><p>Paper building requires access to a question bank.</p><a className="button primary" href="/pricing">See plans</a></div>;

  const status = !draft.shortBy || !pool.length ? ""
    : target.kind === "questions" ? `Only ${sheet.length} ${sheet.length === 1 ? "question matches" : "questions match"}`
      : target.kind === "marks" ? `${draft.totalMarks} of ${target.amount} marks — closest possible`
        : "Some paper targets can’t be met with these choices";

  return <div className="builder">
    <div className="builder-bar">
      <label className="builder-bank"><span>Question bank</span><select value={bank} disabled={Boolean(busy)} onChange={(event) => changeBank(event.target.value)}>
        {banks.map((item) => <option key={item.slug} value={item.slug}>{item.label}</option>)}
      </select></label>
      {routed && <div className="builder-segment builder-route" role="group" aria-label="Your Cambridge route">{ROUTES.map(([value, label]) =>
        <button key={value} type="button" aria-pressed={route === value} disabled={Boolean(busy)} onClick={() => changeRoute(value)}>{label}</button>)}</div>}
    </div>
    {loadError && <p className="builder-message is-error" role="alert">{loadError} <button type="button" className="builder-link" onClick={() => { setLoading(true); setReload((count) => count + 1); }}>Retry</button></p>}
    <div className="builder-layout">
      {loading ? <p className="builder-loading" role="status">Loading questions…</p> : <BuilderChoices
        tree={topicIndex.tree} counts={counts} selection={selection} matching={pool.length} disabled={Boolean(busy)}
        onToggle={(key) => setSelection(toggleKey(topicIndex.tree, selection, key))} onClearTopics={() => setSelection(new Set())}
        years={years} from={from} to={to} onYears={(nextFrom, nextTo) => {
          if (nextFrom && nextTo && nextFrom > nextTo) [nextFrom, nextTo] = [nextTo, nextFrom];
          setFrom(nextFrom); setTo(nextTo);
        }}
        size={size} onSize={setSize}
        papers={papers} paperTargets={paperTargets} paperMode={paperMode}
        onPaperTargets={(targets, mode) => { setPaperTargets(targets); setPaperMode(mode); }} />}
      <BuilderSheet
        title={shownTitle} onTitle={(value) => { setTitle(value); setTitleEdited(value.trim() !== ""); }}
        questions={sheet} totalMarks={draft.totalMarks} status={status} busy={Boolean(busy)}
        canSwap={(id) => swapCandidate(draft.ids, id, pool, target, seed) !== null}
        onShuffle={shuffle} onMove={move} onSwap={swap} onRemove={remove}
        onOpen={(index) => { readerOpener.current = document.activeElement as HTMLElement | null; setReader(index); }}
        actions={<>
          {message && <p className={`builder-message is-${message.kind}`} role={message.kind === "error" ? "alert" : "status"}>{message.text}</p>}
          {saved && <a className="builder-saved-link" href={`/banks/${bank}?worksheet=${encodeURIComponent(saved.id)}`}>{dirty ? "Open saved version" : "Saved to My worksheets · Open"}</a>}
          <button type="button" className="button secondary" disabled={Boolean(busy) || !sheet.length} onClick={() => void download()}><DownloadSimple aria-hidden="true" /> {busy === "exporting" ? "Preparing…" : "Download PDF"}</button>
          <button type="button" className="button primary" disabled={Boolean(busy) || !sheet.length || !shownTitle.trim() || (Boolean(saved) && !dirty)} onClick={() => void save()}>
            {busy === "saving" ? "Saving…" : saved ? (dirty ? "Save changes" : "Saved") : "Save PDF"}
          </button>
        </>} />
    </div>
    {sheet.length > 0 && <a className="builder-jump" href="#builder-sheet">View paper · {sheet.length} {sheet.length === 1 ? "question" : "questions"}</a>}
    {reader !== null && bank && sheet.length > 0 && <div className="builder-reader-backdrop" role="presentation" onClick={(event) => { if (event.target === event.currentTarget) closeReader(); }}>
      <div ref={readerRef} className="builder-reader" role="dialog" aria-modal="true" aria-label="Question preview" tabIndex={-1}>
        <PaperPreview bank={bank} questions={sheet} initialIndex={reader} onClose={closeReader} />
      </div>
    </div>}
  </div>;
}
