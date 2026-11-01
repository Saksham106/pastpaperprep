# IB Maths AA course notes: writer brief

You are writing one lesson of the IB Maths AA course notes: one official syllabus item, for example 5.16. Paying students will learn the topic from your lesson alone, and an IB teacher will review it. Write it the way an excellent IB maths teacher-author would: accurate, clear, and kind to a student who is stuck.

Read `docs/course-notes/aa-style-guide.md` in full before you start. It is the standard you are judged against. This brief is the job.

## Inputs

| What | Where |
|---|---|
| Your item, e.g. `5.16` (dashed: `5-16`) | the task message |
| Source pack (private) | `../research/aa-course-notes/packs/<item-dashed>.json`, resolved from the main checkout. From a worktree under `.worktrees/` it is `../../../research/…`. |
| Format | `src/lib/course-notes/types.ts`, `src/lib/course-notes/inline.ts` |
| Rules the validator enforces | `src/lib/course-notes/validate.ts` |
| Bullets and booklet ids | `src/data/aa-official-subtopics/items.json` |
| Glossary | `src/content/notes/ib-math-aa/glossary.json` |
| Format example (format only; its content will be rewritten) | `src/content/notes/ib-math-aa/lessons/5-16.json` and `scripts/notes/sidecars/5-16.py` |
| Approved look | `docs/superpowers/mockups/aa-notes/lesson-a.html` |
| SymPy | the venv at `../research/aa-course-notes/.venv/bin/python` (or `$AA_NOTES_PYTHON`) |

## Outputs

1. `src/content/notes/ib-math-aa/lessons/<item-dashed>.json`: the lesson.
2. `scripts/notes/sidecars/<item-dashed>.py`: the SymPy assertions for every example and check.
3. New glossary entries in `glossary.json`, if any.
4. Figure SVGs in `src/content/notes/ib-math-aa/figures/`, if any.
5. The regenerated `src/content/notes/ib-math-aa/index.ts`.
6. A short report (step 4).

Touch nothing else. Never edit `validate.ts`, `types.ts`, `check-math.py`, `mathparse.py`, `items.json`, another item's lesson or sidecar, `math-receipts.json`, `src/lib/bank-index-manifest.ts` or `public/bank-index/`. Never copy the pack, or any text from it, into the repo. Don't commit: the batch commits.

## Step 1. Read the pack

The pack is input for judgement. It is never text to reuse.

- `item`: the coverage contract. Every bullet id must be covered by a goal and taught in a section.
- `guide` (*reference only — never copy*): the IB guide's own words for the item. Use it to pin down exactly what is in scope, the notation, and any examples the guide names. Anything not here or in the bullets is out of scope.
- `booklet.entries`: formula-booklet ids you may tag. `taggable` says when.
- `prerequisites`: candidates. Use the ones marked `"use": "prerequisite"` unless you have a reason not to. `related` items are links, not prerequisites. `hlNote-only` items may appear in an SL lesson only through an `hlNote`.
- `questions` (*do not copy*): what is actually examined, on which paper, at what difficulty, and how the marks fall (`markedSteps` carries the mark codes). Questions are tagged by group, so some examine a sibling item: ignore those. `paperCounts` drives the `papers` field.
- `mistakes`: real slips by real students on those questions. Your common mistakes come from here, rewritten.

Before writing, sketch for yourself: the 3–6 goals and the bullets each covers; the sections; for each section, the intuition, the formal statement, the 2+ examples and the check; which examples go on which paper.

## Step 2. Write the lesson and the sidecar

### The lesson

Follow the style guide. Hard requirements the validator enforces (each failure names your item and the path):

