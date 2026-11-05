// Builds one private source pack per IGCSE Maths 0580 syllabus section for the lesson writers and verifiers.
//
//   node scripts/notes/build-source-pack-0580.mjs            (all 72 sections)
//   node scripts/notes/build-source-pack-0580.mjs 2.5 9.3    (named sections)
//
// Packs go to <research>/<course.json gate.packs>/<section-dashed>.json and NEVER into Git: they hold verbatim
// syllabus text and bank questions with mark-scheme steps. <research> is NOTES_RESEARCH_DIR, else the sibling
// `research` folder of the main checkout (../research or ../../../research from this repo root).
//
// Each pack holds:
//   section        the syllabus section: Core and supplement bullets, notes split by tier (the coverage contract)
//   assessment     papers, tiers and calculator/accuracy rules (P1/P2 no calculator, P3/P4 scientific calculator)
//   formulaList    the printed List of formulas entries relevant to this section
//   glossary       terms this section owns (define them) and terms it uses (link, don't redefine)
//   prerequisites  earlier sections that own terms this section uses, plus the previous section in the topic
//   questions      up to 8 tagged bank questions split by tier, with text and marked steps: do not copy
//   mistakes       deduplicated `mistake` notes from the explanations of every tagged question, most frequent first
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const readJson = (file) => JSON.parse(readFileSync(file, "utf8"));

export const QUESTIONS_PER_PACK = 8;
export const PACK_BYTES_TARGET = 60_000;
export const MISTAKES_CAP = 12;
const TEXT_CHARS = 1500;
const RECENT_YEAR = 2020;
const TIER_PAPERS = { Core: ["P1", "P3"], Extended: ["P2", "P4"] };

export const course = readJson(join(repoRoot, "src/content/notes/igcse-maths-0580/course.json"));

export function findResearchDir(env = process.env) {
  if (env.NOTES_RESEARCH_DIR) return existsSync(env.NOTES_RESEARCH_DIR) ? resolve(env.NOTES_RESEARCH_DIR) : null;
  return ["../research", "../../../research"].map((rel) => resolve(repoRoot, rel)).find((dir) => existsSync(join(dir, "course-notes-0580/extract/syllabus.json"))) ?? null;
}

export const packPath = (researchDir, code) => join(researchDir, course.gate.packs, `${code.replace(".", "-")}.json`);

/**
 * Which printed formulas belong to which sections. The syllabus formula list carries no section codes, so this is
 * editorial: each formula goes to the sections whose content uses it (compound shapes reuse every mensuration one).
 */
const FORMULA_SECTIONS = [
  { match: /^Area, A, of triangle/, sections: ["5.2", "5.5"] },
  { match: /of circle of radius/, sections: ["5.3", "5.5"] },
  { match: /(surface area|Volume), (A|V), of/i, sections: ["5.4", "5.5"] },
  { match: /ax\^2 \+ bx \+ c = 0/, sections: ["2.5"] },
  { match: /sine rule|cosine rule|For the triangle shown: area/, sections: ["6.5", "6.6"] },
];

export function loadSources(researchDir) {
  const extract = join(researchDir, "course-notes-0580/extract");
  const raw = readJson(join(repoRoot, "src/data/raw/igcse.json"));
  const excluded = new Set(raw.excludedQuestionIds ?? []);
  return {
    syllabus: readJson(join(extract, "syllabus.json")),
    glossary: readJson(join(researchDir, "course-notes-0580/glossary-plan.json")),
    retrieval: readJson(join(repoRoot, "src/data/igcse-0580-section-retrieval-v3.json")).rows,
    bank: new Map(raw.questions.filter((q) => !excluded.has(q.id)).map((q) => [q.id, q])),
    explanationDir: join(researchDir, "explanations/igcse"),
  };
}

const flatten = (text) => String(text ?? "").replace(/\s+/g, " ").trim();
const truncate = (text, max) => (text.length > max ? `${text.slice(0, max)} …[truncated]` : text);
// Answer lines in the extracted question text are long runs of dots; keep one ellipsis so the layout is still readable.
const questionText = (text) => truncate(flatten(String(text ?? "").replace(/(?:\s*\.){4,}/g, " …")), TEXT_CHARS);

const explanationCache = new Map();
function readExplanation(dir, id) {
  const file = join(dir, `${id}.json`);
  if (explanationCache.has(file)) return explanationCache.get(file);
  let value = null;
  if (existsSync(file)) {
    try {
      const parsed = readJson(file);
      value = Array.isArray(parsed?.parts) && parsed.parts.length ? parsed : null;
    } catch {
      value = null;
    }
  }
  explanationCache.set(file, value);
  return value;
}

