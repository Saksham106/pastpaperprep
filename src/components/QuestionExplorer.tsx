"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { BookmarkSimple, CaretDown, Check, CheckCircle, DownloadSimple, Funnel, MagnifyingGlass, ShareNetwork, X } from "@phosphor-icons/react";
import { downloadQuestionPdf, MAX_PDF_QUESTIONS, questionsForPdf, type PdfContent } from "@/lib/pdf-export";
import { isPreviewQuestion } from "@/lib/access";

import { filterQuestions, questionZoneValue } from "@/lib/question-filter";
import { EXPLORER_PAGE_SIZE, parseExplorerState, serializeExplorerState, type ExplorerFilterKey, type ExplorerSearchParams, type ExplorerState } from "@/lib/explorer-state";
import type { QuestionFilters, QuestionSort, UnifiedQuestion } from "@/lib/questions";
import type { BankSlug } from "@/lib/banks";
import { fetchPdfAssets, fetchSignedAssets, isSignedAssetFresh, signedAssetKey, type SignedAsset } from "@/lib/signed-assets";
import { pulseSuccess, shakeElement } from "@/lib/button-feedback";
import { mergeQuestionRichDetails, publicMetadataToQuestion, type PublicBankIndex } from "@/lib/question-index";
import { matchesCourseRoute, supportsCourseRoute, type CourseRouteSelection } from "@/lib/course-route";
import { getSubtopicGroups, getTopicOptions } from "@/lib/taxonomy-router";
import { formatPublicLabel } from "@/lib/presentation";
import { trackProductEvent } from "@/lib/product-analytics";
import { getFreeQuestionGate } from "@/lib/free-question-gate";
import { FreeQuestionSignupGate } from "@/components/FreeQuestionSignupGate";
import { WorksheetEditCard } from "@/components/WorksheetEditCard";
import "./worksheet-workspace.css";

type MultiKey = ExplorerFilterKey;

const SECONDARY_FILTER_KEYS: MultiKey[] = [
  "years", "sessions", "papers", "components", "calculator", "subjects", "courseEras", "options", "zones", "granularLabels", "officialCodeRefs", "retrievalFacets",
];

const SORT_OPTIONS: readonly { value: QuestionSort; label: string }[] = [
  { value: "paper", label: "Newest papers" },
  { value: "topic", label: "Topic" },
  { value: "marks-desc", label: "Marks: high to low" },
  { value: "marks-asc", label: "Marks: low to high" },
];

/**
 * The default sort is also the one the URL omits, so it is the only state the reader has not
 * chosen. Its trigger stays the compact "Sort" label instead of spelling out "Newest papers";
 * once any option is chosen the trigger names that choice. `aria-label` always announces the
 * real sort, so the accessible name stays more precise than the visible label.
 */
const DEFAULT_SORT: QuestionSort = "paper";

