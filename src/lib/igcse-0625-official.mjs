import official from "../data/igcse-physics-0625-official-2026.json" with { type: "json" };
import sourceReviewed2026 from "../data/igcse-physics-0625-current-review-overlay.json" with { type: "json" };

export const PHYSICS_0625_TOPICS = Object.freeze(official.topics.map((topic) => topic.title));
export const PHYSICS_0625_SECTIONS = Object.freeze(official.sections.map((section) => ({
  ...section,
  topic: official.topics.find((topic) => topic.code === section.topicCode)?.title ?? (() => { throw new Error(`0625 missing topic ${section.topicCode}`); })(),
})));
export const PHYSICS_0625_EARLIER_TOPIC = "Earlier syllabus topics";
export const PHYSICS_0625_EARLIER = "Earlier syllabus content";
export const PHYSICS_0625_PRACTICAL_TOPIC = "Experimental skills and investigations";
export const PHYSICS_0625_REVIEW_TOPIC = "Questions needing section review";
export const PHYSICS_0625_REVIEW = "Current syllabus section not yet mapped";
const byCode = new Map(PHYSICS_0625_SECTIONS.map((section) => [section.code, section]));
const byTitle = new Map(PHYSICS_0625_SECTIONS.map((section) => [section.title, section]));
const sourceReviewedById = new Map(sourceReviewed2026.rows.map((row) => [row.id, row]));
if (sourceReviewedById.size !== 16 || sourceReviewed2026.officialSyllabusSha256 !== official.pdfSha256) {
  throw new Error("0625 source-reviewed overlay coverage or syllabus changed");
}

/** @param {string[]} refs */
export function display0625Sections(refs) {
  const current = [...new Set((refs ?? []).filter((ref) => ref.startsWith("current_2026:")).map((ref) => {
    const section = byCode.get(ref.slice("current_2026:".length));
    if (!section) throw new Error(`0625 unknown current section ref ${ref}`);
    return section.title;
  }))];
  return [...current, ...((refs ?? []).includes("earlier:content") ? [PHYSICS_0625_EARLIER] : []), ...((refs ?? []).includes("unresolved:current") ? [PHYSICS_0625_REVIEW] : [])];
}

