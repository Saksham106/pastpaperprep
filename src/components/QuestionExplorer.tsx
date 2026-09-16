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
import { getSubtopicGroups, getTopicOptions } from "@/lib/taxonomy-router";
import { formatPublicLabel } from "@/lib/presentation";

type MultiKey = ExplorerFilterKey;

const SECONDARY_FILTER_KEYS: MultiKey[] = [
  "years", "sessions", "papers", "components", "calculator", "subjects", "courseEras", "options", "zones",
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

const DEFAULT_EXPLORER_STATE: ExplorerState = { search: "", sort: DEFAULT_SORT, filters: {}, freeOnly: false, savedOnly: false, visible: EXPLORER_PAGE_SIZE };
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
  const [showAllSubtopics, setShowAllSubtopics] = useState(false);
  const [showMoreFilters, setShowMoreFilters] = useState(() => (
    SECONDARY_FILTER_KEYS.some((key) => Boolean(initialState.filters[key]?.length))
  ));
  const [selectedIds, setSelectedIds] = useState(new Set<string>());
  const [selectionIsExplicit, setSelectionIsExplicit] = useState(false);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [pdfUpgradeOpen, setPdfUpgradeOpen] = useState(false);
  const [pdfContent, setPdfContent] = useState<PdfContent>("both");
  const [pdfStatus, setPdfStatus] = useState("");
  const [pdfStatusKind, setPdfStatusKind] = useState<"progress" | "success" | "error">("progress");
  const shareButtonRef = useRef<HTMLButtonElement>(null);
  const [signedAssets, setSignedAssets] = useState(new Map<string, SignedAsset>());
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
  const filterTriggerRef = useRef<HTMLButtonElement>(null);
  const filterDialogRef = useRef<HTMLElement>(null);
  const pdfTriggerRef = useRef<HTMLButtonElement>(null);
  const pdfBuildButtonRef = useRef<HTMLButtonElement>(null);
  const pdfStatusRef = useRef<HTMLElement>(null);
  const pdfDialogRef = useRef<HTMLElement>(null);
  const pdfUpgradeDialogRef = useRef<HTMLElement>(null);
  const explorerRootRef = useRef<HTMLElement>(null);

  const bank = bankSlug ?? questions[0]?.bankSlug;
  const isCambridge = bank === "igcse" || bank === "igcse-additional";
  const plansHref = plansHrefFor(resolvedAccess.authenticated);
  const subtopicGroups = useMemo(
    () => getSubtopicGroups(catalogQuestions, filters.topics ?? [], filters.subtopics ?? []),
    [catalogQuestions, filters.topics, filters.subtopics],
  );
  const visibleSubtopics = filters.topics?.length
    ? showAllSubtopics
      ? subtopicGroups.all
      : [...subtopicGroups.relevant, ...subtopicGroups.selectedOutsideContext]
    : subtopicGroups.all;
  const options = useMemo(() => ({
    topics: getTopicOptions(catalogQuestions),
    years: unique(catalogQuestions, (q) => String(q.year)).reverse(),
    papers: unique(catalogQuestions, (q) => String(q.paper)),
    sessions: unique(catalogQuestions, (q) => q.session),
    subjects: unique(catalogQuestions, (q) => q.subject),
    zones: unique(catalogQuestions, questionZoneValue),
    courseEras: unique(catalogQuestions, (q) => q.courseEra),
    options: unique(catalogQuestions, (q) => q.option),
    components: unique(catalogQuestions, (q) => q.component),
  }), [catalogQuestions]);

  const filtered = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase();
    const remoteSearch = Boolean(
      bankSlug && normalizedSearch && indexLoaded && searchResult?.query === normalizedSearch,
    );
    const matching = remoteSearch
      ? filterQuestions(catalogQuestions, { ...filters, search: undefined, sort })
        .filter((question) => searchResult!.ids.has(question.id))
      : filterQuestions(catalogQuestions, { ...filters, search, sort });
    const accessible = freeOnly ? matching.filter((question) => isPreviewQuestion(question.bankSlug, question.id)) : matching;
    return savedOnly ? accessible.filter((question) => savedIds.has(question.id)) : accessible;
  }, [bankSlug, catalogQuestions, filters, freeOnly, indexLoaded, savedIds, savedOnly, search, searchResult, sort]);
  const shownQuestions = useMemo(() => filtered.slice(0, visible), [filtered, visible]);
  const activeCount = Object.values(filters).reduce((count, values) => count + (values?.length ?? 0), (freeOnly ? 1 : 0) + (savedOnly ? 1 : 0));
  const questionAssetRequests = useMemo(() => shownQuestions
    .filter((question) => resolvedAccess.bankAccess || isPreviewQuestion(question.bankSlug, question.id))
    .filter((question) => !failedAssetKeys.has(signedAssetKey(question.id, "question")))
    .filter((question) => !isSignedAssetFresh(signedAssets.get(signedAssetKey(question.id, "question")), assetEpoch))
    .map((question) => ({ questionId: question.id, kind: "question" as const })),
  [resolvedAccess.bankAccess, assetEpoch, failedAssetKeys, shownQuestions, signedAssets]);
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
    queueMicrotask(() => {
      if (cancelled) return;
      const raw: ExplorerSearchParams = {};
      for (const [key, value] of new URLSearchParams(window.location.search)) {
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
      setShowMoreFilters(SECONDARY_FILTER_KEYS.some((key) => Boolean(next.filters[key]?.length)));
      setLocationHydrated(true);
    });
    return () => { cancelled = true; };
  }, [access.bankAccess, hydrateFromLocation]);

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
        if (payload.access.bankAccess && !new URLSearchParams(window.location.search).has("free")) setFreeOnly(false);
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [bootstrapUrl]);

  useEffect(() => {
    if (!bank || !indexUrl) return;
    let cancelled = false;
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
    return () => { cancelled = true; };
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
    if (!locationHydrated) return;
    const query = serializeExplorerState({ search, sort, filters, freeOnly, savedOnly, visible }, { persistFreeChoice: !resolvedAccess.bankAccess });
    const nextUrl = `${window.location.pathname}${query.size ? `?${query}` : ""}${window.location.hash}`;
    window.history.replaceState(window.history.state, "", nextUrl);
  }, [filters, freeOnly, locationHydrated, resolvedAccess.bankAccess, savedOnly, search, sort, visible]);

  useEffect(() => {
    if (!bank) return;
    if (!questionAssetRequests.length) return;
    let cancelled = false;
    fetchSignedAssets(bank, questionAssetRequests, fetch, localPreview)
      .then((assets) => {
        if (cancelled) return;
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
        if (cancelled) return;
        setFailedAssetKeys((current) => new Set([...current, ...questionAssetRequests.map((request) => signedAssetKey(request.questionId, request.kind))]));
        setAssetError("Some question images could not load.");
      });
    return () => { cancelled = true; };
  }, [bank, localPreview, questionAssetRequests]);

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
    const shareUrl = window.location.href;
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

  const exportQuestions = questionsForPdf(filtered, selectedIds, selectionIsExplicit, catalogQuestions);
  const handleDownload = async () => {
    if (!resolvedAccess.canExportPdf || !bank) return;
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
      setPdfStatus(`Worksheet ready — ${exportQuestions.length} question${exportQuestions.length === 1 ? "" : "s"} downloaded.`);
      pulseSuccess(pdfBuildButtonRef.current);
      window.setTimeout(() => {
        setPdfOpen(false);
        setPdfStatus("");
      }, 1400);
    } catch (error) {
      setPdfStatusKind("error");
      setPdfStatus(error instanceof Error ? error.message : "The worksheet could not be built. Check your connection and try again.");
      shakeElement(pdfBuildButtonRef.current);
      shakeElement(pdfStatusRef.current);
    }
  };

  const showPdfUpgrade = () => {
    shakeElement(pdfTriggerRef.current);
    setPdfUpgradeOpen(true);
  };

  return (
    <section ref={explorerRootRef} className="explorer" aria-label="Question explorer">
      <div className="explorer-toolbar">
        <label className="search-field">
          <span className="sr-only">Search questions</span>
          <MagnifyingGlass aria-hidden="true" />
          <input value={search} onChange={(event) => { setSearch(event.target.value); setVisible(EXPLORER_PAGE_SIZE); }} placeholder="Search questions, topics, or methods" />
        </label>
        <button ref={filterTriggerRef} className={`mobile-filter-button${activeCount ? " is-active" : ""}`} type="button" aria-haspopup="dialog" aria-expanded={filtersOpen} onClick={() => setFiltersOpen(true)}><Funnel weight="bold" aria-hidden="true" /> Filters{activeCount ? ` (${activeCount})` : ""}</button>
        <SortSelector value={sort} onChange={setSort} />
        <button ref={shareButtonRef} className="share-view-button toolbar-icon-button" type="button" title="Share this view" aria-label="Copy link to this view" onClick={shareWorkspace}><ShareNetwork aria-hidden="true" /></button>
        <button ref={pdfTriggerRef} className="download-button toolbar-icon-button" type="button" title="Download PDF" aria-label="Download PDF" onClick={() => resolvedAccess.canExportPdf ? setPdfOpen(true) : showPdfUpgrade()}><DownloadSimple aria-hidden="true" /></button>
      </div>
      {shareStatus && <p className={`toolbar-status${shareStatus.startsWith("Couldn't") ? " is-error" : " is-success"}`} role="status">{shareStatus}</p>}

      {indexError && <div className="access-notice" role="alert"><span>{indexError}</span><button className="text-button" type="button" onClick={() => { setIndexError(""); setIndexAttempt((attempt) => attempt + 1); }}>Retry question index</button></div>}
      {assetError && <div className="access-notice" role="alert"><span>{assetError}</span><button className="text-button" type="button" onClick={retryQuestionAssets}>Retry images</button></div>}
      {studyError && <div className="access-notice" role="alert">{studyError}</div>}
      {!resolvedAccess.bankAccess && <div className="free-value-strip"><div><strong>{freeOnly ? "Free exam years are open." : "You’re browsing the full bank."}</strong><span>{freeOnly ? "Practise now, or clear the Free questions only filter to preview the rest." : "Locked questions show what a paid bank plan unlocks."}</span></div><Link className="button secondary" href={plansHref}>{PLANS_LABEL}</Link></div>}

      <div className="explorer-layout">
        {filtersOpen && <button className="filter-backdrop" type="button" tabIndex={-1} aria-hidden="true" onClick={() => setFiltersOpen(false)} />}
        <aside ref={filterDialogRef} className={`filter-sidebar ${filtersOpen ? "is-open" : ""}`} role={filtersOpen ? "dialog" : undefined} aria-modal={filtersOpen ? true : undefined} aria-labelledby={filtersOpen ? "filter-sidebar-title" : undefined} aria-label={filtersOpen ? undefined : "Question filters"}>
          <div className="filter-sidebar-heading"><strong id="filter-sidebar-title">Filters</strong><button className="filter-close" type="button" aria-label="Close filters" onClick={() => setFiltersOpen(false)}><X /></button></div>
          {!resolvedAccess.bankAccess && <div className="filter-group" role="group" aria-labelledby="filter-access"><h3 id="filter-access">Access</h3><div className="filter-options"><label><input aria-label="Free questions only" type="checkbox" checked={freeOnly} onChange={() => { setFreeOnly((current) => !current); setVisible(EXPLORER_PAGE_SIZE); }} /><span>Free questions only</span></label></div></div>}
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
              {!isCambridge && options.subjects.length > 1 && <FilterGroup label="Course" filterKey="subjects" values={options.subjects} selected={filters.subjects ?? []} onToggle={toggle} />}
              {bank === "ib-hl" && <FilterGroup label="Course era" filterKey="courseEras" values={options.courseEras} selected={filters.courseEras ?? []} onToggle={toggle} />}
              {bank === "ib-hl" && <FilterGroup label="Paper 3 option" filterKey="options" values={options.options} selected={filters.options ?? []} onToggle={toggle} />}
              {!isCambridge && <FilterGroup label="Time zone" filterKey="zones" values={options.zones} selected={filters.zones ?? []} onToggle={toggle} />}
            </div>
          </div>
        </aside>

        <div className="explorer-results" inert={filtersOpen || undefined}>
          <div className="results-heading">
            <div><strong>{filtered.length.toLocaleString()} {freeOnly ? "free " : ""}{filtered.length === 1 ? "question" : "questions"}</strong>{selectionIsExplicit && <span>{selectedIds.size} selected for PDF</span>}</div>
            <div>{selectionIsExplicit && <button className="text-button" onClick={() => { setSelectionIsExplicit(false); setSelectedIds(new Set()); }}>Use all results for PDF</button>}{(search || activeCount > 0) && <button className="text-button" onClick={clearFilters}>Clear filters</button>}</div>
          </div>
          {activeCount > 0 && <div className="active-filters">
            {freeOnly && <button aria-label="Remove free questions only filter" onClick={() => setFreeOnly(false)}>Free only <X /></button>}
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
              }} selected={selectedIds.has(question.id)} onSelect={() => toggleQuestion(question.id)} saved={savedIds.has(question.id)} attempted={attemptedIds.has(question.id)} onToggleSaved={() => toggleSaved(question.id)} onAttempt={() => recordAttempt(question.id)} />;
            })}
          </div>
          {filtered.length === 0 && <div className="empty-state"><strong>No questions match that combination.</strong><span>Clear a filter and try again.</span></div>}
          {visible < filtered.length && <button className="load-more" onClick={() => setVisible((count) => count + EXPLORER_PAGE_SIZE)}>Show 24 more questions</button>}
        </div>
      </div>

      {pdfOpen && <div className="pdf-backdrop" role="presentation"><section ref={pdfDialogRef} className="pdf-dialog" role="dialog" aria-modal="true" aria-labelledby="pdf-title"><button className="pdf-close" aria-label="Close PDF options" onClick={() => setPdfOpen(false)}><X /></button><p className="eyebrow">Worksheet builder</p><h2 id="pdf-title">Download {exportQuestions.length.toLocaleString()} questions</h2><p>{selectionIsExplicit ? "Using your selected questions, including selections outside the current filters." : filtered.length > MAX_PDF_QUESTIONS ? `Worksheets are limited to ${MAX_PDF_QUESTIONS} questions. Narrow your filters or make a selection for a different set.` : "No manual selection yet, so this uses every current result."}</p><div className="pdf-options">{(["questions", "answers", "both"] as PdfContent[]).map((value) => <label key={value}><input type="radio" name="pdf-content" checked={pdfContent === value} onChange={() => setPdfContent(value)} /> {value === "both" ? "Questions and answers" : value[0].toUpperCase() + value.slice(1)}</label>)}</div><button ref={pdfBuildButtonRef} className="download-button pdf-download" disabled={!exportQuestions.length} onClick={handleDownload}><DownloadSimple /> {pdfStatusKind === "success" ? "Downloaded" : "Build PDF"}</button>{pdfStatus && <small ref={pdfStatusRef} role="status" aria-live="polite" className={pdfStatusKind === "progress" ? "" : pdfStatusKind === "error" ? "is-error" : "is-success"}>{pdfStatus}</small>}</section></div>}
      {pdfUpgradeOpen && <div className="pdf-backdrop" role="presentation"><section ref={pdfUpgradeDialogRef} className="pdf-dialog access-upgrade-dialog" role="dialog" aria-modal="true" aria-labelledby="pdf-upgrade-title"><button className="pdf-close" aria-label="Close PDF access message" onClick={() => setPdfUpgradeOpen(false)}><X /></button><span className="access-upgrade-icon"><DownloadSimple aria-hidden="true" weight="bold" /></span><h2 id="pdf-upgrade-title">PDF export needs paid access</h2><p>Build and download worksheets with paid access to this question bank.</p><Link className="button primary" href={plansHref}>{PLANS_LABEL}</Link></section></div>}
    </section>
  );
}

