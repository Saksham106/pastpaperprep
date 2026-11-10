// Practice links and question counts for course notes. Server-side: reads each course's practice data.
// - AA (`aa-items`): the AA overlay, by syllabus item and taxonomy group, through the ib-sl / ib-hl banks.
// - IGCSE 0580 (`official-codes`): the 0580 section retrieval, by official section code, through the igcse bank.
// - IB Chemistry (`bank-subtopics`): the bank's own subtopic labels, counted ahead of time (subtopic-practice.ts).
import overlayJson from "@/data/aa-official-subtopics/overlay.json";
import retrieval0580Json from "@/data/igcse-0580-section-retrieval-v3.json";
import type { PracticeConfig } from "./config";
import { isExtension, lessonPath, type Course } from "./course";
import { GROUPS as GROUP_LIST, type Group } from "./groups";
import { subtopicPracticeFile, subtopicPracticeHref } from "./subtopic-practice";
import type { PerView, ViewLevel } from "./types";

export type PracticeLevel = "SL" | "HL";

type OverlayRecord = { id: string; level: PracticeLevel; groupIds: string[]; status: string; officialItems?: string[] };

const GROUPS = new Map(GROUP_LIST.map((group) => [group.id, group]));
const ACCEPTED = (overlayJson.records as OverlayRecord[]).filter((record) => record.status === "accepted");

const BANKS: Record<PracticeLevel, string> = { SL: "ib-sl", HL: "ib-hl" };

const countsByGroup = new Map<string, { SL: number; HL: number }>();
for (const record of ACCEPTED) {
  for (const groupId of new Set(record.groupIds)) {
    const entry = countsByGroup.get(groupId) ?? { SL: 0, HL: 0 };
    entry[record.level] += 1;
    countsByGroup.set(groupId, entry);
  }
}

const countsByItem = new Map<string, { SL: number; HL: number }>();
for (const record of ACCEPTED) {
  for (const item of new Set(record.officialItems ?? [])) {
    const entry = countsByItem.get(item) ?? { SL: 0, HL: 0 };
    entry[record.level] += 1;
    countsByItem.set(item, entry);
  }
}

/** Accepted questions in the group, per bank level. */
export function groupQuestionCounts(groupId: string): { SL: number; HL: number } {
  const entry = countsByGroup.get(groupId);
  return { SL: entry?.SL ?? 0, HL: entry?.HL ?? 0 };
}

/** Accepted questions tagged with a syllabus item (e.g. "5.16") at that level. */
export function itemQuestionCount(item: string, level: PracticeLevel): number {
  return countsByItem.get(item)?.[level] ?? 0;
}

/** Distinct accepted questions at a level across all of a topic's groups (one that sits in two groups counts once). */
export function topicQuestionCount(topicName: string, level: PracticeLevel): number {
  const ids = new Set([...GROUPS.values()].filter((group) => group.parentTopic === topicName).map((group) => group.id));
  const seen = new Set<string>();
  for (const record of ACCEPTED) if (record.level === level && record.groupIds.some((id) => ids.has(id))) seen.add(record.id);
  return seen.size;
}

// The `subject` value the bank index carries for current-course AA questions (note HL's capitals).
const AA_SUBJECTS: Record<PracticeLevel, string> = {
  SL: "Mathematics: analysis and approaches SL",
  HL: "Mathematics: Analysis and Approaches HL",
};

/**
 * Bank page filtered to the group, opening exactly the questions `groupQuestionCounts()` counts.
 * - No `topic` param: the explorer matches a picked topic on the primary topic only, so a question
 *   whose primary topic differs from the group's parent (partial fractions filed under Calculus)
 *   would vanish.
 * - `subject` pins the current AA course: the same bank holds older-syllabus papers whose legacy
 *   labels reuse some group names (e.g. "Correlation and regression"), and those are not counted.
 */
export function groupPracticeHref(groupId: string, level: PracticeLevel): string {
  const group = GROUPS.get(groupId);
  if (!group) throw new Error(`Unknown AA group ${groupId}`);
  return `/banks/${BANKS[level]}?subtopic=${encodeURIComponent(group.studentFacingName)}&subject=${encodeURIComponent(AA_SUBJECTS[level])}`;
}

/**
 * Bank page filtered to one syllabus item, opening exactly the questions `itemQuestionCount()` counts.
 * `item` only matches accepted current-course records (the only ones carrying item tags), so no
 * `subject` or `topic` param is needed.
 */
