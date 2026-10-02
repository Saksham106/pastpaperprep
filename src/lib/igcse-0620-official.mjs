import official from "../data/igcse-chemistry-0620-official-2026.json" with { type: "json" };
import taxonomy from "../data/igcse-chemistry-0620-official-taxonomy.json" with { type: "json" };
import retrievalRepairs from "../data/igcse-0620-source-retrieval-repairs.json" with { type: "json" };
const repairById = new Map(Object.entries(retrievalRepairs.entries));

export const CHEMISTRY_0620_TOPICS = Object.freeze(official.topics.map((topic) => topic.title));
export const CHEMISTRY_0620_SECTIONS = Object.freeze(official.sections.map((section) => ({
  ...section,
  topic: official.topics.find((topic) => topic.id === section.topicId)?.title ?? (() => { throw new Error(`0620 missing topic ${section.topicId}`); })(),
})));
export const CHEMISTRY_0620_EARLIER_TOPIC = "Earlier syllabus topics";
export const CHEMISTRY_0620_EARLIER = "Earlier syllabus content";
export const CHEMISTRY_0620_PRACTICAL_TOPIC = "Practical skills and investigations";
export const CHEMISTRY_0620_REVIEW_TOPIC = "Questions needing section review";
export const CHEMISTRY_0620_REVIEW = "Current syllabus section not yet mapped";
const byCode = new Map(CHEMISTRY_0620_SECTIONS.map((section) => [section.code, section]));
const byTitle = new Map(CHEMISTRY_0620_SECTIONS.map((section) => [section.title, section]));
const detailById = new Map(taxonomy.details.map((detail) => [detail.id, detail]));
if (CHEMISTRY_0620_TOPICS.length !== 12 || CHEMISTRY_0620_SECTIONS.length !== 49 || byCode.size !== 49 || byTitle.size !== 49) throw new Error("0620 official heading inventory collapsed");

/** @param {string[]} refs */
export function display0620Sections(refs) {
  const current = [...new Set((refs ?? []).filter((ref) => ref.startsWith("current_2026:")).map((ref) => {
    const section = byCode.get(ref.slice("current_2026:".length));
    if (!section) throw new Error(`0620 unknown current section ref ${ref}`);
    return section.title;
  }))];
  return [...current, ...((refs ?? []).includes("earlier:content") ? [CHEMISTRY_0620_EARLIER] : []), ...((refs ?? []).includes("unresolved:current") ? [CHEMISTRY_0620_REVIEW] : [])];
}

