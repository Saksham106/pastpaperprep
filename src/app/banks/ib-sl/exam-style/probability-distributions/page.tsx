import type { Metadata } from "next";
import { ExamStyleCoursePage } from "@/components/ExamStyleCoursePage";
export const metadata: Metadata = { title: "Probability Distributions Exam-Style Practice | IB Mathematics AA SL", description: "Probability distribution worksheets and mixed exam-style practice for IB Mathematics AA SL.", robots: { index: false, follow: false } };
export default function Page() { return ExamStyleCoursePage({ course: "ib-math-aa-sl", title: "Probability Distributions", description: "Binomial and normal distribution worksheets, plus mixed exam-style practice covering discrete random variables and expected value." }); }
