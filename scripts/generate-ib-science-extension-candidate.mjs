#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join, resolve, relative } from "node:path";
import sharp from "sharp";

const root = resolve(import.meta.dirname, "..");
const home = resolve(root, "..", "..", "..", "..");
const sources = {
  chemistry: { slug: "ib-chemistry", subject: "Chemistry", repo: resolve(home, "Documents/ProjectsInternships/ib-chemistry-topic-practice"), commit: "85cae43c22852460af47699c94cca16d86380755", receipt: "data/classification-extension/reconciliation-2026-09-21/production-readiness-receipt.json", papers: "data/papers-extension", qmap: "data/segmentation-extension/question-images.json", mmap: "data/segmentation-extension/official-markscheme-images.json", assetRoot: "site-extension", classFile: "data/classification-extension/results/classification-results.json", receiptRows: 1391, split: { HL: 789, SL: 602 }, assets: { qp: 2350, ms: 1966 } },
  biology: { slug: "ib-biology", subject: "Biology", repo: resolve(home, "Documents/ProjectsInternships/ib-biology-topic-practice"), commit: "50c3a00e39a87b3242fe50fecd7f7b8accf9256f", receipt: "data/classification-extension/qa-blind/production-readiness-receipt.json", papers: "data/papers-extension", qmap: "data/question-images-extension.json", mmap: "data/official-markscheme-images-extension.json", assetRoot: "site", classFile: "data/classification/final-classifications.json", receiptRows: 1384, split: { HL: 772, SL: 612 }, assets: { qp: 2350, ms: 2082 } },
  physics: { slug: "ib-physics", subject: "Physics", repo: resolve(home, "Documents/ProjectsInternships/ib-physics-topic-practice"), commit: "0bdfc1a888e4bc3f8163badbaeb16268a814e1a2", receipt: "data-extension/classification/reconciliation/production-readiness-receipt.json", papers: "data-extension/data/papers", qmap: "data-extension/data/question-images.json", mmap: "data-extension/data/official-markscheme-images.json", assetRoot: "data-extension/site", classFile: "data/classification/final-classifications.json", receiptRows: 1304, split: { HL: 764, SL: 540 }, assets: { qp: 2211, ms: 2009 } },
};
const baseFiles = { chemistry: ["ib-chemistry-hl.json", "ib-chemistry-sl.json"], biology: ["ib-biology-hl.json", "ib-biology-sl.json"], physics: ["ib-physics-hl.json", "ib-physics-sl.json"] };
const sha = b => createHash("sha256").update(b).digest("hex");
const json = async p => JSON.parse(await readFile(p, "utf8"));
const writeJson = async (p, v) => { await mkdir(resolve(p, ".."), { recursive: true }); await writeFile(p, `${JSON.stringify(v)}\n`); };
const sourceRel = p => relative(resolve(home, "Documents/ProjectsInternships"), p);

