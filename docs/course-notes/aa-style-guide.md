# IB Maths AA course notes: style guide

How every lesson in `src/content/notes/ib-math-aa/lessons/` reads, looks and is built. Writers follow it; verifiers judge against it. The step-by-step jobs are in `aa-writer-brief.md` and `aa-verifier-brief.md`.

The format is fixed by code. `src/lib/course-notes/types.ts` defines the shapes and `src/lib/course-notes/validate.ts` enforces them. When this guide and the code disagree, the code wins: report the gap.

## 1. Who we write for

A 16–17-year-old meeting the topic for the first time, alone, the night before a test. Assume they know the prerequisite lessons and nothing else. They should be able to learn the item from the lesson alone, with no teacher or textbook.

What the owner wants, in priority order:

1. **Accurate.** Every statement, step and answer is right, and SymPy checks every final answer.
2. **Teaches from scratch.** No step is skipped because "it's obvious". Every symbol is explained the first time it appears.
3. **Simple and well formatted.** Short sentences, one idea per paragraph, maths in maths blocks.
4. **Intuition first.** Why the idea works, then the formal statement, then worked examples.
5. **Helps a stuck student.** Hints, "before you start" checks, links back to prerequisites, real mistakes.
6. **Follows the official syllabus.** Covers every bullet of the item, at the right level, in IB notation, and nothing beyond it without an `hlNote`.

## 2. Voice

- Talk to the student as "you". Be warm and direct. Never be chatty or cute.
- Keep sentences short, usually under 20 words. Split any sentence with two "and"s or a semicolon.
- Keep each `text` block to one idea of 1–4 sentences. Two short paragraphs beat one long one.
- Use plain words: "use" not "utilise", "so" not "therefore" (except inside a proof).
- Explain each new word or symbol the first time you use it. If it is a glossary term, underline it (§9).
- Don't write "clearly", "obviously", "simply" or "it is easy to see". If it were obvious, they wouldn't be reading.
- Use British spelling (factorise, centre, modelling), as the IB guide does.
- Never call the notes "official". We follow the IB Maths AA guide; we are not the IB.

## 3. How a lesson is shaped

The top-level fields, in the order a student meets them:

| Field | What goes in it |
|---|---|
| `title`, `slug` | `title` is the item's name from `items.json`, lightly edited if it reads badly. `slug` is the kebab-case title, unique within the topic. |
| `summary` | "In a minute": 2–3 sentences that answer "what is this and why do I care?" Answer first, no throat-clearing. |
| `goals` | 3–6 "You'll be able to" lines, in our own words. Each names the bullet ids it covers. Every bullet id of the item appears in at least one goal. |
| `prerequisites` | Item codes this lesson builds on (§10). |
| `papers` | The papers the item is examined on (§11). |
| `synonyms` | 3–6 search phrases a student might type ("u substitution", "integrate a product"). |
| `before` | 2–3 quick checks on the prerequisites. Each `explain` ends with a link to the lesson to revise, e.g. `Revise it in {{lesson:5.10}}.` |
| `sections` | The teaching, one section per big idea, then a final "Key takeaways" section (§4). |
| `mistakes` | 3–6 common mistakes (§13). |
| `examTips` | 2–4 exam tips built on IB command terms (§14). |
| `readingMinutes` | Honest reading time (§15). |

### Inside each teaching section

Teach in this order:

1. **Intuition.** A picture, a concrete number case, or a question that makes the idea feel needed. ("You can't add $x\mathrm{e}^x$'s two factors' integrals. So how do you integrate a product?")
2. **Formal statement.** A `definition`, `formula` or `result` block, in IB notation.
3. **Worked examples.** At least 2 (§6). Start with the simplest case, then build to exam standard.
4. **A `check`.** After each major idea, so the student finds out at once whether they've got it (§7).
5. **Callouts where they help.** An `examTip` or `mistake` block right where the slip happens, an `interactive` where moving something teaches (§8), and a `calculator` block next to a Paper 2 example.

A section's `id` is short kebab-case (`parts`, `limits`, `discriminant`) and unique in the lesson. Its `heading` is a plain phrase: "Integration by parts", not "Part 1: Introducing integration by parts".

