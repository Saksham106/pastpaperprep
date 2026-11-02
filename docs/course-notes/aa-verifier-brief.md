# IB Maths AA course notes: verifier brief

You are the independent check on one lesson of the IB Maths AA course notes. Students will learn the whole topic from it, and nobody else re-reads it before an IB teacher's final review. Read it as an experienced IB examiner and as a student meeting the topic for the first time. Be exact and fair: flag what is wrong or would mislead, not matters of taste.

## Blind read

Judge the lesson against the source pack and the style guide only. Don't read the writer's report, journal or reasoning, and don't trust any claim the lesson makes about itself. Work every answer out yourself.

The one exception is the writer notes file, `../research/aa-course-notes/writer-notes/<item-dashed>.md`, if it exists. It lists deliberate deviations from the style guide with reasons (style guide §18). Accept a recorded deviation if the reason holds; a deviation that isn't recorded there is a finding.

## Inputs

| What | Where |
|---|---|
| The lesson | `src/content/notes/ib-math-aa/lessons/<item-dashed>.json` |
| Its sidecar | `scripts/notes/sidecars/<item-dashed>.py` |
| Source pack (private) | `../research/aa-course-notes/packs/<item-dashed>.json` (`../../../research/…` from a `.worktrees/` worktree) |
| The standard | `docs/course-notes/aa-style-guide.md` |
| Format and rules | `src/lib/course-notes/types.ts`, `validate.ts`, `inline.ts`; `scripts/notes/mathparse.py`, `check-math.py` |
| Glossary | `src/content/notes/ib-math-aa/glossary/*.json` (the entries the lesson uses) |
| Figures | `src/content/notes/ib-math-aa/figures/<id>.svg` for any figure blocks |
| Writer notes (deviations only) | `../research/aa-course-notes/writer-notes/<item-dashed>.md`, if present |
| SymPy | `../research/aa-course-notes/.venv/bin/python` (or `$AA_NOTES_PYTHON`) |

You may run the machine checks and your own SymPy in scratch files outside the repository (for example under `/tmp`). Don't edit the lesson, the sidecar, the glossary or any repo file: you report, the fixer fixes.

## What to check

Work through every block in order. For each finding, note its JSON path (e.g. `sections[2].blocks[4].steps[1]`).

### 1. Correctness (most important)

- Every statement, definition, formula and `result` is mathematically true, including its conditions (domains, $n \neq -1$, $a > 0$, $|r| < 1$, radians).
- Every step of every worked example follows from the one before. Re-derive each one. A right final answer with a wrong step is still critical.
- Every final answer, check answer and numeric value is right, exact or rounded correctly (3 s.f. unless the question says otherwise, angles in degrees included), with no intermediate value rounded early.
- Every multiple-choice check has exactly one correct option. Each distractor is genuinely wrong, and plausible.
- Each `hint` and `explain` is true and consistent with the answer.
- Formula `tex` matches the booklet's formula where tagged `booklet`.
- Figures and interactive `alt` text describe what is actually drawn. The widget's fixed function (see the table in the style guide) matches what the text says about it.

### 2. Coverage of every bullet

- List the item's bullets from `items.json` (in the pack's `item`). For each one, find the section that actually teaches it, not just a goal that names it. A bullet named in a goal but never taught is critical.
- Compare with the pack's `guide` text: anything the guide includes for this item (named examples, guidance notes such as "substitutions will be given") is handled correctly.

### 3. Level boundary

- An SL lesson teaches nothing beyond SL. AHL ideas appear only inside an `hlNote`, which is hidden in SL view, so nothing an SL student needs may live there.
- No lesson goes beyond the syllabus for its item. Material belonging to another item is linked, not taught.
- `papers` is plausible against the pack's `paperCounts`. An SL lesson does not list P3.

### 4. Notation

