# My Worksheets refresh and calculator tags Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make "Build a paper" easy to find, and tag every printed maths question as calculator or non-calculator.

**Architecture:** One shared rule module (`src/lib/calculator-policy.mjs`) decides calculator status per bank and paper; both the bank-index generator and the app's question loader use it, so the builder, the bank-page filter and the PDF exporter all read the same `calculator` field. UI work is limited to My Worksheets, the builder's paper rows, a bank-page link and the PDF label row.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Vitest + Testing Library, jsPDF.

**Spec:** `docs/superpowers/specs/2026-10-09-worksheets-calculator-tags-design.md`

## Global Constraints

- Work in the worktree `.worktrees/worksheets` on branch `feat/worksheets-and-calculator-tags`. Never touch the main checkout.
- Run commands from the worktree root. `npm test` regenerates `public/bank-index` first (pretest).
- Do not edit `src/data/raw/igcse-additional.json` (audit tests pin per-question fingerprints, `calculator` included).
- Badge text is exactly `NO CALCULATOR` (solid) and `CALCULATOR` (outlined); nothing for `null`.
- Calculator status follows the paper's rule; never infer it from question text.
- Calculator filter banks: `igcse`, `igcse-additional`, `ib-hl`, `ib-sl`. Rule banks additionally include `ib-ai-hl`, `ib-ai-sl` (always `true`).
- Panel copy: title "Build a paper", line "A printable mock from any bank, with its mark scheme.", button "Start building →".
- Empty-state copy: "No saved papers yet" / "Papers you build, or question sets you save from a bank, will appear here."
- Keep the existing My Worksheets `h1` style (`.worksheet-library-header h1 { font: 800 clamp(...) }`, asserted by tests).
- Before the PR: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` all pass.

## Review Focus

- A 0580/0606 paper row whose year range spans 2025 (mixed true/false) must show **no** badge rather than a wrong one. Pinned in Task 5.
- A question with `calculator: null` (sciences, economics) must not match the bank-page "non-calculator" filter and must print no PDF badge. Pinned in Tasks 2 and 4.
- `/worksheets/build?bank=<bank the user cannot access>` (or garbage) must fall back to the first accessible bank, never error. Pinned in Task 6.
- A logged-out teacher following the bank-page "Build a paper" link must land back on the builder with the same bank after login. Pinned in Task 6.
- A continued (multi-page) question part keeps its badge, so a non-calculator question split over two printed pages is tagged on both. Pinned in Task 4.

---

### Task 1: Calculator rule module

**Files:**
- Create: `src/lib/calculator-policy.mjs`
- Test: `src/lib/calculator-policy.test.ts`

**Interfaces:**
- Produces: `calculatorAllowed(bank: string, question: { paper: number; year: number }): boolean | null`, `calculatorBadgeText(value: boolean | null | undefined): "CALCULATOR" | "NO CALCULATOR" | null`, `CALCULATOR_POLICY_BANKS: readonly string[]`, `CALCULATOR_FILTER_BANKS: readonly string[]`.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/calculator-policy.test.ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CALCULATOR_FILTER_BANKS, CALCULATOR_POLICY_BANKS, calculatorAllowed, calculatorBadgeText } from "@/lib/calculator-policy.mjs";

type RawQuestion = { id: string; paper: number; year: number; calculator: boolean };
const raw = (file: string) => (JSON.parse(readFileSync(join(process.cwd(), "src/data/raw", file), "utf8")) as { questions: RawQuestion[] }).questions;

describe("calculator policy", () => {
  it("applies each exam board's paper rule", () => {
    expect(calculatorAllowed("igcse", { paper: 1, year: 2025 })).toBe(false);
    expect(calculatorAllowed("igcse", { paper: 2, year: 2026 })).toBe(false);
    expect(calculatorAllowed("igcse", { paper: 4, year: 2025 })).toBe(true);
    expect(calculatorAllowed("igcse", { paper: 2, year: 2024 })).toBe(true);
    expect(calculatorAllowed("igcse-additional", { paper: 1, year: 2025 })).toBe(false);
    expect(calculatorAllowed("igcse-additional", { paper: 1, year: 2024 })).toBe(true);
    expect(calculatorAllowed("igcse-additional", { paper: 2, year: 2025 })).toBe(true);
    expect(calculatorAllowed("ib-hl", { paper: 1, year: 2018 })).toBe(false);
    expect(calculatorAllowed("ib-hl", { paper: 3, year: 2024 })).toBe(true);
    expect(calculatorAllowed("ib-sl", { paper: 1, year: 2025 })).toBe(false);
    expect(calculatorAllowed("ib-sl", { paper: 2, year: 2025 })).toBe(true);
    expect(calculatorAllowed("ib-ai-hl", { paper: 1, year: 2023 })).toBe(true);
    expect(calculatorAllowed("ib-ai-sl", { paper: 1, year: 2023 })).toBe(true);
    expect(calculatorAllowed("igcse-chemistry-0620", { paper: 1, year: 2024 })).toBeNull();
    expect(calculatorAllowed("ib-economics-hl", { paper: 1, year: 2024 })).toBeNull();
  });

  it("agrees with every reviewed 0580 calculator value", () => {
    const questions = raw("igcse.json");
    expect(questions).toHaveLength(3967);
    expect(questions.filter((question) => calculatorAllowed("igcse", question) !== question.calculator)).toEqual([]);
  });

  it("corrects exactly the pre-2025 0606 Paper 1 questions the raw data marks non-calculator", () => {
    const changed = raw("igcse-additional.json").filter((question) => calculatorAllowed("igcse-additional", question) !== question.calculator);
    expect(changed).toHaveLength(691);
    expect(changed.every((question) => question.year < 2025 && question.paper === 1 && question.calculator === false)).toBe(true);
  });

  it("labels badges for printing and leaves unknown banks untagged", () => {
    expect(calculatorBadgeText(true)).toBe("CALCULATOR");
    expect(calculatorBadgeText(false)).toBe("NO CALCULATOR");
    expect(calculatorBadgeText(null)).toBeNull();
    expect(calculatorBadgeText(undefined)).toBeNull();
  });

  it("only offers a filter where both values occur", () => {
    expect(CALCULATOR_FILTER_BANKS).toEqual(["igcse", "igcse-additional", "ib-hl", "ib-sl"]);
    expect(CALCULATOR_POLICY_BANKS).toEqual(["igcse", "igcse-additional", "ib-hl", "ib-sl", "ib-ai-hl", "ib-ai-sl"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/calculator-policy.test.ts`
