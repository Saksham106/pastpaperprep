# IGCSE Physics 0625 notes: writer and verifier brief

This brief covers one lesson per syllabus section of Cambridge IGCSE Physics 0625 (syllabus for 2026, 2027 and 2028), plus four practical-skills lessons.

**Audience:** students aged 14–16, including students who are stuck and learning the section from this lesson alone. An IGCSE Physics teacher will review the lessons.

**Read first:**
- `docs/course-notes/aa-style-guide.md` §1–10, §13, §16 and §19: voice, lesson shape, blocks, notation, worked examples, checks, glossary, links, mistakes, figures and the "don't" list. Everything there applies unless this brief says otherwise.
- `docs/course-notes/process-v3.md` and `review-errata.md`: why the process looks like this, and the errors owner reviews have caught before. The verifier checks every errata rule.

**Examples of the standard:**
- `src/content/notes/ib-physics/lessons/1-6.json` (calculation-heavy) and `2-3.json` (explanation-heavy, with figures): a physics course built the same way. IGCSE is younger: use simpler words, smaller steps and no IB-only content.
- `src/content/notes/igcse-maths-0580/lessons/2-9.json`: how a Core lesson carries Extended sections and blocks.

## Inputs

| What | Where |
|---|---|
| Your section, e.g. `1.5.1` (dashed `1-5-1`) | the task message |
| Source pack | `../../../research/course-notes-0625/packs/<dashed>.json` from this worktree. *Never copy question text, set-ups or the syllabus wording from it.* |
| What the pack holds | the numbered syllabus statements with their level, the syllabus page, past questions (Core and Extended, newest syllabus first) with our worked steps and answers, real mistakes from those explanations, the glossary terms you own and use, prerequisites, assessment |
| Symbols and units the syllabus expects | `../../../research/course-notes-0625/extract/symbols-units.txt` |
| Practical skills wording (topic 7 and every practical context) | `../../../research/course-notes-0625/extract/practical.txt` |
| Items and levels | `src/content/notes/igcse-physics-0625/items.json` |
| Format and rules | `src/lib/course-notes/types.ts`, `validate.ts`, `inline.ts`; `scripts/notes/verify_kinds.py` (the `KINDS` table and docstrings, and the constants in `scripts/notes/phys_data.py`) |

You cannot render PDF pages here; the pack carries every statement word for word.

## Outputs (only these files; several writers share the worktree)

1. `src/content/notes/igcse-physics-0625/lessons/<dashed>.json`, with `"edition": "igcse-physics-0625-2026"`, `"item"` and `"topic"` as in `items.json`.
2. `src/content/notes/igcse-physics-0625/glossary/<dashed>.json`. It holds `TODO:` stubs for the terms the glossary plan says you own. Write a real definition for every one: plain words, `$…$` allowed, no maths in the label. Don't add terms the plan doesn't list, and don't touch other items' glossary files.
3. `src/content/notes/igcse-physics-0625/figures/<dashed>-<what>.svg`, if any. Follow style guide §16.
4. `../../../research/course-notes-0625/writer-notes/<dashed>.md`, only for a deliberate deviation: one line each, with the reason.

Never run git, vitest, `build-content-index.mjs` or `write-receipts.mjs`. A sidecar in `scripts/notes/sidecars/igcse-physics-0625/<dashed>.py` is allowed only when no verify kind fits; it imports `mathparse` via `parents[2]`.

## Core and Extended

The syllabus has two columns: **Core** statements, which every student learns, and **Supplement** statements, which only Extended students learn. In `items.json` a Supplement statement in a Core lesson has `"level": "Extended"`.

- **The lesson's `level`** comes from `items.json`. All lessons are Core except 1.6 Momentum and 4.5.2 The a.c. generator, which are Extended only.
- **Core lesson:** teach Core statements in normal content, under goals with no level. Teach Supplement statements in content marked `"level": "Extended"`:
  - a whole section for anything substantial (e.g. "Acceleration from a speed–time graph");
  - single blocks (text, example, check, formula, fact, figure) for small additions;
  - each Extended goal gets `"level": "Extended"`.

  A Core student sees only Core content, so the Core path must make complete sense on its own. Never rely on a hidden Extended block to explain a Core idea.