### Key takeaways section

The last section has `"id": "takeaways"` and `"heading": "Key takeaways"`. It holds only:

- `formula` blocks with `"cheatSheet": true`, and
- `fact` blocks (`"cheatSheet": true` is required by the type).

The page draws a section made only of these blocks as the takeaways band, and the topic cheat sheets are built from every `cheatSheet: true` block. Write takeaways as the 3–8 lines a student would copy onto a revision card. A formula flagged in the body and again in the takeaways is shown once.

## 4. Blocks

Inline markup works in every prose string: `$…$` for maths, `[[term-id|shown text]]` for a glossary term, `{{lesson:5.15}}` for a lesson link, and `\$` for a literal dollar sign (write it as `\\$` in JSON). Unclosed `$`, empty `$ $` and stray `[[` or `{{` fail validation.

| Block | Use it for | Rules |
|---|---|---|
| `text` | Explanation. | One idea, 1–4 sentences. A numbered method can be several `text` blocks starting "1.", "2.", … |
| `definition` | A new term. `term` (plain words), `statement` (precise, IB wording style), `plain` (one everyday sentence). | Keep `term` plain text: the validator does not check it. |
| `formula` | Display maths. `tag` is `booklet` or `learn` (§12). | `tex` is raw TeX without `$`. |
| `result` | A rule or theorem. `statement` plus a one-line `why`. Where the guide expects a proof (e.g. 1.15, 2.12, 5.12), `why` is a short proof or a link to an example that proves it. | |
| `example` | A worked example (§6). | Needs `id`, `question`, `steps[]`, `answer`, `"video": null`. Optional nested `check`. |
| `check` | Check yourself (§7). | Needs `id`, `prompt`, `explain`; either `options` or `answer`, never both. |
| `figure` | A static diagram (§16). | `id` matches `figures/<id>.svg`; `alt` in plain words, no `$`. |
| `interactive` | One of the 20 widgets (§8). | `widget`, `props`, `alt` in plain words, no `$`. |
| `calculator` | GDC steps for the three models (§17). | `steps.ti84`, `steps.nspire`, `steps.casio`, each a list of short strings. |
| `hlNote` | In an SL lesson: what HL adds, and where (§11). | `text` plus `lesson` (an item code such as `"2.13"`). |
| `examTip` | A tip at the point it matters. | One or two sentences. |
| `mistake` | A slip at the point it happens. | One or two sentences: what goes wrong, then what to do. |
| `fact` | A takeaway line in words and maths. | Only in the takeaways section. `tag` is `learn`, or `booklet` if it restates a booklet formula. |

Ids (`example.id`, `check.id`) are kebab-case, unique across the whole lesson including `before`, and describe the content: `ex-parts-xe2x`, `check-integrate-ln`, `before-product-rule`. The SymPy sidecar is keyed by these ids.

## 5. Notation

Use the IB guide's notation everywhere. The pack's verbatim guide text shows it for the item.

