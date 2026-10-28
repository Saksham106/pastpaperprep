import { isPreviewQuestion } from "@/lib/access";
import type { BankSlug, CatalogBank } from "@/lib/catalog";
import { getCatalogBanksForDisplay, getCatalogBank } from "@/lib/catalog";
import { loadBankQuestions } from "@/lib/question-loader";
import type { UnifiedQuestion } from "@/lib/questions";
import { getTopicOptions } from "@/lib/taxonomy";
import { getTopicOptions as getRoutedTopicOptions } from "@/lib/taxonomy-router";
import { canonicalBiology0610Topic } from "@/lib/biology-0610-topic-aliases";
import { CURATED_TOPIC_LANDINGS } from "@/lib/search-landing-topic-content";

export type LandingTopic = {
  slug: string;
  label: string;
  count: number;
};

export type LandingPaper = {
  slug: string;
  label: string;
  paper: number;
  count: number;
};

export type DetailStats = {
  total: number;
  free: number;
  /** Where the slice shows up: papers for a topic page, topics for a paper page. */
  breakdown: Array<{ label: string; count: number }>;
};

export type LandingManifest = {
  bankSlug: BankSlug;
  topics: LandingTopic[];
  syllabusTopics: LandingTopic[];
  papers: LandingPaper[];
  questionCount: number;
  years: string;
  paperCount: number;
};

const CAMBRIDGE_OFFICIAL_PAGES: Partial<Record<BankSlug, string>> = {
  igcse: "https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-igcse-mathematics-0580/",
  "igcse-additional": "https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-igcse-mathematics-additional-0606/",
  "igcse-biology-0610": "https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-igcse-biology-0610/",
  "igcse-economics-0455": "https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-igcse-economics-0455/",
  "igcse-chemistry-0620": "https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-igcse-chemistry-0620/",
  "igcse-physics-0625": "https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-igcse-physics-0625/",
  "igcse-coordinated-sciences-0654": "https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-igcse-sciences-co-ordinated-double-0654/",
};

const COURSE_OVERVIEWS: Record<string, string> = {
  Mathematics: "The course moves from number and algebra into geometry, mensuration, trigonometry, transformations, probability, and statistics. The useful revision question is not whether you have seen a chapter, but whether you can recognise and combine its methods without a topic heading.",
  "Additional Mathematics": "The course develops algebra, functions, coordinate geometry, trigonometry, series, vectors, and calculus at a higher level of fluency. Practice should move from single-technique questions into problems where the method is not named for you.",
  Biology: "The course connects cells and biological molecules to plant and human systems, inheritance, variation, ecology, and biotechnology. Strong practice mixes recall with diagrams, data handling, experimental reasoning, and structured explanations.",
  Chemistry: "The course connects particles and atomic structure to bonding, stoichiometry, energetics, reactions, acids, metals, organic chemistry, analysis, and practical work. Revision needs both factual recall and repeated calculation, observation, and explanation practice.",
  Physics: "The course links measurement and mechanics with thermal physics, waves, electricity, magnetism, nuclear physics, space, and experimental reasoning. Units, graphs, models, uncertainty, and multi-step calculations matter as much as formula recall.",
  "Co-ordinated Sciences": "This double-award course combines Biology, Chemistry, and Physics while preserving each science's practical and reasoning skills. A useful study map keeps the three disciplines distinct, then deliberately mixes them when preparing for full papers.",
  Economics: "The course moves from scarcity and resource allocation through firms, households, government policy, trade, development, and the global economy. Practice should combine definitions and diagrams with calculations, data response, chains of reasoning, and supported evaluation.",
  "Mathematics AA": "Analysis and approaches emphasises algebraic reasoning, functions, proof, calculus, geometry, and mathematical argument. The course still spans all five IB mathematics themes, with HL requiring greater depth and synthesis than SL.",
  "Mathematics AI": "Applications and interpretation emphasises modelling, statistics, technology, and mathematics in context. The course still needs algebra, functions, geometry, and calculus, but questions often ask you to interpret a model or result rather than stop at a calculation.",
};

/** Pilot banks where every syllabus topic with real inventory gets its own landing page. */
const FULL_TOPIC_LANDING_BANKS = new Set<BankSlug>(["igcse"]);

const slugify = (value: string) => value
  .toLocaleLowerCase()
  .trim()
  .replace(/&/g, "and")
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-|-$/g, "");

const isUsefulTopic = (label: string) => Boolean(label)
  && !/^other$|^foundations?$/i.test(label)
  && !/unknown|unclassified/i.test(label);

