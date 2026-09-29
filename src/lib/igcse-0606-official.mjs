// Cambridge IGCSE Additional Mathematics 0606, syllabus for exams 2025–2027.
// The 14 numbered syllabus headings are topics, not invented subtopic headings.
export const OFFICIAL_0606_TOPICS = Object.freeze([
  "Functions", "Quadratic functions", "Factors of polynomials",
  "Equations, inequalities and graphs", "Simultaneous equations",
  "Logarithmic and exponential functions", "Straight-line graphs",
  "Coordinate geometry of the circle", "Circular measure", "Trigonometry",
  "Permutations and combinations", "Series", "Vectors in two dimensions", "Calculus",
]);
export const EARLIER_0606_TOPIC = "Earlier syllabus topics";
export const EARLIER_0606_SUBTOPICS = Object.freeze([
  "Set language and notation", "Indices and surds", "Matrices",
]);
const official = new Set(OFFICIAL_0606_TOPICS);
const earlier = new Set(EARLIER_0606_SUBTOPICS);
// Printed 2025 QP reviewed against §4.3 (substitution to a quadratic), §5.1
// (simultaneous equations), and §6.3. Fractional indices are assumed 0580
// knowledge in the 2025–27 0606 syllabus, not an earlier-only topic for these
// current papers. Source QP hashes, pages, and operation-level decisions are
// pinned in docs/igcse-0606-current-era-review.md; source rows stay untouched.
const CURRENT_ERA_REVIEWED = Object.freeze({
  "0606-2025-march-22-q3": ["Equations, inequalities and graphs"],
  "0606-2025-june-11-q4": ["Simultaneous equations", "Equations, inequalities and graphs"],
  "0606-2025-june-12-q2": ["Equations, inequalities and graphs"],
  "0606-2025-june-23-q13": ["Equations, inequalities and graphs", "Logarithmic and exponential functions"],
});

/**
 * Project already-reviewed source labels without changing source classification.
 * @param {{id?: string, year?: number, primaryTopic?: string, secondaryTopics?: string[], subtopics?: string[]}} raw
 * @returns {{primaryTopic: string, secondaryTopics: string[]}}
 */
export function project0606Topics(raw) {
  const labels = Array.isArray(raw.subtopics) ? raw.subtopics : [];
  const unknown = labels.filter((label) => !official.has(label) && !earlier.has(label));
  if (!labels.length || unknown.length) {
    throw new Error(`0606 official topic projection has unmapped source labels for ${raw.id ?? "unknown"}: ${unknown.join(", ")}`);
  }
  const hasHistoricalLabel = labels.some((label) => earlier.has(label));
  const reviewed = CURRENT_ERA_REVIEWED[raw.id ?? ""];
  if (hasHistoricalLabel && (raw.year ?? 0) >= 2025 && !reviewed) {
    throw new Error(`0606 current-era historical label needs source review: ${raw.id ?? "unknown"}`);
  }
  const current = [...new Set(reviewed ?? labels.filter((label) => official.has(label)))];
  const hasEarlier = hasHistoricalLabel && (raw.year ?? 0) < 2025;
  const primaryTopic = current[0] ?? EARLIER_0606_TOPIC;
  const previous = [raw.primaryTopic, ...(Array.isArray(raw.secondaryTopics) ? raw.secondaryTopics : [])]
    .filter((label) => typeof label === "string" && label);
  /** @type {string[]} */
  const secondaryTopics = [...new Set([
    ...current.slice(1),
    ...(hasEarlier && primaryTopic !== EARLIER_0606_TOPIC ? [EARLIER_0606_TOPIC] : []),
    ...previous, // Existing topic URLs and text search remain valid aliases.
  ])].filter((label) => label !== primaryTopic);
  return { primaryTopic, secondaryTopics };
}
