# Classification contract v2

PastPaperPrep retrieval is recall-first: if a method is independently assessed for marks, a student filtering for that method must find the question.

## Student-facing hierarchy

1. **Primary topic** — the dominant assessed syllabus family. Exactly one.
2. **Secondary topics** — every other syllabus family with an independently mark-bearing method. Zero or more. Order follows first substantive use in the solution.
3. **Skills (filterable subtopics)** — precise controlled labels for every materially assessed method. Each skill must be owned by the primary topic or one selected secondary topic.
4. **Context terms** — unassessed setup, notation, prerequisite manipulation, story vocabulary, or optional solution routes. Searchable if useful, but never exposed as topic/subtopic filters.

`subtopics` is a legacy transport field. Until it is removed, it must contain the same filterable labels as `skills`. Retrieval must defensively search both fields.

The durable v2 record should make ownership explicit instead of relying on
parallel flat arrays:

```ts
classificationV2: {
  taxonomyVersion: string;
  primaryTopic: TopicId;
  secondaryTopics: TopicId[];
  topicSubtopics: Array<{
    topic: TopicId;
    subtopics: SubtopicId[];
  }>;
  contextTags: ContextTagId[];
  evidence: {
    basis: "question+markscheme" | "question-only";
    confidence: "high" | "medium" | "low";
    reviewStatus: string;
  };
}
```

Use stable IDs in source artifacts and map them to display labels in the app.
Every secondary topic must own at least one material subtopic. `contextTags`
may improve free-text search, but must never affect topic/subtopic filters.

## Evidence rule

A topic or skill is material when at least one of these is true:

- the official markscheme awards a method or accuracy mark for it;
- the question explicitly instructs the student to perform it;
- completing the question necessarily requires it, even if the markscheme compresses intermediate working;
- a multi-part question has a separately assessed part under it.

Do not tag:

- facts merely mentioned in the stem;
- calculator arithmetic or routine algebra that is only cleanup;
- assumed prerequisite knowledge with no independent assessment;
- an optional alternative method when another route solves the question;
- every concept visible in a diagram.

## Multi-label rules

- Never force a genuinely cross-topic question into one topic.
- Never mechanically union candidate labels.
- A secondary topic needs its own evidence sentence tied to a credited step.
- A skill cannot exist without one selected owning topic.
- Duplicate question/markscheme pairs must have identical classifications.
- Taxonomy gaps are explicit. Do not squeeze a missing method into a misleading label.

## Course structure

- **Cambridge IGCSE Mathematics 0580:** use the nine official syllabus topics as top-level families.
- **Cambridge IGCSE Additional Mathematics 0606:** retain historical syllabus sections needed by the 2016–2026 bank, then normalize them into the app's stable parent families without losing the section-level skill.
- **IB Mathematics AA/AI:** use the five official topic families: Number and algebra; Functions; Geometry and trigonometry; Statistics and probability; Calculus. AA/AI and SL/HL differ at the skill layer, not by inventing incompatible parent families.

## Blind review contract

1. Freeze source commit, taxonomy version, IDs, question assets, and official markscheme assets.
2. First pass sees only sanitized question text and controlled taxonomy.
3. Independent multimodal pass sees question and markscheme assets, not production labels or first-pass output.
4. Adjudication treats both blind outputs and production as proposals; evidence wins.
5. Production-aware review inspects every proposed change and rejects no-op or semantically ambiguous decisions.
6. Apply through a durable overlay/generator, never by hand-editing generated runtime JSON.
7. Rebuild twice and require identical hashes, exact ID coverage, duplicate consistency, and byte-equivalent non-classification fields.

## Mechanical sealed-bank comparison

After all blind batches are sealed, run `scripts/compare_classification_v2_review.py` with the frozen source questions, blind manifest, taxonomy, blind root, and a new output root. The command validates the complete source/packet/result ID set before writing anything. It does not modify production or the blind artifacts.

The source skill tuple is normalized from fields that are actually stored: `skills`, `subtopics`, and `detailedSubtopics`, in that order, with duplicate labels removed and the final comparison order sorted. In particular, 0580's `detailedSubtopics` are not discarded. Primary and secondary topic values retain their stored order; only unordered skill/taxonomy/asset comparisons ignore ordering. No field is populated from taxonomy ownership.

Each queued record has paired question/markscheme assets, source and blind tuples, and `mismatchTypes`. The exact disjoint category is the `+`-joined tuple of these values in this order: `primary`, `secondary`, `skill`, `taxonomy-gap`. A row with no mismatch is exact; a non-empty `taxonomyGap` always queues the row, including when its classification tuple otherwise matches. `comparison.json`, `adjudication-queue.json`, `adjudication-inputs/`, and `adjudication-manifest.json` use canonical JSON and include hashes for source questions, manifest, taxonomy, every blind input/result, ordered IDs, and every referenced asset.

A bank cannot ship when any of these remains:

- missing or duplicate IDs;
- uncontrolled topics/skills;
- a skill not owned by a selected topic;
- unresolved taxonomy gaps;
- low-confidence production changes without human review;
- changed question text, marks, assets, paper metadata, or solutions;
- a filter test showing that a secondary topic or material skill is not discoverable;
- non-deterministic rebuilds or stale provenance hashes.
