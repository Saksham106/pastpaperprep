"use client";

import { Fragment, useCallback, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { CALCULATOR_FILTER_BANKS } from "@/lib/calculator-policy.mjs";
import Image from "next/image";
import dynamic from "next/dynamic";
import Link from "next/link";
import { BookmarkSimple, CaretDown, Check, CheckCircle, DownloadSimple, FilePlus, FileText, Funnel, MagnifyingGlass, ShareNetwork, X } from "@phosphor-icons/react";
import type { PdfAnswerPlacement, PdfContent } from "@/lib/pdf-export";
import { AnswerPlacementPrompt } from "@/components/AnswerPlacementPrompt";
import { LargeExportConfirm } from "@/components/LargeExportConfirm";
import { LARGE_PDF_QUESTIONS } from "@/lib/export-limits";
import { suggestWorksheetTitle } from "@/lib/worksheet-title";
import { PeriodicTableButton } from "@/components/PeriodicTableButton";
import { hasPeriodicTable } from "@/lib/periodic-table";
import { MAX_PDF_QUESTIONS } from "@/lib/export-limits";
import { fetchExplanation } from "@/lib/explanation-client";
import type { Explanation } from "@/lib/explanation-format";
import { hasFreeTier, isPreviewQuestion } from "@/lib/access";
import { BANK_CATALOG } from "@/lib/catalog";
import { bankYearFacts, upgradeHref, UPGRADE_PRICE_LABEL, UPGRADE_PRICE_MONTH, type UpgradePlacement } from "@/lib/upgrade-copy";

import { filterQuestions, questionZoneValue } from "@/lib/question-filter";
import { EXPLORER_PAGE_SIZE, parseExplorerState, serializeExplorerState, preserveClearedRoutePreset, stripRoutePreset, withRoutePreset, type ExplorerFilterKey, type ExplorerSearchParams, type ExplorerState } from "@/lib/explorer-state";
import { encodeSharedSet, parseSharedSet } from "@/lib/shared-question-set";
import { currentQuestionIds } from "@/lib/question-id-aliases";
import type { QuestionFilters, QuestionSort, UnifiedQuestion } from "@/lib/questions";
import type { AssetRequest } from "@/lib/asset-access";
import type { BankSlug } from "@/lib/banks";
import { fetchFreeAssets, fetchPdfAssets, fetchSignedAssets, PdfSignError, pdfFailureReason, isSignedAssetFresh, signAssetBatches, lapsedSignedAssetExpiry, preferSignedFreeAssets, resetFreeAssetRecovery, signedAssetKey, type SignedAsset } from "@/lib/signed-assets";
import { FREE_PUBLIC_ASSET_ORIGIN, isFreePublicAssetUrl } from "@/lib/free-asset-index";
import { pulseSuccess, shakeElement } from "@/lib/button-feedback";
import { documentHasSupabaseAuthCookie, subscribeToSessionChanges } from "@/lib/supabase/auth-cookie";
import { forgetAsset, readCachedAccess, readCachedAssets, rememberAssets, sessionFingerprint, sessionLifecycleOwner, writeCachedAccess } from "@/lib/member-session-cache";
import { mergeQuestionRichDetails, publicMetadataToQuestion, type PublicBankIndex } from "@/lib/question-index";
import { matchesCourseRoute, supportsCourseRoute, type CourseRouteSelection } from "@/lib/course-route";
import { getSubtopicGroups, getTopicOptions } from "@/lib/taxonomy-router";
import { getMathsPickerGroups, getMathsPickerTopics, isCleanMathsBank, isMathsEarlierToken } from "@/lib/maths-picker";
import { displayedQuestionSubtopics, formatMathsPickerLabel, formatPublicLabel, formatQuestionTopic } from "@/lib/presentation";
import { browserAccountId, trackProductEvent } from "@/lib/product-analytics";
import { ANONYMOUS_FREE_QUESTION_LIMIT, getFreeQuestionGate } from "@/lib/free-question-gate";
import { FreeQuestionSignupGate } from "@/components/FreeQuestionSignupGate";
import { Testimonial } from "@/components/Testimonial";
import { PDF_TESTIMONIAL } from "@/lib/testimonials";
import { FeedTeaserCard, FeedTimelineCard, PracticeMilestone, readFeedNudgeDismissed, trackUpgrade, useUpgradeView, writeFeedNudgeDismissed } from "@/components/UpgradeNudges";
import { WorksheetEditCard } from "@/components/WorksheetEditCard";
import { McqAnswerView } from "@/components/McqAnswerView";
import { SourceCropImage } from "@/components/SourceCropImage";
import { QuestionReport } from "@/components/QuestionReport";
import { fullPaperQuestionHref } from "@/lib/paper-question-links";
import "./worksheet-workspace.css";

type MultiKey = ExplorerFilterKey;


// KaTeX loads only when someone opens an explanation.
const ExplanationPanel = dynamic(() => import("@/components/ExplanationPanel"), { ssr: false, loading: () => <p className="muted" role="status">Loading explanation…</p> });
const SECONDARY_FILTER_KEYS: MultiKey[] = [
  "sessions", "components", "calculator", "subjects", "courseEras", "options", "zones", "granularLabels", "officialCodeRefs", "retrievalFacets",
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
const EMPTY_STUDY_STATE: ExplorerStudyState = { savedIds: [], attemptedIds: [] };

/**
 * Every free/paid upsell in the explorer resolves to exactly one next action with one
 * label. Three competing calls to action (preview the full bank, view plans, sign in and
 * choose a plan) made the free funnel ambiguous; the free-only toggle it replaced still
 * lives in the Filters panel as "Free questions only".
 */
const PLANS_LABEL = "View plans";
const plansHrefFor = (authenticated: boolean) => (authenticated ? "/pricing" : "/login?next=/pricing");
const subscribeToNothing = () => () => {};
/** Which store served a failed image; hostnames and signatures never leave the browser. */
function assetHost(url: string | undefined) {
  try {
    const host = new URL(url ?? "").hostname;
    return host.endsWith(".r2.cloudflarestorage.com") ? "r2" : host.endsWith(".supabase.co") ? "supabase" : host === new URL(FREE_PUBLIC_ASSET_ORIGIN).hostname ? "free" : host === window.location.hostname ? "self" : "other";
  } catch { return "unknown"; }
}
// R2 signing never checks an object exists, so a missing image is only visible here.
function trackAssetLoadFailure(bank: string, questionId: string, kind: "question" | "answer", outcome: "expired_resign" | "public_fallback" | "failed", url: string | undefined) {
  trackProductEvent("asset_load_failed", { bank, question_id: questionId.slice(0, 120), kind, outcome, host: assetHost(url), user_id: browserAccountId() });
}
const hydratedSnapshot = () => true;
const serverSnapshot = () => false;
const SESSION_ORDER = ["feb", "mar", "may", "jun", "oct", "nov"];
const sessionRank = (session: string) => Math.max(0, SESSION_ORDER.findIndex((key) => session.toLowerCase().includes(key)));
const questionTopicLabel = (question: UnifiedQuestion) => formatQuestionTopic(question.bankSlug, question.primaryTopic);

const readAuthCookiePresent = () => documentHasSupabaseAuthCookie(document.cookie);
/** Which signed-in/out period this page belongs to; unchanged by token refreshes. */
const cacheOwner = (): string | null => sessionLifecycleOwner(document.cookie);
/** Private caches follow the exact login cookie; null means don't reuse anything. */
const privateCacheOwner = (): string | null => sessionFingerprint(document.cookie);
const serverHasNoAuthCookie = () => false;
const anonymousAccess: ExplorerAccess = { authenticated: false, bankAccess: false, canExportPdf: false };
const dailyDownloadLimitMessage = "Daily download limit reached. Try again tomorrow.";
/** Preserve only approved guidance, never private storage or upstream error details. */
const assetFailureMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message === dailyDownloadLimitMessage ? dailyDownloadLimitMessage : fallback;

/** Modal basics shared by the explorer's small dialogs: body scroll lock, Escape to close, Tab kept inside. */
function trapDialogFocus(dialog: HTMLElement | null, onClose: () => void) {
  const previousOverflow = document.body.style.overflow;
  document.body.style.overflow = "hidden";
  const focusable = () => [...(dialog?.querySelectorAll<HTMLElement>("button:not([disabled]), a[href]") ?? [])];
  focusable()[0]?.focus();
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
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
  };
}

export function QuestionExplorer(props: Parameters<typeof SessionQuestionExplorer>[0]) {
  const subscribeToOwner = useCallback((listener: () => void) => subscribeToSessionChanges(listener), []);
  const observedOwner = useSyncExternalStore(subscribeToOwner, cacheOwner, () => null);
  const hydrated = useSyncExternalStore(subscribeToNothing, hydratedSnapshot, serverSnapshot);
  const [initialOwner] = useState(() => typeof document === "undefined" ? null : cacheOwner());
  const owner = hydrated ? observedOwner : initialOwner;
  const ownerChanged = owner !== initialOwner;
  // Signing in or out remounts the explorer: links, rich details, answers, study state and
  // pending work all reset together, and late responses from before are discarded. Token
  // refreshes keep the same owner, so an open page is left alone.
  const safeQuestions = useMemo(() => ownerChanged ? props.questions.map((question) => (
    isPreviewQuestion(question.bankSlug, question.id) ? question : {
      ...question, summary: "", accessibleText: "", solution: null,
      sourceQuestionUrl: null, sourceMarkSchemeUrl: null,
    }
  )) : props.questions, [ownerChanged, props.questions]);
  return <SessionQuestionExplorer {...props} key={`${props.bankSlug ?? props.questions[0]?.bankSlug}:${owner ?? "unknown"}`}
    questions={safeQuestions} access={ownerChanged ? anonymousAccess : props.access}
    studyState={ownerChanged ? EMPTY_STUDY_STATE : props.studyState}
    exportMarker={ownerChanged ? undefined : props.exportMarker} />;
}

function SessionQuestionExplorer({
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
  routePreset,
  fullPaperHrefs,
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
  /** Filters a topic or paper route implies, e.g. `{ topic: "Algebra and graphs" }`. */
  routePreset?: ExplorerSearchParams;
  /** Paper key -> free full-paper page; cards link back to the whole paper when present. */
  fullPaperHrefs?: Record<string, string>;
}) {
  const [scopeOwner] = useState(() => typeof document === "undefined" ? null : cacheOwner());
  const activeScopeRef = useRef(true);
  useEffect(() => {
    activeScopeRef.current = true;
    return () => { activeScopeRef.current = false; };
  }, []);
  const scopeIsCurrent = useCallback(() => activeScopeRef.current && cacheOwner() === scopeOwner, [scopeOwner]);
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
  // A topic page lists everything tagged with its topic; the bank page keeps to main topics.
  const topicPage = Boolean(routePreset?.topic);
  const [partialTopics, setPartialTopics] = useState(Boolean(initialState.partialTopics));
  const [courseRoute, setCourseRoute] = useState<CourseRouteSelection>(initialState.courseRoute);
  const [showAllSubtopics, setShowAllSubtopics] = useState(false);
  const [showMoreFilters, setShowMoreFilters] = useState(() => (
    SECONDARY_FILTER_KEYS.some((key) => Boolean(initialState.filters[key]?.length))
  ));
  const [selectedIds, setSelectedIds] = useState(new Set<string>());
  const [selectionIsExplicit, setSelectionIsExplicit] = useState(false);
  // Static bank HTML never sees the query string, so ignore it while hydrating (React #418)
  // and switch to it in the re-render straight after. Client navigations read it at once.
  const hydrated = useSyncExternalStore(subscribeToNothing, hydratedSnapshot, serverSnapshot);
  const [mountSearch] = useState(() => typeof window === "undefined" ? "" : window.location.search);
  const mountParams = useMemo(() => new URLSearchParams(hydrated ? mountSearch : ""), [hydrated, mountSearch]);
  const worksheetId = mountParams.get("worksheet") ?? "";
  const [worksheetRevision, setWorksheetRevision] = useState(0);
  const [chosenWorksheetMode, setWorksheetMode] = useState<"view" | "edit" | null>(null);
  const worksheetMode = chosenWorksheetMode ?? (mountParams.get("mode") === "edit" ? "edit" : "view");
  const [addingQuestions, setAddingQuestions] = useState(false);
  const [worksheetName, setWorksheetName] = useState("");
  const [worksheetStatus, setWorksheetStatus] = useState("");
  const [worksheetSaving, setWorksheetSaving] = useState(false);
  const [pendingWorksheetAction, setPendingWorksheetAction] = useState<{ kind: "view" | "link" | "back" | "pdf"; href?: string } | null>(null);
  const [failedLeaveSave, setFailedLeaveSave] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const allowWorksheetExitRef = useRef(false);
  const worksheetGuardUrlRef = useRef("");
  const worksheetGuardActiveRef = useRef(false);
  const [savedWorksheet, setSavedWorksheet] = useState<{ href: string; title: string } | null>(null);
  const worksheetSavingRef = useRef(false);
  const [worksheetLoadFailed, setWorksheetLoadFailed] = useState(false);
  const [worksheetLoading, setWorksheetLoading] = useState(false);
  const [worksheetBaseline, setWorksheetBaseline] = useState("");
  const [loadedWorksheetReady, setWorksheetReady] = useState<boolean | null>(null);
  const worksheetReady = loadedWorksheetReady ?? !worksheetId;
  const [pdfOpen, setPdfOpen] = useState(false);
  const [pdfUpgradeOpen, setPdfUpgradeOpen] = useState(false);
  /** Signed-out visitors see study tools; using one asks them to sign in (and remembers a question to save). */
  const [signinPrompt, setSigninPrompt] = useState<null | { reason: "save"; questionId: string } | { reason: "saved-filter" }>(null);
  const [pdfContent, setPdfContent] = useState<PdfContent>("both");
  // Questions-and-answers downloads ask where answers go once Download is pressed.
  const [placementPromptOpen, setPlacementPromptOpen] = useState(false);
  const [largeExportPlacement, setLargeExportPlacement] = useState<PdfAnswerPlacement | null>(null);
  const exportingRef = useRef(0); // run number of the export in progress, 0 when idle
  const [pdfStatus, setPdfStatus] = useState("");
  const [pdfStatusKind, setPdfStatusKind] = useState<"progress" | "success" | "error" | "cancelled">("progress");
  const shareButtonRef = useRef<HTMLButtonElement>(null);
  const [signedAssets, setSignedAssets] = useState(new Map<string, SignedAsset>());
  const signingAssetKeysRef = useRef(new Set<string>());
  const [failedAssetKeys, setFailedAssetKeys] = useState(new Set<string>());
  const [assetError, setAssetError] = useState("");
  const [assetEpoch, setAssetEpoch] = useState(() => Date.now());
  // Signed URLs last 10 minutes. A lazy image scrolled into view after that fails, so re-sign
  // it once per expired URL instead of re-signing every visible question on a timer, which
  // would spend the daily signed-asset allowance on images that already loaded.
  const resignedExpiryRef = useRef(new Map<string, number>());
  const [savedIds, setSavedIds] = useState(new Set(studyState.savedIds));
  const [studyStateLoaded, setStudyStateLoaded] = useState(false);
  const [attemptedIds, setAttemptedIds] = useState(new Set(studyState.attemptedIds));
  const [studyError, setStudyError] = useState("");
  const [shareStatus, setShareStatus] = useState("");
  const [sharedIds, setSharedIds] = useState<string[] | null>(null);
  const [sharedError, setSharedError] = useState("");
  const [resolvedAccess, setResolvedAccess] = useState(access);
  const [resolvedExportMarker, setResolvedExportMarker] = useState(exportMarker);
  const titleLookupRef = useRef(0);
  const nameTypedRef = useRef(false);
  const [locationHydrated, setLocationHydrated] = useState(!hydrateFromLocation);
  const [bootstrapPending, setBootstrapPending] = useState(Boolean(bootstrapUrl));
  const [identityResolved, setIdentityResolved] = useState(!bootstrapUrl);
  // Server HTML assumes no session; the browser reads the real cookie without a hydration mismatch.
  const authCookiePresent = useSyncExternalStore(subscribeToNothing, readAuthCookiePresent, serverHasNoAuthCookie);
  const filterTriggerRef = useRef<HTMLButtonElement>(null);
  const filterDialogRef = useRef<HTMLElement>(null);
  const pdfTriggerRef = useRef<HTMLButtonElement>(null);
  const pdfBuildButtonRef = useRef<HTMLButtonElement>(null);
  const pdfStatusRef = useRef<HTMLElement>(null);
  // Bumped to start or cancel a download; a build whose number is stale stops at its next step.
  const pdfRunRef = useRef(0);
  const pdfDialogRef = useRef<HTMLElement>(null);
  const pdfUpgradeDialogRef = useRef<HTMLElement>(null);
  const signinPromptRef = useRef<HTMLElement>(null);
  const pendingSaveRef = useRef<string | null>(null);
  /** Saves confirmed since the page loaded; an older bootstrap snapshot must not undo them. */
  const savedEditsRef = useRef(new Map<string, boolean>());
  const worksheetUnsavedDialogRef = useRef<HTMLElement>(null);
  const explorerRootRef = useRef<HTMLElement>(null);

  const bank = bankSlug ?? questions[0]?.bankSlug;
  const routeSupported = supportsCourseRoute(bank);
  const effectiveCourseRoute: CourseRouteSelection = routeSupported ? courseRoute : "all";
  const isCambridge = bank === "igcse" || bank === "igcse-additional";
  const calculatorFilter = (CALCULATOR_FILTER_BANKS as readonly string[]).includes(bank);
  const plansHref = plansHrefFor(resolvedAccess.authenticated);
  // Static bank pages render the anonymous view (free filter, free strip) so nothing shifts for
  // most visitors. A browser holding a session cookie keeps the strip but withholds the
  // provisional free filter until its member bootstrap resolves; the filter never applies to an
  // entitled account (including manual/complimentary entitlements).
  const provisional = bootstrapPending && authCookiePresent;
  // A bank without a free tier has nothing to filter to; it always shows the full, locked bank.
  const bankHasFreeTier = bank ? hasFreeTier(bank as BankSlug) : true;
  const effectiveFreeOnly = freeOnly && bankHasFreeTier && !provisional && !resolvedAccess.bankAccess;
  const subtopicGroups = useMemo(
    () => isCleanMathsBank(bank) ? getMathsPickerGroups(catalogQuestions, filters.topics ?? [], filters.subtopics ?? []) : getSubtopicGroups(catalogQuestions, filters.topics ?? [], filters.subtopics ?? []),
    [catalogQuestions, filters.topics, filters.subtopics, bank],
  );
  const cleanMaths = isCleanMathsBank(bank);
  const subtopicsCollapsed = !filters.topics?.length && !showAllSubtopics;
  const keepSelectedSubtopics = (values: string[]) => subtopicsCollapsed ? values.filter((value) => (filters.subtopics ?? []).includes(value)) : values;
  const visibleSubtopics = keepSelectedSubtopics(cleanMaths
    ? subtopicGroups.relevant.filter(value => !isMathsEarlierToken(value))
    : filters.topics?.length
      ? showAllSubtopics ? subtopicGroups.all : [...subtopicGroups.relevant, ...subtopicGroups.selectedOutsideContext]
      : subtopicGroups.all);
  const earlierSubtopics = keepSelectedSubtopics(cleanMaths && "earlier" in subtopicGroups && Array.isArray(subtopicGroups.earlier) ? subtopicGroups.earlier : []);
  const routeScopedQuestions = useMemo(
    () => catalogQuestions.filter((question) => matchesCourseRoute(question.syllabusRoute, effectiveCourseRoute)),
    [catalogQuestions, effectiveCourseRoute],
  );
  const options = useMemo(() => ({
    topics: isCleanMathsBank(bank) ? getMathsPickerTopics(catalogQuestions) : getTopicOptions(catalogQuestions),
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
  }), [catalogQuestions, routeScopedQuestions, bank]);

  const matching = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase();
    const remoteSearch = Boolean(
      bankSlug && normalizedSearch && indexLoaded && searchResult?.query === normalizedSearch,
    );
    const routeQuestions = catalogQuestions.filter((question) => matchesCourseRoute(question.syllabusRoute, effectiveCourseRoute));
    return remoteSearch
      ? filterQuestions(routeQuestions, { ...filters, mainTopicOnly: !partialTopics, search: undefined, sort })
        .filter((question) => searchResult!.ids.has(question.id))
      : filterQuestions(routeQuestions, { ...filters, mainTopicOnly: !partialTopics, search, sort });
  }, [bankSlug, catalogQuestions, effectiveCourseRoute, filters, indexLoaded, partialTopics, search, searchResult, sort]);
  const filtered = useMemo(() => {
    const accessible = effectiveFreeOnly ? matching.filter((question) => isPreviewQuestion(question.bankSlug, question.id)) : matching;
    return savedOnly ? accessible.filter((question) => savedIds.has(question.id)) : accessible;
  }, [effectiveFreeOnly, matching, savedIds, savedOnly]);
  const savedWorksheetView = Boolean(worksheetId) && !addingQuestions;
  const sharedSetView = !worksheetId && (sharedIds !== null || Boolean(sharedError));
  const sharedSetQuestions = useMemo(() => {
    if (!sharedIds || (indexUrl && !indexLoaded) || indexError || bootstrapPending) return [];
    const byId = new Map(catalogQuestions.map((question) => [question.id, question]));
    const ordered = sharedIds.flatMap((id) => { const question = byId.get(id); return question ? [question] : []; });
    return [
      ...ordered.filter((question) => isPreviewQuestion(question.bankSlug, question.id)),
      ...ordered.filter((question) => !isPreviewQuestion(question.bankSlug, question.id)),
    ];
  }, [sharedIds, indexUrl, indexLoaded, indexError, bootstrapPending, catalogQuestions]);
  const missingSharedCount = sharedIds && (!indexUrl || indexLoaded) && !indexError ? sharedIds.length - sharedSetQuestions.length : 0;
  const savedSetQuestions = useMemo(() => {
    if (!worksheetReady || worksheetLoadFailed || bootstrapPending || !resolvedAccess.bankAccess) return [];
    const byId = new Map(catalogQuestions.map((question) => [question.id, question]));
    return [...selectedIds].flatMap((id) => { const question = byId.get(id); return question ? [question] : []; });
  }, [worksheetReady, worksheetLoadFailed, bootstrapPending, resolvedAccess.bankAccess, catalogQuestions, selectedIds]);
  const resultQuestions = useMemo(() => sharedSetView
    ? sharedError || missingSharedCount ? [] : sharedSetQuestions
    : savedWorksheetView ? savedSetQuestions : filtered,
  [sharedSetView, sharedError, missingSharedCount, sharedSetQuestions, savedWorksheetView, savedSetQuestions, filtered]);
  const anonymous = !resolvedAccess.authenticated && !resolvedAccess.bankAccess;
  const matchingFreeCount = resultQuestions.filter((question) => isPreviewQuestion(question.bankSlug, question.id)).length;
  const accessResolved = locationHydrated && !bootstrapPending;
  const freeGate = getFreeQuestionGate({ resolved: accessResolved, authenticated: resolvedAccess.authenticated, bankAccess: resolvedAccess.bankAccess, freeOnly, freeQuestionCount: matchingFreeCount });
  const shownQuestions = useMemo(() => {
    if (!locationHydrated) {
      // Static HTML: the anonymous default (free filter, default sort) the server already computed.
      return hydrateFromLocation && !localPreview ? questions.slice(0, Math.min(visible, ANONYMOUS_FREE_QUESTION_LIMIT)) : [];
    }
    if (sharedSetView && (sharedError || Boolean(missingSharedCount))) return [];
    if (!anonymous) return savedWorksheetView || sharedSetView ? resultQuestions : resultQuestions.slice(0, visible);
    if (savedWorksheetView) return [];
    const freeLimit = freeGate.visibleCount;
    let freeShown = 0;
    const safeSample = resultQuestions.filter((question) => {
      if (!isPreviewQuestion(question.bankSlug, question.id)) return accessResolved;
      if (freeShown >= freeLimit) return false;
      freeShown += 1;
      return true;
    });
    return safeSample.slice(0, visible);
  }, [accessResolved, anonymous, freeGate.visibleCount, hydrateFromLocation, localPreview, locationHydrated, missingSharedCount, questions, visible, resultQuestions, savedWorksheetView, sharedError, sharedSetView]);
  const returnPath = hydrated ? `${window.location.pathname}${window.location.search}` : "/";
  const signupHref = `/login?mode=sign-up&next=${encodeURIComponent(returnPath)}`;
  const signinHref = `/login?next=${encodeURIComponent(returnPath)}`;
  const promptReturnPath = (() => {
    if (!signinPrompt || !hydrated) return returnPath;
    const params = new URLSearchParams(window.location.search);
    if (signinPrompt.reason === "save") params.set("save", signinPrompt.questionId); else params.set("saved", "1");
    return `${window.location.pathname}?${params}`;
  })();
  const openSigninPrompt = (prompt: NonNullable<typeof signinPrompt>) => {
    // One modal at a time: Filters closes first, so it releases its scroll lock and Escape before the prompt takes them.
    setFiltersOpen(false);
    setSigninPrompt(prompt);
    trackProductEvent("study_signin_prompt", { bank: bank ?? "unknown", reason: prompt.reason });
  };
  // Upgrade nudges: only for people without this bank, on the normal bank view.
  const nudgesActive = Boolean(bank) && !provisional && !resolvedAccess.bankAccess && hasFreeTier(bank as BankSlug) && !worksheetId && !sharedSetView;
  const nudgeBank = bank ?? "unknown";
  const yearFacts = useMemo(() => bank ? bankYearFacts(bank) : null, [bank]);
  const upgradeLink = (placement: UpgradePlacement) => bank ? upgradeHref(bank, placement) : upgradeHref("", placement);
  const bankShortName = BANK_CATALOG.find((entry) => entry.slug === bank)?.shortName ?? "bank";
  const paidCount = useMemo(() => catalogQuestions.filter((question) => !isPreviewQuestion(question.bankSlug, question.id)).length, [catalogQuestions]);
  // The catalogue starts as the server's first-page sample; only a fully loaded index is the whole bank.
  const bankFreeCount = indexLoaded && !indexError ? catalogQuestions.length - paidCount : undefined;
  const teaserPool = useMemo(() => nudgesActive && effectiveFreeOnly
    ? matching.filter((question) => !isPreviewQuestion(question.bankSlug, question.id)).sort((a, b) => b.year - a.year || sessionRank(b.session) - sessionRank(a.session))
    : [], [nudgesActive, effectiveFreeOnly, matching]);
  const storedFeedDismissed = useSyncExternalStore(subscribeToNothing, readFeedNudgeDismissed, () => false);
  const [feedDismissedNow, setFeedDismissedNow] = useState(false);
  // Wait for the full index: before it loads only the server sample is known, so there is nothing true to tease or count.
  const feedNudges = nudgesActive && effectiveFreeOnly && indexLoaded && !storedFeedDismissed && !feedDismissedNow;
  const [sentUpgradeViews] = useState(() => new Set<string>()); // stable for the page; views are recorded, not rendered
  const resultsHeadingRef = useRef<HTMLDivElement>(null);
  const dismissFeedNudges = () => { writeFeedNudgeDismissed(); setFeedDismissedNow(true); resultsHeadingRef.current?.focus({ preventScroll: true }); };
  const renderFeedSlot = (position: number, isLast: boolean) => {
    if (!feedNudges) return null;
    const slot = position === 3 ? 0 : position > 3 && (position - 3) % 5 === 0 ? (position - 3) / 5 : -1;
    if (slot < 0 || (isLast && position !== 3)) return null;
    if (slot % 2 === 0) {
      // No matching paid question: skip the slot rather than repeat the timeline card.
      const teaser = teaserPool[slot / 2];
      return teaser ? <FeedTeaserCard bank={nudgeBank} question={teaser} topicLabel={questionTopicLabel(teaser)} href={upgradeLink("feed_teaser")} slot={slot} sentViews={sentUpgradeViews} onDismiss={dismissFeedNudges} /> : null;
    }
    return yearFacts ? <FeedTimelineCard bank={nudgeBank} shortName={bankShortName} facts={yearFacts} href={upgradeLink("feed_timeline")} slot={slot} sentViews={sentUpgradeViews} onDismiss={dismissFeedNudges} /> : null;
  };
  const [milestoneQuestionId, setMilestoneQuestionId] = useState("");
  const recordReveal = (questionId: string) => {
    if (!scopeIsCurrent() || !nudgesActive) return;
    try {
      const revealedKey = `ppp:revealed:${nudgeBank}`;
      const shownKey = `ppp:milestone-shown:${nudgeBank}`;
      if (window.localStorage.getItem(shownKey)) return;
      const revealed = new Set<string>(JSON.parse(window.localStorage.getItem(revealedKey) ?? "[]"));
      if (revealed.has(questionId)) return;
      revealed.add(questionId);
      window.localStorage.setItem(revealedKey, JSON.stringify([...revealed]));
      if (revealed.size >= 10) {
        window.localStorage.removeItem(revealedKey);
        window.localStorage.setItem(shownKey, "1");
        setMilestoneQuestionId(questionId);
      }
    } catch { /* storage unavailable: no milestone */ }
  };
  const topNoteViewRef = useUpgradeView(nudgeBank, "top_note");
  const lockedViewSentRef = useRef(false);
  const showsLockedCard = nudgesActive && shownQuestions.some((question) => !isPreviewQuestion(question.bankSlug, question.id));
  useEffect(() => {
    if (!showsLockedCard || lockedViewSentRef.current) return;
    lockedViewSentRef.current = true;
    trackUpgrade("view", nudgeBank, "locked_card");
  }, [showsLockedCard, nudgeBank]);
  const activeCount = Object.values(filters).reduce((count, values) => count + (values?.length ?? 0), (effectiveFreeOnly ? 1 : 0) + (savedOnly ? 1 : 0));
  // Free-year questions sign through the cookie-less, CDN-cached route as soon as the URL state
  // is known; only locked questions wait for the member bootstrap.
  const freeAssetRequests = useMemo(() => !locationHydrated || localPreview ? [] : shownQuestions
    .filter((question) => isPreviewQuestion(question.bankSlug, question.id))
    .filter((question) => !failedAssetKeys.has(signedAssetKey(question.id, "question")))
    .filter((question) => !isSignedAssetFresh(signedAssets.get(signedAssetKey(question.id, "question")), assetEpoch))
    .map((question) => ({ questionId: question.id, kind: "question" as const })),
  [locationHydrated, localPreview, assetEpoch, failedAssetKeys, shownQuestions, signedAssets]);
  const questionAssetRequests = useMemo(() => bootstrapPending || !locationHydrated ? [] : shownQuestions
    .filter((question) => localPreview
      ? resolvedAccess.bankAccess || isPreviewQuestion(question.bankSlug, question.id)
      : resolvedAccess.bankAccess && !isPreviewQuestion(question.bankSlug, question.id))
    .filter((question) => !failedAssetKeys.has(signedAssetKey(question.id, "question")))
    .filter((question) => !isSignedAssetFresh(signedAssets.get(signedAssetKey(question.id, "question")), assetEpoch))
    .map((question) => ({ questionId: question.id, kind: "question" as const })),
  [bootstrapPending, locationHydrated, localPreview, resolvedAccess.bankAccess, assetEpoch, failedAssetKeys, shownQuestions, signedAssets]);

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
      const next = parseExplorerState(routePreset && !locationParams.has("set") && !locationParams.has("worksheet") ? withRoutePreset(raw, routePreset) : raw, { defaultFreeOnly: !access.bankAccess && (bank ? hasFreeTier(bank as BankSlug) : true), defaultPartialTopics: Boolean(routePreset?.topic) });
      if (locationParams.has("set") && !locationParams.has("worksheet")) {
        try { setSharedIds(currentQuestionIds(bank ?? "", parseSharedSet(locationParams.get("set") ?? ""))); setSharedError(""); }
        catch { setSharedIds(null); setSharedError("This shared question link is invalid."); }
      }
      setSearch(next.search);
      setSort(next.sort);
      setFilters(next.filters);
      setVisible(next.visible);
      setFreeOnly(next.freeOnly);
      setSavedOnly(next.savedOnly);
      setPartialTopics(Boolean(next.partialTopics));
      setCourseRoute(supportsCourseRoute(bank) ? next.courseRoute : "all");
      setShowMoreFilters(SECONDARY_FILTER_KEYS.some((key) => Boolean(next.filters[key]?.length)));
      setLocationHydrated(true);
    });
    return () => { cancelled = true; };
  }, [access.bankAccess, bank, hydrateFromLocation, routePreset]);

  useEffect(() => {
    if (!bootstrapUrl) return;
    let cancelled = false;
    if (!documentHasSupabaseAuthCookie(document.cookie)) {
      // No session cookie: the server would answer "anonymous" without touching Supabase.
      queueMicrotask(() => {
        if (cancelled || !scopeIsCurrent()) return;
        setResolvedAccess({ authenticated: false, bankAccess: false, canExportPdf: false });
        setIdentityResolved(true);
        setResolvedExportMarker(undefined);
        setBootstrapPending(false);
      });
      return () => { cancelled = true; };
    }
    // A member's access for this bank, remembered by this tab: show and sign straight away,
    // then confirm in the background. The server still checks every paid request.
    const owner = privateCacheOwner();
    const cached = bank && owner ? readCachedAccess(bank, owner) : null;
    if (cached) {
      queueMicrotask(() => {
        if (cancelled || !scopeIsCurrent()) return;
        setResolvedAccess(cached.access);
        setResolvedExportMarker(cached.exportMarker);
        if (cached.access.bankAccess) setFreeOnly(false);
        setBootstrapPending(false);
      });
    }
    fetch(bootstrapUrl, { cache: "no-store", credentials: "same-origin" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Member state unavailable");
        return response.json() as Promise<{ access: ExplorerAccess; exportMarker?: string; studyState: ExplorerStudyState; studyStateUnavailable?: boolean }>;
      })
      .then((payload) => {
        if (cancelled || !scopeIsCurrent()) return;
        if (!payload?.access || !payload?.studyState || !Array.isArray(payload.studyState.savedIds) || !Array.isArray(payload.studyState.attemptedIds)) {
          throw new Error("Invalid member state");
        }
        setIdentityResolved(true);
        setResolvedAccess(payload.access);
        setResolvedExportMarker(payload.exportMarker);
        if (bank && owner) writeCachedAccess(bank, owner, { access: payload.access, ...(payload.exportMarker ? { exportMarker: payload.exportMarker } : {}) });
        const snapshot = new Set(payload.studyState.savedIds);
        for (const [questionId, saved] of savedEditsRef.current) if (saved) snapshot.add(questionId); else snapshot.delete(questionId);
        setSavedIds(snapshot);
        setStudyStateLoaded(true);
        setAttemptedIds(new Set(payload.studyState.attemptedIds));
        if (payload.studyStateUnavailable) {
          setStudyError("Saved and attempted question state could not load. Your bank access is unaffected.");
        }
        if (payload.access.bankAccess) setFreeOnly(false);
      })
      .catch(() => {
        if (cancelled || !scopeIsCurrent()) return;
        setIdentityResolved(true);
        setResolvedAccess({ authenticated: false, bankAccess: false, canExportPdf: false });
        setResolvedExportMarker(undefined);
        setFreeOnly(bank ? hasFreeTier(bank as BankSlug) : true);
      })
      .finally(() => {
        if (!cancelled && scopeIsCurrent()) setBootstrapPending(false);
      });
    return () => { cancelled = true; };
  }, [bank, bootstrapUrl, scopeIsCurrent]);

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

    // Visitors already have their first questions in the HTML, so the full index waits for idle
    // time. A signed-in member's paid questions only exist in the index, so load it now.
    const member = readAuthCookiePresent();
    const idleId = !member && typeof window.requestIdleCallback === "function"
      ? window.requestIdleCallback(loadIndex, { timeout: 800 })
      : undefined;
    if (member) loadIndex();
    else if (idleId === undefined) fallbackTimer = window.setTimeout(loadIndex, 200);

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
    const trigger = pdfTriggerRef.current;
    const release = trapDialogFocus(pdfUpgradeDialogRef.current, () => setPdfUpgradeOpen(false));
    return () => { release(); trigger?.focus(); };
  }, [pdfUpgradeOpen]);

  useEffect(() => {
    if (!signinPrompt) return;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const release = trapDialogFocus(signinPromptRef.current, () => setSigninPrompt(null));
    return () => { release(); trigger?.focus(); };
  }, [signinPrompt]);

  useEffect(() => {
    const questionId = new URLSearchParams(window.location.search).get("save");
    if (questionId && /^[A-Za-z0-9._:-]{1,120}$/.test(questionId)) pendingSaveRef.current = questionId;
  }, []);


  useEffect(() => {
    if (!locationHydrated || bootstrapPending) return;
    const query = sharedSetView ? new URLSearchParams(window.location.search) : serializeExplorerState({ search, sort, filters, freeOnly: effectiveFreeOnly, savedOnly, courseRoute: effectiveCourseRoute, visible, partialTopics }, { persistFreeChoice: !resolvedAccess.bankAccess, defaultPartialTopics: topicPage });
    const params = routePreset && !sharedSetView && !worksheetId ? stripRoutePreset(preserveClearedRoutePreset(new URLSearchParams(query), routePreset), routePreset) : new URLSearchParams(query);
    if (worksheetId) { params.set("worksheet", worksheetId); if (worksheetMode === "edit") params.set("mode", "edit"); }
    const nextUrl = `${window.location.pathname}${params.size ? `?${params}` : ""}${window.location.hash}`;
    window.history.replaceState(window.history.state, "", nextUrl);
  }, [bootstrapPending, effectiveCourseRoute, effectiveFreeOnly, filters, locationHydrated, partialTopics, resolvedAccess.bankAccess, routePreset, savedOnly, search, sharedSetView, sort, topicPage, visible, worksheetId, worksheetMode]);

  const applySignedAssets = (assets: Map<string, SignedAsset>, owner: string | null) => {
    if (!scopeIsCurrent() || !assets.size) return;
    if (bank && owner) rememberAssets(owner, bank, assets);
    setSignedAssets((current) => new Map([...current, ...assets]));
    const detailsById = new Map([...assets.values()].flatMap((asset) => asset.details ? [[asset.questionId, asset.details] as const] : []));
    if (detailsById.size) {
      setCatalogQuestions((current) => current.map((question) => {
        const details = detailsById.get(question.id);
        return details ? mergeQuestionRichDetails(question, details) : question;
      }));
    }
  };

  /**
   * Signs what isn't signed yet: links this session already holds are reused (no request, no
   * allowance spent), free-year assets use the CDN-cached route, and the rest use the paid signer.
   */
  const signAssets = (requests: readonly AssetRequest[], route: "free" | "paid", speculative = false) => {
    if (!bank || !scopeIsCurrent()) return;
    const owner = privateCacheOwner();
    const remembered = owner ? readCachedAssets(owner, bank) : new Map<string, SignedAsset>();
    const pending = requests.filter((request) => !signingAssetKeysRef.current.has(signedAssetKey(request.questionId, request.kind)));
    const reused = new Map(pending.flatMap((request) => {
      const key = signedAssetKey(request.questionId, request.kind);
      const asset = remembered.get(key);
      return asset ? [[key, asset] as const] : [];
    }));
    applySignedAssets(reused, owner);
    const toSign = pending.filter((request) => !reused.has(signedAssetKey(request.questionId, request.kind)));
    if (!toSign.length) return;
    const pendingKeys = toSign.map((request) => signedAssetKey(request.questionId, request.kind));
    for (const key of pendingKeys) signingAssetKeysRef.current.add(key);
    const finished = () => { if (!scopeIsCurrent()) return; for (const key of pendingKeys) signingAssetKeysRef.current.delete(key); };
    if (route === "free") {
      let failedPrefetch = false;
      fetchFreeAssets(bank, toSign)
        .then(({ assets, failedKeys }) => {
          if (!scopeIsCurrent()) return;
          applySignedAssets(assets, owner);
          failedPrefetch = speculative && failedKeys.length > 0;
          if (failedKeys.length && !speculative) {
            setFailedAssetKeys((current) => new Set([...current, ...failedKeys]));
            setAssetError("Some question images could not load.");
          }
        })
        .finally(() => {
          if (!scopeIsCurrent()) return;
          finished();
          // Activation may have happened while the speculative request was pending.
          // Release its keys and re-evaluate visible demand; offscreen failures stay quiet.
          if (failedPrefetch) setAssetEpoch((current) => Math.max(Date.now(), current + 1));
        });
      return;
    }
    // Each batch shows as it lands; only a failed batch's keys are marked for retry.
    const delivered = new Set<string>();
    signAssetBatches(bank, toSign, { localPreview, isCurrent: scopeIsCurrent, onBatch: (assets) => {
      if (!scopeIsCurrent()) return;
      for (const key of assets.keys()) delivered.add(key);
      applySignedAssets(assets, owner);
    } })
      .then(({ failedKeys, error }) => {
        if (!scopeIsCurrent()) return;
        if (!failedKeys.length) { setAssetError(""); return; }
        setFailedAssetKeys((current) => new Set([...current, ...failedKeys]));
        setAssetError(assetFailureMessage(error, "Some question images could not load."));
      })
      .catch(() => {
        if (!scopeIsCurrent()) return;
        setFailedAssetKeys((current) => new Set([...current, ...pendingKeys.filter((key) => !delivered.has(key))]));
        setAssetError("Some question images could not load.");
      })
      .finally(finished);
  };

  // signAssets only reads refs and calls state setters.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { signAssets(questionAssetRequests, "paid"); }, [bank, localPreview, questionAssetRequests]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { signAssets(freeAssetRequests, "free"); }, [bank, freeAssetRequests]);

  /** A member about to press "Show 24 more": sign that page now so it appears signed. */
  const prefetchNextPage = () => {
    if (!locationHydrated || bootstrapPending || anonymous || localPreview) return;
    const unsigned = resultQuestions.slice(visible, visible + EXPLORER_PAGE_SIZE)
      .filter((question) => !failedAssetKeys.has(signedAssetKey(question.id, "question")))
      .filter((question) => !isSignedAssetFresh(signedAssets.get(signedAssetKey(question.id, "question"))));
    const toRequest = (questions: UnifiedQuestion[]) => questions.map((question) => ({ questionId: question.id, kind: "question" as const }));
    // Paid signatures consume a daily allowance: acquire them only on activation.
    // Free links are quota-neutral and can safely be warmed on intent.
    signAssets(toRequest(unsigned.filter((question) => isPreviewQuestion(question.bankSlug, question.id))), "free", true);
  };

  const worksheetDefinition = () => JSON.stringify({ name: worksheetName.trim(), ids: [...selectedIds], content: pdfContent });
  const worksheetDirty = worksheetId ? Boolean(worksheetMode === "edit" && worksheetBaseline && worksheetBaseline !== worksheetDefinition()) : Boolean(selectionIsExplicit && worksheetName.trim() && (worksheetBaseline ? worksheetBaseline !== worksheetDefinition() : selectedIds.size));
  useEffect(() => {
    if (!pendingWorksheetAction) return;
    const dialog = worksheetUnsavedDialogRef.current;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog?.querySelector<HTMLButtonElement>("button")?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !worksheetSavingRef.current) { event.preventDefault(); setPendingWorksheetAction(null); setFailedLeaveSave(false); setConfirmDiscard(false); return; }
      if (event.key !== "Tab" || !dialog) return;
      const buttons = [...dialog.querySelectorAll<HTMLButtonElement>("button:not(:disabled)")];
      if (event.shiftKey && document.activeElement === buttons[0]) { event.preventDefault(); buttons.at(-1)?.focus(); }
      else if (!event.shiftKey && document.activeElement === buttons.at(-1)) { event.preventDefault(); buttons[0]?.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => { document.removeEventListener("keydown", onKeyDown); previousFocus?.focus(); };
  }, [pendingWorksheetAction]);
  useEffect(() => {
    if (!worksheetId || !indexLoaded || indexError || bootstrapPending || !identityResolved || worksheetReady) return;
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
  }, [worksheetId, indexLoaded, indexError, bootstrapPending, identityResolved, worksheetReady, worksheetBaseline, bank, catalogQuestions]);
  useEffect(() => {
    if (!worksheetDirty) return;
    const warn = (event: BeforeUnloadEvent) => { if (allowWorksheetExitRef.current) return; event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    if (worksheetId && !worksheetGuardActiveRef.current) {
      worksheetGuardUrlRef.current = window.location.href;
      window.history.pushState({ ...window.history.state, worksheetGuard: true }, "", worksheetGuardUrlRef.current);
      worksheetGuardActiveRef.current = true;
    }
    const onBack = () => {
      if (!worksheetId || allowWorksheetExitRef.current || !worksheetGuardActiveRef.current) return;
      window.history.pushState({ ...window.history.state, worksheetGuard: true }, "", worksheetGuardUrlRef.current);
      setPendingWorksheetAction({ kind: "back" });
    };
    const guard = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.target instanceof Element ? event.target.closest("a[href]") as HTMLAnchorElement | null : null;
      if (!link || link.target && link.target !== "_self" || link.hasAttribute("download") || link.href === window.location.href) return;
      if (!worksheetId) { if (!window.confirm("You have unsaved worksheet changes. Leave this page?")) event.preventDefault(); return; }
      event.preventDefault();
      event.stopPropagation();
      setPendingWorksheetAction({ kind: "link", href: link.href });
    };
    window.addEventListener("popstate", onBack);
    document.addEventListener("click", guard, true);
    return () => { window.removeEventListener("beforeunload", warn); window.removeEventListener("popstate", onBack); document.removeEventListener("click", guard, true); };
  }, [worksheetDirty, worksheetId]);
  useEffect(() => {
    if (worksheetDirty || !worksheetGuardActiveRef.current) return;
    const skipGuardEntry = () => { worksheetGuardActiveRef.current = false; window.history.back(); };
    window.addEventListener("popstate", skipGuardEntry);
    return () => window.removeEventListener("popstate", skipGuardEntry);
  }, [worksheetDirty]);

  const finishWorksheetAction = (action: NonNullable<typeof pendingWorksheetAction>) => {
    if (!scopeIsCurrent()) return;
    setPendingWorksheetAction(null);
    setFailedLeaveSave(false);
    setConfirmDiscard(false);
    if (action.kind === "view") { setAddingQuestions(false); setWorksheetMode("view"); }
    if (action.kind === "pdf") setPdfOpen(true);
    if (action.kind === "link" && action.href) { allowWorksheetExitRef.current = true; window.location.assign(action.href); }
    if (action.kind === "back") { allowWorksheetExitRef.current = true; window.history.go(-2); }
  };
  const discardWorksheetChanges = () => {
    if (!pendingWorksheetAction) return;
    if (failedLeaveSave && !confirmDiscard) { setConfirmDiscard(true); return; }
    if (worksheetId && worksheetBaseline) {
      const baseline = JSON.parse(worksheetBaseline) as { name: string; ids: string[]; content: PdfContent };
      setWorksheetName(baseline.name); setSelectedIds(new Set(baseline.ids)); setPdfContent(baseline.content);
      setWorksheetStatus("");
    }
    finishWorksheetAction(pendingWorksheetAction);
  };

  const saveWorksheet = async (): Promise<boolean> => {
    titleLookupRef.current += 1; // a lookup still in flight must not rename what is being saved
    if (!scopeIsCurrent()) return false;
    if (!bank || !resolvedAccess.bankAccess || !exportQuestions.length || !worksheetName.trim() || !worksheetReady || worksheetLoadFailed || worksheetSavingRef.current) return false;
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
      if (!scopeIsCurrent()) return false;
      const payload = await response.json();
      if (!scopeIsCurrent()) return false;
      if (!response.ok) throw new Error(payload.error || "Worksheet could not be saved. Try again.");
      const saved = payload.worksheet;
      setWorksheetName(saved.title);
      setWorksheetRevision(saved.revision);
      if (editingExisting) {
        setSelectedIds(new Set(saved.question_ids)); setSelectionIsExplicit(true);
        setWorksheetBaseline(JSON.stringify({ name: saved.title, ids: saved.question_ids, content: saved.content_mode }));
        setWorksheetStatus("Changes saved.");
      } else {
        setSavedWorksheet({ href: `/banks/${encodeURIComponent(bank)}?worksheet=${encodeURIComponent(saved.id)}`, title: saved.title });
        setSelectedIds(new Set()); setSelectionIsExplicit(false);
        setWorksheetName(""); setWorksheetBaseline("");
        setWorksheetStatus("");
        setPdfOpen(false);
      }
      return true;
    } catch (error) {
      if (scopeIsCurrent()) setWorksheetStatus(error instanceof Error ? error.message : "Worksheet could not be saved. Try again.");
      return false;
    } finally {
      worksheetSavingRef.current = false;
      if (scopeIsCurrent()) setWorksheetSaving(false);
    }
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
    setPartialTopics(topicPage);
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
    if (!locationHydrated || bootstrapPending || (indexUrl && (!indexLoaded || indexError)) || (worksheetId && (!worksheetReady || worksheetLoadFailed))) {
      setShareStatus("Couldn't share yet — wait for the questions to load and try again.");
      return;
    }
    if (!worksheetId && !selectionIsExplicit && search.trim() && bankSlug && searchResult?.query !== search.trim().toLocaleLowerCase()) {
      setShareStatus("Couldn't share yet — wait for search results and try again.");
      return;
    }
    const ids = worksheetId || selectionIsExplicit ? [...selectedIds] : filtered.map((question) => question.id);
    let shareUrl: string;
    try {
      const shareLink = new URL(window.location.pathname, window.location.origin);
      shareLink.searchParams.set("set", encodeSharedSet(ids));
      if (shareLink.href.length > 8000) throw new Error("Link too long");
      shareUrl = shareLink.href;
    } catch {
      setShareStatus("Couldn't share this set — narrow the filters or select fewer questions first.");
      return;
    }
    if (typeof navigator.share === "function" && navigator.canShare?.({ url: shareUrl })) {
      try {
        await navigator.share({ url: shareUrl, title: document.title });
        setShareStatus("Question link shared");
        pulseSuccess(shareButtonRef.current);
      } catch {
        /* the visitor dismissed the share sheet — nothing to announce */
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareStatus("Question link copied");
      pulseSuccess(shareButtonRef.current);
    } catch {
      setShareStatus("Couldn't copy — try again.");
      shakeElement(shareButtonRef.current);
    }
  };

  const retryQuestionAssets = () => {
    if (bank) resetFreeAssetRecovery(bank, catalogQuestions
      .filter((question) => question.bankSlug === bank && isPreviewQuestion(bank, question.id) && failedAssetKeys.has(signedAssetKey(question.id, "question")))
      .map((question) => ({ questionId: question.id, kind: "question" as const })));
    setAssetError("");
    setFailedAssetKeys(new Set());
    setAssetEpoch(Date.now());
  };

  const markAnswerAssetFailed = (questionId: string, asset: SignedAsset | undefined) => {
    if (!scopeIsCurrent() || !asset) return;
    const publicLinkFailed = isFreePublicAssetUrl(asset.urls[0]);
    // Attribute the failed host before removing the link. Public links retain automatic fallback.
    trackAssetLoadFailure(bank ?? "unknown", questionId, "answer", publicLinkFailed ? "public_fallback" : "failed", asset.urls[0]);
    if (publicLinkFailed) return;
    const key = signedAssetKey(questionId, "answer");
    if (bank) forgetAsset(bank, key, asset.urls[0] ?? "");
    setSignedAssets((current) => {
      if (current.get(key) !== asset) return current;
      const next = new Map(current);
      next.delete(key);
      return next;
    });
  };

  const markQuestionAssetFailed = (questionId: string) => {
    if (!scopeIsCurrent()) return;
    const key = signedAssetKey(questionId, "question");
    const expiredAt = lapsedSignedAssetExpiry(signedAssets.get(key));
    const retrying = expiredAt !== undefined && resignedExpiryRef.current.get(key) !== expiredAt;
    // A failed public free link re-queues only this question for transient signed rescue;
    // other questions keep their public links unless a second one fails (host unreachable).
    const publicLinkFailed = Boolean(bank && isFreePublicAssetUrl(signedAssets.get(key)?.urls[0]));
    trackAssetLoadFailure(bank ?? "unknown", questionId, "question", retrying ? "expired_resign" : publicLinkFailed ? "public_fallback" : "failed", signedAssets.get(key)?.urls[0]);
    if (bank && publicLinkFailed) preferSignedFreeAssets(bank, { questionId, kind: "question" });
    if (bank) forgetAsset(bank, key, signedAssets.get(key)?.urls[0] ?? "");
    setSignedAssets((current) => {
      const next = new Map(current);
      next.delete(key);
      return next;
    });
    if (publicLinkFailed) return;
    if (retrying) {
      // Dropping the stale entry puts the question back in the signing queue.
      resignedExpiryRef.current.set(key, expiredAt);
      return;
    }
    setFailedAssetKeys((current) => new Set(current).add(key));
    setAssetError("Some question images could not load.");
  };

  const updateStudyState = async (questionId: string, action: "save" | "unsave" | "attempt") => {
    if (!scopeIsCurrent() || !bank || !resolvedAccess.authenticated) return;
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
      if (!scopeIsCurrent()) return;
      savedEditsRef.current.set(questionId, saving);
      setSavedIds((current) => {
        const next = new Set(current);
        if (saving) next.add(questionId); else next.delete(questionId);
        return next;
      });
    } catch {
      setStudyError("Could not update saved questions. Try again.");
    }
  };

  // Back from signing in to save a question: save it once the account's study state has loaded.
  useEffect(() => {
    const questionId = pendingSaveRef.current;
    // Wait for the account's real study state, not the cached access that can resolve first.
    if (!questionId || !studyStateLoaded || !resolvedAccess.authenticated) return;
    pendingSaveRef.current = null;
    if (savedIds.has(questionId)) return;
    void updateStudyState(questionId, "save").then(() => {
      if (!scopeIsCurrent()) return;
      savedEditsRef.current.set(questionId, true);
      setSavedIds((current) => new Set(current).add(questionId));
    }).catch(() => setStudyError("Could not update saved questions. Try again."));
  // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once, when the signed-in study state first loads
  }, [studyStateLoaded, resolvedAccess.authenticated]);

  const recordAttempt = async (questionId: string) => {
    if (!scopeIsCurrent() || attemptedIds.has(questionId)) return;
    try {
      await updateStudyState(questionId, "attempt");
      if (!scopeIsCurrent()) return;
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

  const exportQuestions = sharedSetView ? [] : worksheetId ? savedSetQuestions : (() => {
    if (!selectionIsExplicit) return filtered.slice(0, MAX_PDF_QUESTIONS);
    const byId = new Map(catalogQuestions.map((question) => [question.id, question]));
    return [...selectedIds].map((id) => byId.get(id)).filter((question): question is UnifiedQuestion => Boolean(question)).slice(0, MAX_PDF_QUESTIONS);
  })();
  const openPdfBuilder = () => {
    if (bootstrapPending) return; // access is still unknown: a payer must not see the upgrade prompt
    if (worksheetId && (!worksheetReady || worksheetLoadFailed || !exportQuestions.length)) return;
    if (worksheetId && worksheetDirty) { setPendingWorksheetAction({ kind: "pdf" }); return; }
    if (!resolvedAccess.canExportPdf) { showPdfUpgrade(); return; }
    if (!worksheetId && !worksheetName.trim()) {
      const suggested = suggestWorksheetTitle(exportQuestions);
      setWorksheetName(suggested);
      // Number the default past the student's saved titles ("Atoms 2"). Only this dialog's own lookup
      // may apply, and never once the student has typed in the name field.
      const lookup = ++titleLookupRef.current;
      nameTypedRef.current = false;
      void fetch("/api/worksheets").then(async (response) => {
        const payload = response.ok ? await response.json() : null;
        const titles = Array.isArray(payload?.worksheets) ? payload.worksheets.map((item: { title?: unknown }) => item.title).filter((title: unknown): title is string => typeof title === "string") : [];
        if (titles.length && lookup === titleLookupRef.current && !nameTypedRef.current) setWorksheetName(suggestWorksheetTitle(exportQuestions, titles));
      }).catch(() => {});
    }
    trackProductEvent("pdf_builder_open", { bank: bank ?? "unknown", questionCount: exportQuestions.length });
    if (pdfStatusKind !== "progress") setPdfStatus(""); // drop a finished download's message, keep one still running
    setPlacementPromptOpen(false);
    setPdfOpen(true);
  };
  const requestDownload = () => {
    if (pdfContent === "both") setPlacementPromptOpen((open) => !open);
    else void handleDownload("all-answers-last");
  };
  const cancelDownload = () => {
    pdfRunRef.current += 1;
    exportingRef.current = 0;
    trackProductEvent("pdf_export_cancel", { bank: bank ?? "unknown", questionCount: exportQuestions.length, content: pdfContent, source: worksheetId ? "worksheet" : "save_dialog" });
    setPdfStatusKind("cancelled");
    setPdfStatus("Download cancelled.");
  };
  const handleDownload = async (answerPlacement: PdfAnswerPlacement, confirmedLarge = false) => {
    titleLookupRef.current += 1;
    setPlacementPromptOpen(false);
    // One export at a time: extra clicks while one is building are ignored.
    if (exportingRef.current) return;
    if (!scopeIsCurrent() || !resolvedAccess.canExportPdf || !bank || !exportQuestions.length || Boolean(worksheetId && (worksheetLoadFailed || !worksheetReady))) return;
    if (!confirmedLarge && exportQuestions.length >= LARGE_PDF_QUESTIONS) { setLargeExportPlacement(answerPlacement); return; }
    setLargeExportPlacement(null);
    trackProductEvent("pdf_export_attempt", { bank, questionCount: exportQuestions.length, content: pdfContent, source: worksheetId ? "worksheet" : "save_dialog" });
    const run = ++pdfRunRef.current;
    exportingRef.current = run;
    const live = () => scopeIsCurrent() && pdfRunRef.current === run;
    setPdfStatusKind("progress");
    setPdfStatus(`Preparing ${exportQuestions.length} questions...`);
    try {
      const [{ attachPdfAssetMetadata, downloadQuestionPdf, pdfHeldNotice }, assets] = await Promise.all([
        import("@/lib/pdf-export"),
        fetchPdfAssets(bank, exportQuestions.map((question) => question.id), pdfContent, fetch, localPreview, live),
      ]);
      if (!live()) return;
      const securedQuestions = attachPdfAssetMetadata(exportQuestions, assets);
      const result = await downloadQuestionPdf(
        securedQuestions,
        pdfContent,
        (complete, total) => {
          // The exporter reports progress before its final synchronous save; throwing
          // here also cancels a build whose image loads outlive the captured scope.
          if (!live()) throw new DOMException("PDF request scope expired", "AbortError");
          setPdfStatus(`Preparing ${complete} of ${total}...`);
        },
        resolvedExportMarker,
        answerPlacement,
        { title: worksheetName.trim() || suggestWorksheetTitle(exportQuestions), bankSlug: bank },
      );
      if (!live()) return;
      setPdfStatusKind("success");
      trackProductEvent("pdf_export_success", { bank, questionCount: exportQuestions.length, content: pdfContent, source: worksheetId ? "worksheet" : "save_dialog" });
      if (result.heldRows.length) {
        setPdfStatus(pdfHeldNotice(result.heldRows));
      } else {
        setPdfStatus(`Worksheet ready — ${exportQuestions.length} question${exportQuestions.length === 1 ? "" : "s"} downloaded.`);
        pulseSuccess(pdfBuildButtonRef.current);
        window.setTimeout(() => {
          if (!live()) return;
          setPdfOpen(false);
          setPdfStatus("");
        }, 1400);
      }
    } catch (error) {
      if (!live()) return;
      const reason = pdfFailureReason(error);
      // Hitting the daily limit is a block, not a failure; it is counted separately.
      trackProductEvent(reason === "daily_limit" ? "pdf_export_blocked" : "pdf_export_error", { bank, questionCount: exportQuestions.length, content: pdfContent, source: worksheetId ? "worksheet" : "save_dialog", reason, status: error instanceof PdfSignError ? error.status : undefined });
      setPdfStatusKind("error");
      setPdfStatus(error instanceof Error ? error.message : "The worksheet could not be built. Check your connection and try again.");
      shakeElement(pdfBuildButtonRef.current);
      shakeElement(pdfStatusRef.current);
    } finally {
      if (exportingRef.current === run) exportingRef.current = 0;
    }
  };

  const showPdfUpgrade = () => {
    trackProductEvent("pdf_upgrade_view", { bank: bank ?? "unknown" });
    if (bank && !sentUpgradeViews.has("pdf_dialog:")) { sentUpgradeViews.add("pdf_dialog:"); trackUpgrade("view", bank, "pdf_dialog"); }
    shakeElement(pdfTriggerRef.current);
    setPdfUpgradeOpen(true);
  };
  const closeWorksheetEditor = () => {
    if (worksheetDirty) { setPendingWorksheetAction({ kind: "view" }); return; }
    setAddingQuestions(false);
    setWorksheetMode("view");
  };

  return (
    <section ref={explorerRootRef} className={`explorer${savedWorksheetView || sharedSetView ? " is-worksheet-view" : ""}`} aria-label="Question explorer">
      {worksheetId && <div className="worksheet-workspace"><Link href="/worksheets">← My worksheets</Link>{worksheetReady && !worksheetLoadFailed && <div className="worksheet-workspace-heading"><div><h2>{worksheetName}</h2><span>{selectedIds.size} {selectedIds.size === 1 ? "question" : "questions"}</span></div><div className="worksheet-workspace-actions">{worksheetMode === "view" ? <button className="button secondary" type="button" onClick={() => setWorksheetMode("edit")}>Edit worksheet</button> : <button className="button secondary" type="button" onClick={closeWorksheetEditor}>View worksheet</button>}<button ref={shareButtonRef} className="share-view-button toolbar-icon-button" type="button" title="Share this view" aria-label="Copy link to this view" onClick={shareWorkspace}><ShareNetwork aria-hidden="true" /></button><button ref={pdfTriggerRef} className="button secondary worksheet-download-button" type="button" onClick={openPdfBuilder}><DownloadSimple aria-hidden="true" /> Download PDF</button></div></div>}</div>}
      {pendingWorksheetAction && <div className="worksheet-unsaved-backdrop" role="presentation"><section ref={worksheetUnsavedDialogRef} className="worksheet-unsaved-dialog" role="dialog" aria-modal="true" aria-labelledby="worksheet-unsaved-title"><p className="eyebrow">Before you go</p><h2 id="worksheet-unsaved-title">Unsaved worksheet changes</h2><p>Save your changes before continuing, or discard them.</p>{worksheetStatus && !worksheetSaving && worksheetStatus !== "Changes saved." && <p role="alert">{worksheetStatus}</p>}{confirmDiscard && <p className="worksheet-discard-warning">Discard unsaved changes? This cannot be undone.</p>}<div className="worksheet-unsaved-actions"><button type="button" className="button primary" disabled={worksheetSaving || !worksheetName.trim() || !selectedIds.size} onClick={async () => { const action = pendingWorksheetAction; if (action) { setConfirmDiscard(false); if (await saveWorksheet()) finishWorksheetAction(action); else setFailedLeaveSave(true); } }}>{worksheetSaving ? "Saving…" : "Save changes"}</button><button type="button" className="button secondary" disabled={worksheetSaving} onClick={discardWorksheetChanges}>{confirmDiscard ? "Confirm discard" : "Discard changes"}</button><button type="button" className="text-button" disabled={worksheetSaving} onClick={() => { setPendingWorksheetAction(null); setFailedLeaveSave(false); setConfirmDiscard(false); }}>Keep editing</button></div></section></div>}
      {worksheetId && worksheetMode === "edit" && worksheetReady && !worksheetLoadFailed && <WorksheetEditCard title={worksheetName} ids={[...selectedIds]} content={pdfContent} adding={addingQuestions} busy={worksheetSaving} dirty={worksheetDirty} status={worksheetStatus} onTitle={setWorksheetName} onContent={setPdfContent} onMove={(id, direction) => setSelectedIds((current) => { const ids = [...current]; const index = ids.indexOf(id); const next = index + direction; if (index < 0 || next < 0 || next >= ids.length) return current; [ids[index], ids[next]] = [ids[next], ids[index]]; return new Set(ids); })} onRemove={(id) => setSelectedIds((current) => { const next = new Set(current); next.delete(id); return next; })} onAdd={() => { clearFilters(); setAddingQuestions(true); }} onDoneAdding={() => setAddingQuestions(false)} onSave={() => void saveWorksheet()} />}
      {worksheetId && worksheetLoadFailed && <div className="access-notice" role="alert" aria-label="Worksheet unavailable"><span>{worksheetStatus}</span><button className="button secondary" type="button" onClick={() => { setWorksheetStatus(""); setWorksheetLoadFailed(false); setWorksheetReady(false); }}>Retry loading worksheet</button></div>}
      {sharedSetView && <div className="worksheet-workspace"><div className="worksheet-workspace-heading"><div><h2>Shared question set</h2><span>Access depends on your bank plan. Free questions stay free.</span></div><a className="button secondary" href={`/banks/${bank}`}>Browse full bank</a></div></div>}
      {sharedSetView && (sharedError || missingSharedCount > 0) && <div className="access-notice" role="alert">{sharedError || `${missingSharedCount} shared question${missingSharedCount === 1 ? " is" : "s are"} no longer available. The set cannot be shown in full.`}</div>}
      {(!savedWorksheetView || worksheetLoadFailed) && !sharedSetView && <div className="explorer-toolbar">
        <label className="search-field">
          <span className="sr-only">Search questions</span>
          <MagnifyingGlass aria-hidden="true" />
          <input value={search} onChange={(event) => { setSearch(event.target.value); setVisible(EXPLORER_PAGE_SIZE); }} placeholder="Search questions, topics, or methods" aria-label="Search questions" />
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
        {!worksheetId && <button ref={shareButtonRef} className="share-view-button toolbar-icon-button" type="button" title="Share this view" aria-label="Copy link to this view" onClick={shareWorkspace}><ShareNetwork aria-hidden="true" /></button>}
        {(!worksheetId || worksheetLoadFailed) && <button ref={pdfTriggerRef} className="save-pdf-button" type="button" aria-label={worksheetId ? "Download PDF" : selectionIsExplicit && selectedIds.size ? `Save PDF (${selectedIds.size} selected)` : "Save PDF"} onClick={openPdfBuilder}>{worksheetId ? <DownloadSimple aria-hidden="true" /> : <FilePlus aria-hidden="true" />}<span>{worksheetId ? "Download PDF" : "Save PDF"}</span>{!worksheetId && selectionIsExplicit && selectedIds.size > 0 && <span className="save-pdf-count" aria-hidden="true">{selectedIds.size}</span>}</button>}
      </div>}
      {savedWorksheet && <div className="worksheet-saved-notice" role="status"><Check aria-hidden="true" weight="bold" /><strong>Saved “{savedWorksheet.title}” to My Worksheets</strong><a href={savedWorksheet.href}>Open</a><Link href="/worksheets">My Worksheets</Link><button type="button" aria-label="Dismiss saved confirmation" onClick={() => setSavedWorksheet(null)}><X aria-hidden="true" /></button></div>}
      {shareStatus && <p className={`toolbar-status${shareStatus.startsWith("Couldn't") ? " is-error" : " is-success"}`} role="status">{shareStatus}</p>}


      {indexError && <div className="access-notice" role="alert"><span>{indexError}</span><button className="text-button" type="button" onClick={() => { setIndexError(""); setIndexAttempt((attempt) => attempt + 1); }}>Retry question index</button></div>}
      {assetError && <div className="access-notice" role="alert"><span>{assetError}</span><button className="text-button" type="button" onClick={retryQuestionAssets}>Retry images</button></div>}
      {studyError && <div className="access-notice" role="alert">{studyError}</div>}
      {!resolvedAccess.bankAccess && <div className={`free-value-strip${nudgesActive && yearFacts ? " is-upgrade" : ""}`}><p>{nudgesActive && yearFacts ? (effectiveFreeOnly ? <><strong>You’re practising {yearFacts.freeLabel} papers.</strong> <span>The {yearFacts.newerPaidLabel} papers, including {yearFacts.latestYear}, need a plan.</span></> : <strong>Locked questions include the {yearFacts.newerPaidLabel} papers.</strong>) : <><strong>{sharedSetView ? "Free questions in this set are open." : effectiveFreeOnly ? "Free exam years are open." : "You’re browsing the full bank."}</strong> <span>{sharedSetView ? "Questions outside your plan stay locked; signing in unlocks every free question in the set." : effectiveFreeOnly ? "Practise now, or clear the Free questions only filter to preview the rest." : "Locked questions show what a paid bank plan unlocks."}</span></>}</p>{nudgesActive ? <Link ref={topNoteViewRef} className="free-value-link" href={upgradeLink("top_note")} onClick={() => trackUpgrade("click", nudgeBank, "top_note")}>Unlock from {UPGRADE_PRICE_LABEL}<span aria-hidden="true"> →</span></Link> : <Link className="free-value-link" href={plansHref}>{PLANS_LABEL}<span aria-hidden="true"> →</span></Link>}</div>}

      <div className="explorer-layout">
        {filtersOpen && <button className="filter-backdrop" type="button" tabIndex={-1} aria-hidden="true" onClick={() => setFiltersOpen(false)} />}
        <aside ref={filterDialogRef} className={`filter-sidebar ${filtersOpen ? "is-open" : ""}`} role={filtersOpen ? "dialog" : undefined} aria-modal={filtersOpen ? true : undefined} aria-labelledby={filtersOpen ? "filter-sidebar-title" : undefined} aria-label={filtersOpen ? undefined : "Question filters"}>
          <div className="filter-sidebar-heading"><strong id="filter-sidebar-title">Filters</strong><button className="filter-close" type="button" aria-label="Close filters" onClick={() => setFiltersOpen(false)}><X /></button></div>
          {!resolvedAccess.bankAccess && bankHasFreeTier && <div className="filter-group" role="group" aria-labelledby="filter-access"><h3 id="filter-access">Access</h3><div className="filter-options"><label><input aria-label="Free questions only" type="checkbox" checked={effectiveFreeOnly} onChange={() => { setFreeOnly((current) => !current); setVisible(EXPLORER_PAGE_SIZE); }} /><span>Free questions only</span></label></div></div>}
          {(resolvedAccess.authenticated || !bootstrapPending) && <div className="filter-group" role="group" aria-labelledby="filter-study"><h3 id="filter-study">Study</h3><div className="filter-options"><label><input aria-label="Saved questions only" type="checkbox" checked={savedOnly} onChange={() => { if (!resolvedAccess.authenticated) { openSigninPrompt({ reason: "saved-filter" }); return; } setSavedOnly((current) => !current); setVisible(EXPLORER_PAGE_SIZE); }} /><span>Saved questions only</span></label></div></div>}
          <FilterGroup label="Topics" filterKey="topics" values={options.topics} selected={filters.topics ?? []} onToggle={toggle} />
          {!!filters.topics?.length && <div className="filter-group filter-partial"><div className="filter-options"><label><input type="checkbox" checked={partialTopics} onChange={() => { setPartialTopics((current) => !current); setVisible(EXPLORER_PAGE_SIZE); }} /><span>Include questions that partly cover a topic</span></label></div></div>}
          <FilterGroup label="Subtopics" filterKey="subtopics" values={visibleSubtopics} selected={filters.subtopics ?? []} onToggle={toggle} bank={bank} />
          <FilterGroup label="Earlier syllabus" filterKey="subtopics" values={earlierSubtopics} selected={filters.subtopics ?? []} onToggle={toggle} bank={bank} />
          {!filters.topics?.length && subtopicGroups.all.length > 0 && <button className="text-button subtopic-more" type="button" aria-expanded={showAllSubtopics} onClick={() => setShowAllSubtopics((show) => !show)}>{showAllSubtopics ? "Hide subtopics" : "Show all subtopics"}</button>}
          {!cleanMaths && !!filters.topics?.length && !!subtopicGroups.other.length && <button className="text-button subtopic-more" aria-expanded={showAllSubtopics} onClick={() => setShowAllSubtopics((show) => !show)}>{showAllSubtopics ? "Hide other subtopics" : "Show other subtopics"}</button>}
          <FilterGroup label="Years" filterKey="years" values={options.years} selected={filters.years ?? []} onToggle={toggle} />
          <FilterGroup label="Papers" filterKey="papers" values={options.papers} selected={filters.papers ?? []} onToggle={toggle} />
          <button className="more-filters-button" type="button" aria-expanded={showMoreFilters} onClick={() => setShowMoreFilters((show) => !show)}><Funnel aria-hidden="true" /> {showMoreFilters ? "Fewer filters" : "More filters"}</button>
          <div className={`secondary-filters${showMoreFilters ? " is-open" : ""}`} aria-hidden={!showMoreFilters} inert={showMoreFilters ? undefined : true}>
            <div className="secondary-filters-inner">
              <FilterGroup label="Sessions" filterKey="sessions" values={options.sessions} selected={filters.sessions ?? []} onToggle={toggle} />
              {isCambridge && <FilterGroup label="Components" filterKey="components" values={options.components} selected={filters.components ?? []} onToggle={toggle} />}
              {isCambridge && <FilterGroup label="Time zone / variant" filterKey="zones" values={options.zones} selected={filters.zones ?? []} onToggle={toggle} />}
              {calculatorFilter && <FilterGroup label="Calculator" filterKey="calculator" values={["calculator", "non-calculator"]} selected={filters.calculator ?? []} onToggle={toggle} />}
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
          <div ref={resultsHeadingRef} className="results-heading" tabIndex={-1}>
            <div><strong>{resultQuestions.length.toLocaleString("en-US")} {savedWorksheetView ? "saved " : !sharedSetView && effectiveFreeOnly ? "free " : ""}{resultQuestions.length === 1 ? "question" : "questions"}</strong>{selectionIsExplicit && !savedWorksheetView && !sharedSetView && <span>{selectedIds.size} selected for PDF</span>}</div>
            <div>{selectionIsExplicit && !worksheetId && !sharedSetView && <button className="text-button" onClick={() => { setSelectionIsExplicit(false); setSelectedIds(new Set()); }}>Clear selection</button>}{!savedWorksheetView && !sharedSetView && (search || activeCount > 0 || courseRoute !== "all") && <button className="text-button" onClick={clearFilters}>Clear filters</button>}</div>
          </div>
          {nudgesActive && <p className="sr-only" role="status">{milestoneQuestionId ? "10 practised. Nice. Unlock the newer papers from a plan." : ""}</p>}
          {!savedWorksheetView && !sharedSetView && activeCount > 0 && <div className="active-filters">
            {effectiveFreeOnly && <button aria-label="Remove free questions only filter" onClick={() => setFreeOnly(false)}>Free only <X /></button>}
            {savedOnly && <button aria-label="Remove saved questions only filter" onClick={() => setSavedOnly(false)}>Saved only <X /></button>}
            {Object.entries(filters).flatMap(([key, values]) => (values ?? []).map((value) => <button key={`${key}-${value}`} onClick={() => toggle(key as MultiKey, value)}>{formatPublicLabel(bank === "igcse" || bank === "igcse-additional" ? formatMathsPickerLabel(bank, value) : value)} <X /></button>))}
          </div>}
          <div className="question-list">
            {shownQuestions.map((question, index) => {
              const unlocked = resolvedAccess.bankAccess || isPreviewQuestion(question.bankSlug, question.id);
              const questionAsset = signedAssets.get(signedAssetKey(question.id, "question"));
              const answerAsset = signedAssets.get(signedAssetKey(question.id, "answer"));
              return <Fragment key={question.id}><QuestionCard question={question} fullPaperHref={fullPaperQuestionHref(fullPaperHrefs, question.id, question.number)} unlocked={unlocked} authenticated={resolvedAccess.authenticated} localPreview={localPreview} scopeIsCurrent={scopeIsCurrent} freeAnswer={!localPreview && isPreviewQuestion(question.bankSlug, question.id)} priority={index === 0} questionAsset={isSignedAssetFresh(questionAsset, assetEpoch) ? questionAsset : undefined} answerAsset={isSignedAssetFresh(answerAsset, assetEpoch) ? answerAsset : undefined} onQuestionAssetError={() => markQuestionAssetFailed(question.id)} onAnswerAssetError={() => markAnswerAssetFailed(question.id, answerAsset)} onAnswerAsset={(asset) => {
                if (!scopeIsCurrent()) return;
                setSignedAssets((current) => new Map(current).set(signedAssetKey(question.id, "answer"), asset));
                if (asset.details) setCatalogQuestions((current) => current.map((item) => item.id === question.id ? mergeQuestionRichDetails(item, asset.details!) : item));
              }} selected={selectedIds.has(question.id)} selectable={!savedWorksheetView && !sharedSetView} onSelect={() => toggleQuestion(question.id)} saved={savedIds.has(question.id)} attempted={attemptedIds.has(question.id)} onToggleSaved={() => { if (bootstrapPending) return; if (resolvedAccess.authenticated) void toggleSaved(question.id); else openSigninPrompt({ reason: "save", questionId: question.id }); }} onAttempt={() => recordAttempt(question.id)} onReveal={() => recordReveal(question.id)} locked={nudgesActive ? { title: `${question.year} paper · on any plan`, body: indexLoaded ? `Unlock ${paidCount.toLocaleString("en-US")} more ${bankShortName} questions with mark schemes and PDFs.` : `Unlock every ${bankShortName} question with mark schemes and PDFs.`, href: upgradeLink("locked_card"), onClick: () => trackUpgrade("click", nudgeBank, "locked_card") } : undefined} />{nudgesActive && milestoneQuestionId === question.id && <PracticeMilestone bank={nudgeBank} facts={yearFacts} href={upgradeLink("practice_milestone")} onDismiss={() => setMilestoneQuestionId("")} />}{renderFeedSlot(index + 1, index === shownQuestions.length - 1)}</Fragment>;
            })}
          </div>
          {!savedWorksheetView && !sharedSetView && filtered.length === 0 && <div className="empty-state"><strong>No questions match that combination.</strong><span>Clear a filter and try again.</span></div>}
          {!savedWorksheetView && !sharedError && !missingSharedCount && freeGate.active && bankSlug && <FreeQuestionSignupGate bankSlug={bankSlug} sentViews={sentUpgradeViews} bankFreeCount={bankFreeCount} bankName={bankShortName} remainingCount={freeGate.remainingCount} signupHref={signupHref} signinHref={signinHref} plansHref={upgradeLink("signup_gate")} plansLine={yearFacts ? `Want ${yearFacts.newerPaidLabel} too? Plans start at ${UPGRADE_PRICE_MONTH}.` : `Want every year? Plans start at ${UPGRADE_PRICE_MONTH}.`} />}
          {!savedWorksheetView && !sharedSetView && !freeGate.active && visible < filtered.length && <button className="load-more" onPointerEnter={prefetchNextPage} onFocus={prefetchNextPage} onTouchStart={prefetchNextPage} onClick={() => setVisible((count) => count + EXPLORER_PAGE_SIZE)}>Show 24 more questions</button>}
        </div>
      </div>

      {pdfOpen && <div className="pdf-backdrop" role="presentation"><section ref={pdfDialogRef} className={`pdf-dialog${worksheetId ? "" : " is-save"}`} role="dialog" aria-modal="true" aria-labelledby="pdf-title"><button className="pdf-close" aria-label="Close PDF options" onClick={() => setPdfOpen(false)}><X /></button>
        {worksheetId ? <>
          <p className="eyebrow">Worksheet builder</p>
          <h2 id="pdf-title">Download {exportQuestions.length.toLocaleString("en-US")} {exportQuestions.length === 1 ? "question" : "questions"}</h2>
          <p>Only the questions in this worksheet are included.</p>
          <div className="pdf-options">{(["questions", "answers", "both"] as PdfContent[]).map((value) => <label key={value}><input type="radio" name="pdf-content" checked={pdfContent === value} onChange={() => setPdfContent(value)} /> {value === "both" ? "Questions and answers" : value[0].toUpperCase() + value.slice(1)}</label>)}</div>
          <div className="worksheet-actions only-download"><button ref={pdfBuildButtonRef} className="button secondary pdf-download" disabled={!exportQuestions.length || (pdfStatusKind === "progress" && Boolean(pdfStatus))} onClick={requestDownload}><DownloadSimple /> {pdfStatusKind === "success" ? "PDF downloaded" : "Download PDF"}</button></div>
          {placementPromptOpen && pdfContent === "both" && <AnswerPlacementPrompt onChoose={(placement) => void handleDownload(placement)} />}
          {largeExportPlacement && <LargeExportConfirm count={exportQuestions.length} onConfirm={() => void handleDownload(largeExportPlacement, true)} onCancel={() => setLargeExportPlacement(null)} />}
          {worksheetStatus && <p role={worksheetLoadFailed || worksheetStatus.includes("could not") || worksheetStatus.includes("required") || worksheetStatus.includes("unavailable") ? "alert" : "status"}>{worksheetStatus}</p>}
          {worksheetLoadFailed && <button type="button" onClick={() => { setWorksheetStatus(""); setWorksheetLoadFailed(false); setWorksheetReady(false); }}>Retry loading worksheet</button>}
          {worksheetDirty && <small>Unsaved worksheet changes</small>}
          {pdfStatus && <small ref={pdfStatusRef} role="status" aria-live="polite" className={pdfStatusKind === "progress" || pdfStatusKind === "cancelled" ? "" : pdfStatusKind === "error" ? "is-error" : "is-success"}>{pdfStatus}</small>} {pdfStatusKind === "progress" && pdfStatus && <button type="button" className="text-button pdf-cancel" onClick={cancelDownload}>Cancel download</button>}
        </> : <>
          <p className="eyebrow">Save PDF</p>
          <h2 id="pdf-title">Save {exportQuestions.length.toLocaleString("en-US")} {exportQuestions.length === 1 ? "question" : "questions"} as a PDF</h2>
          <p>{selectionIsExplicit ? "Using your selected questions." : filtered.length > MAX_PDF_QUESTIONS ? `PDFs are limited to ${MAX_PDF_QUESTIONS} questions. Narrow your filters or select questions.` : "Nothing selected, so this uses every current result."}</p>
          <label className="worksheet-name-field">Name<input aria-label="PDF name" maxLength={80} value={worksheetName} onChange={(event) => { nameTypedRef.current = true; setWorksheetName(event.target.value); }} placeholder="e.g. Algebra revision" /></label>
          <div className="pdf-options">{(["questions", "answers", "both"] as PdfContent[]).map((value) => <label key={value}><input type="radio" name="pdf-content" checked={pdfContent === value} onChange={() => setPdfContent(value)} /> {value === "both" ? "Questions and answers" : value[0].toUpperCase() + value.slice(1)}</label>)}</div>
          <div className="worksheet-actions only-save"><button type="button" className="button primary" disabled={!resolvedAccess.bankAccess || !worksheetReady || worksheetLoading || worksheetSaving || !exportQuestions.length || !worksheetName.trim()} onClick={saveWorksheet}>{worksheetSaving ? "Saving…" : "Save PDF"}</button><button ref={pdfBuildButtonRef} type="button" className="pdf-direct-download" aria-label="Download PDF without saving" title="Download PDF" disabled={!resolvedAccess.canExportPdf || !exportQuestions.length || (pdfStatusKind === "progress" && Boolean(pdfStatus))} onClick={requestDownload}><DownloadSimple aria-hidden="true" weight="bold" /></button></div>
          {placementPromptOpen && pdfContent === "both" && <AnswerPlacementPrompt onChoose={(placement) => void handleDownload(placement)} />}
          {largeExportPlacement && <LargeExportConfirm count={exportQuestions.length} onConfirm={() => void handleDownload(largeExportPlacement, true)} onCancel={() => setLargeExportPlacement(null)} />}
          {pdfStatus ? <small ref={pdfStatusRef} role="status" aria-live="polite" className={pdfStatusKind === "progress" || pdfStatusKind === "cancelled" ? "" : pdfStatusKind === "error" ? "is-error" : "is-success"}>{pdfStatus}</small> : <small className="pdf-save-note">Saved to My Worksheets.</small>} {pdfStatusKind === "progress" && pdfStatus && <button type="button" className="text-button pdf-cancel" onClick={cancelDownload}>Cancel download</button>}
          {worksheetStatus && <p role={worksheetStatus.endsWith("…") ? "status" : "alert"}>{worksheetStatus}</p>}
        </>}
      </section></div>}
      {signinPrompt && <div className="pdf-backdrop" role="presentation" onClick={(event) => { if (event.target === event.currentTarget) setSigninPrompt(null); }}><section ref={signinPromptRef} className="pdf-dialog access-upgrade-dialog" role="dialog" aria-modal="true" aria-labelledby="signin-prompt-title"><button className="pdf-close" aria-label="Close" onClick={() => setSigninPrompt(null)}><X /></button><span className="access-upgrade-icon"><BookmarkSimple aria-hidden="true" weight="bold" /></span><h2 id="signin-prompt-title">{signinPrompt.reason === "save" ? "Save this question" : "Your saved questions"}</h2><p>Create a free account to save questions and come back to them anytime.</p><Link className="button primary" href={`/login?mode=sign-up&next=${encodeURIComponent(promptReturnPath)}`} onClick={() => trackProductEvent("study_signin_prompt_click", { bank: bank ?? "unknown", reason: signinPrompt.reason, action: "sign_up" })}>Create free account</Link><p className="signin-prompt-alt">Have an account? <Link href={`/login?next=${encodeURIComponent(promptReturnPath)}`} onClick={() => trackProductEvent("study_signin_prompt_click", { bank: bank ?? "unknown", reason: signinPrompt.reason, action: "sign_in" })}>Sign in</Link></p></section></div>}
      {pdfUpgradeOpen && <div className="pdf-backdrop" role="presentation"><section ref={pdfUpgradeDialogRef} className="pdf-dialog access-upgrade-dialog" role="dialog" aria-modal="true" aria-labelledby="pdf-upgrade-title"><button className="pdf-close" aria-label="Close PDF access message" onClick={() => setPdfUpgradeOpen(false)}><X /></button><span className="access-upgrade-icon"><DownloadSimple aria-hidden="true" weight="bold" /></span><h2 id="pdf-upgrade-title">Saving PDFs needs paid access</h2><p>Save and download PDFs with paid access to this question bank.</p><Testimonial testimonial={PDF_TESTIMONIAL} variant="inline" signedOutOnly /><Link className="button primary" href={upgradeLink("pdf_dialog")} onClick={() => { if (bank) trackUpgrade("click", bank, "pdf_dialog"); }}>{PLANS_LABEL}</Link></section></div>}
      {hasPeriodicTable(bank) && <PeriodicTableButton variant="floating" source="bank" />}
    </section>
  );
}

function FilterGroup({ label, filterKey, values, selected, onToggle, bank }: { label: string; filterKey: MultiKey; values: string[]; selected: string[]; onToggle: (key: MultiKey, value: string) => void; bank?: string }) {
  if (!values.length) return null;
  const headingId = label === "Earlier syllabus" ? `filter-${filterKey}-earlier` : `filter-${filterKey}`;
  return <div className="filter-group" role="group" aria-labelledby={headingId}><h3 id={headingId}>{label}</h3><div className="filter-options">{values.map((value) => { const publicLabel = formatPublicLabel(bank === "igcse" || bank === "igcse-additional" ? formatMathsPickerLabel(bank, value) : value); return <label key={value}><input aria-label={`${label}: ${publicLabel}`} type="checkbox" checked={selected.includes(value)} onChange={() => onToggle(filterKey, value)} /><span>{publicLabel}</span></label>; })}</div></div>;
}

/** Resolves once every image is decoded (failures included), or after `timeoutMs`. */
function decodeImages(urls: readonly string[], timeoutMs = 1500): Promise<void> {
  if (!urls.length || typeof window === "undefined") return Promise.resolve();
  const decoded = Promise.all(urls.map((url) => {
    const image = new window.Image();
    image.src = url;
    return typeof image.decode === "function" ? image.decode().catch(() => {}) : undefined;
  }));
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([decoded, new Promise<void>((resolve) => { timer = setTimeout(resolve, timeoutMs); })])
    .then(() => clearTimeout(timer));
}

function QuestionCard({ question, fullPaperHref, unlocked, authenticated, localPreview, scopeIsCurrent, freeAnswer, priority = false, questionAsset, answerAsset, onQuestionAssetError, onAnswerAssetError, onAnswerAsset, selected, selectable, onSelect, saved, attempted, onToggleSaved, onAttempt, onReveal, locked }: {
  question: UnifiedQuestion;
  fullPaperHref?: string;
  unlocked: boolean;
  authenticated: boolean;
  localPreview: boolean;
  freeAnswer: boolean;
  scopeIsCurrent: () => boolean;
  priority?: boolean;
  questionAsset?: SignedAsset;
  answerAsset?: SignedAsset;
  onQuestionAssetError: () => void;
  onAnswerAssetError: () => void;
  onAnswerAsset: (asset: SignedAsset) => void;
  selected: boolean;
  selectable: boolean;
  onSelect: () => void;
  saved: boolean;
  attempted: boolean;
  onToggleSaved: () => void;
  onAttempt: () => void;
  onReveal: () => void;
  locked?: { title: string; body: string; href: string; onClick: () => void };
}) {
  const [answerOpen, setAnswerOpen] = useState(false);
  const [solutionOpen, setSolutionOpen] = useState(false);
  const [answerLoading, setAnswerLoading] = useState(false);
  const [answerError, setAnswerError] = useState("");
  const answerRequestRef = useRef<{ promise: Promise<SignedAsset>; expiresAt: number } | null>(null);
  const [explanation, setExplanation] = useState<Explanation | null>(null);
  const [explanationOpen, setExplanationOpen] = useState(false);
  const [explanationLoading, setExplanationLoading] = useState(false);
  const [explanationError, setExplanationError] = useState("");
  const explanationRequestRef = useRef(false);
  const showExplanationButton = unlocked && Boolean(question.hasExplanation) && !localPreview;
  const toggleExplanation = async () => {
    // React's disabled state is not synchronous; protect quota before starting the request.
    if (explanationRequestRef.current || !scopeIsCurrent()) return;
    if (explanationOpen) { setExplanationOpen(false); return; }
    trackProductEvent("explanation_open", { bank: question.bankSlug, freePreview: isPreviewQuestion(question.bankSlug, question.id) });
    if (!explanation) {
      if (explanationError && freeAnswer) resetFreeAssetRecovery(question.bankSlug, [{ questionId: question.id, kind: "explanation" }]);
      explanationRequestRef.current = true;
      setExplanationLoading(true);
      setExplanationError("");
      try {
        const loaded = await fetchExplanation(question.bankSlug, question.id, { free: freeAnswer, isCurrent: scopeIsCurrent });
        if (!scopeIsCurrent()) return;
        setExplanation(loaded);
      } catch (error) {
        if (!scopeIsCurrent()) return;
        // Only surface this known public error, not arbitrary storage/API details.
        setExplanationError(error instanceof Error && error.message === "Daily explanation limit reached. Try again tomorrow."
          ? error.message : "The explanation could not load. Try again.");
        return;
      } finally {
        explanationRequestRef.current = false;
        if (scopeIsCurrent()) setExplanationLoading(false);
      }
    }
    if (!scopeIsCurrent()) return;
    setExplanationOpen(true);
    onReveal();
    if (authenticated) void onAttempt();
  };
  const hasFreshAnswerAsset = () => isSignedAssetFresh(answerAsset);
  const loadAnswer = () => {
    if (hasFreshAnswerAsset()) return Promise.resolve(answerAsset!);
    if (answerRequestRef.current && answerRequestRef.current.expiresAt <= Date.now()) answerRequestRef.current = null;
    if (!answerRequestRef.current) {
      const request = (freeAnswer
        ? fetchFreeAssets(question.bankSlug, [{ questionId: question.id, kind: "answer" }]).then(({ assets }) => assets.get(signedAssetKey(question.id, "answer")))
        : fetchSignedAssets(question.bankSlug, [{ questionId: question.id, kind: "answer" }], fetch, localPreview, scopeIsCurrent).then((assets) => assets.get(signedAssetKey(question.id, "answer"))))
        .then((asset) => {
          if (!scopeIsCurrent()) throw new DOMException("Answer request scope expired", "AbortError");
          if (!asset) throw new Error("Missing answer asset");
          if (answerRequestRef.current?.promise === request) answerRequestRef.current.expiresAt = asset.expiresAt;
          onAnswerAsset(asset);
          return asset;
        })
        .catch((error: unknown) => {
          if (answerRequestRef.current?.promise === request) answerRequestRef.current = null;
          throw error;
        });
      answerRequestRef.current = { promise: request, expiresAt: Number.POSITIVE_INFINITY };
    }
    return answerRequestRef.current.promise;
  };
  // A public free answer link that fails: rescue only this answer and load it again.
  const answerAssetFailed = () => {
    if (!scopeIsCurrent()) return;
    onAnswerAssetError();
    if (!isFreePublicAssetUrl(answerAsset?.urls[0])) {
      answerRequestRef.current = null;
      setAnswerOpen(false);
      setAnswerError("The answer could not load. Try again.");
      return;
    }
    if (!freeAnswer) return;
    preferSignedFreeAssets(question.bankSlug, { questionId: question.id, kind: "answer" });
    answerRequestRef.current = null;
    void fetchFreeAssets(question.bankSlug, [{ questionId: question.id, kind: "answer" }]).then(({ assets }) => {
      const asset = assets.get(signedAssetKey(question.id, "answer"));
      if (asset && scopeIsCurrent()) onAnswerAsset(asset);
    });
  };
  // Free answers are public and CDN-cached, so warm them on intent; paid answers sign on click
  // only, because each signature spends the member's daily allowance.
  const prefetchAnswer = () => {
    if (!freeAnswer || answerOpen || hasFreshAnswerAsset() || question.markschemeImageCount < 1) return;
    void loadAnswer().then((asset) => {
      if (scopeIsCurrent() && asset.urls[0]) new window.Image().src = asset.urls[0];
    }).catch(() => {});
  };

  const toggleAnswer = async () => {
    if (!scopeIsCurrent()) return;
    if (answerOpen) { setAnswerOpen(false); return; }
    if (answerError && freeAnswer) {
      resetFreeAssetRecovery(question.bankSlug, [{ questionId: question.id, kind: "answer" }]);
      answerRequestRef.current = null;
    }
    trackProductEvent("answer_reveal", { bank: question.bankSlug, freePreview: isPreviewQuestion(question.bankSlug, question.id) });
    if (question.markschemeImageCount > 0 && !hasFreshAnswerAsset()) {
      setAnswerLoading(true);
      setAnswerError("");
      try {
        const asset = await loadAnswer();
        if (!scopeIsCurrent()) return;
        // Answer images render at their natural size, so open the panel once they are decoded.
        await decodeImages(asset.urls);
        if (!scopeIsCurrent()) return;
      } catch (error) {
        if (!scopeIsCurrent()) return;
        setAnswerError(assetFailureMessage(error, "The answer could not load. Try again."));
        setAnswerLoading(false);
        return;
      }
      setAnswerLoading(false);
    }
    setAnswerOpen(true);
    onReveal();
    if (authenticated) void onAttempt();
  };

  return (
    <article className={`question-card question-paper${selected && selectable ? " is-selected" : ""}`}>
      <header className="question-card-header"><div className="question-meta"><span>{question.year} {question.session}</span><span>Paper {question.paper}</span><span>Question {question.number}</span>{question.component && <span>Component {question.component}</span>}{question.zone && <span>{question.zone}</span>}{question.marks !== null && <span>{question.marks} {question.marks === 1 ? "mark" : "marks"}</span>}</div>{unlocked && selectable && <label className="pdf-select"><input aria-label={`Add question ${question.number} to PDF`} type="checkbox" checked={selected} onChange={onSelect} /> Add to PDF</label>}</header>
      <div className="question-topic"><strong>{formatPublicLabel(question.bankSlug === "igcse" || question.bankSlug === "igcse-additional" ? formatMathsPickerLabel(question.bankSlug, question.primaryTopic) : question.primaryTopic)}</strong>{displayedQuestionSubtopics(question).slice(0, 4).map((topic) => <span key={topic}>{formatPublicLabel(question.bankSlug === "igcse" || question.bankSlug === "igcse-additional" ? formatMathsPickerLabel(question.bankSlug, topic) : topic)}</span>)}</div>
      {unlocked ? <div className="question-images">{questionAsset ? questionAsset.urls.map((source, index) => <SourceCropImage key={source} bankSlug={question.bankSlug} questionId={question.id} src={source} priority={priority && index === 0} crop={questionAsset.displayCrops?.[index]} alt={`Original question ${question.number}${questionAsset.urls.length > 1 ? ` page ${index + 1}` : ""}`} onError={onQuestionAssetError} />) : <div className="asset-placeholder" role="status"><span className="placeholder-shimmer" aria-hidden="true" /><span className="placeholder-bars" aria-hidden="true"><i /><i /><i /><i /></span><span className="sr-only">Loading original question</span></div>}{question.accessibleText ? <p className="sr-only question-transcript">{question.accessibleText}</p> : null}</div> : <div className="question-locked"><strong>{locked?.title ?? "Paid plan required"}</strong><span>{locked?.body ?? "Unlock this bank’s full question set, answers, and PDF export."}</span><Link className={locked ? "button primary question-locked-upgrade" : "question-locked-action"} href={locked?.href ?? plansHrefFor(authenticated)} onClick={locked?.onClick}>{locked ? `Unlock from ${UPGRADE_PRICE_LABEL}` : PLANS_LABEL}</Link></div>}
      <div className="question-actions">
        <div className="question-action-buttons">{unlocked ? ((question.solution || question.markschemeImageCount > 0) ? <button className="answer-toggle" disabled={answerLoading} aria-expanded={answerOpen} onClick={toggleAnswer} onPointerEnter={prefetchAnswer} onFocus={prefetchAnswer} onTouchStart={prefetchAnswer}>{answerLoading ? "Loading answer..." : answerOpen ? "Hide answer" : "Show answer"}</button> : <span className="muted">Answer coming soon</span>) : null}{showExplanationButton && <button className="answer-toggle" disabled={explanationLoading} aria-expanded={explanationOpen} onClick={toggleExplanation}>{explanationLoading ? "Loading explanation..." : explanationOpen ? "Hide explanation" : "Explanation"}</button>}{answerError && <span className="muted" role="alert">{answerError}</span>}{explanationError && <span className="muted" role="alert">{explanationError}</span>}</div>
        <div className="source-links">{attempted && <span className="study-state"><CheckCircle weight="fill" /> Practised</span>}{unlocked && fullPaperHref && <Link className="full-paper-button" href={fullPaperHref} title="Open the whole paper at this question, with its mark scheme" onClick={() => trackProductEvent("question_full_paper_click", { bank: question.bankSlug })}><FileText aria-hidden="true" weight="bold" />Full paper</Link>}{unlocked && <button className={`study-icon-button ${saved ? "is-saved" : ""}`} title={saved ? "Remove from saved" : "Save question"} aria-label={saved ? `Remove question from saved ${question.id}` : `Save question ${question.id}`} onClick={onToggleSaved}><BookmarkSimple weight={saved ? "fill" : "regular"} aria-hidden="true" /></button>}{unlocked && <QuestionReport bank={question.bankSlug} questionId={question.id} hasExplanation={Boolean(question.hasExplanation)} freePreview={isPreviewQuestion(question.bankSlug, question.id)} />}</div>
      </div>
      {answerOpen && <div className="answer-panel">{answerAsset?.mcqAnswer ? <McqAnswerView answer={answerAsset.mcqAnswer} /> : <>{answerAsset?.urls.length ? <p className="answer-panel-label">Mark scheme</p> : null}{answerAsset?.urls.map((source, index) => <Image unoptimized width={0} height={0} key={source} src={source} alt={`Official mark scheme page ${index + 1}`} onError={answerAssetFailed} />)}</>}{question.solution && (answerAsset?.urls.length || answerAsset?.mcqAnswer ? <div className="solution-wrap"><button className="text-button" aria-expanded={solutionOpen} onClick={() => setSolutionOpen((open) => !open)}>{solutionOpen ? "Hide worked text" : "Show worked text"}</button>{solutionOpen && <p>{question.solution}</p>}</div> : <p>{question.solution}</p>)}</div>}
      {explanationOpen && explanation && <div className="answer-panel explanation-panel"><p className="answer-panel-label">Explanation</p><ExplanationPanel explanation={explanation} /></div>}
    </article>
  );
}