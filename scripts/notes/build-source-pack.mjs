// Builds one private source pack per IB Maths AA syllabus item for the lesson writers and verifiers.
//
//   node scripts/notes/build-source-pack.mjs --all        (all 83 items)
//   node scripts/notes/build-source-pack.mjs 5.16 2.7     (named items)
//
// Packs go to <research>/aa-course-notes/packs/<item-dashed>.json and NEVER into Git: they hold verbatim
// guide text, booklet text and bank questions with mark schemes. <research> is AA_RESEARCH_DIR, else the
// sibling `research` folder of the main checkout (../research or ../../../research from this repo root).
//
// Each pack holds:
//   item              the items.json entry (our paraphrased checklist bullets + booklet ids): the coverage contract
//   guide             verbatim guide text for the item: reference only, never copy
//   booklet           formula-booklet entries (id, label, TeX) for this item and each prerequisite candidate
//   prerequisites     candidate items this lesson builds on (editorial judgement + the guide's "Link to" lines)
//   questions         up to 12 tagged bank questions per level, with text, mark scheme and marked steps: do not copy
//   mistakes          deduplicated `mistake` notes from the worked explanations of those questions
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const readJson = (file) => JSON.parse(readFileSync(file, "utf8"));

export const QUESTIONS_PER_LEVEL = 12;
const MARKSCHEME_CHARS = 3000;

export function findResearchDir(env = process.env) {
  if (env.AA_RESEARCH_DIR) return existsSync(env.AA_RESEARCH_DIR) ? resolve(env.AA_RESEARCH_DIR) : null;
  return ["../research", "../../../research"].map((rel) => resolve(repoRoot, rel)).find((dir) => existsSync(join(dir, "aa-course-notes/extract/items.resolved.json"))) ?? null;
}

export const packPath = (researchDir, item) => join(researchDir, "aa-course-notes/packs", `${item.replace(".", "-")}.json`);

/**
 * Editorial prerequisites: earlier items whose ideas this item needs. SL items only list SL items (the validator
 * rejects an AHL prerequisite on an SL lesson). The graph is acyclic; the build test checks both.
 */
export const JUDGED_PREREQUISITES = {
  "1.1": [], "1.2": [], "1.3": ["1.2"], "1.4": ["1.3"], "1.5": [], "1.6": [], "1.7": ["1.5"], "1.8": ["1.3"], "1.9": [],
  "1.10": ["1.9"], "1.11": [], "1.12": ["2.7"], "1.13": ["1.12", "3.4", "3.5"], "1.14": ["1.9", "1.13", "1.15"], "1.15": ["1.2", "1.6"], "1.16": [],
  "2.1": [], "2.2": [], "2.3": ["2.2"], "2.4": ["2.3"], "2.5": ["2.2"], "2.6": ["2.3", "2.4"], "2.7": ["2.6"], "2.8": ["2.2", "2.3"],
  "2.9": ["1.5", "1.7", "2.3"], "2.10": ["2.3", "2.7"], "2.11": ["2.3", "2.5"],
  "2.12": ["1.12", "2.7"], "2.13": ["2.8", "2.12"], "2.14": ["2.5", "2.11"], "2.15": ["2.7", "2.12"], "2.16": ["2.11"],
  "3.1": [], "3.2": ["3.1"], "3.3": ["3.2"], "3.4": [], "3.5": ["3.2", "3.4"], "3.6": ["3.5"], "3.7": ["2.11", "3.5"], "3.8": ["2.7", "3.6", "3.7"],
  "3.9": ["2.5", "3.6"], "3.10": ["3.6"], "3.11": ["3.5", "3.7"], "3.12": ["3.1"], "3.13": ["3.12"], "3.14": ["3.12"], "3.15": ["3.14"],
  "3.16": ["3.13"], "3.17": ["3.14", "3.16"], "3.18": ["1.16", "3.15", "3.17"],
  "4.1": [], "4.2": ["4.1"], "4.3": ["4.2"], "4.4": ["2.1", "4.2"], "4.5": [], "4.6": ["4.5"], "4.7": ["4.5"], "4.8": ["1.9", "4.7"],
  "4.9": ["4.7"], "4.10": ["4.4"], "4.11": ["4.6"], "4.12": ["4.9"], "4.13": ["4.11"], "4.14": ["4.7", "5.11"],
  "5.1": ["2.1"], "5.2": ["5.1"], "5.3": ["5.1"], "5.4": ["2.1", "5.3"], "5.5": ["5.3"], "5.6": ["2.5", "2.9", "3.5", "5.3"], "5.7": ["5.2", "5.6"],
  "5.8": ["5.2", "5.7"], "5.9": ["5.5", "5.6"], "5.10": ["5.5", "5.6"], "5.11": ["5.10"],
  "5.12": ["5.1", "5.7"], "5.13": ["5.6", "5.12"], "5.14": ["5.6", "5.8"], "5.15": ["1.11", "3.9", "5.6", "5.10"], "5.16": ["5.5", "5.10", "5.15"],
  "5.17": ["5.11"], "5.18": ["5.10", "5.15", "5.16"], "5.19": ["5.6", "5.12"],
};

