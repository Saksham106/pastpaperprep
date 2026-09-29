import official2026 from "../data/igcse-economics-0455-official-2026.json" with { type: "json" };

export const ECONOMICS_0455_TOPICS = Object.freeze(official2026.topics);
export const ECONOMICS_0455_SECTIONS = Object.freeze(official2026.sections);
export const ECONOMICS_0455_EARLIER = "Earlier syllabus content";
const sectionByCode = new Map(ECONOMICS_0455_SECTIONS.map((s) => [s.code, s]));

/** @param {string[]} codeRefs @returns {string[]} */
export function display0455Sections(codeRefs) {
  if (!codeRefs.length) throw new Error("0455 cannot display a question without section refs");
  if (codeRefs.every((ref) => ref.startsWith("2017_2019:"))) return [ECONOMICS_0455_EARLIER];
  if (codeRefs.some((ref) => ref.startsWith("2017_2019:"))) throw new Error("0455 cannot display mixed-era section refs");
  return [...new Set(codeRefs.map((ref) => {
    const [era, code] = ref.split(":");
    if (!(["2020_2022", "2023_2025"].includes(era) && code)) {
      throw new Error(`0455 cannot display unreviewed section ref: ${ref}`);
    }
    const section = sectionByCode.get(code.replace(/\.\d+$/, ""));
    if (!section) throw new Error(`0455 cannot display unknown section ref: ${ref}`);
    return section.title;
  }))];
}

/**
 * Project source-backed detail codes onto the current 2026 section headings.
 * The 2017–19 registry uses unrelated S6 bullet IDs; it stays explicitly
 * historical rather than being guessed into a coincidentally numbered section.
 * Existing source labels are retained as search and old-URL aliases.
 * @param {{id?: string, era?: string, courseEra?: string, primaryTopic?: string, subtopics?: string[], officialCodes?: Array<{era: string, official_code: string}>}} raw
 * @returns {{subtopics: string[], officialTitles: string[], aliases: string[], codeRefs: string[], historical: boolean}}
 */
export function project0455Sections(raw) {
  const era = raw.courseEra ?? raw.era;
  const refs = Array.isArray(raw.officialCodes) ? raw.officialCodes : [];
  if (!era || !refs.length || refs.some((ref) => ref.era !== era || !ref.official_code)) {
    throw new Error(`0455 section projection lacks era-matched source codes for ${raw.id ?? "unknown"}`);
  }
  const historical = era === "2017_2019";
  if (!historical && era !== "2020_2022" && era !== "2023_2025") {
    throw new Error(`0455 section projection needs a reviewed era for ${raw.id ?? "unknown"}: ${era}`);
  }
  const aliases = [...new Set(Array.isArray(raw.subtopics) ? raw.subtopics : [])];
  const codeRefs = [...new Set(refs.map((ref) => `${ref.era}:${ref.official_code}`))];
  if (historical) {
    return { subtopics: [ECONOMICS_0455_EARLIER, ...aliases], officialTitles: [ECONOMICS_0455_EARLIER], aliases, codeRefs, historical };
  }
  const sections = [...new Set(refs.map((ref) => ref.official_code.replace(/\.\d+$/, "")))].map((code) => {
    const section = sectionByCode.get(code);
    if (!section) throw new Error(`0455 source code has no 2026 section mapping for ${raw.id ?? "unknown"}: ${era}:${code}`);
    return section;
  });
  if (!sections.some((section) => ECONOMICS_0455_TOPICS[section.topic] === raw.primaryTopic)) {
    throw new Error(`0455 source topic/section mismatch for ${raw.id ?? "unknown"}`);
  }
  const officialTitles = [...new Set(sections.map((section) => section.title))];
  return { subtopics: [...new Set([...officialTitles, ...aliases])], officialTitles, aliases, codeRefs, historical };
}