- **Extended-only lesson:** no level marks inside.
- **`hlNote`:** only for a short pointer to Extended material taught in another lesson.
- **Cover exactly the 2026–2028 syllabus.** Teach every statement, and respect its limits: when a statement says something "is not required" (e.g. $F = \frac{mv^2}{r}$ in 1.5.1), don't present it as required. Older questions in the pack ("syllabus: 2020_2022") may examine content that has since moved or gone: use them for style only. A short "beyond the syllabus" aside is allowed when it prevents a misconception.

## Papers

| Paper | Who | What |
|---|---|---|
| 1 / 2 | Core / Extended | 40 multiple-choice questions, 45 min |
| 3 / 4 | Core / Extended | short-answer and structured questions, 1 h 15 min |
| 5 / 6 | everyone | practical test / alternative to practical (written questions about experiments) |

Name the paper style where it helps ("a Paper 1/2 multiple-choice question", "Paper 3/4 often asks…"). Practical contexts (reading instruments, tables, graphs, variables, improvements) appear in every topic, so most content lessons include one practical-style example or tip where it fits.

## Physics notation (Cambridge style)

- **Maths in `$…$` (KaTeX).** Symbols as the syllabus uses them (see `symbols-units.txt`): $s$, $v$, $u$, $a$, $t$, $F$, $W$ (weight or work), $m$, $\rho$, $p$ (momentum or pressure: say which), $E_\text{k}$, $\Delta E_\text{p}$, $P$, $\theta$ (°C), $T$ (K or period: say which), $c$, $\lambda$, $f$, $n$, $I$, $V$, $E$ (e.m.f.), $R$, $Q$, $H_0$.
- **Units the Cambridge way, always inside `\text{}`:** $12\ \text{m/s}$, $2.5\ \text{m/s}^2$, $800\ \text{kg/m}^3$, $9.8\ \text{N/kg}$, $4200\ \text{J/(kg °C)}$, $30\ \text{kg m/s}$, $1.5\ \text{N m}$, $250\ \text{Pa}$ or $\text{N/m}^2$, $5.0\ \Omega$, $3.6\ \text{kW h}$. Use a solidus (m/s), never negative indices (not m s⁻¹): this is how the papers and mark schemes write them.
- **Prefixes:** Core uses M, k, c, m; Extended also G, µ, n.
- **Spelling:** UK spelling and Cambridge terms: "e.m.f.", "p.d.", "a.c.", "d.c.", "thermistor", "light-dependent resistor (LDR)", "earth wire", "centre of gravity", "ionising".
- **Directions and signs:** state the positive direction before a vector calculation and keep it. Velocity, acceleration, force and momentum carry signs when direction matters; speed, distance and energy don't.
- **Figures** are SVG diagrams:
  - force diagrams (arrows from the point of application);
  - distance–time and speed–time graphs with labelled axes and units;
  - circuit diagrams using the syllabus symbols;
  - ray diagrams (arrows on rays; normal dashed; real rays solid, virtual rays dashed);
  - wavefront diagrams, field-line patterns, transformer and motor sketches;
  - decay curves and half-life graphs.

  Check every arrow direction, label, scale and value against the text and the alt text.

## Equations, data and accuracy

- **No formula sheet.** Students must recall every equation the syllabus says to "recall and use". Tag those formulas `learn` (never `booklet`), and flag each one for the cheat sheet **once**, where it is taught or in the takeaways, not both. Write each equation the way the syllabus writes it (e.g. $\rho = \frac{m}{V}$, $p = mv$, $R = \frac{V}{I}$), then rearrange.
- **Values students should know:** $g \approx 9.8\ \text{m/s}^2$ (papers also print it), speed of light $3.0 \times 10^8\ \text{m/s}$, speed of sound in air about 330–350 m/s, $-273\ °\text{C}$ = 0 K. Everything else comes from the question. In `verify.truth` you may use the physics names in `phys_data.py` (`g`, `c`) and the degree helpers `sind` / `cosd` / `tand` / `asind` / `acosd` / `atand`.
- **Calculators** are allowed in every paper. No keystroke blocks for this course.
- **Accuracy:**
  - answers to the precision the data justify, usually 2 or 3 significant figures, never more than the least precise datum;
  - always give units;
  - show the working the mark scheme rewards: the equation, the numbers substituted, then the answer with its unit;
  - "show that": give one more significant figure than the stated value.

