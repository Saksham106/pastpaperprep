#!/usr/bin/env node
// Adds the 20 questions of the three IB Chemistry HL 2019 Paper 2s (May TZ1, May TZ2, November) to the HL bank.
// The 2016-2019 extension excluded them as "store-truncation"; the pinned PDFs are complete
// (docs/ib-chemistry-hl-2019-p2.md). Their papers are already in the runtime; only the questions are added.
//
//   node scripts/add-ib-chemistry-hl-2019-p2.mjs [--check]
//
// Inputs, pinned by SHA-256: the source lane's paper files and crop maps (ib-chemistry-topic-practice at
// SOURCE_COMMIT; override the checkout with PASTPAPERPREP_IB_CHEMISTRY_SOURCE_ROOT) and every crop, plus the
// adjudicated labels in docs/audits/ib-chemistry-hl-2019-p2-review.json. The baseline is read from BASE_COMMIT
// with `git show`, so every earlier row, paper and header field is provably unchanged: the rows are appended
// after the May 2026 rows and recorded in `hl2019Paper2Release`. Rows take the shape of the 2016-2019
// extension rows (scripts/generate-ib-science-extension-candidate.mjs `normalize`). Also writes the
// private R2 upload plan for the 129 new crops. No network, no uploads.
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const check = process.argv.includes("--check");
const BANK = "ib-chemistry-hl";
const BASE_COMMIT = "2c97487457c6153fef743f7e162fb2d1f32d1432";
const SOURCE_COMMIT = "2eb267c32622dd6d53b30f36dfe43264a600c5ed";
const PAPERS = ["2019-may-tz1-hl-p2", "2019-may-tz2-hl-p2", "2019-november-tz0-hl-p2"];
const SOURCE_PINS = {
  "data/papers-extension/2019-may-tz1-hl-p2.json": "a2163c8278b879e44321a75e04bfc7fc36b35347b9b272d17d44458ef241820b",
  "data/papers-extension/2019-may-tz2-hl-p2.json": "6c52325a640617e6b30d4015197843451a594e339bc8b4984225482135ff9410",
  "data/papers-extension/2019-november-tz0-hl-p2.json": "00a1f2a728d60f725f6c4da71f4dce590b3721c414e35e027b4f09e34ce379f5",
  "data/segmentation-extension/question-images.json": "ef59247038e977ca2f35f6d46ac900ba0a4e7ab190572ba8322868b3c69cd7eb",
  "data/segmentation-extension/official-markscheme-images.json": "42a47611a618e6718f9a2893298a91cb18251a8f39740338db9ecaa6e8339b83",
  "data/classification-taxonomy.json": "98304b2aa38eb2c082ad2c8510ddd85c108311e950cf93d598e64a1a9d756d30",
};
const PUBLIC_ROOT = "https://saksham106.github.io/ib-chemistry-topic-practice/";
const LABELS_PATH = "docs/audits/ib-chemistry-hl-2019-p2-review.json";
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");

function workspaceRoot() {
  const common = execFileSync("git", ["-C", root, "rev-parse", "--path-format=absolute", "--git-common-dir"], { encoding: "utf8" }).trim();
  return resolve(dirname(common), "..");
}
const sourceRoot = process.env.PASTPAPERPREP_IB_CHEMISTRY_SOURCE_ROOT
  ? resolve(process.env.PASTPAPERPREP_IB_CHEMISTRY_SOURCE_ROOT)
  : join(workspaceRoot(), "ib-chemistry-topic-practice");
const sourceJson = (path) => {
  const bytes = readFileSync(join(sourceRoot, path));
  if (sha(bytes) !== SOURCE_PINS[path]) throw new Error(`Source hash drift: ${path}`);
  return JSON.parse(bytes);
};

const taxonomy = sourceJson("data/classification-taxonomy.json");
const topics = new Map(taxonomy.normalized_topics.map((t) => [t.id, t]));
const subtopics = new Map(taxonomy.normalized_topics.flatMap((t) => t.subtopics.map((s) => [s.id, { ...s, topicId: t.id }])));
const skillIds = new Set(taxonomy.skills.map((s) => s.id ?? s));
const aoIds = new Set(taxonomy.assessment_objectives.map((a) => a.id ?? a));
const qMap = sourceJson("data/segmentation-extension/question-images.json");
const mMap = sourceJson("data/segmentation-extension/official-markscheme-images.json");
const labels = JSON.parse(readFileSync(join(root, LABELS_PATH), "utf8"));
// May TZ2's mark-scheme pages are stored rotated, and the source lane cut them unrotated; its crops are
// replaced by reviewed re-cuts kept in research/ (docs/ib-chemistry-hl-2019-p2/tz2-markscheme-recrops.json).
const RECROPS = JSON.parse(readFileSync(join(root, "docs/ib-chemistry-hl-2019-p2/tz2-markscheme-recrops.json"), "utf8"));
const recropRoot = join(workspaceRoot(), RECROPS.researchDir);
const labelById = new Map(labels.rows.map((row) => [row.id, row]));

