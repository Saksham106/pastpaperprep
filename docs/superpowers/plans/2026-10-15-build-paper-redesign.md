# Build-a-paper Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Generate/Preview/Save relay with a one-screen builder: a counted topic tree on the left, a live editable paper on the right, Save and Download in place.

**Architecture:** Three pure modules hold all logic (`builder-topics.ts`, `paper-draft.ts`, `builder-url.ts`) plus a thin export helper (`worksheet-export.ts`). `PaperBuilder.tsx` becomes a coordinator rendering `BuilderChoices` (left) and `BuilderSheet` (right); `PaperPreview` is reused inside a modal dialog.

**Tech Stack:** Next.js 16 client components, React 19, TypeScript, Vitest + Testing Library, CSS file `paper-builder.css`.

**Spec:** `docs/superpowers/specs/2026-10-15-build-paper-redesign-design.md`

## Global Constraints

- No new API routes (Vercel Hobby 12-function cap). Use `/api/worksheets`, `/api/worksheets/{id}`, `/api/pdf/sign`.
- Max 50 questions per worksheet; marks target ≤ 200.
- Builder only for users with bank access (page already filters banks).
- Copy short; "PDF" stays; Save PDF primary, Download PDF secondary.
- Bank page export path and PDF engine untouched.

## Review Focus

1. Pool shrinks below current paper after a filter change → paper trims and reports "Only N match", never throws. (Task 2 test.)
2. Marks target impossible exactly (e.g. all 3-mark questions, target 10) → closest ≤ target, `exact: false`, status shown. (Task 2 test.)
3. Selected topic whose count becomes 0 after a year change → still visible and untickable-to-off, not hidden while selected. (Task 5 test.)
4. Junk URL (`size=q999`, `t=` with unknown keys, `seed=abc`) → ignored or clamped, page renders. (Task 3 test.)
5. Save then edit then Save changes → PATCH with revision; a 409/failed PATCH keeps the edits and shows the error. (Task 6 test.)

---

### Task 1: Topic tree and selection matching

**Files:** Create `src/lib/builder-topics.ts`, `src/lib/builder-topics.test.ts`

**Produces:**
```ts
export type TopicNode = { key: string; label: string; subtopics: { key: string; label: string }[] };
export function buildTopicTree(questions: readonly BuilderQuestion[], bank: BankSlug): TopicNode[];
export function matchesSelection(question: BuilderQuestion, bank: BankSlug, selection: ReadonlySet<string>): boolean;
export function nodeMatches(question: BuilderQuestion, bank: BankSlug, key: string): boolean;
export function toggleKey(tree: TopicNode[], selection: ReadonlySet<string>, key: string): Set<string>;
export type BuilderQuestion = PublicQuestionMetadata; // re-export alias
```
Keys: `t:<topic>`, `s:<topic>␟<subtopic>`. Maths banks: topics from `getMathsPickerSections(bank)` order (+ `Earlier syllabus` when `isEarlierMathsQuestion` on any), subtopic keys carry section `value` / earlier tokens, labels via `mathsPickerLabel`. Others: topics sorted by label; subtopics sorted. `toggleKey` on a topic removes its subtopic keys; on a subtopic removes its topic key.

- [ ] Tests: generic tree from 4 fixture questions; maths tree for `igcse` includes official topic order and Earlier syllabus only when a historical question exists; matchesSelection with empty set (all), topic, subtopic, union; toggleKey topic↔subtopic exclusivity.
- [ ] Run `npx vitest run src/lib/builder-topics.test.ts` → FAIL; implement; → PASS; commit `feat(builder): counted topic tree model`.

### Task 2: Live draft engine

**Files:** Create `src/lib/paper-draft.ts`, `src/lib/paper-draft.test.ts`

**Produces:**
```ts
export type DraftTarget = { kind: "questions"; amount: number } | { kind: "marks"; amount: number } | { kind: "papers"; targets: { paper: number; mode: "questions" | "marks"; amount: number }[] };
export type DraftResult = { ids: string[]; totalMarks: number; exact: boolean; shortBy: number };
export function reconcileDraft(current: readonly string[], pool: readonly PaperCandidate[], target: DraftTarget, seed: number, manualOrder: boolean): DraftResult;
export function swapCandidate(paperIds: readonly string[], id: string, pool: readonly PaperCandidate[], target: DraftTarget, seed: number): string | null;
export function lowerTarget(target: DraftTarget, removed: PaperCandidate): DraftTarget;
export function examOrder<T extends PaperCandidate>(questions: readonly T[]): T[];
```
`shortBy` = questions missing (questions targets) or marks missing (marks targets). Reuse `shuffled` and `exactMarks` from `paper-builder.ts` (export them). Total cap 50.

