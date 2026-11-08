# IB Physics notes: writer and verifier brief

This brief covers one lesson per item of the IB Physics course (guide first assessment 2025), SL and HL.

**Audience:** students aged 16–18, including students who are stuck and learning the topic from this lesson alone. An IB Physics teacher will review the lessons.

**Read first:**
- `docs/course-notes/aa-style-guide.md` §1–10, §13, §16 and §19: voice, lesson shape, blocks, notation, worked examples, checks, glossary, links, mistakes, figures and the "don't" list. Everything there applies unless this brief says otherwise.
- `process-v2.md`, which explains why the process looks like this.

**Examples of the standard:** the finished IB Chemistry lessons, a science course built the same way: `src/content/notes/ib-chemistry/lessons/4-2.json` (calculation-heavy) and `6-18.json` (explanation-heavy, with figures). Physics is a different subject, so copy their shape, depth and tone, not their content.

## Inputs

| What | Where |
|---|---|
| Your item, e.g. `1.3` (dashed `1-3`) | the task message |
| Source pack | `../../../research/course-notes-physics/packs/<dashed>.json` from this worktree. *Never copy question text, set-ups or the guide's wording from it.* |
| What the pack holds | the official understandings (verbatim), the subtopic's guidance and linking questions, the guide page, the data booklet section, past questions with mark schemes (2025 syllabus first), mark-scheme "do not accept" lines, the glossary terms you own and use, prerequisites, assessment |
| Official guide (PDF) | `../../../research/course-notes-physics/sources/phys-guide-2025-b.pdf` (updated March 2024). Read the pack's `guidePage` with the Read tool (`pages`); equations extract badly as text. |
| Data booklet (PDF, v1.1) | `../../../research/course-notes-physics/sources/databooklet-v1.1.pdf`. It lists constants, unit conversions and, by subtopic, the equations students are given. |
| Items, levels, booklet section | `src/content/notes/ib-physics/items.json` |
| Format and rules | `src/lib/course-notes/types.ts`, `validate.ts`, `inline.ts`; `scripts/notes/verify_kinds.py` (the `KINDS` table and docstrings, including the physics constants in `scripts/notes/phys_data.py`) |

## Outputs (only these files; several writers share the worktree)

1. `src/content/notes/ib-physics/lessons/<dashed>.json`, with `"edition": "ib-physics-2025"`.
2. `src/content/notes/ib-physics/glossary/<dashed>.json`. It holds `TODO:` stubs for the terms the glossary plan says you own. Write a real definition for every one: plain words, `$…$` allowed, no maths in the label. Don't add terms the plan doesn't list, and don't touch other items' glossary files.
3. `src/content/notes/ib-physics/figures/<dashed>-<what>.svg`, if any. Follow style guide §16.
4. `../../../research/course-notes-physics/writer-notes/<dashed>.md`, only for a deliberate deviation: one line each, with the reason.

Never run git, vitest, `build-content-index.mjs` or `write-receipts.mjs`. A sidecar in `scripts/notes/sidecars/ib-physics/<dashed>.py` is allowed only when no verify kind fits. It imports `mathparse` via `parents[2]`.

## SL and HL

- **The lesson's `level`** comes from `items.json`: "SL" or "AHL".
- **SL lesson:**
  - Teach SL understandings in normal content.
  - Teach any AHL understanding inside it (3.9 has one, marked `level: "AHL"` on its bullet) in content marked `"level": "AHL"`, with an AHL goal.
  - The SL path must make complete sense on its own.
- **AHL lesson:** no level marks needed inside.
- **`hlNote`:** only for a short pointer from an SL lesson to HL material taught in another lesson.
- **Cover exactly the 2025 guide.** Teach every understanding together with its subtopic guidance. Don't teach old-syllabus option content (optics, astrophysics beyond E.5, engineering, imaging) even if the pack's "syllabus: 2016" questions examine it. When guidance says something "is not required", don't present it as required. A short "beyond the syllabus" aside is allowed when it prevents a misconception.