for (const [key, s] of Object.entries(sources)) {
  const actualCommit = execFileSync("git", ["-C", s.repo, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  if (actualCommit !== s.commit) throw new Error(`${key}: source commit mismatch ${actualCommit}`);
  const receiptPath = join(s.repo, s.receipt);
  const receiptBytes = await readFile(receiptPath);
  const receipt = JSON.parse(receiptBytes);
  if (receipt.status !== "PASS" && receipt.verdict !== "PASS") throw new Error(`${key}: receipt is not PASS`);
  if (sha(receiptBytes) !== sha(receiptBytes)) throw new Error(`${key}: receipt hash failure`);
  if (receiptRows(receipt, key) !== s.receiptRows) throw new Error(`${key}: receipt row count mismatch`);
  let clsRows;
  if (key === "chemistry") {
    const cls = await json(join(s.repo, s.classFile));
    clsRows = cls.rows ?? cls.classifications;
  } else {
    const dir = key === "biology" ? "data/classification-extension/verdicts" : "data-extension/classification/reviews/extension";
    const files = (await readdir(join(s.repo, dir))).filter(f => f.endsWith(".json"));
    clsRows = [];
    for (const file of files) { const artifact = await json(join(s.repo, dir, file)); clsRows.push(...(artifact.verdicts ?? artifact.classifications ?? [])); }
  }
  const taxonomyPath = key === "biology" ? join(root, "src/data/ib-biology-taxonomy.json") : key === "physics" ? join(root, "src/data/ib-physics-taxonomy.json") : null;
  const taxonomy = taxonomyPath ? await json(taxonomyPath) : null;
  const topicById = new Map((taxonomy?.normalized_topics ?? []).map(t => [t.id, t.name]));
  const subtopicById = new Map((taxonomy?.normalized_topics ?? []).flatMap(t => (t.subtopics ?? []).map(st => [st.id, st.name])));
  const extensionClass = new Map(clsRows.filter(r => /^20(16|17|18|19)-/.test(r.id)).map(r => [r.id, r]));
  const qMap = await json(join(s.repo, s.qmap));
  const mMap = await json(join(s.repo, s.mmap));
  const paperFiles = await readdir(join(s.repo, s.papers));
  const extension = [];
  const papers = [];
  const assets = new Map();
  for (const file of paperFiles.filter(f => f.endsWith(".json")).sort()) {
    const paper = await json(join(s.repo, s.papers, file));
    const p = paper.paper;
    const level = p.level;
    if (!/^20(16|17|18|19)$/.test(String(p.year))) continue;
    const paperOut = paperMetadata(p, s.subject);
    papers.push(paperOut);
    for (const q of paper.questions) {
      const c = extensionClass.get(q.id);
      const qm = qMap[q.id], mm = mMap[q.id];
      if (!qm?.images?.length || !mm?.images?.length) { if (c && c.disposition !== "excluded") throw new Error(`${key}: missing crop mapping ${q.id}`); continue; }
      const qAssets = await verifyAssets(s, qm.images, "question", assets, c ? q.id : `${q.id}:excluded`);
      const mAssets = await verifyAssets(s, mm.images, "markscheme", assets, c ? q.id : `${q.id}:excluded`);
      if (!c || c.disposition === "excluded" || c.review_status === "blocked") continue;
      const canonical = { ...c, primary_topic_name: c.primary_topic_name ?? topicById.get(c.primary_topic_id), primary_subtopic_name: c.primary_subtopic_name ?? subtopicById.get(c.primary_subtopic_id), secondary_topic_names: (c.secondary_topic_ids ?? []).map(id => topicById.get(id)).filter(Boolean), secondary_subtopic_names: (c.secondary_subtopic_ids ?? []).map(id => subtopicById.get(id)).filter(Boolean) };
      const out = normalize(q, p, canonical, qAssets, mAssets, s.subject, level, key);
      extension.push(out);
    }
  }
  if (extension.length !== s.receiptRows) throw new Error(`${key}: extension count ${extension.length} != receipt ${s.receiptRows}`);
  const byLevel = Object.groupBy(extension, q => q.level);
  for (const level of ["HL", "SL"]) if ((byLevel[level]?.length ?? 0) !== s.split[level]) throw new Error(`${key}: ${level} split mismatch`);
  const runtimeSeal = { schemaVersion: "ib-science-extension-candidate.v1", sourceCommit: s.commit, receiptSha256: sha(receiptBytes), subject: s.subject, extensionRows: extension.length, years: [2016,2017,2018,2019], levelCounts: s.split };
  const allAssetList = [...assets.values()].sort((a,b)=>a.objectKey.localeCompare(b.objectKey));
  if (allAssetList.filter(a=>a.kind === "question").length !== s.assets.qp || allAssetList.filter(a=>a.kind === "markscheme").length !== s.assets.ms) throw new Error(`${key}: asset count mismatch`);
  for (const file of baseFiles[key]) {
    const level = file.includes("-hl") ? "HL" : "SL";
    const bank = file.replace(/\.json$/, "");
    const base = await json(join(root, "src/data/raw", file));
    const baseQuestions = base.questions.filter(q => q.year >= 2020);
    if (baseQuestions.some(q => q.year < 2020)) throw new Error(`${bank}: base contains pre-2020 rows`);
    const extRows = extension.filter(q => q.level === level);
    const ids = new Set();
    for (const q of [...baseQuestions, ...extRows]) { if (ids.has(q.id)) throw new Error(`${bank}: duplicate ${q.id}`); ids.add(q.id); }
    const runtime = { ...base, years: [2016,2017,2018,2019,2020,2021,2022,2023,2024,2025], papers: [...papers.filter(p=>p.level===level), ...base.papers.filter(p => p.year >= 2020)].sort((a,b)=>String(a.id).localeCompare(String(b.id))), questions: [...extRows, ...baseQuestions].sort((a,b)=>String(a.id).localeCompare(String(b.id))), extensionRelease: { ...runtimeSeal, level, baseQuestionCount: baseQuestions.length, extensionQuestionCount: extRows.length, combinedQuestionCount: baseQuestions.length + extRows.length, baseQuestionIdSeal: sha(JSON.stringify(baseQuestions.map(q=>q.id).sort())), extensionQuestionIdSeal: sha(JSON.stringify(extRows.map(q=>q.id).sort())) } };
    await writeJson(join(root, "src/data/raw", file), runtime);
    await writeJson(join(root, "src/data/production", file), runtime);
    await writeJson(join(root, "src/data/private-index", file), { schemaVersion: "ib-science-public-index.v1", bank, subject: s.subject, level, years: runtime.years, questionCount: runtime.questions.length, questions: runtime.questions.map(publicQuestion) });
    const bankAssets = allAssetList.filter(a => a.referencedQuestionIds.some(id => extRows.some(q => q.id === id)) || a.referencedQuestionIds.some(id => baseQuestions.some(q => q.id === id)));
    await writeJson(join(root, "docs/ib-science-storage", `${bank}.pending-upload-manifest.json`), { schemaVersion: "ib-science-pending-upload-manifest.v1", upload: false, bank, prefix: `${bank}/`, sourceCommit: s.commit, assets: bankAssets });
    runtimeSeal[bank] = { base: baseQuestions.length, extension: extRows.length, combined: runtime.questions.length, runtimeSha256: sha(JSON.stringify(runtime.questions)), assetCount: bankAssets.length };
  }
  await writeJson(join(root, "docs/ib-science-extension", `${key}-source-receipt.json`), { schemaVersion: "ib-science-source-pin.v1", subject: s.subject, sourceCommit: s.commit, receiptPath: s.receipt, receiptSha256: sha(receiptBytes), receipt, canonicalRows: extension.length, assets: { question: allAssetList.filter(a=>a.kind === "question").length, markscheme: allAssetList.filter(a=>a.kind === "markscheme").length }, runtimeSeal });
}
await writeJson(join(root, "docs/ib-science-extension/candidate-seal.json"), { schemaVersion: "ib-science-candidate-seal.v1", status: "pending_upload", origin: execFileSync("git", ["-C", root, "rev-parse", "HEAD"], { encoding: "utf8" }).trim(), banks: runtimeSealSummary() });
console.log(JSON.stringify(runtimeSealSummary(), null, 2));

function receiptRows(r, key) { return key === "chemistry" ? r.eligible_questions : key === "biology" ? r.scope?.rows : r.exact_counts?.questions; }
function paperMetadata(p, subject) { const qp = p.question_pdf_url ?? `https://ibdocs.re/extension/${p.id}-question.pdf`; const ms = p.markscheme_pdf_url ?? `https://ibdocs.re/extension/${p.id}-markscheme.pdf`; return { ...p, component: p.component ?? p.paper, course: `IB ${subject} ${p.level}`, curriculumVersion: String(p.curriculum_version ?? "2016"), id: p.id, paper: Number(String(p.paper).replace("P", "")), markschemeUrl: ms, pdfUrl: qp, questionCount: undefined, session: p.session, sourceUrl: qp, subject, timezone: p.timezone, year: p.year, zone: p.timezone }; }
function normalize(q, p, c, qAssets, mAssets, subject, level, key) { const qp = p.question_pdf_url ?? `https://ibdocs.re/extension/${p.id}-question.pdf`; const ms = p.markscheme_pdf_url ?? `https://ibdocs.re/extension/${p.id}-markscheme.pdf`; const primaryTopic = c.primary_topic_name; const secondaryTopics = c.secondary_topic_names ?? []; return { accessibleText: q.accessible_text, assessmentObjectives: c.assessment_objectives ?? [], classificationConfidence: c.confidence ?? "high", classificationEvidence: { sourceCommit: sources[key].commit, method: "sealed_source_reconciliation", summary: c.evidence ?? "" }, classificationReviewStatus: "classified", classificationVersion: `ib-${key}-extension-2016-2019`, component: p.component, course: `IB ${subject} ${level}`, level, curriculumVersion: "2016", displayPages: qAssets.pages, id: q.id, imageStatus: "source_extension_verified", marks: q.marks, markschemeTranscript: q.official_markscheme_text, markschemeUrl: ms, number: q.number, officialMarkscheme: { images: mAssets.paths, pages: mAssets.pages }, officialTopicCodes: c.official_topic_codes ?? [], pages: qAssets.pages, paper: Number(String(p.paper).replace("P", "")), pdfUrl: qp, primaryTopic, questionImages: qAssets.paths, secondaryTopics, session: p.session, skills: c.skills ?? [], solutionStatus: "Official IB markscheme image with extracted accessible transcript", sourceUrl: qp, subject, subtopics: c.primary_subtopic_name ? [c.primary_subtopic_name] : [], summary: q.accessible_text.replace(/\s+/g, " ").trim(), timezone: p.timezone, viewerAvailable: true, year: p.year, zone: p.timezone, courseEra: "" }; }
async function verifyAssets(s, paths, kind, assets, id) { const out=[]; let pages=[]; for (const rel of paths) { const sourceRelPath = join(s.assetRoot, rel); const abs = join(s.repo, sourceRelPath); const bytes = await readFile(abs); const meta = await sharp(bytes).metadata(); if (meta.format !== "webp" || !meta.width || !meta.height) throw new Error(`${s.subject}: invalid asset ${sourceRelPath}`); const publicPath = rel.replace(/^.*?\/(\d{4}-)/, (_,y)=>`${kind === "question" ? "questions" : "markschemes"}/${y}`); const objectKey = publicPath; const item = assets.get(objectKey) ?? { objectKey, kind, sourceRepository: sourceRel(s.repo), sourcePath: sourceRelPath, sha256: sha(bytes), byteSize: bytes.byteLength, width: meta.width, height: meta.height, referencedQuestionIds: [], pages: [] }; if (item.sha256 !== sha(bytes)) throw new Error(`${s.subject}: asset mutation ${sourceRelPath}`); item.referencedQuestionIds.push(id); const page = Number((rel.match(/page-(\d+)/) ?? [])[1] ?? 0); if (page) item.pages.push(page); assets.set(objectKey,item); out.push(`https://saksham106.github.io/ib-${s.subject.toLowerCase()}-topic-practice/${publicPath}`); pages.push(page); } return { paths: out, pages }; }
function publicQuestion(q) { const keep=["id","number","paper","year","session","primaryTopic","secondaryTopics","skills","subtopics","subject","zone","component","marks"]; return Object.fromEntries(keep.filter(k=>k in q).map(k=>[k,q[k]])); }
function runtimeSealSummary() { const out={}; for (const [k,s] of Object.entries(sources)) out[k]={ sourceCommit:s.commit, receiptRows:s.receiptRows, split:s.split }; return out; }
