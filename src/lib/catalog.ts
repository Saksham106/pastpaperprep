import type { Bank } from "@/lib/banks";
import { BOARD_SUBJECT_ORDER, qualificationInfo, type QualificationLabel } from "@/lib/qualifications";

export type Qualification = QualificationLabel;
export type DeliveryMode = "hosted" | "local-preview";
export type BankSlug = "igcse" | "igcse-additional" | "ib-hl" | "ib-sl" | "ib-ai-hl" | "ib-ai-sl" | "ib-chemistry-hl" | "ib-chemistry-sl" | "ib-physics-hl" | "ib-physics-sl" | "ib-biology-hl" | "ib-biology-sl" | "ib-economics-hl" | "ib-economics-sl" | "igcse-biology-0610" | "igcse-economics-0455" | "igcse-chemistry-0620" | "igcse-physics-0625" | "igcse-coordinated-sciences-0654" | "igcse-computer-science-0478" | "ib-computer-science-hl" | "ib-computer-science-sl" | "ib-business-management-hl" | "ib-business-management-sl" | "a-level-maths-9709" | "a-level-physics-9702" | "a-level-chemistry-9701" | "a-level-biology-9700" | "a-level-economics-9708" | "a-level-computer-science-9618" | "a-level-further-maths-9231" | "cbse-10-maths" | "cbse-10-science" | "cbse-12-physics" | "cbse-12-chemistry" | "cbse-12-maths" | "cbse-12-biology";

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
  /** Hidden everywhere until its private assets are uploaded, read back and the runtime is finalized. */
  pendingStorage?: boolean;
};

const bank = (entry: Omit<CatalogBank, "route">): CatalogBank => ({
  ...entry,
  // Subject-named pair bundles are IB products: an A Level Physics bank must never inherit bundle_ib_physics.
  bundleProductId: entry.bundleProductId ?? (entry.slug.startsWith("igcse") ? "bundle_igcse" : entry.qualification !== "IB Diploma" ? undefined : entry.subject.startsWith("Mathematics AA") ? "bundle_ib_aa" : entry.subject.startsWith("Mathematics AI") ? "bundle_ib_ai" : entry.subject === "Chemistry" ? "bundle_ib_chemistry" : entry.subject === "Physics" ? "bundle_ib_physics" : entry.subject === "Biology" ? "bundle_ib_biology" : undefined),
  route: `/banks/${entry.slug}`,
});

/** CBSE question and set counts from each bank's runtime; 0 until it lands. */
const CBSE_COUNTS: Record<string, { questionCount: number; paperCount: number }> = {
  "cbse-10-maths": { questionCount: 0, paperCount: 0 },
  "cbse-10-science": { questionCount: 2375, paperCount: 78 },
  "cbse-12-physics": { questionCount: 1624, paperCount: 74 },
  "cbse-12-chemistry": { questionCount: 1844, paperCount: 75 },
  "cbse-12-maths": { questionCount: 0, paperCount: 0 },
  "cbse-12-biology": { questionCount: 0, paperCount: 0 },
};

