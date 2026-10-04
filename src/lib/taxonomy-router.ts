import { canonicalBiology0610Topic } from "@/lib/biology-0610-topic-aliases";
import { BIOLOGY_0610_EARLIER, BIOLOGY_0610_EARLIER_TOPIC, BIOLOGY_0610_SECTIONS, BIOLOGY_0610_TOPICS, display0610Sections } from "@/lib/igcse-0610-official.mjs";
import economicsTaxonomy from "@/data/igcse-economics-0455-taxonomy.json";
import { ECONOMICS_0455_TOPICS, ECONOMICS_0455_SECTIONS, ECONOMICS_0455_EARLIER } from "@/lib/igcse-0455-official.mjs";
import { OFFICIAL_0606_TOPICS, EARLIER_0606_TOPIC, EARLIER_0606_SUBTOPICS } from "@/lib/igcse-0606-official.mjs";
import { COORDINATED_0654_EARLIER, COORDINATED_0654_EARLIER_TOPIC, COORDINATED_0654_PRACTICAL_TOPIC, COORDINATED_0654_SECTIONS, COORDINATED_0654_TOPICS, display0654Sections } from "@/lib/igcse-0654-official.mjs";
import aaTaxonomy from "@/data/aa-official-subtopics/taxonomy.json";
import biologyOfficialTaxonomy from "@/data/ib-biology-official-subtopics/taxonomy.json";
import {
  getControlledSubtopics as getLegacyControlledSubtopics,
  getSubtopicGroups as getLegacySubtopicGroups,
  getTopicOptions as getLegacyTopicOptions,
} from "@/lib/taxonomy";
import type { UnifiedQuestion } from "@/lib/questions";
import { IGCSE_0580_TOPICS, IGCSE_0580_SECTIONS } from "@/lib/igcse-0580-section-retrieval-v3.mjs";
import { PHYSICS_0625_EARLIER, PHYSICS_0625_EARLIER_TOPIC, PHYSICS_0625_PRACTICAL_TOPIC, PHYSICS_0625_REVIEW, PHYSICS_0625_REVIEW_TOPIC, PHYSICS_0625_SECTIONS, PHYSICS_0625_TOPICS, display0625Sections } from "@/lib/igcse-0625-official.mjs";
import { CHEMISTRY_0620_EARLIER, CHEMISTRY_0620_EARLIER_TOPIC, CHEMISTRY_0620_PRACTICAL_TOPIC, CHEMISTRY_0620_REVIEW, CHEMISTRY_0620_REVIEW_TOPIC, CHEMISTRY_0620_SECTIONS, CHEMISTRY_0620_TOPICS, display0620Sections } from "@/lib/igcse-0620-official.mjs";

const BIOLOGY_0610_TOPIC_ORDER = BIOLOGY_0610_TOPICS;
const BIOLOGY_OFFICIAL_TOPIC_ORDER = [...new Set(biologyOfficialTaxonomy.curatedGroups.map((group) => group.parentTopic))];
const BIOLOGY_OFFICIAL_GROUPS: Record<string, readonly string[]> = Object.fromEntries(
  BIOLOGY_OFFICIAL_TOPIC_ORDER.map((topic) => [topic, biologyOfficialTaxonomy.curatedGroups.filter((group) => group.parentTopic === topic).map((group) => group.studentFacingName)]),
);

function isOfficialBiologyBank(bank: string | undefined): boolean {
  return bank === "ib-biology-hl" || bank === "ib-biology-sl";
}

