import biology0610OfficialTaxonomy from "@/data/classification/igcse-biology-0610-official-taxonomy-v2.json";
import economicsTaxonomy from "@/data/igcse-economics-0455-taxonomy.json";
import coordinatedTaxonomy from "@/data/igcse-coordinated-sciences-0654-taxonomy.json";
import aaTaxonomy from "@/data/aa-official-subtopics/taxonomy.json";
import biologyOfficialTaxonomy from "@/data/ib-biology-official-subtopics/taxonomy.json";
import {
  getControlledSubtopics as getLegacyControlledSubtopics,
  getSubtopicGroups as getLegacySubtopicGroups,
  getTopicOptions as getLegacyTopicOptions,
} from "@/lib/taxonomy";
import type { UnifiedQuestion } from "@/lib/questions";

const BIOLOGY_0610_TOPIC_ORDER = [...new Set(biology0610OfficialTaxonomy.eras.flatMap((era) => era.topics.map((topic) => topic.title)))];
const BIOLOGY_0610_GROUPS_BY_ERA: Record<string, Record<string, readonly string[]>> = Object.fromEntries(
  biology0610OfficialTaxonomy.eras.map((era) => [era.era, Object.fromEntries(era.topics.map((topic) => [topic.title, topic.subtopics.map((subtopic) => subtopic.title)]))]),
);
const BIOLOGY_OFFICIAL_TOPIC_ORDER = [...new Set(biologyOfficialTaxonomy.curatedGroups.map((group) => group.parentTopic))];
const BIOLOGY_OFFICIAL_GROUPS: Record<string, readonly string[]> = Object.fromEntries(
  BIOLOGY_OFFICIAL_TOPIC_ORDER.map((topic) => [topic, biologyOfficialTaxonomy.curatedGroups.filter((group) => group.parentTopic === topic).map((group) => group.studentFacingName)]),
);

function isOfficialBiologyBank(bank: string | undefined): boolean {
  return bank === "ib-biology-hl" || bank === "ib-biology-sl";
}

const ECONOMICS_TOPIC_ORDER = economicsTaxonomy.student_topics.map((topic) => topic.label);
const ECONOMICS_GROUPS: Record<string, readonly string[]> = Object.fromEntries(
  economicsTaxonomy.student_topics.map((topic) => [
    topic.label,
    topic.detailed_subtopics.map((subtopic) => subtopic.label),
  ]),
);

const AA_TOPIC_ORDER = [...new Set(aaTaxonomy.groups
  .sort((left, right) => left.teachingOrder - right.teachingOrder)
  .map((group) => group.parentTopic))];
const AA_GROUPS: Record<string, readonly string[]> = Object.fromEntries(
  ["SL", "HL"].flatMap((level) => aaTaxonomy.groups
    .filter((group) => group.applicability.includes(level as "SL" | "HL"))
    .map((group) => [group.parentTopic, aaTaxonomy.groups
      .filter((candidate) => candidate.parentTopic === group.parentTopic && candidate.applicability.includes(level as "SL" | "HL"))
      .sort((left, right) => left.teachingOrder - right.teachingOrder)
      .map((candidate) => candidate.studentFacingName)])),
);

function isOfficial0610Bank(bank: string | undefined): bank is "igcse-biology-0610" {
  return bank === "igcse-biology-0610";
}

function isAaBank(bank: string | undefined): boolean {
  return bank === "ib-sl" || bank === "ib-hl";
}

function isCurrentAaQuestion(question: UnifiedQuestion): boolean {
  return isAaBank(question.bankSlug)
    && (Boolean(question.classificationProvenance)
      || (question.bankSlug === "ib-sl" && question.subject.toLocaleLowerCase() === "mathematics: analysis and approaches sl")
      || (question.bankSlug === "ib-hl" && question.courseEra === "aa-hl"));
}

function hasCurrentAa(questions: UnifiedQuestion[]): boolean {
  return questions.some(isCurrentAaQuestion);
}