## Answers: every example and check carries `verify`

Each example and check carries `"verify": { "kind": …, "truth": …, …options }`. The gate checks the published answer, and every multiple-choice distractor must fail.

- **Calculations:** `rounded` (with `sf`), `numeric`, `exact`, `standard-form`, with `unit` (Cambridge spelling, e.g. `"m/s"`, `"m/s^2"`, `"kg/m^3"`, `"J/(kg °C)"`, `"kg m/s"`, `"N m"`) and `signed`. The published answer must spell the unit the same way, inside `\text{}`.
- **Word answers in multiple choice:** `choice`, with options as words ("towards the centre of the circle", "it doubles", "convection"). Write distractors from real misconceptions: the pack's mistakes and the verifier list below. Numerical options use a number kind, never `choice`.
- **Prose answers in worked examples** ("Explain why…", "Describe…", "Suggest…"): `explanation`. `requires` lists the marking points as phrases (an entry can be a list of alternatives); `forbids` lists misconception phrases. Write the answer as a full-mark response, one marking point per sentence.
- **Checks** are multiple choice or numeric only.
- **`truth` is the computation from the question's own data**, not your answer typed back in: `"0.5*1200*25**2"`, not `"375000"`; `"4200*0.50*(80-20)"` for an energy change.

## Originality, glossary, length

- **Originality.** Invent every example and check from scratch, with different objects, contexts and numbers from every pack question. A lint fails any block that shares 3 or more numbers, at least 2 of them not round, with one part of a pack question, and any 8-word run copied from the pack (syllabus statements included).
- **Glossary links.** The first prose use of every planned term you own or use must be a `[[id|label]]` link; `validate-lesson.mjs --fix` adds missing ones. Link to terms other items own; never define them.
- **Prerequisites:** start from the pack's `prerequisites`.
- **Reading time and examples.**
  - Run `validate-lesson.mjs --fix`: it sets `readingMinutes`.
  - Every teaching section has **two worked examples** plus its checks (one example may sit in an Extended part). Most lessons need at least one calculation example per section where the section has an equation; descriptive statements need an explanation example.
  - Bands by statements: 1–3 → 10–18 min, 4–8 → 15–25, 9+ → 20–30. A lesson over its band is fine when the extra time is worked examples. Never cut an example to fit; cut repetition.
- **Interactives:** none for this course.
- **Mistakes and exam tips.**
  - Ground mistakes in the pack's mistakes and the misconceptions below, rewritten.
  - Exam tips use the syllabus command words (`command-terms.json`) and say what earns the marks.

## Writer: done when

`node scripts/notes/validate-lesson.mjs --course igcse-physics-0625 --fix <item>` prints PASS for every check. Then reply with only:

```
SECTION: <item> <title>
STATUS: done | blocked
COVERAGE: <statement id> -> <section ids>, one line per statement
JUDGEMENT CALLS: <scope choices, anything uncertain, or none>
```

## Verifier

Read the lesson blind, against the pack, `review-errata.md` and this brief. Work out every answer yourself.