function SortSelector({ value, onChange }: { value: QuestionSort; onChange: (value: QuestionSort) => void }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef(new Map<QuestionSort, HTMLButtonElement>());
  const listboxId = useId();
  const labelId = useId();
  const selected = SORT_OPTIONS.find((option) => option.value === value) ?? SORT_OPTIONS[0];
  const isDefaultSort = value === DEFAULT_SORT;

  useEffect(() => {
    if (!open) return;
    optionRefs.current.get(value)?.focus();
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open, value]);

  const choose = (next: QuestionSort) => {
    onChange(next);
    setOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  };

  const onOptionKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      choose(SORT_OPTIONS[index].value);
      return;
    }
    const nextIndex = event.key === "Home"
      ? 0
      : event.key === "End"
        ? SORT_OPTIONS.length - 1
        : event.key === "ArrowDown"
          ? (index + 1) % SORT_OPTIONS.length
          : event.key === "ArrowUp"
            ? (index - 1 + SORT_OPTIONS.length) % SORT_OPTIONS.length
            : null;
    if (nextIndex !== null) {
      event.preventDefault();
      optionRefs.current.get(SORT_OPTIONS[nextIndex].value)?.focus();
    }
  };

  return (
    <div className="sort-field" ref={rootRef}>
      <span className="sr-only" id={labelId}>Sort questions</span>
      <button
        ref={triggerRef}
        className="sort-select-trigger"
        type="button"
        aria-label={`Sort questions: ${selected.label}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        <span>{isDefaultSort ? "Sort" : <><small>Sort</small>{selected.label}</>}</span>
        <CaretDown aria-hidden="true" weight="bold" />
      </button>
      {open && (
        <div className="sort-select-menu" id={listboxId} role="listbox" aria-labelledby={labelId}>
          {SORT_OPTIONS.map((option, index) => (
            <button
              key={option.value}
              ref={(element) => { if (element) optionRefs.current.set(option.value, element); else optionRefs.current.delete(option.value); }}
              className="sort-select-option"
              type="button"
              role="option"
              aria-selected={option.value === value}
              onClick={() => choose(option.value)}
              onKeyDown={(event) => onOptionKeyDown(event, index)}
            >
              <span>{option.label}</span>
              {option.value === value && <Check aria-hidden="true" weight="bold" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function unique(questions: UnifiedQuestion[], value: (question: UnifiedQuestion) => string | string[]): string[] {
  // One collator instance is reused across every sort pass; a fresh Intl.Collator per
  // comparison (what localeCompare builds internally) dominated the filter-option work.
  const collator = new Intl.Collator(undefined, { numeric: true });
  return [...new Set(questions.flatMap((question) => value(question)).filter(Boolean))].sort((a, b) => collator.compare(a, b));
}

export type ExplorerAccess = { authenticated: boolean; bankAccess: boolean; canExportPdf: boolean };
export type ExplorerStudyState = { savedIds: string[]; attemptedIds: string[] };

const DEFAULT_EXPLORER_STATE: ExplorerState = { search: "", sort: DEFAULT_SORT, filters: {}, freeOnly: false, savedOnly: false, courseRoute: "all", visible: EXPLORER_PAGE_SIZE };
/** Re-sign assets whose URLs die within this window; the server grants 600s TTL. */
const SIGN_REFRESH_MARGIN_MS = 90_000;
const EMPTY_STUDY_STATE: ExplorerStudyState = { savedIds: [], attemptedIds: [] };

/**
 * Every free/paid upsell in the explorer resolves to exactly one next action with one
 * label. Three competing calls to action (preview the full bank, view plans, sign in and
 * choose a plan) made the free funnel ambiguous; the free-only toggle it replaced still
 * lives in the Filters panel as "Free questions only".
 */
const PLANS_LABEL = "View plans";
const plansHrefFor = (authenticated: boolean) => (authenticated ? "/pricing" : "/login?next=/pricing");

export function QuestionExplorer({
  questions,
  bankSlug,
  localPreview = false,
  indexUrl,
  access,
  exportMarker,
  initialState = DEFAULT_EXPLORER_STATE,
  studyState = EMPTY_STUDY_STATE,
  bootstrapUrl,
  hydrateFromLocation = false,
}: {
questions: UnifiedQuestion[];
bankSlug?: BankSlug;
localPreview?: boolean;
indexUrl?: string;
access: ExplorerAccess;
  exportMarker?: string;
  initialState?: ExplorerState;
  studyState?: ExplorerStudyState;
  bootstrapUrl?: string;
  hydrateFromLocation?: boolean;
}) {
  const [search, setSearch] = useState(initialState.search);
  const [catalogQuestions, setCatalogQuestions] = useState(questions);
  const [indexError, setIndexError] = useState("");
  const [indexAttempt, setIndexAttempt] = useState(0);
  const [indexLoaded, setIndexLoaded] = useState(!indexUrl);
  const [searchResult, setSearchResult] = useState<{ query: string; ids: Set<string> } | null>(null);
  const [sort, setSort] = useState<QuestionSort>(initialState.sort);
  const [filters, setFilters] = useState<Pick<QuestionFilters, MultiKey>>(initialState.filters);
  const [visible, setVisible] = useState(initialState.visible);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [freeOnly, setFreeOnly] = useState(initialState.freeOnly);
  const [savedOnly, setSavedOnly] = useState(initialState.savedOnly);
  const [courseRoute, setCourseRoute] = useState<CourseRouteSelection>(initialState.courseRoute);
  const [showAllSubtopics, setShowAllSubtopics] = useState(false);
  const [showMoreFilters, setShowMoreFilters] = useState(() => (
    SECONDARY_FILTER_KEYS.some((key) => Boolean(initialState.filters[key]?.length))
  ));
  const [selectedIds, setSelectedIds] = useState(new Set<string>());
  const [selectionIsExplicit, setSelectionIsExplicit] = useState(false);
  const [worksheetId] = useState(() => typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("worksheet") ?? "");
  const [worksheetRevision, setWorksheetRevision] = useState(0);
  const [worksheetMode, setWorksheetMode] = useState<"view" | "edit">(() => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("mode") === "edit" ? "edit" : "view");
  const [addingQuestions, setAddingQuestions] = useState(false);
  const [worksheetName, setWorksheetName] = useState("");
  const [worksheetStatus, setWorksheetStatus] = useState("");
  const [worksheetSaving, setWorksheetSaving] = useState(false);
  const [savedWorksheetLink, setSavedWorksheetLink] = useState("");
  const worksheetSavingRef = useRef(false);
  const [worksheetLoadFailed, setWorksheetLoadFailed] = useState(false);
  const [worksheetLoading, setWorksheetLoading] = useState(false);
  const [worksheetBaseline, setWorksheetBaseline] = useState("");
  const [worksheetReady, setWorksheetReady] = useState(() => typeof window === "undefined" || !new URLSearchParams(window.location.search).has("worksheet"));
  const [pdfOpen, setPdfOpen] = useState(false);
  const [pdfUpgradeOpen, setPdfUpgradeOpen] = useState(false);
  const [pdfContent, setPdfContent] = useState<PdfContent>("both");
  const [pdfStatus, setPdfStatus] = useState("");
  const [pdfStatusKind, setPdfStatusKind] = useState<"progress" | "success" | "error">("progress");
  const shareButtonRef = useRef<HTMLButtonElement>(null);
  const [signedAssets, setSignedAssets] = useState(new Map<string, SignedAsset>());
  const signingAssetKeysRef = useRef(new Set<string>());
  const [failedAssetKeys, setFailedAssetKeys] = useState(new Set<string>());
  const [assetError, setAssetError] = useState("");
  const [assetEpoch, setAssetEpoch] = useState(() => Date.now());
  const [savedIds, setSavedIds] = useState(new Set(studyState.savedIds));
  const [attemptedIds, setAttemptedIds] = useState(new Set(studyState.attemptedIds));
  const [studyError, setStudyError] = useState("");
  const [shareStatus, setShareStatus] = useState("");
  const [resolvedAccess, setResolvedAccess] = useState(access);
  const [resolvedExportMarker, setResolvedExportMarker] = useState(exportMarker);
  const [locationHydrated, setLocationHydrated] = useState(!hydrateFromLocation);
  const [bootstrapPending, setBootstrapPending] = useState(Boolean(bootstrapUrl));
  const filterTriggerRef = useRef<HTMLButtonElement>(null);
  const filterDialogRef = useRef<HTMLElement>(null);
  const pdfTriggerRef = useRef<HTMLButtonElement>(null);
  const pdfBuildButtonRef = useRef<HTMLButtonElement>(null);
  const pdfStatusRef = useRef<HTMLElement>(null);
  const pdfDialogRef = useRef<HTMLElement>(null);
  const pdfUpgradeDialogRef = useRef<HTMLElement>(null);
  const explorerRootRef = useRef<HTMLElement>(null);

  const bank = bankSlug ?? questions[0]?.bankSlug;
  const routeSupported = supportsCourseRoute(bank);
  const effectiveCourseRoute: CourseRouteSelection = routeSupported ? courseRoute : "all";
  const isCambridge = bank === "igcse" || bank === "igcse-additional";
  const plansHref = plansHrefFor(resolvedAccess.authenticated);
  // Static bank pages start with anonymous-safe data. Keep that provisional free filter
  // out of the visible workspace until the member bootstrap resolves, and never apply it
  // to an entitled account (including manual/complimentary entitlements).
  const effectiveFreeOnly = freeOnly && !bootstrapPending && !resolvedAccess.bankAccess;
  const subtopicGroups = useMemo(
    () => getSubtopicGroups(catalogQuestions, filters.topics ?? [], filters.subtopics ?? []),
    [catalogQuestions, filters.topics, filters.subtopics],
  );
  const visibleSubtopics = filters.topics?.length
    ? showAllSubtopics
      ? subtopicGroups.all
      : [...subtopicGroups.relevant, ...subtopicGroups.selectedOutsideContext]
    : subtopicGroups.all;
  const routeScopedQuestions = useMemo(
    () => catalogQuestions.filter((question) => matchesCourseRoute(question.syllabusRoute, effectiveCourseRoute)),
    [catalogQuestions, effectiveCourseRoute],
  );
  const options = useMemo(() => ({
    topics: getTopicOptions(catalogQuestions),
    years: unique(catalogQuestions, (q) => String(q.year)).reverse(),
    papers: unique(routeScopedQuestions, (q) => String(q.paper)),
    sessions: unique(catalogQuestions, (q) => q.session),
    subjects: unique(catalogQuestions, (q) => q.subject),
    zones: unique(catalogQuestions, questionZoneValue),
    courseEras: unique(catalogQuestions, (q) => q.courseEra),
    options: unique(catalogQuestions, (q) => q.option),
    components: unique(routeScopedQuestions, (q) => q.component),
    granularLabels: unique(catalogQuestions, (q) => q.granularLabels ?? []),
    officialCodeRefs: unique(catalogQuestions, (q) => q.officialCodeRefs ?? []),
    retrievalFacets: unique(catalogQuestions, (q) => q.retrievalFacets ?? []),
  }), [catalogQuestions, routeScopedQuestions]);

  const filtered = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase();
    const remoteSearch = Boolean(
      bankSlug && normalizedSearch && indexLoaded && searchResult?.query === normalizedSearch,
    );
    const routeQuestions = catalogQuestions.filter((question) => matchesCourseRoute(question.syllabusRoute, effectiveCourseRoute));
    const matching = remoteSearch
      ? filterQuestions(routeQuestions, { ...filters, search: undefined, sort })
        .filter((question) => searchResult!.ids.has(question.id))
      : filterQuestions(routeQuestions, { ...filters, search, sort });
    const accessible = effectiveFreeOnly ? matching.filter((question) => isPreviewQuestion(question.bankSlug, question.id)) : matching;
    return savedOnly ? accessible.filter((question) => savedIds.has(question.id)) : accessible;
  }, [bankSlug, catalogQuestions, effectiveCourseRoute, effectiveFreeOnly, filters, indexLoaded, savedIds, savedOnly, search, searchResult, sort]);
  const savedWorksheetView = Boolean(worksheetId) && !addingQuestions;
  const savedSetQuestions = useMemo(() => {
    if (!worksheetReady || worksheetLoadFailed || bootstrapPending || !resolvedAccess.bankAccess) return [];
    const byId = new Map(catalogQuestions.map((question) => [question.id, question]));
    return [...selectedIds].flatMap((id) => { const question = byId.get(id); return question ? [question] : []; });
  }, [worksheetReady, worksheetLoadFailed, bootstrapPending, resolvedAccess.bankAccess, catalogQuestions, selectedIds]);
  const resultQuestions = savedWorksheetView ? savedSetQuestions : filtered;
  const anonymous = !resolvedAccess.authenticated && !resolvedAccess.bankAccess;
  const matchingFreeCount = filtered.filter((question) => isPreviewQuestion(question.bankSlug, question.id)).length;
  const accessResolved = locationHydrated && !bootstrapPending;
  const freeGate = getFreeQuestionGate({ resolved: accessResolved, authenticated: resolvedAccess.authenticated, bankAccess: resolvedAccess.bankAccess, freeOnly, freeQuestionCount: matchingFreeCount });
  const shownQuestions = useMemo(() => {
    if (!anonymous) return savedWorksheetView ? resultQuestions : resultQuestions.slice(0, visible);
    if (savedWorksheetView) return [];
    const freeLimit = freeGate.visibleCount;
    let freeShown = 0;
    const safeSample = filtered.filter((question) => {
      if (!isPreviewQuestion(question.bankSlug, question.id)) return accessResolved;
      if (freeShown >= freeLimit) return false;
      freeShown += 1;
      return true;
    });
    return safeSample.slice(0, visible);
  }, [accessResolved, anonymous, filtered, freeGate.visibleCount, visible, resultQuestions, savedWorksheetView]);
  const returnPath = typeof window === "undefined" ? "/" : `${window.location.pathname}${window.location.search}`;
  const signupHref = `/login?mode=sign-up&next=${encodeURIComponent(returnPath)}`;
  const signinHref = `/login?next=${encodeURIComponent(returnPath)}`;
  const activeCount = Object.values(filters).reduce((count, values) => count + (values?.length ?? 0), (effectiveFreeOnly ? 1 : 0) + (savedOnly ? 1 : 0));
  const questionAssetRequests = useMemo(() => bootstrapPending || !locationHydrated ? [] : shownQuestions
    .filter((question) => resolvedAccess.bankAccess || isPreviewQuestion(question.bankSlug, question.id))
    .filter((question) => !failedAssetKeys.has(signedAssetKey(question.id, "question")))
    .filter((question) => !isSignedAssetFresh(signedAssets.get(signedAssetKey(question.id, "question")), assetEpoch))
    .map((question) => ({ questionId: question.id, kind: "question" as const })),
  [bootstrapPending, locationHydrated, resolvedAccess.bankAccess, assetEpoch, failedAssetKeys, shownQuestions, signedAssets]);
  // The 30s epoch only matters when a displayed signature is near expiry; without this
  // guard the tick re-renders every card and re-runs the signing effect twice a minute
  // even when every URL is still valid for minutes.
  const expiringSoon = useMemo(() => shownQuestions.some((question) => {
    const asset = signedAssets.get(signedAssetKey(question.id, "question"));
    return Boolean(asset && asset.expiresAt - assetEpoch <= SIGN_REFRESH_MARGIN_MS);
  }), [assetEpoch, shownQuestions, signedAssets]);
  useEffect(() => {
    if (!expiringSoon) return;
    const timer = window.setInterval(() => setAssetEpoch(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, [expiringSoon]);

  useEffect(() => {
    if (!hydrateFromLocation) return;
    let cancelled = false;
    const locationParams = new URLSearchParams(window.location.search);
    queueMicrotask(() => {
      if (cancelled) return;
      const raw: ExplorerSearchParams = {};
      for (const [key, value] of locationParams) {
        const current = raw[key];
        raw[key] = current === undefined ? value : Array.isArray(current) ? [...current, value] : [current, value];
      }
      const next = parseExplorerState(raw, { defaultFreeOnly: !access.bankAccess });
      setSearch(next.search);
      setSort(next.sort);
      setFilters(next.filters);
      setVisible(next.visible);
      setFreeOnly(next.freeOnly);
      setSavedOnly(next.savedOnly);
      setCourseRoute(supportsCourseRoute(bank) ? next.courseRoute : "all");
      setShowMoreFilters(SECONDARY_FILTER_KEYS.some((key) => Boolean(next.filters[key]?.length)));
      setLocationHydrated(true);
    });
    return () => { cancelled = true; };
  }, [access.bankAccess, bank, hydrateFromLocation]);

  useEffect(() => {
    if (!bootstrapUrl) return;
    let cancelled = false;
    fetch(bootstrapUrl, { cache: "no-store", credentials: "same-origin" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Member state unavailable");
        return response.json() as Promise<{ access: ExplorerAccess; exportMarker?: string; studyState: ExplorerStudyState; studyStateUnavailable?: boolean }>;
      })
      .then((payload) => {
        if (cancelled) return;
        if (!payload?.access || !payload?.studyState || !Array.isArray(payload.studyState.savedIds) || !Array.isArray(payload.studyState.attemptedIds)) {
          throw new Error("Invalid member state");
        }
        setResolvedAccess(payload.access);
        setResolvedExportMarker(payload.exportMarker);
        setSavedIds(new Set(payload.studyState.savedIds));
        setAttemptedIds(new Set(payload.studyState.attemptedIds));
        if (payload.studyStateUnavailable) {
          setStudyError("Saved and attempted question state could not load. Your bank access is unaffected.");
        }
        if (payload.access.bankAccess) setFreeOnly(false);
      })
      .catch(() => {
        if (cancelled) return;
        setResolvedAccess({ authenticated: false, bankAccess: false, canExportPdf: false });
        setResolvedExportMarker(undefined);
        setFreeOnly(true);
      })
      .finally(() => {
        if (!cancelled) setBootstrapPending(false);
      });
    return () => { cancelled = true; };
  }, [bootstrapUrl]);

  useEffect(() => {
    if (!bank || !indexUrl) return;
    let cancelled = false;
    let fallbackTimer: number | undefined;
    const loadIndex = () => {
      if (cancelled) return;
      fetch(indexUrl, { cache: "force-cache" })
        .then(async (response) => {
          if (!response.ok) throw new Error("Question index unavailable");
          const payload = await response.json() as Partial<PublicBankIndex>;
          if (payload.version !== 1 || payload.bank !== bank || !Array.isArray(payload.questions)) {
            throw new Error("Invalid question index");
          }
          return payload.questions.map((metadata) => publicMetadataToQuestion(metadata, bank));
        })
        .then((metadataQuestions) => {
          if (cancelled) return;
          const richInitial = new Map(questions.map((question) => [question.id, question]));
          setCatalogQuestions(metadataQuestions.map((metadataQuestion) => {
            const initialQuestion = richInitial.get(metadataQuestion.id);
            return initialQuestion ? mergeQuestionRichDetails(metadataQuestion, {
              summary: initialQuestion.summary,
              accessibleText: initialQuestion.accessibleText,
              solution: initialQuestion.solution,
              sourceQuestionUrl: initialQuestion.sourceQuestionUrl,
              sourceMarkSchemeUrl: initialQuestion.sourceMarkSchemeUrl,
            }) : metadataQuestion;
          }));
          setIndexLoaded(true);
        })
        .catch(() => {
          if (!cancelled) {
            setIndexError("The full question index could not load.");
            setIndexLoaded(true);
          }
        });
    };

    const idleId = typeof window.requestIdleCallback === "function"
      ? window.requestIdleCallback(loadIndex, { timeout: 800 })
      : undefined;
    if (idleId === undefined) fallbackTimer = window.setTimeout(loadIndex, 200);

    return () => {
      cancelled = true;
      if (idleId !== undefined && typeof window.cancelIdleCallback === "function") window.cancelIdleCallback(idleId);
      if (fallbackTimer !== undefined) window.clearTimeout(fallbackTimer);
    };
  }, [bank, indexAttempt, indexUrl, questions]);

  useEffect(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase();
    if (!bankSlug || !bank || !normalizedSearch) {
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      fetch(`/api/questions/search?bank=${encodeURIComponent(bank)}&q=${encodeURIComponent(search.trim())}`, {
        signal: controller.signal,
        cache: "no-store",
      })
        .then(async (response) => {
          if (!response.ok) throw new Error("Question search unavailable");
          const payload = await response.json() as { ids?: unknown };
          if (!Array.isArray(payload.ids) || payload.ids.some((id) => typeof id !== "string")) {
            throw new Error("Invalid question search response");
          }
          return payload.ids as string[];
        })
        .then((ids) => {
          if (!controller.signal.aborted) setSearchResult({ query: normalizedSearch, ids: new Set(ids) });
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === "AbortError") return;
          if (!controller.signal.aborted) setSearchResult(null);
        });
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [bank, bankSlug, search]);

  useEffect(() => {
    if (!filtersOpen) return;
    const dialog = filterDialogRef.current;
    const trigger = filterTriggerRef.current;
    const focusable = () => [...(dialog?.querySelectorAll<HTMLElement>("button:not([disabled]), input:not([disabled]), select:not([disabled]), a[href]") ?? [])]
      .filter((element) => element.tabIndex >= 0 && !element.closest("[inert], [aria-hidden='true'], [hidden]"));
    focusable()[0]?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setFiltersOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusable();
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      trigger?.focus();
    };
  }, [filtersOpen]);

  useEffect(() => {
    if (!filtersOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, [filtersOpen]);

  useEffect(() => {
    const root = explorerRootRef.current;
    if (!root) return;
    const underlying = [...root.querySelectorAll<HTMLElement>(".explorer-toolbar, .access-notice, .free-value-strip, .explorer-results")];
    underlying.forEach((element) => { element.inert = filtersOpen; });
    return () => underlying.forEach((element) => { element.inert = false; });
  }, [filtersOpen]);

  useEffect(() => {
    if (!pdfOpen) return;
    const dialog = pdfDialogRef.current;
    const trigger = pdfTriggerRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusable = () => [...(dialog?.querySelectorAll<HTMLElement>("button:not([disabled]), input:not([disabled]), select:not([disabled]), a[href]") ?? [])];
    focusable()[0]?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setPdfOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusable();
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      trigger?.focus();
    };
  }, [pdfOpen]);

  useEffect(() => {
    if (!pdfUpgradeOpen) return;
    const dialog = pdfUpgradeDialogRef.current;
    const trigger = pdfTriggerRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusable = () => [...(dialog?.querySelectorAll<HTMLElement>("button:not([disabled]), a[href]") ?? [])];
    focusable()[0]?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setPdfUpgradeOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusable();
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      trigger?.focus();
    };
  }, [pdfUpgradeOpen]);

  useEffect(() => {
    if (!locationHydrated || bootstrapPending) return;
    const query = serializeExplorerState({ search, sort, filters, freeOnly: effectiveFreeOnly, savedOnly, courseRoute: effectiveCourseRoute, visible }, { persistFreeChoice: !resolvedAccess.bankAccess });
    const params = new URLSearchParams(query);
    if (worksheetId) { params.set("worksheet", worksheetId); if (worksheetMode === "edit") params.set("mode", "edit"); }
    const nextUrl = `${window.location.pathname}${params.size ? `?${params}` : ""}${window.location.hash}`;
    window.history.replaceState(window.history.state, "", nextUrl);
  }, [bootstrapPending, effectiveCourseRoute, effectiveFreeOnly, filters, locationHydrated, resolvedAccess.bankAccess, savedOnly, search, sort, visible, worksheetId, worksheetMode]);

  useEffect(() => {
    if (!bank) return;
    const pendingRequests = questionAssetRequests.filter((request) => (
      !signingAssetKeysRef.current.has(signedAssetKey(request.questionId, request.kind))
    ));
    if (!pendingRequests.length) return;
    const pendingKeys = pendingRequests.map((request) => signedAssetKey(request.questionId, request.kind));
    for (const key of pendingKeys) signingAssetKeysRef.current.add(key);
    fetchSignedAssets(bank, pendingRequests, fetch, localPreview)
      .then((assets) => {
        setSignedAssets((current) => new Map([...current, ...assets]));
        const detailsById = new Map([...assets.values()].flatMap((asset) => asset.details ? [[asset.questionId, asset.details] as const] : []));
        if (detailsById.size) {
          setCatalogQuestions((current) => current.map((question) => {
            const details = detailsById.get(question.id);
            return details ? mergeQuestionRichDetails(question, details) : question;
          }));
        }
        setAssetError("");
      })
      .catch(() => {
        setFailedAssetKeys((current) => new Set([...current, ...pendingKeys]));
        setAssetError("Some question images could not load.");
      })
      .finally(() => {
        for (const key of pendingKeys) signingAssetKeysRef.current.delete(key);
      });
  }, [bank, localPreview, questionAssetRequests]);

  const worksheetDefinition = () => JSON.stringify({ name: worksheetName.trim(), ids: [...selectedIds], content: pdfContent });
  const worksheetDirty = worksheetId ? Boolean(worksheetMode === "edit" && worksheetBaseline && worksheetBaseline !== worksheetDefinition()) : Boolean(selectionIsExplicit && worksheetName.trim() && (worksheetBaseline ? worksheetBaseline !== worksheetDefinition() : selectedIds.size));
  useEffect(() => {
    if (!worksheetId || !indexLoaded || indexError || bootstrapPending || worksheetReady) return;
    let cancelled = false;
    queueMicrotask(() => { if (!cancelled) setWorksheetLoading(true); });
    fetch(`/api/worksheets/${encodeURIComponent(worksheetId)}`, { cache: "no-store" }).then(async (response) => {
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Saved worksheet unavailable");
      return payload.worksheet as { bank_slug: string; title: string; question_ids: string[]; content_mode: PdfContent; revision: number };
    }).then((worksheet) => {
      if (cancelled) return;
      if (worksheet.bank_slug !== bank) throw new Error("This worksheet belongs to another bank.");
      const missing = worksheet.question_ids.filter((id) => !catalogQuestions.some((question) => question.id === id));
      if (missing.length) throw new Error(`Some saved questions are no longer available (${missing.join(", ")}).`);
      setSelectedIds(new Set(worksheet.question_ids)); setSelectionIsExplicit(true);
      setWorksheetName(worksheet.title); setWorksheetRevision(worksheet.revision); setPdfContent(worksheet.content_mode);
      setWorksheetBaseline(JSON.stringify({ name: worksheet.title, ids: worksheet.question_ids, content: worksheet.content_mode }));
      setWorksheetLoadFailed(false);
      setWorksheetReady(true);
    }).catch((error: unknown) => { if (!cancelled) { setWorksheetStatus(error instanceof Error ? error.message : "Saved worksheet unavailable"); setWorksheetLoadFailed(true); setWorksheetReady(true); } })
      .finally(() => { if (!cancelled) setWorksheetLoading(false); });
    return () => { cancelled = true; };
  }, [worksheetId, indexLoaded, indexError, bootstrapPending, worksheetReady, worksheetBaseline, bank, catalogQuestions]);
  useEffect(() => {
    if (!worksheetDirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    const guard = (event: MouseEvent) => {
      const link = (event.target as HTMLElement).closest("a[href]") as HTMLAnchorElement | null;
      if (link && !window.confirm("You have unsaved worksheet changes. Leave this page?")) event.preventDefault();
    };
    document.addEventListener("click", guard, true);
    return () => { window.removeEventListener("beforeunload", warn); document.removeEventListener("click", guard, true); };
  }, [worksheetDirty]);

  const saveWorksheet = async () => {
    if (!bank || !resolvedAccess.bankAccess || !exportQuestions.length || !worksheetName.trim() || !worksheetReady || worksheetLoadFailed || worksheetSavingRef.current) return;
    worksheetSavingRef.current = true;
    setWorksheetSaving(true);
    const editingExisting = Boolean(worksheetId);
    const orderedIds = exportQuestions.map((question) => question.id);
    setWorksheetStatus("Saving worksheet…");
    try {
      const response = await fetch(worksheetId ? `/api/worksheets/${encodeURIComponent(worksheetId)}` : "/api/worksheets", {
        method: worksheetId ? "PATCH" : "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ bank, name: worksheetName, questionIds: orderedIds, contentMode: pdfContent, ...(worksheetId ? { revision: worksheetRevision } : {}) }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Worksheet could not be saved. Try again.");
      const saved = payload.worksheet;
      setWorksheetRevision(saved.revision);
      setSelectedIds(new Set(saved.question_ids)); setSelectionIsExplicit(true);
      setWorksheetBaseline(JSON.stringify({ name: saved.title, ids: saved.question_ids, content: saved.content_mode }));
      if (editingExisting) {
        setWorksheetStatus("Changes saved.");
      } else {
        setSavedWorksheetLink(`/banks/${encodeURIComponent(bank)}?worksheet=${encodeURIComponent(saved.id)}`);
        setWorksheetStatus("");
        setPdfOpen(false);
      }
    } catch (error) { setWorksheetStatus(error instanceof Error ? error.message : "Worksheet could not be saved. Try again."); }
    finally { worksheetSavingRef.current = false; setWorksheetSaving(false); }
  };

  const toggle = (key: MultiKey, value: string) => {
    if (key === "topics") setShowAllSubtopics(false);
    setFilters((current) => {
      const values = (current[key] ?? []) as string[];
      const next = values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
      return { ...current, [key]: next };
    });
    setVisible(EXPLORER_PAGE_SIZE);
    trackProductEvent("question_filter_change", { bank: bank ?? "unknown", filter: key });
  };

  const clearFilters = () => {
    setSearch("");
    setFilters({});
    setFreeOnly(false);
    setSavedOnly(false);
    setCourseRoute("all");
    setShowAllSubtopics(false);
    setVisible(EXPLORER_PAGE_SIZE);
  };

  const changeCourseRoute = (value: CourseRouteSelection) => {
    setCourseRoute(value);
    // Route is the broad course-level scope. Paper/component filters stay optional
    // refinements, so discard stale refinements rather than mirroring hidden checkbox state.
    setFilters((current) => ({ ...current, papers: [], components: [] }));
    setVisible(EXPLORER_PAGE_SIZE);
    if (!worksheetId) { setSelectionIsExplicit(false); setSelectedIds(new Set()); }
  };

  const shareWorkspace = async () => {
    setShareStatus("");
    const shareLink = new URL(window.location.href);
    shareLink.searchParams.delete("worksheet");
    shareLink.searchParams.delete("mode");
    const shareUrl = shareLink.href;
    if (typeof navigator.share === "function" && navigator.canShare?.({ url: shareUrl })) {
      try {
        await navigator.share({ url: shareUrl, title: document.title });
        setShareStatus("Link copied");
        pulseSuccess(shareButtonRef.current);
      } catch {
        /* the visitor dismissed the share sheet — nothing to announce */
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareStatus("Link copied");
      pulseSuccess(shareButtonRef.current);
    } catch {
      setShareStatus("Couldn't copy — copy the link from your address bar, or try again.");
      shakeElement(shareButtonRef.current);
    }
  };

  const retryQuestionAssets = () => {
    setAssetError("");
    setFailedAssetKeys(new Set());
    setAssetEpoch(Date.now());
  };

  const markQuestionAssetFailed = (questionId: string) => {
    const key = signedAssetKey(questionId, "question");
    setSignedAssets((current) => {
      const next = new Map(current);
      next.delete(key);
      return next;
    });
    setFailedAssetKeys((current) => new Set(current).add(key));
    setAssetError("Some question images could not load.");
  };

  const updateStudyState = async (questionId: string, action: "save" | "unsave" | "attempt") => {
    if (!bank || !resolvedAccess.authenticated) return;
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

  const exportQuestions = worksheetId ? savedSetQuestions : questionsForPdf(filtered, selectedIds, selectionIsExplicit, catalogQuestions);
  const openPdfBuilder = () => {
    if (worksheetId && (!worksheetReady || worksheetLoadFailed || !exportQuestions.length)) return;
    if (!resolvedAccess.canExportPdf) { showPdfUpgrade(); return; }
    if (!worksheetId && !worksheetName.trim()) {
      const bankLabel = (bank ?? "Worksheet").replaceAll("-", " ").toUpperCase();
      const topics = [...new Set(exportQuestions.map((question) => formatPublicLabel(question.primaryTopic)))];
      setWorksheetName(`${bankLabel} ${topics.length === 1 && topics[0].length <= 28 ? topics[0] : "Worksheet 1"}`.slice(0, 80));
    }
    trackProductEvent("pdf_builder_open", { bank: bank ?? "unknown", questionCount: exportQuestions.length });
    setPdfOpen(true);
  };
  const handleDownload = async () => {
    if (!resolvedAccess.canExportPdf || !bank || !exportQuestions.length || Boolean(worksheetId && (worksheetLoadFailed || !worksheetReady))) return;
    trackProductEvent("pdf_export_attempt", { bank, questionCount: exportQuestions.length, content: pdfContent });
    setPdfStatusKind("progress");
    setPdfStatus(`Preparing ${exportQuestions.length} questions...`);
    try {
      const assets = await fetchPdfAssets(bank, exportQuestions.map((question) => question.id), pdfContent, fetch, localPreview);
      const securedQuestions = exportQuestions.map((question) => ({
        ...question,
        questionImages: assets.get(signedAssetKey(question.id, "question"))?.urls ?? [],
        markschemeImages: assets.get(signedAssetKey(question.id, "answer"))?.urls ?? [],
      }));
      await downloadQuestionPdf(
        securedQuestions,
        pdfContent,
        (complete, total) => setPdfStatus(`Preparing ${complete} of ${total}...`),
        resolvedExportMarker,
      );
      setPdfStatusKind("success");
      trackProductEvent("pdf_export_success", { bank, questionCount: exportQuestions.length, content: pdfContent });
      setPdfStatus(`Worksheet ready — ${exportQuestions.length} question${exportQuestions.length === 1 ? "" : "s"} downloaded.`);
      pulseSuccess(pdfBuildButtonRef.current);
      window.setTimeout(() => {
        setPdfOpen(false);
        setPdfStatus("");
      }, 1400);
    } catch (error) {
      trackProductEvent("pdf_export_error", { bank, questionCount: exportQuestions.length, content: pdfContent });
      setPdfStatusKind("error");
      setPdfStatus(error instanceof Error ? error.message : "The worksheet could not be built. Check your connection and try again.");
      shakeElement(pdfBuildButtonRef.current);
      shakeElement(pdfStatusRef.current);
    }
  };

  const showPdfUpgrade = () => {
    trackProductEvent("pdf_upgrade_view", { bank: bank ?? "unknown" });
    shakeElement(pdfTriggerRef.current);
    setPdfUpgradeOpen(true);
  };
  const closeWorksheetEditor = () => {
    if (worksheetDirty) {
      if (!window.confirm("Discard unsaved worksheet changes?")) return;
      const baseline = JSON.parse(worksheetBaseline) as { name: string; ids: string[]; content: PdfContent };
      setWorksheetName(baseline.name);
      setSelectedIds(new Set(baseline.ids));
      setPdfContent(baseline.content);
      setWorksheetStatus("");
    }
    setAddingQuestions(false);
    setWorksheetMode("view");
  };

  return (
    <section ref={explorerRootRef} className={`explorer${savedWorksheetView ? " is-worksheet-view" : ""}`} aria-label="Question explorer">
      {worksheetId && <div className="worksheet-workspace"><Link href="/worksheets">← My worksheets</Link>{worksheetReady && !worksheetLoadFailed && <><div className="worksheet-workspace-heading"><div><p className="eyebrow">Saved worksheet</p><h2>{worksheetName}</h2><span>{selectedIds.size} {selectedIds.size === 1 ? "question" : "questions"}</span></div>{worksheetMode === "view" ? <button className="button secondary" type="button" onClick={() => setWorksheetMode("edit")}>Edit worksheet</button> : <button className="button secondary" type="button" onClick={closeWorksheetEditor}>View worksheet</button>}</div></>}</div>}
      {worksheetId && worksheetMode === "edit" && worksheetReady && !worksheetLoadFailed && <WorksheetEditCard title={worksheetName} ids={[...selectedIds]} content={pdfContent} adding={addingQuestions} busy={worksheetSaving} dirty={worksheetDirty} status={worksheetStatus} onTitle={setWorksheetName} onContent={setPdfContent} onMove={(id, direction) => setSelectedIds((current) => { const ids = [...current]; const index = ids.indexOf(id); const next = index + direction; if (index < 0 || next < 0 || next >= ids.length) return current; [ids[index], ids[next]] = [ids[next], ids[index]]; return new Set(ids); })} onRemove={(id) => setSelectedIds((current) => { const next = new Set(current); next.delete(id); return next; })} onAdd={() => { clearFilters(); setAddingQuestions(true); }} onDoneAdding={() => setAddingQuestions(false)} onSave={() => void saveWorksheet()} />}
      {worksheetId && worksheetLoadFailed && <div className="access-notice" role="alert" aria-label="Worksheet unavailable"><span>{worksheetStatus}</span><button className="button secondary" type="button" onClick={() => { setWorksheetStatus(""); setWorksheetLoadFailed(false); setWorksheetReady(false); }}>Retry loading worksheet</button></div>}
      <div className="explorer-toolbar">
        <label className="search-field">
          <span className="sr-only">Search questions</span>
          <MagnifyingGlass aria-hidden="true" />
          <input value={search} onChange={(event) => { setSearch(event.target.value); setVisible(EXPLORER_PAGE_SIZE); }} placeholder="Search questions, topics, or methods" />
        </label>
        {routeSupported && <fieldset className="course-route-picker" role="radiogroup" aria-label="Course route">
          <legend className="sr-only">Course route</legend>
          <div className="course-route-options">
            {([
              ["all", "All", "Core + Extended"],
              ["core", "Core", "Papers 1 & 3"],
              ["extended", "Extended", "Papers 2 & 4"],
            ] as Array<[CourseRouteSelection, string, string]>).map(([value, label, detail]) => <label key={value}>
              <input type="radio" name="course-route" value={value} checked={courseRoute === value} onChange={() => changeCourseRoute(value)} />
              <span title={detail}><strong>{label}</strong><small>{detail}</small></span>
            </label>)}
          </div>
        </fieldset>}
        <button ref={filterTriggerRef} className={`mobile-filter-button${activeCount ? " is-active" : ""}`} type="button" aria-haspopup="dialog" aria-expanded={filtersOpen} onClick={() => setFiltersOpen(true)}><Funnel weight="bold" aria-hidden="true" /> Filters{activeCount ? ` (${activeCount})` : ""}</button>
        <SortSelector value={sort} onChange={setSort} />
        <button ref={shareButtonRef} className="share-view-button toolbar-icon-button" type="button" title="Share this view" aria-label="Copy link to this view" onClick={shareWorkspace}><ShareNetwork aria-hidden="true" /></button>
        <button ref={pdfTriggerRef} className="download-button toolbar-icon-button" type="button" title="Download PDF" aria-label="Download PDF" onClick={openPdfBuilder}><DownloadSimple aria-hidden="true" /></button>
      </div>
      {savedWorksheetLink && <div className="worksheet-saved-notice" role="status"><Check aria-hidden="true" weight="bold" /><strong>Worksheet saved</strong><a href={savedWorksheetLink}>View worksheet</a><Link href="/worksheets">My worksheets</Link><button type="button" aria-label="Dismiss saved confirmation" onClick={() => setSavedWorksheetLink("")}><X aria-hidden="true" /></button></div>}
      {shareStatus && <p className={`toolbar-status${shareStatus.startsWith("Couldn't") ? " is-error" : " is-success"}`} role="status">{shareStatus}</p>}


      {indexError && <div className="access-notice" role="alert"><span>{indexError}</span><button className="text-button" type="button" onClick={() => { setIndexError(""); setIndexAttempt((attempt) => attempt + 1); }}>Retry question index</button></div>}
      {assetError && <div className="access-notice" role="alert"><span>{assetError}</span><button className="text-button" type="button" onClick={retryQuestionAssets}>Retry images</button></div>}
      {studyError && <div className="access-notice" role="alert">{studyError}</div>}
      {!bootstrapPending && !resolvedAccess.bankAccess && <div className="free-value-strip"><div><strong>{effectiveFreeOnly ? "Free exam years are open." : "You’re browsing the full bank."}</strong><span>{effectiveFreeOnly ? "Practise now, or clear the Free questions only filter to preview the rest." : "Locked questions show what a paid bank plan unlocks."}</span></div><Link className="button secondary" href={plansHref}>{PLANS_LABEL}</Link></div>}

      <div className="explorer-layout">
        {filtersOpen && <button className="filter-backdrop" type="button" tabIndex={-1} aria-hidden="true" onClick={() => setFiltersOpen(false)} />}
        <aside ref={filterDialogRef} className={`filter-sidebar ${filtersOpen ? "is-open" : ""}`} role={filtersOpen ? "dialog" : undefined} aria-modal={filtersOpen ? true : undefined} aria-labelledby={filtersOpen ? "filter-sidebar-title" : undefined} aria-label={filtersOpen ? undefined : "Question filters"}>
          <div className="filter-sidebar-heading"><strong id="filter-sidebar-title">Filters</strong><button className="filter-close" type="button" aria-label="Close filters" onClick={() => setFiltersOpen(false)}><X /></button></div>
          {!bootstrapPending && !resolvedAccess.bankAccess && <div className="filter-group" role="group" aria-labelledby="filter-access"><h3 id="filter-access">Access</h3><div className="filter-options"><label><input aria-label="Free questions only" type="checkbox" checked={effectiveFreeOnly} onChange={() => { setFreeOnly((current) => !current); setVisible(EXPLORER_PAGE_SIZE); }} /><span>Free questions only</span></label></div></div>}
          {resolvedAccess.authenticated && <div className="filter-group" role="group" aria-labelledby="filter-study"><h3 id="filter-study">Study</h3><div className="filter-options"><label><input aria-label="Saved questions only" type="checkbox" checked={savedOnly} onChange={() => { setSavedOnly((current) => !current); setVisible(EXPLORER_PAGE_SIZE); }} /><span>Saved questions only</span></label></div></div>}
          <FilterGroup label="Topics" filterKey="topics" values={options.topics} selected={filters.topics ?? []} onToggle={toggle} />
          <FilterGroup label="Subtopics" filterKey="subtopics" values={visibleSubtopics} selected={filters.subtopics ?? []} onToggle={toggle} />
          {!!filters.topics?.length && !!subtopicGroups.other.length && <button className="text-button subtopic-more" aria-expanded={showAllSubtopics} onClick={() => setShowAllSubtopics((show) => !show)}>{showAllSubtopics ? "Hide other subtopics" : "Show other subtopics"}</button>}
          <button className="more-filters-button" type="button" aria-expanded={showMoreFilters} onClick={() => setShowMoreFilters((show) => !show)}><Funnel aria-hidden="true" /> {showMoreFilters ? "Fewer filters" : "More filters"}</button>
          <div className={`secondary-filters${showMoreFilters ? " is-open" : ""}`} aria-hidden={!showMoreFilters} inert={showMoreFilters ? undefined : true}>
            <div className="secondary-filters-inner">
              <FilterGroup label="Years" filterKey="years" values={options.years} selected={filters.years ?? []} onToggle={toggle} />
              <FilterGroup label="Sessions" filterKey="sessions" values={options.sessions} selected={filters.sessions ?? []} onToggle={toggle} />
              <FilterGroup label="Papers" filterKey="papers" values={options.papers} selected={filters.papers ?? []} onToggle={toggle} />
              {isCambridge && <FilterGroup label="Components" filterKey="components" values={options.components} selected={filters.components ?? []} onToggle={toggle} />}
              {isCambridge && <FilterGroup label="Time zone / variant" filterKey="zones" values={options.zones} selected={filters.zones ?? []} onToggle={toggle} />}
              {isCambridge && <FilterGroup label="Calculator" filterKey="calculator" values={["calculator", "non-calculator"]} selected={filters.calculator ?? []} onToggle={toggle} />}
              {options.granularLabels.length > 0 && <FilterGroup label="Granular labels" filterKey="granularLabels" values={options.granularLabels} selected={filters.granularLabels ?? []} onToggle={toggle} />}
              {bank === "ib-economics-hl" || bank === "ib-economics-sl" ? <>
                {options.officialCodeRefs.length > 0 && <FilterGroup label="Official units / codes" filterKey="officialCodeRefs" values={options.officialCodeRefs} selected={filters.officialCodeRefs ?? []} onToggle={toggle} />}
                {options.retrievalFacets.length > 0 && <FilterGroup label="Retrieval facets" filterKey="retrievalFacets" values={options.retrievalFacets} selected={filters.retrievalFacets ?? []} onToggle={toggle} />}
              </> : null}
              {bank === "ib-hl" && <FilterGroup label="Course era" filterKey="courseEras" values={options.courseEras} selected={filters.courseEras ?? []} onToggle={toggle} />}
              {bank === "ib-hl" && <FilterGroup label="Paper 3 option" filterKey="options" values={options.options} selected={filters.options ?? []} onToggle={toggle} />}
              {!isCambridge && <FilterGroup label="Time zone" filterKey="zones" values={options.zones} selected={filters.zones ?? []} onToggle={toggle} />}
            </div>
          </div>
        </aside>

        <div className="explorer-results" inert={filtersOpen || undefined}>
          <div className="results-heading">
            <div><strong>{resultQuestions.length.toLocaleString()} {savedWorksheetView ? "saved " : effectiveFreeOnly ? "free " : ""}{resultQuestions.length === 1 ? "question" : "questions"}</strong>{selectionIsExplicit && !savedWorksheetView && <span>{selectedIds.size} selected for PDF</span>}</div>
            <div>{selectionIsExplicit && !worksheetId && <button className="text-button" onClick={() => { setSelectionIsExplicit(false); setSelectedIds(new Set()); }}>Use all results for PDF</button>}{!savedWorksheetView && (search || activeCount > 0 || courseRoute !== "all") && <button className="text-button" onClick={clearFilters}>Clear filters</button>}</div>
          </div>
          {!savedWorksheetView && activeCount > 0 && <div className="active-filters">
            {effectiveFreeOnly && <button aria-label="Remove free questions only filter" onClick={() => setFreeOnly(false)}>Free only <X /></button>}
            {savedOnly && <button aria-label="Remove saved questions only filter" onClick={() => setSavedOnly(false)}>Saved only <X /></button>}
            {Object.entries(filters).flatMap(([key, values]) => (values ?? []).map((value) => <button key={`${key}-${value}`} onClick={() => toggle(key as MultiKey, value)}>{formatPublicLabel(value)} <X /></button>))}
          </div>}
          <div className="question-list">
            {shownQuestions.map((question) => {
              const unlocked = resolvedAccess.bankAccess || isPreviewQuestion(question.bankSlug, question.id);
              const questionAsset = signedAssets.get(signedAssetKey(question.id, "question"));
              const answerAsset = signedAssets.get(signedAssetKey(question.id, "answer"));
              return <QuestionCard key={question.id} question={question} unlocked={unlocked} authenticated={resolvedAccess.authenticated} localPreview={localPreview} questionAsset={isSignedAssetFresh(questionAsset, assetEpoch) ? questionAsset : undefined} answerAsset={isSignedAssetFresh(answerAsset, assetEpoch) ? answerAsset : undefined} onQuestionAssetError={() => markQuestionAssetFailed(question.id)} onAnswerAsset={(asset) => {
                setSignedAssets((current) => new Map(current).set(signedAssetKey(question.id, "answer"), asset));
                if (asset.details) setCatalogQuestions((current) => current.map((item) => item.id === question.id ? mergeQuestionRichDetails(item, asset.details!) : item));
              }} selected={selectedIds.has(question.id)} selectable={!savedWorksheetView} onSelect={() => toggleQuestion(question.id)} saved={savedIds.has(question.id)} attempted={attemptedIds.has(question.id)} onToggleSaved={() => toggleSaved(question.id)} onAttempt={() => recordAttempt(question.id)} />;
            })}
          </div>
          {!savedWorksheetView && filtered.length === 0 && <div className="empty-state"><strong>No questions match that combination.</strong><span>Clear a filter and try again.</span></div>}
          {!savedWorksheetView && freeGate.active && bankSlug && <FreeQuestionSignupGate bankSlug={bankSlug} remainingCount={freeGate.remainingCount} signupHref={signupHref} signinHref={signinHref} />}
          {!savedWorksheetView && !freeGate.active && visible < filtered.length && <button className="load-more" onClick={() => setVisible((count) => count + EXPLORER_PAGE_SIZE)}>Show 24 more questions</button>}
        </div>
      </div>

      {pdfOpen && <div className="pdf-backdrop" role="presentation"><section ref={pdfDialogRef} className="pdf-dialog" role="dialog" aria-modal="true" aria-labelledby="pdf-title"><button className="pdf-close" aria-label="Close PDF options" onClick={() => setPdfOpen(false)}><X /></button><p className="eyebrow">Worksheet builder</p><h2 id="pdf-title">Download {exportQuestions.length.toLocaleString()} questions</h2><p>{worksheetId ? "Only the questions in this worksheet are included." : selectionIsExplicit ? "Using your selected questions, including selections outside the current filters." : filtered.length > MAX_PDF_QUESTIONS ? `Worksheets are limited to ${MAX_PDF_QUESTIONS} questions. Narrow your filters or make a selection for a different set.` : "No manual selection yet, so this uses every current result."}</p><div className="pdf-options">{(["questions", "answers", "both"] as PdfContent[]).map((value) => <label key={value}><input type="radio" name="pdf-content" checked={pdfContent === value} onChange={() => setPdfContent(value)} /> {value === "both" ? "Questions and answers" : value[0].toUpperCase() + value.slice(1)}</label>)}</div>{!worksheetId && <label className="worksheet-name-field">Worksheet name<input aria-label="Worksheet name" maxLength={80} value={worksheetName} onChange={(event) => setWorksheetName(event.target.value)} placeholder="e.g. Algebra revision" /></label>}<div className={`worksheet-actions${worksheetId ? " only-download" : ""}`}>{!worksheetId && <button type="button" className="button primary" disabled={!resolvedAccess.bankAccess || !worksheetReady || worksheetLoading || worksheetSaving || !exportQuestions.length || !worksheetName.trim()} onClick={saveWorksheet}>Save worksheet</button>}<button ref={pdfBuildButtonRef} className="button secondary pdf-download" disabled={!exportQuestions.length} onClick={handleDownload}><DownloadSimple /> {pdfStatusKind === "success" ? "PDF downloaded" : "Download PDF"}</button></div>{worksheetStatus && <p role={worksheetLoadFailed || worksheetStatus.includes("could not") || worksheetStatus.includes("required") || worksheetStatus.includes("unavailable") ? "alert" : "status"}>{worksheetStatus}</p>}{worksheetLoadFailed && <button type="button" onClick={() => { setWorksheetStatus(""); setWorksheetLoadFailed(false); setWorksheetReady(false); }}>Retry loading worksheet</button>}{worksheetDirty && <small>Unsaved worksheet changes</small>}{pdfStatus && <small ref={pdfStatusRef} role="status" aria-live="polite" className={pdfStatusKind === "progress" ? "" : pdfStatusKind === "error" ? "is-error" : "is-success"}>{pdfStatus}</small>}</section></div>}
      {pdfUpgradeOpen && <div className="pdf-backdrop" role="presentation"><section ref={pdfUpgradeDialogRef} className="pdf-dialog access-upgrade-dialog" role="dialog" aria-modal="true" aria-labelledby="pdf-upgrade-title"><button className="pdf-close" aria-label="Close PDF access message" onClick={() => setPdfUpgradeOpen(false)}><X /></button><span className="access-upgrade-icon"><DownloadSimple aria-hidden="true" weight="bold" /></span><h2 id="pdf-upgrade-title">PDF export needs paid access</h2><p>Build and download worksheets with paid access to this question bank.</p><Link className="button primary" href={plansHref}>{PLANS_LABEL}</Link></section></div>}
    </section>
  );
}

function FilterGroup({ label, filterKey, values, selected, onToggle }: { label: string; filterKey: MultiKey; values: string[]; selected: string[]; onToggle: (key: MultiKey, value: string) => void }) {
  if (!values.length) return null;
  const headingId = `filter-${filterKey}`;
  return <div className="filter-group" role="group" aria-labelledby={headingId}><h3 id={headingId}>{label}</h3><div className="filter-options">{values.map((value) => { const publicLabel = formatPublicLabel(value); return <label key={value}><input aria-label={`${label}: ${publicLabel}`} type="checkbox" checked={selected.includes(value)} onChange={() => onToggle(filterKey, value)} /><span>{publicLabel}</span></label>; })}</div></div>;
}

function QuestionCard({ question, unlocked, authenticated, localPreview, questionAsset, answerAsset, onQuestionAssetError, onAnswerAsset, selected, selectable, onSelect, saved, attempted, onToggleSaved, onAttempt }: {
  question: UnifiedQuestion;
  unlocked: boolean;
  authenticated: boolean;
  localPreview: boolean;
  questionAsset?: SignedAsset;
  answerAsset?: SignedAsset;
  onQuestionAssetError: () => void;
  onAnswerAsset: (asset: SignedAsset) => void;
  selected: boolean;
  selectable: boolean;
  onSelect: () => void;
  saved: boolean;
  attempted: boolean;
  onToggleSaved: () => void;
  onAttempt: () => void;
}) {
  const [answerOpen, setAnswerOpen] = useState(false);
  const [solutionOpen, setSolutionOpen] = useState(false);
  const [answerLoading, setAnswerLoading] = useState(false);
  const [answerError, setAnswerError] = useState("");

  const toggleAnswer = async () => {
    if (answerOpen) { setAnswerOpen(false); return; }
    trackProductEvent("answer_reveal", { bank: question.bankSlug, freePreview: isPreviewQuestion(question.bankSlug, question.id) });
    if (question.markschemeImageCount > 0 && !answerAsset) {
      setAnswerLoading(true);
      setAnswerError("");
      try {
        const assets = await fetchSignedAssets(question.bankSlug, [{ questionId: question.id, kind: "answer" }], fetch, localPreview);
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
    <article className="question-card question-paper">
      <header className="question-card-header"><div className="question-meta"><span>{question.year} {question.session}</span><span>Paper {question.paper}</span><span>Question {question.number}</span>{question.component && <span>Component {question.component}</span>}{question.zone && <span>{question.zone}</span>}{question.marks !== null && <span>{question.marks} {question.marks === 1 ? "mark" : "marks"}</span>}</div>{unlocked && selectable && <label className="pdf-select"><input aria-label={`Add question ${question.number} to PDF`} type="checkbox" checked={selected} onChange={onSelect} /> Add to PDF</label>}</header>
      <div className="question-topic"><strong>{formatPublicLabel(question.primaryTopic)}</strong>{question.subtopics.slice(0, 4).map((topic) => <span key={topic}>{formatPublicLabel(topic)}</span>)}</div>
      {unlocked ? <div className="question-images">{questionAsset ? questionAsset.urls.map((source, index) => <Image unoptimized width={1400} height={1000} key={source} src={source} alt={`Original question ${question.number}${questionAsset.urls.length > 1 ? ` page ${index + 1}` : ""}`} onError={onQuestionAssetError} />) : <div className="asset-placeholder" role="status"><span className="placeholder-shimmer" aria-hidden="true" /><span className="placeholder-bars" aria-hidden="true"><i /><i /><i /><i /></span><span className="sr-only">Loading original question</span></div>}</div> : <div className="question-locked"><strong>Paid plan required</strong><span>Unlock this bank’s full question set, answers, and PDF export.</span><Link className="question-locked-action" href={plansHrefFor(authenticated)}>{PLANS_LABEL}</Link></div>}
      <div className="question-actions">
        <div className="question-action-buttons">{unlocked ? ((question.solution || question.markschemeImageCount > 0) ? <button className="answer-toggle" disabled={answerLoading} aria-expanded={answerOpen} onClick={toggleAnswer}>{answerLoading ? "Loading answer..." : answerOpen ? "Hide answer" : "Show answer"}</button> : <span className="muted">Answer coming soon</span>) : null}{answerError && <span className="muted" role="alert">{answerError}</span>}</div>
        <div className="source-links">{attempted && <span className="study-state"><CheckCircle weight="fill" /> Practised</span>}{authenticated && unlocked && <button className={`study-icon-button ${saved ? "is-saved" : ""}`} title={saved ? "Remove from saved" : "Save question"} aria-label={saved ? `Remove question from saved ${question.id}` : `Save question ${question.id}`} onClick={onToggleSaved}><BookmarkSimple weight={saved ? "fill" : "regular"} aria-hidden="true" /></button>}</div>
      </div>
      {answerOpen && <div className="answer-panel">{answerAsset?.urls.map((source, index) => <Image unoptimized width={1400} height={1000} key={source} src={source} alt={`Official mark scheme page ${index + 1}`} />)}{question.solution && (answerAsset?.urls.length ? <div className="solution-wrap"><button className="text-button" aria-expanded={solutionOpen} onClick={() => setSolutionOpen((open) => !open)}>{solutionOpen ? "Hide worked text" : "Show worked text"}</button>{solutionOpen && <p>{question.solution}</p>}</div> : <p>{question.solution}</p>)}</div>}
    </article>
  );
}