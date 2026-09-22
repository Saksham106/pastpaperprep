import { Atom, ChartLineUp, Dna, Flask, MathOperations, Microscope } from "@phosphor-icons/react/dist/ssr";
export type CourseTone = "math" | "chemistry" | "physics" | "biology" | "economics" | "coordinated";

export function courseToneForBank(bank: { subject: string }): CourseTone {
  if (bank.subject.includes("Co-ordinated")) return "coordinated";
  if (bank.subject.includes("Chemistry")) return "chemistry";
  if (bank.subject.includes("Physics")) return "physics";
  if (bank.subject.includes("Biology")) return "biology";
  if (bank.subject.includes("Economics")) return "economics";
  return "math";
}

/**
 * `marker` marks the identity-bearing icon (the one that labels a subject). Decorative
 * repeats — a panel watermark, say — render with `marker={false}` so a subject is never
 * counted or announced twice.
 */
export function CourseIcon({ tone, marker = true }: { tone: CourseTone; marker?: boolean }) {
  const Icon = tone === "chemistry"
    ? Flask
    : tone === "physics"
      ? Atom
      : tone === "biology"
        ? Dna
        : tone === "economics"
          ? ChartLineUp
          : tone === "coordinated"
            ? Microscope
            : MathOperations;

  return (
    <span className="course-icon" data-course-icon={marker ? tone : undefined} aria-hidden="true">
      <Icon weight={tone === "math" ? "bold" : "duotone"} />
    </span>
  );
}