| Idea | Write | Not |
|---|---|---|
| e, d, i | `\mathrm{e}^{x}`, `\mathrm{d}x`, `\mathrm{i}` | `e^x`, `dx`, `i` |
| Logs | `\ln x`, `\log_{a} x`, `\log_{10} x` | `\log x` for natural log |
| Derivatives | `f'(x)`, `f''(x)`, `\dfrac{\mathrm{d}y}{\mathrm{d}x}`, `\dfrac{\mathrm{d}^{2}y}{\mathrm{d}x^{2}}` | `\dot{y}`, `D_x` |
| Integrals | `\int_{a}^{b} f(x)\,\mathrm{d}x`, `+ C` on every indefinite integral | omitted `+ C` |
| Number sets | `\mathbb{R}`, `\mathbb{Q}`, `\mathbb{Z}`, `\mathbb{Z}^{+}`, `\mathbb{N}` (IB: includes 0) | |
| Intervals | IB uses `]a, b[` for open and `[a, b]` for closed intervals; inequalities such as $a < x < b$ are always fine | `(a, b)` for an interval |
| Functions | `f: x \mapsto 2x+1`, `f^{-1}(x)`, `(f \circ g)(x)` | |
| Sequences | `u_{n}`, `u_{1}`, `d`, `r`, `S_{n}`, `S_{\infty}` | `a_n` |
| Binomial | `\binom{n}{r}` and `{}^{n}C_{r}` | |
| Vectors | bold `\boldsymbol{v}`, `\overrightarrow{AB}`, column vectors `\begin{pmatrix}1\\2\\3\end{pmatrix}`, `\lvert\boldsymbol{v}\rvert` | arrows over single letters |
| Complex | `z^{*}` (conjugate), `\lvert z\rvert`, `\arg z`, `r\,\mathrm{cis}\,\theta`, `r\mathrm{e}^{\mathrm{i}\theta}` | `\bar z` |
| Probability | `\mathrm{P}(A)`, `\mathrm{P}(A \mid B)`, `A'` (complement), `\mathrm{E}(X)`, `\mathrm{Var}(X)`, `X \sim \mathrm{B}(n, p)`, `X \sim \mathrm{N}(\mu, \sigma^{2})` | `P(A^c)` |
| Angles | radians by default in calculus and graphs; say "degrees" when you use them | |
| Rounding | exact answers where the question allows; otherwise 3 significant figures (angles in degrees to 1 decimal place) | |

Write `\dfrac` for display fractions in running text only when the fraction holds a derivative or would be cramped; otherwise `\frac` or `\tfrac`. Everything must render in KaTeX: the validator renders every `$…$` and every formula `tex`.

## 6. Worked examples

- **At least 2 per teaching section.** The first is the plainest case of the idea. The last is exam standard. A section that only sets up notation (rare) may have one; say why in the report.
- **At least one Paper 2 example with a `calculator` block in any lesson whose `papers` include P2,** where a GDC method genuinely helps (solving, intersections, numerical integration, distributions, regression). Phrase its question the way Paper 2 does ("Use your calculator to find …", "Give your answer to 3 s.f."). If no GDC method makes sense for the item (for example 1.6 deductive proof), leave it out and say why in the report.
- **Paper 1 examples** show every algebraic line a no-calculator mark scheme expects.
- **Steps.** Each step is one move, with a few words saying what you're doing before the maths ("Let $u = x$, so $\frac{\mathrm{d}u}{\mathrm{d}x} = 1$."). Usually 3–6 steps. Include the check a strong student would do (differentiate back, substitute back, estimate).
- **Answer.** One maths statement in a single `$…$`, with the final answer on the right of the last `=`, e.g. `$\int_0^3 x\sqrt{x+1}\,\mathrm{d}x = \tfrac{116}{15}$`. The sidecar reads this exact text, so:
  - an exact answer is a value or expression: `$x = \tfrac{3}{2}$`, `$y = 3x - 2$`;
  - several answers are joined with `\text{ or }` or written with `\pm`: `$x = -1 \text{ or } x = 4$`;
  - a rounded answer uses `\approx`: `$\mathrm{P}(X \le 3) \approx 0.342$`;
  - a vector is a column vector, a point is `$(2, -3)$`;
  - an indefinite integral ends `+ C`;
  - never leave the answer as an unevaluated integral, derivative, limit or sum.
  Words that explain the answer belong in the last step, not in `answer`.
- **Originality.** Invent your own numbers and contexts. You may study pack questions to see what is examined and at what difficulty; never reuse their wording, numbers or set-up.
- `video` is always `null`.

## 7. Checks

- One `check` after each major idea, so at least one per teaching section. A nested `check` inside an `example` ("Now you try") also counts.
- **Multiple choice** (`options`): 3–4 options, exactly one `correct: true`. Distractors are the answers real mistakes produce (sign slip, forgotten factor, wrong rule), never silly ones. Option text is plain text and `$maths$` only: no glossary terms and no lesson links (options render inside buttons).
- **Numeric** (`answer: { value, tolerance }`): for answers a student types. Set `tolerance` to accept any correctly rounded answer: for a 3 s.f. value like 0.342 use about 0.001; for an integer answer use 0.
- A check has `options` or `answer`, never both.
- `hint` nudges without giving the answer away ("Write it as $\ln x \cdot 1$.").
- `explain` shows the working in 1–3 sentences, so a student who got it wrong learns why.
- The correct option's text (or the numeric value) is what SymPy checks, so write it like an example `answer`.

