export type BankSlug = "igcse" | "ib-hl" | "ib-sl";

export type Bank = {
  slug: BankSlug;
  shortName: string;
  title: string;
  description: string;
  qualification: string;
  subject: string;
  questionCount: number;
  paperCount: number;
  years: string;
  accent: "cobalt" | "coral" | "lime";
  sourceBaseUrl: string;
};

export const BANKS: readonly Bank[] = [
  {
    slug: "igcse",
    shortName: "IGCSE 0580",
    title: "Cambridge IGCSE Mathematics 0580",
    description: "Build confidence across Core and Extended mathematics with questions sorted by topic.",
    qualification: "Cambridge IGCSE",
    subject: "Mathematics 0580",
    questionCount: 2684,
    paperCount: 147,
    years: "2016-2026",
    accent: "cobalt",
    sourceBaseUrl: "https://swati1977.github.io/igcse-0580-topic-practice",
  },
  {
    slug: "ib-hl",
    shortName: "IB Math AA HL",
    title: "IB Mathematics AA Higher Level",
    description: "Practise demanding AA HL questions by topic, paper, session, and skill.",
    qualification: "International Baccalaureate",
    subject: "Mathematics AA HL",
    questionCount: 841,
    paperCount: 104,
    years: "2017-2026",
    accent: "coral",
    sourceBaseUrl: "https://swati1977.github.io/ib-maths-aa-hl-topic-practice",
  },
  {
    slug: "ib-sl",
    shortName: "IB Math AA SL",
    title: "IB Mathematics AA Standard Level",
    description: "Target AA SL topics with real questions, worked solutions, and mark schemes.",
    qualification: "International Baccalaureate",
    subject: "Mathematics AA SL",
    questionCount: 578,
    paperCount: 62,
    years: "2017-2026",
    accent: "lime",
    sourceBaseUrl: "https://swati1977.github.io/ib-maths-aa-topic-finder",
  },
] as const;

export function getBank(slug: string): Bank | undefined {
  return BANKS.find((bank) => bank.slug === slug);
}
