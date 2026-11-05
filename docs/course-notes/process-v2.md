# Course notes process v2 (from IB Maths AA, applied to IGCSE Maths 0580)

## Where the AA effort went

AA used about 65M agent tokens. Roughly 40% of that was waste or rework.

| Cost | Approx. tokens | What happened |
|---|---|---|
| Lesson runs lost to restarts | ~15M | Usage-cap 429s killed agents mid-run. One resume re-ran all 64 writers and verifiers because the cache only replays an unchanged prefix of calls (214 writer runs for 64 lessons). |
| Item-level question tagging | ~13M | Two blind Sonnet taggers plus Opus on the 729 questions in shared groups. |
| Minor-fix rounds | ~5M | 51 of 64 lessons got a separate fixer, which reloaded every file, mostly for mechanical things: a missing underline, reading time, escaped quotes, a stale band. |
| Gate hardening after review | 3 review rounds + 2 PR rounds | The owner's reviews still found 6 holes in hand-written Python sidecars: sample-point identities, containment instead of equivalence, degenerate answers like a zero factor. |
| Glossary clean-up | 2 passes | Writers working in parallel defined the same terms, filed them under the wrong owner, or let SL terms be owned by AHL lessons. |
| Repeated critical findings | ~12 lessons | Example set-ups copied from pack questions, wrong calculator keystrokes, wrong precision declarations. |

## What changes

1. **No tagging pass.** All 4,139 0580 questions are already tagged to official syllabus sections (`src/data/igcse-0580-section-retrieval-v3.json`). Each lesson's practice link uses those tags directly.
2. **Resume by item, not by cache.** Each item's stage writes a status file (`written`, `verified`, `done`). The workflow skips finished items, and a relaunch passes only the unfinished ones. Before relaunching, delete the partial files of agents that died.
3. **Declarative answer checks instead of per-lesson Python.**
   - Each example or check states its answer kind and its truth as a SymPy expression built from the question's own data, e.g. `{ "kind": "rounded", "truth": "sqrt(5**2 + 12**2)", "sf": 3 }`.
   - One shared, tested checker implements each kind. It covers equivalence rather than containment, degenerate answers, and sample points kept only as a smoke check.
   - A sidecar is still allowed for a genuinely unusual check, and the verifier reads it.
   - This removes most writer and fixer code, and the hole class the reviews kept finding.
4. **Deterministic lints for the usual minors.**
   - First use of a glossary term must be underlined.
   - `readingMinutes` is computed by the script, not claimed.
   - No stray escapes; figures follow the naming rule.
   - No duplicate cheat-sheet flags.
   - Glossary owners must match the glossary plan.
   - Numbers in examples must not match a pack question's set-up, so reused set-ups are caught before the verifier.
5. **Glossary plan first.** One cheap pass maps every term to the section that first teaches it. Writers link to the plan and add terms only to their own file.
6. **Calculator snippets library.** Vetted keystrokes per operation for the calculators 0580 students use (scientific, not graphing). Writers pick snippets by id instead of writing keystrokes.
7. **The verifier fixes minors itself.** It already has the full context, so it edits minor findings in place and re-runs the gate. A separate fixer and a re-verify happen only for critical findings.
8. **Smaller agent context.** One merged, shorter writer brief with two finished AA lessons as examples. Trimmed packs: the most relevant past-paper questions, their mark-scheme steps, and real mistakes from our worked explanations.
9. **Pilot 5, then run.** Five deliberately different sections go first: number, algebra, a geometry section with a figure, statistics, and one Extended-only section. Fix the brief once, then run the rest at 5 slots, one heavy workflow at a time.
10. **One counterexample pass per topic.** This is what the owner's reviewer caught that per-lesson verifiers missed. An Opus pass reads only the general statements in a topic (results, definitions, method lines, cheat-sheet facts) and tries to break each one. That is 9 cheap passes instead of post-PR review rounds.
11. **Platform once.** Course config drives everything:
    - slug, levels (`Core`/`Extended` for 0580, `SL`/`HL` for AA) and banks;
    - routes under `/revision-notes/<course>`;
    - the level switch, cheat sheets, glossary and command terms.

    A new course becomes content plus one config file.

The target for 0580 (72 sections) is roughly a third to half of AA's spend at the same or better quality.
