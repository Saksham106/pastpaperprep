import type { Metadata } from "next";
import { QualificationHub } from "@/components/SearchLanding";
import { IGCSE_MATHS_NOTES_HREF, IGCSE_PHYSICS_NOTES_HREF, igcseMathsNotesVisible, igcsePhysicsNotesVisible } from "@/lib/course-notes/visibility";
export const metadata: Metadata = {
  title: "IGCSE Past Papers by Topic: Maths, Sciences and Economics",
  description:
    "Cambridge IGCSE past-paper questions sorted by topic for Maths 0580, Add Maths 0606, Biology 0610, Chemistry 0620, Physics 0625, 0654 and Economics 0455.",
  alternates: { canonical: "/cambridge-igcse" },
};
export default function CambridgeIgcsePage() {
  return (
    <QualificationHub
      qualification="Cambridge IGCSE"
      title="Cambridge IGCSE past-paper practice"
      notesHref={igcseMathsNotesVisible() ? IGCSE_MATHS_NOTES_HREF : undefined}
      physicsNotesHref={igcsePhysicsNotesVisible() ? IGCSE_PHYSICS_NOTES_HREF : undefined}
      intro="Real Cambridge IGCSE past-paper questions sorted by topic, with mark schemes, for Maths, Additional Maths, the sciences, Economics and Computer Science."
    />
  );
}