export const BANK_CATALOG = [
  bank({ slug: "igcse", qualification: "Cambridge IGCSE", subject: "Mathematics", title: "Mathematics 0580", shortName: "Mathematics 0580", syllabusCode: "0580", level: "Core and Extended", questionCount: 4174, paperCount: 225, years: "2016-2026", access: "paid-bank", productId: "bank_igcse", release: "published", delivery: "hosted" }),
  bank({ slug: "igcse-additional", qualification: "Cambridge IGCSE", subject: "Additional Mathematics", title: "Additional Mathematics 0606", shortName: "Additional Mathematics 0606", syllabusCode: "0606", level: "Extended", questionCount: 1656, paperCount: 147, years: "2016-2026", access: "paid-bank", productId: "bank_igcse_additional", release: "published", delivery: "hosted" }),
  bank({ slug: "igcse-biology-0610", qualification: "Cambridge IGCSE", subject: "Biology", title: "Biology 0610", shortName: "Biology 0610", syllabusCode: "0610", level: "Core and Extended", questionCount: 5211, paperCount: 316, years: "2019-2026", access: "paid-bank", productId: "bank_igcse_biology_0610", release: "gated", delivery: "hosted" }),
  bank({ slug: "igcse-economics-0455", qualification: "Cambridge IGCSE", subject: "Economics", title: "Economics 0455", shortName: "Economics 0455", syllabusCode: "0455", level: "Core", questionCount: 1862, paperCount: 106, years: "2019-2026", access: "paid-bank", productId: "bank_igcse_economics_0455", release: "gated", delivery: "hosted" }),
  bank({ slug: "igcse-chemistry-0620", qualification: "Cambridge IGCSE", subject: "Chemistry", title: "Chemistry 0620", shortName: "Chemistry 0620", syllabusCode: "0620", level: "Core and Extended", questionCount: 5129, paperCount: 314, years: "2019-2026", access: "paid-bank", productId: "bank_igcse_chemistry_0620", release: "gated", delivery: "hosted" }),
  bank({ slug: "igcse-physics-0625", qualification: "Cambridge IGCSE", subject: "Physics", title: "Physics 0625", shortName: "Physics 0625", syllabusCode: "0625", level: "Core and Extended", questionCount: 5789, paperCount: 317, years: "2019-2026", access: "paid-bank", productId: "bank_igcse_physics_0625", release: "gated", delivery: "hosted" }),
  bank({ slug: "igcse-coordinated-sciences-0654", qualification: "Cambridge IGCSE", subject: "Co-ordinated Sciences", title: "Co-ordinated Sciences 0654", shortName: "Co-ordinated Sciences 0654", syllabusCode: "0654", level: "Core and Extended", questionCount: 4721, paperCount: 238, years: "2020-2025", access: "paid-bank", productId: "bank_igcse_coordinated_sciences_0654", release: "gated", delivery: "hosted" }),
  bank({ slug: "igcse-computer-science-0478", qualification: "Cambridge IGCSE", subject: "Computer Science", title: "Computer Science 0478", shortName: "Computer Science 0478", syllabusCode: "0478", level: "All candidates", questionCount: 847, paperCount: 105, years: "2019-2026", access: "paid-bank", productId: "bank_igcse_computer_science_0478", release: "gated", delivery: "hosted" }),
  ...(["ib-hl", "ib-sl", "ib-ai-hl", "ib-ai-sl", "ib-chemistry-hl", "ib-chemistry-sl", "ib-physics-hl", "ib-physics-sl", "ib-biology-hl", "ib-biology-sl"] as const).map((slug) => {
    // Papers count those with questions in the bank (docs/ib-paper-count-gaps-2026-10-21.md).
    const table: Record<string, [string, string, string, number, number, string]> = {
      "ib-hl": ["Mathematics AA", "Mathematics AA Higher Level", "HL", 893, 110, "2017-2026"], "ib-sl": ["Mathematics AA", "Mathematics AA Standard Level", "SL", 596, 64, "2017-2026"],
      "ib-ai-hl": ["Mathematics AI", "Mathematics AI Higher Level", "HL", 484, 57, "2021-2026"], "ib-ai-sl": ["Mathematics AI", "Mathematics AI Standard Level", "SL", 386, 44, "2021-2026"],
      "ib-chemistry-hl": ["Chemistry", "Chemistry Higher Level", "HL", 2036, 93, "2016-2026"], "ib-chemistry-sl": ["Chemistry", "Chemistry Standard Level", "SL", 1521, 93, "2016-2026"],
      "ib-physics-hl": ["Physics", "Physics Higher Level", "HL", 2028, 93, "2016-2026"], "ib-physics-sl": ["Physics", "Physics Standard Level", "SL", 1413, 93, "2016-2026"],
      "ib-biology-hl": ["Biology", "Biology Higher Level", "HL", 2071, 93, "2016-2026"], "ib-biology-sl": ["Biology", "Biology Standard Level", "SL", 1671, 96, "2016-2026"],
    };
    const [subject, title, level, questionCount, paperCount, years] = table[slug];
    return bank({ slug, qualification: "IB Diploma", subject, title: `IB ${title}`, shortName: subject.startsWith("Mathematics ") ? `IB Math ${subject.replace("Mathematics ", "")} ${level}` : `${subject} ${level}`, syllabusCode: subject === "Mathematics AA" ? "AA" : subject === "Mathematics AI" ? "AI" : subject, level, questionCount, paperCount, years, access: "paid-bank", productId: `bank_${slug.replaceAll("-", "_")}`, release: "published", delivery: "hosted" });
  }),
  // IB Computer Science: sold as single banks (no pair bundle), included in All Access and custom bundles.
  bank({ slug: "ib-computer-science-hl", qualification: "IB Diploma", subject: "Computer Science", title: "IB Computer Science Higher Level", shortName: "Computer Science HL", syllabusCode: "Computer Science", level: "HL", questionCount: 506, paperCount: 32, years: "2019-2026", access: "paid-bank", productId: "bank_ib_computer_science_hl", release: "gated", delivery: "hosted" }),
  bank({ slug: "ib-computer-science-sl", qualification: "IB Diploma", subject: "Computer Science", title: "IB Computer Science Standard Level", shortName: "Computer Science SL", syllabusCode: "Computer Science", level: "SL", questionCount: 391, paperCount: 32, years: "2019-2026", access: "paid-bank", productId: "bank_ib_computer_science_sl", release: "gated", delivery: "hosted" }),
  // IB Business Management: sold as single banks (no pair bundle), included in All Access, lifetime and custom bundles. Nov 2020 to
  // May 2026; the joint 2024+ Paper 1 serves in both banks and Paper 3 is HL only. Free years 2020-2021. Crops uploaded
  // create-only and read back, runtimes finalized from the verified receipts (2026-11-23).
  bank({ slug: "ib-business-management-hl", qualification: "IB Diploma", subject: "Business Management", title: "IB Business Management Higher Level", shortName: "Business Management HL", syllabusCode: "Business Management", level: "HL", questionCount: 260, paperCount: 49, years: "2020-2026", access: "paid-bank", productId: "bank_ib_business_management_hl", release: "gated", delivery: "hosted" }),
  bank({ slug: "ib-business-management-sl", qualification: "IB Diploma", subject: "Business Management", title: "IB Business Management Standard Level", shortName: "Business Management SL", syllabusCode: "Business Management", level: "SL", questionCount: 218, paperCount: 41, years: "2020-2026", access: "paid-bank", productId: "bank_ib_business_management_sl", release: "gated", delivery: "hosted" }),
  bank({ slug: "ib-economics-hl", qualification: "IB Diploma", subject: "Economics", title: "IB Economics Higher Level", shortName: "IB Economics HL", syllabusCode: "Economics", level: "HL", questionCount: 128, paperCount: 49, years: "2021-2026", access: "paid-bank", productId: "bank_ib_economics_hl", bundleProductId: "bundle_ib_economics", release: "gated", delivery: "local-preview", localPreview: true }),
  bank({ slug: "ib-economics-sl", qualification: "IB Diploma", subject: "Economics", title: "IB Economics Standard Level", shortName: "IB Economics SL", syllabusCode: "Economics", level: "SL", questionCount: 104, paperCount: 38, years: "2021-2026", access: "paid-bank", productId: "bank_ib_economics_sl", bundleProductId: "bundle_ib_economics", release: "gated", delivery: "local-preview", localPreview: true }),
  // Cambridge International AS & A Level Physics 9702: Papers 1 (multiple choice), 2 and 4, with paper tabs like 9709.
  // Crops uploaded and read back, runtime finalized, free-year crops in the free bucket: switched on 2026-11-19 (owner:
  // "looks good launch together" with Chemistry 9701).
  bank({ slug: "a-level-physics-9702", qualification: "Cambridge A Level", subject: "Physics", title: "Physics 9702", shortName: "Physics 9702", syllabusCode: "9702", level: "AS & A Level", questionCount: 2627, paperCount: 132, years: "2020-2026", access: "paid-bank", productId: "bank_a_level_physics_9702", release: "gated", delivery: "hosted" }),
  // Cambridge International AS & A Level Mathematics 9709 (2020 syllabus onward): one bank with paper tabs.
  // Cambridge International AS & A Level Chemistry 9701: Papers 1 (multiple choice), 2 and 4, with paper tabs like 9702.
  // Crops uploaded and read back, runtime finalized, free-year crops in the free bucket: switched on 2026-11-19 with 9702.
  bank({ slug: "a-level-chemistry-9701", qualification: "Cambridge A Level", subject: "Chemistry", title: "Chemistry 9701", shortName: "Chemistry 9701", syllabusCode: "9701", level: "AS & A Level", questionCount: 2220, paperCount: 123, years: "2020-2026", access: "paid-bank", productId: "bank_a_level_chemistry_9701", release: "gated", delivery: "hosted" }),
  // Cambridge International AS & A Level Biology 9700: Papers 1 (multiple choice), 2 and 4, with paper tabs like 9701.
  // Crops uploaded and read back, runtime finalized, free-year crops in the free bucket: switched on for launch (#499).
  bank({ slug: "a-level-biology-9700", qualification: "Cambridge A Level", subject: "Biology", title: "Biology 9700", shortName: "Biology 9700", syllabusCode: "9700", level: "AS & A Level", questionCount: 2680, paperCount: 141, years: "2020-2026", access: "paid-bank", productId: "bank_a_level_biology_9700", release: "gated", delivery: "hosted" }),
  // Cambridge International AS & A Level Economics 9708: all four papers (P1/P3 multiple choice, P2/P4 data response and
  // essays), with paper tabs. Crops uploaded and read back, runtime finalized, free-year crops in the free bucket: switched on
  // for the joint launch with Biology 9700 (#500).
  bank({ slug: "a-level-economics-9708", qualification: "Cambridge A Level", subject: "Economics", title: "Economics 9708", shortName: "Economics 9708", syllabusCode: "9708", level: "AS & A Level", questionCount: 3207, paperCount: 183, years: "2020-2026", access: "paid-bank", productId: "bank_a_level_economics_9708", release: "gated", delivery: "hosted" }),
  // Cambridge International AS & A Level Computer Science 9618: Papers 1-3 (all structured; Paper 4 is a practical on a
  // computer), with paper tabs. Crops uploaded and read back, runtime finalized, free-year crops in the free bucket
  // (switched on 2026-11-22 with 9231).
  bank({ slug: "a-level-computer-science-9618", qualification: "Cambridge A Level", subject: "Computer Science", title: "Computer Science 9618", shortName: "Computer Science 9618", syllabusCode: "9618", level: "AS & A Level", questionCount: 750, paperCount: 85, years: "2021-2026", access: "paid-bank", productId: "bank_a_level_computer_science_9618", release: "gated", delivery: "hosted" }),
  // Cambridge International AS & A Level Further Mathematics 9231: Papers 1-4 (all structured), with paper tabs like 9709.
  // Crops uploaded and read back, runtime finalized, free-year crops in the free bucket (switched on 2026-11-22 with 9618).
  bank({ slug: "a-level-further-maths-9231", qualification: "Cambridge A Level", subject: "Further Mathematics", title: "Further Mathematics 9231", shortName: "Further Mathematics 9231", syllabusCode: "9231", level: "AS & A Level", questionCount: 813, paperCount: 116, years: "2020-2026", access: "paid-bank", productId: "bank_a_level_further_maths_9231", release: "gated", delivery: "hosted" }),
  // Crops uploaded and read back, runtime finalized, free-year crops in the free bucket: served under the shared release
  // gate like the other private-storage banks (switched on 2026-11-18).
  bank({ slug: "a-level-maths-9709", qualification: "Cambridge A Level", subject: "Mathematics", title: "Mathematics 9709", shortName: "Mathematics 9709", syllabusCode: "9709", level: "AS & A Level", questionCount: 2118, paperCount: 256, years: "2020-2026", access: "paid-bank", productId: "bank_a_level_maths_9709", release: "gated", delivery: "hosted" }),
  // CBSE (Central Board of Secondary Education, India): Class 10 and Class 12 board exams, 2023-2026 main and
  // compartment papers. Hidden (pendingStorage) until each bank's runtime is built, its crops are uploaded and read back
  // and the owner switches it on. Question and paper counts are placeholders (0) until then (CBSE_COUNTS). Class 10 Mathematics has
  // Standard (041) and Basic (241) level tabs; the other five are one paper each, browsed by chapter.
  // Counts: questions served, and printed sets (a "paper" here is one set, such as 56/1/1).
  ...([
    ["cbse-10-maths", "Mathematics", "Class 10 Mathematics", "041/241", "Class 10"],
    ["cbse-10-science", "Science", "Class 10 Science", "086", "Class 10"],
    ["cbse-12-physics", "Physics", "Class 12 Physics", "042", "Class 12"],
    ["cbse-12-chemistry", "Chemistry", "Class 12 Chemistry", "043", "Class 12"],
    ["cbse-12-maths", "Mathematics", "Class 12 Mathematics", "041", "Class 12"],
    ["cbse-12-biology", "Biology", "Class 12 Biology", "044", "Class 12"],
  ] as const).map(([slug, subject, title, syllabusCode, level]) => bank({ slug, qualification: "CBSE", subject, title, shortName: title, syllabusCode, level, ...CBSE_COUNTS[slug], years: "2023-2026", access: "paid-bank", productId: `bank_${slug.replaceAll("-", "_")}`, release: "gated", delivery: "hosted", pendingStorage: true })),
] as const satisfies readonly CatalogBank[];