Expected: FAIL (cannot resolve `@/lib/calculator-policy.mjs`).

- [ ] **Step 3: Write minimal implementation**

```js
// src/lib/calculator-policy.mjs
// Calculator status is set per paper by each exam board, so this rule is the single source of truth
// for the bank index, the bank-page filter, the paper builder and printed PDFs.
//
// The raw 0606 data marks pre-2025 Paper 1 as non-calculator. Those papers allowed calculators
// (29 of their questions say "do not use a calculator in this question"); only 2025+ Paper 1 is
// non-calculator. The raw file is pinned by audit tests, so the correction is applied here.

/** Banks whose questions carry a calculator status. */
export const CALCULATOR_POLICY_BANKS = Object.freeze(["igcse", "igcse-additional", "ib-hl", "ib-sl", "ib-ai-hl", "ib-ai-sl"]);
/** Banks where both values occur, so a calculator filter is useful. */
export const CALCULATOR_FILTER_BANKS = Object.freeze(["igcse", "igcse-additional", "ib-hl", "ib-sl"]);

/**
 * @param {string} bank
 * @param {{ paper: number, year: number }} question
 * @returns {boolean | null} true when a calculator is allowed, false when it is not, null when the bank has no rule
 */
export function calculatorAllowed(bank, { paper, year }) {
  switch (bank) {
    case "igcse": return year >= 2025 ? paper !== 1 && paper !== 2 : true;
    case "igcse-additional": return year >= 2025 ? paper !== 1 : true;
    case "ib-hl":
    case "ib-sl": return paper !== 1;
    case "ib-ai-hl":
    case "ib-ai-sl": return true;
    default: return null;
  }
}

/**
 * @param {boolean | null | undefined} value
 * @returns {"CALCULATOR" | "NO CALCULATOR" | null}
 */
export function calculatorBadgeText(value) {
  if (value === true) return "CALCULATOR";
  if (value === false) return "NO CALCULATOR";
  return null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/calculator-policy.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/calculator-policy.mjs src/lib/calculator-policy.test.ts
git commit -m "feat: add calculator rule for maths banks

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 2: Derive `calculator` from the rule everywhere and fix the null filter

**Files:**
- Modify: `src/lib/questions.ts` (the `calculator:` line in `metadataFromRaw`, ~line 317)
- Modify: `scripts/generate-bank-index.mjs` (imports at the top; the `calculator:` line ~201)
- Modify: `src/lib/question-filter.ts:98-101`
- Modify (generated): `src/lib/bank-index-manifest.ts`
- Test: `src/lib/questions.test.ts`, `src/lib/question-filter.test.ts`, `scripts/generate-bank-index.test.mjs`

**Interfaces:**
- Consumes: `calculatorAllowed` from Task 1.
- Produces: `UnifiedQuestion.calculator` and `PublicQuestionMetadata.calculator` (`boolean | null`) follow the rule for all banks.

- [ ] **Step 1: Write the failing tests**

Append to the `describe` in `src/lib/questions.test.ts`:

```ts
  it("derives calculator status from the paper rule for every maths bank", () => {
    const additional = loadBankQuestions("igcse-additional");
    expect(additional.find((question) => question.year < 2025 && question.paper === 1)?.calculator).toBe(true);
    expect(additional.find((question) => question.year >= 2025 && question.paper === 1)?.calculator).toBe(false);
    const aa = loadBankQuestions("ib-sl");
    expect(aa.find((question) => question.paper === 1)?.calculator).toBe(false);
    expect(aa.find((question) => question.paper === 2)?.calculator).toBe(true);
    expect(loadBankQuestions("ib-ai-hl").every((question) => question.calculator === true)).toBe(true);
  });