const LINK_ITEM = /\b(?:SL|AHL)\s?(\d\.\d{1,2})\b/g;

export function loadSources(researchDir) {
  const extract = join(researchDir, "aa-course-notes/extract");
  const subtopics = join(repoRoot, "src/data/aa-official-subtopics");
  const bank = (file) => new Map(readJson(join(repoRoot, "src/data/raw", file)).questions.map((q) => [q.id, q]));
  const explanationsDir = (name) => join(researchDir, "explanations", name);
  return {
    items: readJson(join(subtopics, "items.json")).items,
    guide: new Map(readJson(join(extract, "items.resolved.json")).items.map((entry) => [entry.item, entry])),
    booklet: readJson(join(extract, "booklet.resolved.json")).entries,
    overlay: readJson(join(subtopics, "overlay.json")).records,
    groups: readJson(join(subtopics, "taxonomy.json")).groups,
    banks: { HL: bank("ib-hl.json"), SL: bank("ib-sl.json") },
    explanationDirs: { HL: explanationsDir("ib-hl"), SL: explanationsDir("ib-sl") },
  };
}

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

function prerequisiteCandidates(entry, guide, byItem) {
  const order = (code) => [...byItem.keys()].indexOf(code);
  const candidates = new Map();
  const add = (code, reason) => {
    const target = byItem.get(code);
    if (!target || code === entry.item) return;
    const current = candidates.get(code) ?? { item: code, name: target.name, level: target.level, reasons: [] };
    current.reasons.push(reason);
    candidates.set(code, current);
  };
  for (const code of JUDGED_PREREQUISITES[entry.item] ?? []) add(code, "editorial judgement: this lesson uses its ideas");
  const lines = [...(guide?.content ?? []), ...(guide?.guidance ?? []), guide?.notes ?? ""].filter((line) => /link/i.test(line));
  for (const line of lines) for (const match of line.matchAll(LINK_ITEM)) add(match[1], `guide "Link to" line: ${flatten(line)}`);
  return [...candidates.values()].map((candidate) => {
    const judged = (JUDGED_PREREQUISITES[entry.item] ?? []).includes(candidate.item);
    let use = judged ? "prerequisite" : "related";
    let note = judged ? "Suggested for `prerequisites`." : "Guide link only: mention or link it if useful; list it as a prerequisite only if the lesson really needs it.";
    if (entry.level === "SL" && candidate.level === "AHL") {
      use = "hlNote-only";
      note = "AHL item: an SL lesson may not list it as a prerequisite or link to it outside an `hlNote`.";
    } else if (!judged && order(candidate.item) > order(entry.item)) note = "Later item the guide links to: a forward link, not a prerequisite.";
    return { ...candidate, use, note };
  });
}

