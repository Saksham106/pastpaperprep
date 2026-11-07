# IB Chemistry notes: writer and verifier brief

This brief covers one lesson per item of the IB Chemistry course (guide first assessment 2025), SL and HL.

**Audience:** students aged 16–18, including students who are stuck and learning the topic from this lesson alone. An IB Chemistry teacher will review the lessons.

**Read first:**
- `docs/course-notes/aa-style-guide.md` §1–10, §13, §16 and §19: voice, lesson shape, blocks, notation, worked examples, checks, glossary, links, mistakes, figures and the "don't" list. Everything there applies, except where this brief says otherwise.
- `process-v2.md`, which explains why the process looks like this.

**Examples of the standard:** `src/content/notes/ib-math-aa/lessons/5-8.json` (an SL lesson with HL blocks) and any AA lesson whose `level` is AHL. Chemistry is a different subject; copy their shape, depth and tone, not their content.

## Inputs

| What | Where |
|---|---|
| Your item, e.g. `4.2` (dashed `4-2`) | the task message |
| Source pack | `../../../research/course-notes-chemistry/packs/<dashed>.json` from this worktree. *Never copy question text, set-ups or the guide's wording from it.* |
| What the pack holds | understandings with the guide's raw text (outcomes, guidance, linking questions; two columns interleaved, so read with care), past questions with mark schemes, mark-scheme "do not accept" lines, glossary terms you own and use, prerequisites, assessment |
| Official guide (PDF) | `../../../research/course-notes-chemistry/sources/chem-guide-2025.pdf`. The pack gives each understanding's page. Read the page (Read tool, `pages`) when the raw text is unclear. |
| Data booklet (PDF, v1.1) | `../../../research/course-notes-chemistry/sources/databooklet-ibchem.pdf` |
| Items, levels, booklet equations | `src/content/notes/ib-chemistry/items.json` |
| Format and rules | `src/lib/course-notes/types.ts`, `validate.ts` and `inline.ts`; `scripts/notes/verify_kinds.py` (the `KINDS` table and each checker's docstring, including the chemistry kinds and the data helpers in `scripts/notes/chem_data.py`) |

## Outputs (only these files; several writers share the worktree)

1. `src/content/notes/ib-chemistry/lessons/<dashed>.json`
2. `src/content/notes/ib-chemistry/glossary/<dashed>.json`.
   - It holds `TODO:` stubs for the terms the glossary plan says you own. Write a real definition for every one: plain words, `$…$` allowed, no maths in the label.
   - Don't add terms the plan doesn't list, and don't touch other items' glossary files.
3. `src/content/notes/ib-chemistry/figures/<dashed>-<what>.svg`, if any. Follow style guide §16.
4. `../../../research/course-notes-chemistry/writer-notes/<dashed>.md`, only for a deliberate deviation, one line each, with the reason.

Never run git, vitest, `build-content-index.mjs` or `write-receipts.mjs`. A sidecar in `scripts/notes/sidecars/ib-chemistry/<dashed>.py` is allowed only when no verify kind fits. It imports `mathparse` via `parents[2]`.

## SL and HL

- **The lesson's `level`** comes from `items.json`: "SL" or "AHL".
- **SL lesson:**
  - Teach SL understandings in normal content.
  - Teach any AHL understanding inside it (some items have one, marked `level: "AHL"` on the bullet) in content marked `"level": "AHL"`: a whole section, or single blocks.
  - Give each AHL goal `"level": "AHL"`.
  - The SL path must make complete sense on its own.
- **AHL lesson:** no level marks needed inside.
- **`hlNote`:** use it only for a short pointer from an SL lesson to HL material taught in another lesson.
- **Cover exactly the 2025 guide.** Teach every understanding with its outcomes and guidance. Don't teach old-syllabus or option content that the 2025 guide dropped, even if the pack's "syllabus: 2016" questions examine it. If the guide's guidance says something is not required ("… is not required"), don't present it as required. A short "beyond the syllabus" aside is allowed when it prevents a misconception.

## Chemistry notation

- **Every formula, ion and equation goes in mhchem inside `$…$`.**
  - `$\ce{H2SO4}$`, `$\ce{SO4^2-}$`, `$\ce{Cu^2+}$`, `$\ce{CH3CH2OH}$`
  - `$\ce{2H2(g) + O2(g) -> 2H2O(l)}$`, equilibrium `$\ce{N2(g) + 3H2(g) <=> 2NH3(g)}$`
  - half-equations with `e-`: `$\ce{Fe^3+(aq) + e- -> Fe^2+(aq)}$`
  - Never type subscripts as plain text ("H2O") in prose.
- **Quantities with units:** `$\pu{-890 kJ mol-1}$`, `$\pu{0.250 mol dm-3}$`, `$\pu{8.31 J K-1 mol-1}$`.
  - Standard state: `$\Delta H^\ominus$`.
  - Use IB units: dm³, mol dm⁻³, kJ mol⁻¹, J K⁻¹ mol⁻¹, kPa, K.
- **State symbols:** include them in thermochemical equations, equilibria, enthalpy cycles, and wherever the question or mark scheme would require them. A combustion or formation equation for ΔHc⦵/ΔHf⦵ is per mole of the substance (fractions allowed).
- **Structures:** draw Lewis formulas, skeletal and structural formulas, energy profiles, apparatus, cells and spectra as SVG figures (style guide §16). Check every bond count, lone pair, charge and angle against the text and alt text. Curly arrows in mechanisms start at a lone pair or bond and end at an atom or bond.
- **Names:** IUPAC names as the guide uses them, e.g. "ethanoic acid", "but-2-ene", "2-methylpropan-2-ol".

## Data, calculators and accuracy

- **Data booklet:** every numerical value not given in the question comes from the data booklet, e.g. Ar values as printed (H 1.01, C 12.01, O 16.00), R = 8.31, the bond enthalpies, ΔHf⦵/ΔHc⦵, E⦵ and indicator data.
  - Say which booklet section a value comes from the first time it is used in a lesson ("(data booklet, section 12)").
  - In `verify.truth`, use the helpers: `Ar()`, `Mr()`, `BE()`, `Hf()`, `Hc()`, `S()`, `Gf()`, `E0()`, `lattice()`, `pKa_ind()`, `R`, `NA`, `F`, `Kw`, `c_water`, `Vm`.
- **Calculators:** calculators are allowed on every IB Chemistry paper. Don't write calculator keystroke blocks; the course has none.
- **Formulas:**
  - Tag a formula `booklet` (with its `bookletId` from `items.json`) only when it is in the data booklet's equations section. Everything else is `learn`.
  - Flag each formula or fact for the cheat sheet **once**, either where it is taught or in the takeaways, not both.
- **Accuracy:**
  - Answers to the precision the data justify: usually 3 significant figures, never more than the least precise datum.
  - pH to 2 decimal places.
  - Always give units.
  - Give ΔH and E⦵ with their sign (`signed: true`).
  - Show the working the mark scheme rewards: substitution, then the answer with units.

## Answers: every example and check carries `verify`

Each example and check carries `"verify": { "kind": …, "truth": …, …options }`. The gate checks the published answer, and every multiple-choice distractor must fail.

- **Calculations:** `rounded`, `numeric`, `exact` and `standard-form`, with `unit` and `signed` where they matter.
- **Equations:**
  - `chem-equation` for balanced equations and half-equations. The truth is the skeleton, and the gate balances it.
  - `reversible` controls the arrow, `states` requires state symbols, and `fractions` allows per-mole equations.
- **Formulas:** `formula`, with a computed truth (`empirical_formula(...)`, `molecular_formula(...)`, `ionic_formula(...)`), or `formula("…")` with `given: true` only when the formula is stated in the question.
- **Word answers in multiple choice:** `choice`, with options as words ("trigonal planar", "sp²", "London (dispersion) forces").
  - Write distractors from real misconceptions: the pack's mark-scheme "do not accept" lines and the verifier list below.
  - Formulas as options use `formula`, not `choice`.
- **Prose answers in worked examples** ("Explain why…", "Outline…"): `explanation`.
  - `requires` lists the marking points as phrases the answer must contain. An entry can be a list of alternatives.
  - `forbids` lists misconception phrases the answer must avoid.
  - Write the answer the way a full-mark response would read, one marking point per sentence.
- **Checks** are multiple choice or numeric only.
- **`truth` is the computation from the question's own data**, not your answer typed back in:
  - `"0.0250*Mr('Na2CO3')"`, not `"2.65"`;
  - `"(4*BE('C-H') + 2*BE('O=O')) - (2*BE('C=O') + 4*BE('O-H'))"` for a bond-enthalpy ΔH.

## Originality, glossary, length

- **Originality:** invent every example and check from scratch. Use different compounds, contexts and numbers from every pack question. A lint fails any block that shares 3+ numbers with a pack question, and any 8-word run copied from the pack (including the guide).
- **Glossary links:** the first prose use of every planned term you own or use must be a `[[id|label]]` link (a lint checks this). Link to terms other items own; never define them.
- **Prerequisites:** start from the pack's `prerequisites`.
- **Reading time and examples:**
  - `readingMinutes` must equal the value `validate-lesson.mjs` prints.
  - Every teaching section has **two worked examples** plus its checks. At least one example per lesson is a calculation or an equation where the content allows; at least one is an explanation answer where the content is explanatory. Never cut to one example to save time.
  - Bands:

    | Understandings | Minutes |
    |---|---|
    | 1–2 | 12–20 |
    | 3–4 | 15–25 |
    | 5+ | 20–30 |

  - Cut repetition and wordy prose before examples, and record any overrun in writer notes.
- **Interactives:** none for this course.
- **Mistakes and exam tips:**
  - Ground mistakes in the pack's mark-scheme lines and in the misconceptions below, rewritten.
  - Exam tips use IB command terms as the guide defines them (state, outline, describe, explain, deduce, calculate, determine, suggest, sketch, draw, identify, distinguish, compare and contrast, evaluate, discuss, predict, justify, annotate, formulate), and say what earns the marks.
  - Name the paper style where it helps: 1A multiple choice, 1B data-based, Paper 2.

## Writer: done when

`node scripts/notes/validate-lesson.mjs --course ib-chemistry <item>` prints PASS for every check. Then reply with only:

```
SECTION: <item> <title>
STATUS: done | blocked
COVERAGE: <understanding id> -> <section ids>, one line per understanding
JUDGEMENT CALLS: <scope choices, anything uncertain, or none>
```

## Verifier

Read the lesson blind, against the pack, the guide pages and this brief. Work out every answer yourself.

1. **Accuracy.** Every statement, step, answer, option, explanation and figure is correct chemistry. Each `verify.truth` is computed from the question's data and matches the question text exactly. Every value not given in the question is the data-booklet value.
2. **General statements.** For every definition, rule, trend and cheat-sheet fact, look for a counterexample or an unstated condition. Rules that only hold under conditions must state them. Check these classic errors explicitly:
   - **Energy:**
     - bond breaking releases energy (it absorbs);
     - ΔH sign conventions and "per mole of reaction";
     - Hess cycles with the arrows the wrong way;
     - the exothermic/endothermic and stability wording.
   - **Kinetics and equilibrium:**
     - a catalyst shifts equilibrium or changes ΔH or K (it doesn't);
     - temperature is the only thing that changes K;
     - Le Châtelier applied to K;
     - rate vs extent;
     - "equilibrium means equal concentrations".
   - **Acids and bases:**
     - strong means concentrated;
     - "weak acids don't ionize";
     - pH 7 is neutral at every temperature (only at 298 K);
     - buffer and indicator ranges;
     - Ka/Kb with the wrong conjugate.
   - **Bonding:**
     - IMFs vs covalent bonds (boiling a molecular substance breaks IMFs, not covalent bonds);
     - hydrogen bonding needs H on N, O or F;
     - London forces exist in all molecules;
     - electron domain vs molecular geometry;
     - bond angles;
     - polarity needs both polar bonds and an asymmetric shape;
     - graphite conducts but diamond doesn't, and why;
     - an ionic lattice is not molecules.
   - **Atoms:**
     - electron configurations of Cr and Cu, and of ions (4s removed first);
     - isotopes have the same chemical properties;
     - ionization energy trends and their exceptions;
     - emission vs absorption spectra;
     - convergence.
   - **Redox and electrochemistry:**
     - oxidation states;
     - OIL RIG direction;
     - anode/cathode polarity in voltaic vs electrolytic cells;
     - which way electrons move;
     - E⦵ isn't multiplied by the coefficients.
   - **Organic:**
     - naming and numbering;
     - isomer counts;
     - mechanism arrows;
     - SN1/SN2 conditions;
     - Markovnikov products;
     - functional group tests.
   - **Practical:**
     - sig figs and uncertainty propagation;
     - random vs systematic error;
     - precision vs accuracy.
3. **Coverage and levels:**
   - every understanding (with its outcomes and guidance) is taught and covered by a goal at its level;
   - AHL content is marked;
   - the SL path stands alone;
   - nothing beyond the 2025 guide is presented as required.
4. **Exam fit:**
   - command terms are used correctly;
   - accuracy, units and signs follow the conventions;
   - booklet formulas are tagged correctly;
   - explanation examples read like full-mark answers.
5. **Teaching:**
   - a stuck 16-year-old could follow it;
   - checks are worth doing and their hints help;
   - figures match the text and the alt text.
6. **Originality:** no pack set-up, compound-and-number combination or guide wording reused.

Run `validate-lesson.mjs` and probe one example or multiple-choice id with a wrong answer: `check-math.py --course ib-chemistry --verify <item> <id> '<wrong tex>'` must FAIL.

**You fix minors yourself.** Edit only this item's lesson, glossary and figure files, re-run `validate-lesson.mjs` until it passes, and list each fix. **Don't fix criticals:** report them with the correct chemistry, and a fixer will act on them.

- **critical:**
  - wrong chemistry, a wrong answer or a wrong figure;
  - a general statement that is false as written;
  - an understanding not taught;
  - AHL content unmarked in an SL lesson;
  - a `truth` that isn't computed from the question;
  - copied pack set-ups;
  - anything that would leave a student unable to follow the lesson.
- **minor:** everything else worth fixing.

Reply with only:

```
SECTION: <item>
VERDICT: pass | minor-fixed | critical
CRITICAL: <numbered: json path — what is wrong, with the correct chemistry — the fix>, or none
FIXED: <numbered minors you fixed>, or none
CHECKS: validate-lesson <PASS/FAIL>; wrong-answer probe <FAILED as expected / passed wrongly>
```