## 8. Interactives

Only the 20 widgets below exist (`INTERACTIVE_IDS` in `types.ts`). Use one only where moving something teaches more than a picture would, and at most 2 per lesson. Each draws a fixed function, so make the surrounding text and `alt` match what it shows. `alt` describes what the student sees, in plain words with no `$`. Props are optional; out-of-range values are clamped.

| `widget` | What it shows | `props` (default, range) | Natural home |
|---|---|---|---|
| `transformations` | $af(b(x-c))+d$ applied to a chosen base (square, abs, sin, exp), with sliders for a, b, c, d | none | 2.11, 3.7 |
| `discriminant-roots` | $y = ax^2+bx+c$ with sliders; shows $\Delta$ and the real roots | `a` (1, −3–3), `b` (−3, −6–6), `c` (2, −6–6) | 2.6, 2.7 |
| `exp-log-reflection` | $y = a^x$ and $y = \log_a x$ as reflections in $y = x$; draggable point | `a` (2, 0.2–4) | 1.5, 2.9 |
| `unit-circle-graphs` | point on the unit circle beside the sine and cosine graphs | `theta` (π/6, 0–6.28 radians) | 3.5, 3.7 |
| `radian-arc` | sector with arc length $r\theta$ and area $\tfrac12 r^2\theta$ | `theta` (π/3, 0–2π), `r` (2, 0.5–3) | 3.4 |
| `secant-to-tangent` | chord PQ on $y=x^2$ (or $x^3$) at $x=1$ as $h \to 0$ | `h` (1, 0.01–1.5), `curve` `"cube"` | 5.1 |
| `derivative-sign` | $f(x)=x^3-3x$ with its tangent and the sign of $f'(x)=3x^2-3$ | `x` (0, −2.2–2.2) | 5.2, 5.8 |
| `riemann-sums` | rectangles under $y=x^2$ on $[0,2]$ approaching $\tfrac83$ | `n` (4, 1–50), `mode` `"left"`, `"right"` or midpoint | 5.5, 5.11 |
| `area-between-curves` | area between $y=x$ and $y=x^2$ (or $y=x+2$ and $y=x^2$) up to $x=b$ | `pair` `"x+2-x2"`, `b` | 5.11 |
| `revolution-slice` | slice of the solid from rotating $y=\sqrt{x}$ (or a line) about the x-axis | `shape` `"line"`, `b` (2, 0.5–4), `x0` (1, 0–4) | 5.17 |
| `parts-area` | integration by parts as two areas for $v=u^2$ | `b` (2, 0.5–2.4) | 5.16 |
| `binomial-shaded` | bar chart of $\mathrm{B}(n,p)$ with $=k$, $\le k$ or $\ge k$ shaded | `n` (10, 1–30), `p` (0.5, 0.05–0.95), `k` (5), `mode` `"le"`, `"ge"` or equal | 4.8 |
| `normal-shaded` | normal curve with an area shaded between, below or above bounds | `mu` (100), `sigma` (15, 0.5–30), `mode` `"below"`, `"above"` or between | 4.9 |
| `z-standardise` | an $x$ value against its $z$-score; inverse mode from a probability | `mu` (100), `sigma` (15), `z` (2, −4–4), `p` (0.9), `mode` `"p"` | 4.12 |
| `regression-two-lines` | the $y$ on $x$ and $x$ on $y$ lines for four fixed points plus one draggable point | `x`, `y` (5, 6) | 4.4, 4.10 |
| `argand-multiply` | multiplying two complex numbers: moduli multiply, arguments add | `r1` (1.5), `d1` (60°), `r2` (2), `d2` (30°) | 1.13 |
| `roots-of-unity` | the $n$th roots of 1 (or of $r\,\mathrm{cis}\,\theta$) on the Argand diagram | `n` (4, 2–12), `mode` `"general"`, `r` (2), `theta` (90°) | 1.14 |
| `vector-angle` | two 2D vectors, their scalar product and the angle between them | `a1` (3), `a2` (4), `b1` (4), `b2` (1) | 3.13 |
| `maclaurin-partials` | Maclaurin partial sums of $\mathrm{e}^x$, $\sin x$, $\cos x$ or $\ln(1+x)$ against the function | `fn` `"exp"`, `"sin"`, `"cos"`, `"ln"`; `n` (3, 1–8); `x0` (1) | 5.19 |
| `euler-step` | Euler's method for $\frac{\mathrm{d}y}{\mathrm{d}x}=x+y$, $y(0)=1$, against the exact curve | `h` (0.25; one of 0.05, 0.1, 0.125, 0.2, 0.25, 0.5) | 5.18 |