function bookletEntries(itemCodes, items, booklet, owner) {
  const tex = new Map(booklet.map((entry) => [entry.id, entry]));
  return itemCodes.flatMap((code) => (items.get(code)?.booklet ?? []).map((entry) => ({
    id: entry.id,
    item: code,
    taggable: code === owner ? "always" : `only if ${code} is in this lesson's prerequisites`,
    label: entry.label,
    tex: tex.get(entry.id)?.tex ?? null,
    section: tex.get(entry.id)?.section ?? null,
  })));
}

function selectQuestions(entry, sources, groupSize) {
  const levels = entry.level === "AHL" ? ["HL"] : ["SL", "HL"];
  const result = {};
  for (const level of levels) {
    const tagged = sources.overlay
      .filter((record) => record.status === "accepted" && record.level === level && record.groupIds.some((id) => groupSize.get(id)?.members.includes(entry.item)))
      .map((record) => ({ record, question: sources.banks[level].get(record.id) }))
      .filter(({ question }) => question)
      .map(({ record, question }) => ({
        record,
        question,
        specificity: Math.min(...record.groupIds.filter((id) => groupSize.get(id)?.members.includes(entry.item)).map((id) => groupSize.get(id).members.length)),
      }))
      .sort((a, b) => a.specificity - b.specificity || a.record.groupIds.length - b.record.groupIds.length || Number(b.question.year) - Number(a.question.year) || a.record.id.localeCompare(b.record.id));
    // Round-robin across papers so the pack shows how the item is examined on each paper, most specific first.
    const byPaper = new Map();
    for (const candidate of tagged) {
      const paper = `P${candidate.question.paper}`;
      if (!byPaper.has(paper)) byPaper.set(paper, []);
      byPaper.get(paper).push(candidate);
    }
    // Count before the round-robin, which empties the queues.
    const paperCounts = Object.fromEntries([...byPaper.entries()].sort().map(([paper, list]) => [paper, list.length]));
    const picked = [];
    const queues = [...byPaper.keys()].sort().map((paper) => [...byPaper.get(paper)]);
    while (picked.length < QUESTIONS_PER_LEVEL && queues.some((queue) => queue.length)) for (const queue of queues) if (queue.length && picked.length < QUESTIONS_PER_LEVEL) picked.push(queue.shift());
    result[level] = {
      taggedTotal: tagged.length,
      paperCounts,
      questions: picked.map(({ record, question }) => {
        const explanation = readExplanation(sources.explanationDirs[level], question.id);
        const markScheme = level === "HL" ? flatten(question.markschemeTranscript) : flatten(question.solution || question.independentSolution);
        return {
          id: question.id,
          bank: level === "HL" ? "ib-hl" : "ib-sl",
          year: question.year,
          session: question.session,
          paper: `P${question.paper}`,
          marks: Number(question.marks) || null,
          groups: record.groupIds,
          text: flatten(question.accessibleText),
          // The HL transcript is machine-extracted and its maths is garbled, so it is only kept when no marked explanation exists.
          markSchemeSource: level === "HL" ? (explanation ? "see markedSteps (our worked explanation, mark codes from the official mark scheme)" : "official mark scheme, machine-extracted text (maths is garbled)") : "independent worked solution checked against the official mark scheme",
          markScheme: level === "HL" && explanation ? null : truncate(markScheme, MARKSCHEME_CHARS),
          markedSteps: explanation
            ? explanation.parts.map((part) => ({
                part: part.label,
                marks: part.marks,
                steps: part.steps.map((step) => `${flatten(step.text)}${step.math ? ` [${step.math}]` : ""}${step.marks.length ? ` (${step.marks.join(" ")})` : ""}`),
                answer: flatten(part.answer),
              }))
            : null,
        };
      }),
    };
  }
  return result;
}

function collectMistakes(questionsByLevel, sources) {
  const seen = new Map();
  for (const [level, block] of Object.entries(questionsByLevel)) {
    for (const question of block.questions) {
      const explanation = readExplanation(sources.explanationDirs[level], question.id);
      for (const part of explanation?.parts ?? []) {
        if (!part.mistake) continue;
        const key = part.mistake.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
        if (seen.has(key)) seen.get(key).from.push(`${question.id}${part.label ? ` (${part.label})` : ""}`);
        else seen.set(key, { text: flatten(part.mistake), from: [`${question.id}${part.label ? ` (${part.label})` : ""}`] });
      }
    }
  }
  return [...seen.values()];
}

