import { FileText, ListChecks } from "@phosphor-icons/react/dist/ssr";

/** The two ways into a course, shared by the landing page and dashboard switches. */
export const PRACTICE_MODES = [
  { id: "topics", label: "Practice by topic", icon: <ListChecks aria-hidden="true" weight="bold" /> },
  { id: "papers", label: "Full past papers", icon: <FileText aria-hidden="true" weight="bold" /> },
];