/** @param {{id?:string,year?:number,courseEra?:string,primaryTopic?:string|null,primaryTopicId?:string|null,secondaryTopics?:string[],subtopics?:string[],skills?:string[],sourceQuestionUrl?:string|null,sourceMarkSchemeUrl?:string|null,classificationProvenance?:{officialCode?:string|null,primaryDetailId?:string|null}}} raw */
export function project0625Sections(raw) {
  const era = raw.courseEra;
  if (!["2020_2022", "2023_2025", "2026_2028"].includes(era)) throw new Error(`0625 unsupported era ${raw.id ?? "unknown"}`);
  const practical = raw.primaryTopicId === "practical-skills";
  if (practical) return { primaryTopic: PHYSICS_0625_PRACTICAL_TOPIC, secondaryTopics: [...new Set([raw.primaryTopic ?? "", ...(raw.secondaryTopics ?? [])].filter(Boolean))], subtopics: [...new Set(raw.subtopics ?? [])], visibleTitles: [], codeRefs: [], aliases: [...new Set([...(raw.subtopics ?? []), ...(raw.skills ?? [])])], historical: false, unmappedCurrent: false, practical: true };
  const code = raw.classificationProvenance?.officialCode;
  const sourceReviewed = sourceReviewedById.get(raw.id);
  const currentEra = era !== "2020_2022";
  const current = [];
  const reviewVerifiedCodes = [];
  let historical = false;
  let unmappedCurrent = false;
  if (currentEra && code) {
    if (sourceReviewed) throw new Error(`0625 source-reviewed overlay overlaps coded source row ${raw.id}`);
    const section = byCode.get(code);
    const owner = official.topics.find((topic) => topic.code === code.split(".")[0]);
    if (!section || !owner || owner.id !== raw.primaryTopicId) throw new Error(`0625 current code/topic mismatch ${era}:${code} (${raw.id ?? "unknown"})`);
    const parent = code.split(".").length === 3 ? byCode.get(code.slice(0,code.lastIndexOf("."))) : null;
    if (parent) current.push(parent);
    current.push(section);
  } else if (currentEra && sourceReviewed) {
    if (raw.year !== 2026 || era !== "2026_2028" || raw.primaryTopicId !== sourceReviewed.sourcePrimaryTopicId
      || raw.primaryTopic !== sourceReviewed.sourcePrimaryTopic
      || JSON.stringify(raw.subtopics ?? []) !== JSON.stringify(sourceReviewed.sourceSubtopics)) {
      throw new Error(`0625 source-reviewed overlay input drift ${raw.id}`);
    }
    for (const reviewedCode of [sourceReviewed.primaryCode, ...sourceReviewed.secondaryCodes]) {
      const section = byCode.get(reviewedCode);
      if (!section) throw new Error(`0625 source-reviewed unknown section ${reviewedCode} (${raw.id})`);
      const parent = reviewedCode.split(".").length === 3 ? byCode.get(reviewedCode.slice(0, reviewedCode.lastIndexOf("."))) : null;
      if (parent) current.push(parent);
      current.push(section);
      reviewVerifiedCodes.push(reviewedCode);
    }
    if (raw.primaryTopic && current[0]?.topic !== raw.primaryTopic) throw new Error(`0625 source-reviewed parent mismatch ${raw.id}`);
  } else if (currentEra) {
    unmappedCurrent = true;
  } else {
    for (const label of raw.subtopics ?? []) {
      const section = byTitle.get(label);
      const owner = official.topics.find((topic) => topic.code === section?.topicCode);
      if (section && owner?.id === raw.primaryTopicId) {
        const parent = section.code.split(".").length === 3 ? byCode.get(section.code.slice(0,section.code.lastIndexOf("."))) : null;
        if (parent) current.push(parent);
        current.push(section);
      } else historical = true;
    }
    if (!raw.subtopics?.length) historical = true;
  }
  const uniqueCurrent = [...new Map(current.map((section) => [section.code, section])).values()];
  const visibleTitles = [...uniqueCurrent.map((section) => section.title), ...(historical ? [PHYSICS_0625_EARLIER] : []), ...(unmappedCurrent ? [PHYSICS_0625_REVIEW] : [])];
  const primaryTopic = uniqueCurrent[0]?.topic ?? (unmappedCurrent ? (PHYSICS_0625_TOPICS.includes(raw.primaryTopic) ? raw.primaryTopic : PHYSICS_0625_REVIEW_TOPIC) : PHYSICS_0625_EARLIER_TOPIC);
  const originalTopics = [raw.primaryTopic ?? "", ...(raw.secondaryTopics ?? [])].filter(Boolean);
  const secondaryTopics = [...new Set([...uniqueCurrent.slice(1).map((section) => section.topic), ...(historical && primaryTopic !== PHYSICS_0625_EARLIER_TOPIC ? [PHYSICS_0625_EARLIER_TOPIC] : []), ...(unmappedCurrent && primaryTopic !== PHYSICS_0625_REVIEW_TOPIC ? [PHYSICS_0625_REVIEW_TOPIC] : []), ...originalTopics.filter((topic) => topic !== primaryTopic)])];
  const aliases = [...new Set([...(raw.subtopics ?? []), ...(raw.skills ?? []), ...originalTopics].filter(Boolean))];
  const codeRefs = [...(code ? [`${era}:${code}`] : []), ...reviewVerifiedCodes.map((reviewedCode) => `review_verified_2026:${reviewedCode}`), ...uniqueCurrent.map((section) => `current_2026:${section.code}`), ...(historical ? ["earlier:content"] : []), ...(unmappedCurrent ? ["unresolved:current"] : [])];
  return { primaryTopic, secondaryTopics, subtopics: [...new Set([...visibleTitles, ...aliases])], visibleTitles, codeRefs, aliases, historical, unmappedCurrent, practical: false };
}
