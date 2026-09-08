# Content ingestion runbook

Updated: 26 August 2026

This is the operational source of truth for adding or rebuilding PastPaperPrep question banks. It was reconstructed from the twelve private source-bank inputs, their tests and build scripts, the initial ingestion history on Swati's agent, and the current production application. The checked-in code and manifests win if this document ever drifts.

## Current verified baseline

| Bank | Source repository | Papers | Questions | Referenced WebP assets |
| --- | --- | ---: | ---: | ---: |
| Cambridge IGCSE Mathematics 0580 | `Saksham106/igcse-0580-topic-practice` | 147 | 2,684 | 5,368 |
| IB Mathematics HL / AA HL | `Saksham106/ib-maths-aa-hl-topic-practice` | 104 | 841 | 3,022 |
| IB Mathematics SL / AA SL | `Saksham106/ib-maths-aa-topic-finder` | 62 | 578 | 1,463 |
| IB Mathematics AI HL | `Saksham106/ib-maths-ai-hl-topic-practice` | 48 | 409 | 1,353 |
| IB Mathematics AI SL | `Saksham106/ib-maths-ai-sl-topic-practice` | 38 | 334 | 1,002 |
| Cambridge IGCSE Additional Mathematics 0606 | `Saksham106/igcse-additional-mathematics-0606-topic-practice` | 145 | 1,633 | 3,266 |
| IB Chemistry HL | `Saksham106/ib-chemistry-topic-practice` | 51 | 1,083 | 3,234 |
| IB Chemistry SL | `Saksham106/ib-chemistry-topic-practice` | 51 | 810 | 2,243 |
| IB Physics HL | `Saksham106/ib-physics-topic-practice` | 51 | 1,111 | 3,109 |
| IB Physics SL | `Saksham106/ib-physics-topic-practice` | 51 | 774 | 2,087 |
| IB Biology HL | `Saksham106/ib-biology-topic-practice` | 51 | 1,139 | 3,107 |
| IB Biology SL | `Saksham106/ib-biology-topic-practice` | 54 | 936 | 2,443 |
| **Total** |  | **853** | **12,332** | **31,697** |

The application copies each source bank's generated `site/data/questions.json` to:

- `src/data/raw/igcse.json`
- `src/data/raw/ib-hl.json`
- `src/data/raw/ib-sl.json`
- `src/data/raw/ib-ai-hl.json`
- `src/data/raw/ib-ai-sl.json`
- `src/data/raw/igcse-additional.json`
- `src/data/raw/ib-chemistry-hl.json`
- `src/data/raw/ib-chemistry-sl.json`
- `src/data/raw/ib-physics-hl.json`
- `src/data/raw/ib-physics-sl.json`
- `src/data/raw/ib-biology-hl.json`
- `src/data/raw/ib-biology-sl.json`

Premium WebPs live in private Cloudflare R2 under bank-specific prefixes. Free preview WebPs remain in the private Supabase Storage bucket `question-assets`. The runtime retention plan is authoritative for that split.

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

The source repositories are the ingestion workspaces. They contain:

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
  igcse-additional/
  ib-hl/
  ib-sl/
  ib-ai-hl/
  ib-ai-sl/
  ib-chemistry/
  ib-physics/
  ib-biology/
```

Clone the private repositories:

```bash
rm -rf /tmp/pastpaperprep-sources
mkdir -p /tmp/pastpaperprep-sources
gh repo clone Saksham106/igcse-0580-topic-practice /tmp/pastpaperprep-sources/igcse
gh repo clone Saksham106/igcse-additional-mathematics-0606-topic-practice /tmp/pastpaperprep-sources/igcse-additional
gh repo clone Saksham106/ib-maths-aa-hl-topic-practice /tmp/pastpaperprep-sources/ib-hl
gh repo clone Saksham106/ib-maths-aa-topic-finder /tmp/pastpaperprep-sources/ib-sl
gh repo clone Saksham106/ib-maths-ai-hl-topic-practice /tmp/pastpaperprep-sources/ib-ai-hl
gh repo clone Saksham106/ib-maths-ai-sl-topic-practice /tmp/pastpaperprep-sources/ib-ai-sl
gh repo clone Saksham106/ib-chemistry-topic-practice /tmp/pastpaperprep-sources/ib-chemistry
gh repo clone Saksham106/ib-physics-topic-practice /tmp/pastpaperprep-sources/ib-physics
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
cp /tmp/pastpaperprep-sources/igcse-additional/site/data/questions.json src/data/raw/igcse-additional.json
cp /tmp/pastpaperprep-sources/ib-hl/site/data/questions.json src/data/raw/ib-hl.json
cp /tmp/pastpaperprep-sources/ib-sl/site/data/questions.json src/data/raw/ib-sl.json
cp /tmp/pastpaperprep-sources/ib-ai-hl/site/data/questions.json src/data/raw/ib-ai-hl.json
cp /tmp/pastpaperprep-sources/ib-ai-sl/site/data/questions.json src/data/raw/ib-ai-sl.json
cp /tmp/pastpaperprep-sources/ib-chemistry/site/data/questions-hl.json src/data/raw/ib-chemistry-hl.json
cp /tmp/pastpaperprep-sources/ib-chemistry/site/data/questions-sl.json src/data/raw/ib-chemistry-sl.json
cp /tmp/pastpaperprep-sources/ib-physics/site/data/questions-hl.json src/data/raw/ib-physics-hl.json
cp /tmp/pastpaperprep-sources/ib-physics/site/data/questions-sl.json src/data/raw/ib-physics-sl.json
cp /tmp/pastpaperprep-sources/ib-biology/site/data/questions-hl.json src/data/raw/ib-biology-hl.json
cp /tmp/pastpaperprep-sources/ib-biology/site/data/questions-sl.json src/data/raw/ib-biology-sl.json
```

Then verify the canonical totals before touching Storage:

```bash
node - <<'NODE'
const fs = require('node:fs');
const banks = ['igcse', 'igcse-additional', 'ib-hl', 'ib-sl', 'ib-ai-hl', 'ib-ai-sl', 'ib-chemistry-hl', 'ib-chemistry-sl', 'ib-physics-hl', 'ib-physics-sl', 'ib-biology-hl', 'ib-biology-sl'];
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

