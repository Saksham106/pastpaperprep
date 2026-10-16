import Link from "next/link";
import { hasPublishedExplanations } from "@/lib/explanations";

// Original editorial examples. No question images, official mark allocations or premium
// explanation objects are read or copied to make this public, server-rendered section.
type Example = { question: string; steps: readonly { label: string; text: string }[] };

const CALCULUS: Example = {
  question: "Find the equation of the tangent to y = x² + 3x at x = 2.",
  steps: [
    { label: "Find the point.", text: "y = 2² + 3(2) = 10, so the tangent passes through (2, 10)." },
    { label: "Find the gradient.", text: "dy/dx = 2x + 3, which is 7 at x = 2." },
    { label: "Write the line.", text: "y − 10 = 7(x − 2), so y = 7x − 4. Check: x = 2 gives y = 10." },
  ],
};
const QUADRATIC: Example = {
  question: "Solve x² + 3x − 10 = 0.",
  steps: [
    { label: "Factorise.", text: "Find two numbers that multiply to −10 and add to 3: 5 and −2. So (x + 5)(x − 2) = 0." },
    { label: "Solve each bracket.", text: "x + 5 = 0 or x − 2 = 0, so x = −5 or x = 2." },
    { label: "Check.", text: "2² + 3(2) − 10 = 0 and (−5)² + 3(−5) − 10 = 0." },
  ],
};
const KINEMATICS: Example = {
  question: "A car moving at 2 m s⁻¹ accelerates uniformly at 2 m s⁻² for 4 s. Find its final velocity and displacement.",
  steps: [
    { label: "Final velocity.", text: "v = u + at = 2 + 2(4) = 10 m s⁻¹." },
    { label: "Displacement.", text: "s = ut + ½at² = 2(4) + ½(2)(4²) = 24 m." },
    { label: "Check.", text: "Average velocity × time = ½(2 + 10)(4) = 24 m." },
  ],
};
const MOTION_GRAPH: Example = {
  question: "A car speeds up steadily from 2 m/s to 10 m/s in 4 s. Find its acceleration and the distance travelled.",
  steps: [
    { label: "Acceleration.", text: "a = change in velocity ÷ time = (10 − 2) ÷ 4 = 2 m/s²." },
    { label: "Distance.", text: "It is the area under the speed–time graph: ½(2 + 10) × 4 = 24 m." },
    { label: "Check units.", text: "m/s ÷ s gives m/s²; m/s × s gives m." },
  ],
};

// Bank → example and the topic it practises. Banks with explanations but no fitting example show nothing.
const EXAMPLES: Readonly<Record<string, { topic: string; example: Example }>> = {
  igcse: { topic: "Algebra and graphs", example: QUADRATIC },
  "igcse-additional": { topic: "Calculus", example: CALCULUS },
  "ib-hl": { topic: "Calculus", example: CALCULUS },
  "ib-sl": { topic: "Calculus", example: CALCULUS },
  "ib-ai-hl": { topic: "Calculus", example: CALCULUS },
  "ib-ai-sl": { topic: "Calculus", example: CALCULUS },
  "ib-physics-hl": { topic: "Mechanics and motion", example: KINEMATICS },
  "ib-physics-sl": { topic: "Mechanics and motion", example: KINEMATICS },
  "igcse-physics-0625": { topic: "Motion, forces and energy", example: MOTION_GRAPH },
};

/** On a topic page, renders only when the topic matches the example. */
export function BankWorkedExample({ bankSlug, topic }: { bankSlug: string; topic?: string }) {
  const entry = EXAMPLES[bankSlug];
  if (!entry || !hasPublishedExplanations(bankSlug) || (topic && topic !== entry.topic)) return null;
  const { example } = entry;

  return (
    <section id="worked-example" className="bank-seo-content bank-worked-example" aria-labelledby="worked-example-heading">
      <div>
        <p className="eyebrow">Worked explanations</p>
        <h2 id="worked-example-heading">See the method, not just the answer</h2>
        <p>Many questions have an Explanation button next to the answer. It follows the question&apos;s free or paid access.</p>
        <Link href={`/banks/${bankSlug}?topic=${encodeURIComponent(entry.topic)}`}>Practise {entry.topic.toLowerCase()}</Link>
      </div>
      <div className="worked-example-body">
        <h3>Example</h3>
        <p className="worked-example-provenance">Original example, not an exam question.</p>
        <p><strong>{example.question}</strong></p>
        <ol>{example.steps.map((step) => <li key={step.label}><strong>{step.label}</strong> {step.text}</li>)}</ol>
      </div>
    </section>
  );
}
