export type BankSlug = "igcse" | "igcse-additional" | "ib-hl" | "ib-sl" | "ib-ai-hl" | "ib-ai-sl" | "ib-chemistry-hl" | "ib-chemistry-sl";

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
    sourceBaseUrl: "https://saksham106.github.io/igcse-0580-topic-practice",
  },
  {
    slug: "igcse-additional",
    shortName: "IGCSE Additional Math 0606",
    title: "Cambridge IGCSE Additional Mathematics 0606",
    description: "Practise Additional Mathematics questions by syllabus topic, year, paper, and component.",
    qualification: "Cambridge IGCSE",
    subject: "Additional Mathematics 0606",
    questionCount: 1633,
    paperCount: 145,
    years: "2016-2026",
    accent: "coral",
    sourceBaseUrl: "https://saksham106.github.io/igcse-additional-mathematics-0606-topic-practice",
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
    sourceBaseUrl: "https://saksham106.github.io/ib-maths-aa-hl-topic-practice",
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
    sourceBaseUrl: "https://saksham106.github.io/ib-maths-aa-topic-finder",
  },
  {
    slug: "ib-ai-hl",
    shortName: "IB Math AI HL",
    title: "IB Mathematics AI Higher Level",
    description: "Practise real AI HL questions by topic, paper, session, and skill with worked mark schemes.",
    qualification: "International Baccalaureate",
    subject: "Mathematics AI HL",
    questionCount: 409,
    paperCount: 48,
    years: "2021-2025",
    accent: "coral",
    sourceBaseUrl: "https://saksham106.github.io/ib-maths-ai-hl-topic-practice",
  },
  {
    slug: "ib-ai-sl",
    shortName: "IB Math AI SL",
    title: "IB Mathematics AI Standard Level",
    description: "Target AI SL topics with real questions, worked solutions, and mark schemes.",
    qualification: "International Baccalaureate",
    subject: "Mathematics AI SL",
    questionCount: 334,
    paperCount: 38,
    years: "2021-2025",
    accent: "lime",
    sourceBaseUrl: "https://saksham106.github.io/ib-maths-ai-sl-topic-practice",
  },
  {
    slug: "ib-chemistry-hl",
    shortName: "IB Chemistry HL",
    title: "IB Chemistry Higher Level",
    description: "Practise real IB Chemistry HL questions by topic, paper, session, and skill with official markschemes.",
    qualification: "International Baccalaureate",
    subject: "Chemistry HL",
    questionCount: 1083,
    paperCount: 51,
    years: "2020-2025",
    accent: "coral",
    sourceBaseUrl: "https://saksham106.github.io/ib-chemistry-topic-practice",
  },
  {
    slug: "ib-chemistry-sl",
    shortName: "IB Chemistry SL",
    title: "IB Chemistry Standard Level",
    description: "Target IB Chemistry SL topics with real questions, official markschemes, and focused revision filters.",
    qualification: "International Baccalaureate",
    subject: "Chemistry SL",
    questionCount: 810,
    paperCount: 51,
    years: "2020-2025",
    accent: "lime",
    sourceBaseUrl: "https://saksham106.github.io/ib-chemistry-topic-practice",
  },
] as const;

export function getBank(slug: string): Bank | undefined {
  return BANKS.find((bank) => bank.slug === slug);
}
