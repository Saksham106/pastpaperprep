# Classification audit — August 2026

This audit covers the three newly added question banks:

- Cambridge IGCSE Additional Mathematics 0606: 1,633 questions
- IB Mathematics: Applications and Interpretation HL: 409 questions
- IB Mathematics: Applications and Interpretation SL: 334 questions

## Method

Classification was checked against each question's full accessible text and the controlled syllabus taxonomy for its course. Every question received an exact-text review, including records whose earlier labels had appeared plausible. The review used the dominant assessed method and treated OCR text cautiously where mathematical notation was degraded.

Complete review manifests are retained under `docs/audits/` with source-text hashes, reasons, and confidence levels. They are not imported by the application or shipped to the browser. Runtime data contains only the resulting controlled topic and subtopic labels.

## Cambridge IGCSE Additional Mathematics 0606

The old dataset used the 17 syllabus sections as both topics and subtopics, so it did not provide a useful hierarchy. It now uses seven broad topic families with the syllabus sections beneath them:

- Sets and functions
- Algebra
- Coordinate geometry
- Geometry and trigonometry
- Combinatorics and series
- Vectors and matrices
- Calculus

All 1,633 questions were reviewed from their exact accessible text and now have one dominant controlled syllabus section beneath a broad topic family. Mixed-method questions use the method carrying the main assessment demand rather than accumulating noisy secondary labels.

## IB Mathematics AI HL

All 409 questions were reviewed from their exact accessible text. Each now exposes one primary syllabus topic and one to three precise, owned subtopics. Stale cross-topic skills and heuristic labels were removed.

## IB Mathematics AI SL

All 334 questions were reviewed from their exact accessible text. Each now exposes one primary syllabus topic and one to three precise, owned subtopics. Stale cross-topic skills and heuristic labels were removed.

## Verification contract

Automated tests enforce that:

- every question remains present;
- every question has at least one subtopic;
- every subtopic belongs to the controlled taxonomy for the question's primary topic;
- every IB AI search skill exactly matches the reviewed subtopics;
- the 0606 hierarchy uses broad topic families and detailed syllabus sections;
- representative exact-text corrections do not regress;
- every audit-manifest ID and source-text hash matches the runtime source record.

This audit materially improves the classification, but it does not claim that every mixed-method question has one objectively unique label. The product uses the dominant assessed method as the primary classification and keeps the taxonomy controlled rather than surfacing speculative cross-topic labels.