const baseText = execFileSync("git", ["-C", root, "show", `${BASE_COMMIT}:src/data/raw/${BANK}.json`], { maxBuffer: 200_000_000 }).toString("utf8");
const base = JSON.parse(baseText);
if (`${JSON.stringify(base)}\n` !== baseText) throw new Error("Baseline is not canonical JSON");
if (base.hl2019Paper2Release) throw new Error("Baseline already contains the 2019 Paper 2 rows");
const existingIds = new Set(base.questions.map((q) => q.id));
const papersById = new Map(base.papers.map((p) => [p.id, p]));

const uploads = new Map();
async function crops(paths, kind, questionId) {
  const recut = kind === "markscheme" ? RECROPS.questions[questionId] : undefined;
  const files = recut
    ? recut.images.map((image) => ({ rel: image.path, abs: join(recropRoot, image.path), source: `${RECROPS.researchDir}/${image.path}`, expected: image.sha256 }))
    : paths.map((rel) => ({ rel, abs: join(sourceRoot, "site-extension", rel), source: `ib-chemistry-topic-practice/site-extension/${rel}` }));
  const urls = [];
  for (const { rel, abs, source, expected } of files) {
    if (!rel.startsWith(`${kind === "question" ? "questions" : "markschemes"}/2019-`)) throw new Error(`Unexpected crop path ${rel}`);
    const bytes = readFileSync(abs);
    if (expected && sha(bytes) !== expected) throw new Error(`Re-cut crop hash drift ${rel}`);
    const meta = await sharp(bytes).metadata();
    if (meta.format !== "webp" || !meta.width || !meta.height) throw new Error(`Invalid crop ${rel}`);
    const key = `${BANK}/${rel}`;
    const entry = uploads.get(key) ?? { key, kind, sourcePath: source, sha256: sha(bytes), md5: createHash("md5").update(bytes).digest("hex"), bytes: bytes.byteLength, width: meta.width, height: meta.height, questionIds: [] };
    if (entry.sha256 !== sha(bytes)) throw new Error(`Crop changed during build ${rel}`);
    entry.questionIds.push(questionId);
    uploads.set(key, entry);
    urls.push(`${PUBLIC_ROOT}${rel}`);
  }
  return urls;
}

const added = [];
for (const paperId of PAPERS) {
  const source = sourceJson(`data/papers-extension/${paperId}.json`);
  const p = source.paper;
  const paper = papersById.get(paperId);
  if (!paper) throw new Error(`${paperId} is not in the runtime`);
  if (source.questions.reduce((sum, q) => sum + q.marks, 0) !== 90) throw new Error(`${paperId}: marks do not sum to 90`);
  for (const q of source.questions) {
    if (existingIds.has(q.id)) throw new Error(`Duplicate question id ${q.id}`);
    const label = labelById.get(q.id);
    if (!label) throw new Error(`No adjudicated label for ${q.id}`);
    const primary = subtopics.get(label.primary_subtopic_id);
    if (!primary || primary.topicId !== label.primary_topic_id) throw new Error(`${q.id}: unknown primary ${label.primary_topic_id}/${label.primary_subtopic_id}`);
    for (const id of label.secondary_subtopic_ids) if (!subtopics.has(id)) throw new Error(`${q.id}: unknown secondary ${id}`);
    for (const id of label.skills) if (!skillIds.has(id)) throw new Error(`${q.id}: unknown skill ${id}`);
    for (const id of label.assessment_objectives) if (!aoIds.has(id)) throw new Error(`${q.id}: unknown assessment objective ${id}`);
    const qm = qMap[q.id], mm = mMap[q.id];
    const questionImages = await crops(qm.images, "question", q.id);
    const markschemeImages = await crops(mm.images, "markscheme", q.id);
    if (RECROPS.questions[q.id] && JSON.stringify(RECROPS.questions[q.id].pages) !== JSON.stringify(mm.pages)) throw new Error(`${q.id}: re-cut pages differ`);
    // Field for field as `normalize` in generate-ib-science-extension-candidate.mjs, which serves the
    // primary subtopic only; secondaries stay in the review manifest, as for every other extension row.
    added.push({
      accessibleText: q.accessible_text,
      assessmentObjectives: label.assessment_objectives,
      classificationConfidence: label.confidence,
      classificationEvidence: { sourceCommit: SOURCE_COMMIT, method: "reviewed_reinclusion_2026_10_21", summary: label.evidence },
      classificationReviewStatus: "classified",
      classificationVersion: "ib-chemistry-extension-2016-2019",
      component: "P2",
      course: base.course,
      level: "HL",
      curriculumVersion: "2016",
      displayPages: qm.pages,
      id: q.id,
      imageStatus: "source_extension_verified",
      marks: q.marks,
      markschemeTranscript: q.official_markscheme_text,
      markschemeUrl: p.markscheme_pdf_url,
      number: q.number,
      officialMarkscheme: { images: markschemeImages, pages: mm.pages },
      officialTopicCodes: label.official_topic_codes,
      pages: qm.pages,
      paper: 2,
      pdfUrl: p.question_pdf_url,
      primaryTopic: topics.get(label.primary_topic_id).name,
      questionImages,
      secondaryTopics: [],
      session: p.session,
      skills: label.skills,
      solutionStatus: "Official IB markscheme image with extracted accessible transcript",
      sourceUrl: p.question_pdf_url,
      subject: "Chemistry",
      subtopics: [primary.name],
      summary: q.accessible_text.replace(/\s+/g, " ").trim(),
      timezone: p.timezone,
      viewerAvailable: true,
      year: p.year,
      zone: p.timezone,
      courseEra: "",
    });
  }
}
if (added.length !== 20) throw new Error(`Expected 20 questions, got ${added.length}`);
if (labels.rows.length !== added.length) throw new Error("Label manifest and added rows differ");

