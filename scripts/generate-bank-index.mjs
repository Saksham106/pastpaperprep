#!/usr/bin/env node
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { mkdir, readdir, readFile, unlink, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(import.meta.dirname, "..");
const outputDirectory = join(root, "public", "bank-index");
const version = 1;
const granularOverlay = JSON.parse(await readFile(join(root, "src", "data", "math-granular-label-overlay.json"), "utf8"));
const aaTaxonomy = JSON.parse(await readFile(join(root, "src", "data", "aa-official-subtopics", "taxonomy.json"), "utf8"));
const aaOverlay = JSON.parse(await readFile(join(root, "src", "data", "aa-official-subtopics", "overlay.json"), "utf8"));
const biologyOfficialTaxonomy = JSON.parse(await readFile(join(root, "src", "data", "ib-biology-official-subtopics", "taxonomy.json"), "utf8"));
const biologyOfficialOverlay = JSON.parse(await readFile(join(root, "src", "data", "ib-biology-official-subtopics", "overlay.json"), "utf8"));
const overlayBankForSlug = (slug) => ({
  "igcse-additional": "0606",
  "ib-hl": "ib-aa-hl",
  "ib-sl": "ib-aa-sl",
}[slug] ?? slug);
const granularByKey = new Map();
for (const row of granularOverlay.labels) {
  const key = `${row.bank}:${row.id}`;
  granularByKey.set(key, [...(granularByKey.get(key) ?? []), row.label]);
}
const aaGroupNames = new Map(aaTaxonomy.groups.map((group) => [group.id, group.studentFacingName]));
const aaRecords = new Map(aaOverlay.records.map((record) => [`${record.level}:${record.id}`, record]));
const biologyGroupNames = new Map(biologyOfficialTaxonomy.curatedGroups.map((group) => [group.id, group.studentFacingName]));
const biologyRecords = new Map(biologyOfficialOverlay.rows.map((record) => [`${record.bank}:${record.id}`, record]));
function currentAaRecord(bank, raw) {
  const level = bank === "ib-sl" && raw.subject?.toLocaleLowerCase() === "mathematics: analysis and approaches sl"
    ? "SL"
    : bank === "ib-hl" && raw.courseEra === "aa-hl" && raw.course?.toLocaleLowerCase() === "mathematics: analysis and approaches hl"
      ? "HL"
      : null;
  return level ? aaRecords.get(`${level}:${raw.id}`) ?? (() => { throw new Error(`Missing official AA classification for ${raw.id}`); })() : null;
}
function currentBiologyRecord(bank, raw) {
  if (bank !== "ib-biology-hl" && bank !== "ib-biology-sl") return null;
  return biologyRecords.get(`${bank}:${raw.id}`) ?? (() => { throw new Error(`Missing official Biology classification for ${raw.id}`); })();
}
const biologyGroupLabels = (record) => [record.primary, ...record.secondary]
  .filter(Boolean)
  .map((group) => biologyGroupNames.get(group.id) ?? (() => { throw new Error(`Unknown official Biology group ${group.id}`); })());
const biologyPrimaryTopic = (record, raw) => record.primary?.parentTopic ?? raw.primaryTopic ?? "Other";
const bankSources = [
  ...["igcse", "igcse-additional", "ib-hl", "ib-sl", "ib-ai-hl", "ib-ai-sl", "ib-chemistry-hl", "ib-chemistry-sl", "ib-physics-hl", "ib-physics-sl", "ib-biology-hl", "ib-biology-sl"]
    .map((bank) => ({ bank, directory: "raw" })),
  ...["ib-economics-hl", "ib-economics-sl", "igcse-biology-0610", "igcse-economics-0455", "igcse-chemistry-0620", "igcse-physics-0625", "igcse-coordinated-sciences-0654"]
    .map((bank) => ({ bank, directory: "production" })),
];
const banks = bankSources.map(({ bank }) => bank);
const forbiddenKeys = [
  "summary", "accessibleText", "searchText", "solution", "sourceQuestionUrl",
  "sourceMarkSchemeUrl", "questionImages", "markschemeImages", "questionAssetPaths",
  "markschemeAssetPaths", "courseEra",
];

function strings(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
}

function integer(value) {
  return typeof value === "number" ? value : Number.parseInt(String(value), 10) || 0;
}

export function metadataFromRaw(raw, { bank, normalizedProduction = false, localEconomics = false } = {}) {
  const officialMarkscheme = raw.officialMarkscheme && typeof raw.officialMarkscheme === "object"
    ? raw.officialMarkscheme
    : {};
  const aa = currentAaRecord(bank, raw);
  const biology = currentBiologyRecord(bank, raw);
  const controlledSkills = aa || biology ? [] : strings(raw.skills);
  const studentSubtopics = aa
    ? (aa.status === "accepted" ? aa.subtopics.map((id) => aaGroupNames.get(id) ?? (() => { throw new Error(`Unknown official AA group ${id}`); })()) : [])
    : biology
      ? biologyGroupLabels(biology)
      : strings(raw.subtopics);
  const detailedSubtopics = strings(raw.detailedSubtopics);
  const subtopics = [...new Set(
    studentSubtopics.length
      ? studentSubtopics
      : localEconomics
        ? detailedSubtopics
        : controlledSkills,
  )];
  const skillSeed = controlledSkills.length
    ? controlledSkills
    : detailedSubtopics.length
      ? detailedSubtopics
      : subtopics;
  const skills = aa || biology ? [] : localEconomics
    ? [...new Set(controlledSkills)]
    : [...new Set([
      ...skillSeed,
      ...controlledSkills,
      ...detailedSubtopics,
      ...subtopics,
    ])];

  const overlayBank = overlayBankForSlug(bank);
  const metadata = {
    id: typeof raw.id === "string" ? raw.id : "",
    number: integer(raw.number),
    paper: integer(raw.paper),
    year: integer(raw.year),
    session: typeof raw.session === "string" ? raw.session : "",
    primaryTopic: biology ? biologyPrimaryTopic(biology, raw) : aa ? aa.primaryTopic : (typeof raw.primaryTopic === "string" && raw.primaryTopic ? raw.primaryTopic : "Other"),
    secondaryTopics: biology ? [...new Set(biology.secondary.map((group) => group.parentTopic))] : aa ? aa.secondaryTopics : strings(raw.secondaryTopics),
    skills,
    subtopics,
    granularLabels: aa || biology ? [] : granularByKey.get(`${overlayBank}:${raw.id}`) ?? [],
    ...(biology ? { officialCodeRefs: [...biology.officialCodes] } : strings(raw.officialCodeRefs).length ? { officialCodeRefs: strings(raw.officialCodeRefs) } : {}),
    ...(strings(raw.retrievalFacets).length ? { retrievalFacets: strings(raw.retrievalFacets) } : {}),
    subject: (typeof raw.subject === "string" && raw.subject) || (typeof raw.course === "string" ? raw.course : ""),
    option: typeof raw.p3Option === "string" ? raw.p3Option : "",
    zone: (typeof raw.timezone === "string" && raw.timezone) || (typeof raw.zone === "string" ? raw.zone : ""),
    component: typeof raw.component === "string" ? raw.component : "",
    calculator: typeof raw.calculator === "boolean" ? raw.calculator : null,
    marks: typeof raw.marks === "number" ? raw.marks : null,
    questionImageCount: strings(raw.questionImages).length,
    markschemeImageCount: normalizedProduction
      ? (strings(officialMarkscheme.images).length || strings(raw.markschemeImages).length)
      : strings(raw.markschemeImages).length + strings(officialMarkscheme.images).length,
  };
  return metadata;
}

function sortQuestions(a, b) {
  return b.year - a.year
    || a.paper - b.paper
    || a.number - b.number
    || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

function assertSafe(serialized, rawQuestions) {
  for (const key of forbiddenKeys) {
    if (serialized.includes(`"${key}"`)) throw new Error(`Public index contains protected key: ${key}`);
  }
  for (const raw of rawQuestions) {
    const protectedValues = [
      raw.summary,
      raw.accessibleText,
      raw.solution,
      raw.independentSolution,
      raw.sourceQuestionUrl,
      raw.sourceUrl,
      raw.pdfUrl,
      raw.sourceMarkSchemeUrl,
      raw.markschemeUrl,
      ...strings(raw.questionImages),
      ...strings(raw.markschemeImages),
    ];
    for (const value of protectedValues) {
      if (typeof value === "string" && value.trim().length >= 12 && serialized.includes(value)) {
        throw new Error(`Public index contains protected value from ${raw.id}`);
      }
    }
  }
}

export async function generateBankIndexes() {
  await mkdir(outputDirectory, { recursive: true });
  const existingFiles = await readdir(outputDirectory);
  await Promise.all(existingFiles
    .filter((file) => banks.some((bank) => file.startsWith(`${bank}.v${version}-`) && file.endsWith(".json")))
    .map((file) => unlink(join(outputDirectory, file))));

  const manifest = {};
  for (const { bank, directory } of bankSources) {
    const rawBank = JSON.parse(await readFile(join(root, "src", "data", directory, `${bank}.json`), "utf8"));
    const rawQuestions = rawBank.questions;
    const questions = rawQuestions.map((raw) => metadataFromRaw(raw, {
      bank,
      normalizedProduction: directory === "production",
      localEconomics: bank === "ib-economics-hl" || bank === "ib-economics-sl",
    })).sort(sortQuestions);
    const payload = { version, bank, questions };
    const serialized = `${JSON.stringify(payload)}\n`;
    assertSafe(serialized, rawQuestions);
    const digest = createHash("sha256").update(serialized).digest("hex").slice(0, 12);
    const filename = `${bank}.v${version}-${digest}.json`;
    const outputPath = join(outputDirectory, filename);
    await writeFile(outputPath, serialized, "utf8");
    manifest[bank] = filename;
    const rawBytes = Buffer.byteLength(serialized);
    const gzipBytes = gzipSync(serialized, { level: 9 }).byteLength;
    console.log(`${bank}: ${rawBytes} bytes raw, ${gzipBytes} bytes gzip, sha256=${digest}`);
  }

  const manifestSource = `// Generated by scripts/generate-bank-index.mjs; do not edit.\nexport const PUBLIC_BANK_INDEX_FILES = ${JSON.stringify(manifest, null, 2)} as const;\n`;
  await writeFile(join(root, "src", "lib", "bank-index-manifest.ts"), manifestSource, "utf8");
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  await generateBankIndexes();
}
