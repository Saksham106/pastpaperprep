import syllabus from "../data/igcse-0580-official-2025.json" with { type: "json" };
import overlay from "../data/igcse-0580-section-retrieval-v3.json" with { type: "json" };

export const IGCSE_0580_TOPICS = syllabus.topics.map(({ title }) => title);
export const IGCSE_0580_SECTIONS = syllabus.topics.flatMap((topic) => topic.sections.map((section) => ({
  ...section,
  topic: topic.title,
  displayTitle: `${section.code} ${section.title}`,
})));
const hex = (n) => (n >>> 0).toString(16);
export function inputFingerprint(raw) {
  const input = JSON.stringify([raw.id, raw.year ?? null, raw.component ?? null, raw.primaryTopic ?? null, raw.secondaryTopics ?? [], raw.subtopics ?? [], raw.skills ?? [], raw.accessibleText === undefined ? "" : raw.accessibleText, raw.questionImages ?? []]);
  let hash = 0x811c9dc5;
  for (const byte of new TextEncoder().encode(input)) hash = Math.imul(hash ^ byte, 0x01000193);
  return hex(hash);
}
if (overlay.schemaVersion !== 1 || overlay.expectedInventoryCount !== 3967 || overlay.officialSyllabusSha256 !== syllabus.sourcePdfSha256 || IGCSE_0580_TOPICS.length !== 9 || IGCSE_0580_SECTIONS.length !== 72) throw new Error("0580 section inventory/source drift");
const rows = new Map();
for (const row of overlay.rows) {
  if (rows.has(row.id)) throw new Error(`Duplicate 0580 section overlay ID ${row.id}`);
  rows.set(row.id, row);
}
const byCode = new Map(IGCSE_0580_SECTIONS.flatMap((section) => [[section.coreCode, { section, tier: "Core" }], [section.extendedCode, { section, tier: "Extended" }]]).filter(([code]) => code));
export function project0580Sections(raw) {
  const row = rows.get(raw.id);
  if (!row) return null;
  if (row.inputFingerprint !== inputFingerprint(raw)) throw new Error(`0580 section overlay fingerprint drift: ${raw.id}`);
  if (!Array.isArray(row.sectionCodes) || row.sectionCodes.some((code) => !byCode.has(code))) throw new Error(`Invalid 0580 section code: ${raw.id}`);
  const tiers = new Set(row.sectionCodes.map((code) => byCode.get(code).tier));
  const expectedTier = /^[13]/.test(raw.component ?? "") ? "Core" : /^[24]/.test(raw.component ?? "") ? "Extended" : null;
  if (!expectedTier || tiers.size !== 1 || !tiers.has(expectedTier)) throw new Error(`0580 tier drift: ${raw.id}`);
  const evidenceFor = (code) => row.evidenceByCode?.[code] ?? row.evidenceType;
  if (row.sectionCodes.some((code) => !["source-reviewed", "sample-calibrated-model", "deterministic-correspondence"].includes(evidenceFor(code)))) throw new Error(`0580 unaccepted per-link evidence: ${raw.id}`);
  const codes = new Set(row.sectionCodes);
  const sections = IGCSE_0580_SECTIONS.filter((section) => codes.has(section.coreCode) || codes.has(section.extendedCode));
  const labels = sections.map((section) => section.displayTitle);
  const secondaryTopics = [...new Set(sections.map((section) => section.topic))].filter((topic) => topic !== raw.primaryTopic && !(raw.secondaryTopics ?? []).includes(topic));
  return { subtopics: labels, secondaryTopics, codeRefs: row.sectionCodes.flatMap((code) => [`current_2025:${code}`, `${evidenceFor(code) === "source-reviewed" ? "source_reviewed_v3" : evidenceFor(code) === "deterministic-correspondence" ? "deterministic_v3" : "sample_calibrated_v3"}:${code}`]), evidenceType: row.evidenceType };
}
export const IGCSE_0580_SECTION_OVERLAY = overlay;