// Same key order as the existing extension rows, so the rows read like their siblings.
const template = base.questions.find((q) => q.classificationVersion === "ib-chemistry-extension-2016-2019" && q.component === "P2");
for (const row of added) if (JSON.stringify(Object.keys(row).sort()) !== JSON.stringify(Object.keys(template).sort())) throw new Error(`${row.id}: field set differs from the extension rows`);
const ordered = added.map((row) => Object.fromEntries(Object.keys(template).map((k) => [k, row[k]])));

const next = {
  ...base,
  questions: [...base.questions, ...ordered],
  hl2019Paper2Release: {
    schemaVersion: "ib-chemistry-hl-2019-p2-release.v1",
    source: "2019 May TZ1, May TZ2 and November HL Paper 2 (IB Docs), excluded by the 2016-2019 extension and re-included after review",
    sourceCommit: SOURCE_COMMIT,
    labelsSha256: sha(readFileSync(join(root, LABELS_PATH))),
    baseCommit: BASE_COMMIT,
    baseQuestionCount: base.questions.length,
    addedQuestionCount: ordered.length,
    combinedQuestionCount: base.questions.length + ordered.length,
    addedPaperCount: 0,
  },
};
for (const key of Object.keys(base)) {
  if (key === "questions") continue;
  if (JSON.stringify(next[key]) !== JSON.stringify(base[key])) throw new Error(`Header field changed: ${key}`);
}
base.questions.forEach((q, i) => { if (JSON.stringify(next.questions[i]) !== JSON.stringify(q)) throw new Error(`Row changed: ${q.id}`); });

const text = `${JSON.stringify(next)}\n`;
const plan = {
  schemaVersion: "ib-chemistry-hl-2019-p2-r2-upload-plan.v1",
  bucket: "pastpaperprep-assets",
  mode: "create-only",
  contentType: "image/webp",
  cacheControl: "private, max-age=31536000, immutable",
  sourceCommit: SOURCE_COMMIT,
  objectCount: uploads.size,
  totalBytes: [...uploads.values()].reduce((sum, u) => sum + u.bytes, 0),
  objects: [...uploads.values()].sort((a, b) => a.key.localeCompare(b.key)),
};
const outputs = new Map([
  [`src/data/raw/${BANK}.json`, text],
  [`src/data/production/${BANK}.json`, text],
  ["docs/ib-chemistry-hl-2019-p2/r2-upload-plan.json", `${JSON.stringify(plan, null, 2)}\n`],
]);
let drift = 0;
for (const [path, out] of outputs) {
  const target = join(root, path);
  if (check) {
    let current = "";
    try { current = readFileSync(target, "utf8"); } catch { /* missing */ }
    if (current !== out) { drift++; console.error(`DRIFT ${path}`); }
  } else writeFileSync(target, out);
}
if (check && drift) process.exit(1);
console.log(`${check ? "checked" : "wrote"}: ${ordered.length} rows (bank ${next.questions.length}), ${uploads.size} crops (${plan.totalBytes} bytes), raw ${sha(text).slice(0, 12)}`);
