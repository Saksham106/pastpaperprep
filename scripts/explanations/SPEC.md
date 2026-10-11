# Question explanations: writing spec

Each explanation teaches a student how the official answer is reached. It sits behind an "Explanation" button next to "Mark scheme" on the question card. The mark scheme gives the answer; the explanation shows the route.

Generated explanations are premium content. They are written to the research workspace (`../research/explanations/<bank>/`), never to Git.

## Inputs for one question

A task manifest entry (`scripts/explanations/prepare-batch.mjs`) gives:

- `questionImages`: PNG paths of the question as printed. **This is the source of truth for the question.**
- `markschemeImages`: PNG paths of the official mark scheme. **This is the source of truth for answers, method and marks.**
- `questionText` / `markschemeText`: machine-extracted text. Often scrambled (fractions, powers and symbols break). Use only as a reading aid; trust the images.
- `marks`, `paper`, `calculator`, `outputPath`.

Mark scheme images can contain neighbouring questions. Use only the rows for this question number.

## Output: one JSON file per question

```json
{
  "schemaVersion": 1,
  "bank": "ib-hl",
  "questionId": "2025-may-tz2-p1-q3",
  "totalMarks": 6,
  "parts": [
    {
      "label": "a",
      "marks": 2,
      "approach": "The curve meets the x-axis where y = 0, so set the numerator to zero.",
      "steps": [
        { "text": "Set $y = 0$, so $x^2 - 16x = 0$.", "marks": ["M1"] },
        { "text": "Factorise:", "math": "x(x - 16) = 0", "marks": [] },
        { "text": "So the curve crosses at $(0, 0)$ and $(16, 0)$.", "marks": ["A1"] }
      ],
      "answer": "$(0, 0)$ and $(16, 0)$",
      "mistake": "Giving only $x = 16$ and forgetting the origin."
    }
  ]
}
```

### Fields

| Field | Rule |
|---|---|
| `parts[]` | One entry per lowest-level part that has a **printed** mark total, in printed order. If marks are printed only on a parent (for example `(a) [9]` covering (i) and (ii)), make one part for the parent and start each sub-part's first step with "(i)", "(ii)". Never invent a mark split the paper does not print. Label like the paper without brackets: `""` for a single-part question, `a`, `b`, `a(i)`, `a(ii)`, `b(iii)`. |
| `marks` | The part's printed mark total. Parts must add up to `totalMarks`. |
| `approach` | One sentence: the idea that unlocks this part. Say *why*, not just *what*. |
| `steps[]` | 1–6 steps (up to 10 for a parent part covering several sub-parts). Each step is one move a student would write down. |
| `steps[].text` | Plain sentence, inline maths in `$...$`. |
| `steps[].math` | Optional display maths (LaTeX, no `$`). Use for the line a student would actually write. |
| `steps[].marks` | Mark codes earned at this step, exactly as the scheme writes them (`M1`, `A1`, `R1`, `(M1)`, `(A1)`, `B1`, `N2`, `AG`, `SC1`...). Empty array if none. Every mark the scheme awards on its main method must be attached to exactly one step. |
| `answer` | The final answer as the scheme accepts it (exact form, or 3 s.f. where the scheme does). For "show that" parts, the given result. For sketches, a list of the features that score. |
| `mistake` | Optional. One common slip for this part, only when there is a real, specific one. No generic advice. |

## How to write

1. **Follow the scheme.** Use the scheme's main method and reach exactly its final answers. Never contradict it. If the scheme lists alternative methods, use the clearest one; you may name the other in `approach` in a few words.
2. **Show substitutions and conclusions.** Write the substituted expression before the value ("$|2-2| + 1 = 1$", not "$1$"). A step that carries an `A1` must state its result in the step itself, not only in `answer`.
3. **Explain the reasoning, briefly.** A strong student reading only your steps should know what to write in the exam and why. Short sentences. No filler ("Let's", "Great", "Now we will"). Give the real reason a rule applies ("the daily counts are independent Poisson variables, so their sum is Poisson"), not a loose slogan.
4. **Calculator papers.** When the scheme expects a GDC result, say so: "Use your GDC to find the intersection: $x = 1.94$." Do not invent working the scheme does not expect.
5. **"Show that" (AG) parts.** Every step must be genuine working that reaches the given result. Do not assume what is being shown.
6. **Sketches and graphs.** You cannot draw. Describe what to draw: shape, intercepts, turning points, asymptotes, domain, labels the scheme rewards.
7. **Proofs and induction.** Keep the scheme's structure (basis, assumption, inductive step, conclusion) and attach `R1` marks to the reasoning sentences.
8. **Follow-through.** Ignore `FT` rules. Explain the correct path only.
9. **Do not copy the scheme's wording or notes to examiners.** Explain in your own words. Never write "the mark scheme says" or mention examiners in the text; the mark codes carry that.
10. **Multiple choice (1 mark, options A–D).** One part with label `""`. Step 1–3: the reasoning that picks the right option, with the key calculation or fact. Final step: why the tempting wrong options fail, one short clause each. Mark code on the deciding step is `"A1"` unless the scheme shows another. `answer` is the letter plus the value or statement, e.g. `"B: $4.0\\text{ m s}^{-1}$"`.
11. **Science written answers.** Each marking point the scheme lists is a step or part of one. When the scheme awards ticks (✓) instead of codes, use `"✓"` as the mark code, one per tick. Give units and the significant figures the scheme expects. For "explain/describe" parts, write the sentence a student should write, not a summary of it.
12. **Stay inside the question.** No content beyond what the question and scheme support. If something in the images is unreadable or missing, do not guess: set `"status": "needs_review"` and `"reviewNote"` at the top level and still write every part you can.

## Maths formatting (KaTeX)

- Inline `$...$` in `text`, `answer`, `approach`, `mistake`. Display maths in `math` without `$`.
- KaTeX-supported commands only: `\frac`, `\sqrt`, `\int`, `\sum`, `\lim`, `\ln`, `\sin`, `\vec`, `\begin{pmatrix}`, `\left( \right)`, `\mathrm{d}`, `\le`, `\ge`, `\ne`, `\pm`, `\infty`, `\pi`, `\theta`, `\mathbb{R}`, `\text{}`.
- In JSON every backslash is doubled: `"$\\frac{1}{2}$"`.
- Units in `\text{}`: `$12\\text{ cm}^2$`. Degrees: `$30^\\circ$`.
- Use the minus sign in maths mode (`-`), never a hyphen outside it for negatives in text.

## Self-check before writing the file

- Part labels and marks match the printed question; marks add to `totalMarks`.
- Every final answer matches the scheme.
- Every main-method mark code in the scheme is attached once.
- JSON parses; `node scripts/explanations/validate.mjs <file>` passes.