/** Tiers a section is taught at, with its official code for each. */
export const sectionTiers = (section) => [
  ...(section.coreCode ? [{ tier: "Core", code: section.coreCode }] : []),
  ...(section.extendedCode ? [{ tier: "Extended", code: section.extendedCode }] : []),
];

function sectionBlock(section) {
  const notes = section.notes.map((note) => {
    const match = /^(Core only|Extended only):\s*/.exec(note);
    const scope = match ? match[1] : "both tiers";
    return { scope, ...(scope === "Extended only" ? { teach: "Extended content to teach" } : {}), text: match ? note.slice(match[0].length) : note };
  });
  return {
    code: section.code,
    title: section.title,
    topic: section.topic,
    tiers: section.coreCode ? "Core and Extended" : "Extended only",
    coreCode: section.coreCode,
    extendedCode: section.extendedCode,
    coreTitle: section.coreTitle,
    extendedTitle: section.extendedTitle,
    pdfPages: section.pdfPages,
    core: section.core,
    supplement: section.supplement.map((bullet) => ({ ...bullet, tier: "Extended" })),
    notes,
  };
}

function assessmentBlock(assessment) {
  return {
    tiers: assessment.tiers,
    papers: assessment.papers.map(({ paper, name, tier, durationMinutes, marks, calculator, content }) => ({ paper: `P${paper}`, name, tier, durationMinutes, marks, calculator, content })),
    calculatorRules: assessment.calculatorRules,
    accuracyRules: assessment.accuracyRules,
    piRule: assessment.piRule,
  };
}

export function formulasFor(code, formulaList) {
  const sections = (description) => FORMULA_SECTIONS.find((rule) => rule.match.test(description))?.sections ?? [];
  const coreKeys = new Set(formulaList.core.formulas.map((entry) => entry.formula));
  return formulaList.extended.formulas
    .filter((entry) => sections(entry.description).includes(code))
    .map((entry) => ({
      description: entry.description,
      formula: entry.formula,
      printedOn: coreKeys.has(entry.formula) ? "Core and Extended lists" : "Extended list only",
      page: coreKeys.has(entry.formula) ? `${formulaList.core.page}, ${formulaList.extended.page}` : `${formulaList.extended.page}`,
    }));
}

function glossaryBlock(code, glossary) {
  return {
    label: "Define every `owns` term in this lesson (owner per the glossary plan). Link `uses` terms to their owner; do not redefine them.",
    owns: glossary.filter((term) => term.owner === code).map(({ id, term, tier, note }) => ({ id, term, tier, note })),
    uses: glossary.filter((term) => term.users.includes(code) && term.owner !== code).map(({ id, term, tier, owner }) => ({ id, term, tier, owner })),
  };
}

function prerequisiteCandidates(section, sources) {
  const order = sources.syllabus.sections.map((entry) => entry.code);
  const byCode = new Map(sources.syllabus.sections.map((entry) => [entry.code, entry]));
  const position = order.indexOf(section.code);
  const candidates = new Map();
  const add = (code, reason) => {
    const target = byCode.get(code);
    if (!target || code === section.code) return;
    const current = candidates.get(code) ?? { section: code, title: target.title, tiers: target.coreCode ? "Core and Extended" : "Extended only", reasons: [] };
    current.reasons.push(reason);
    candidates.set(code, current);
  };
  for (const term of sources.glossary) if (term.users.includes(section.code) && term.owner !== section.code) add(term.owner, `owns the glossary term "${term.term}", which this section uses`);
  const previous = byCode.get(order[position - 1]);
  if (previous && previous.topic === section.topic) add(previous.code, "previous section in the same topic");
  return [...candidates.values()]
    .map((candidate) => {
      const later = order.indexOf(candidate.section) > position;
      const glossaryLink = candidate.reasons.some((reason) => reason.startsWith("owns"));
      let use = glossaryLink ? "prerequisite" : "related";
      let note = glossaryLink ? "Suggested for `prerequisites`." : "Previous section: list it only if this lesson really builds on it.";
      if (later) {
        use = "related";
        note = "Later section: a forward link, not a prerequisite.";
      }
      if (section.coreCode && candidate.tiers === "Extended only") {
        use = "extended-note-only";
        note = "Extended-only section: a Core-and-Extended lesson may only link to it from Extended content.";
      }
      return { ...candidate, use, note };
    })
    .sort((a, b) => order.indexOf(a.section) - order.indexOf(b.section));
}

