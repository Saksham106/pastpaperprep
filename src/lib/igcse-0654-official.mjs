import official2025 from "../data/igcse-coordinated-sciences-0654-official-2025.json" with { type: "json" };

export const COORDINATED_0654_EARLIER_TOPIC = "Earlier syllabus topics";
export const COORDINATED_0654_EARLIER = "Earlier syllabus content";
export const COORDINATED_0654_PRACTICAL_TOPIC = "Practical skills and investigations";
export const COORDINATED_0654_TOPICS = Object.freeze(official2025.topics.map((topic) => topic.title));
export const COORDINATED_0654_SECTIONS = Object.freeze(official2025.sections.map((section) => ({
  ...section,
  topic: official2025.topics.find((topic) => topic.id === section.ownerTopicId)?.title ?? (() => { throw new Error(`0654 missing section owner ${section.code}`); })(),
  studentTitle: section.title === "Diffusion" ? `Diffusion (${section.subject === "B" ? "Biology" : "Chemistry"})` : section.title,
})));
const byCode = new Map(COORDINATED_0654_SECTIONS.map((section) => [section.code, section]));
const bySubjectTitle = new Map(COORDINATED_0654_SECTIONS.map((section) => [`${section.subject}:${section.title}`, section]));
const uniqueStudentTitles = new Set(COORDINATED_0654_SECTIONS.map((section) => section.studentTitle));
if (uniqueStudentTitles.size !== COORDINATED_0654_SECTIONS.length) throw new Error("0654 distinct official sections collapsed in student filter");

/** @param {string[]} refs */
export function display0654Sections(refs) {
  const current = [...new Set((refs ?? []).filter((ref) => ref.startsWith("current_2025:")).map((ref) => {
    const code = ref.slice("current_2025:".length);
    const section = byCode.get(code);
    if (!section) throw new Error(`0654 unknown current section ${code}`);
    return section.studentTitle;
  }))];
  return [...current, ...((refs ?? []).includes("earlier:content") ? [COORDINATED_0654_EARLIER] : [])];
}

/** @param {{id?: string, year?: number, courseEra?: string, primaryTopic?: string, primaryTopicId?: string, secondaryTopics?: string[], subtopics?: string[], skills?: string[], subject?: string, classificationProvenance?: {era?: string|null, officialCode?: string|null}}} raw */
export function project0654Sections(raw) {
  const era = raw.classificationProvenance?.era;
  const sourceCode = raw.classificationProvenance?.officialCode;
  const practical = raw.primaryTopicId === "practical-skills";
  if (practical) {
    if (sourceCode || !raw.skills?.length) throw new Error(`0654 unreviewed practical source ${raw.id ?? "unknown"}`);
    return { primaryTopic: COORDINATED_0654_PRACTICAL_TOPIC, secondaryTopics: [...new Set([raw.primaryTopic ?? "", ...(raw.secondaryTopics ?? [])].filter(Boolean))], subtopics: [...new Set(raw.subtopics ?? [])], visibleTitles: [], aliases: [...new Set([...(raw.subtopics ?? []), ...raw.skills])], codeRefs: [], historical: false, practical: true };
  }
  const currentEra = raw.courseEra === "new_2025";
  const oldEra = raw.courseEra === "old_2021_2024";
  if (!currentEra && !oldEra) throw new Error(`0654 unsupported syllabus era ${raw.id ?? "unknown"}`);
  if (currentEra && (era !== "new_2025" || !sourceCode)) throw new Error(`0654 2025 content lacks official code ${raw.id ?? "unknown"}`);
  if (oldEra && sourceCode && !["2019_2021_v3", "2022_v1"].includes(era)) throw new Error(`0654 old content lacks era identity ${raw.id ?? "unknown"}`);
  const subject = (raw.subject ?? "").charAt(0).toUpperCase();
  const currentSections = [];
  let historical = false;
  if (currentEra) {
    const parentCode = /^[BCP]\d+\.\d+\.\d+$/.test(sourceCode) ? sourceCode.replace(/\.\d+$/, "") : sourceCode;
    const section = byCode.get(parentCode);
    if (!section || section.ownerTopicId !== raw.primaryTopicId || section.subject !== subject || (parentCode !== sourceCode && raw.subtopics?.[0] !== section.title)) throw new Error(`0654 current code/topic mismatch ${raw.id ?? "unknown"}: ${sourceCode}`);
    currentSections.push(section);
  } else {
    for (const label of raw.subtopics ?? []) {
      const clean = label.replace(/\s*\(continued\)$|\s+continued$/, "");
      const match = bySubjectTitle.get(`${subject}:${clean}`);
      if (match) currentSections.push(match);
      else historical = true;
    }
    if (!raw.subtopics?.length) historical = true;
  }
  const current = [...new Map(currentSections.map((section) => [section.code, section])).values()];
  const visibleTitles = [...current.map((section) => section.studentTitle), ...(historical ? [COORDINATED_0654_EARLIER] : [])];
  const originalTopics = [raw.primaryTopic ?? "", ...(raw.secondaryTopics ?? [])].filter(Boolean);
  const primaryTopic = current[0]?.topic ?? COORDINATED_0654_EARLIER_TOPIC;
  const secondaryTopics = [...new Set([...current.slice(1).map((section) => section.topic), ...(historical && primaryTopic !== COORDINATED_0654_EARLIER_TOPIC ? [COORDINATED_0654_EARLIER_TOPIC] : []), ...originalTopics.filter((topic) => topic !== primaryTopic)])];
  const sourceRef = sourceCode ? [`${era}:${sourceCode}`] : [];
  const codeRefs = [...sourceRef, ...current.map((section) => `current_2025:${section.code}`), ...(historical ? ["earlier:content"] : [])];
  const aliases = [...new Set([...(raw.subtopics ?? []), ...(raw.skills ?? []), raw.primaryTopic ?? ""] .filter(Boolean))];
  return { primaryTopic, secondaryTopics, subtopics: [...new Set([...visibleTitles, ...aliases])], visibleTitles, aliases, codeRefs, historical, practical: false };
}
