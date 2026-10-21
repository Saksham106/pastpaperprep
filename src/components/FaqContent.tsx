import Link from "next/link";
import { LIFETIME_OFFER } from "@/lib/lifetime-offer";
import { formatPrice, PRICING_MODEL, priceForBankCount } from "@/lib/pricing-model";

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
    answer: "Cambridge IGCSE Maths 0580, Additional Maths 0606, Biology 0610, Chemistry 0620, Physics 0625, Co-ordinated Sciences 0654, Economics 0455 and Computer Science 0478. IB Diploma Maths AA and AI, Biology, Chemistry, Physics, Economics and Computer Science, each at HL and SL.",
    links: [{ href: "/#question-banks", label: "See every bank" }],
  },
  {
    question: "How much does PastPaperPrep cost?",
    answer: `Full past papers and the free years of every topic bank cost nothing. A plan for one bank is ${formatPrice(priceForBankCount("monthly", 1))} a month or ${formatPrice(priceForBankCount("annual", 1))} a year. ${PRICING_MODEL.builder.minBanks} to ${PRICING_MODEL.builder.maxBanks} banks start at ${formatPrice(priceForBankCount("monthly", PRICING_MODEL.builder.minBanks))} a month, and every bank is ${formatPrice(priceForBankCount("monthly", PRICING_MODEL.allAccess.minBanks))} a month or ${formatPrice(LIFETIME_OFFER.amountCents)} once for lifetime access. Prices are in US dollars.`,
    links: [{ href: "/pricing", label: "Compare plans" }],
  },
  {
    question: "Where do the questions come from?",
    answer: "Every question in the topic banks is from an official Cambridge IGCSE or IB Diploma past paper, not written to look like one. Each one is cut from its paper, matched to its mark scheme and tagged by syllabus topic. Spot a wrong tag or a cut-off image? Report it from the question and we fix it.",
  },
  {
    question: "Who is PastPaperPrep not for?",
    answer: "Students on other boards, such as Edexcel, AQA or A Level, since only Cambridge IGCSE and IB Diploma are covered. If you only want complete papers to sit as mocks, the free library is enough; a plan is for topic practice on recent years and PDF worksheets.",
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
