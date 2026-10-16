import Link from "next/link";

type PublicFaq = {
  question: string;
  answer: string;
  links?: readonly { href: string; label: string }[];
};

export const FAQS: readonly PublicFaq[] = [
  {
    question: "What is PastPaperPrep?",
    answer: "Free Cambridge IGCSE and IB past papers with their mark schemes, plus real exam questions sorted by topic. Practise, check the official answer, and open a worked explanation when you get stuck.",
  },
  {
    question: "What can I use for free?",
    answer: "All full papers and mark schemes, with no sign-up. In the topic banks, guests see up to 20 free questions and a free account opens the rest. Newer questions and PDF worksheets need a plan.",
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
    answer: "Yes. Every full paper comes with its official mark scheme, and topic questions show the official answer. You can also add answers to a PDF worksheet.",
  },
  {
    question: "Are worked explanations available?",
    answer: "Yes, on many questions. Tap Explanation next to the answer to see the method step by step. They're written by PastPaperPrep, not the exam board, and follow the question's free or paid access.",
    links: [{ href: "/banks/ib-hl#worked-example", label: "See an example" }],
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