/** @param {{id?:string,year?:number,number?:number,component?:string,accessibleText?:string,courseEra?:string,primaryTopic?:string|null,primaryTopicId?:string|null,secondaryTopics?:string[],subtopics?:string[],skills?:string[],classificationProvenance?:{officialCode?:string|null,primaryDetailId?:string|null}}} raw */
export function project0620Sections(raw) {
  if (!Number.isInteger(raw.year) || raw.year < 2019 || raw.year > 2026) throw new Error(`0620 unsupported year ${raw.id ?? "unknown"}`);
  const repair = repairById.get(raw.id ?? "");
  if (repair) {
    // Input drift guard, not an authentication or cryptographic seal.
    const input = JSON.stringify([raw.id, raw.year, raw.number, raw.component, raw.accessibleText, raw.primaryTopicId,
      raw.classificationProvenance?.officialCode, raw.classificationProvenance?.primaryDetailId]);
    let fingerprint = 2166136261;
    for (const byte of new TextEncoder().encode(input)) fingerprint = Math.imul(fingerprint ^ byte, 16777619) >>> 0;
    if (fingerprint.toString(16).padStart(8, "0") !== repair.input_fingerprint) throw new Error(`0620 retrieval repair source drift ${raw.id}`);
    const section = byCode.get(repair.code);
    if (!section) throw new Error(`0620 unknown repaired section ${repair.code}`);
    const sourceCode = raw.classificationProvenance?.officialCode;
    return { primaryTopic: section.topic, secondaryTopics: [], subtopics: [section.title], visibleTitles: [section.title],
      codeRefs: [...(sourceCode ? [`source_recorded:${raw.courseEra ?? "unknown"}:${sourceCode}`] : []), `current_2026:${section.code}`, `alias_current:${section.code}`],
      aliases: [], historical: false, unmappedCurrent: false, practical: false };
  }
  const practical = raw.primaryTopicId === "practical-skills";
  if (practical) return { primaryTopic: CHEMISTRY_0620_PRACTICAL_TOPIC, secondaryTopics: [...new Set([raw.primaryTopic ?? "", ...(raw.secondaryTopics ?? [])].filter(Boolean))], subtopics: [...new Set(raw.subtopics?.length ? raw.subtopics : raw.skills ?? [])], visibleTitles: [], codeRefs: [], aliases: [...new Set([...(raw.subtopics ?? []), ...(raw.skills ?? [])])], historical: false, unmappedCurrent: false, practical: true };
  const currentEra = raw.year >= 2023;
  const sourceCode = raw.classificationProvenance?.officialCode;
  const detailId = raw.classificationProvenance?.primaryDetailId;
  const detail = detailId ? detailById.get(detailId) : null;
  const sections = [];
  let historical = false;
  let unmappedCurrent = false;
  if (currentEra) {
    if (detailId && !detail) throw new Error(`0620 unknown current detail ${raw.id ?? "unknown"}: ${detailId}`);
    if (detail && detail.ownerTopicId !== raw.primaryTopicId) throw new Error(`0620 current detail/topic mismatch ${raw.id ?? "unknown"}`);
    if (sourceCode && detail && sourceCode !== detail.ownerSubtopicCode) throw new Error(`0620 current detail/code mismatch ${raw.id ?? "unknown"}`);
    const code = sourceCode ?? detail?.ownerSubtopicCode;
    if (code) {
      const section = byCode.get(code);
      if (!section || section.topicId !== raw.primaryTopicId) throw new Error(`0620 current code/topic mismatch ${raw.id ?? "unknown"}: ${code}`);
      sections.push(section);
    } else unmappedCurrent = true;
  } else {
    for (const label of raw.subtopics ?? []) {
      const section = byTitle.get(label);
      if (section && section.topicId === raw.primaryTopicId) sections.push(section);
      else historical = true;
    }
    if (!raw.subtopics?.length) historical = true;
  }
  const unique = [...new Map(sections.map((section) => [section.code, section])).values()];
  const visibleTitles = [...unique.map((section) => section.title), ...(historical ? [CHEMISTRY_0620_EARLIER] : []), ...(unmappedCurrent ? [CHEMISTRY_0620_REVIEW] : [])];
  const primaryTopic = unique[0]?.topic ?? (unmappedCurrent ? (CHEMISTRY_0620_TOPICS.includes(raw.primaryTopic) ? raw.primaryTopic : CHEMISTRY_0620_REVIEW_TOPIC) : CHEMISTRY_0620_EARLIER_TOPIC);
  const originalTopics = [raw.primaryTopic ?? "", ...(raw.secondaryTopics ?? [])].filter(Boolean);
  const secondaryTopics = [...new Set([...unique.slice(1).map((section) => section.topic), ...(historical && primaryTopic !== CHEMISTRY_0620_EARLIER_TOPIC ? [CHEMISTRY_0620_EARLIER_TOPIC] : []), ...(unmappedCurrent && primaryTopic !== CHEMISTRY_0620_REVIEW_TOPIC ? [CHEMISTRY_0620_REVIEW_TOPIC] : []), ...originalTopics.filter((topic) => topic !== primaryTopic)])];
  const aliases = [...new Set([...(raw.subtopics ?? []), ...(raw.skills ?? []), ...originalTopics])];
  const sourceOwners = new Set(originalTopics);
  const aliasRefs = [...new Set((raw.subtopics ?? []).map((label) => byTitle.get(label)).filter((section) => section && sourceOwners.has(section.topic)).map((section) => `alias_current:${section.code}`))];
  const codeRefs = [...(sourceCode ? [`source_recorded:${raw.courseEra ?? "unknown"}:${sourceCode}`] : []), ...unique.map((section) => `current_2026:${section.code}`), ...aliasRefs, ...(historical ? ["earlier:content"] : []), ...(unmappedCurrent ? ["unresolved:current"] : [])];
  return { primaryTopic, secondaryTopics, subtopics: [...new Set([...visibleTitles, ...aliases])], visibleTitles, codeRefs, aliases, historical, unmappedCurrent, practical: false };
}
