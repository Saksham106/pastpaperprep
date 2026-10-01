import official from "../data/igcse-0580-official-2025.json" with { type: "json" };
import reviewed from "../data/igcse-0580-reviewed-section-overlay.json" with { type: "json" };

export const MATH_0580_TOPICS = Object.freeze(official.topics.map((topic) => topic.title));
export const MATH_0580_SECTIONS = Object.freeze(official.topics.flatMap((topic) => topic.sections.map((section) => ({
  ...section, topic: topic.title, displayTitle: `${section.code} ${section.title}`,
}))));
export const MATH_0580_REVIEW_TOPIC = "Questions needing section review";
export const MATH_0580_REVIEW = "Section not yet verified";
const byTierCode = new Map(MATH_0580_SECTIONS.flatMap((section) => [section.coreCode, section.extendedCode]
  .filter(Boolean).map((code) => [code, section])));
const byDisplay = new Map(MATH_0580_SECTIONS.map((section) => [section.displayTitle, section]));
const reviewedById = new Map(reviewed.rows.map((row) => [row.id, row]));
// Exact existing fine-label equivalents only. Labels spanning multiple official
// sections, or depending on an assessed operation not named by the label, stay unresolved.
const sectionCrosswalk = Object.freeze({
  "Circle theorems": "4.7",
  "Similarity and congruence": "4.4",
  "Constructions and loci": "4.2",
  "Basic probability": "8.1",
  "Combined and conditional probability": "8.3",
  "Set language and notation": "1.2",
  "Fractions, decimals and percentages": "1.4",
  "Exponential growth and decay": "1.17",
  "Straight-line graphs": "3.2",
  "Distance and midpoint": "3.4",
  "Area and perimeter": "5.2",
  "Volume and surface area": "5.4",
  "Sequences": "2.7",
  "Calculus": "2.12",
  "Vectors": "7.2",
  "Transformations": "7.1",
  "Histograms and cumulative frequency": "9.6",
  "Scatter graphs": "9.5",
  "Averages and spread": "9.3",
});
if (MATH_0580_TOPICS.length !== 9 || MATH_0580_SECTIONS.length !== 72 || byDisplay.size !== 72
  || reviewedById.size !== 25 || reviewed.officialSyllabusSha256 !== official.sourcePdfSha256) {
  throw new Error("0580 official inventory or exact reviewed overlay changed");
}

/** @param {string[]} refs */
export function display0580Sections(refs) {
  const current = [...new Set((refs ?? []).filter((ref) => ref.startsWith("current_2025:")).map((ref) => {
    const section = byTierCode.get(ref.slice("current_2025:".length));
    if (!section) throw new Error(`0580 unknown official section ref ${ref}`);
    return section.displayTitle;
  }))];
  const needsReview = (refs ?? []).includes("review:section");
  if (needsReview && current.length) throw new Error("0580 reviewed and unresolved refs overlap");
  return [...current, ...(needsReview ? [MATH_0580_REVIEW] : [])];
}

/**
 * Topic ownership uses the existing controlled nine-topic source label.
 * Only exact, QP/MS-source-reviewed IDs get an official section address.
 * All other source classifications stay searchable and topic-retrievable,
 * with explicit section-review membership rather than an invented section.
 * @param {{id?:string,year?:number,component?:string,primaryTopic?:string,secondaryTopics?:string[],subtopics?:string[],skills?:string[]}} raw
 */
