import type { Metadata } from "next";
import { ExamStyleAASLPage } from "@/components/ExamStyleAASLPage";

export const metadata: Metadata = {
  title: "IB Mathematics AA SL Exam-Style Practice | PastPaperPrep",
  description: "IB Mathematics AA SL exam-style PDF practice for trigonometry and probability distributions.",
  robots: { index: false, follow: false },
};

export default function Page() {
  return ExamStyleAASLPage();
}
