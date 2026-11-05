# IGCSE Maths 0580 notes: writer and verifier brief

This brief covers one lesson per syllabus section of Cambridge IGCSE Mathematics 0580 (2025–2027). It is for students aged 14–16, including students who are stuck and learning the section from this lesson alone. An IGCSE teacher will review the lessons.

**Read first:** `docs/course-notes/aa-style-guide.md` §1–10, §13, §16 and §19, for voice, lesson shape, blocks, notation, worked examples, checks, glossary, links, mistakes, figures and the "don't" list. Everything there applies, except where this brief says otherwise. `process-v2.md` explains why the process looks like this.

**Examples of the standard:** `src/content/notes/ib-math-aa/lessons/5-8.json` and `4-4.json` are finished lessons at the bar we want. 0580 is a younger audience, so use simpler words and smaller steps.

## Inputs

| What | Where |
|---|---|
| Your section, e.g. `2.5` (dashed `2-5`) | the task message |
| Source pack: syllabus bullets with levels, formula list, glossary terms you own and use, prerequisites, past-paper questions with mark steps, real mistakes, assessment | `../research/igcse-maths-0580-notes/packs/<dashed>.json`, or `../../../research/…` from a `.worktrees/` checkout. *Never copy question text or set-ups from it.* |
| Bullets, levels, formula-list ids | `src/content/notes/igcse-maths-0580/items.json` |
| Calculator snippets | `src/content/notes/igcse-maths-0580/calculator.json` |
| Format and rules | `src/lib/course-notes/types.ts`, `validate.ts`, `inline.ts`; `scripts/notes/verify_kinds.py` |

## Outputs (only these files; several writers share the worktree)

1. `src/content/notes/igcse-maths-0580/lessons/<dashed>.json`
2. `src/content/notes/igcse-maths-0580/glossary/<dashed>.json`. It already holds `TODO:` stubs for the terms the plan says you own. Write a real definition for every one: plain words, `$…$` maths allowed, no maths in the label. Don't add terms the plan doesn't list, and don't touch other sections' glossary files.
3. `src/content/notes/igcse-maths-0580/figures/<dashed>-<what>.svg`, if any. Follow the style guide §16.
4. `../research/igcse-maths-0580-notes/writer-notes/<dashed>.md`, only for a deliberate deviation, one line each, with the reason.

Never run git, vitest, `build-content-index.mjs` or `write-receipts.mjs`. A sidecar in `scripts/notes/sidecars/igcse-maths-0580/<dashed>.py` is allowed only when no verify kind fits. It imports `mathparse` via `parents[2]`.

## Core and Extended

- **The lesson's `level`** comes from `items.json`. Most sections are Core, but some of their bullets are Extended.
- **Core lesson:** teach Core bullets in normal content, under goals with no level. Teach Extended bullets in content marked `"level": "Extended"`:
  - use a whole section for anything substantial (e.g. "Recurring decimals");
  - mark single blocks (text, example, check, formula, fact, figure, calculator) for small additions;
  - give each Extended goal `"level": "Extended"`.

  A Core student sees only Core content, so the Core path must make complete sense on its own. Never rely on a hidden Extended block to explain a Core idea.
- **Extended-only section** (lesson level `Extended`): no level marks are needed inside.
- **`hlNote`:** use it only for a short pointer to Extended material taught in another section.

## Papers, calculators and accuracy

| Paper | Tier | Calculator |
|---|---|---|
| P1 | Core | no |
| P2 | Extended | no |
| P3 | Core | scientific |
| P4 | Extended | scientific |

- **`papers`:** follows the pack's `paperCounts`.
- **Method order:** teach the non-calculator method first wherever a section appears on P1/P2. Add calculator steps only where a calculator genuinely helps on P3/P4.
- **Calculator steps:** use snippets: `{ "type": "calculator", "snippet": "<id>", "values": {…} }`. Write custom `steps` only if no snippet fits; then mark any step you can't be sure of "(check on your model)".
- **Accuracy:** exact answers, or 3 s.f. Angles in degrees to 1 d.p. Money to the cent, unless the question says otherwise. π from the calculator or 3.142, as the question states.
- **Formulas:**
  - Tag a formula `booklet` (with its `bookletId` from `items.json`) only when it is on the 0580 formula list; mark an Extended-list-only formula `"level": "Extended"` in a Core lesson. Everything else is `learn`.
  - Flag each formula or fact for the cheat sheet **once**, either where it is taught or in the takeaways, not both.

## Answers: every example and check carries `verify`

Each example and check carries `"verify": { "kind": …, "truth": …, …options }`. The gate checks the published answer, and every multiple-choice distractor must fail.

