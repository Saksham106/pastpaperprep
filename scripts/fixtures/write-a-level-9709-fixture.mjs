// Writes src/data/production/a-level-maths-9709.json: FIXTURE rows only (no images, invented stems),
// so the hidden bank, its paper tabs and filters can be built and tested before real content lands.
// The content workspace replaces this file with the real runtime; keep the row shape when it does.
import { writeFileSync } from "node:fs";

const papers = [
  [1, ["Quadratics", "Trigonometry", "Integration"]],
  [2, ["Algebra", "Logarithmic and exponential functions", "Numerical solution of equations"]],
  [3, ["Trigonometry", "Vectors", "Complex numbers"]],
  [4, ["Forces and equilibrium", "Momentum", "Energy, work and power"]],
  [5, ["Representation of data", "Probability", "The normal distribution"]],
  [6, ["The Poisson distribution", "Sampling and estimation", "Hypothesis tests"]],
];
// May/June 2020 (free, not sat), Oct/Nov 2021 (free) and May/June 2024 (paid), one row each per paper.
const sittings = [[2020, "May/June", "s", 2], [2021, "October/November", "w", 1], [2024, "May/June", "s", 3]];
const slug = { "May/June": "may-june", "October/November": "oct-nov" };

const questions = papers.flatMap(([paper, topics]) => sittings.map(([year, session, , variant], index) => {
  const component = `${paper}${variant}`;
  const number = index + 1;
  const topic = topics[index];
  const stem = `Fixture question ${number} for Paper ${paper} (${topic}). Placeholder text, not a real past-paper question.`;
  return {
    id: `9709-${year}-${slug[session]}-${component}-q${number}`,
    bankSlug: "a-level-maths-9709",
    number, paper, year, session,
    zone: `Variant ${variant}`,
    component,
    subject: "Mathematics",
    course: "Cambridge International AS & A Level Mathematics 9709",
    primaryTopic: topic,
    secondaryTopics: [],
    subtopics: [],
    marks: paper === 1 || paper === 3 ? 8 : 6,
    maxMarks: paper === 1 || paper === 3 ? 75 : 50,
    summary: stem,
    accessibleText: stem,
    questionImages: [],
    markschemeImages: [],
  };
}));

const artifact = {
  version: 1,
  fixture: true,
  note: "Fixture rows for the staged 9709 bank. Not real questions. Replaced by the content workspace's runtime before release.",
  years: "2020-2026",
  paperCount: new Set(questions.map((q) => `${q.year}-${q.session}-${q.component}`)).size,
  questionCount: questions.length,
  questions,
};
writeFileSync(new URL("../../src/data/production/a-level-maths-9709.json", import.meta.url), `${JSON.stringify(artifact, null, 2)}\n`);
console.log(`wrote ${questions.length} fixture rows`);
