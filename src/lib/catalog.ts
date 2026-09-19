import type { Bank } from "@/lib/banks";

export type Qualification = "Cambridge IGCSE" | "IB Diploma";
export type DeliveryMode = "hosted" | "local-preview";
export type BankSlug = "igcse" | "igcse-additional" | "ib-hl" | "ib-sl" | "ib-ai-hl" | "ib-ai-sl" | "ib-chemistry-hl" | "ib-chemistry-sl" | "ib-physics-hl" | "ib-physics-sl" | "ib-biology-hl" | "ib-biology-sl" | "ib-economics-hl" | "ib-economics-sl" | "igcse-biology-0610" | "igcse-economics-0455" | "igcse-chemistry-0620" | "igcse-physics-0625" | "igcse-coordinated-sciences-0654";

export type CatalogBank = {
  slug: BankSlug;
  qualification: Qualification;
  subject: string;
  title: string;
  shortName: string;
  syllabusCode: string;
  level: string;
  questionCount: number;
  paperCount: number;
  years: string;
  route: `/banks/${BankSlug}` | string;
  access: "free-preview" | "paid-bank";
  productId: string | null;
  bundleProductId?: string;
  release: "published" | "gated" | "local-preview";
  delivery: DeliveryMode;
  localPreview?: boolean;
};

const bank = (entry: Omit<CatalogBank, "route">): CatalogBank => ({
  ...entry,
  bundleProductId: entry.bundleProductId ?? (entry.slug.startsWith("igcse") ? "bundle_igcse" : entry.subject.startsWith("Mathematics AA") ? "bundle_ib_aa" : entry.subject.startsWith("Mathematics AI") ? "bundle_ib_ai" : entry.subject === "Chemistry" ? "bundle_ib_chemistry" : entry.subject === "Physics" ? "bundle_ib_physics" : entry.subject === "Biology" ? "bundle_ib_biology" : undefined),
  route: `/banks/${entry.slug}`,
});