- **Kinds:** `exact`, `rounded`, `numeric`, `list`, `assignments`, `point`, `vector`, `equation`, `inequality`/`set`, `ratio`, `standard-form`, `money`, `time`, `bearing`, `angle`, `fraction`, `expression` (with `form` for factorised/expanded/simplified), `antiderivative` and `choice`. The options for each are in `scripts/notes/verify_kinds.py` (the `KINDS` table and each checker's docstring).
- **`truth` is the computation from the question's own numbers**, not your answer typed back in. Write `"Rational(3,8)*Rational(2,7)"`, not `"Rational(3,28)"`; `"sqrt(7**2 + 24**2)"`, not `"25"`; `"solve(Eq(3*x + 5, 20), x)"` for a list.
- **Precision:** a rounded or numeric answer declares its precision (`sf` or `dp`), which must be what the question asks for, or 3 s.f.

## Originality, glossary, length

- **Originality:** invent every example and check from scratch. Use different contexts, numbers and functions from every pack question. A lint fails any block that shares 3+ numbers with a pack question.
- **Glossary links:** the first prose use of every planned term you own or use must be a `[[id|label]]` link (a lint checks this). Link to terms other sections own; never define them.
- **Prerequisites:** start from the pack's `prerequisites`.
- **Reading time and examples:** `readingMinutes` must equal the value `validate-lesson.mjs` prints. Every teaching section has **two worked examples** (one may be in an Extended part) plus its checks; never cut to one example to save time. Bands: up to 3 bullets 10–18 minutes, 4–8 bullets 15–25, 9+ bullets 20–30. Cut repetition and wordy prose before examples, and record any overrun in writer notes.
- **Interactives:** use one only where an existing widget in `src/components/course-notes/interactives/registry.ts` fits the section exactly. Never invent one.
- **Mistakes and exam tips:**
  - Ground the mistakes in the pack's real `mistakes`, rewritten.
  - Exam tips use Cambridge command words as the syllabus uses them (work out, show that, give your answer to …, write down, sketch, construct, explain), and say what earns the marks.

## Writer: done when

`node scripts/notes/validate-lesson.mjs --course igcse-maths-0580 <section>` prints PASS for every check. Then reply with only:

```
SECTION: <code> <title>
STATUS: done | blocked
COVERAGE: <bullet id> -> <section ids>, one line per bullet
JUDGEMENT CALLS: <scope choices, anything uncertain, or none>
```

## Verifier

Read the lesson blind, against the pack and this brief. Work out every answer yourself.

1. **Accuracy.** Every statement, step, answer, option and explanation is correct. Each `verify.truth` is computed from the question's data and matches the question text exactly.
2. **General statements:** for every result, definition, method line and cheat-sheet fact, try to find a counterexample, edge case or unstated condition (zero, negatives, repeated factors, a disconnected domain, a degenerate shape). A rule that only holds under conditions must state them. The AA notes' review found exactly these, after the per-lesson checks had passed.
3. **Coverage and levels:**
   - every bullet is taught and covered by a goal at its level;
   - Extended material is marked;
   - the Core path stands alone;
   - nothing beyond the syllabus is presented as required.
4. **Exam fit:**
   - non-calculator methods for P1/P2 material;
   - calculator steps from snippets;
   - accuracy conventions;
   - formulas tagged correctly.
5. **Teaching:**
   - a stuck 15-year-old could follow it;
   - checks are worth doing and their hints help;
   - figures match the text and alt text.
6. **Originality:** no pack set-up or numbers reused.

Run `validate-lesson.mjs` and probe one multiple-choice id or example with a wrong answer: `check-math.py --course igcse-maths-0580 --verify <section> <id> '<wrong tex>'` must FAIL.

**You fix minors yourself.** Edit only this section's lesson, glossary and figure files, re-run `validate-lesson.mjs` until it passes, and list each fix. **Don't fix criticals:** report them with the correct maths, and a fixer will act on them.

- **critical:** wrong maths or answer; a general statement that is false as written; a bullet not taught; Extended content unmarked in a Core lesson; a `truth` that isn't computed from the question; copied pack set-ups; a wrong calculator step; or anything that would leave a student unable to follow the lesson.
- **minor:** everything else worth fixing.

Reply with only:

```
SECTION: <code>
VERDICT: pass | minor-fixed | critical
CRITICAL: <numbered: json path — what is wrong, with the correct maths — the fix>, or none
FIXED: <numbered minors you fixed>, or none
CHECKS: validate-lesson <PASS/FAIL>; wrong-answer probe <FAILED as expected / passed wrongly>
```
