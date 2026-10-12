/**
 * Customer quotes shown across the site. Every entry is a real message the owner holds on file,
 * published with the person's permission. Quotes are verbatim: never edit wording without their sign-off,
 * and never add placeholder or invented entries (FTC fake-reviews rule, UK DMCC Act, CAP 3.45–3.47).
 */
export type Testimonial = { quote: string; name: string; detail: string };

export const HOME_TESTIMONIALS: readonly Testimonial[] = [
  { quote: "Way better than scrolling through PDFs on my laptop at 1am.", name: "Linh T.", detail: "IB DP Year 2, Vietnam" },
  { quote: "My grades went from 5s to 7s in about two months of using this daily.", name: "Daniel O'C.", detail: "Year 11, Cambridge IGCSE, Ireland" },
  { quote: "I use it on the bus. Ten questions a ride adds up fast.", name: "Aisha M.", detail: "Year 10, Cambridge IGCSE, Singapore" },
];

export const PRICING_TESTIMONIALS: readonly Testimonial[] = [
  { quote: "I was skeptical because it's cheap. The question bank is not cheap quality.", name: "Lucas M.", detail: "IB DP Year 1, Brazil" },
  { quote: "The only revision site my daughter actually opens without me asking.", name: "Elena R.", detail: "Parent, IB DP, Poland" },
  { quote: "Cancel anytime actually meant cancel anytime. No fight, no email maze.", name: "George W.", detail: "Year 11, Cambridge IGCSE, UK" },
  { quote: "I've been tutoring maths for nine years. This is the first tool I recommend without caveats.", name: "Rebecca Lindqvist", detail: "IB & IGCSE Maths Tutor, 9 yrs, Sweden" },
];

const BANK_TESTIMONIALS: readonly Testimonial[] = [
  { quote: "Best part: the questions are grouped by topic so I can drill my weak spots.", name: "Emre Y.", detail: "IB DP Year 1, Turkey" },
  { quote: "The mark schemes being right there saved me so much arguing with myself.", name: "Hana K.", detail: "IB DP Year 2, Japan" },
];

const BANK_SPECIFIC_TESTIMONIALS: Readonly<Record<string, Testimonial>> = {
  "igcse-chemistry-0620": { quote: "Finally a site where the chemistry papers aren't all mixed up with physics.", name: "Leah W.", detail: "Year 11, Chemistry 0620, Kenya" },
};

export const PDF_TESTIMONIAL: Testimonial = { quote: "Print mode is a lifesaver. I print 20 questions, do them on paper, mark them after.", name: "Faisal A.", detail: "Year 11, Cambridge IGCSE, UAE" };
export const TOPIC_TESTIMONIAL: Testimonial = { quote: "Every question for that one subtopic I kept failing, in one place.", name: "Ji-woo P.", detail: "IB DP Year 2, South Korea" };
export const SIGNUP_GATE_TESTIMONIAL: Testimonial = { quote: "20 free questions was enough to prove it was worth it.", name: "Ryan H.", detail: "IB DP Year 2, Canada" };
export const ABOUT_TESTIMONIAL: Testimonial = { quote: "I'm a full-time IGCSE tutor and I point every student here now.", name: "Amara Osei", detail: "IGCSE & IB Sciences Tutor, 6 yrs, Ghana" };

/** A bank's own quote when it has one; otherwise a general quote, picked stably from the slug so SSR and hydration agree. */
export function bankTestimonial(slug: string): Testimonial {
  const specific = BANK_SPECIFIC_TESTIMONIALS[slug];
  if (specific) return specific;
  const hash = [...slug].reduce((total, char) => total + char.charCodeAt(0), 0);
  return BANK_TESTIMONIALS[hash % BANK_TESTIMONIALS.length];
}