Read the component in `src/components/course-notes/interactives/` before you describe its behaviour in text.

## 9. Glossary

- Underline a glossary term with `[[term-id|shown text]]` on its **first use in each section**, and in the summary or a goal if it appears there. Don't underline it again in the same section.
- Every `[[id|…]]` needs an entry in `src/content/notes/ib-math-aa/glossary.json`: `{ "id", "term", "definition", "lesson" }`. `lesson` is the item code of the lesson that **teaches** the term, which may not be the lesson you are writing.
- Reuse an existing id when one fits. Add a new term only for a real piece of vocabulary a student might not know (domain, asymptote, discriminant, injective, radian, scalar product). Don't add everyday words.
- `id` is lowercase kebab-case (`[a-z0-9-]+`). `definition` is one sentence, may use `$…$`, and must not use `[[…]]` or `{{…}}`.
- Glossary terms are never allowed in check options.

## 10. Prerequisites and links

- `prerequisites` lists item codes the lesson really builds on. Start from the pack's candidates marked `"use": "prerequisite"`. Add or drop one only with a reason, and give it in the report.
- An SL lesson may not list an AHL prerequisite (the validator rejects it).
- The prerequisite graph must stay acyclic: never list an item that comes later in the same chain.
- `before` checks test those prerequisites, and their `explain` links to them.
- Link to other lessons with `{{lesson:x.y}}` where a student would want to look back. An SL lesson may link to an AHL lesson only inside an `hlNote`.

## 11. Level boundary, papers and `hlNote`

- An **SL lesson** (level `SL` in `items.json`) must work completely for an SL student. It teaches only what its bullets ask. If HL goes further on the same idea, add one `hlNote` at that point: `{ "type": "hlNote", "text": "At HL you also integrate products, using integration by parts.", "lesson": "5.16" }`. The page adds the "Learn it in 5.16 →" link, so don't put a lesson link in the text. hlNotes are hidden in SL view, so nothing an SL student needs may live in one.
- Goals in an SL lesson may name only that item's bullets, and never AHL bullets.
- An **AHL lesson** may assume every SL lesson. Start from what SL taught ("In {{lesson:5.10}} you integrated when the derivative of the inside was already there. Now …").
- **Never go beyond the syllabus.** If an idea isn't in the item's bullets or guide text, leave it out. If it is in another item, link to it (or use an `hlNote` in an SL lesson).
- **`papers`:** use the pack's `paperCounts`. SL lessons list `P1` and/or `P2`. AHL lessons may add `P3`. When the pack has no questions, list `P1` and `P2`. Paper 1 is no calculator, Paper 2 is calculator, Paper 3 is HL only.

## 12. Formulas and the booklet

- A formula that is in the IB formula booklet gets `"tag": "booklet"` and the matching `bookletId` from the pack's `booklet.entries`. You may use an id owned by this item, or by an item that is in this lesson's `prerequisites`. Any other id fails validation.
- Everything else a student must remember gets `"tag": "learn"` and no `bookletId`.
- Prior-learning booklet entries (area of a triangle, and so on) have no usable id. Don't put them in a `formula` block. Mention them in a `text` block ("This is in the prior-learning section of the formula booklet.").
- Write the formula in the booklet's notation and form, so it matches what the student will see in the exam. Write the TeX yourself; don't paste the pack's text.
- Tell the student when a formula is in the booklet ("You don't need to memorise this; it's in the booklet. You do need to know when to use it.").
- Set `cheatSheet: true` on the formulas a student would want on a revision card.