export const BANK_CATALOG = [
  bank({ slug: "igcse", qualification: "Cambridge IGCSE", subject: "Mathematics", title: "Mathematics 0580", shortName: "Mathematics 0580", syllabusCode: "0580", level: "Core and Extended", questionCount: 2684, paperCount: 147, years: "2016-2026", access: "paid-bank", productId: "bank_igcse", release: "published", delivery: "hosted" }),
  bank({ slug: "igcse-additional", qualification: "Cambridge IGCSE", subject: "Additional Mathematics", title: "Additional Mathematics 0606", shortName: "Additional Mathematics 0606", syllabusCode: "0606", level: "Extended", questionCount: 1633, paperCount: 145, years: "2016-2026", access: "paid-bank", productId: "bank_igcse_additional", release: "published", delivery: "hosted" }),
  bank({ slug: "igcse-biology-0610", qualification: "Cambridge IGCSE", subject: "Biology", title: "Biology 0610", shortName: "Biology 0610", syllabusCode: "0610", level: "Core and Extended", questionCount: 3441, paperCount: 209, years: "2021-2025", access: "paid-bank", productId: "bank_igcse_biology_0610", release: "gated", delivery: "hosted" }),
  bank({ slug: "igcse-economics-0455", qualification: "Cambridge IGCSE", subject: "Economics", title: "Economics 0455", shortName: "Economics 0455", syllabusCode: "0455", level: "Core", questionCount: 1219, paperCount: 70, years: "2021-2025", access: "paid-bank", productId: "bank_igcse_economics_0455", release: "gated", delivery: "hosted" }),
  bank({ slug: "igcse-chemistry-0620", qualification: "Cambridge IGCSE", subject: "Chemistry", title: "Chemistry 0620", shortName: "Chemistry 0620", syllabusCode: "0620", level: "Core and Extended", questionCount: 5129, paperCount: 314, years: "2019-2026", access: "paid-bank", productId: "bank_igcse_chemistry_0620", release: "gated", delivery: "hosted" }),
  bank({ slug: "igcse-physics-0625", qualification: "Cambridge IGCSE", subject: "Physics", title: "Physics 0625", shortName: "Physics 0625", syllabusCode: "0625", level: "Core and Extended", questionCount: 3820, paperCount: 210, years: "2021-2025", access: "paid-bank", productId: "bank_igcse_physics_0625", release: "gated", delivery: "hosted" }),
  bank({ slug: "igcse-coordinated-sciences-0654", qualification: "Cambridge IGCSE", subject: "Co-ordinated Sciences", title: "Co-ordinated Sciences 0654", shortName: "Co-ordinated Sciences 0654", syllabusCode: "0654", level: "Core and Extended", questionCount: 4030, paperCount: 204, years: "2021-2025", access: "paid-bank", productId: "bank_igcse_coordinated_sciences_0654", release: "gated", delivery: "hosted" }),
  ...(["ib-hl", "ib-sl", "ib-ai-hl", "ib-ai-sl", "ib-chemistry-hl", "ib-chemistry-sl", "ib-physics-hl", "ib-physics-sl", "ib-biology-hl", "ib-biology-sl"] as const).map((slug) => {
    const table: Record<string, [string, string, string, number, number, string]> = {
      "ib-hl": ["Mathematics AA", "Mathematics AA Higher Level", "HL", 841, 104, "2017-2026"], "ib-sl": ["Mathematics AA", "Mathematics AA Standard Level", "SL", 578, 62, "2017-2026"],
      "ib-ai-hl": ["Mathematics AI", "Mathematics AI Higher Level", "HL", 409, 48, "2021-2025"], "ib-ai-sl": ["Mathematics AI", "Mathematics AI Standard Level", "SL", 334, 38, "2021-2025"],
      "ib-chemistry-hl": ["Chemistry", "Chemistry Higher Level", "HL", 1083, 51, "2020-2025"], "ib-chemistry-sl": ["Chemistry", "Chemistry Standard Level", "SL", 810, 51, "2020-2025"],
      "ib-physics-hl": ["Physics", "Physics Higher Level", "HL", 1111, 51, "2020-2025"], "ib-physics-sl": ["Physics", "Physics Standard Level", "SL", 774, 51, "2020-2025"],
      "ib-biology-hl": ["Biology", "Biology Higher Level", "HL", 1139, 51, "2020-2025"], "ib-biology-sl": ["Biology", "Biology Standard Level", "SL", 936, 54, "2020-2025"],
    };
    const [subject, title, level, questionCount, paperCount, years] = table[slug];
    return bank({ slug, qualification: "IB Diploma", subject, title: `IB ${title}`, shortName: subject.startsWith("Mathematics ") ? `IB Math ${subject.replace("Mathematics ", "")} ${level}` : `${subject} ${level}`, syllabusCode: subject === "Mathematics AA" ? "AA" : subject === "Mathematics AI" ? "AI" : subject, level, questionCount, paperCount, years, access: "paid-bank", productId: `bank_${slug.replaceAll("-", "_")}`, release: "published", delivery: "hosted" });
  }),
  bank({ slug: "ib-economics-hl", qualification: "IB Diploma", subject: "Economics", title: "IB Economics Higher Level", shortName: "IB Economics HL", syllabusCode: "Economics", level: "HL", questionCount: 111, paperCount: 42, years: "2021-2025", access: "paid-bank", productId: "bank_ib_economics_hl", bundleProductId: "bundle_ib_economics", release: "gated", delivery: "local-preview", localPreview: true }),
  bank({ slug: "ib-economics-sl", qualification: "IB Diploma", subject: "Economics", title: "IB Economics Standard Level", shortName: "IB Economics SL", syllabusCode: "Economics", level: "SL", questionCount: 89, paperCount: 32, years: "2021-2025", access: "paid-bank", productId: "bank_ib_economics_sl", bundleProductId: "bundle_ib_economics", release: "gated", delivery: "local-preview", localPreview: true }),
] as const satisfies readonly CatalogBank[];

