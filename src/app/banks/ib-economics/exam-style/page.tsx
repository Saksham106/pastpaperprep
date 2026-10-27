import type { Metadata } from "next";
import { ExamStyleCoursePage } from "@/components/ExamStyleCoursePage";

export const metadata: Metadata = {
  title: "IB Economics Exam-Style Practice | PastPaperPrep",
  description: "IB Economics revision notes, topic slides and activities, and exam-style/data-response practice for SL and HL.",
  robots: { index: false, follow: false },
};

export default function Page() {
  return ExamStyleCoursePage({
    course: "ib-economics",
    title: "IB Economics",
    description: "Revision notes, topic slides and activities, and exam-style/data-response practice for SL and HL. Some booklets include HL-only subtopics, labelled in the selector; SL students should skip those questions. Not every booklet includes answers.",
  });
}