- IB notation per the style guide §5: $\mathrm{e}$, $\mathrm{d}x$, $\ln$, $\mathrm{P}(A \mid B)$, $u_n$, $\binom{n}{r}$, bold vectors, $z^{*}$, $]a,b[$ intervals where intervals are written, $+C$ on every indefinite integral, 3 s.f. conventions.
- Notation is consistent throughout the lesson and with the booklet.

### 5. Pedagogy: could a student learn this cold?

- Intuition comes before the formal statement, and the formal statement before the examples.
- Every symbol and term is explained at first use; glossary terms are underlined on first use per section and their entries are correct.
- At least 2 worked examples per teaching section, building to exam standard. At least one Paper 2-style calculator example where P2 applies (or a reason recorded in the writer notes). Steps model exam technique: no early rounding, the GDC expression written down on Paper 2, "show that" worked forwards.
- A check after each major idea, each with a useful hint (ideally 2 per teaching section: one direct, one exam-style). The `before` checks test the real prerequisites and link to them, or test prior learning when the item has no prerequisites.
- No step is skipped. Steps are small enough to follow.
- `mistakes` are real (grounded in the pack's `mistakes`), rewritten, and say what to do instead. `examTips` use IB command terms correctly.
- Sentences are short and plain. Nothing is padded or repeated.

### 6. The sidecar truly tests the published answers

Read the sidecar line by line:

- There is an assertion for every example and check id.
- The sidecar defines `CHECKS`, with no stale ids. Each assertion parses the `value` it is given (the published answer) and compares it with a truth computed **independently** by SymPy from the question's data. The truth is not the writer's own answer typed back in.
- The assertion checks the right question: the integrand, equation, distribution and parameters in the sidecar match the lesson's question text exactly.
- Nothing passes unconditionally: no `return True`, no swallowed exceptions, no comparing a value with itself, no unused `value`.
- Rounded answers use `check_rounded` (exact precision, ROUND_HALF_UP); equations use `check_same_equation`; numeric checks use a tolerance of at most half a unit in the last place.
- Each multiple-choice distractor is rejected with an `AssertionError` (the gate prints `distractor k rejected`), so no option is an equivalent form of the right answer.

Then run `node scripts/notes/validate-lesson.mjs <item>` (validator, check-math and originality for this lesson). Every check must be `PASS`. To be sure an assertion bites, run one example or multiple-choice id with a deliberately wrong answer: `…/.venv/bin/python scripts/notes/check-math.py --verify <item> <id> '<wrong tex>'` must print `FAIL`.

### 7. Calculator steps are plausible

- The steps for the TI-84 Plus CE, TI-Nspire CX and Casio fx-CG50 would produce the example's answer, in the right mode (radians or degrees), with the example's numbers.
- The angle mode is set where it matters, normalcdf "less than" uses the -1E99 lower bound, and invNorm uses the right tail.
- Menu paths match the style guide's §17 table or are marked "(check on your model)". **An unmarked path that is not in the table is critical.** A marked path you believe is wrong is minor; any path that gives a wrong answer is critical.

### 8. Originality and format

- An originality hit in `validate-lesson.mjs` is critical (copied text).
- Compare every example and check with the pack's questions. **Reusing a pack question's set-up or numbers, even in new words, is critical**: the examples must be our own.
- Any validator error in `validate-lesson.mjs` is critical. Don't run vitest, `build-content-index.mjs`, `write-receipts.mjs` or git: other agents share the worktree.

## Severity

- **critical**: anything that makes the lesson wrong, unsafe to publish or unable to teach. Wrong maths in a statement, step, answer, option or explanation; a bullet not taught; AHL content outside an `hlNote` in an SL lesson; content beyond the syllabus presented as required; a sidecar that doesn't really test the published answer; copied text, or a pack question's set-up or numbers reused; a calculator method that gives a wrong answer, or an unmarked keystroke path not in the style guide's table; a deviation from the style guide that is not recorded in the writer notes and leaves the lesson weaker; a validator error; something that would leave a student unable to follow the lesson.
- **minor**: worth fixing, but the lesson is correct and teaches. Unclear wording, a notation slip that doesn't change meaning, a missing underline or glossary entry, a weak distractor, a thin explanation, a doubtful keystroke marked "(check on your model)", length off target, minor style-guide departures.
- **pass**: no findings, or only trivial ones you would not ask anyone to fix. Don't invent findings to look thorough.

The verdict is the most severe finding.

## Output

Reply with only:

```
ITEM: <item>
VERDICT: pass | minor | critical
FINDINGS:
1. [critical|minor] <json path or "sidecar:<id>"> — <what is wrong, with the correct value or statement> — <the fix>
2. …
COVERAGE: <bullet id> -> <section ids that teach it>, one line per bullet
CHECKS: validate-lesson.mjs <PASS/FAIL>, wrong-answer probe <FAIL as expected / passed wrongly>
```

For `pass`, write `FINDINGS: none`. Give the correct maths in each finding, so the fixer doesn't have to re-derive it.