- [ ] Tests: keep matching ids; trim to N; top up deterministic by seed; pool < N → all, shortBy; marks exact; marks impossible → closest ≤ M, exact false; papers mode per paper; manualOrder keeps order and appends; examOrder; swap prefers same marks then topic then paper, returns null when exhausted; lowerTarget for each kind (never below 0, papers mode lowers that paper).
- [ ] FAIL → implement → PASS; commit `feat(builder): live draft engine`.

### Task 3: URL state

**Files:** Create `src/lib/builder-url.ts`, `src/lib/builder-url.test.ts`

**Produces:**
```ts
export type BuilderState = { bank?: string; route: CourseRouteSelection; from?: number; to?: number; selection: string[]; target: DraftTarget; seed?: number };
export function parseBuilderState(params: URLSearchParams): BuilderState;
export function serializeBuilderState(state: BuilderState): string; // without leading "?"
```
Defaults: route `all`, target `{ kind: "questions", amount: 10 }`. Clamp questions 1–50, marks 1–200; drop invalid papers entries; seed must be uint32.

- [ ] Tests: round trip; junk input; clamps. FAIL → implement → PASS; commit `feat(builder): URL state`.

### Task 4: Export helper

**Files:** Create `src/lib/worksheet-export.ts`, `src/lib/worksheet-export.test.ts`

**Produces:** `exportWorksheetPdf({ bank, questions: PublicQuestionMetadata[], title, marker?, onProgress? }): Promise<{ heldNotice: string | null }>` mapping metadata to `UnifiedQuestion`-shaped objects (`bankSlug`, `solution: null`, `questionImages: []`, `markschemeImages: []`, `secondarySubtopics: []`, `courseEra: ""`), then `fetchPdfAssets` → `attachPdfAssetMetadata` → `downloadQuestionPdf(..., "both", onProgress, marker, "all-answers-last", { title, bankSlug: bank })`.

- [ ] Test with mocked `@/lib/signed-assets` and `@/lib/pdf-export`: arguments passed in sheet order, cover title, marker; held rows → notice string. FAIL → implement → PASS; commit.

### Task 5: Builder UI

**Files:** Rewrite `src/components/PaperBuilder.tsx`; create `src/components/BuilderChoices.tsx`, `src/components/BuilderSheet.tsx`; modify `src/components/PaperPreview.tsx` (props `numbers`, sheet heading), rewrite `src/components/paper-builder.css`; modify `src/app/worksheets/build/page.tsx` (export marker prop, concise header); rewrite `src/components/PaperBuilder.test.tsx`.

PaperBuilder props: `{ banks, initialBank?, existingTitles?, exportMarker? }`. State per spec; URL sync via `window.history.replaceState` after mount (read initial state from `window.location.search` in a mount effect; `initialBank` still wins over missing `bank`).

- [ ] Tests (rewrite): free-member pricing link kept; route switch hidden on IB; topic counts render and change with From year; zero-count row disabled, selected zero row stays enabled; paper appears without any Generate button with default 10 (or all when fewer); remove lowers count and question does not return after a filter change; swap replaces a row; reorder buttons; title suggestion/edit/clear; real-paper targets show per-paper availability and build per paper; "Only N match" status; bank switch resets.
- [ ] FAIL → implement → PASS; commit `feat(builder): one-screen builder with live paper`.

### Task 6: Save, Save changes, Download, reader

**Files:** `src/components/PaperBuilder.tsx`, `src/components/BuilderSheet.tsx`, tests in `src/components/PaperBuilder.test.tsx`

- [ ] Tests: Save posts sheet-order ids and name; shows "Open in My worksheets" link `/banks/<bank>?worksheet=<id>`; edit → "Save changes" → PATCH with revision; failed PATCH keeps edits and shows error; Download calls `exportWorksheetPdf` (mocked) with title and marker, shows progress then done; row click opens dialog reader, Escape closes and focus returns.
- [ ] FAIL → implement → PASS; commit `feat(builder): save, download and reader in place`.

### Task 7: Verification and PR

- [ ] `npm run lint && npm run typecheck && npm test && npm run build`.
- [ ] Dev-only untracked harness rendering `PaperBuilder` against the generated public index; check desktop 1280, tablet 768, mobile 375, light/dark, no horizontal overflow; screenshots.
- [ ] Final review; fix pass; push; PR with base `feat/pdf-polish`.
