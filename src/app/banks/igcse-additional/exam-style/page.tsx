import type { Metadata } from "next";
import { ExamStyleCoursePage } from "@/components/ExamStyleCoursePage";
export const metadata: Metadata = { title: "IGCSE 0606 Exam-Style Practice | PastPaperPrep", description: "Differentiation practice and worked answers for Cambridge IGCSE Additional Mathematics 0606.", robots: { index: false, follow: false } };
export default function Page() { return ExamStyleCoursePage({ course: "igcse-0606", title: "IGCSE Additional Mathematics 0606", description: "A comprehensive differentiation booklet with notes, Additional Mathematics textbook exercises, and 2016–2020 past-paper practice." }); }
