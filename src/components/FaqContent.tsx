import Link from "next/link";

export const FAQS = [
  {
    question: "What is PastPaperPrep?",
    answer: "PastPaperPrep organises real Cambridge IGCSE and IB past-paper questions into searchable question banks. Choose a course, filter to the exact topic you need, practise the original question, and check the available mark scheme.",
  },
  {
    question: "What can I use for free?",
    answer: "Every live bank includes complete older exam years that you can practise without paid access. Paid access unlocks the full available bank, mark schemes, and PDF worksheet export for the bank or bundle you choose.",
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
    answer: "Official mark-scheme extracts are shown where they are available in the bank. You can view them while practising and include them when building a PDF with the relevant access.",
  },
  {
    question: "How do I manage or cancel a subscription?",
    answer: "Open your account page and use Manage billing. That takes you to the secure billing portal for plan changes, payment details, invoices, and cancellation.",
  },
  {
    question: "Is PastPaperPrep affiliated with an exam board?",
    answer: "No. PastPaperPrep is an independent practice platform. Exam-board names are used only to identify the relevant qualifications and source material.",
  },
] as const;

export function FaqContent() {
  return (
    <div className="public-surface">
      <div className="faq-page shell">
      <header className="faq-hero">
        <p className="eyebrow">Help centre</p>
        <h1>Frequently asked questions</h1>
        <p>Clear answers about free access, question banks, mark schemes, PDFs, and billing.</p>
      </header>

      <section className="faq-list" aria-label="PastPaperPrep frequently asked questions">
        {FAQS.map((faq) => (
          <article key={faq.question}>
            <h2>{faq.question}</h2>
            <p>{faq.answer}</p>
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