function splitAaQuestions(questions: UnifiedQuestion[]): { current: UnifiedQuestion[]; legacy: UnifiedQuestion[] } {
  return {
    current: questions.filter(isCurrentAaQuestion),
    legacy: questions.filter((question) => !isCurrentAaQuestion(question)),
  };
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

/**
 * The emitted 0654 taxonomy is a FLAT document: `topics` already carries the printed
 * teaching order and subject, and `subtopics` carries each section's owning topic.
 * The adaptation below only groups what the document already states. It never derives
 * a label from an id, never collapses the three sciences into one subject, and never
 * re-maps a section across syllabus eras.
 */
const COORDINATED_TOPIC_ORDER = [...coordinatedTaxonomy.topics]
  .sort((left, right) => left.order - right.order)
  .map((topic) => topic.title);
const COORDINATED_GROUPS: Record<string, readonly string[]> = Object.fromEntries(
  [...coordinatedTaxonomy.topics]
    .sort((left, right) => left.order - right.order)
    .map((topic) => [
      topic.title,
      coordinatedTaxonomy.subtopics.filter((subtopic) => subtopic.ownerTopicId === topic.id).map((subtopic) => subtopic.title),
    ]),
);

function isReleaseBank(bank: string | undefined): bank is "igcse-biology-0610" | "igcse-economics-0455" | "igcse-coordinated-sciences-0654" {
  return bank === "igcse-biology-0610" || bank === "igcse-economics-0455" || bank === "igcse-coordinated-sciences-0654";
}

function isCoordinatedBank(bank: string | undefined): boolean {
  return bank === "igcse-coordinated-sciences-0654";
}

export function getControlledSubtopics(bankSlug: string, topic: string): readonly string[] {
  if (isAaBank(bankSlug)) return AA_GROUPS[topic] ?? [];
  if (isOfficialBiologyBank(bankSlug)) return BIOLOGY_OFFICIAL_GROUPS[topic] ?? [];
  if (bankSlug === "igcse-biology-0610") {
    return [...new Set(Object.values(BIOLOGY_0610_GROUPS_BY_ERA).flatMap((groups) => groups[topic] ?? []))];
  }
  if (bankSlug === "igcse-economics-0455") return ECONOMICS_GROUPS[topic] ?? [];
  if (isCoordinatedBank(bankSlug)) return COORDINATED_GROUPS[topic] ?? (COORDINATED_TOPIC_ORDER.includes(topic) ? [topic] : []);
  return getLegacyControlledSubtopics(bankSlug, topic);
}

export function getTopicOptions(questions: UnifiedQuestion[]): string[] {
  const bank = questions[0]?.bankSlug;
  if (isAaBank(bank) && hasCurrentAa(questions)) {
    const available = new Set(questions.flatMap((question) => [question.primaryTopic, ...question.secondaryTopics]).filter(Boolean));
    return [...AA_TOPIC_ORDER.filter((topic) => available.has(topic)), ...[...available].filter((topic) => !AA_TOPIC_ORDER.includes(topic)).sort()];
  }
  if (isOfficialBiologyBank(bank)) {
    const available = new Set(questions.flatMap((question) => [question.primaryTopic, ...question.secondaryTopics]).filter(Boolean));
    return [...BIOLOGY_OFFICIAL_TOPIC_ORDER.filter((topic) => available.has(topic)), ...[...available].filter((topic) => !BIOLOGY_OFFICIAL_TOPIC_ORDER.includes(topic)).sort()];
  }
  if (isCoordinatedBank(bank)) {
    const available = new Set(questions.flatMap((question) => [question.primaryTopic, ...question.secondaryTopics]).filter(Boolean));
    const ordered = COORDINATED_TOPIC_ORDER.filter((topic) => available.has(topic));
    const remaining = [...available].filter((topic) => !ordered.includes(topic)).sort();
    return [...ordered, ...remaining];
  }
  if (!isReleaseBank(bank)) return getLegacyTopicOptions(questions);
  const available = new Set(questions.flatMap((question) => [question.primaryTopic, ...question.secondaryTopics]));
  const order = bank === "igcse-biology-0610" ? BIOLOGY_0610_TOPIC_ORDER : ECONOMICS_TOPIC_ORDER;
  const ordered = order.filter((topic) => available.has(topic));
  const remaining = [...available].filter((topic) => !ordered.includes(topic)).sort();
  return [...ordered, ...remaining];
}

export function getSubtopicGroups(
  questions: UnifiedQuestion[],
  selectedTopics: string[],
  selectedSubtopics: string[],
): { all: string[]; relevant: string[]; other: string[]; selectedOutsideContext: string[] } {
  const bank = questions[0]?.bankSlug;
  if (isOfficialBiologyBank(bank)) {
    const all = [...new Set(questions.flatMap((question) => question.subtopics))];
    const available = new Set(all);
    const relevant = selectedTopics.length
      ? [...new Set(selectedTopics.flatMap((topic) => BIOLOGY_OFFICIAL_GROUPS[topic] ?? []).filter((label) => available.has(label)))]
      : all;
    const relevantSet = new Set(relevant);
    return {
      all,
      relevant,
      other: all.filter((subtopic) => !relevantSet.has(subtopic)),
      selectedOutsideContext: selectedSubtopics.filter((subtopic) => available.has(subtopic) && !relevantSet.has(subtopic)),
    };
  }
  if (isOfficial0610Bank(bank)) {
    const all = [...new Set(BIOLOGY_0610_TOPIC_ORDER.flatMap((topic) => Object.values(BIOLOGY_0610_GROUPS_BY_ERA).flatMap((groups) => groups[topic] ?? [])))].filter((label) => questions.some((question) => question.subtopics.includes(label)));
    const available = new Set(all);
    const relevant = selectedTopics.length
      ? [...new Set(questions
        .filter((question) => selectedTopics.includes(question.primaryTopic) || question.secondaryTopics.some((topic) => selectedTopics.includes(topic)))
        .flatMap((question) => question.subtopics)
        .filter((label) => available.has(label)))]
      : all;
    const relevantSet = new Set(relevant);
    return {
      all,
      relevant,
      other: all.filter((subtopic) => !relevantSet.has(subtopic)),
      selectedOutsideContext: selectedSubtopics.filter((subtopic) => available.has(subtopic) && !relevantSet.has(subtopic)),
    };
  }
  if (isAaBank(bank) && hasCurrentAa(questions)) {
    const { current, legacy } = splitAaQuestions(questions);
    const all = [...new Set(questions.flatMap((question) => question.subtopics))];
    const available = new Set(all);
    const currentRelevant = selectedTopics.length
      ? [...new Set(selectedTopics.flatMap((topic) => AA_GROUPS[topic] ?? []).filter((label) => available.has(label)))]
      : current.flatMap((question) => question.subtopics);
    const legacyRelevant = legacy.length
      ? getLegacySubtopicGroups(legacy, selectedTopics, selectedSubtopics).relevant
      : [];
    const relevant = [...new Set([...currentRelevant, ...legacyRelevant].filter((label) => available.has(label)))];
    const relevantSet = new Set(relevant);
    return {
      all,
      relevant,
      other: all.filter((subtopic) => !relevantSet.has(subtopic)),
      selectedOutsideContext: selectedSubtopics.filter((subtopic) => available.has(subtopic) && !relevantSet.has(subtopic)),
    };
  }
  if (!isReleaseBank(bank)) return getLegacySubtopicGroups(questions, selectedTopics, selectedSubtopics);
  const all = uniqueSorted(questions.flatMap((question) => [...question.subtopics, ...question.skills]));
  const available = new Set(all);
  let relevant = all;
  if (selectedTopics.length) {
    if (bank === "igcse-economics-0455") {
      relevant = uniqueSorted(selectedTopics.flatMap((topic) => ECONOMICS_GROUPS[topic] ?? []).filter((label) => available.has(label)));
    } else {
      const selected = new Set(selectedTopics);
      relevant = uniqueSorted(questions
        .filter((question) => selected.has(question.primaryTopic) || question.secondaryTopics.some((topic) => selected.has(topic)))
        .flatMap((question) => [...question.subtopics, ...question.skills])
        .filter((label) => available.has(label)));
    }
  }
  const relevantSet = new Set(relevant);
  return {
    all,
    relevant,
    other: all.filter((subtopic) => !relevantSet.has(subtopic)),
    selectedOutsideContext: selectedSubtopics.filter((subtopic) => available.has(subtopic) && !relevantSet.has(subtopic)),
  };
}
