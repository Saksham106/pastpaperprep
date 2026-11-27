import type { Metadata } from "next";
import { QualificationHub } from "@/components/SearchLanding";
import { socialPreview } from "@/lib/seo";
import { IB_CHEMISTRY_NOTES_HREF, IB_MATHS_AI_NOTES_HREF, IB_PHYSICS_NOTES_HREF, NOTES_INDEX_HREF, aaNotesVisible, ibChemistryNotesVisible, ibMathsAiNotesVisible, ibPhysicsNotesVisible } from "@/lib/course-notes/visibility";
export const metadata: Metadata = {
  title: "IB Past Papers and Question Banks by Topic",
  description:
    "IB Diploma past-paper questions by topic for Maths AA and AI, Biology, Chemistry, Physics, Economics, Computer Science and Business Management, HL and SL.",
  alternates: { canonical: "/ib" },
  openGraph: { url: "/ib", type: "website", ...socialPreview("ib") },
};
export default function IbPage() {
  return (
    <QualificationHub
      qualification="IB Diploma"
      title="IB Diploma past-paper practice"
      notesHref={aaNotesVisible() ? NOTES_INDEX_HREF : undefined}
      chemistryNotesHref={ibChemistryNotesVisible() ? IB_CHEMISTRY_NOTES_HREF : undefined}
      physicsNotesHref={ibPhysicsNotesVisible() ? IB_PHYSICS_NOTES_HREF : undefined}
      mathsAiNotesHref={ibMathsAiNotesVisible() ? IB_MATHS_AI_NOTES_HREF : undefined}
      intro="Real IB Diploma past-paper questions sorted by topic, with mark schemes, for Maths AA and AI, the sciences, Economics and Computer Science at HL and SL."
    />
  );
}