1. **Accuracy.** Every statement, step, answer, option, unit, sign, figure and explanation is correct physics at IGCSE level. Each `verify.truth` is computed from the question's data and matches the question text exactly.
2. **General statements.** For every definition, law, rule, cheat-sheet fact, takeaway and exam tip, look for a counterexample or an unstated condition. Rules that only hold under conditions must state them, in the standalone line itself (errata rule 1). Check these classic errors explicitly:
   - **Motion and forces:** a force needed to keep something moving; speed vs velocity; deceleration as negative acceleration; acceleration of free fall depending on mass; mass vs weight (kg vs N); terminal velocity when forces balance (not "no forces"); zero resultant force means constant velocity, not "at rest"; moment uses perpendicular distance from the pivot; equilibrium needs no resultant force and no resultant moment; centre of gravity and stability; momentum conserved only with no external resultant force; impulse = change in momentum; kinetic energy uses speed squared; work done = force × distance moved in the direction of the force; efficiency ≤ 100%; liquid pressure depends on depth and density, not container shape.
   - **Energy resources:** renewable vs non-renewable; the Sun as the source of most resources (not geothermal, nuclear or tidal).
   - **Thermal:** heat vs temperature vs internal energy; temperature constant while melting or boiling; evaporation vs boiling (evaporation at any temperature, from the surface, and it cools); the kelvin offset; gas pressure from particles colliding with the walls; absolute zero; conduction in metals vs non-metals; convection needs a fluid; dull black surfaces are good emitters and absorbers; "cold flows in" or "heat rises" (hot fluid rises because it is less dense).
   - **Waves:** frequency unchanged on refraction (speed and wavelength change); transverse vs longitudinal; sound needs a medium, light doesn't; real vs virtual images; total internal reflection needs light going towards the less optically dense medium at more than the critical angle; the order of colours in dispersion; the EM spectrum order, and all EM waves travel at the same speed in a vacuum; ultrasound above 20 kHz; echo distance is half the total path.
   - **Electricity and magnetism:** current not "used up"; conventional current vs electron flow; e.m.f. vs p.d.; ammeter in series, voltmeter in parallel; combined resistance in parallel is less than the smallest; thermistor and LDR resistance changes; a fuse or circuit breaker protects the wiring and sits in the live wire; double insulation; an induced e.m.f. needs a changing magnetic field or field lines being cut; Lenz's law direction; transformers need a.c.; high voltage means lower current and so smaller cable losses ($P = I^2R$); the left-hand rule for forces on currents.
   - **Nuclear:** isotopes have the same proton number and different nucleon numbers; alpha, beta and gamma: ionising ability vs penetration; half-life independent of the amount; background radiation and corrected count rate; activity vs count rate; irradiation vs contamination; random, spontaneous decay.
   - **Space:** day, year and seasons (the axis tilt, not the distance from the Sun); the Moon's phases; orbital speed $v = \frac{2\pi r}{T}$; elliptical orbits and speed; a light-year is a distance; redshift and the expanding Universe; the Hubble constant and the age estimate.
   - **Practical:** precision vs accuracy; random vs systematic error; zero error; reading to the nearest half-scale division; ±10% "equal within experimental accuracy"; independent, dependent and control variables; anomalies and repeats; the unit of a gradient.
3. **Coverage and levels.** Every statement is taught and covered by a goal at its level. Supplement content in a Core lesson is marked Extended. The Core path stands alone. Nothing beyond the syllabus is presented as required, and limits like "is not required" are respected.
4. **Exam fit.** Command words used as `command-terms.json` defines them; units, significant figures and signs follow the conventions above; explanation examples read like full-mark answers.
5. **Teaching.** A stuck 14-year-old could follow it. Checks are worth doing and their hints help. Figures match the text and alt text.
6. **Originality:** no pack set-up, object-and-number combination or syllabus wording reused.

Run `validate-lesson.mjs`, then probe one example or multiple-choice id with a wrong answer: `check-math.py --course igcse-physics-0625 --verify <item> <id> '<wrong tex>'` must FAIL.

**You fix minors yourself.** Edit only this item's lesson, glossary and figure files, re-run `validate-lesson.mjs` until it passes, and list each fix. **Don't fix criticals.** Report them with the correct physics; a fixer will act on them.

- **Critical:** wrong physics, a wrong answer, unit, sign or figure; a general statement false as written; a statement not taught; Supplement content unmarked in a Core lesson; a `truth` not computed from the question; copied pack set-ups; anything that would leave a student unable to follow the lesson.
- **Minor:** everything else worth fixing.

Reply with only:

```
SECTION: <item>
VERDICT: pass | minor-fixed | critical
CRITICAL: <numbered: json path — what is wrong, with the correct physics — the fix>, or none
FIXED: <numbered minors you fixed>, or none
CHECKS: validate-lesson <PASS/FAIL>; wrong-answer probe <FAILED as expected / passed wrongly>
```
