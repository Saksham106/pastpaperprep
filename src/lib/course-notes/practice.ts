// Practice links and question counts for course-notes groups. Server-side: reads the AA overlay.
import overlayJson from "@/data/aa-official-subtopics/overlay.json";
import { GROUPS as GROUP_LIST, type Group } from "./groups";

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
