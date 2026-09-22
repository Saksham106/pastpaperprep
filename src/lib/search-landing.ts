import type { BankSlug, CatalogBank } from "@/lib/catalog";
import { getCatalogBanksForDisplay, getCatalogBank } from "@/lib/catalog";
import { loadBankQuestions } from "@/lib/question-loader";
import type { UnifiedQuestion } from "@/lib/questions";
import { getTopicOptions } from "@/lib/taxonomy";

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

export type LandingManifest = {
  bankSlug: BankSlug;
  topics: LandingTopic[];
  syllabusTopics: LandingTopic[];
  papers: LandingPaper[];
  questionCount: number;
  years: string;
  paperCount: number;
};

const IGCSE_BIOLOGY_SYLLABUS_TOPICS = [
  "Characteristics and classification of living organisms",
  "Organisation of the organism",
  "Movement in and out of cells",
  "Biological molecules",
  "Enzymes",
  "Plant nutrition",
  "Human nutrition",
  "Transport in plants",
  "Transport in animals",
  "Diseases and immunity",
  "Gas exchange in humans",
  "Respiration",
  "Excretion in humans",
  "Coordination and response",
  "Drugs",
  "Reproduction",
  "Inheritance",
  "Variation and selection",
  "Organisms and their environment",
  "Human influences on ecosystems",
  "Biotechnology and genetic engineering",
] as const;

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

const slugify = (value: string) => value
  .toLocaleLowerCase()
  .trim()
  .replace(/&/g, "and")
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-|-$/g, "");

const isUsefulTopic = (label: string) => Boolean(label)
  && !/^other$|^foundations?$/i.test(label)
  && !/unknown|unclassified/i.test(label);

function topicCounts(questions: UnifiedQuestion[]) {
  const counts = new Map<string, number>();
  for (const question of questions) {
    for (const label of new Set([question.primaryTopic, ...question.secondaryTopics])) {
      if (isUsefulTopic(label)) counts.set(label, (counts.get(label) ?? 0) + 1);
    }
  }
  return counts;
}

function asLandingTopic(label: string, count: number): LandingTopic {
  return { label, count, slug: slugify(label) };
}

export function buildLandingManifest(bankSlug: BankSlug, questions: UnifiedQuestion[]): LandingManifest {
  const bank = getCatalogBank(bankSlug);
  if (!bank) throw new Error(`Unknown bank: ${bankSlug}`);

  const counts = topicCounts(questions);
  const ranked = [...counts.entries()]
    .filter(([, count]) => count >= 20)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  const preferred = bankSlug === "igcse-biology-0610"
    ? ["Enzymes", "Biological molecules"]
    : [];
  const preferredTopics = preferred
    .map((label) => [label, counts.get(label) ?? 0] as const)
    .filter(([, count]) => count >= 20);
  const topics = (preferredTopics.length ? preferredTopics : ranked.slice(0, 2))
    .map(([label, count]) => asLandingTopic(label, count));

  const orderedLabels = bankSlug === "igcse-biology-0610"
    ? IGCSE_BIOLOGY_SYLLABUS_TOPICS.filter((label) => counts.has(label))
    : getTopicOptions(questions).filter((label) => isUsefulTopic(label) && (counts.get(label) ?? 0) >= 5);
  const syllabusTopics = orderedLabels.map((label) => asLandingTopic(label, counts.get(label) ?? 0));

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
    paperCount: new Set(questions.map((question) => `${question.year}-${question.session}-${question.paper}-${question.component}`)).size,
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
