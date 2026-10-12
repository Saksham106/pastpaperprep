import type { Testimonial as TestimonialEntry } from "@/lib/testimonials";

/**
 * One customer quote. `inline` is the compact form used inside heroes and dialogs.
 * `signedOutOnly` hides it (via CSS, before paint) for anyone with a session: members practising every day don't need selling to.
 */
export function Testimonial({ testimonial, variant = "card", signedOutOnly = false }: { testimonial: TestimonialEntry; variant?: "card" | "inline"; signedOutOnly?: boolean }) {
  return <figure className={`testimonial testimonial-${variant}`} data-testimonial data-signed-out-only={signedOutOnly || undefined}>
    <blockquote><p>“{testimonial.quote}”</p></blockquote>
    <figcaption><strong>{testimonial.name}</strong><span>{testimonial.detail}</span></figcaption>
  </figure>;
}

export function TestimonialGrid({ testimonials, label }: { testimonials: readonly TestimonialEntry[]; label: string }) {
  return <section className="testimonial-grid" aria-label={label} data-count={testimonials.length}>
    {testimonials.map((testimonial) => <Testimonial testimonial={testimonial} key={testimonial.name} />)}
  </section>;
}