export function getCatalogBank(slug: string) { return BANK_CATALOG.find((entry) => entry.slug === slug); }
export function isCatalogBankBillable(bank: CatalogBank, environment: Record<string, string | undefined> = process.env) {
  const economicsProductionGate = environment.NODE_ENV === "production" && environment.PASTPAPERPREP_ENABLE_IB_ECONOMICS_PRODUCTION === "true" && environment.PASTPAPERPREP_IB_ECONOMICS_ASSETS_VERIFIED === "true";
  return bank.release !== "local-preview" && Boolean(bank.productId) && (bank.delivery !== "local-preview" || economicsProductionGate);
}
export function isCatalogBankEnabled(bank: CatalogBank, environment: Record<string, string | undefined> = process.env) {
  if (bank.release === "published") return true;
  if (bank.slug === "ib-economics-hl" || bank.slug === "ib-economics-sl") {
    return (environment.NODE_ENV !== "production" && environment.PASTPAPERPREP_ENABLE_LOCAL_IB_ECONOMICS_PREVIEW === "true") || (environment.NODE_ENV === "production" && environment.PASTPAPERPREP_ENABLE_IB_ECONOMICS_PRODUCTION === "true" && environment.PASTPAPERPREP_IB_ECONOMICS_ASSETS_VERIFIED === "true");
  }
  return environment.PASTPAPERPREP_ENABLE_IGCSE_RELEASE_BANKS === "true" && environment.PASTPAPERPREP_IGCSE_RELEASE_ASSETS_VERIFIED === "true";
}
export function isCatalogLocalPreviewEnabled(bank: CatalogBank, environment: Record<string, string | undefined> = process.env) {
  return bank.delivery === "local-preview" && environment.NODE_ENV === "development" && isCatalogBankEnabled(bank, environment);
}
export function getCatalogBanksForDisplay(environment: Record<string, string | undefined> = process.env) { return BANK_CATALOG.filter((entry) => isCatalogBankEnabled(entry, environment)); }
export function getCatalogBillingBanks(environment: Record<string, string | undefined> = process.env) { return getCatalogBanksForDisplay(environment).filter((entry) => isCatalogBankBillable(entry, environment)); }

const SOURCE_BASE_URLS: Partial<Record<BankSlug, string>> = {
  igcse: "https://saksham106.github.io/igcse-0580-topic-practice",
  "igcse-additional": "https://saksham106.github.io/igcse-additional-mathematics-0606-topic-practice",
  "ib-hl": "https://saksham106.github.io/ib-maths-aa-hl-topic-practice",
  "ib-sl": "https://saksham106.github.io/ib-maths-aa-topic-finder",
  "ib-ai-hl": "https://saksham106.github.io/ib-maths-ai-hl-topic-practice",
  "ib-ai-sl": "https://saksham106.github.io/ib-maths-ai-sl-topic-practice",
  "ib-chemistry-hl": "https://saksham106.github.io/ib-chemistry-topic-practice",
  "ib-chemistry-sl": "https://saksham106.github.io/ib-chemistry-topic-practice",
  "ib-physics-hl": "https://saksham106.github.io/ib-physics-topic-practice",
  "ib-physics-sl": "https://saksham106.github.io/ib-physics-topic-practice",
  "ib-biology-hl": "https://saksham106.github.io/ib-biology-topic-practice",
  "ib-biology-sl": "https://saksham106.github.io/ib-biology-topic-practice",
};

/** Adapt the canonical identity record to the richer runtime bank contract. */
export function catalogBankToRuntimeBank(entry: CatalogBank): Bank {
  return {
    slug: entry.slug,
    shortName: entry.shortName,
    title: entry.title,
    description: `${entry.title} questions organised by topic, paper, and session.`,
    qualification: entry.qualification === "IB Diploma" ? "International Baccalaureate" : entry.qualification,
    subject: entry.subject + (entry.level === "HL" || entry.level === "SL" ? ` ${entry.level}` : entry.syllabusCode ? ` ${entry.syllabusCode}` : ""),
    questionCount: entry.questionCount,
    paperCount: entry.paperCount,
    years: entry.years,
    accent: entry.subject.includes("Chemistry") || entry.subject.includes("Additional") ? "coral" : entry.subject.includes("Biology") ? "lime" : "cobalt",
    sourceBaseUrl: SOURCE_BASE_URLS[entry.slug] ?? "",
    localPreview: entry.localPreview,
    productionEnabled: entry.release === "published",
    releaseStatus: entry.release,
    entitlementProductId: entry.productId,
  };
}

export function getCatalogRuntimeBanks(environment: Record<string, string | undefined> = process.env): Bank[] {
  return getCatalogBanksForDisplay(environment).map(catalogBankToRuntimeBank);
}