export function project0580Sections(raw) {
  if (!MATH_0580_TOPICS.includes(raw.primaryTopic)) throw new Error(`0580 unsupported source topic ${raw.id ?? "unknown"}: ${raw.primaryTopic}`);
  const row = reviewedById.get(raw.id);
  if (row && (raw.year !== row.sourceYear || raw.component !== row.sourceComponent
    || raw.primaryTopic !== row.sourcePrimaryTopic
    || JSON.stringify(raw.secondaryTopics ?? []) !== JSON.stringify(row.sourceSecondaryTopics)
    || JSON.stringify(raw.subtopics ?? []) !== JSON.stringify(row.sourceSubtopics))) {
    throw new Error(`0580 reviewed overlay input drift ${raw.id}`);
  }
  if (row) {
    const tier = /^[13]/.test(raw.component ?? "") ? "C" : /^[24]/.test(raw.component ?? "") ? "E" : null;
    if (!tier) throw new Error(`0580 unrecognized paper tier ${raw.id}`);
    const sections = [row.primaryCode, ...row.secondaryCodes].map((code) => {
      const section = byTierCode.get(code);
      if (code[0] !== tier || !section) throw new Error(`0580 invalid reviewed tier/section ${raw.id}: ${code}`);
      return section;
    });
    if (sections[0].topic !== MATH_0580_TOPICS[Number.parseInt(row.primaryCode.slice(1).split(".")[0], 10) - 1]) {
      throw new Error(`0580 reviewed section owner changed ${raw.id}`);
    }
    const visibleTitles = [...new Set(sections.map((section) => section.displayTitle))];
    const primaryTopic = sections[0].topic;
    const secondaryTopics = [...new Set([
      ...sections.slice(1).map((section) => section.topic),
      raw.primaryTopic ?? "", ...(raw.secondaryTopics ?? []),
    ])].filter((topic) => topic !== primaryTopic);
    return {
      primaryTopic, secondaryTopics,
      subtopics: [...new Set([...visibleTitles, ...(raw.subtopics ?? [])])],
      visibleTitles,
      aliases: [...new Set([...(raw.subtopics ?? []), ...(raw.skills ?? []), raw.primaryTopic ?? "", ...(raw.secondaryTopics ?? [])].filter(Boolean))],
      codeRefs: [...[row.primaryCode, ...row.secondaryCodes].map((code) => `review_verified_2025:${code}`),
        ...[row.primaryCode, ...row.secondaryCodes].map((code) => `current_2025:${code}`)],
      needsReview: false,
    };
  }
  const mappedLabels = [...new Set(raw.subtopics ?? [])].filter((label) => sectionCrosswalk[label]);
  const mappedSectionCode = mappedLabels.length === 1 && (raw.subtopics ?? []).length === 1
    ? sectionCrosswalk[mappedLabels[0]] : null;
  if (mappedSectionCode) {
    const tier = /^[13]/.test(raw.component ?? "") ? "C" : /^[24]/.test(raw.component ?? "") ? "E" : null;
    const code = `${tier ?? ""}${mappedSectionCode}`;
    const section = byTierCode.get(code);
    if (section && section.topic === raw.primaryTopic) {
      return {
        primaryTopic: raw.primaryTopic ?? "", secondaryTopics: raw.secondaryTopics ?? [],
        subtopics: [section.displayTitle, ...(raw.subtopics ?? [])].filter((value, index, all) => all.indexOf(value) === index),
        visibleTitles: [section.displayTitle],
        aliases: [...new Set([...(raw.subtopics ?? []), ...(raw.skills ?? []), raw.primaryTopic ?? "", ...(raw.secondaryTopics ?? [])].filter(Boolean))],
        codeRefs: [`current_2025:${code}`], needsReview: false,
      };
    }
  }
  return {
    primaryTopic: raw.primaryTopic ?? "",
    secondaryTopics: [...new Set([...(raw.secondaryTopics ?? []), MATH_0580_REVIEW_TOPIC])].filter((topic) => topic !== raw.primaryTopic),
    subtopics: [...new Set([MATH_0580_REVIEW, ...(raw.subtopics ?? [])])],
    visibleTitles: [MATH_0580_REVIEW],
    aliases: [...new Set([...(raw.subtopics ?? []), ...(raw.skills ?? []), raw.primaryTopic ?? "", ...(raw.secondaryTopics ?? [])].filter(Boolean))],
    codeRefs: ["review:section"],
    needsReview: true,
  };
}
