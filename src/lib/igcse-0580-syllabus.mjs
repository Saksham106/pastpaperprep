// Client-safe 0580 syllabus labels. The per-question section overlay (a 1.3 MB review
// ledger) stays in igcse-0580-section-retrieval-v3.mjs for server and build use.
import syllabus from "../data/igcse-0580-official-2025.json" with { type: "json" };

export const IGCSE_0580_SYLLABUS = syllabus;
export const IGCSE_0580_TOPICS = syllabus.topics.map(({ title }) => title);
export const IGCSE_0580_SECTIONS = syllabus.topics.flatMap((topic) => topic.sections.map((section) => ({
  ...section,
  topic: topic.title,
  displayTitle: `${section.code} ${section.title}`,
})));
