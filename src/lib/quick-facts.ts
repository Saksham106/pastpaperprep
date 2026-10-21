import { formatPrice, priceForBankCount } from "@/lib/pricing-model";

/**
 * Short question-and-answer facts for bank, topic and paper pages. Every number comes from the
 * bank's own archive, and every answer names its subject in full so it still reads correctly
 * when quoted on its own.
 */
export type QuickFact = { question: string; answer: string };

type Count = { label: string; count: number };

const n = (value: number) => value.toLocaleString("en-US");
const planPrice = () => `${formatPrice(priceForBankCount("monthly", 1))} a month`;

/** "A (12), B (9) and C (4)". */
function listCounts(items: readonly Count[]): string {
  const parts = items.map((item) => `${item.label} (${n(item.count)})`);
  return parts.length > 1 ? `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}` : parts[0] ?? "";
}

/** Years as "2016–2018" when consecutive, else "2016, 2018 and 2020". */
export function describeYears(years: readonly number[]): string {
  const sorted = [...new Set(years)].sort((a, b) => a - b);
  if (sorted.length === 0) return "";
  const consecutive = sorted.every((year, index) => index === 0 || year === sorted[index - 1] + 1);
  if (sorted.length === 1) return String(sorted[0]);
  if (consecutive) return `${sorted[0]}–${sorted.at(-1)}`;
  return `${sorted.slice(0, -1).join(", ")} and ${sorted.at(-1)}`;
}

function markSchemeFact(subject: string, explanations: boolean): QuickFact {
  return {
    question: `Do the ${subject} questions have answers?`,
    answer: `Yes. Each ${subject} question shows the official mark scheme answer.${explanations ? " Many also have a step-by-step worked explanation written by PastPaperPrep." : ""}`,
  };
}

function freeFact(subject: string, bankName: string, total: number, free: number): QuickFact {
  const question = `Are the ${subject} questions free?`;
  if (free >= total) return { question, answer: `Yes. All ${n(total)} ${subject} questions are free to practise.` };
  if (free === 0) return { question, answer: `No. The ${subject} questions need a plan for ${bankName}, from ${planPrice()}.` };
  return { question, answer: `${n(free)} of the ${n(total)} ${subject} questions are free to practise. The other ${n(total - free)} need a plan for ${bankName}, from ${planPrice()}.` };
}

export function topicFacts(input: { bankName: string; topic: string; total: number; free: number; bankTotal: number; years: string; papers: readonly Count[]; explanations: boolean }): QuickFact[] {
  const subject = `${input.bankName} ${input.topic}`;
  const share = input.bankTotal > 0 ? Math.round((input.total / input.bankTotal) * 100) : 0;
  const top = [...input.papers].sort((a, b) => b.count - a.count)[0];
  return [
    {
      question: `How often does ${input.topic} come up in ${input.bankName}?`,
      answer: `${input.topic} appears in ${n(input.total)} of the ${n(input.bankTotal)} ${input.bankName} past-paper questions on PastPaperPrep (${share}%), from papers sat ${input.years}.${top ? ` ${top.label} has the most ${input.topic} questions, with ${n(top.count)}.` : ""}`,
    },
    freeFact(subject, input.bankName, input.total, input.free),
    markSchemeFact(subject, input.explanations),
  ];
}

export function paperFacts(input: { bankName: string; paper: string; total: number; free: number; years: string; topics: readonly Count[]; explanations: boolean }): QuickFact[] {
  const subject = `${input.bankName} ${input.paper}`;
  const top = [...input.topics].sort((a, b) => b.count - a.count).slice(0, 3);
  return [
    ...(top.length ? [{
      question: `Which topics come up most in ${subject}?`,
      answer: `The most-tested topics in ${subject} are ${listCounts(top)}, out of ${n(input.total)} past-paper questions from ${input.years}.`,
    }] : []),
    freeFact(subject, input.bankName, input.total, input.free),
    markSchemeFact(subject, input.explanations),
  ];
}

export function bankFacts(input: { bankName: string; total: number; papers: number; years: string; topics: readonly Count[]; freeYears?: readonly number[]; explanations: boolean }): QuickFact[] {
  const top = [...input.topics].sort((a, b) => b.count - a.count).slice(0, 3);
  const free = input.freeYears?.length ? describeYears(input.freeYears) : "";
  return [
    {
      question: `How many questions are in the ${input.bankName} question bank?`,
      answer: `The ${input.bankName} question bank has ${n(input.total)} past-paper questions from ${n(input.papers)} papers, sat ${input.years}, sorted into ${n(input.topics.length)} topics.`,
    },
    ...(top.length ? [{
      question: `Which topics come up most in ${input.bankName}?`,
      answer: `The most-tested ${input.bankName} topics are ${listCounts(top)}, out of ${n(input.total)} questions. A question can count towards more than one topic.`,
    }] : []),
    {
      question: `Is the ${input.bankName} question bank free?`,
      answer: free
        ? `Partly. ${input.bankName} questions from ${free} are free with a free account. Newer questions and PDF worksheets need a plan, from ${planPrice()}.`
        : `No. The ${input.bankName} question bank needs a plan, from ${planPrice()}.`,
    },
    markSchemeFact(input.bankName, input.explanations),
  ];
}
