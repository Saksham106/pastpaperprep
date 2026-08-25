import { notFound } from "next/navigation";
import { QuestionExplorer } from "@/components/QuestionExplorer";
import { BANKS, getBank, type BankSlug } from "@/lib/banks";
import { loadBankQuestions } from "@/lib/questions";

export function generateStaticParams() { return BANKS.map(({ slug }) => ({ slug })); }

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const bank = getBank((await params).slug);
  return bank ? { title: bank.shortName, description: bank.description } : {};
}

export default async function BankPage({ params }: { params: Promise<{ slug: string }> }) {
  const slug = (await params).slug as BankSlug;
  const bank = getBank(slug);
  if (!bank) notFound();
  const questions = loadBankQuestions(slug);

  return (
    <>
      <section className={`bank-hero ${bank.accent}`}>
        <div className="shell">
          <p className="eyebrow">{bank.qualification}</p>
          <h1>{bank.title}</h1>
          <p>{bank.description}</p>
          <div className="bank-hero-stats"><span><strong>{bank.questionCount.toLocaleString()}</strong> questions</span><span><strong>{bank.paperCount}</strong> papers</span><span><strong>{bank.years}</strong> coverage</span></div>
        </div>
      </section>
      <div className="shell"><QuestionExplorer questions={questions} /></div>
    </>
  );
}
