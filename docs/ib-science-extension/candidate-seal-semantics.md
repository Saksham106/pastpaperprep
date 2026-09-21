# IB science candidate seal

`candidate-seal.json` uses `ib-science-candidate-seal.v2` and seals the immutable candidate content, not a Git commit. `contentFiles` is the explicit ordered set of generated runtime, private-index, storage-manifest, and source-receipt artifacts. Each entry records its SHA-256; `contentSha256` is the SHA-256 of the canonical JSON manifest.

This semantics is stable after the seal commit: committing the seal changes neither the sealed content files nor their digest, and rerunning generation does not point the seal at its own future commit. Validate it with `npm run validate:ib-science-extension-candidate`.