export function getCatalogBank(slug: string) { return BANK_CATALOG.find((entry) => entry.slug === slug); }
export function isCatalogBankBillable(bank: CatalogBank, environment: Record<string, string | undefined> = process.env) {
  const economicsProductionGate = environment.NODE_ENV === "production" && environment.PASTPAPERPREP_ENABLE_IB_ECONOMICS_PRODUCTION === "true" && environment.PASTPAPERPREP_IB_ECONOMICS_ASSETS_VERIFIED === "true";
  return bank.release !== "local-preview" && Boolean(bank.productId) && (bank.delivery !== "local-preview" || economicsProductionGate);
}
export function isCatalogBankEnabled(bank: CatalogBank, environment: Record<string, string | undefined> = process.env) {
  // Staged banks stay hidden everywhere; `npm run dev` can opt in to preview them with fixture data.
  if ("pendingStorage" in bank && bank.pendingStorage) return environment.NODE_ENV === "development" && environment.PASTPAPERPREP_PREVIEW_PENDING_BANKS === "true";
  if (bank.release === "published") return true;
  if (bank.slug === "ib-economics-hl" || bank.slug === "ib-economics-sl") {
    return (environment.NODE_ENV !== "production" && environment.PASTPAPERPREP_ENABLE_LOCAL_IB_ECONOMICS_PREVIEW === "true") || (environment.NODE_ENV === "production" && environment.PASTPAPERPREP_ENABLE_IB_ECONOMICS_PRODUCTION === "true" && environment.PASTPAPERPREP_IB_ECONOMICS_ASSETS_VERIFIED === "true");
  }
  return environment.PASTPAPERPREP_ENABLE_IGCSE_RELEASE_BANKS === "true" && environment.PASTPAPERPREP_IGCSE_RELEASE_ASSETS_VERIFIED === "true";
}
/** A staged bank shown only by the dev-only preview flag: it is read from its candidate runtime, never the sealed release path. */
export function isPendingStoragePreview(slug: string, environment: Record<string, string | undefined> = process.env) {
  const bank = getCatalogBank(slug);
  return Boolean(bank && "pendingStorage" in bank && bank.pendingStorage && isCatalogBankEnabled(bank, environment));
}
export function isCatalogLocalPreviewEnabled(bank: CatalogBank, environment: Record<string, string | undefined> = process.env) {
  return bank.delivery === "local-preview" && environment.NODE_ENV === "development" && isCatalogBankEnabled(bank, environment);
}
export function getCatalogBanksForDisplay(environment: Record<string, string | undefined> = process.env) { return inBoardSubjectOrder(BANK_CATALOG.filter((entry) => isCatalogBankEnabled(entry, environment))); }

/** Reorders each board's banks into BOARD_SUBJECT_ORDER, within that board's own slots; other banks keep their places. */
export function inBoardSubjectOrder<T extends { qualification: string; subject: string }>(banks: readonly T[]): T[] {
  const result = [...banks];
  for (const [board, subjects] of Object.entries(BOARD_SUBJECT_ORDER)) {
    const slots = result.flatMap((bank, index) => (qualificationInfo(bank.qualification).id === board ? [index] : []));
    const rank = (bank: T) => { const index = subjects!.indexOf(bank.subject); return index === -1 ? subjects!.length : index; };
    const ordered = slots.map((index) => result[index]).sort((a, b) => rank(a) - rank(b));
    slots.forEach((slot, i) => { result[slot] = ordered[i]; });
  }
  return result;
}
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
    qualification: qualificationInfo(entry.qualification).runtimeLabel,
    // CBSE subject codes repeat across classes (041 is Maths in both), so CBSE banks are named by class instead.
    subject: entry.subject + (entry.level === "HL" || entry.level === "SL" || entry.qualification === "CBSE" ? ` ${entry.level}` : entry.syllabusCode ? ` ${entry.syllabusCode}` : ""),
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