```

Append a new `describe` to `src/lib/question-filter.test.ts` (it reuses the file's `question(id, code, facet)` factory, which builds questions with `calculator: null`):

```ts
describe("calculator filter", () => {
  it("never treats an unknown calculator status as non-calculator", () => {
    const unknown = { ...question("unknown", "c", "f"), calculator: null };
    const none = { ...question("none", "c", "f"), calculator: false };
    const allowed = { ...question("allowed", "c", "f"), calculator: true };
    const ids = (calculator: string[]) => filterQuestions([unknown, none, allowed], { calculator }).map((item) => item.id);
    expect(ids(["non-calculator"])).toEqual(["none"]);
    expect(ids(["calculator"])).toEqual(["allowed"]);
  });
});
```

Add `import { calculatorAllowed } from "../src/lib/calculator-policy.mjs";` to the imports of `scripts/generate-bank-index.test.mjs` (it already imports `readFileSync`, `join`, `describe`/`expect`/`it` and `PUBLIC_BANK_INDEX_FILES`), then append:

```js
describe("bank index calculator values", () => {
  it("follow the paper rule for maths banks and stay empty elsewhere", () => {
    for (const bank of ["igcse", "igcse-additional", "ib-hl", "ib-sl", "ib-ai-hl", "ib-ai-sl", "igcse-chemistry-0620"]) {
      const index = JSON.parse(readFileSync(join(process.cwd(), "public/bank-index", PUBLIC_BANK_INDEX_FILES[bank]), "utf8"));
      const wrong = index.questions.filter((question) => question.calculator !== calculatorAllowed(bank, question));
      expect(wrong, bank).toEqual([]);
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/questions.test.ts src/lib/question-filter.test.ts`
Expected: FAIL. The 0606 pre-2025 P1 and IB values come back as `false`/`null`, and the null question matches "non-calculator".

- [ ] **Step 3: Implement**

`src/lib/questions.ts`: add the import next to the other `@/lib/*.mjs` imports and replace the `calculator` line in `metadataFromRaw`:

```ts
import { calculatorAllowed } from "@/lib/calculator-policy.mjs";
```
```ts
    calculator: calculatorAllowed(slug, { paper, year: integer(raw.year) }),
```

(`paper` is the local already passed to `deriveCourseRoute(slug, paper)` in the same object.)

`scripts/generate-bank-index.mjs`: add next to the other `../src/lib/*.mjs` imports, then replace the `calculator` line:

```js
import { calculatorAllowed } from "../src/lib/calculator-policy.mjs";
```
```js
    calculator: calculatorAllowed(bank, { paper: integer(raw.paper), year: integer(raw.year) }),
```

`src/lib/question-filter.ts`: replace the calculator block:

```ts
    if (filters.calculator?.length) {
      // Unknown status matches neither option.
      if (question.calculator === null) return false;
      const mode = question.calculator ? "calculator" : "non-calculator";
      if (!filters.calculator.includes(mode)) return false;
    }
```

- [ ] **Step 4: Regenerate the index and run the tests**

Run: `npm run generate:bank-index && npx vitest run src/lib/questions.test.ts src/lib/question-filter.test.ts scripts/generate-bank-index.test.mjs`
Expected: PASS. `git status` shows `src/lib/bank-index-manifest.ts` changed (new content hashes).

Then run the full suite: `npm test`. If any test pinned the old manifest hashes or old 0606/IB `calculator` values, update the pinned value to the regenerated one only when the change is the intended calculator correction (check the diff names a `calculator` field or a bank-index hash).

- [ ] **Step 5: Commit**

```bash
git add src/lib/questions.ts scripts/generate-bank-index.mjs src/lib/question-filter.ts src/lib/bank-index-manifest.ts src/lib/questions.test.ts src/lib/question-filter.test.ts scripts/generate-bank-index.test.mjs
git commit -m "fix: derive calculator status from the paper rule

Corrects 691 pre-2025 0606 Paper 1 questions, adds IB AA/AI values, and
stops unknown status from matching the non-calculator filter.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 3: Bank-page calculator filter for IB AA

**Files:**
- Modify: `src/components/QuestionExplorer.tsx` (~line 271 and ~line 1062)
- Test: `src/components/QuestionExplorer.test.tsx`

**Interfaces:**
- Consumes: `CALCULATOR_FILTER_BANKS` from Task 1; rule-derived `calculator` from Task 2.

- [ ] **Step 1: Write the failing test**

Add next to the existing "exposes Cambridge component, variant, and calculator filters for Additional Mathematics" test:

```tsx
  it("offers the calculator filter for IB AA but not for IB AI", () => {
    const aa = prepareQuestionsForDelivery(loadBankQuestions("ib-sl").slice(0, 40), [{ productId: "bank_ib_sl", status: "active", startsAt: "2026-01-01T00:00:00Z", expiresAt: null }]);
    const { unmount } = render(<QuestionExplorer questions={aa} access={fullAccess} />);
    fireEvent.click(screen.getByRole("button", { name: /more filters/i }));
    expect(screen.getByRole("group", { name: /calculator/i })).toBeInTheDocument();
    unmount();
    const ai = prepareQuestionsForDelivery(loadBankQuestions("ib-ai-sl").slice(0, 40), [{ productId: "bank_ib_ai_sl", status: "active", startsAt: "2026-01-01T00:00:00Z", expiresAt: null }]);
    render(<QuestionExplorer questions={ai} access={fullAccess} />);
    fireEvent.click(screen.getByRole("button", { name: /more filters/i }));
    expect(screen.queryByRole("group", { name: /calculator/i })).not.toBeInTheDocument();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/QuestionExplorer.test.tsx -t "IB AA but not for IB AI"`
Expected: FAIL (no calculator group on IB AA).

- [ ] **Step 3: Implement**

In `QuestionExplorer.tsx`, import `CALCULATOR_FILTER_BANKS` from `@/lib/calculator-policy.mjs`, add next to `const isCambridge = ...` (~line 271):

```tsx
  const calculatorFilter = (CALCULATOR_FILTER_BANKS as readonly string[]).includes(bank);
```

and change the calculator `FilterGroup` line (~1062) to:

```tsx
              {calculatorFilter && <FilterGroup label="Calculator" filterKey="calculator" values={["calculator", "non-calculator"]} selected={filters.calculator ?? []} onToggle={toggle} />}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/QuestionExplorer.test.tsx`
Expected: PASS (including the existing Additional Mathematics test).

- [ ] **Step 5: Commit**

```bash
git add src/components/QuestionExplorer.tsx src/components/QuestionExplorer.test.tsx
git commit -m "feat: calculator filter on IB AA bank pages

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 4: PDF calculator badge

**Files:**
- Modify: `src/lib/pdf-export.ts` (`placeImage`, `addImagePage`, the question/answer loop)
- Test: `src/lib/pdf-export.verified.test.ts`

**Interfaces:**
- Consumes: `calculatorBadgeText` from Task 1; `question.calculator` (`boolean | null`) on `PdfExportQuestion`.

- [ ] **Step 1: Write the failing tests**

In `src/lib/pdf-export.verified.test.ts`, extend the hoisted mocks and the jsPDF mock class:

```ts
const { addImage, addPage, deletePage, save, verifyBytes, text, roundedRect } = vi.hoisted(() => ({
  addImage: vi.fn(), addPage: vi.fn(), deletePage: vi.fn(), save: vi.fn(), verifyBytes: vi.fn(), text: vi.fn(), roundedRect: vi.fn(),
}));
```
```ts
vi.mock("jspdf", () => ({ jsPDF: class {
  addImage = addImage; addPage = addPage; deletePage = deletePage; save = save; roundedRect = roundedRect;
  setProperties() {} setFont() {} setFontSize() {} setTextColor() {} text = text;
  setPage() {} setDrawColor() {} setFillColor() {} setLineWidth() {} line() {} textWithLink() {}
  getTextWidth(value: string) { return value.length * 1.5; }
} }));
```

Add tests inside `describe("real worksheet image placement", ...)`:

```ts
  it("prints a solid NO CALCULATOR badge left of the marks on a non-calculator question", async () => {
    await downloadQuestionPdf([{ ...q16, marks: 6, calculator: false } as UnifiedQuestion], "questions");
    expect(text).toHaveBeenCalledWith("NO CALCULATOR", expect.any(Number), expect.any(Number));
    const [x, , width, , , , style] = roundedRect.mock.calls[0];
    expect(style).toBe("FD");
    const marksCall = text.mock.calls.find((call) => call[0] === "6 marks")!;
    expect(x + width).toBeLessThanOrEqual(marksCall[1] - "6 marks".length * 1.5);
  });

  it("prints an outlined CALCULATOR badge, and nothing for unknown status or on answer pages", async () => {
    await downloadQuestionPdf([{ ...q16, marks: 6, calculator: true } as UnifiedQuestion], "questions");
    expect(roundedRect.mock.calls[0][6]).toBe("S");
    expect(text).toHaveBeenCalledWith("CALCULATOR", expect.any(Number), expect.any(Number));
    roundedRect.mockClear();
    await downloadQuestionPdf([{ ...q16, marks: 6, calculator: null } as UnifiedQuestion], "questions");
    expect(roundedRect).not.toHaveBeenCalled();
    await downloadQuestionPdf([{ ...q16, calculator: false, markschemeImages: ["https://signed.test/q16.webp"] } as UnifiedQuestion], "answers");
    expect(roundedRect).not.toHaveBeenCalled();
  });

  it("repeats the badge on the continued part of a question split across pages", async () => {
    vi.mocked(URL.createObjectURL).mockReturnValue("blob:0580-q11.webp");
    await downloadQuestionPdf([{ ...q0580, calculator: false } as UnifiedQuestion], "questions");
    expect(text.mock.calls.filter((call) => call[0] === "NO CALCULATOR")).toHaveLength(2);
  });
```

(`q16` has no `marks`, so the tests set `marks: 6`. `q0580` is the existing three-segment fixture in this file; place the third test after its declaration.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/pdf-export.verified.test.ts`
Expected: the three new tests FAIL (no badge drawn); existing tests still pass.

- [ ] **Step 3: Implement**

In `src/lib/pdf-export.ts`:

1. Import: `import { calculatorBadgeText } from "@/lib/calculator-policy.mjs";`
2. Inside `downloadQuestionPdf`, before `const placeImage = (`, add:

```ts
  // Boxed tag beside the marks: solid for "NO CALCULATOR" so it stands out like the exam's own warning.
  const drawCalculatorBadge = (badge: string, rightMm: number, topMm: number) => {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(6.5);
    const width = pdf.getTextWidth(badge) + 2.4;
    const x = rightMm - width;
    const solid = badge === "NO CALCULATOR";
    pdf.setLineWidth(0.25);
    pdf.setDrawColor(25, 25, 23);
    pdf.setFillColor(25, 25, 23);
    pdf.roundedRect(x, topMm + 0.4, width, 3.4, 0.6, 0.6, solid ? "FD" : "S");
    if (solid) pdf.setTextColor(255, 255, 255); else pdf.setTextColor(25, 25, 23);
    pdf.text(badge, x + 1.2, topMm + 2.9);
    pdf.setFont("helvetica", "normal");
  };
```

3. Change the `placeImage` parameter list to add `calculator: boolean | null` after `marks: number | null`, and replace the `detail` drawing line inside `if (labelSpace) { ... }`:

```ts
      const detail = continued ? "" : kind === "answer" ? "Official answer" : Number.isFinite(marks) && marks !== null ? `${marks} marks` : "";
      const rightEdge = Math.min(placement.pageWidthMm - 8, placement.xMm + placement.widthMm);
      if (detail) pdf.text(detail, rightEdge, nextImageY + 3, { align: "right" });
      const badge = kind === "question" ? calculatorBadgeText(calculator) : null;
      if (badge) drawCalculatorBadge(badge, rightEdge - (detail ? pdf.getTextWidth(detail) + 2 : 0), nextImageY);
```

4. Add `calculator: boolean | null` to `addImagePage` after `marks: number | null`, and pass `calculator` through to both `placeImage(...)` calls in it (after `marks`).
5. In the job loop, pass `question.calculator ?? null` after `question.marks` in the question `addImagePage` call, and `null` in the answer call.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/pdf-export src/lib/print-geometry`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/pdf-export.ts src/lib/pdf-export.verified.test.ts
git commit -m "feat: tag printed maths questions as calculator or no calculator

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 5: Calculator badges on builder paper rows

**Files:**
- Create: `src/components/CalculatorBadge.tsx`
- Modify: `src/lib/paper-builder.ts` (`PaperCandidate` type; new `paperCalculator`)
- Modify: `src/components/PaperBuilder.tsx` (paper target rows ~line 143; hint)
- Modify: `src/components/paper-builder.css`
- Test: `src/components/PaperBuilder.test.tsx`, `src/lib/paper-builder.test.ts` (create if absent)

**Interfaces:**
- Consumes: `calculatorBadgeText` (Task 1), index `calculator` (Task 2).
- Produces: `paperCalculator(pool: readonly { paper: number; calculator?: boolean | null }[], paper: number): boolean | null`; `<CalculatorBadge value={boolean | null | undefined} />`.

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/paper-builder.test.ts` (it exists; add `paperCalculator` to its `@/lib/paper-builder` import instead of duplicating the import lines below):

```ts
import { describe, expect, it } from "vitest";
import { paperCalculator } from "@/lib/paper-builder";

describe("paperCalculator", () => {
  it("returns the shared value, or null when a paper mixes or lacks values", () => {
    const pool = [
      { paper: 1, calculator: false }, { paper: 1, calculator: false },
      { paper: 2, calculator: false }, { paper: 2, calculator: true },
      { paper: 3, calculator: null },
    ];
    expect(paperCalculator(pool, 1)).toBe(false);
    expect(paperCalculator(pool, 2)).toBeNull();
    expect(paperCalculator(pool, 3)).toBeNull();
    expect(paperCalculator(pool, 4)).toBeNull();
  });
});
```

Append to `src/components/PaperBuilder.test.tsx`:

```tsx
  it("badges each 0580 paper by calculator status for the chosen years and explains the 2025 change", async () => {
    const igcse = { slug: "igcse" as const, label: "Mathematics 0580", indexUrl: "/igcse.json" };
    const row = (id: string, paper: number, year: number, calculator: boolean) => ({ ...metadata(id, paper, year, 4, "Number"), calculator });
    const igcseIndex = { version: 1, bank: "igcse", questions: [row("p1-new", 1, 2025, false), row("p1-old", 1, 2024, true), row("p4", 4, 2025, true)] };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(igcseIndex)));
    render(<PaperBuilder banks={[igcse]} />);
    await screen.findByRole("spinbutton", { name: "Paper 1 questions" });
    expect(screen.getByText(/Papers 1 and 2 are non-calculator from 2025/)).toBeInTheDocument();
    const paper1 = () => screen.getByRole("spinbutton", { name: "Paper 1 questions" }).closest(".paper-builder-target")!;
    const paper4 = () => screen.getByRole("spinbutton", { name: "Paper 4 questions" }).closest(".paper-builder-target")!;
    expect(within(paper1() as HTMLElement).queryByText(/CALCULATOR/)).not.toBeInTheDocument();
    expect(within(paper4() as HTMLElement).getByText("CALCULATOR")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("From year"), { target: { value: "2025" } });
    expect(within(paper1() as HTMLElement).getByText("NO CALCULATOR")).toBeInTheDocument();
  });

  it("shows no calculator badges or hint for science banks", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(index)));
    render(<PaperBuilder banks={[bank]} />);
    await screen.findByRole("spinbutton", { name: "Paper 1 questions" });
    expect(screen.queryByText(/CALCULATOR/)).not.toBeInTheDocument();
    expect(screen.queryByText(/non-calculator from 2025/)).not.toBeInTheDocument();
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/paper-builder.test.ts src/components/PaperBuilder.test.tsx`
Expected: FAIL (`paperCalculator` not exported; no badges or hint).

- [ ] **Step 3: Implement**

`src/lib/paper-builder.ts`: add `"calculator"` to the `Pick<...>` in `PaperCandidate`, and add:

```ts
/** The calculator status shared by every question of a paper in the pool, or null when unknown or mixed. */
export function paperCalculator(pool: readonly { paper: number; calculator?: boolean | null }[], paper: number): boolean | null {
  const values = new Set(pool.filter((question) => question.paper === paper).map((question) => question.calculator ?? null));
  return values.size === 1 ? [...values][0] : null;
}
```

`src/components/CalculatorBadge.tsx`:

```tsx
import { calculatorBadgeText } from "@/lib/calculator-policy.mjs";

export function CalculatorBadge({ value }: { value: boolean | null | undefined }) {
  const text = calculatorBadgeText(value);
  if (!text) return null;
  return <span className={`calculator-badge${value === false ? " is-none" : ""}`}>{text}</span>;
}
```

`src/components/PaperBuilder.tsx`:
- Imports: `import { CalculatorBadge } from "@/components/CalculatorBadge";` and add `paperCalculator` to the `@/lib/paper-builder` import.
- After the `visiblePapers` line add:

```tsx
  const yearPool = useMemo(() => questions.filter((question) => (!fromYear || question.year >= Number(fromYear)) && (!toYear || question.year <= Number(toYear))), [questions, fromYear, toYear]);
  const calculatorHint = bank === "igcse" ? "Papers 1 and 2 are non-calculator from 2025." : bank === "igcse-additional" ? "Paper 1 is non-calculator from 2025." : "";
```

- Replace the target row map (`group.papers.map((paper) => <label key={paper}>...</label>)`) with:

```tsx
{group.papers.map((paper) => <div className="paper-builder-target" key={paper}><label>Paper {paper} {mode === "questions" ? "questions" : "marks"}<input type="number" min="0" max={mode === "questions" ? 50 : 200} step="1" disabled={saving} value={targets[paper] ?? 0} onChange={(event) => { setTargets((current) => ({ ...current, [paper]: Number(event.target.value) })); resetDraft(); }} /></label><CalculatorBadge value={paperCalculator(yearPool, paper)} /></div>)}
```

- Directly after `<p className="paper-builder-muted">Enter a target for each paper. Leave 0 to skip it.</p>` add:

```tsx
          {calculatorHint && <p className="paper-builder-muted">{calculatorHint} Set From year to 2025 for a fully non-calculator paper.</p>}
```

`src/components/paper-builder.css` (append):

```css
.paper-builder-target { display: grid; gap: 6px; align-content: start; justify-items: start; }
.calculator-badge { display: inline-flex; align-items: center; padding: 1px 6px; border: 1px solid var(--ink); border-radius: 4px; color: var(--ink); font: 700 .62rem/1.45 var(--font-mono); letter-spacing: .06em; }
.calculator-badge.is-none { background: var(--ink); color: var(--paper); }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/paper-builder.test.ts src/components/PaperBuilder.test.tsx`
Expected: PASS, including existing PaperBuilder tests (spinbutton names unchanged).

- [ ] **Step 5: Commit**

```bash
git add src/components/CalculatorBadge.tsx src/lib/paper-builder.ts src/lib/paper-builder.test.ts src/components/PaperBuilder.tsx src/components/PaperBuilder.test.tsx src/components/paper-builder.css
git commit -m "feat: show calculator status on builder paper rows

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 6: Open the builder from a bank page

**Files:**
- Modify: `src/app/worksheets/build/page.tsx`
- Modify: `src/components/PaperBuilder.tsx` (props, initial state)
- Modify: `src/app/banks/[slug]/page.tsx` (hero)
- Modify: `src/app/globals.css` (hero action spacing)
- Test: `src/app/worksheets/build/page.test.tsx`, `src/components/PaperBuilder.test.tsx`, `src/app/banks/[slug]/page.test.ts`

**Interfaces:**
- Produces: `PaperBuilder({ banks, initialBank }: { banks: BuilderBank[]; initialBank?: BankSlug })`; `BuildPage({ searchParams }: { searchParams: Promise<{ bank?: string | string[] }> })`.

- [ ] **Step 1: Write the failing tests**

In `src/app/worksheets/build/page.test.tsx`, change every existing `BuildPage()` call to `BuildPage({ searchParams: Promise.resolve({}) })`, then add:

```tsx
  it("keeps the requested bank through login", async () => {
    createClient.mockResolvedValue({ auth: { getClaims: async () => ({ data: { claims: null } }) } });
    await expect(BuildPage({ searchParams: Promise.resolve({ bank: "igcse-chemistry-0620" }) }))
      .rejects.toThrow("REDIRECT:/login?next=%2Fworksheets%2Fbuild%3Fbank%3Digcse-chemistry-0620");
    await expect(BuildPage({ searchParams: Promise.resolve({ bank: "../evil" }) }))
      .rejects.toThrow("REDIRECT:/login?next=%2Fworksheets%2Fbuild");
  });

  it("preselects a requested bank only when the user can access it", async () => {
    createClient.mockResolvedValue({ auth: { getClaims: async () => ({ data: { claims: { sub: "u-1" } } }) } });
    fetchAccessEntitlements.mockResolvedValue({ rows: [], error: null });
    const allowed = renderToStaticMarkup(await BuildPage({ searchParams: Promise.resolve({ bank: "igcse-chemistry-0620" }) }));
    expect(allowed).toMatch(/<option value="igcse-chemistry-0620" selected="">/);
    const blocked = renderToStaticMarkup(await BuildPage({ searchParams: Promise.resolve({ bank: "igcse-physics-0625" }) }));
    expect(blocked).not.toContain("Physics 0625");
  });
```

In `src/app/banks/[slug]/page.test.ts` add:

```ts
  it("links each bank to the paper builder with the bank preselected", () => {
    const source = readFileSync(join(process.cwd(), "src/app/banks/[slug]/page.tsx"), "utf8");
    expect(source).toContain("href={`/worksheets/build?bank=${slug}`}");
    expect(source).toContain(">Build a paper</Link>");
  });
```

(Add `import { readFileSync } from "node:fs"; import { join } from "node:path";` at the top if missing.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/app/worksheets/build/page.test.tsx "src/app/banks/[slug]/page.test.ts"`
Expected: FAIL (no query handling; no bank-page link).

- [ ] **Step 3: Implement**

`src/app/worksheets/build/page.tsx`: change the signature and redirect, and pass `initialBank`:

```tsx
export default async function BuildPage({ searchParams }: { searchParams: Promise<{ bank?: string | string[] }> }) {
  const requested = (await searchParams).bank;
  const requestedBank = typeof requested === "string" && /^[a-z0-9-]{1,40}$/.test(requested) ? requested : undefined;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (typeof userId !== "string") redirect(`/login?next=${encodeURIComponent(`/worksheets/build${requestedBank ? `?bank=${requestedBank}` : ""}`)}`);
```

and render `<PaperBuilder banks={banks} initialBank={banks.some((bank) => bank.slug === requestedBank) ? requestedBank as BankSlug : undefined} />` (import `type BankSlug` from `@/lib/banks`).

`src/components/PaperBuilder.tsx`: change the signature and the two initial states:

```tsx
export function PaperBuilder({ banks, initialBank }: { banks: BuilderBank[]; initialBank?: BankSlug }) {
  const startBank = banks.find((item) => item.slug === initialBank) ?? banks[0];
  const [bank, setBank] = useState<BankSlug | "">(startBank?.slug ?? "");
```
```tsx
  const [name, setName] = useState(startBank ? `${startBank.label} practice paper` : "");
```

`src/app/banks/[slug]/page.tsx`: after the `bank-hero-stats` div, inside the hero `shell`:

```tsx
          <Link className="button secondary bank-hero-build" href={`/worksheets/build?bank=${slug}`}>Build a paper</Link>
```

`src/app/globals.css` (next to `.bank-hero-stats`):

```css
.bank-hero-build { display: inline-flex; margin-top: 12px; min-height: 40px; }
```

Add to `src/components/PaperBuilder.test.tsx`:

```tsx
  it("starts on the bank the teacher came from", async () => {
    const second = { ...bank, slug: "igcse-physics-0625" as const, label: "Physics 0625", indexUrl: "/physics.json" };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ ...index, bank: "igcse-physics-0625" })));
    render(<PaperBuilder banks={[bank, second]} initialBank="igcse-physics-0625" />);
    expect(screen.getByLabelText("Question bank")).toHaveValue("igcse-physics-0625");
    expect(screen.getByDisplayValue("Physics 0625 practice paper")).toBeInTheDocument();
  });
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/app/worksheets/build/page.test.tsx "src/app/banks/[slug]/page.test.ts" src/components/PaperBuilder.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/worksheets/build/page.tsx src/app/worksheets/build/page.test.tsx src/components/PaperBuilder.tsx src/components/PaperBuilder.test.tsx "src/app/banks/[slug]/page.tsx" "src/app/banks/[slug]/page.test.ts" src/app/globals.css
git commit -m "feat: build a paper straight from a bank page

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 7: My Worksheets panel, table and empty state

**Files:**
- Modify: `src/app/worksheets/page.tsx`
- Modify: `src/components/WorksheetList.tsx`
- Modify: `src/components/worksheet-workspace.css` (saved-worksheets rules, lines ~17-31)
- Modify: `src/app/globals.css` (remove `.worksheet-build-link`; add panel rules near `.worksheet-library-header`)
- Test: `src/components/WorksheetList.test.tsx`

**Interfaces:**
- Produces: `WorksheetList({ bankLabels }: { bankLabels?: Record<string, string> })`; `formatEdited(iso: string, now?: number): string` exported from `WorksheetList.tsx`.

- [ ] **Step 1: Write the failing tests**

In `src/components/WorksheetList.test.tsx`:
- In "offers accessible Open, Edit and Delete actions without Rename", replace `await screen.findByRole("heading", { name: "Algebra" });` with `await screen.findByRole("rowheader", { name: "Algebra" });`.
- Add:

```tsx
  it("shows the build panel and lists saved papers in a table with readable bank names", async () => {
    const page = readFileSync(join(process.cwd(), "src/app/worksheets/page.tsx"), "utf8");
    expect(page).toContain("A printable mock from any bank, with its mark scheme.");
    expect(page).toContain("Start building");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ worksheets: items })));
    render(<WorksheetList bankLabels={{ "igcse-0580": "Mathematics 0580" }} />);
    expect(await screen.findByRole("table")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Saved worksheets/ })).toHaveTextContent("· 1");
    expect(screen.getByRole("cell", { name: "Mathematics 0580" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Edited" })).toBeInTheDocument();
  });

  it("guides a first-time teacher with an empty state", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ worksheets: [] })));
    render(<WorksheetList />);
    expect(await screen.findByText("No saved papers yet")).toBeInTheDocument();
    expect(screen.getByText(/Papers you build, or question sets you save from a bank, will appear here/)).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("formats edit dates relatively for the last week", () => {
    const now = Date.parse("2026-10-09T12:00:00Z");
    expect(formatEdited("2026-10-09T08:00:00Z", now)).toBe("Today");
    expect(formatEdited("2026-10-08T08:00:00Z", now)).toBe("Yesterday");
    expect(formatEdited("2026-10-05T12:00:00Z", now)).toBe("4 days ago");
    expect(formatEdited("2026-09-01T12:00:00Z", now)).toMatch(/2026/);
    expect(formatEdited("not a date", now)).toBe("");
  });
```

and change the import to `import { WorksheetList, formatEdited } from "@/components/WorksheetList";`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/WorksheetList.test.tsx`
Expected: FAIL (no table, no rowheader, no `formatEdited`, old empty copy).

- [ ] **Step 3: Implement**

`src/app/worksheets/page.tsx` (return value; keep the imports and claims check, add `import { getAvailableBanks } from "@/lib/banks";`):

```tsx
  const bankLabels = Object.fromEntries(getAvailableBanks().map((bank) => [bank.slug, bank.shortName]));
  return <main className="worksheet-library-page shell">
    <Link className="worksheet-library-back" href="/dashboard" aria-label="Back to dashboard">← <span>Back to dashboard</span></Link>
    <header className="worksheet-library-header"><p className="eyebrow">Your work</p><h1>My worksheets</h1></header>
    <section className="worksheet-build-panel" aria-labelledby="worksheet-build-title">
      <span className="worksheet-build-icon" aria-hidden="true" />
      <div><h2 id="worksheet-build-title">Build a paper</h2><p>A printable mock from any bank, with its mark scheme.</p></div>
      <Link className="button primary" href="/worksheets/build">Start building <span aria-hidden="true">→</span></Link>
    </section>
    <WorksheetList bankLabels={bankLabels} />
  </main>;
```

`src/components/WorksheetList.tsx`:
- Add above the component:

```tsx
/** "Today", "Yesterday", "N days ago" within a week, otherwise a short date. */
export function formatEdited(iso: string, now = Date.now()): string {
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return "";
  const days = Math.floor((now - then) / 86_400_000);
  if (days < 1) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(then).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}
```

- Signature: `export function WorksheetList({ bankLabels = {} }: { bankLabels?: Record<string, string> }) {`
- Replace the returned `<section ...>` opening through the end of the list rendering (keep the dialog block unchanged) with:

```tsx
  return <section className="saved-worksheets" aria-labelledby="saved-worksheets-title">
    <h2 id="saved-worksheets-title" className="saved-worksheets-title">Saved worksheets{worksheets.length > 0 && <span> · {worksheets.length}</span>}</h2>
    {error && <p role="alert" className="saved-worksheets-error">{error}</p>}
    {loading ? <p role="status">Loading worksheets…</p> : worksheets.length === 0 ? <div className="saved-worksheets-empty"><p><strong>No saved papers yet</strong></p><p>Papers you build, or question sets you save from a bank, will appear here.</p></div> : <table className="saved-worksheets-table">
      <thead><tr><th scope="col">Name</th><th scope="col">Bank</th><th scope="col">Questions</th><th scope="col">Edited</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
      <tbody>{worksheets.map((item) => <tr key={item.id}>
        <th scope="row" className="saved-worksheet-name">{item.title}</th>
        <td data-label="Bank">{bankLabels[item.bank_slug] ?? item.bank_slug.replaceAll("-", " ")}</td>
        <td data-label="Questions">{item.question_ids.length} {item.question_ids.length === 1 ? "question" : "questions"}</td>
        <td data-label="Edited"><time dateTime={item.updated_at}>{formatEdited(item.updated_at)}</time></td>
        <td className="saved-worksheet-actions">
          <a className="saved-worksheet-action saved-worksheet-action-open" aria-label={`Open ${item.title}`} href={`/banks/${encodeURIComponent(item.bank_slug)}?worksheet=${encodeURIComponent(item.id)}`}>Open</a>
          <a className="saved-worksheet-action saved-worksheet-action-edit" aria-label={`Edit ${item.title}`} href={`/banks/${encodeURIComponent(item.bank_slug)}?worksheet=${encodeURIComponent(item.id)}&mode=edit`}>Edit</a>
          <details className="saved-worksheet-more"><summary aria-label={`More actions for ${item.title}`}>⋯</summary>
            <button className="saved-worksheet-action saved-worksheet-action-delete" type="button" aria-label={`Delete ${item.title}`} disabled={busy === item.id} onClick={(event) => { triggerRef.current = event.currentTarget; setDeleteError(""); setPending(item); }}>Delete</button>
          </details>
        </td>
      </tr>)}</tbody>
    </table>}
```

(The `{pending && <dialog ...>}` block and closing `</section>;` stay as they are. Keep the exact Open-link prefix `<a className="saved-worksheet-action saved-worksheet-action-open" aria-label={\`Open ${item.title}\`}`, which an existing source test asserts.)

`src/components/worksheet-workspace.css`: replace the `.saved-worksheets*` and `.saved-worksheet-*` rules (lines ~17-31) with:

```css
.saved-worksheets { margin: 0 0 2.5rem; }
.saved-worksheets-title { margin: 0 0 .6rem; font-size: 1rem; }
.saved-worksheets-title span { color: var(--muted); font-weight: 450; }
.saved-worksheets-table { width: 100%; border-collapse: collapse; background: var(--surface); border: 1px solid var(--line); border-radius: 12px; overflow: hidden; }
.saved-worksheets-table th, .saved-worksheets-table td { padding: .7rem .85rem; border-bottom: 1px solid var(--line); text-align: left; font-size: .9rem; }
.saved-worksheets-table tbody tr:last-child > * { border-bottom: 0; }
.saved-worksheets-table thead th { color: var(--muted); font: 600 .68rem/1 var(--font-mono); text-transform: uppercase; letter-spacing: .08em; }
.saved-worksheet-name { font-weight: 700; }
.saved-worksheets-table td:not(.saved-worksheet-actions) { color: var(--muted); }
.saved-worksheet-actions { display: flex; justify-content: flex-end; align-items: center; gap: .25rem; }
.saved-worksheet-action { display: inline-flex; align-items: center; min-height: 2.25rem; padding: 0 .6rem; border: 0; border-radius: 7px; background: none; color: var(--ink); font: inherit; font-weight: 650; text-decoration: none; cursor: pointer; }
.saved-worksheet-action:hover, .saved-worksheet-action:focus-visible { background: var(--cobalt-faint); color: var(--cobalt-strong); }
.saved-worksheet-more { position: relative; }
.saved-worksheet-more summary { display: inline-grid; place-items: center; min-width: 2.25rem; min-height: 2.25rem; border-radius: 7px; list-style: none; cursor: pointer; color: var(--muted); }
.saved-worksheet-more summary::-webkit-details-marker { display: none; }
.saved-worksheet-more[open] summary, .saved-worksheet-more summary:hover { background: var(--cobalt-faint); color: var(--ink); }
.saved-worksheet-more > .saved-worksheet-action { position: absolute; z-index: 2; right: 0; top: calc(100% + 4px); background: var(--surface-raised); border: 1px solid var(--line); box-shadow: 0 8px 24px rgb(0 0 0 / .08); color: #a52525; }
.saved-worksheets-error { color: #a52525; }
.saved-worksheets-empty { padding: 1.5rem; border: 1px dashed var(--line-strong); border-radius: 12px; text-align: center; color: var(--muted); }
.saved-worksheets-empty p { margin: 0 0 .25rem; }
.saved-worksheets-empty strong { color: var(--ink); }
@media (max-width: 600px) {
  .saved-worksheets-table thead { display: none; }
  .saved-worksheets-table, .saved-worksheets-table tbody, .saved-worksheets-table tr { display: block; }
  .saved-worksheets-table tr { padding: .75rem .85rem; border-bottom: 1px solid var(--line); }
  .saved-worksheets-table tbody tr:last-child { border-bottom: 0; }
  .saved-worksheets-table th, .saved-worksheets-table td { display: inline; padding: 0; border: 0; }
  .saved-worksheet-name { display: block !important; margin-bottom: .2rem; }
  .saved-worksheets-table td[data-label]:not(:last-of-type)::after { content: " · "; }
  .saved-worksheet-actions { display: flex !important; justify-content: flex-start; margin-top: .4rem; }
}
```

`src/app/globals.css`: delete the `.worksheet-build-link { ... }` line and add after `.worksheet-library-header > p:not(.eyebrow) { ... }`:

```css
.worksheet-build-panel { display: flex; align-items: center; gap: 14px; margin: 0 0 2rem; padding: 16px 18px; background: var(--surface); border: 1px solid var(--line); border-radius: 12px; }
.worksheet-build-panel > div { flex: 1; min-width: 0; }
.worksheet-build-panel h2 { margin: 0; font-size: 1rem; }
.worksheet-build-panel p { margin: .2rem 0 0; color: var(--muted); }
.worksheet-build-icon { position: relative; flex: none; width: 30px; height: 36px; border: 1.5px solid var(--cobalt); border-radius: 4px; background: var(--surface-raised); }
.worksheet-build-icon::after { content: "+"; position: absolute; inset: 0; display: grid; place-items: center; color: var(--cobalt); font-size: 1.15rem; }
@media (max-width: 600px) { .worksheet-build-panel { flex-wrap: wrap; } .worksheet-build-panel .button { width: 100%; justify-content: center; } }
```

`.sr-only` already exists in `globals.css` (line ~108); do not add another.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/WorksheetList.test.tsx`
Expected: PASS (existing delete-dialog test still finds `Delete Algebra` inside the details menu).

- [ ] **Step 5: Commit**

```bash
git add src/app/worksheets/page.tsx src/components/WorksheetList.tsx src/components/WorksheetList.test.tsx src/components/worksheet-workspace.css src/app/globals.css
git commit -m "feat: clearer My Worksheets with a build panel and tidy table

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 8: Verify and open the PR

**Files:** none new.

- [ ] **Step 1: Full verification**

Run: `npm run lint && npm run typecheck && npm test && npm run build`
Expected: all pass. (If `npm run build` fails on a `node_modules` symlink in the worktree, replace it with a real `npm ci`.)

- [ ] **Step 2: Visual check**

Run `npm run dev` in the worktree (port 3000) and, signed in, check in a browser:
- `/worksheets` at desktop width and at 375px: panel, table (or empty state), ⋯ → Delete opens the existing dialog.
- A bank page hero shows "Build a paper"; clicking it opens `/worksheets/build?bank=<slug>` with that bank selected (or the plans prompt for a free account).
- `/worksheets/build` for 0580: Paper 1 shows no badge until From year is 2025, then "NO CALCULATOR"; Paper 4 shows "CALCULATOR"; hint visible.
- A PDF of mixed 0580 questions: badges beside marks on question pages, none on answer pages. (If no paid account is available locally, generate it through the existing harness in `.worktrees/scratch/harness` with a `calculator` field on the sample questions.)

- [ ] **Step 3: Push and open the PR**

```bash
git push -u origin feat/worksheets-and-calculator-tags
gh pr create --base main --title "My Worksheets refresh and calculator tags" --body-file - <<'BODY'
Implements `docs/superpowers/specs/2026-10-09-worksheets-calculator-tags-design.md`.

- **My Worksheets:** slim "Build a paper" panel, saved papers as a table (readable bank names, relative dates, Open / Edit / ⋯ Delete), empty state, mobile layout.
- **Bank pages:** "Build a paper" opens the builder with that bank selected (bank kept through login).
- **Calculator rule:** one module (`src/lib/calculator-policy.mjs`) for 0580, 0606 and IB AA/AI; used by the bank index and the app. Corrects 691 pre-2025 0606 Paper 1 questions (those papers allowed calculators; 29 of their questions say "do not use a calculator in this question"). Unknown status no longer matches "non-calculator". The bank-page calculator filter now also covers IB AA.
- **Builder:** each paper row shows its calculator badge when the chosen years share one status, plus a 2025 hint for 0580/0606. No toggle (status follows the paper).
- **PDF:** solid NO CALCULATOR / outlined CALCULATOR badge beside the marks on question pages, including continued parts; nothing on answers or non-maths banks.

## Verification
- `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`
- Manual: My Worksheets (desktop, 375px), bank-page link, builder badges and hint, a mixed 0580 PDF

🤖 Generated with [Claude Code](https://claude.com/claude-code)
BODY
```