/** Every bank question tagged to an official code, newest-first within the most specific tags. */
export function taggedQuestions(code, sources) {
  return sources.retrieval
    .filter((row) => row.sectionCodes.includes(code))
    .map((row) => ({ row, question: sources.bank.get(row.id) }))
    .filter(({ question }) => question)
    .map(({ row, question }) => ({ row, question, paper: `P${question.paper}`, year: Number(question.year), explanation: readExplanation(sources.explanationDir, question.id) }))
    .sort(
      (a, b) =>
        Math.min(a.row.sectionCodes.length, 3) - Math.min(b.row.sectionCodes.length, 3) ||
        Number(Boolean(b.explanation)) - Number(Boolean(a.explanation)) ||
        Number(b.year >= RECENT_YEAR) - Number(a.year >= RECENT_YEAR) ||
        b.year - a.year ||
        a.row.id.localeCompare(b.row.id, "en", { numeric: true }),
    );
}

/** Round-robin across the tier's papers, preferring a year not yet picked for the tier at the same tag specificity. */
function pick(tagged, count) {
  const queues = [...new Set(tagged.map((candidate) => candidate.paper))].sort().map((paper) => tagged.filter((candidate) => candidate.paper === paper));
  const picked = [];
  const years = new Set();
  while (picked.length < count && queues.some((queue) => queue.length)) {
    for (const queue of queues) {
      if (!queue.length || picked.length >= count) continue;
      const index = Math.max(0, queue.findIndex((candidate) => !years.has(candidate.year) && candidate.row.sectionCodes.length <= queue[0].row.sectionCodes.length));
      const [chosen] = queue.splice(index, 1);
      years.add(chosen.year);
      picked.push(chosen);
    }
  }
  return picked;
}

const markedSteps = (explanation) =>
  explanation
    ? explanation.parts.map((part) => ({
        part: part.label,
        marks: part.marks,
        steps: part.steps.map((step) => `${flatten(step.text)}${step.math ? ` [${step.math}]` : ""}${step.marks?.length ? ` (${step.marks.join(" ")})` : ""}`),
        answer: flatten(part.answer),
      }))
    : null;

function questionsBlock(section, sources) {
  const tiers = sectionTiers(section);
  const tagged = Object.fromEntries(tiers.map(({ tier, code }) => [tier, taggedQuestions(code, sources)]));
  // Split the budget evenly across tiers, then give any slack a thin tier leaves to the other.
  const quota = Object.fromEntries(tiers.map(({ tier }) => [tier, Math.min(tagged[tier].length, Math.floor(QUESTIONS_PER_PACK / tiers.length))]));
  let spare = QUESTIONS_PER_PACK - Object.values(quota).reduce((a, b) => a + b, 0);
  for (const { tier } of tiers) {
    const extra = Math.min(spare, tagged[tier].length - quota[tier]);
    quota[tier] += extra;
    spare -= extra;
  }
  const result = {};
  for (const { tier, code } of tiers) {
    // Count before picking: the picker empties its queues.
    const paperCounts = Object.fromEntries(TIER_PAPERS[tier].map((paper) => [paper, tagged[tier].filter((candidate) => candidate.paper === paper).length]));
    result[tier] = {
      code,
      taggedTotal: tagged[tier].length,
      paperCounts,
      questions: pick(tagged[tier], quota[tier]).map(({ row, question, paper, explanation }) => ({
        id: question.id,
        year: Number(question.year),
        session: question.session,
        paper,
        calculator: paper === "P3" || paper === "P4",
        marks: Number(question.marks) || null,
        sectionCodes: row.sectionCodes,
        text: questionText(question.accessibleText),
        markedSteps: markedSteps(explanation),
      })),
    };
  }
  return { result, tagged };
}

