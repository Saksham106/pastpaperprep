# IGCSE maths source-answer repair batch

This batch changes only official-answer asset paths and their derived answer-image counts for 2,007 supported maths records: 1,042 Mathematics 0580 and 965 Additional Mathematics 0606. It preserves question images, classifications, solutions, marks, access rules and the approved whole-image PDF layout.

## Evidence

- Exact baseline source reconciliation: 5,600 official-answer references = 3,165 supported source-content screen passes + 2,007 repair candidates + 428 held. A supported table-band check is not universal completeness certification for unsupported or out-of-table content.
- Frozen source-grid v1 SHA: `e04e5e06193ff9df6ce258e5af01079d31a2b40bf6de1f025d851d722dae4fc0`.
- Provenance-corrected v2 SHA: `a90bf96b0b5e9a1e9e2640ed6f9a99e99a2024f4076b0dc25ed46604f3e1e936`. Geometry/candidate bytes unchanged. v2 restores original exact asset/source identifiers for 310 held rows and rechecks all 5,600 source/asset hashes.
- Independent source-family review: `deleg_ead8e566`, bounded acceptance of closed, visibly labelled table bands; all 2,777 candidate-image hashes verified; no demonstrated candidate ownership counterexample.
- All 2,007 original canonical-production answers were fully downloaded through the entitled asset signer. Exact storage key and SHA match original pinned assets. Readback SHA: `a24f4136b86a8692268daf91c544953590a617447a7bec16d55b35b77b4f1d72`.
- 2,777 logical image refs deduplicated within bank to 2,732 immutable objects (43,308,218 bytes). Legacy free-preview and premium paths can use different providers (Supabase and R2); both must have the repaired objects before switching runtime mappings.

## Method and proof scope

The detector derives the Question column and full table width, including Guidance, from dark original PDF vectors and printed headers. It merges per-column horizontal border segments before cutting. Every authorized band has one explicit printed question owner, and every detected numbered owner is covered exactly once. Unlabelled continuation bands stay held; their preceding question is not cleared by inherited ownership. Candidate source clips cover all assigned source-band content and reject foreign-band words. Adjacent owned bands on the same page are merged; separate source pages remain separate intact answer images.

Real before/after samples restore 0580 June 2022 Paper 31 Q5's reflection criterion, November 2023 Paper 31 Q9(d), November 2025 Paper 12 Q12(b), and 0606 March 2016 Paper 22 Q5's marking guidance. A June 2021 Paper 11 Q22 sample removes the proven excess outer white tail. Diagrams and answer guidance in these sampled source bands remain intact.

## Release gates and current state

Source tests and 21 targeted application/coexistence tests passed. The new projection validates exact original path arrays, ordered digest-bound replacement paths, nonempty arrays, immutable namespace and unique replacement assets. All 428 held IDs keep their original paths. Sealed raw runtime and existing Biology/science repair maps remain unchanged.

**Not deployed yet.** Required before claiming release: production build/typecheck/lint/index differential; create-only upload to both required providers plus full byte GET readback; actual browser-exporter candidate PDF verification; bounded application review; merge/deployment readback; live viewer/signer/index/PDF readback. Do not treat old-original readback as verification of newly uploaded objects.
