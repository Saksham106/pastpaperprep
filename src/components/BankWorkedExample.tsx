import Link from "next/link";
import { hasPublishedExplanations } from "@/lib/explanations";

// Original editorial examples. No question images, official mark allocations or premium
// explanation objects are read or copied to make this public, server-rendered section.
const MATHS_EXAMPLE = {
  topic: "Calculus",
  question: "Find the equation of the tangent to y = x² + 3x at x = 2.",
  steps: [
    { label: "Find the point.", text: "Substitute x = 2 into the curve: y = 2² + 3(2) = 10. The tangent passes through (2, 10)." },
    { label: "Find the gradient.", text: "Differentiate: dy/dx = 2x + 3. At x = 2, the tangent has gradient 7. The derivative gives the slope, not the y-coordinate." },
    { label: "Write the line.", text: "Use y − 10 = 7(x − 2). Expanding gives y = 7x − 4. Check: x = 2 gives y = 10, as it should." },
  ],
};
const PHYSICS_EXAMPLE = {
  topic: "Mechanics and motion",
  question: "A car moves at 2 m s⁻¹, then accelerates uniformly at 2 m s⁻² for 4 s. Find its final velocity and displacement.",
  steps: [
    { label: "Choose a model.", text: "Acceleration is constant, so use the constant-acceleration equations. Take the direction of motion as positive: u = 2 m s⁻¹, a = 2 m s⁻² and t = 4 s." },
    { label: "Find final velocity.", text: "v = u + at = 2 + 2(4) = 10 m s⁻¹. Velocity and acceleration have different units." },
    { label: "Find displacement.", text: "s = ut + ½at² = 2(4) + ½(2)(4²) = 24 m. Check with average velocity: ½(u + v)t = ½(2 + 10)(4) = 24 m." },
  ],
};

export function BankWorkedExample({ bankSlug, topic }: { bankSlug: string; topic?: string }) {
  if (!hasPublishedExplanations(bankSlug)) return null;
  const example = ["ib-hl", "ib-sl", "ib-ai-hl", "ib-ai-sl"].includes(bankSlug)
    ? MATHS_EXAMPLE : bankSlug === "ib-physics-hl" ? PHYSICS_EXAMPLE : null;
  if (!example) return null;

  // An unrelated topic gets a concise discovery link, not a repeated calculus/kinematics lesson.
  if (topic && topic !== example.topic) return (
    <p className="access-footnote">Published explanations are available on selected questions in this bank. Look for the Explanation button, or <Link href={`/banks/${bankSlug}#worked-example`}>see a public worked example</Link>. Availability is per question.</p>
  );

  return (
    <section id="worked-example" className="bank-seo-content bank-worked-example" aria-labelledby="worked-example-heading">
      <div>
        <p className="eyebrow">From answer to method</p>
        <h2 id="worked-example-heading">How a worked explanation helps</h2>
        <p>The official mark scheme tells you which answers and methods earn credit. A PastPaperPrep worked explanation breaks down the reasoning on a question where one has been published.</p>
        <p>Availability is per question. Look for the Explanation button beside the answer. Access follows the question&apos;s free or paid status; this is not a promise of explanations for every question or topic.</p>
        <Link href={`/banks/${bankSlug}?topic=${encodeURIComponent(example.topic)}`}>Practise {example.topic.toLowerCase()} questions</Link>
      </div>
      <div className="worked-example-body">
        <h3>A short worked example</h3>
        <p className="worked-example-provenance">Original illustration, not an official exam question or a copy of a paid explanation.</p>
        <p><strong>{example.question}</strong></p>
        <ol>{example.steps.map((step) => <li key={step.label}><strong>{step.label}</strong> {step.text}</li>)}</ol>
      </div>
    </section>
  );
}
