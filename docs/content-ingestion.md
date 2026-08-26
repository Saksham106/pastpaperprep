# Content ingestion runbook

Updated: 26 August 2026

This is the operational source of truth for adding or rebuilding PastPaperPrep question banks. It was reconstructed from the three private source repositories, their tests and build scripts, the initial ingestion history on Swati's agent, and the current production application. The checked-in code and manifests win if this document ever drifts.

## Current verified baseline

| Bank | Source repository | Papers | Questions | Referenced WebP assets |
| --- | --- | ---: | ---: | ---: |
| Cambridge IGCSE Mathematics 0580 | `Saksham106/igcse-0580-topic-practice` | 147 | 2,684 | 5,368 |
| IB Mathematics HL / AA HL | `Saksham106/ib-maths-aa-hl-topic-practice` | 104 | 841 | 3,022 |
| IB Mathematics SL / AA SL | `Saksham106/ib-maths-aa-topic-finder` | 62 | 578 | 1,463 |
| IB Mathematics AI HL | `Saksham106/ib-maths-ai-hl-topic-practice` | 48 | 409 | 1,353 |
| IB Mathematics AI SL | `Saksham106/ib-maths-ai-sl-topic-practice` | 38 | 334 | 1,002 |
| **Total** |  | **399** | **4,846** | **12,208** |

The application copies each source bank's generated `site/data/questions.json` to:

- `src/data/raw/igcse.json`
- `src/data/raw/ib-hl.json`
- `src/data/raw/ib-sl.json`
- `src/data/raw/ib-ai-hl.json`
- `src/data/raw/ib-ai-sl.json`

The WebPs live in the private Supabase Storage bucket `question-assets`, under the bank prefixes `igcse/`, `ib-hl/`, `ib-sl/`, `ib-ai-hl/`, and `ib-ai-sl/`. The two AI banks were built but their assets are not yet uploaded; run the uploader for them before enabling paid access (see "AI banks pending steps" below).

## Non-negotiable rules

1. **The rendered source crop is authoritative.** Extracted text is for search and accessibility and may flatten mathematical notation.
2. **Keep raw PDFs private and out of Git.** Every source repository ignores `data/raw/` and extraction caches.
3. **Use a reviewed source manifest.** Do not let a crawler invent production records directly from a listing page.
4. **Acquire only allow-listed HTTPS PDF URLs.** Revalidate redirects, check the `%PDF-` signature, limit file size, and constrain every output path.
5. **Use deterministic IDs.** A question ID must remain stable when text, labels, or crops are rebuilt.
6. **Treat question and mark-scheme images as a pair.** Fail closed if question numbering, crop ownership, or per-paper mark totals disagree.
7. **Classification is syllabus-constrained and evidence-backed.** Rules may generate candidates; ambiguous records go into the durable manual-review overlay.
8. **Never silently publish generated answers as official.** Official mark-scheme crops are labelled official. Reconstructions and independent solutions are labelled as such.
9. **Do not expose source PDFs or private Storage paths to locked clients.** PastPaperPrep resolves canonical question IDs to trusted paths on the server.
10. **Do not assume an upload rerun replaces a corrected asset.** The current uploader uses `x-upsert: false` and treats duplicate keys as existing. A corrected file at an existing key needs an explicit reviewed replacement and hash verification.

## Repository roles

The three source repositories are the ingestion workspaces. They contain:

- reviewed source manifests;
- acquisition, crop, transcript, classification, build, and validation scripts;
- manual classification overlays;
- generated runtime JSON;
- generated WebP question and mark-scheme crops;
- bank-specific tests.

The private `Saksham106/pastpaperprep` repository is the commercial application. It should receive only normalized runtime JSON and derived WebPs, never the raw paper corpus or ad-hoc extraction artifacts.

The old GitHub Pages sites are no longer the delivery layer. Their URL roots remain in `src/lib/assets.ts` only so historical relative asset paths can be deterministically mapped to private Storage object keys.

## Recommended workspace

The existing upload script expects this exact temporary layout:

```text
/tmp/pastpaperprep-sources/
  igcse/
  ib-hl/
  ib-sl/
```

Clone the private repositories:

```bash
rm -rf /tmp/pastpaperprep-sources
mkdir -p /tmp/pastpaperprep-sources
gh repo clone Saksham106/igcse-0580-topic-practice /tmp/pastpaperprep-sources/igcse
gh repo clone Saksham106/ib-maths-aa-hl-topic-practice /tmp/pastpaperprep-sources/ib-hl
gh repo clone Saksham106/ib-maths-aa-topic-finder /tmp/pastpaperprep-sources/ib-sl
```

Use Python 3.11+, [`uv`](https://github.com/astral-sh/uv), Node.js, PyMuPDF, Pillow, and, for the SL crop pipeline, NumPy. The source repositories' commands install transient Python dependencies through `uv`; do not add packages to the Next.js application unless its runtime actually needs them.

## End-to-end pipeline

### 1. Define coverage and provenance

Before downloading anything, update the bank's source manifest with:

- canonical paper ID;
- qualification/course era;
- year and session;
- paper/component/time zone/option;
- question-paper URL;
- mark-scheme URL when one exists;
- independent fallback source where the bank requires it;
- known cancellation, reconstruction, or publication status.

The manifest is a reviewed inventory, not a scrape cache. Confirm the expected paper count before acquisition.

Current source policies:

- IGCSE uses verified Best Exam Help or Exam Easy sources with PapaCambridge as an independent fallback.
- IB uses exact IB Docs PDF records from the reviewed manifest.
- IGCSE May/June 2020 released papers are retained but marked as cancelled-examination releases.
- IB May 2020 is excluded because the examinations were cancelled.
- Some 2026 IB papers have no official mark schemes. Those records use clearly labelled independent solutions or reviewed reconstructions rather than pretending an official answer exists.

### 2. Acquire raw PDFs safely

#### IGCSE

```bash
cd /tmp/pastpaperprep-sources/igcse
python -m src.acquisition --year 2026 --paper 2
```

Omit the filters only after a small slice succeeds. The acquirer fetches a complete question-paper/mark-scheme pair before atomically committing either file.

#### IB HL

```bash
cd /tmp/pastpaperprep-sources/ib-hl
uv run --with pymupdf python scripts/acquire_manifest.py
```

#### IB SL

Use the reviewed `data/source-manifest-*.json` files and the bank's `scripts/acquire_manifest.py`. Keep 2017–2021, 2022–2025, and 2026 source groups separate because their layouts and mark-scheme availability differ.

After acquisition, verify that every expected file is a non-empty, decodable PDF. Never commit `data/raw/`.

### 3. Detect question boundaries and render crops

The pipelines use PDF text geometry first, not free-form OCR:

- detect sequential top-level question headings;
- detect mark-scheme question rows after the actual criteria table;
- assign multi-page continuation regions to the owning question;
- remove headers, footers, answer-booklet areas, and blank slivers;
- render at a fixed scale/DPI;
- write WebP atomically;
- decode the finished file and record a SHA-256 digest;
- reuse an existing crop only when the recorded mapping and digest still match.

#### IGCSE

```bash
cd /tmp/pastpaperprep-sources/igcse
uv run python scripts/build_crops.py --force --workers 8
uv run python scripts/normalize_papers_from_sources.py
```

`data/crop-boundary-overrides.json` is the reviewed exception list for broken or missing PDF text-layer headings. Keep exceptions explicit; do not weaken the global detector to accommodate one malformed paper.

#### IB HL

```bash
cd /tmp/pastpaperprep-sources/ib-hl
uv run --with pymupdf --with pillow python scripts/normalize_and_build_crops.py
```

#### IB SL

```bash
cd /tmp/pastpaperprep-sources/ib-sl
uv run --with pillow python scripts/build_verified_reconstructions.py
uv run --with pymupdf --with pillow --with numpy python scripts/build_question_crops.py
uv run --with pymupdf --with pillow python scripts/build_markscheme_crops.py
```

The SL crop code includes bounded handling for recovered pages and red-ink removal. Do not apply those transformations globally to clean official PDFs.

### 4. Build the searchable transcript

Use PyMuPDF blocks/words clipped to the exact crop bounds. Clean page furniture and corrupt private-use glyphs, but preserve the original crop as the display authority.

Reject a record when:

- the transcript is implausibly short;
- printed marks cannot be recovered where the bank requires them;
- question numbers are non-sequential;
- question marks do not sum to the paper maximum;
- a source page or crop mapping is missing.

Do not rewrite the question from an LLM summary. That caused the original prototype to display a paraphrase instead of the exact exam question. The fix was image-first delivery with transcripts collapsed and explicitly secondary.

### 5. Classify against the official syllabus

The current architecture is deliberately hybrid:

1. A versioned, controlled syllabus taxonomy defines valid topics and skills.
2. High-precision math-aware rules generate evidence-backed candidates.
3. Question text is primary evidence; official mark-scheme text may disambiguate method.
4. Generic marking prose is not evidence.
5. Low-confidence or conflicting records are manually adjudicated using the question crop, diagram, and answer evidence.
6. Manual decisions are stored by canonical question ID in `data/classification-manual-reviews.json` and reapplied on every rebuild.
7. The generated classification manifest must cover every question exactly once or the build fails.

Current durable manual-review overlays contain:

- IGCSE: 339 records;
- IB HL: 282 records;
- IB SL: 331 records.

Do not replace this with an unconstrained LLM batch. At this scale, plausible wrong labels are worse than an explicit review queue.

#### IGCSE

```bash
cd /tmp/pastpaperprep-sources/igcse
uv run python scripts/build_classification_manifest.py
```

#### IB HL

```bash
cd /tmp/pastpaperprep-sources/ib-hl
uv run --with pymupdf --with pillow python scripts/classify_questions.py
```

#### IB SL

```bash
cd /tmp/pastpaperprep-sources/ib-sl
python3 scripts/build_classification_manifest.py
```

### 6. Build and validate each bank

#### IGCSE

```bash
cd /tmp/pastpaperprep-sources/igcse
uv run python scripts/build_data.py
uv run python scripts/validate_bank.py
uv run pytest -q
node --check site/app.js
node tests/pdf_export_smoke.js
```

#### IB HL

```bash
cd /tmp/pastpaperprep-sources/ib-hl
uv run --with pytest --with pymupdf --with pillow pytest -q
uv run --with pymupdf --with pillow python scripts/build_data.py
uv run --with pymupdf --with pillow python scripts/validate_bank.py
node --check site/app.js
node tests/pdf_export_smoke.js
```

#### IB SL

```bash
cd /tmp/pastpaperprep-sources/ib-sl
python3 scripts/build_data.py
python3 scripts/validate_bank.py
uv run --with pytest --with pymupdf --with pillow --with numpy pytest -q
node --check site/app.js
node tests/pdf_export_smoke.js
```

The expected outputs are each repository's `site/data/questions.json` plus WebPs under `site/questions/` and `site/markschemes/`.

### 7. Import normalized metadata into PastPaperPrep

From the PastPaperPrep repository root:

```bash
cp /tmp/pastpaperprep-sources/igcse/site/data/questions.json src/data/raw/igcse.json
cp /tmp/pastpaperprep-sources/ib-hl/site/data/questions.json src/data/raw/ib-hl.json
cp /tmp/pastpaperprep-sources/ib-sl/site/data/questions.json src/data/raw/ib-sl.json
```

Then verify the canonical totals before touching Storage:

```bash
node - <<'NODE'
const fs = require('node:fs');
const banks = ['igcse', 'ib-hl', 'ib-sl'];
let questions = 0;
let papers = 0;
let assets = 0;
for (const bank of banks) {
  const data = JSON.parse(fs.readFileSync(`src/data/raw/${bank}.json`, 'utf8'));
  const refs = data.questions.flatMap((question) => [
    ...(question.questionImages || []),
    ...(question.markschemeImages || []),
    ...((question.officialMarkscheme || {}).images || []),
  ]);
  const uniqueRefs = new Set(refs);
  if (uniqueRefs.size !== refs.length) throw new Error(`${bank}: duplicate asset references`);
  console.log(bank, { papers: data.papers.length, questions: data.questions.length, assets: refs.length });
  questions += data.questions.length;
  papers += data.papers.length;
  assets += refs.length;
}
console.log({ papers, questions, assets });
NODE
```

For the current corpus, this must report 313 papers, 4,103 questions, and 9,853 unique referenced assets. A changed corpus should have an explicitly reviewed new baseline rather than forcing these old numbers.

### 8. Upload private assets

The uploader reads only `.webp` files under the three temporary source roots and maps them to `<bank>/<relative-path>` in the private bucket.

Set the server-only values in the shell without printing them, then run:

```bash
SUPABASE_URL='https://PROJECT.supabase.co' \
SUPABASE_SECRET_KEY='sb_secret_REDACTED' \
SUPABASE_STORAGE_BUCKET='question-assets' \
UPLOAD_CONCURRENCY=16 \
node scripts/upload-question-assets.mjs
```

Operational behavior:

- host and secret-key shape are validated before upload;
- object keys are derived from owned local roots;
- only WebPs are uploaded;
- uploads are bounded by `UPLOAD_CONCURRENCY`;
- existing objects are skipped;
- any non-duplicate failure exits non-zero.

Never paste real credentials into documentation, command history shared with others, Git, or chat. Production secrets belong in the provider dashboard or an ignored local environment.

For a corrected asset that keeps the same key, the standard uploader will skip it. Use a separate, reviewed replacement operation, verify the remote object hash/content, then exercise the exact question and answer through the signed-URL API before release.

### 9. Verify the commercial application

Run the application gates:

```bash
npm run test
npm run lint
npm run build
git diff --check
npm audit --omit=dev
```

Then perform targeted QA before deployment:

- every bank count and filter count is correct;
- exactly three deterministic previews remain per bank;
- locked payloads contain no premium transcript, answer, source URL, or Storage path;
- a paid user can open question and answer assets;
- a solution-only answer still exports and consumes PDF quota;
- multi-page questions and mark schemes preserve page order;
- PDF questions, answers, and combined modes render correctly;
- source links point to the correct complete paper and page;
- a corrected Storage object is actually the new file, not a skipped duplicate;
- download and signing quotas still fail closed.

## Resuming a failed run

1. Do not delete the raw corpus first.
2. Read the last successful manifest/report and identify the first missing or invalid paper.
3. Re-run acquisition for that paper/year slice.
4. Re-run crop generation without `--force` when the bank supports digest-based reuse.
5. Use `--force` only for reviewed source/boundary changes.
6. Rebuild classification; the manual overlay will be reapplied.
7. Rebuild runtime JSON and run the full bank validator.
8. Compare counts, IDs, asset references, and hashes before copying into PastPaperPrep.
9. Upload only after local validation passes.

Atomic writes and digest checks make most stages resumable. A partial output is not a valid bank merely because the script produced some files.

## Adding a new bank

Do not start by editing the Next.js UI. First create a source repository with:

- `data/source-manifest.json`;
- ignored `data/raw/` and extraction directories;
- deterministic paper/question ID rules;
- safe acquisition with host allow-listing and path containment;
- source-faithful crop generation;
- transcript extraction;
- official, versioned taxonomy;
- durable manual-review overlay;
- fail-closed runtime builder and validator;
- tests for known layout and classification edge cases.

Only after the bank validates independently should you add its slug/config to PastPaperPrep, import its normalized JSON, upload assets under a new Storage prefix, add product entitlements, and update preview fixtures and access tests.

## AI banks (added August 2026)

The AI SL and AI HL banks reuse the IB-HL pipeline end to end. Working copies:
`git@github.com:Saksham106/ib-maths-ai-hl-topic-practice.git` and
`git@github.com:Saksham106/ib-maths-ai-sl-topic-practice.git`.

Coverage decisions made during the build:

- Sessions: May + November 2021–2025, every paper with its official markscheme.
- The extra May-2023 time-zone papers ("More Papers M23") have no official markschemes and are excluded.
- May 2026 AI papers exist as scans without official markschemes; they follow the 2026 independent-solution
  policy only if a reviewed reconstruction is prepared first. They are not in the current corpus.
- Taxonomy: five guide topics; SL carries the SL subtopic vocabulary, HL adds the AHL-only extensions
  (graph theory, Markov chains, complex numbers, matrices/eigenvalues, Poisson, further calculus,
  differential equations). Both live in `data/classification-taxonomy.json` per repo and mirror into
  `src/lib/taxonomy.ts` in the application.
- Classification: rule pass plus a durable manual-review overlay (118 HL / 159 SL records) applied on
  every rebuild. Confidence is fail-closed; unresolved records block `build_data`.

Pipeline commands match "#### IB HL" above, run inside each AI repository.

### AI banks pending steps

1. Upload assets: point the uploader at `/tmp/pastpaperprep-sources/ai-hl/site` and
   `/tmp/pastpaperprep-sources/ai-sl/site` (or re-clone from the new repos), producing keys under
   `ib-ai-hl/` and `ib-ai-sl/`.
2. Apply migration `20260826220000_add_ib_maths_ai_banks.sql` in Supabase.
3. Create Stripe prices for `bank_ib_ai_hl` / `bank_ib_ai_sl` if selling separately; `bundle_all` already covers them.
4. Review, merge, deploy, then verify counts: AI HL 48 papers / 409 questions / 1,353 assets;
   AI SL 38 papers / 334 questions / 1,002 assets.

## Open-source tools worth using

The existing custom pipeline already solves the important domain-specific work: exact exam-question boundaries, mark-scheme ownership, deterministic IDs, syllabus classification, manual review, and fail-closed validation. Do not replace it with a generic document-AI stack for novelty.

| Repository | Best use here | Decision |
| --- | --- | --- |
| [PyMuPDF](https://github.com/pymupdf/PyMuPDF) | Fast PDF text geometry, page rendering, clipping, and block/word coordinates | **Keep as the core parser/renderer.** Review its AGPL/commercial licensing before distributing ingestion tooling outside the private operator workflow. |
| [OCRmyPDF](https://github.com/ocrmypdf/OCRmyPDF) | Add a searchable Tesseract text layer to genuinely scanned PDFs | **Adopt as an optional pre-processing fallback**, not for clean born-digital papers. MPL-2.0. |
| [PaddleOCR](https://github.com/PaddlePaddle/PaddleOCR) | OCR/layout recovery for damaged scans and difficult multilingual pages | **Spike on known failures only.** Apache-2.0; heavier and more likely than geometry-based extraction to alter math. |
| [Marker](https://github.com/datalab-to/marker) | PDF-to-Markdown/JSON extraction for transcript comparison | **Useful as a secondary cross-check**, never as the authoritative question renderer. Apache-2.0. |
| [Docling](https://github.com/docling-project/docling) | Structured document conversion and layout inspection | **Optional evaluation tool** for future mixed document sources. MIT; unnecessary for the current clean exam corpus. |
| [HURIDOCS PDF Document Layout Analysis](https://github.com/huridocs/pdf-document-layout-analysis) | Dockerized page-region segmentation and formula/table extraction | **Do not add now.** It may help a future hostile-layout corpus, but it is infrastructure-heavy compared with the current deterministic scripts. Apache-2.0. |
| [MinerU](https://github.com/opendatalab/MinerU) | Broad PDF-to-structured-data experimentation | **Hold.** Its GitHub license metadata is not explicit enough for casual adoption, and the stack is overkill for this workflow. |

The right near-term improvement is **OCRmyPDF as a bounded fallback plus a regression corpus of malformed scans**. Everything else should earn adoption by outperforming the current pipeline on known failures without changing crop ownership, math fidelity, or deterministic output.

## Known failure modes

- A keyword classifier matched `sin` inside `using`, massively over-labelling trigonometry. Use mathematical boundaries and regression tests.
- Generated summaries were presented as the question itself. Keep source images primary.
- A malformed PDF text layer hid a question heading. Add a reviewed per-paper boundary override.
- A question continued onto another page and the next heading captured its tail. Validate physical reading order and continuation ownership.
- A generic mark-scheme instruction page looked like question rows. Start only after the real criteria table/complete sequence.
- Candidate handwriting appeared in a 2026 scan. Clean/reconstruct only with explicit labelling and review.
- An upload rerun found duplicate object keys and skipped them. Verify replacements instead of trusting the progress counter.
- Classifications looked complete but used stale or partial IDs. Require exact manifest/runtime ID equality.

## What not to do

- Do not scrape and publish whatever a listing page currently returns.
- Do not use OCR/LLM text as the visual source of truth for equations.
- Do not let an LLM assign unrestricted labels.
- Do not bury ambiguous classifications under a default topic.
- Do not commit raw PDFs or secrets.
- Do not upload browser-supplied paths.
- Do not weaken global validation to accommodate one broken paper.
- Do not adopt a large document-AI platform until a measured failure case justifies it.