- `schemaVersion: 1`, `edition: "aa-2021"`, `item`, `level` and `topic` exactly as in `items.json`.
- Every bullet id of the item appears in some goal's `bullets`. Goals name only this item's bullets. An SL lesson names no AHL bullet.
- Every `prerequisites` entry is a real item. An SL lesson lists no AHL item.
- Section ids are unique. Example and check ids are unique across the whole lesson, including `before`.
- A `check` has `options` (2+ entries, exactly one `correct`) or a numeric `answer` with `tolerance >= 0`, never both.
- Check option text holds only plain text and `$maths$`: no `[[term]]`, no `{{lesson:…}}`.
- A `booklet` formula has a `bookletId` owned by this item or by one of its `prerequisites`. A `learn` formula has no `bookletId`.
- `interactive.widget` is one of the 20 ids. `interactive.alt` and `figure.alt` are plain words with no `$`.
- Every `[[term-id|label]]` is in `glossary.json`. Every `{{lesson:x.y}}` is a real item. An SL lesson links to an AHL lesson only inside an `hlNote`.
- An `hlNote.lesson` is a real item code.
- Every `$…$` and every formula `tex` renders in KaTeX. In JSON, every backslash is doubled: `"$\\frac{1}{2}$"`.
- `example` blocks carry `"video": null`.

The validator does **not** check these fields, but the page renders them, so keep them safe: `definition.term` (plain words), `figure.caption`, and `calculator` steps (keep maths out; write what is typed, e.g. `X*sqrt(X+1)`).

### Glossary entries

Other writers edit `glossary.json` at the same time. So:

- Re-read the file right before you edit it, and reuse an existing id where one fits.
- Add your entries with a small targeted insertion (one Edit per entry, before the closing `]`). Never rewrite the whole file, reorder it, or change or delete anyone else's entry.
- `lesson` is the item that teaches the term. If that lesson is in another topic and not written yet, still point at it.
- Keep the file valid JSON.

### The sidecar

`scripts/notes/check-math.py <item>` reads your lesson and calls `verify(id, value)` in your sidecar once per example and check, with **the lesson's own published answer**:

- for an `example`: the TeX string in `answer`;
- for a multiple-choice check: the TeX string of the option marked `correct`;
- for a numeric check: `float(answer.value)`.

`verify` must raise if the published answer is wrong, and raise `KeyError` for an id it doesn't know. Every example and check id needs an assertion, or the check fails.

The rules:

1. **Check the published text.** Parse `value` and compare it with the truth. Never ignore `value`, and never return without comparing.
2. **Compute the truth independently with SymPy** from the question's own data: integrate, differentiate, solve, sum the series, evaluate the probability. Don't type in your own final answer as the truth. Where an exact truth is genuinely hard to compute symbolically, assert a property that only the right answer has (differentiate an antiderivative back to the integrand, substitute roots back into the equation, check a probability with an independent formula), and comment why.
3. **No hard-coded passes.** No `return True`, no `pass`, no `try/except` that swallows a mismatch, no comparison of a value with itself.
4. **Rounded answers** must equal the truth rounded to the stated significant figures.
5. **Word answers** (a check option like "increasing" or "two distinct real roots") map to a truth you compute: e.g. compute the discriminant's sign and check it names the right case.
6. Import only SymPy, the standard library and `mathparse`.

Parse with `scripts/notes/mathparse.py`. Each helper raises a clear `ValueError` on anything it can't read, and that counts as a failure:

| Helper | Reads | Returns |
|---|---|---|
| `parse_answer(tex)` | one exact answer: right of the last `=`, trailing `+ C` dropped; handles `\mathrm{e}`, `\mathrm{i}`, `\ln`, `\sqrt`, `\tfrac`, `\binom` | a SymPy expression. Refuses several answers, `\pm`, `\approx`, vectors, and unevaluated integrals/derivatives/limits/sums |
| `parse_list(tex)` | `x = -1 \text{ or } x = 4`, `x = \pm 2`, `x = 1, \; x = 3` | list of expressions in written order |
| `parse_approx(tex)` | `\mathrm{P}(X \le 3) \approx 0.342` (trailing `\text{…}` ignored) | `(Float value, significant figures)` |
| `parse_vector(tex)` | `… = \begin{pmatrix}1\\-2\\3\end{pmatrix}` | list of entries |
| `parse_point(tex)` | `(2, -\tfrac{1}{3})` | list of coordinates |

Template:

```python
"""SymPy assertions for lesson <item> (<title>). Not shipped to the browser.

verify(id, value) receives the lesson's own published answer: an example's `answer` TeX, the TeX of a
multiple-choice check's correct option, or a float for a numeric check. It raises if that answer is wrong.
"""
import sys
from pathlib import Path

from sympy import Rational, diff, integrate, simplify, solve, symbols  # whatever you need

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from mathparse import parse_answer, parse_approx, parse_list  # noqa: E402

x = symbols("x")


def same(published, truth):
    if simplify(published - truth) != 0:
        raise AssertionError(f"published {published} is not {truth}")


def rounded(tex, truth):
    """A rounded answer must be the truth correctly rounded to the figures it shows."""
    value, sf = parse_approx(tex)
    expected = float(f"{float(truth):.{sf}g}")
    if abs(float(value) - expected) > 1e-12 * max(1, abs(expected)):
        raise AssertionError(f"published {value} is not {truth} to {sf} s.f. ({expected})")


def near(value, truth, tol):
    """A numeric check's value must be within the tolerance a correct answer needs."""
    if abs(float(value) - float(truth)) > tol:
        raise AssertionError(f"published {value} is not within {tol} of {float(truth)}")


def roots_are(tex, equation):
    published = sorted(parse_list(tex), key=lambda r: float(r))
    truth = sorted(solve(equation, x), key=lambda r: float(r))
    if len(published) != len(truth):
        raise AssertionError(f"published {published}, truth {truth}")
    for p, t in zip(published, truth):
        same(p, t)


_CHECKS = {
    # id -> assertion on the published answer. One entry per example and check id in the lesson.
    "ex-quadratic-roots": lambda tex: roots_are(tex, 2 * x**2 - 3 * x - 2),
    "ex-area-p2": lambda tex: rounded(tex, integrate(x * (4 - x), (x, 0, 4))),
    "check-gradient": lambda v: near(v, diff(x**3, x).subs(x, 2), 0),
}


def verify(id, value):
    if id not in _CHECKS:
        raise KeyError(f"no assertion for {id}")
    _CHECKS[id](value)
```

Numeric checks receive a float, not TeX; assert them with `near` (or `same(Rational(...))` for exact values). Remember `check-math.py` proves only the final answers. Steps, distractors and calculator keystrokes are checked by you now and by the verifier later, so check them carefully.

## Step 3. Run the checks and fix until all pass

Run from the repository root (your worktree):

```bash
node scripts/notes/build-content-index.mjs
npx vitest run src/lib/course-notes
../research/aa-course-notes/.venv/bin/python scripts/notes/check-math.py <item>   # or $AA_NOTES_PYTHON
node scripts/notes/originality.mjs src/content/notes/ib-math-aa/lessons/<item-dashed>.json ../research/aa-course-notes/packs/<item-dashed>.json
```

(Use `../../../research/…` for the venv and the pack when you are in a `.worktrees/` worktree.)

- **Index.** Rerun `build-content-index.mjs` after adding or renaming a lesson or figure.
- **Validator.** In `content.test.ts`, "every lesson file passes validateLesson" prints every failing lesson keyed by item. Fix every error under your item. Other writers' items may show errors while they work; leave them alone. The test "lesson without a passing receipt…" fails for your item until the batch writes receipts: that one is expected. Every other test must pass.
- **SymPy.** Every line must be `PASS`. A `FAIL` means the published answer is wrong, the TeX can't be parsed, or an id has no assertion. Fix the lesson if the answer is wrong. Fix the sidecar if it is checking the wrong thing. Never weaken an assertion to get a pass. Don't run `write-receipts.mjs`: the batch does that.
- **Originality.** Exit 0 means no 8-word run is shared with the pack. Each `HIT` names the path and the shared words: rewrite that sentence in your own words. Don't fix it by inserting maths or swapping single words to break the run.

Repeat until all four pass. Then read the lesson once more, top to bottom, as the student: is every step explained, every symbol defined, every bullet taught?

## Step 4. Report

Reply with only:

```
ITEM: <item> <title>
STATUS: done | blocked
FILES: <paths written or changed>
GLOSSARY: <new term ids, or none>
CHECKS: validator <pass/fail>, check-math <n PASS / n FAIL>, originality <pass/fail>
COVERAGE: <bullet id> -> <section ids>, one line per bullet
PREREQUISITES: <list>; changes from the pack's suggestion and why
JUDGEMENT CALLS: <scope decisions, missing calculator example, thin mistake data, keystrokes marked "check on your model">
CONCERNS: <anything a reviewer should look at, or none>
```