## Physics notation

- **Maths in `$…$` (KaTeX).**
  - Symbols as the guide and the data booklet use them: $s, u, v, a, t$; $F_\text{net}$; $E_\text{k}$, $E_\text{p}$; $\varepsilon$ for emf; $\Phi$ for flux; $\lambda$; $\omega$; $\gamma$.
  - Vectors in bold or with an arrow only when the direction matters to the point.
- **Quantities with units.** Write them as `$\pu{9.8 m s-2}$`, `$\pu{2.5 kN}$`, `$\pu{6.63e-34 J s}$` (mhchem `\pu` works), or `$9.8\ \text{m s}^{-2}$`.
  - Use SI units and IB conventions: m s⁻², N, J, W, Pa, kg m s⁻¹, N s, rad s⁻¹, Hz, V, A, Ω, C, T, Wb, eV / MeV, K.
  - Negative indices, never solidus: m s⁻¹, not m/s.
- **Signs and directions.** State the positive direction before any vector calculation, and keep it throughout. Displacement, velocity, acceleration, force, momentum and field quantities carry signs. Energy, speed and distance don't.
- **Figures** are SVG diagrams:
  - free-body diagrams (arrows from the point of application, lengths to scale where it matters);
  - motion graphs with labelled, unit-carrying axes;
  - circuit diagrams with IB symbols;
  - ray and wavefront diagrams;
  - field lines (direction arrows; line density shows strength);
  - standing-wave patterns;
  - energy-level diagrams;
  - HR diagrams.

  Check every arrow direction, label, scale and value against the text and alt text.

## Data, calculators and accuracy

- **Data booklet.** Every constant not given in the question comes from the data booklet, as printed: g = 9.8 m s⁻², c, h, e, mₑ, and so on.
  - In `verify.truth`, use the physics names from `phys_data.py` (`g`, `G`, `c`, `h`, `e`, `me`, `kB`, `sigma`, `k_e`, `eps0`, `mu0`, …) and the degree helpers `sind` / `cosd` / `tand` / `asind` / `acosd` / `atand`.
  - Say once per lesson that a value comes from the data booklet.