function topicCounts(questions: UnifiedQuestion[], bankSlug: BankSlug) {
  const counts = new Map<string, number>();
  for (const question of questions) {
    const labels = new Set([question.primaryTopic, ...question.secondaryTopics]
      .filter(isUsefulTopic)
      .map((label) => bankSlug === "igcse-biology-0610" ? canonicalBiology0610Topic(label) : label));
    for (const label of labels) counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return counts;
}

function asLandingTopic(label: string, count: number): LandingTopic {
  return { label, count, slug: slugify(label) };
}

export function buildLandingManifest(bankSlug: BankSlug, questions: UnifiedQuestion[]): LandingManifest {
  const bank = getCatalogBank(bankSlug);
  if (!bank) throw new Error(`Unknown bank: ${bankSlug}`);

  const counts = topicCounts(questions, bankSlug);
  const ranked = [...counts.entries()]
    .filter(([, count]) => count >= 20)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  const preferred = bankSlug === "igcse-biology-0610"
    ? ["Enzymes", "Biological molecules"]
    : [];
  const preferredTopics = preferred
    .map((label) => [label, counts.get(label) ?? 0] as const)
    .filter(([, count]) => count >= 20);
  const curated = (CURATED_TOPIC_LANDINGS[bankSlug] ?? [])
    .map((label) => [label, counts.get(label) ?? 0] as const)
    .filter(([, count]) => count >= 20);
  const existingTopics = preferredTopics.length ? preferredTopics : ranked.slice(0, 2);
  const existingLabels = new Set(existingTopics.map(([label]) => label));

  const orderedLabels = (bankSlug === "igcse-biology-0610" || bankSlug === "igcse-additional"
    ? getRoutedTopicOptions(questions).filter((label) => counts.has(label))
    : getTopicOptions(questions).filter((label) => isUsefulTopic(label) && (counts.get(label) ?? 0) >= 5));
  const syllabusTopics = orderedLabels.map((label) => asLandingTopic(label, counts.get(label) ?? 0));
  const fullSyllabus = FULL_TOPIC_LANDING_BANKS.has(bankSlug)
    ? syllabusTopics.filter((topic) => topic.count >= 20).map((topic) => [topic.label, topic.count] as const)
    : [];

  const topicEntries: Array<readonly [string, number]> = [...existingTopics];
  for (const entry of [...curated, ...fullSyllabus]) {
    if (existingLabels.has(entry[0])) continue;
    existingLabels.add(entry[0]);
    topicEntries.push(entry);
  }
  const topics = topicEntries.map(([label, count]) => asLandingTopic(label, count));

  const paperCounts = new Map<number, number>();
  for (const question of questions) {
    paperCounts.set(question.paper, (paperCounts.get(question.paper) ?? 0) + 1);
  }
  const papers = [...paperCounts.entries()]
    .filter(([, count]) => count >= 20)
    .sort((a, b) => a[0] - b[0])
    .map(([paper, count]) => ({
      paper,
      count,
      slug: `paper-${paper}`,
      label: `Paper ${paper}`,
    }));

  return {
    bankSlug,
    topics,
    syllabusTopics,
    papers,
    questionCount: questions.length,
    years: bank.years,
    // The catalogue count comes from each bank's ingestion, which knows how that subject splits
    // papers (IB time zones, old AA HL Paper 3 options, Chemistry 1A/1B). A generic recount here
    // ignored time zones and showed 54 papers for IB Math AA HL instead of 110.
    paperCount: bank.paperCount,
  };
}

export async function getLandingManifest(bankSlug: BankSlug) {
  return buildLandingManifest(bankSlug, await loadBankQuestions(bankSlug));
}

export async function getLandingManifests() {
  return Promise.all(getCatalogBanksForDisplay().map((bank) => getLandingManifest(bank.slug)));
}

export function topicPath(bankSlug: string, topic: LandingTopic) {
  return `/banks/${bankSlug}/topics/${topic.slug}`;
}

export function paperPath(bankSlug: string, paper: LandingPaper) {
  return `/banks/${bankSlug}/papers/${paper.slug}`;
}

export function topicFilterHref(bankSlug: string, label: string) {
  return `/banks/${bankSlug}?topic=${encodeURIComponent(label)}`;
}

/** Only the top topics get a landing page, so pages drop out as counts shift. Old links land on the bank filtered to that topic. */
export function retiredTopicHref(manifest: LandingManifest, topicSlug: string) {
  const topic = manifest.syllabusTopics.find((item) => item.slug === topicSlug);
  return topic ? topicFilterHref(manifest.bankSlug, topic.label) : `/banks/${manifest.bankSlug}`;
}

export function paperFilterHref(bankSlug: string, paper: number) {
  return `/banks/${bankSlug}?paper=${encodeURIComponent(String(paper))}`;
}

export function officialQualificationSource(bank: CatalogBank) {
  return bank.qualification === "IB Diploma"
    ? "https://www.ibo.org/programmes/diploma-programme/curriculum/"
    : CAMBRIDGE_OFFICIAL_PAGES[bank.slug] ?? "https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/";
}

export function courseOverview(bank: CatalogBank) {
  return COURSE_OVERVIEWS[bank.subject]
    ?? `${bank.title} is organised into connected syllabus areas that should be practised first in focused sets and later in mixed, timed work.`;
}

/** Archive facts for a topic or paper landing, from the same questions its explorer filters. */
export function landingDetailStats(bankSlug: BankSlug, matches: readonly UnifiedQuestion[], kind: "topic" | "paper"): DetailStats {
  const counts = new Map<string, number>();
  for (const question of matches) {
    const labels = kind === "topic"
      ? [`Paper ${question.paper}`]
      : [...new Set([question.primaryTopic, ...question.secondaryTopics].filter(isUsefulTopic))];
    for (const label of labels) counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  const breakdown = [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => kind === "topic" ? a.label.localeCompare(b.label, undefined, { numeric: true }) : b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, 6);
  return {
    total: matches.length,
    free: matches.filter((question) => isPreviewQuestion(bankSlug, question.id)).length,
    breakdown,
  };
}

/** The course name students type into search, e.g. "IGCSE Mathematics 0580" or "IB Chemistry HL". */
export function bankSearchName(bank: CatalogBank) {
  if (bank.qualification !== "IB Diploma") return `IGCSE ${bank.shortName}`;
  return bank.shortName.startsWith("IB ") ? bank.shortName : `IB ${bank.shortName}`;
}