export function itemPracticeHref(item: string, level: PracticeLevel): string {
  return `/banks/${BANKS[level]}?item=${encodeURIComponent(item)}`;
}

/** The group a lesson's practice panel uses: AA groups map one-to-one to items, so the group containing the item. */
export function practiceGroupForItem(item: string, groups: readonly Group[] = GROUP_LIST): Group | undefined {
  return groups.find((entry) => entry.memberOfficialItems.includes(item));
}

// --- Official section codes (IGCSE 0580) ------------------------------------------------------------------------

type CodesPractice = Extract<PracticeConfig, { kind: "official-codes" }>;
type CodedRows = { id: string; sectionCodes: string[] }[];

/** Each source's rows: question id and its official section codes. Every row is a question in the bank. */
const CODE_SOURCES: Record<CodesPractice["source"], { bank: string; rows: CodedRows }> = {
  "igcse-0580-section-retrieval-v3": { bank: "igcse", rows: retrieval0580Json.rows as CodedRows },
};

const codeCounts = new Map<string, Map<string, number>>();
function countsForSource(source: CodesPractice["source"]): Map<string, number> {
  let counts = codeCounts.get(source);
  if (!counts) {
    counts = new Map();
    for (const row of CODE_SOURCES[source].rows) for (const code of new Set(row.sectionCodes)) counts.set(code, (counts.get(code) ?? 0) + 1);
    codeCounts.set(source, counts);
  }
  return counts;
}

/** The official code a lesson practises in that view, or undefined when the item has none at that level (an Extended-only section in the Core view). */
export function officialCode(course: Course, item: string, view: ViewLevel): string | undefined {
  const practice = course.practice;
  if (practice.kind !== "official-codes") return undefined;
  const entry = course.items.items.find((candidate) => candidate.item === item);
  if (!entry || (view === "base" && isExtension(course, entry.level))) return undefined;
  return practice.codes[view].replace("{item}", item);
}

/** Questions in the bank tagged with that official code. */
export function officialCodeCount(practice: CodesPractice, code: string): number {
  return countsForSource(practice.source).get(code) ?? 0;
}

/** Bank page filtered to one official code (the explorer's `officialCode` param), opening exactly `officialCodeCount()`. */
export function officialCodeHref(practice: CodesPractice, code: string): string {
  return `/banks/${CODE_SOURCES[practice.source].bank}?officialCode=${encodeURIComponent(`${practice.refPrefix}${code}`)}`;
}

// --- Per course: what the lesson and topic pages show --------------------------------------------------------------

const AA_LEVEL: Record<ViewLevel, PracticeLevel> = { base: "SL", extension: "HL" };
const perView = <T,>(make: (view: ViewLevel) => T): PerView<T> => ({ base: make("base"), extension: make("extension") });

export type PracticeInfo = {
  /** Sent with practice clicks: the AA taxonomy group, or the section's item for an official-codes course. */
  group: string;
  /** The lesson's syllabus item, for the button and copy, e.g. "5.16". */
  items: string;
  /** What the band practises when it is not the item itself: the bank subtopic (several lessons can share one). */
  name?: string;
  counts: PerView<number>;
  hrefs: PerView<string>;
  /** Other bank subtopics the lesson also teaches (a `bank-subtopics` item's `alsoPractises`), each with its own counts and links. */
  more?: { name: string; counts: PerView<number>; hrefs: PerView<string> }[];
  /** The item is stored at the course's extension level (AA: AHL), not merely empty in one view. */
  extensionOnly: boolean;
};

