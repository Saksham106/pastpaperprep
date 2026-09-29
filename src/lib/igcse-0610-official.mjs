import taxonomy from "../data/classification/igcse-biology-0610-official-taxonomy-v2.json" with { type: "json" };
import official2026 from "../data/igcse-biology-0610-official-2026.json" with { type: "json" };

// Cambridge Biology 0610, 2026–28 syllabus, pp. 14–48. The 2023–25
// numbered inventory has the same 61 addresses; §16.5 changed its wording.
export const BIOLOGY_0610_EARLIER = "Earlier syllabus content";
export const BIOLOGY_0610_EARLIER_TOPIC = "Earlier syllabus topics";
export const BIOLOGY_0610_TOPICS = Object.freeze(taxonomy.eras.at(-1).topics.map((topic) => topic.title));
const officialTitles = new Map(official2026.sections.map((section) => [section.code, section.title]));
export const BIOLOGY_0610_SECTIONS = Object.freeze(taxonomy.eras.at(-1).topics.flatMap((topic) => topic.subtopics.map((section) => ({
  code: section.id,
  title: officialTitles.get(section.id) ?? (() => { throw new Error(`0610 official 2026 section absent: ${section.id}`); })(),
  topic: topic.title,
}))));
if (officialTitles.size !== BIOLOGY_0610_SECTIONS.length) throw new Error("0610 official 2026 heading set does not equal the registry addresses");
const currentByCode = new Map(BIOLOGY_0610_SECTIONS.map((section) => [section.code, section]));
const currentByTitle = new Map(BIOLOGY_0610_SECTIONS.map((section) => [section.title, section]));
const eras = new Map(taxonomy.eras.map((era) => [era.era, {
  byCode: new Map(era.topics.flatMap((topic) => topic.subtopics.map((section) => [section.id, { code: section.id, title: section.title, topic: topic.title }]))),
  byTitle: new Map(era.topics.flatMap((topic) => topic.subtopics.map((section) => [section.title, { code: section.id, title: section.title, topic: topic.title }]))),
}]));
const NO_ADDRESS_ROWS = new Map([
  ["0610-2023-m-12-q5", ["2023_2025", "Size of specimens"]],
  ["0610-2023-m-22-q4", ["2023_2025", "Size of specimens"]],
  ["0610-2022-w-42-q4", ["2022", "Habitat destruction"]],
]);

/** The original section address is always era-qualified; addresses shift between editions. */
export function display0610Sections(refs) {
  if (!refs?.length) return [BIOLOGY_0610_EARLIER]; // three source rows with no section address
  const titles = refs.map((ref) => {
    const [era, code] = ref.split(":");
    if (!era || !/^\d+\.\d+$/.test(code ?? "")) throw new Error(`0610 invalid section ref: ${ref}`);
    const source = eras.get(era === "2026_2028" ? "2023_2025" : era)?.byCode.get(code);
    if (!source) throw new Error(`0610 unknown era/section ref: ${ref}`);
    if (era === "2023_2025" || era === "2026_2028") {
      const current = currentByCode.get(code);
      if (!current || current.topic !== source.topic) throw new Error(`0610 current section collision: ${ref}`);
      return current.title;
    }
    return currentByTitle.get(source.title)?.title ?? BIOLOGY_0610_EARLIER;
  });
  return [...new Set([...titles.filter((title) => title !== BIOLOGY_0610_EARLIER), ...titles.filter((title) => title === BIOLOGY_0610_EARLIER)])];
}

/** @param {{id?: string, year?: number, courseEra?: string, primaryTopic?: string, secondaryTopics?: string[], subtopics?: string[], skills?: string[]}} raw */
export function project0610Sections(raw) {
  const sourceEra = raw.courseEra;
  const expectedEra = raw.year >= 2019 && raw.year <= 2021 ? "2020_2021" : raw.year === 2022 ? "2022" : raw.year >= 2023 && raw.year <= 2025 ? "2023_2025" : raw.year === 2026 ? "2026_2028" : null;
  if (!expectedEra || sourceEra !== expectedEra) throw new Error(`0610 exam-year/era mismatch: ${raw.id ?? "unknown"}`);
  const registryEra = sourceEra === "2026_2028" ? "2023_2025" : sourceEra;
  const registry = eras.get(registryEra);
  if (!registry) throw new Error(`0610 missing supported era: ${raw.id ?? "unknown"}`);
  if (!raw.subtopics?.length) {
    const expected = NO_ADDRESS_ROWS.get(raw.id);
    if (!expected || expected[0] !== sourceEra || expected[1] !== raw.primaryTopic) throw new Error(`0610 unreviewed missing section: ${raw.id ?? "unknown"}`);
    return { primaryTopic: BIOLOGY_0610_EARLIER_TOPIC, secondaryTopics: [raw.primaryTopic], subtopics: [BIOLOGY_0610_EARLIER], visibleTitles: [BIOLOGY_0610_EARLIER], aliases: [raw.primaryTopic], codeRefs: [], historical: true };
  }
  const sourceSections = raw.subtopics.map((label) => {
    const section = /^\d+\.\d+$/.test(label) ? registry.byCode.get(label) : registry.byTitle.get(label);
    if (!section) throw new Error(`0610 unmapped source section ${sourceEra}:${label} (${raw.id ?? "unknown"})`);
    if (raw.primaryTopic !== section.topic && !(raw.secondaryTopics ?? []).includes(section.topic)) {
      throw new Error(`0610 source parent mismatch ${sourceEra}:${label} (${raw.id ?? "unknown"})`);
    }
    return section;
  });
  const sourceRefs = [...new Set(sourceSections.map((section) => `${sourceEra}:${section.code}`))];
  // The 2026 extension uses the current 61 addresses. It is not silently
  // treated as 2023–25: reject an unseen code or changed parent on ingest.
  const official = sourceSections.map((source) => {
    if (sourceEra === "2026_2028" || sourceEra === "2023_2025") {
      const section = currentByCode.get(source.code);
      if (!section || section.topic !== source.topic) throw new Error(`0610 current code needs review ${sourceEra}:${source.code} (${raw.id ?? "unknown"})`);
      return section;
    }
    return currentByTitle.get(source.title) ?? null;
  });
  const currentSections = [...new Map(official.filter(Boolean).map((section) => [section.code, section])).values()];
  const historical = official.some((section) => !section);
  const visibleTitles = [...currentSections.map((section) => section.title), ...(historical ? [BIOLOGY_0610_EARLIER] : [])];
  const aliases = [...new Set([...sourceSections.map((section) => section.title), ...(raw.subtopics ?? []), ...(raw.skills ?? [])])];
  const currentTopics = [...new Set(currentSections.map((section) => section.topic))];
  const originalTopics = [...new Set([raw.primaryTopic ?? "", ...(raw.secondaryTopics ?? [])].filter(Boolean))];
  const primaryTopic = currentTopics[0] ?? BIOLOGY_0610_EARLIER_TOPIC;
  const secondaryTopics = [...new Set([...currentTopics.slice(1), ...(historical && primaryTopic !== BIOLOGY_0610_EARLIER_TOPIC ? [BIOLOGY_0610_EARLIER_TOPIC] : []), ...originalTopics.filter((topic) => topic !== primaryTopic)])];
  return {
    primaryTopic,
    secondaryTopics,
    subtopics: [...new Set([...visibleTitles, ...aliases])],
    visibleTitles,
    aliases,
    codeRefs: sourceRefs,
    historical,
  };
}