## 13. Common mistakes

- Base `mistakes` and inline `mistake` blocks on the pack's `mistakes.entries`. These are real slips from real exam answers. Pick the 3–6 most common for this item, merge duplicates, and **rewrite** each in your own words.
- Each one says what goes wrong, then what to do instead, in 1–2 sentences: "Losing the minus sign. It is $uv - \int v\,\frac{\mathrm{d}u}{\mathrm{d}x}\,\mathrm{d}x$, so bracket the whole second integral."
- Where the pack has few mistakes, add the classic slips a teacher sees, and say so in the report.

## 14. Exam tips and command terms

- 2–4 `examTips`, plus inline `examTip` blocks where useful. Each one ties a command term or mark-scheme habit to this item.
- Use the IB command terms exactly, and say what each needs for marks:
  - **Write down** / **state**: an answer with no working needed.
  - **Find** / **calculate** / **determine**: working that gets the method marks, then the answer.
  - **Show that**: every step to a given answer. You may not use a calculator to "show" an exact result, and the final line must match the given result.
  - **Hence**: use the result you just found. **Hence or otherwise**: using it is easiest, but any valid method earns the marks.
  - **Sketch**: the right shape with key features (intercepts, turning points, asymptotes) labelled. **Draw**: accurate, to scale.
  - **Prove** / **verify** / **justify** / **explain** / **deduce**, as the item needs.
- Explain how marks work where it helps: M marks for a correct method, A marks for accurate answers (which usually depend on the M mark), R marks for reasoning, and AG for an answer that was given. Mark codes appear in the pack's `markedSteps`.
- Mention the 3 s.f. rule, exact values on Paper 1 and units where they matter.

## 15. Length

Match length to the item's size (bullet count in `items.json`) and difficulty:

| Item size | Teaching sections | Reading time |
|---|---|---|
| 1–2 bullets | 2–3 | 5–9 minutes |
| 3–4 bullets | 3–4 | 9–15 minutes |
| 5+ bullets, or hard items (5.14, 5.15, 3.14–3.18, 4.14) | 4–6 | 14–22 minutes |

`readingMinutes` is the prose word count divided by 150 (maths reads slowly), plus 1 minute per worked example, rounded. A lesson that needs more than about 22 minutes is probably saying things twice.

## 16. Figures

- Use a figure when a picture makes the idea clear and nothing needs to move: a labelled triangle, a tree diagram, a sketched graph with its key features.
- Save it as `src/content/notes/ib-math-aa/figures/<id>.svg` and use the same `id` in the block. Prefix ids with the item: `3-2-sine-rule-triangle`.
- Hand-write clean SVG: a `viewBox`, no fixed `width`/`height`, `currentColor` for lines and text, and the theme variables (`var(--t1-ink)` … `var(--t5-ink)`, `var(--muted)`) for colour, so it works in dark mode. No `<script>`, no `on…=` handlers, no `javascript:` URLs, no `<foreignObject>`: a test rejects them.
- After adding a figure, rerun `node scripts/notes/build-content-index.mjs`, which inlines the SVG.
- `alt` is the full description a blind student needs, in plain words with no `$` ("Right-angled triangle with hypotenuse 10 and angle 30 degrees at A"). `caption` is optional and may use inline markup.

## 17. Calculator steps

IB allows non-CAS graphic display calculators. Give steps for all three models in a `calculator` block, next to the Paper 2 example they solve:

- `ti84`: TI-84 Plus CE
- `nspire`: TI-Nspire CX (non-CAS)
- `casio`: Casio fx-CG50

Write each step as a short instruction with key names in capitals or as on-screen menu names, separated by commas: "2nd, TRACE (CALC), 5: intersect". Use the example's actual numbers. Inline `$…$` renders here but isn't validated, so keep maths out of calculator steps (write `X*sqrt(X+1)`, as typed). End with what to read off the screen.