/** A lesson page's practise band, or undefined when the course has nowhere to practise the item. */
export function lessonPractice(course: Course, item: string): PracticeInfo | undefined {
  const practice = course.practice;
  if (practice.kind === "aa-items") {
    const group = practiceGroupForItem(item);
    if (!group) return undefined;
    const stored = course.items.items.find((entry) => entry.item === item);
    return { group: group.id, items: item, counts: perView((view) => itemQuestionCount(item, AA_LEVEL[view])), hrefs: perView((view) => itemPracticeHref(item, AA_LEVEL[view])), extensionOnly: !!stored && isExtension(course, stored.level) };
  }
  if (practice.kind === "bank-subtopics") {
    const entry = course.items.items.find((candidate) => candidate.item === item);
    if (!entry?.practice) return undefined;
    const file = subtopicPracticeFile(course);
    const label = entry.practice;
    const extensionOnly = isExtension(course, entry.level);
    const levelOf = (view: ViewLevel) => course.levels.labels[view];
    // An extension-level lesson has no base-view questions: its base view points at the extension bank (the band then says so).
    const band = (name: string) => ({
      name,
      counts: perView((view) => (view === "base" && extensionOnly ? 0 : file.subtopics[name]?.[levelOf(view)] ?? 0)),
      hrefs: perView((view) => subtopicPracticeHref(file, name, levelOf(view === "base" && extensionOnly ? "extension" : view))),
    });
    const more = (entry.alsoPractises ?? []).map(band);
    return { group: item, items: item, extensionOnly, ...band(label), ...(more.length ? { more } : {}) };
  }
  if (!course.items.items.some((entry) => entry.item === item)) return undefined;
  // An Extended-only section has no Core code: its base view points at the Extended questions (the band then says so).
  const code = (view: ViewLevel) => officialCode(course, item, view) ?? officialCode(course, item, "extension")!;
  return {
    group: item,
    items: item,
    extensionOnly: isExtension(course, course.items.items.find((entry) => entry.item === item)!.level),
    counts: perView((view) => (officialCode(course, item, view) ? officialCodeCount(practice, code(view)) : 0)),
    hrefs: perView((view) => officialCodeHref(practice, code(view))),
  };
}

export type StageLesson = { item: string; name: string; level: string; href?: string; summary?: string };
export type TopicStage = {
  id: string;
  name: string;
  /** Every item in the stage is extension-level (AA: HL only). */
  hlOnly: boolean;
  counts: PerView<number>;
  hrefs: PerView<string>;
  lessons: StageLesson[];
};

const stageLesson = (course: Course, item: string): StageLesson | undefined => {
  const entry = course.items.items.find((candidate) => candidate.item === item);
  if (!entry) return undefined;
  const lesson = course.lessons.find((candidate) => candidate.item === item);
  return { item: entry.item, name: lesson?.title ?? entry.name, level: entry.level, ...(lesson ? { href: lessonPath(course, lesson), summary: lesson.summary } : {}) };
};

/**
 * Stages for one topic page, every syllabus item included.
 * AA: its taxonomy groups in teaching order. An official-codes course: one stage per section, in syllabus order.
 */
export function topicStages(course: Course, topic: Course["topics"][number]): TopicStage[] {
  const practice = course.practice;
  if (practice.kind === "aa-items") {
    return GROUP_LIST.filter((group) => group.parentTopic === topic.name)
      .sort((a, b) => a.teachingOrder - b.teachingOrder)
      .map((group) => ({
        id: group.id,
        name: group.studentFacingName,
        hlOnly: !group.applicability.includes("SL"),
        counts: perView((view) => groupQuestionCounts(group.id)[AA_LEVEL[view]]),
        hrefs: perView((view) => groupPracticeHref(group.id, AA_LEVEL[view])),
        lessons: group.memberOfficialItems.flatMap((id) => stageLesson(course, id) ?? []),
      }));
  }
  return course.items.items
    .filter((entry) => entry.topic === topic.n)
    .map((entry) => {
      const info = lessonPractice(course, entry.item)!;
      return { id: entry.item, name: entry.name, hlOnly: isExtension(course, entry.level), counts: info.counts, hrefs: info.hrefs, lessons: [stageLesson(course, entry.item)!] };
    });
}

/** Distinct questions per view across a topic (one tagged with two of its sections counts once). */
export function topicQuestionTotals(course: Course, topic: Course["topics"][number]): PerView<number> {
  const practice = course.practice;
  if (practice.kind === "aa-items") return perView((view) => topicQuestionCount(topic.name, AA_LEVEL[view]));
  if (practice.kind === "bank-subtopics") return perView((view) => subtopicPracticeFile(course).topics[String(topic.n)]?.[course.levels.labels[view]] ?? 0);
  const items = course.items.items.filter((entry) => entry.topic === topic.n).map((entry) => entry.item);
  return perView((view) => {
    const codes = new Set(items.flatMap((item) => officialCode(course, item, view) ?? []));
    return CODE_SOURCES[practice.source].rows.filter((row) => row.sectionCodes.some((code) => codes.has(code))).length;
  });
}

