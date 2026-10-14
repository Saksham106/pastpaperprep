import Link from "next/link";

type PublicFaq = {
  question: string;
  answer: string;
  links?: readonly { href: string; label: string }[];
};

export const FAQS: readonly PublicFaq[] = [
  {
    question: "What is PastPaperPrep?",
    answer: "PastPaperPrep offers free Cambridge IGCSE and IB full past papers with matching mark schemes, plus searchable questions by topic. Choose a course, practise the original questions, check the official answer, and use a worked explanation where one has been published.",
  },
  {
    question: "What can I use for free?",
    answer: "Full papers and their matching mark schemes in the free past-paper library can be opened without signing up. In the separate topical question banks, guests can view up to 20 matching free questions; a free account unlocks the rest of the bank's free selection. Recent paid questions, saved worksheets and custom PDF export require eligible bank access and follow the relevant allowances.",
    links: [{ href: "/past-papers", label: "Browse free full papers" }],
  },
  {
    question: "Which courses are available?",
    answer: "The current catalogue covers Cambridge IGCSE and IB Diploma Mathematics, sciences, and Economics. The home page always shows the live banks that are ready to use.",
  },
  {
    question: "How do PDF worksheets work?",
    answer: "Filter a bank or select individual questions, choose questions, answers, or both, then build a printable worksheet. A single PDF can include up to 50 questions and requires paid access to that bank.",
  },
  {
    question: "Are mark schemes included?",
    answer: "Full papers in the free library are paired with their matching mark schemes. Topical questions show the official answer or mark-scheme extract where available, under the same free or paid access as the question. Eligible worksheet access lets you include those answers in a custom PDF.",
  },
  {
    question: "Are worked explanations available?",
    answer: "Yes, on selected questions in supported banks. The Explanation button walks through how to reach the answer. These are PastPaperPrep explanations, not official exam-board mark schemes, and they do not replace a complete course or video lessons. Availability is per question, and access follows that question's free or paid status. Paid explanations have a separate daily allowance rather than using the image-download allowance.",
    links: [
      { href: "/banks/ib-hl#worked-example", label: "See a public Maths worked example" },
      { href: "/banks/ib-physics-hl#worked-example", label: "See a public Physics worked example" },
    ],
  },
  {
    question: "How do I manage or cancel a subscription?",
    answer: "Open your account page and use Manage billing. That takes you to the secure billing portal for plan changes, payment details, invoices, and cancellation.",
  },
  {
    question: "Is PastPaperPrep affiliated with an exam board?",
    answer: "No. PastPaperPrep is an independent practice platform. Exam-board names are used only to identify the relevant qualifications and source material.",
  },
];

export function FaqContent() {
  return (
    <div className="public-surface">
      <div className="faq-page shell">
      <header className="faq-hero">
        <p className="eyebrow">Help centre</p>
        <h1>Frequently asked questions</h1>
        <p>Clear answers about free papers, topical practice, worked explanations, PDFs, and billing.</p>
      </header>

      <section className="faq-list" aria-label="PastPaperPrep frequently asked questions">
        {FAQS.map((faq) => (
          <article key={faq.question}>
            <h2>{faq.question}</h2>
            <p>{faq.answer}</p>
            {faq.links ? <p>{faq.links.map((link, index) => <span key={link.href}>{index ? " · " : ""}<Link href={link.href}>{link.label}</Link></span>)}</p> : null}
          </article>
        ))}
      </section>

      <aside className="faq-contact" aria-labelledby="faq-contact-heading">
        <div>
          <p className="eyebrow">Still stuck?</p>
          <h2 id="faq-contact-heading">Talk to a person.</h2>
          <p>Tell us which bank or account you are using and what went wrong. Screenshots help.</p>
        </div>
        <a className="button primary" href="mailto:hello@pastpaperprep.com">hello@pastpaperprep.com</a>
      </aside>

      <p className="faq-back"><Link href="/">Back to question banks</Link></p>
      </div>
    </div>
  );
}
