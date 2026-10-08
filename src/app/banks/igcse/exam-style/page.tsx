import type { Metadata } from "next";
import { ExamStyleCoursePage } from "@/components/ExamStyleCoursePage";
export const metadata: Metadata = { title: "IGCSE 0580 Exam-Style Practice | PastPaperPrep", description: "Topic-focused Cambridge IGCSE Mathematics 0580 revision booklets with worked answers.", robots: { index: false, follow: false } };
export default function Page() { return ExamStyleCoursePage({ course: "igcse-0580", title: "IGCSE Mathematics 0580", description: "Topic-focused revision booklets with practice questions and worked answers. Differentiation and functions booklets combine Pemberton exercises with Cambridge exam-question practice." }); }
