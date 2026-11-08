# Course notes process v3 (from IB Chemistry and IB Physics)

Process v2 (`process-v2.md`) still holds. These are the changes the Chemistry and Physics runs justified.

## What the data showed

| | Chemistry | Physics |
|---|---|---|
| Writers | 476M tokens (112 agents) | 428M (82) |
| Verifiers | 152M | 152M |
| Topic passes | 76M | 43M |

Writers were about 65% of the cost. A median writer took 106 turns and ran `validate-lesson.mjs` 10 times (1,758 runs in all). The failing checks across those runs:

| Check | Failures | Cause |
|---|---|---|
| reading-time | 310 | Writers typed the computed minutes back in and tried to stay inside the brief's band; several cut worked examples to fit. |
| glossary first use | 152 | Wrapping a term's first mention in `[[id|…]]`: mechanical. |
| originality (number sets) | 144 | About 9 in 10 of 233 hits shared only round numbers (3, 4, 20; 0.1, 0.2, 0.3) with a pack question. |

The owner's reviews after the pipeline found about 20 content errors across 0580, Chemistry and Physics. The largest group (about 8) was a standalone line (cheat-sheet fact, glossary definition, takeaway, exam tip) that dropped a condition the lesson body stated. Topic passes read those lines inside their lessons, where the reader supplies the condition.

## What changes

1. **`validate-lesson.mjs --fix`.** Before checking, it sets `readingMinutes` to the computed value and wraps each plain first use of a planned glossary term in `[[id|…]]`. Writers run it with `--fix` every time.
2. **Reading-time bands are guidance.** A lesson over its band is fine when the extra time is worked examples. Never cut an example to fit; cut repetition.
3. **Number sets need 2 distinctive numbers.** A block fails only when it shares 3+ numbers with one part of a pack question and at least 2 of them are not round (`isRoundNumber`: whole numbers to 12, multiples of 5, one-significant-figure decimals, halves). The 8-word phrase check is unchanged.
4. **Extracts audit, once per course.** One agent reads only the standalone lines (cheat sheets, glossary, takeaways, exam tips, command-term examples) with no lesson open, the way a student revising from the cheat sheet would, and tests each against `review-errata.md` rule 1.
5. **Review errata list.** `review-errata.md` collects every class of error an owner review caught. Verifier, topic-pass and extracts-audit briefs point to it, so a fix in one course carries to the next.
6. **Kept as they are.** The blind verifier (criticals in 4–10% of lessons, minors fixed in place), the per-topic counterexample pass (17–35 fixes a topic), three Opus slots, and relaunching only unfinished items after a usage stop.
