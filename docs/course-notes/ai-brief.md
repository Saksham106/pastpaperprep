# IB Maths AI notes: writer and verifier brief

This brief covers one lesson per item of IB Mathematics: applications and interpretation (guide first assessment
2021, updated November 2020), SL and HL.

**Audience:** students aged 16–18, including students who are stuck and learning the item from this lesson alone. AI
students use mathematics to model and interpret real situations, and they use a graphic display calculator (GDC) on
every paper. An IB maths teacher will review the lessons.

**Read first:**
- `docs/course-notes/aa-style-guide.md` §1–10, §12–14, §16 and §19: voice, lesson shape, blocks, notation, worked
  examples, checks, glossary, links, booklet formulas, mistakes, exam tips, figures and the "don't" list. Everything
  there applies unless this brief says otherwise. §11's paper rules and §17's calculator rules are replaced below.
- `docs/course-notes/process-v3.md` (why the process looks like this) and `docs/course-notes/review-errata.md` (errors
  owner reviews caught in earlier courses: don't repeat them).

**Examples of the standard:** the finished AA lessons `src/content/notes/ib-math-aa/lessons/5-8.json` and `4-4.json`.

## Inputs

| What | Where |
|---|---|
| Your item, e.g. `4.11` (dashed `4-11`) | the task message |
| Source pack | `../../../research/course-notes-ai/packs/<dashed>.json` from this worktree. *Never copy question text, set-ups or the guide's wording from it.* |
| What the pack holds | the item's bullets, the guide's content and guidance text, the guide page, the AA lesson(s) teaching the same mathematics and how AI differs, past AI questions with mark schemes, mark-scheme "award A0 / do not accept" lines, the glossary terms you own and use, prerequisites, assessment |
| Official guide (PDF) | `../../../research/course-notes-ai/sources/ai-guide-cygnus.pdf`. Read the pack's `guidePage` with the Read tool (`pages`) when the pack's formula text is garbled. |
| Formula booklet (PDF) | `../../../research/course-notes-ai/sources/ai-booklet-hl.pdf` (2023; SL booklet is its SL part) |
| Items, levels, booklet ids | `src/content/notes/ib-math-ai/items.json` |
| Calculator snippets | `src/content/notes/ib-math-ai/calculator.json` |
| Format and rules | `src/lib/course-notes/types.ts`, `validate.ts`, `inline.ts`; `scripts/notes/verify_kinds.py` (the `KINDS` table and each checker's docstring) |

## Outputs (only these files; several writers share the worktree)

1. `src/content/notes/ib-math-ai/lessons/<dashed>.json`, with `"edition": "ib-math-ai-2021"`.
2. `src/content/notes/ib-math-ai/glossary/<dashed>.json`. It holds `TODO:` stubs for the terms the glossary plan says you own. Write a real definition for every one: plain words, `$…$` allowed, no maths in the label. Don't add terms the plan doesn't list, and don't touch other items' glossary files.
3. `src/content/notes/ib-math-ai/figures/<dashed>-<what>.svg`, if any. Follow style guide §16.
4. `../../../research/course-notes-ai/writer-notes/<dashed>.md`, only for a deliberate deviation: one line each, with the reason.

Never run git, vitest, `build-content-index.mjs` or `write-receipts.mjs`. A sidecar in `scripts/notes/sidecars/ib-math-ai/<dashed>.py` is allowed only when no verify kind fits. It imports `mathparse` via `parents[2]`.

## Building on the AA lesson

The pack's `aa` block lists AA lessons that teach the same mathematics: `same` (the guide's content and guidance are
identical), `same-content` (same content, different guidance: `differs` says how) or `partial`.

- **`same` / `same-content`:** read the AA lesson first. Its explanations, definitions, results and mistakes were
  verified and owner-reviewed: keep what is right and fits AI, rewritten in your own words for this lesson. Then make
  it an AI lesson:
  - **All worked examples and checks are new.** Real-world contexts where AI questions use them (populations, money,
    measurements, surveys, sport, science). Never reuse an AA example's set-up or numbers.
  - **Technology where the guide says so.** If the AI guidance says "using technology", the GDC route is the main
    method, with the algebra shown only where it helps understanding. Where `differs` says AI goes less far (proof,
    exact forms), leave that out.
  - **Interpretation.** Most AI marks ask what a value means in context, whether a model is reasonable, and its
    limitations. Every teaching section has at least one example or check that interprets a result.
- **`partial`:** use the AA lesson as a reference for correct mathematics only; write the lesson for AI from scratch.
- **`none`:** write from the pack. Voronoi diagrams, graph theory, hypothesis testing, Markov chains, phase portraits
  and similar are AI-only.
- The AA lesson is not proof. Check everything you keep against `review-errata.md`.

## SL and HL

- **The lesson's `level`** comes from `items.json`: "SL" or "AHL". Every bullet in an item has the item's level.
- **SL lesson:** works completely for an SL student. If HL goes further on the same idea, add one `hlNote` at that point
  (style guide §11's rule on `hlNote` applies).
- **AHL lesson:** may assume every SL lesson. Start from what SL taught.
- **Never go beyond the guide.** If an idea isn't in the item's bullets or guide text, leave it out or link to the
  lesson that owns it. AI is not AA: no proofs or derivations the guide doesn't ask for.

## Papers, technology and accuracy

| | Paper 1 | Paper 2 | Paper 3 (HL) |
|---|---|---|---|
| SL | 1 h 30, 80 marks, short response | 1 h 30, 80 marks, extended response | — |
| HL | 2 h, 110 marks | 2 h, 110 marks | 1 h, 55 marks, two extended problem-solving questions |

- **A GDC is required on every paper.** There is no non-calculator paper. Teach the understanding first, then the GDC
  route an exam answer would use, and say what to write down: the equation or model being solved, the values entered,
  and the result. A bare GDC answer earns the A marks only if it's right; written set-up earns the M marks.
- **`papers`:** follows the pack's `paperCounts`. SL lessons list `P1` and/or `P2`; AHL lessons may add `P3`. With no
  pack questions, list `P1` and `P2`.
- **Calculator steps** use snippets: `{ "type": "calculator", "snippet": "<id>", "values": {…} }`, next to the example
  they solve. The snippet list is in `calculator.json`. Write custom `steps` only if no snippet fits, for all three
  models (`ti84`, `nspire`, `casio`), and end any step you can't confirm with "(check on your model)".
- **Accuracy:** exact answers or 3 significant figures unless the question says otherwise; money to 2 decimal places
  (or the currency's convention); angles in degrees to 1 d.p. unless radians are asked for. Never round intermediate
  values: keep the GDC's full value.
- **Formulas:** style guide §12. Tag a formula `booklet` (with its `bookletId` from `items.json`) only when it is in
  the AI booklet at the lesson's level; everything else is `learn`. Flag each formula or fact for the cheat sheet
  **once**, either where it is taught or in the takeaways.

## Answers: every example and check carries `verify`

Each example and check carries `"verify": { "kind": …, "truth": …, …options }`. The gate checks the published answer,
and every multiple-choice distractor must fail.

- **Kinds:** the maths kinds in `scripts/notes/verify_kinds.py`: `exact`, `rounded`, `numeric`, `list`, `assignments`,
  `point`, `vector`, `equation`, `inequality`/`set`, `ratio`, `standard-form`, `money`, `time`, `bearing`, `angle`,
  `fraction`, `expression` (with `form`), `antiderivative`, `choice` (word-only options) and `explanation`.
- **`truth` is the computation from the question's own data**, not your answer typed back in: `"1500*(1 + 0.035/12)**(12*8)"`,
  not `"1985.71"`.
- **GDC values in truths:** `scripts/notes/stats_data.py` gives the same values a GDC does, from the question's data.
  Its docstring lists them: `avg`, `sdpop`, `sdsample`, `med`, `quartile1/3` (TI method), `pearson`, `spearman`,
  `regslope`, `regintercept`, `expreg`, `powreg`, `polyreg`, `normcdf`, `invnorm`, `binompdf/cdf`, `poissonpdf/cdf`,
  `tcdf`, `invt`, `chi2cdf`, `chi2expected`, `chi2indep`, `chi2df`, `chi2gof`, `ttest2` (pooled by default),
  `ttest2df`, `ttest1`, and TVM `tvm_fv/pv/pmt/n/rate` (TI sign convention, C/Y defaults to P/Y). Examples:
  `"normcdf(-oo, 172, 165, 8)"`, `"1 - binomcdf(15, 0.4, 5)"`, `"chi2cdf(chi2indep([[18, 22], [30, 10]]), oo, 1)"`,
  `"-tvm_pmt(240, 4.2, 180000, 0, 12)"`. Use `Abs`, not `abs`. A sidecar only when nothing fits.
- **Precision:** a rounded or numeric answer declares `sf` or `dp`, which must be what the question asks for, or 3 s.f.
- **Numeric checks:** a student can type 1.5e24 or 1.5×10^24. Don't make tiny answers that 0 would fall within; scale
  the unit instead.

## Originality, glossary, length

- **Originality.** Invent every example and check from scratch, with different contexts and numbers from every pack
  question and from the AA lesson. A lint fails a block that shares 3+ numbers (2+ of them not round) with a pack
  question, and any 8-word run copied from the pack (including the guide).
- **Glossary links.** The first prose use of every planned term you own or use must be a `[[id|label]]` link. Run the
  validator with `--fix` and it adds these for you; check they read well.
- **Prerequisites:** start from the pack's `prerequisites`.
- **Reading time and examples.**
  - Run `validate-lesson.mjs` with `--fix`: it sets `readingMinutes` for you. Don't edit it by hand.
  - Every teaching section has **two worked examples** plus its checks. Never cut an example to save time: a lesson
    can run long when the extra time is examples. Cut repetition and wordy prose instead.
  - Guide bands: 1–2 bullets 10–18 min, 3–5 bullets 15–25, 6+ bullets 20–30.
- **Interactives:** use one only where an existing widget in `src/components/course-notes/interactives/registry.ts`
  fits the item exactly. Never invent one.
- **Standalone lines keep their conditions.** A cheat-sheet fact, takeaway, exam tip or glossary definition is read on
  its own. It must carry every condition the body states (review-errata rule 1).
- **Mistakes and exam tips.**
  - Ground mistakes in the pack's real `mistakes`, rewritten. AI mark schemes often penalise missing units, premature
    rounding, a GDC answer with no set-up, and an interpretation that ignores the context.
  - Exam tips use the IB command terms (style guide §14) and say what earns the marks.

## Writer: done when

`node scripts/notes/validate-lesson.mjs --course ib-math-ai --fix <item>` prints PASS for every check. Then reply with only:

```
SECTION: <item> <title>
STATUS: done | blocked
COVERAGE: <bullet id> -> <section ids>, one line per bullet
AA: <AA lessons used and what you kept, or none>
JUDGEMENT CALLS: <scope choices, anything uncertain, or none>
```

## Verifier

Read the lesson blind, against the pack, this brief and `review-errata.md`. Work out every answer yourself.

1. **Accuracy.** Every statement, step, answer, option and explanation is correct. Each `verify.truth` is computed from
   the question's data and matches the question text exactly.
2. **General statements:** for every result, definition, method line, cheat-sheet fact, takeaway and exam tip, try to
   find a counterexample, edge case or unstated condition. Read each standalone line as if nothing else on the page
   existed. A rule that only holds under conditions must state them.
3. **Statistics and modelling:** hypotheses stated about the population parameter; conclusions in context, "at the
   x% significance level", never "proves"; test conditions (expected frequencies ≥ 5, normality, independence) stated
   where the guide expects them; models interpreted with their domain and limitations.
4. **Coverage and levels:** every bullet taught and covered by a goal; SL lessons stand alone; nothing beyond the guide
   presented as required.
5. **Exam fit:** GDC route from snippets, with the written set-up that earns M marks; accuracy conventions; formulas
   tagged correctly.
6. **Teaching:** a stuck 16-year-old could follow it; checks are worth doing and their hints help; figures match the
   text and alt text.
7. **Originality:** no pack set-up or numbers reused; no AA example or check reused.

Run `validate-lesson.mjs` and probe one multiple-choice id or example with a wrong answer:
`check-math.py --course ib-math-ai --verify <item> <id> '<wrong tex>'` must FAIL.

**You fix minors yourself.** Edit only this item's lesson, glossary and figure files, re-run `validate-lesson.mjs --fix`
until it passes, and list each fix. **Don't fix criticals:** report them with the correct maths, and a fixer will act on
them.

- **critical:** wrong maths or answer; a general statement or standalone line that is false as written; a bullet not
  taught; a `truth` not computed from the question; copied pack or AA set-ups; a wrong calculator step; or anything
  that would leave a student unable to follow the lesson.
- **minor:** everything else worth fixing.

Reply with only:

```
SECTION: <item>
VERDICT: pass | minor-fixed | critical
CRITICAL: <numbered: json path — what is wrong, with the correct maths — the fix>, or none
FIXED: <numbered minors you fixed>, or none
CHECKS: validate-lesson <PASS/FAIL>; wrong-answer probe <FAILED as expected / passed wrongly>
```
