// The AA bank subtopic groups from the taxonomy. Server-side data; one module for practice and group-lessons.
import taxonomyJson from "@/data/aa-official-subtopics/taxonomy.json";

export type Group = { id: string; studentFacingName: string; parentTopic: string; memberOfficialItems: string[]; applicability: string[]; teachingOrder: number };

export const GROUPS = taxonomyJson.groups as Group[];
