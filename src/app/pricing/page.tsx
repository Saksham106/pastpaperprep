import Link from "next/link";
import { ArrowRight, Check } from "@phosphor-icons/react/dist/ssr";
import { BANKS } from "@/lib/banks";

export const metadata = { title: "Pricing" };

export default function PricingPage() {
  return (
    <section className="simple-page shell">
      <p className="eyebrow">Simple access</p>
      <h1>Pay for the question bank you need.</h1>
      <p className="page-lede">Each course will have its own access pass, with an all-access option for students and tutors who need more. Final pricing goes live with Stripe.</p>
      <div className="pricing-list">
        {BANKS.map((bank) => <article key={bank.slug}><span>{bank.shortName}</span><h2>Course access</h2><p>{bank.questionCount.toLocaleString()} questions, filters, answers, and future progress tracking.</p><ul><li><Check /> Full question bank</li><li><Check /> Worked answers where available</li><li><Check /> One secure student account</li></ul><Link href={`/banks/${bank.slug}`}>Preview the bank <ArrowRight /></Link></article>)}
      </div>
      <div className="launch-note"><strong>Not charging yet.</strong><p>Supabase accounts and Stripe checkout will be connected before launch. No fake checkout, no accidental payments.</p></div>
    </section>
  );
}