const ECONOMICS_TOPIC_ORDER = economicsTaxonomy.student_topics.map((topic) => topic.label);
const OFFICIAL_0455_GROUPS: Record<string, readonly string[]> = Object.fromEntries(
  ECONOMICS_0455_TOPICS.map((topic, index) => [topic, ECONOMICS_0455_SECTIONS.filter((section) => section.topic === index).map((section) => section.title)]),
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
 * The 0654 student picker uses the pinned 2025–27 B/C/P heading tree.
 * Original era labels and practical skills stay on the question records for
 * search and legacy links; only verified current sections appear here.
 */
const COORDINATED_TOPIC_ORDER = COORDINATED_0654_TOPICS;
const COORDINATED_GROUPS: Record<string, readonly string[]> = Object.fromEntries(
  COORDINATED_TOPIC_ORDER.map((topic) => [topic, COORDINATED_0654_SECTIONS.filter((section) => section.topic === topic).map((section) => section.studentTitle)]),
);

function isReleaseBank(bank: string | undefined): bank is "igcse-biology-0610" | "igcse-economics-0455" | "igcse-coordinated-sciences-0654" {
  return bank === "igcse-biology-0610" || bank === "igcse-economics-0455" || bank === "igcse-coordinated-sciences-0654";
}

function isCoordinatedBank(bank: string | undefined): boolean {
  return bank === "igcse-coordinated-sciences-0654";
}

export function getControlledSubtopics(bankSlug: string, topic: string): readonly string[] {
  if (bankSlug === "igcse") return [...IGCSE_0580_SECTIONS.filter((section) => section.topic === topic).map((section) => section.displayTitle), ...getLegacyControlledSubtopics(bankSlug, topic)];
  if (bankSlug === "igcse-additional") return topic === EARLIER_0606_TOPIC ? EARLIER_0606_SUBTOPICS : [];
  if (bankSlug === "igcse-physics-0625") return topic === PHYSICS_0625_EARLIER_TOPIC ? [PHYSICS_0625_EARLIER] : topic === PHYSICS_0625_REVIEW_TOPIC ? [PHYSICS_0625_REVIEW] : topic === PHYSICS_0625_PRACTICAL_TOPIC ? [PHYSICS_0625_PRACTICAL_TOPIC] : PHYSICS_0625_SECTIONS.filter((section) => section.topic === topic).map((section) => section.title);
  if (bankSlug === "igcse-chemistry-0620") return topic === CHEMISTRY_0620_EARLIER_TOPIC ? [CHEMISTRY_0620_EARLIER] : topic === CHEMISTRY_0620_REVIEW_TOPIC ? [CHEMISTRY_0620_REVIEW] : topic === CHEMISTRY_0620_PRACTICAL_TOPIC ? [CHEMISTRY_0620_PRACTICAL_TOPIC] : CHEMISTRY_0620_SECTIONS.filter((section) => section.topic === topic).map((section) => section.title);
  if (isAaBank(bankSlug)) return AA_GROUPS[topic] ?? [];
  if (isOfficialBiologyBank(bankSlug)) return BIOLOGY_OFFICIAL_GROUPS[topic] ?? [];
  if (bankSlug === "igcse-biology-0610") {
    return topic === BIOLOGY_0610_EARLIER_TOPIC ? [BIOLOGY_0610_EARLIER] : BIOLOGY_0610_SECTIONS.filter((section) => section.topic === topic).map((section) => section.title);
  }
  if (bankSlug === "igcse-economics-0455") return OFFICIAL_0455_GROUPS[topic] ?? [];
  if (isCoordinatedBank(bankSlug)) return topic === COORDINATED_0654_EARLIER_TOPIC ? [COORDINATED_0654_EARLIER] : COORDINATED_GROUPS[topic] ?? (COORDINATED_TOPIC_ORDER.includes(topic) ? [topic] : []);
  return getLegacyControlledSubtopics(bankSlug, topic);
}

export function getTopicOptions(questions: UnifiedQuestion[]): string[] {
  const bank = questions[0]?.bankSlug;
  if (bank === "igcse") return [...IGCSE_0580_TOPICS];
  if (bank === "igcse-additional") {
    const available = new Set(questions.flatMap((question) => [question.primaryTopic, ...question.secondaryTopics]));
    return [...OFFICIAL_0606_TOPICS, ...(available.has(EARLIER_0606_TOPIC) ? [EARLIER_0606_TOPIC] : [])];
  }
  if (bank === "igcse-physics-0625") return [...PHYSICS_0625_TOPICS, ...(questions.some((question) => [question.primaryTopic, ...question.secondaryTopics].includes(PHYSICS_0625_EARLIER_TOPIC)) ? [PHYSICS_0625_EARLIER_TOPIC] : []), ...(questions.some((question) => question.primaryTopic === PHYSICS_0625_PRACTICAL_TOPIC) ? [PHYSICS_0625_PRACTICAL_TOPIC] : []), ...(questions.some((question) => [question.primaryTopic, ...question.secondaryTopics].includes(PHYSICS_0625_REVIEW_TOPIC)) ? [PHYSICS_0625_REVIEW_TOPIC] : [])];
  if (bank === "igcse-chemistry-0620") return [...CHEMISTRY_0620_TOPICS, ...(questions.some((question) => [question.primaryTopic, ...question.secondaryTopics].includes(CHEMISTRY_0620_EARLIER_TOPIC)) ? [CHEMISTRY_0620_EARLIER_TOPIC] : []), ...(questions.some((question) => question.primaryTopic === CHEMISTRY_0620_PRACTICAL_TOPIC) ? [CHEMISTRY_0620_PRACTICAL_TOPIC] : []), ...(questions.some((question) => [question.primaryTopic, ...question.secondaryTopics].includes(CHEMISTRY_0620_REVIEW_TOPIC)) ? [CHEMISTRY_0620_REVIEW_TOPIC] : [])];
  if (isAaBank(bank) && hasCurrentAa(questions)) {
    const available = new Set(questions.flatMap((question) => [question.primaryTopic, ...question.secondaryTopics]).filter(Boolean));
    return [...AA_TOPIC_ORDER.filter((topic) => available.has(topic)), ...[...available].filter((topic) => !AA_TOPIC_ORDER.includes(topic)).sort()];
  }
  if (isOfficialBiologyBank(bank)) {
    const available = new Set(questions.flatMap((question) => [question.primaryTopic, ...question.secondaryTopics]).filter(Boolean));
    return [...BIOLOGY_OFFICIAL_TOPIC_ORDER.filter((topic) => available.has(topic)), ...[...available].filter((topic) => !BIOLOGY_OFFICIAL_TOPIC_ORDER.includes(topic)).sort()];
  }
  if (isCoordinatedBank(bank)) {
    return [...COORDINATED_TOPIC_ORDER, ...(questions.some((question) => [question.primaryTopic, ...question.secondaryTopics].includes(COORDINATED_0654_EARLIER_TOPIC)) ? [COORDINATED_0654_EARLIER_TOPIC] : []), ...(questions.some((question) => question.primaryTopic === COORDINATED_0654_PRACTICAL_TOPIC) ? [COORDINATED_0654_PRACTICAL_TOPIC] : [])];
  }
  if (isOfficial0610Bank(bank)) return [...BIOLOGY_0610_TOPIC_ORDER, ...(questions.some((question) => question.primaryTopic === BIOLOGY_0610_EARLIER_TOPIC) ? [BIOLOGY_0610_EARLIER_TOPIC] : [])];
  if (!isReleaseBank(bank)) return getLegacyTopicOptions(questions);
  const available = new Set(questions.flatMap((question) => [question.primaryTopic, ...question.secondaryTopics]));
  const ordered = ECONOMICS_TOPIC_ORDER.filter((topic) => available.has(topic));
  const remaining = [...available].filter((topic) => !ordered.includes(topic)).sort();
  return [...ordered, ...remaining];
}

export function getSubtopicGroups(
  questions: UnifiedQuestion[],
  selectedTopics: string[],
  selectedSubtopics: string[],
): { all: string[]; relevant: string[]; other: string[]; selectedOutsideContext: string[] } {
  const bank = questions[0]?.bankSlug;
  if (bank === "igcse") {
    // Keep 0580's picker cleanup outside the sealed shared taxonomy source:
    // archived production audits bind its exact bytes for other banks.
    const available = new Set(questions.flatMap((question) => question.subtopics));
    const controlled = getLegacyTopicOptions(questions).flatMap((topic) => getLegacyControlledSubtopics(bank, topic));
    const official = IGCSE_0580_SECTIONS.map((section) => section.displayTitle);
    const legacy = uniqueSorted([...available, ...controlled]);
    const legacyFine = legacy.filter((label) => !official.includes(label));
    const all = [...official, ...legacy.filter((label) => !official.includes(label))];
    const relevant = selectedTopics.length
      ? [...new Set([...selectedTopics.flatMap((topic) => getControlledSubtopics(bank, topic)), ...questions.filter((question) => [question.primaryTopic, ...question.secondaryTopics].some((topic) => selectedTopics.includes(topic))).flatMap((question) => question.subtopics).filter((label) => legacyFine.includes(label))])]
      : all;
    const relevantSet = new Set(relevant);
    return { all, relevant, other: all.filter((label) => !relevantSet.has(label)), selectedOutsideContext: selectedSubtopics.filter((label) => available.has(label) && !relevantSet.has(label)) };
  }
  if (bank === "igcse-additional") {
    // The 14 official headings are topics, but the 17 original source labels
    // are still useful subtopic filters. Do not hide them while section work is open.
    const all = uniqueSorted(questions.flatMap((question) => question.subtopics));
    const available = new Set(all);
    const selected = new Set(selectedTopics);
    const currentSelected = new Set(selectedTopics.filter((topic) => topic !== EARLIER_0606_TOPIC));
    const currentLabels = currentSelected.size
      ? questions
        .filter((question) => [question.primaryTopic, ...question.secondaryTopics].some((topic) => currentSelected.has(topic)))
        .flatMap((question) => question.subtopics)
      : [];
    const earlierLabels = selected.has(EARLIER_0606_TOPIC)
      ? EARLIER_0606_SUBTOPICS.filter((label) => available.has(label))
      : [];
    const relevant = !selected.size ? all : currentSelected.size
      ? uniqueSorted([...earlierLabels, ...currentLabels])
      : [...earlierLabels];
    const relevantSet = new Set(relevant);
    return { all, relevant, other: all.filter((label) => !relevantSet.has(label)), selectedOutsideContext: selectedSubtopics.filter((label) => available.has(label) && !relevantSet.has(label)) };
  }
  if (bank === "igcse-economics-0455") {
    const all = [...ECONOMICS_0455_SECTIONS.map((section) => section.title),
      ...(questions.some((question) => question.subtopics.includes(ECONOMICS_0455_EARLIER)) ? [ECONOMICS_0455_EARLIER] : [])];
    const sourceLabels = new Set(questions.flatMap((question) => [...question.subtopics, ...question.skills]));
    const relevant = selectedTopics.length
      ? [...new Set(selectedTopics.flatMap((topic) => OFFICIAL_0455_GROUPS[topic] ?? []).concat(
        questions.some((question) => question.subtopics.includes(ECONOMICS_0455_EARLIER)
          && selectedTopics.some((topic) => topic === question.primaryTopic || question.secondaryTopics.includes(topic)))
          ? [ECONOMICS_0455_EARLIER] : [],
      ))]
      : all;
    return { all, relevant, other: all.filter((label) => !relevant.includes(label)), selectedOutsideContext: selectedSubtopics.filter((label) => sourceLabels.has(label) && !relevant.includes(label)) };
  }
  if (isCoordinatedBank(bank)) {
    const all = [...COORDINATED_0654_SECTIONS.map((section) => section.studentTitle), ...(questions.some((question) => question.officialCodeRefs?.includes("earlier:content")) ? [COORDINATED_0654_EARLIER] : [])];
    const available = new Set(all);
    const selected = new Set(selectedTopics);
    const relevant = selectedTopics.length === 1 && selectedTopics[0] === COORDINATED_0654_EARLIER_TOPIC
      ? [COORDINATED_0654_EARLIER]
      : selectedTopics.length
        ? [...new Set([...selectedTopics.flatMap((topic) => COORDINATED_GROUPS[topic] ?? []), ...questions
          .filter((question) => [question.primaryTopic, ...question.secondaryTopics].some((topic) => selected.has(topic)))
          .flatMap((question) => display0654Sections(question.officialCodeRefs ?? []))]
          .filter((label) => available.has(label) && (label !== COORDINATED_0654_EARLIER || selected.has(COORDINATED_0654_EARLIER_TOPIC))))]
        : all;
    const relevantSet = new Set(relevant);
    return { all, relevant, other: all.filter((label) => !relevantSet.has(label)), selectedOutsideContext: selectedSubtopics.filter((label) => available.has(label) && !relevantSet.has(label)) };
  }
  if (bank === "igcse-physics-0625") {
    const all = [...PHYSICS_0625_SECTIONS.map((section) => section.title), ...(questions.some((question) => question.officialCodeRefs?.includes("earlier:content")) ? [PHYSICS_0625_EARLIER] : []), ...(questions.some((question) => question.officialCodeRefs?.includes("unresolved:current")) ? [PHYSICS_0625_REVIEW] : [])];
    const available = new Set(all);
    const selected = new Set(selectedTopics);
    const special = selectedTopics.length === 1 && selected.has(PHYSICS_0625_EARLIER_TOPIC) ? [PHYSICS_0625_EARLIER] : selectedTopics.length === 1 && selected.has(PHYSICS_0625_REVIEW_TOPIC) ? [PHYSICS_0625_REVIEW] : null;
    const relevant = special ?? (selectedTopics.length ? [...new Set([...selectedTopics.flatMap((topic) => getControlledSubtopics(bank, topic)), ...questions.filter((question) => [question.primaryTopic, ...question.secondaryTopics].some((topic) => selected.has(topic))).flatMap((question) => display0625Sections(question.officialCodeRefs ?? []))].filter((label) => available.has(label) && (label !== PHYSICS_0625_EARLIER || selected.has(PHYSICS_0625_EARLIER_TOPIC)) && (label !== PHYSICS_0625_REVIEW || selected.has(PHYSICS_0625_REVIEW_TOPIC))))] : all);
    const relevantSet = new Set(relevant);
    return { all, relevant, other: all.filter((label) => !relevantSet.has(label)), selectedOutsideContext: selectedSubtopics.filter((label) => available.has(label) && !relevantSet.has(label)) };
  }
  if (bank === "igcse-chemistry-0620") {
    const all = [...CHEMISTRY_0620_SECTIONS.map((section) => section.title), ...(questions.some((question) => question.officialCodeRefs?.includes("earlier:content")) ? [CHEMISTRY_0620_EARLIER] : []), ...(questions.some((question) => question.officialCodeRefs?.includes("unresolved:current")) ? [CHEMISTRY_0620_REVIEW] : [])];
    const available = new Set(all);
    const selected = new Set(selectedTopics);
    const special = selectedTopics.length === 1 && selected.has(CHEMISTRY_0620_EARLIER_TOPIC) ? [CHEMISTRY_0620_EARLIER] : selectedTopics.length === 1 && selected.has(CHEMISTRY_0620_REVIEW_TOPIC) ? [CHEMISTRY_0620_REVIEW] : null;
    const relevant = special ?? (selectedTopics.length ? [...new Set([...selectedTopics.flatMap((topic) => getControlledSubtopics(bank, topic)), ...questions.filter((question) => [question.primaryTopic, ...question.secondaryTopics].some((topic) => selected.has(topic))).flatMap((question) => display0620Sections(question.officialCodeRefs ?? []))].filter((label) => available.has(label) && (label !== CHEMISTRY_0620_EARLIER || selected.has(CHEMISTRY_0620_EARLIER_TOPIC)) && (label !== CHEMISTRY_0620_REVIEW || selected.has(CHEMISTRY_0620_REVIEW_TOPIC))))] : all);
    const relevantSet = new Set(relevant);
    return { all, relevant, other: all.filter((label) => !relevantSet.has(label)), selectedOutsideContext: selectedSubtopics.filter((label) => available.has(label) && !relevantSet.has(label)) };
  }
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
    const all = [...BIOLOGY_0610_SECTIONS.map((section) => section.title), ...(questions.some((question) => display0610Sections(question.officialCodeRefs).includes(BIOLOGY_0610_EARLIER)) ? [BIOLOGY_0610_EARLIER] : [])];
    const available = new Set(all);
    const selected = new Set(selectedTopics.map(canonicalBiology0610Topic));
    const relevant = selectedTopics.length === 1 && selectedTopics[0] === BIOLOGY_0610_EARLIER_TOPIC
      ? [BIOLOGY_0610_EARLIER]
      : selectedTopics.length
      ? [...new Set([...selectedTopics.flatMap((topic) => getControlledSubtopics(bank, topic)), ...questions
        .filter((question) => [question.primaryTopic, ...question.secondaryTopics]
          .some((topic) => selected.has(canonicalBiology0610Topic(topic))))
        .flatMap((question) => display0610Sections(question.officialCodeRefs))]
        .filter((label) => available.has(label) && (label !== BIOLOGY_0610_EARLIER || selectedTopics.includes(BIOLOGY_0610_EARLIER_TOPIC))))]
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
    const selected = new Set(selectedTopics);
    relevant = uniqueSorted(questions
      .filter((question) => selected.has(question.primaryTopic) || question.secondaryTopics.some((topic) => selected.has(topic)))
      .flatMap((question) => [...question.subtopics, ...question.skills])
      .filter((label) => available.has(label)));
  }
  const relevantSet = new Set(relevant);
  return {
    all,
    relevant,
    other: all.filter((subtopic) => !relevantSet.has(subtopic)),
    selectedOutsideContext: selectedSubtopics.filter((subtopic) => available.has(subtopic) && !relevantSet.has(subtopic)),
  };
}
