export type EconomicsBankSlug = "ib-economics-hl" | "ib-economics-sl";
export type BankSlug = "igcse" | "igcse-additional" | "ib-hl" | "ib-sl" | "ib-ai-hl" | "ib-ai-sl" | "ib-chemistry-hl" | "ib-chemistry-sl" | "ib-physics-hl" | "ib-physics-sl" | "ib-biology-hl" | "ib-biology-sl" | EconomicsBankSlug;
export type ProductionBankSlug = Exclude<BankSlug, EconomicsBankSlug>;

export const ECONOMICS_PRODUCT_IDS = [
  "bank_ib_economics_hl",
  "bank_ib_economics_sl",
  "bundle_ib_economics",
] as const;

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
  localPreview?: boolean;
  productionEnabled?: boolean;
  releaseStatus?: string;
  rightsStatus?: string;
  entitlementProductId?: string | null;
};

export const LOCAL_PREVIEW_BANKS: readonly Bank[] = [
  {
    slug: "ib-economics-hl",
    shortName: "IB Economics HL",
    title: "IB Economics Higher Level",
    description: "Local preview of verified IB Economics HL past-paper questions, official mark schemes, and granular topic filters.",
    qualification: "International Baccalaureate",
    subject: "Economics HL",
    questionCount: 111,
    paperCount: 42,
    years: "2021-2025",
    accent: "coral",
    sourceBaseUrl: "/api/local-preview-assets/ib-economics-hl",
    localPreview: true,
    productionEnabled: false,
    releaseStatus: "local_preview_candidate",
    rightsStatus: "unknown_publication_blocking",
    entitlementProductId: null,
  },
  {
    slug: "ib-economics-sl",
    shortName: "IB Economics SL",
    title: "IB Economics Standard Level",
    description: "Local preview of verified IB Economics SL past-paper questions, official mark schemes, and granular topic filters.",
    qualification: "International Baccalaureate",
    subject: "Economics SL",
    questionCount: 89,
    paperCount: 32,
    years: "2021-2025",
    accent: "lime",
    sourceBaseUrl: "/api/local-preview-assets/ib-economics-sl",
    localPreview: true,
    productionEnabled: false,
    releaseStatus: "local_preview_candidate",
    rightsStatus: "unknown_publication_blocking",
    entitlementProductId: null,
  },
] as const;

/** Candidate catalog entries. They stay out of the production catalog until both gates are explicit. */
export const ECONOMICS_BANK_CATALOG: readonly Bank[] = [
  {
    slug: "ib-economics-hl",
    shortName: "IB Economics HL",
    title: "IB Economics Higher Level",
    description: "IB Economics HL questions organized by topic, paper, session, and skill.",
    qualification: "International Baccalaureate",
    subject: "Economics HL",
    questionCount: 111,
    paperCount: 42,
    years: "2021-2025",
    accent: "coral",
    sourceBaseUrl: "",
    localPreview: false,
    productionEnabled: true,
    releaseStatus: "published",
    rightsStatus: "user_attested_non_blocking_for_named_corpus",
    entitlementProductId: "bank_ib_economics_hl",
  },
  {
    slug: "ib-economics-sl",
    shortName: "IB Economics SL",
    title: "IB Economics Standard Level",
    description: "IB Economics SL questions organized by topic, paper, session, and skill.",
    qualification: "International Baccalaureate",
    subject: "Economics SL",
    questionCount: 89,
    paperCount: 32,
    years: "2021-2025",
    accent: "lime",
    sourceBaseUrl: "",
    localPreview: false,
    productionEnabled: true,
    releaseStatus: "published",
    rightsStatus: "user_attested_non_blocking_for_named_corpus",
    entitlementProductId: "bank_ib_economics_sl",
  },
] as const;

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
  {
    slug: "ib-physics-hl",
    shortName: "IB Physics HL",
    title: "IB Physics Higher Level",
    description: "Practise real IB Physics HL questions by topic, paper, session, and skill with official markschemes.",
    qualification: "International Baccalaureate",
    subject: "Physics HL",
    questionCount: 1111,
    paperCount: 51,
    years: "2020-2025",
    accent: "coral",
    sourceBaseUrl: "https://saksham106.github.io/ib-physics-topic-practice",
  },
  {
    slug: "ib-physics-sl",
    shortName: "IB Physics SL",
    title: "IB Physics Standard Level",
    description: "Target IB Physics SL topics with real questions, official markschemes, and focused revision filters.",
    qualification: "International Baccalaureate",
    subject: "Physics SL",
    questionCount: 774,
    paperCount: 51,
    years: "2020-2025",
    accent: "lime",
    sourceBaseUrl: "https://saksham106.github.io/ib-physics-topic-practice",
  },
  {
    slug: "ib-biology-hl",
    shortName: "IB Biology HL",
    title: "IB Biology Higher Level",
    description: "Practise real IB Biology HL questions by topic, paper, session, and skill with official markschemes.",
    qualification: "International Baccalaureate",
    subject: "Biology HL",
    questionCount: 1139,
    paperCount: 51,
    years: "2020-2025",
    accent: "coral",
    sourceBaseUrl: "https://saksham106.github.io/ib-biology-topic-practice",
  },
  {
    slug: "ib-biology-sl",
    shortName: "IB Biology SL",
    title: "IB Biology Standard Level",
    description: "Target IB Biology SL topics with real questions, official markschemes, and focused revision filters.",
    qualification: "International Baccalaureate",
    subject: "Biology SL",
    questionCount: 936,
    paperCount: 54,
    years: "2020-2025",
    accent: "lime",
    sourceBaseUrl: "https://saksham106.github.io/ib-biology-topic-practice",
  },
] as const;

export function isLocalEconomicsBank(slug: string): slug is EconomicsBankSlug {
  return slug === "ib-economics-hl" || slug === "ib-economics-sl";
}

export function isEconomicsProductionEnabled(environment: Record<string, string | undefined> = process.env): boolean {
  return environment.PASTPAPERPREP_ENABLE_IB_ECONOMICS_PRODUCTION === "true"
    && environment.PASTPAPERPREP_IB_ECONOMICS_ASSETS_VERIFIED === "true";
}

export function isLocalEconomicsPreviewEnabled(environment: Record<string, string | undefined> = process.env): boolean {
  return environment.NODE_ENV === "development" && environment.PASTPAPERPREP_ENABLE_LOCAL_IB_ECONOMICS_PREVIEW === "true";
}

/** All known production-shaped bank IDs, including gated Economics, for entitlement reads. */
export function getEntitlementBanks(): readonly Bank[] {
  return [...BANKS, ...ECONOMICS_BANK_CATALOG];
}

/** Banks that may be sent to billing. Local preview banks are never billable. */
export function getBillingBanks(environment: Record<string, string | undefined> = process.env): readonly Bank[] {
  return isEconomicsProductionEnabled(environment) ? [...BANKS, ...ECONOMICS_BANK_CATALOG] : BANKS;
}

export function getAvailableBanks(environment: Record<string, string | undefined> = process.env): readonly Bank[] {
  if (isEconomicsProductionEnabled(environment)) return getBillingBanks(environment);
  return isLocalEconomicsPreviewEnabled(environment) ? [...BANKS, ...LOCAL_PREVIEW_BANKS] : BANKS;
}

export function getBank(slug: string, environment: Record<string, string | undefined> = process.env): Bank | undefined {
  return getAvailableBanks(environment).find((bank) => bank.slug === slug);
}
