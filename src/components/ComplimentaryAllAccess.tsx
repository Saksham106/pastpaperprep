import Image from "next/image";
import Link from "next/link";
import { BookOpen, CrownSimple, SlidersHorizontal, Sparkle } from "@phosphor-icons/react/dist/ssr";

const plans = [
  { name: "One Bank", label: "One bank", description: "Focus on one syllabus.", tone: "starter", Icon: BookOpen, artwork: "/artwork/aristotle-tutoring-alexander.webp" },
  { name: "Build Your Plan", label: "2 to 5 banks", description: "Mix the banks you actually take.", tone: "builder", Icon: SlidersHorizontal, artwork: "/artwork/school-of-athens-plato-aristotle.webp" },
  { name: "All Access", label: "Every bank", description: "Everything, including future banks.", tone: "premium", Icon: CrownSimple, artwork: "/artwork/plato-academy-mosaic.webp" },
] as const;

/** Display-only: a manual entitlement never becomes a Stripe plan or a purchase CTA. */
export function ComplimentaryAllAccess() {
  return <div className="complimentary-access">
    <div className="complimentary-welcome">
      <span className="complimentary-welcome-mark" aria-hidden="true"><Sparkle weight="fill" /></span>
      <div>
        <p className="complimentary-welcome-label">Your access is active</p>
        <h2>Complimentary All Access</h2>
        <p>Every question bank is yours to explore. No subscription needed for this access.</p>
      </div>
    </div>
    <div className="pricing-decision-grid account-pricing-grid complimentary-plan-grid" aria-label="Your access across plans" data-paid="true">
      {plans.map(({ name, label, description, tone, Icon, artwork }) => <article key={name} className={`pricing-option${tone === "premium" ? " pricing-option-current" : ""}`} data-plan-tone={tone} data-current-plan={tone === "premium" ? "true" : undefined}>
        <Image className="plan-art" src={artwork} alt="" width={420} height={260} loading="eager" aria-hidden="true" sizes="(max-width: 1024px) 68vw, 300px" />
        <div className="pricing-option-heading"><div className="plan-title-block"><span className="plan-icon" aria-hidden="true"><Icon weight="duotone" /></span><div><p className="plan-label">{label}</p><h2>{name}</h2></div></div>
          {tone === "premium" ? <span className="pricing-badge pricing-badge-current">Your access</span> : null}</div>
        <p className="plan-description">{description}</p>
        <div className="plan-checkout">
          <p className="complimentary-plan-note">{tone === "premium" ? "Included with your complimentary access." : "Already covered by All Access."}</p>
          {tone === "premium" ? <Link className="button primary" href="/dashboard">Browse question banks</Link> : <span className="complimentary-plan-included">Included in All Access</span>}
        </div>
      </article>)}
    </div>
  </div>;
}