- **Calculators** are allowed on every paper. Don't write calculator keystroke blocks; the course has none.
- **Formulas.**
  - Tag a formula `booklet` (with the item's `bookletId` from `items.json`) only when that equation is printed in the data booklet. Check the PDF.
  - Everything else is `learn`: definitions the guide expects students to know, such as $p = mv$ if it isn't printed.
  - Flag each formula or fact for the cheat sheet **once**, where it is taught or in the takeaways, not both.
- **Accuracy.**
  - Answers to the precision the data justify, usually 2 or 3 significant figures, never more than the least precise datum.
  - Always give units.
  - Use `signed: true` when the sign is the point (a velocity, a change in momentum, work done on/by).
  - Show the working the mark scheme rewards: the equation, the substitution, then the answer with its unit.

## Answers: every example and check carries `verify`

Each example and check carries `"verify": { "kind": …, "truth": …, …options }`. The gate checks the published answer, and every multiple-choice distractor must fail.

- **Calculations:** `rounded` (with `sf`), `numeric`, `exact`, `standard-form`, with `unit` and `signed`. Vectors use the maths kinds (`vector`, `angle`, `bearing`) where they fit.
- **Word answers in multiple choice:** `choice`, with options as words ("towards the centre of the circle", "it doubles", "node").
  - Write distractors from real misconceptions: the pack's mark-scheme "do not accept" lines and the verifier list below.
  - Numerical options use a number kind, never `choice`.
- **Prose answers in worked examples** ("Explain why…", "Outline…", "Show that…" explanations): `explanation`.
  - `requires` lists the marking points as phrases. An entry can be a list of alternatives.
  - `forbids` lists misconception phrases.
  - Write the answer as a full-mark response, one marking point per sentence.
- **"Show that" calculations:** verify the value the working reaches, with a number kind. The answer gives one more significant figure than the stated value, as the mark scheme expects.
- **Checks** are multiple choice or numeric only.
- **`truth` is the computation from the question's own data**, not your answer typed back in:
  - `"0.5*1200*25**2"`, not `"375000"`;
  - `"sqrt(2*g*4.0)"` for a speed from a drop of 4.0 m;
  - `"6.63e-34*3.0e8/(500e-9)"` with booklet names: `"h*c/(500e-9)"`.

## Originality, glossary, length

- **Originality.** Invent every example and check from scratch, with different objects, contexts and numbers from every pack question. A lint fails any block that shares 3+ numbers with a pack question, and any 8-word run copied from the pack (including the guide).
- **Glossary links.** The first prose use of every planned term you own or use must be a `[[id|label]]` link; a lint checks this. Link to terms other items own; never define them.
- **Prerequisites:** start from the pack's `prerequisites`.
- **Reading time and examples.**
  - `readingMinutes` must equal the value `validate-lesson.mjs` prints.
  - Every teaching section has **two worked examples** plus its checks. Most physics lessons need at least one calculation example per section; explanatory understandings (models, evidence, qualitative effects) need at least one explanation example.
  - Never cut to one example to save time.
  - Bands by understandings: 1–2 → 12–20 min, 3–4 → 15–25, 5+ → 20–30. Cut repetition and wordy prose before examples, and record any overrun in writer notes.
- **Interactives:** none for this course.
- **Mistakes and exam tips.**
  - Ground mistakes in the pack's mark-scheme lines and the misconceptions below, rewritten.
  - Exam tips use IB command terms as the guide defines them (state, outline, describe, explain, determine, calculate, deduce, estimate, show that, sketch, draw, label, identify, suggest, discuss, compare, comment, evaluate, predict), and say what earns the marks.
  - Name the paper style where it helps: 1A multiple choice, 1B data-based, Paper 2.

## Writer: done when

`node scripts/notes/validate-lesson.mjs --course ib-physics <item>` prints PASS for every check. Then reply with only:

```
SECTION: <item> <title>
STATUS: done | blocked
COVERAGE: <understanding id> -> <section ids>, one line per understanding
JUDGEMENT CALLS: <scope choices, anything uncertain, or none>
```

## Verifier

Read the lesson blind, against the pack, the guide page and this brief. Work out every answer yourself.

1. **Accuracy.** Every statement, step, answer, option, unit, sign, figure and explanation is correct physics. Each `verify.truth` is computed from the question's data and matches the question text exactly. Every constant not given is the data-booklet value.
2. **General statements.** For every definition, law, rule and cheat-sheet fact, look for a counterexample or an unstated condition. Rules that only hold under conditions must state them. Check these classic errors explicitly:
   - **Mechanics:**
     - "a force is needed to keep something moving";
     - action–reaction pairs acting on the same body;
     - weight vs mass;
     - normal force always equals mg;
     - centrifugal force as a real force in an inertial frame;
     - speed constant means no acceleration;
     - acceleration zero at the top of a projectile's path;
     - momentum conserved without saying "no resultant external force";
     - kinetic energy conserved in every collision;
     - suvat used with non-uniform acceleration;
     - static vs dynamic friction (Ff ≤ μsFN);
     - work done when force ⟂ displacement;
     - power vs energy.
   - **Rotation (AHL):**
     - torque with the wrong lever arm (the perpendicular distance);
     - moment of inertia for the wrong axis;
     - angular momentum conserved without "no resultant external torque".
   - **Relativity (AHL):**
     - which observer measures proper time or proper length;
     - γ ≥ 1;
     - velocity addition beyond c;
     - simultaneity is frame-dependent;
     - the space–time interval is invariant (Δt and Δx are not).
   - **Thermal:**
     - heat vs temperature vs internal energy;
     - temperature constant during a phase change for a pure substance;
     - Kelvin offsets in ratios;
     - conduction rate depends on temperature gradient and area;
     - black-body vs emissivity;
     - albedo is a ratio;
     - greenhouse effect described as the ozone hole;
     - entropy of an isolated vs non-isolated system;
     - the efficiency limit uses kelvin.
   - **Gases:**
     - ideal-gas assumptions;
     - kelvin in PV = nRT;
     - pressure from momentum change per collision and collision rate.
   - **Circuits:**
     - current "used up";
     - emf vs terminal potential difference;
     - internal resistance;
     - parallel resistance less than the smallest;
     - ammeters and voltmeters ideal or not;
     - ohmic only at constant temperature;
     - conventional current vs electron flow.
   - **Waves:**
     - frequency changes on refraction (it doesn't; speed and wavelength do);
     - path difference vs phase difference;
     - the coherence requirement;
     - which pipes have which harmonics;
     - nodes and antinodes in open and closed pipes;
     - damping lowers the resonant amplitude and slightly shifts the resonant frequency;
     - Doppler for moving source vs moving observer;
     - light Doppler only when v ≪ c.
   - **Fields:**
     - g inside vs outside a body;
     - the sign of gravitational and electric potential energy;
     - field lines never cross;
     - the field is zero inside a conductor (electrostatics);
     - work done along an equipotential is zero;
     - magnetic force does no work on a charge;
     - left-hand vs right-hand rules;
     - Lenz's law direction;
     - emf induced only by a changing flux.
   - **Nuclear and quantum:**
     - binding energy is energy released when a nucleus forms (not stored in the nucleus);
     - binding energy per nucleon peaks near Fe/Ni;
     - activity vs count rate;
     - half-life independent of amount;
     - the photoelectric effect: intensity changes the number of electrons, not their maximum kinetic energy;
     - the threshold frequency;
     - de Broglie uses momentum;
     - the Bohr model applies only to hydrogen;
     - fission vs fusion conditions.
   - **Practical:**
     - significant figures and propagation (adding absolute uncertainties vs fractional ones);
     - random vs systematic error;
     - precision vs accuracy;
     - the gradient's unit;
     - linearization.
3. **Coverage and levels.**
   - Every understanding (with its subtopic guidance) is taught and covered by a goal at its level.
   - AHL content is marked.
   - The SL path stands alone.
   - Nothing beyond the 2025 guide is presented as required.
4. **Exam fit.**
   - Command terms are used correctly.
   - Units, sig figs and signs follow the conventions.
   - Booklet formulas are tagged correctly (check the PDF).
   - Explanation examples read like full-mark answers.
5. **Teaching.**
   - A stuck 16-year-old could follow it.
   - Checks are worth doing and their hints help.
   - Figures match the text and alt text.
6. **Originality:** no pack set-up, object-and-number combination or guide wording reused.

Run `validate-lesson.mjs`, then probe one example or multiple-choice id with a wrong answer: `check-math.py --course ib-physics --verify <item> <id> '<wrong tex>'` must FAIL.

**You fix minors yourself.** Edit only this item's lesson, glossary and figure files, re-run `validate-lesson.mjs` until it passes, and list each fix. **Don't fix criticals.** Report them with the correct physics; a fixer will act on them.

- **Critical:**
  - wrong physics, a wrong answer, unit, sign or figure;
  - a general statement that is false as written;
  - an understanding not taught;
  - AHL content unmarked in an SL lesson;
  - a `truth` that isn't computed from the question;
  - copied pack set-ups;
  - anything that would leave a student unable to follow the lesson.
- **Minor:** everything else worth fixing.

Reply with only:

```
SECTION: <item>
VERDICT: pass | minor-fixed | critical
CRITICAL: <numbered: json path — what is wrong, with the correct physics — the fix>, or none
FIXED: <numbered minors you fixed>, or none
CHECKS: validate-lesson <PASS/FAIL>; wrong-answer probe <FAILED as expected / passed wrongly>
```
