# AA HL full-bank production audit

The app raw bank is synchronized to the reviewed target artifact
`aa-hl-production-target/reviewed-production-target-841.json`, whose SHA-256 is
`a949ef162921455b8150778e8c4861f4e96b496e78d56d88b3171da9a9760731`.

The sibling `production-baseline-overlay.json` records all 841 pre-change app
IDs, tuples, and non-classification hashes. It is separate from
`latest-final-corrections.json` (221 reviewed records, 214 net changes). The
apply script is atomic and fail-closed; it updates only classification fields,
keeps existing `subtopics` equal to `skills`, and is byte-deterministic on a
second run. The Vitest release gate checks the actual `src/lib/taxonomy.ts`,
including Poisson distribution and Euler's method.
