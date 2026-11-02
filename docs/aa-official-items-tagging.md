# IB Maths AA: item-level official tags (2026-11-02)

Each accepted AA record in `src/data/aa-official-subtopics/overlay.json` has `officialItems`: the official 2021-guide items (from `items.json`) that the question examines.

| Source | Records |
|---|---|
| Derived: every group is a single-item group (`scripts/aa/derive-official-items.mjs`) | 205 |
| Agent-tagged: at least one multi-item group | 729 |
| **Total accepted** | **934** |

**How the 729 were tagged.** `scripts/aa/export-tagging-chunks.mjs` exported 13 chunks, which ran as 26 half-chunks. Each question went to two independent Sonnet taggers; the second (blind) tagger never saw the first one's answer. Each tagger saw:
- the question text (HL text is machine-extracted);
- our worked explanation with the official mark codes, or the mark scheme;
- the candidate items with their bullets and each group's inclusive/exclusive boundary.

The rule was: tag an item when marks are earned by that item's skill, not for routine background use. Only items from the question's own groups were allowed.

**Results.**
- **Agreement:** the two taggers chose identical sets for 657 of the 729 questions (90%).
- **Disputes:** Opus settled the other 72 from the same evidence.
- **Validation:** `scripts/aa/merge-tagging.mjs` wrote the results back after validating every id and candidate.
- **Coverage:** every one of the 83 items has at least one question. 370 records carry more than one item.

Agent outputs are kept outside Git in `../research/aa-course-notes/tagging/`: `chunks/`, `runs/{tagger,reviewer,adjudicated}/` and `final/`.