export function buildPack(code, sources) {
  const byItem = new Map(sources.items.map((entry) => [entry.item, entry]));
  const entry = byItem.get(code);
  if (!entry) throw new Error(`unknown item ${code}`);
  const guide = sources.guide.get(code);
  const groupSize = new Map(sources.groups.map((group) => [group.id, { members: group.memberOfficialItems, name: group.studentFacingName }]));
  const prerequisites = prerequisiteCandidates(entry, guide, byItem);
  const index = sources.items.findIndex((candidate) => candidate.item === code);
  const questions = selectQuestions(entry, sources, groupSize);
  const groups = sources.groups.filter((group) => group.memberOfficialItems.includes(code));
  return {
    packVersion: 1,
    notice: "PRIVATE SOURCE PACK. Never commit it, never ship it, never copy its text. Guide, booklet and question text are input for judgement only.",
    item: entry,
    neighbours: { previous: sources.items[index - 1]?.item ?? null, next: sources.items[index + 1]?.item ?? null },
    groups: groups.map((group) => ({ id: group.id, name: group.studentFacingName, items: group.memberOfficialItems, inclusive: group.classificationBoundary?.inclusive ?? null, exclusive: group.classificationBoundary?.exclusive ?? null })),
    guide: {
      label: "reference only — never copy",
      page: guide?.page ?? null,
      content: guide?.content ?? [],
      guidance: guide?.guidance ?? [],
      notes: guide?.notes ?? "",
    },
    booklet: {
      label: "Formula booklet entries (IB wording: reference only — never copy). Tag a formula block `booklet` only with one of these ids.",
      entries: bookletEntries([code, ...prerequisites.filter((candidate) => candidate.use === "prerequisite").map((candidate) => candidate.item)], byItem, sources.booklet, code),
      priorLearning: sources.booklet.filter((entry_) => entry_.priorLearning).map(({ id, label, tex }) => ({ id, label, tex, taggable: "never: prior-learning entries have no items.json id; mention them in text" })),
    },
    prerequisites,
    questions: { label: "do not copy; for what is examined and how marks are given. Tagged by student-facing group, so some questions examine a sibling item in the same group.", ...questions },
    mistakes: { label: "real student mistakes from our worked explanations: ground the lesson's mistakes in these, rewritten", entries: collectMistakes(questions, sources) },
  };
}

export function buildAll(sources, codes = sources.items.map((entry) => entry.item)) {
  return codes.map((code) => ({ code, pack: buildPack(code, sources) }));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const researchDir = findResearchDir();
  if (!researchDir) {
    console.error("No research folder with aa-course-notes/extract found. Set AA_RESEARCH_DIR.");
    process.exit(2);
  }
  const sources = loadSources(researchDir);
  const codes = args.includes("--all") ? sources.items.map((entry) => entry.item) : args.filter((arg) => !arg.startsWith("--")).map((arg) => arg.replace("-", "."));
  if (!codes.length) {
    console.error("Usage: build-source-pack.mjs --all | <item> [<item> ...]");
    process.exit(2);
  }
  mkdirSync(join(researchDir, "aa-course-notes/packs"), { recursive: true });
  for (const { code, pack } of buildAll(sources, codes)) {
    writeFileSync(packPath(researchDir, code), JSON.stringify(pack, null, 2) + "\n");
    const counts = Object.entries(pack.questions).filter(([key]) => key !== "label").map(([level, block]) => `${level} ${block.questions.length}/${block.taggedTotal}`).join(", ");
    console.log(`${code}: ${counts}, ${pack.mistakes.entries.length} mistakes, ${pack.booklet.entries.length} booklet`);
  }
  const written = readdirSync(join(researchDir, "aa-course-notes/packs")).filter((name) => name.endsWith(".json")).length;
  console.log(`${codes.length} pack(s) written; ${written} in ${join(researchDir, "aa-course-notes/packs")}`);
}
