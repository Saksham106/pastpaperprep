import type { Testimonial as TestimonialEntry } from "@/lib/testimonials";

/** One customer quote. `inline` is the compact single-line form used inside heroes, dialogs, and forms. */
export function Testimonial({ testimonial, variant = "card" }: { testimonial: TestimonialEntry; variant?: "card" | "inline" }) {
  return <figure className={`testimonial testimonial-${variant}`} data-testimonial>
    <blockquote><p>“{testimonial.quote}”</p></blockquote>
    <figcaption><strong>{testimonial.name}</strong><span>{testimonial.detail}</span></figcaption>
  </figure>;
}

export function TestimonialGrid({ testimonials, label }: { testimonials: readonly TestimonialEntry[]; label: string }) {
  return <section className="testimonial-grid" aria-label={label} data-count={testimonials.length}>
    {testimonials.map((testimonial) => <Testimonial testimonial={testimonial} key={testimonial.name} />)}
  </section>;
}