For the current corpus, this must report 853 papers, 12,332 questions, and 31,697 unique bank-prefixed referenced assets. The hybrid retention split is 4,386 Supabase preview objects (including the 2020 Biology, Chemistry, and Physics preview years) and 27,311 premium objects eligible for R2 after production verification.

### 8. Upload private assets

The current storage model is hybrid: premium assets live in the private Cloudflare R2 bucket, while free-preview assets remain in the private Supabase bucket. Start by confirming the reviewed local baseline:

```bash
npm run storage:plan
```

Sync the referenced corpus to R2 with a temporary bucket-scoped write token:

```bash
R2_ACCOUNT_ID='REDACTED' \
R2_BUCKET_NAME='pastpaperprep-assets' \
R2_SYNC_ACCESS_KEY_ID='REDACTED' \
R2_SYNC_SECRET_ACCESS_KEY='REDACTED' \
UPLOAD_CONCURRENCY=16 \
npm run r2:sync

npm run r2:verify
```

The sync derives object keys from runtime JSON references, uploads only referenced WebPs, and verifies the resulting inventory. Shared source roots such as IB Chemistry and the Physics HL/SL source repository are therefore not uploaded twice; every key is bank-prefixed to prevent collisions. Delete the temporary write token immediately after verification; production uses a separate read-only runtime token.

Then add only missing free-preview assets to Supabase:

```bash
NEXT_PUBLIC_SUPABASE_URL='https://PROJECT.supabase.co' \
SUPABASE_SECRET_KEY='sb_secret_REDACTED' \
npm run storage:sync-previews
```

The preview sync is deliberately fail-closed: it uses `upsert: false`, refuses existing size mismatches, uploads no premium objects, never deletes or overwrites objects, and verifies exact byte sizes after the run.

Do not use the legacy `scripts/upload-question-assets.mjs` uploader for current releases. It predates the hybrid R2/Supabase architecture and does not cover every current bank. Likewise, `storage:reconcile --apply` is a destructive migration-only operation requiring its exact confirmation count; it is not part of a normal new-bank release and must be separately reviewed.

Never paste real credentials into documentation, shared command history, Git, or chat. Keep production secrets in the provider dashboard or an ignored local environment.

For a corrected asset that keeps the same key, use a separate reviewed replacement operation, verify the remote object hash/content, then exercise the exact question and answer through the signed-URL API before release.

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
- each bank's reviewed free-year policy unlocks only the intended questions while newer years remain locked;
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

Only after the bank validates independently should you add its slug/config to PastPaperPrep, import its normalized JSON, upload assets under a new Storage prefix, add product entitlements, and update the reviewed free-year policy and access tests.

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

### AI bank release state

- Private assets were uploaded and verified under `ib-ai-hl/` and `ib-ai-sl/`.
- Migration `20260826220000_add_ib_maths_ai_banks.sql` was applied and read back in production.
- `bundle_all` covers both banks; separate Stripe prices are unnecessary unless individual-bank sales are introduced later.
- Verified counts: AI HL 48 papers / 409 questions / 1,353 assets; AI SL 38 papers / 334 questions / 1,002 assets.

## Cambridge IGCSE Additional Mathematics 0606 (added August 2026)

The 0606 source repository covers 145 verified question-paper/mark-scheme pairs from 2016–2025 plus June 2026 components 11, 12, 13, 21, and 22. June 2026 component 23 is explicitly excluded because an official mark scheme was unavailable; do not publish a question-paper-only record.

The bank contains 1,633 questions and 3,266 question/mark-scheme WebPs. Crop generation uses reviewed per-paper overrides only where the PDF text layer cannot reliably expose top-level question or mark-scheme boundaries. A forced deterministic rebuild must reproduce the complete manifests and pass bounded visual samples before release.

Production assets were uploaded and hash-verified under `igcse-additional/questions/` and
`igcse-additional/markschemes/`. Migration `20260826230000_add_igcse_additional_bank.sql`
was applied and read back in production; replay updates the product name without reactivating
a bank that an operator deliberately disabled.

The controlled primary taxonomy is the normalized union of the official [2017–2019](https://www.cambridgeinternational.org/images/203403-2017-2019-syllabus.pdf), [2020–2022](https://www.cambridgeinternational.org/Images/414438-2020-2022-syllabus.pdf), and [2025–2027](https://www.cambridgeinternational.org/Images/662470-2025-2027-syllabus.pdf) Cambridge syllabuses because the bank spans multiple syllabus revisions. It contains: Set language and notation; Functions; Quadratic functions; Indices and surds; Factors of polynomials; Equations, inequalities and graphs; Simultaneous equations; Logarithmic and exponential functions; Straight-line graphs; Coordinate geometry of the circle; Circular measure; Trigonometry; Permutations and combinations; Series (including the historical Binomial expansions topic); Vectors in two dimensions; Matrices; and Calculus (historically Differentiation and integration). Do not force older set, surd, or matrix questions into the current-only taxonomy, and do not substitute the broader 0580 taxonomy. Unresolved classifications block the runtime build.

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
