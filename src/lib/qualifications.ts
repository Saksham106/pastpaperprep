/**
 * The boards PastPaperPrep sells, in display order. One table instead of string comparisons
 * against "Cambridge IGCSE" / "IB Diploma", so a new board is one entry here plus its banks.
 * Pure and client-safe: no catalog import, so catalog.ts and client components can both use it.
 */
export const QUALIFICATION_IDS = ["igcse", "ib", "a-level"] as const;
export type QualificationId = (typeof QUALIFICATION_IDS)[number];

/** The catalog's qualification label (`CatalogBank.qualification`). */
export type QualificationLabel = "Cambridge IGCSE" | "IB Diploma" | "Cambridge A Level";

export type QualificationInfo = {
  id: QualificationId;
  /** Catalog label and tab label. */
  label: QualificationLabel;
  /** `Bank.qualification` (runtime facade); IB keeps its historical long name. */
  runtimeLabel: string;
  /** Short board word for compact copy ("IGCSE Maths", "IB", "A Level"). */
  shortLabel: string;
  /** Prefix that turns a bank title into a searchable name; IB titles already start with "IB". */
  namePrefix: string;
  hubPath: string;
  /** Footer / billing group for banks without a more specific subject group. */
  groupLabel: string;
  /** Link preview family in seo.ts (A Level shares the Cambridge A*–E grade scale). */
  socialPreview: "igcse" | "ib";
};

export const QUALIFICATIONS: Record<QualificationId, QualificationInfo> = {
  igcse: { id: "igcse", label: "Cambridge IGCSE", runtimeLabel: "Cambridge IGCSE", shortLabel: "IGCSE", namePrefix: "IGCSE ", hubPath: "/cambridge-igcse", groupLabel: "Cambridge", socialPreview: "igcse" },
  ib: { id: "ib", label: "IB Diploma", runtimeLabel: "International Baccalaureate", shortLabel: "IB", namePrefix: "", hubPath: "/ib", groupLabel: "IB", socialPreview: "ib" },
  "a-level": { id: "a-level", label: "Cambridge A Level", runtimeLabel: "Cambridge A Level", shortLabel: "A Level", namePrefix: "A Level ", hubPath: "/cambridge-a-level", groupLabel: "Cambridge A Level", socialPreview: "igcse" },
};

const BY_LABEL = new Map<string, QualificationInfo>(
  Object.values(QUALIFICATIONS).flatMap((info) => [[info.label, info], [info.runtimeLabel, info], [info.id, info]] as const),
);

/** Resolve a catalog label, runtime label or id. Unknown values fall back to IGCSE, the original board. */
export function qualificationInfo(value: string | undefined | null): QualificationInfo {
  return (value && BY_LABEL.get(value)) || QUALIFICATIONS.igcse;
}

export const qualificationIdOf = (value: string | undefined | null): QualificationId => qualificationInfo(value).id;

/** Bank slugs encode their board: `igcse…`, `a-level…`, everything else is IB. */
export function qualificationIdOfSlug(slug: string): QualificationId {
  return slug.startsWith("igcse") ? "igcse" : slug.startsWith("a-level") ? "a-level" : "ib";
}

export function isQualificationId(value: unknown): value is QualificationId {
  return typeof value === "string" && (QUALIFICATION_IDS as readonly string[]).includes(value);
}

/** "IGCSE Mathematics 0580", "IB Mathematics AA Higher Level", "A Level Mathematics 9709". */
export function qualifiedBankTitle(bank: { qualification: string; title: string }): string {
  return `${qualificationInfo(bank.qualification).namePrefix}${bank.title}`;
}
