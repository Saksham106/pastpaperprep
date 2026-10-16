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
| `steps[].marks` | Mark codes earned at this step, exactly as the scheme writes them. Keep combined codes whole: if the scheme says `M2` for a full method (with `M1` as partial credit) or `B2`/`B4` for a complete answer or curve, put that one code on the step where the method or answer is complete; do not split it into invented singles. Keep `dep` suffixes (`M1dep`) (`M1`, `A1`, `R1`, `(M1)`, `(A1)`, `B1`, `N2`, `AG`, `SC1`...). Empty array if none. Every mark the scheme awards on its main method must be attached to exactly one step. |
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
10. **Multiple choice (1 mark, options A–D).** One part with label `""`. Step 1–3: the reasoning that picks the right option, with the key calculation or fact. Final step: why the tempting wrong options fail, one short clause each, describing each option exactly as printed. If you cannot say precisely why an option is wrong, leave it out. Mark code on the deciding step is `"A1"` unless the scheme shows another. `answer` is the letter plus the value or statement, e.g. `"B: $4.0\\text{ m s}^{-1}$"`.
11. **Science written answers.** Each marking point the scheme lists is a step or part of one. When the scheme awards ticks (✓) instead of codes, use `"✓"` as the mark code, one per tick. Give units and the significant figures the scheme expects. For "explain/describe" parts, write the sentence a student should write, not a summary of it.
11a. **Cambridge IGCSE mark schemes (0580, 0606, sciences).** The answer column's mark total (e.g. "2") is earned by the correct final answer; lines such as "B1 for one correct line", "M1 for …" or "SC1 …" are *partial credit* for incomplete work, alternatives to the full marks, not marks that add up. So:
   - Put the full marks on the step that reaches the final answer, using one combined code that equals the part's marks, written as the scheme would: `B2`, `B3`, `M2`, or `A1` when the scheme shows an M1 + A1 structure. If the scheme prints only a number with no code, use `B<n>` (a 1-mark answer-only part is `B1`, not `A1`).
   - When the scheme gives a genuine method-then-accuracy split (e.g. "M1 for 863.5 ÷ 12.3π" then the answer "A1"), code the method step `M1` and the answer step `A1`. Use `M2` instead of `M1` + `M1` when the scheme awards M2 for the full method.
   - Never split a combined mark into invented singles (no `B1` + `B1` for a 2-mark answer). Partial-credit lines may be mentioned in step text ("one correct line alone earns B1"), but they carry no code.
   - The codes on a part's steps must account for exactly its printed marks.
   - The step carrying the final mark must state the final answer itself.
11b. **Level-marked answers (economics essays, "discuss/evaluate" parts).** When the scheme marks a part by levels (L1–L4, level descriptors) rather than point marks, do not invent point codes: put the part's full marks as one code on the final step, written like `L4` for the top level (or `B<n>` if the scheme gives no level labels), and leave other steps uncoded. Steps should show what a top-level answer contains, in order: definitions and knowledge, the analysis chain (cause → effect, with a diagram described in words if the scheme expects one), real-world application where asked, and a balanced evaluation that reaches a justified conclusion. One step per element; keep each to two or three sentences. `answer` is a one-sentence summary of the conclusion. For point-marked parts in the same question, use the usual codes.
12. **When the official answer looks wrong** (owner decision, 2026-10-12). Teach the official method and give the official answer as the part's `answer`, because that is what earns the marks. Then add one final step that starts "Why we think the official answer may be wrong:" and explains the issue concretely (the correct working and value, or the reason a key letter cannot be right), with no `marks`. In `answer`, append "(official answer; we believe the correct value is …, see the last step)". Do not set `needs_review` for this alone. Only use this after checking the images: a misread crop or misaligned key row is a data problem, not a wrong answer.
13. **Stay inside the question.** No content beyond what the question and scheme support. If something in the images is unreadable or missing, do not guess: set `"status": "needs_review"` and `"reviewNote"` at the top level and still write every part you can.
13a. **Material the exam board removed is not a problem to flag.** When the printed paper itself says a figure, table or spectrum was "Removed for copyright reasons" (or similar), every copy of the paper is like that. Do **not** set `needs_review`. Start the affected part with one unmarked step saying the item is not printed in the published paper, then explain the official answer from what the question, the options and the scheme do give. Never invent the missing data. `needs_review` is only for our own problems: a crop that cuts off part of the question or scheme, a blank or missing image, or a scheme row for the wrong question.

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
