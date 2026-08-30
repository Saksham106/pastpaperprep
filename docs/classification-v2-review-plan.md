# Classification v2 review plan

## Trigger

The deterministic cross-bank semantic audit found 153 confirmed production defects in 350 reviewed questions. The unbiased layer found 83 defects in 211 questions (39.3%). Most defects were missing or wrong skills/secondary topics, which directly damages topic-filter recall.

## Scope

| Bank | Population | Action | V2 review count |
|---|---:|---|---:|
| IGCSE Mathematics 0580 | 2,684 | Full fresh blind review | 2,684 |
| IGCSE Additional Mathematics 0606 | 1,633 | Full fresh blind review | 1,633 |
| IB Mathematics AA HL | 841 | Full fresh blind review | 841 |
| IB Mathematics AA SL | 578 | Expand deterministic sample from 30 to 58 | 28 new |
| IB Mathematics AI HL | 409 | Expand deterministic sample from 30 to 41 | 11 new |
| IB Mathematics AI SL | 334 | Expand deterministic sample from 30 to 34 | 4 new |

The three full banks total 5,158 questions. The expanded-sample banks add 43 new questions.

## Execution

1. Generate immutable blind packets from source question/markscheme assets and the v2 taxonomy.
2. Blind multimodal classification assigns one dominant primary topic, every independently mark-bearing secondary topic, and every materially assessed owned skill.
3. Compare the blind tuple with production after the pass is sealed.
4. Independently adjudicate every mismatch and every taxonomy gap from paired question/markscheme evidence.
5. Run a production-aware second review for every proposed change.
6. Apply decisions through bank-specific durable overlays or generators.
7. Require exact ID coverage, duplicate consistency, ownership closure, non-classification preservation, deterministic rebuild hashes, filter retrieval tests, full CI, and independent release review.

## Generated queues

- `/tmp/ppp-classification-v2/igcse-full`: 2,684 questions / 36 batches
- `/tmp/ppp-classification-v2/igcse-additional-full`: 1,633 questions / 22 batches
- `/tmp/ppp-classification-v2/ib-hl-full`: 841 questions / 12 batches
- `/tmp/ppp-classification-v2/ib-sl-expansion`: 28 new questions / 1 batch
- `/tmp/ppp-classification-v2/ib-ai-hl-expansion`: 11 new questions / 1 batch
- `/tmp/ppp-classification-v2/ib-ai-sl-expansion`: 4 new questions / 1 batch

The queues are working artifacts, not production data. Production remains unchanged until all release gates pass.