Reference paths (menus can differ by OS version):

| Task | TI-84 Plus CE | TI-Nspire CX | Casio fx-CG50 |
|---|---|---|---|
| Intersection, zero, max/min of a graph | Y=, enter functions, GRAPH, 2nd TRACE (CALC), 2: zero / 3: minimum / 4: maximum / 5: intersect | Graphs page, Menu, Analyze Graph, Zero / Minimum / Maximum / Intersection | GRAPH, enter functions, DRAW, SHIFT F5 (G-SOLV), ROOT / MAX / MIN / INTSECT |
| Derivative at a point | MATH, 8: nDeriv( ; or on a graph 2nd TRACE, 6: dy/dx | Calculator page, Menu, Calculus, Numerical Derivative at a Point | RUN-MAT, OPTN, CALC, d/dx |
| Definite integral | MATH, 9: fnInt( ; or on a graph 2nd TRACE, 7: ∫f(x)dx | Menu, Calculus, Numerical Integral | RUN-MAT, OPTN, CALC, ∫dx |
| Solve an equation | MATH, Solver (or graph both sides and intersect) | Menu, Algebra, Numerical Solve | EQUA, Solver (F3) |
| Polynomial roots, linear systems | APPS, PlySmlt2 | Menu, Algebra, Polynomial Tools / Solve System of Linear Equations | EQUA, Polynomial (F2) / Simultaneous (F1) |
| Binomial | 2nd VARS (DISTR), binompdf( / binomcdf( | Menu, Statistics, Distributions, Binomial Pdf / Cdf | STAT, DIST, BINOMIAL, Bpd / Bcd |
| Normal and inverse normal | 2nd VARS (DISTR), normalcdf( / invNorm( | Menu, Statistics, Distributions, Normal Cdf / Inverse Normal | STAT, DIST, NORM, Ncd / InvN |
| One-variable statistics | STAT, CALC, 1: 1-Var Stats | Lists & Spreadsheet page, Menu, Statistics, Stat Calculations, One-Variable Statistics | STAT, CALC, 1-VAR |
| Linear regression and r | STAT, CALC, 4: LinReg(ax+b) (turn Stat Diagnostics on in MODE to see r) | Menu, Statistics, Stat Calculations, Linear Regression (mx+b) | STAT, CALC, REG, X, ax+b |
| nCr, factorial | MATH, PROB, 3: nCr / 4: ! | Menu, Probability, Combinations / Factorial | OPTN, PROB, nCr / x! |
| Finance (TVM) | APPS, Finance, TVM Solver | Menu, Finance, Finance Solver | TVM, Compound Interest |
| Complex numbers | MODE, a+bi | Settings, Real or Complex: Rectangular | SET UP (SHIFT MENU), Complex Mode: a+bi |
| Sequences and sums | 2nd STAT (LIST), OPS, 5: seq( ; LIST, MATH, 5: sum( | Menu, Statistics, List Operations / Calculus, Sum | RUN-MAT, OPTN, CALC, Σ( |

If you are not sure of a keystroke on a model, end that step with "(check on your model)". Never guess silently. Say which mode matters (radians vs degrees) before a trig calculation.

## 18. Don't

- **Don't copy.** Not from the guide, the booklet, bank questions, mark schemes or explanations. The originality check flags any 8-word run shared with the pack. Rewrite rubric phrases too: "Give your answer to 3 s.f.", not the full exam wording.
- **Don't call anything "official"** or imply IB endorsement.
- **Don't go beyond the syllabus** in an SL lesson without an `hlNote`, or beyond the item in any lesson.
- **Don't use unexplained jargon** or symbols. Define it, underline it, or don't use it.
- **Don't pad.** No "In this lesson we will…", no recaps of what you just said, no motivational filler.
- **Don't invent exam facts.** Don't claim "this comes up every year" or quote mark allocations unless the pack shows them.
- **Don't break the format** to get a visual effect. If the blocks can't express something, report it.
