// Practice links and question counts for course-notes groups. Server-side: reads the AA overlay.
import overlayJson from "@/data/aa-official-subtopics/overlay.json";
import taxonomyJson from "@/data/aa-official-subtopics/taxonomy.json";

export type PracticeLevel = "SL" | "HL";

type Group = { id: string; studentFacingName: string; parentTopic: string };
type OverlayRecord = { id: string; level: PracticeLevel; groupIds: string[]; status: string };

const GROUPS = new Map((taxonomyJson.groups as Group[]).map((group) => [group.id, group]));
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

/** Accepted questions in the group, per bank level. */
export function groupQuestionCounts(groupId: string): { SL: number; HL: number } {
  const entry = countsByGroup.get(groupId);
  return { SL: entry?.SL ?? 0, HL: entry?.HL ?? 0 };
}

/** Distinct accepted questions at a level across all of a topic's groups (one that sits in two groups counts once). */
export function topicQuestionCount(topicName: string, level: PracticeLevel): number {
  const ids = new Set([...GROUPS.values()].filter((group) => group.parentTopic === topicName).map((group) => group.id));
  const seen = new Set<string>();
  for (const record of ACCEPTED) if (record.level === level && record.groupIds.some((id) => ids.has(id))) seen.add(record.id);
  return seen.size;
}

/** Bank page filtered to the group: `topic` is the parent topic, `subtopic` the group's student-facing name. */
export function groupPracticeHref(groupId: string, level: PracticeLevel): string {
  const group = GROUPS.get(groupId);
  if (!group) throw new Error(`Unknown AA group ${groupId}`);
  return `/banks/${BANKS[level]}?topic=${encodeURIComponent(group.parentTopic)}&subtopic=${encodeURIComponent(group.studentFacingName)}`;
}
