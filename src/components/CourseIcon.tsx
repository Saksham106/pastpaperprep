import { Atom, Dna, Flask, Function as FunctionIcon } from "@phosphor-icons/react/dist/ssr";
import type { Bank } from "@/lib/banks";

export type CourseTone = "math" | "chemistry" | "physics" | "biology";

export function courseToneForBank(bank: Bank): CourseTone {
  if (bank.subject.includes("Chemistry")) return "chemistry";
  if (bank.subject.includes("Physics")) return "physics";
  if (bank.subject.includes("Biology")) return "biology";
  return "math";
}

export function CourseIcon({ tone }: { tone: CourseTone }) {
  const Icon = tone === "chemistry" ? Flask : tone === "physics" ? Atom : tone === "biology" ? Dna : FunctionIcon;

  return (
    <span className="course-icon" data-course-icon={tone} aria-hidden="true">
      <Icon weight={tone === "math" ? "bold" : "duotone"} />
    </span>
  );
}
