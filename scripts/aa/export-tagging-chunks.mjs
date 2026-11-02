// Exports the AA questions still missing `officialItems` as chunk files for the item-tagging agent pass.
//
//   node scripts/aa/export-tagging-chunks.mjs
//
// Writes <research>/aa-course-notes/tagging/chunks/NN.json (NEVER into Git: they hold question text and mark schemes).
// <research> is AA_RESEARCH_DIR, else the sibling `research` folder of the main checkout (../research or ../../../research).
// Each chunk is an array of entries:
//   id, level, paper, groupIds
//   candidates   every member item of those groups (item, name, level, bullet texts, and the groups that contain it with
//                their classificationBoundary): the only items the tagger may choose from
//   question     the question text from src/data/raw (HL text is machine-extracted, maths often garbled)
//   markedSteps  our worked explanation flattened to marked steps, else null with `markScheme` holding the mark-scheme text
// Chunks hold ~60 questions; records are ordered by their group set first so a chunk's questions share groups.
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadAaData, readJson, repoRoot } from "./official-items.mjs";

export const CHUNK_SIZE = 60;
const MARKSCHEME_CHARS = 3000;

export function findResearchDir(env = process.env) {
  if (env.AA_RESEARCH_DIR) return existsSync(env.AA_RESEARCH_DIR) ? resolve(env.AA_RESEARCH_DIR) : null;
  return ["../research", "../../../research"].map((rel) => resolve(repoRoot, rel)).find((dir) => existsSync(join(dir, "aa-course-notes"))) ?? null;
}

export const chunksDir = (researchDir) => join(researchDir, "aa-course-notes/tagging/chunks");

const flatten = (text) => String(text ?? "").replace(/\s+/g, " ").trim();
const truncate = (text, max) => (text.length > max ? `${text.slice(0, max)} …[truncated]` : text);

function readExplanation(dir, id) {
  const file = join(dir, `${id}.json`);
  if (!existsSync(file)) return null;
  try {
    const value = readJson(file);
    return Array.isArray(value?.parts) && value.parts.length ? value : null;
  } catch {
    return null;
  }
}

/** Marked steps in the shape build-source-pack.mjs uses. */
export function flattenExplanation(explanation) {
  return explanation.parts.map((part) => ({
    part: part.label,
    marks: part.marks,
    steps: part.steps.map((step) => `${flatten(step.text)}${step.math ? ` [${step.math}]` : ""}${step.marks?.length ? ` (${step.marks.join(" ")})` : ""}`),
    answer: flatten(part.answer),
  }));
}

export function loadSources(researchDir) {
  const bank = (file) => new Map(readJson(join(repoRoot, "src/data/raw", file)).questions.map((q) => [q.id, q]));
  return {
    banks: { HL: bank("ib-hl.json"), SL: bank("ib-sl.json") },
    explanationDirs: { HL: join(researchDir, "explanations/ib-hl"), SL: join(researchDir, "explanations/ib-sl") },
  };
}

function candidatesFor(record, data) {
  const byItem = new Map();
  for (const groupId of record.groupIds) {
    const group = data.groupById.get(groupId);
    for (const code of group.memberOfficialItems) {
      if (!byItem.has(code)) {
        const entry = data.items[data.itemOrder.get(code)];
        byItem.set(code, { item: code, name: entry.name, level: entry.level, bullets: entry.bullets.map((bullet) => bullet.text), groups: [] });
      }
      byItem.get(code).groups.push({ id: group.id, name: group.studentFacingName, classificationBoundary: group.classificationBoundary ?? null });
    }
  }
  return [...byItem.values()].sort((a, b) => data.itemOrder.get(a.item) - data.itemOrder.get(b.item));
}

export function buildEntry(record, data, sources) {
  const question = sources.banks[record.level].get(record.id);
  if (!question) throw new Error(`${record.id}: not found in the ${record.level} raw bank`);
  const explanation = readExplanation(sources.explanationDirs[record.level], record.id);
  const markScheme = record.level === "HL" ? flatten(question.markschemeTranscript) : flatten(question.solution || question.independentSolution);
  return {
    id: record.id,
    level: record.level,
    paper: `P${question.paper}`,
    groupIds: record.groupIds,
    candidates: candidatesFor(record, data),
    question: {
      year: question.year,
      session: question.session,
      marks: Number(question.marks) || null,
      textSource: record.level === "HL" ? "machine-extracted from the official paper: maths is often garbled, judge from the mark scheme and marked steps too" : "accessible text of the official paper",
      text: flatten(question.accessibleText),
    },
    markedSteps: explanation ? flattenExplanation(explanation) : null,
    markScheme: explanation ? null : {
      source: record.level === "HL" ? "official mark scheme, machine-extracted text (maths is garbled)" : "independent worked solution checked against the official mark scheme",
      text: truncate(markScheme, MARKSCHEME_CHARS),
    },
  };
}

/** Accepted records without `officialItems`, grouped by group set and split into balanced chunks of at most `size`. */
export function buildChunks(data, sources, size = CHUNK_SIZE) {
  const pending = data.overlay.records
    .filter((record) => record.status === "accepted" && !(record.officialItems?.length))
    .sort((a, b) => [...a.groupIds].sort().join("|").localeCompare([...b.groupIds].sort().join("|")) || a.level.localeCompare(b.level) || a.id.localeCompare(b.id));
  const count = Math.ceil(pending.length / size);
  const chunks = [];
  for (let index = 0; index < count; index += 1) {
    const from = Math.round((index * pending.length) / count);
    const to = Math.round(((index + 1) * pending.length) / count);
    chunks.push(pending.slice(from, to).map((record) => buildEntry(record, data, sources)));
  }
  return chunks;
}

export const chunkName = (index) => `${String(index + 1).padStart(2, "0")}.json`;

/** Reads every NN.json chunk in a directory into a Map of id to its entry. */
export function loadChunkEntries(dir) {
  const entries = new Map();
  for (const name of readdirSync(dir).filter((file) => /^\d+\.json$/.test(file)).sort()) {
    for (const entry of JSON.parse(readFileSync(join(dir, name), "utf8"))) entries.set(entry.id, entry);
  }
  return entries;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const researchDir = findResearchDir();
  if (!researchDir) {
    console.error("No research folder with aa-course-notes found. Set AA_RESEARCH_DIR.");
    process.exit(2);
  }
  const data = loadAaData();
  const chunks = buildChunks(data, loadSources(researchDir));
  const dir = chunksDir(researchDir);
  mkdirSync(dir, { recursive: true });
  for (const name of readdirSync(dir).filter((file) => /^\d+\.json$/.test(file))) rmSync(join(dir, name));
  chunks.forEach((chunk, index) => writeFileSync(join(dir, chunkName(index)), JSON.stringify(chunk, null, 2) + "\n"));
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const withExplanation = chunks.flat().filter((entry) => entry.markedSteps).length;
  console.log(`${chunks.length} chunk(s), ${total} question(s) (${withExplanation} with marked steps, ${total - withExplanation} with mark-scheme text) written to ${dir}`);
}