function collectMistakes(tagged) {
  const seen = new Map();
  let order = 0;
  for (const [tier, list] of Object.entries(tagged)) {
    for (const { question, row, explanation } of list) {
      for (const part of explanation?.parts ?? []) {
        if (!part.mistake) continue;
        const key = part.mistake.toLowerCase().replace(/\$[^$]*\$/g, " ").replace(/[^a-z0-9]+/g, " ").trim();
        const from = `${question.id}${part.label ? ` (${part.label})` : ""}`;
        const entry = seen.get(key) ?? { text: flatten(part.mistake), tiers: new Set(), from: [], specificity: row.sectionCodes.length, order: order++ };
        entry.tiers.add(tier);
        entry.from.push(from);
        entry.specificity = Math.min(entry.specificity, row.sectionCodes.length);
        seen.set(key, entry);
      }
    }
  }
  const all = [...seen.values()].sort((a, b) => b.from.length - a.from.length || a.specificity - b.specificity || a.order - b.order);
  return {
    distinct: all.length,
    entries: all.slice(0, MISTAKES_CAP).map(({ text, tiers, from }) => ({ text, tiers: [...tiers], count: from.length, from: from.slice(0, 4) })),
  };
}

export function buildPack(code, sources) {
  const sections = sources.syllabus.sections;
  const index = sections.findIndex((entry) => entry.code === code);
  if (index < 0) throw new Error(`unknown section ${code}`);
  const section = sections[index];
  const { result, tagged } = questionsBlock(section, sources);
  const mistakes = collectMistakes(tagged);
  return {
    packVersion: 1,
    course: course.slug,
    notice: "PRIVATE SOURCE PACK. Never commit it, never ship it, never copy its text. Syllabus and question text are input for judgement only.",
    section: sectionBlock(section),
    neighbours: { previous: sections[index - 1]?.code ?? null, next: sections[index + 1]?.code ?? null },
    assessment: assessmentBlock(sources.syllabus.assessment),
    formulaList: formulasFor(code, sources.syllabus.formulaList),
    glossary: glossaryBlock(code, sources.glossary),
    prerequisites: prerequisiteCandidates(section, sources),
    questions: {
      label: "do not copy; for what is examined and how marks are given. Core questions come from P1/P3, Extended from P2/P4. A question tagged to several sections may have parts on other sections.",
      ...result,
    },
    mistakes: { label: `real student mistakes from our worked explanations of all tagged questions (${mistakes.distinct} distinct, top ${MISTAKES_CAP}): ground the lesson's mistakes in these, rewritten`, entries: mistakes.entries },
  };
}

export function buildAll(sources, codes = sources.syllabus.sections.map((entry) => entry.code)) {
  return codes.map((code) => ({ code, pack: buildPack(code, sources) }));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const researchDir = findResearchDir();
  if (!researchDir) {
    console.error("No research folder with course-notes-0580/extract/syllabus.json found. Set NOTES_RESEARCH_DIR.");
    process.exit(2);
  }
  const sources = loadSources(researchDir);
  const args = process.argv.slice(2).filter((arg) => !arg.startsWith("--")).map((arg) => arg.replace("-", "."));
  const codes = args.length ? args : sources.syllabus.sections.map((entry) => entry.code);
  mkdirSync(join(researchDir, course.gate.packs), { recursive: true });
  const thin = [];
  for (const { code, pack } of buildAll(sources, codes)) {
    const file = packPath(researchDir, code);
    writeFileSync(file, JSON.stringify(pack, null, 2) + "\n");
    const bytes = statSync(file).size;
    const tiers = Object.entries(pack.questions).filter(([key]) => key !== "label");
    const counts = tiers.map(([tier, block]) => `${tier} ${block.questions.length}/${block.taggedTotal} ${JSON.stringify(block.paperCounts)}`).join(", ");
    const totalTagged = tiers.reduce((sum, [, block]) => sum + block.taggedTotal, 0);
    const thinTiers = tiers.filter(([, block]) => block.taggedTotal < 3).map(([tier]) => tier);
    const flags = [totalTagged < 3 ? "FEW TAGGED (<3)" : "", thinTiers.length ? `thin tier (<3 tagged): ${thinTiers.join(", ")}` : "", bytes > PACK_BYTES_TARGET ? "OVER SIZE TARGET" : ""].filter(Boolean).join("; ");
    if (totalTagged < 3) thin.push(code);
    console.log(`${code}: ${(bytes / 1024).toFixed(1)} KB, ${counts}, ${pack.mistakes.entries.length} mistakes, ${pack.formulaList.length} formulas, glossary ${pack.glossary.owns.length} owns/${pack.glossary.uses.length} uses${flags ? `  ${flags}` : ""}`);
  }
  console.log(`${codes.length} pack(s) written to ${join(researchDir, course.gate.packs)}${thin.length ? `; fewer than 3 tagged questions: ${thin.join(", ")}` : ""}`);
}