function FilterGroup({ label, filterKey, values, selected, onToggle }: { label: string; filterKey: MultiKey; values: string[]; selected: string[]; onToggle: (key: MultiKey, value: string) => void }) {
  if (!values.length) return null;
  const headingId = `filter-${filterKey}`;
  return <div className="filter-group" role="group" aria-labelledby={headingId}><h3 id={headingId}>{label}</h3><div className="filter-options">{values.map((value) => { const publicLabel = formatPublicLabel(value); return <label key={value}><input aria-label={`${label}: ${publicLabel}`} type="checkbox" checked={selected.includes(value)} onChange={() => onToggle(filterKey, value)} /><span>{publicLabel}</span></label>; })}</div></div>;
}

function QuestionCard({ question, unlocked, authenticated, localPreview, questionAsset, answerAsset, onQuestionAssetError, onAnswerAsset, selected, onSelect, saved, attempted, onToggleSaved, onAttempt }: {
  question: UnifiedQuestion;
  unlocked: boolean;
  authenticated: boolean;
  localPreview: boolean;
  questionAsset?: SignedAsset;
  answerAsset?: SignedAsset;
  onQuestionAssetError: () => void;
  onAnswerAsset: (asset: SignedAsset) => void;
  selected: boolean;
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
      <header className="question-card-header"><div className="question-meta"><span>{question.year} {question.session}</span><span>Paper {question.paper}</span><span>Question {question.number}</span>{question.component && <span>Component {question.component}</span>}{question.zone && <span>{question.zone}</span>}{question.marks !== null && <span>{question.marks} {question.marks === 1 ? "mark" : "marks"}</span>}</div>{unlocked && <label className="pdf-select"><input aria-label={`Add question ${question.number} to PDF`} type="checkbox" checked={selected} onChange={onSelect} /> Add to PDF</label>}</header>
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