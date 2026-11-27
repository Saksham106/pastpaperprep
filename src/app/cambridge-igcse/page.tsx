import type { Metadata } from "next";
import { socialPreview } from "@/lib/seo";
import { QualificationHub } from "@/components/SearchLanding";
import { IGCSE_MATHS_NOTES_HREF, IGCSE_PHYSICS_NOTES_HREF, igcseMathsNotesVisible, igcsePhysicsNotesVisible } from "@/lib/course-notes/visibility";
export const metadata: Metadata = {
  title: "Cambridge IGCSE Past Papers by Topic",
  description:
    "Cambridge IGCSE past-paper questions by topic: Maths 0580, Add Maths 0606, Biology 0610, Chemistry 0620, Physics 0625, 0654, Economics 0455 and CS 0478.",
  alternates: { canonical: "/cambridge-igcse" },
  openGraph: { url: "/cambridge-igcse", type: "website", ...socialPreview("Cambridge IGCSE") },
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
