/**
 * The boards PastPaperPrep sells, in display order. One table instead of string comparisons
 * against "Cambridge IGCSE" / "IB Diploma", so a new board is one entry here plus its banks.
 * Pure and client-safe: no catalog import, so catalog.ts and client components can both use it.
 */
/**
 * Display order everywhere boards are listed: Cambridge students move from IGCSE to A Level. CBSE comes last: its students
 * sit no other board here, so it never splits the Cambridge pair, and the remembered board opens their tab first anyway.
 */
export const QUALIFICATION_IDS = ["igcse", "a-level", "ib", "cbse"] as const;
export type QualificationId = (typeof QUALIFICATION_IDS)[number];

/** The catalog's qualification label (`CatalogBank.qualification`). */
export type QualificationLabel = "Cambridge IGCSE" | "IB Diploma" | "Cambridge A Level" | "CBSE";

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
  socialPreview: "igcse" | "ib" | "cbse";
};

/**
 * Subject order within a board, where catalog order isn't the order students expect. Every list of a board's banks
 * (hub cards, footer group, pricing pickers) follows it through `getCatalogBanksForDisplay`. A Level: Mathematics,
 * Chemistry, Physics (owner, 2026-11-18). Subjects not listed keep catalog order after the listed ones.
 */
export const BOARD_SUBJECT_ORDER: Partial<Record<QualificationId, readonly string[]>> = {
  "a-level": ["Mathematics", "Further Mathematics", "Chemistry", "Physics", "Biology", "Economics", "Computer Science"],
  // Class 10 banks before Class 12 within each list; the subject cards group Mathematics and the sciences.
  cbse: ["Mathematics", "Science", "Physics", "Chemistry", "Biology"],
};

export const QUALIFICATIONS: Record<QualificationId, QualificationInfo> = {
  igcse: { id: "igcse", label: "Cambridge IGCSE", runtimeLabel: "Cambridge IGCSE", shortLabel: "IGCSE", namePrefix: "IGCSE ", hubPath: "/cambridge-igcse", groupLabel: "Cambridge IGCSE", socialPreview: "igcse" },
  ib: { id: "ib", label: "IB Diploma", runtimeLabel: "International Baccalaureate", shortLabel: "IB", namePrefix: "", hubPath: "/ib", groupLabel: "IB", socialPreview: "ib" },
  "a-level": { id: "a-level", label: "Cambridge A Level", runtimeLabel: "Cambridge A Level", shortLabel: "A Level", namePrefix: "A Level ", hubPath: "/cambridge-a-level", groupLabel: "Cambridge A Level", socialPreview: "igcse" },
  cbse: { id: "cbse", label: "CBSE", runtimeLabel: "CBSE", shortLabel: "CBSE", namePrefix: "CBSE ", hubPath: "/cbse", groupLabel: "CBSE", socialPreview: "cbse" },
};

const BY_LABEL = new Map<string, QualificationInfo>(
  Object.values(QUALIFICATIONS).flatMap((info) => [[info.label, info], [info.runtimeLabel, info], [info.id, info]] as const),
);

/** Resolve a catalog label, runtime label or id. Unknown values fall back to IGCSE, the original board. */
export function qualificationInfo(value: string | undefined | null): QualificationInfo {
  return (value && BY_LABEL.get(value)) || QUALIFICATIONS.igcse;
}

export const qualificationIdOf = (value: string | undefined | null): QualificationId => qualificationInfo(value).id;

/** Bank slugs encode their board: `igcse…`, `a-level…`, `cbse-…`, everything else is IB. */
export function qualificationIdOfSlug(slug: string): QualificationId {
  return slug.startsWith("igcse") ? "igcse" : slug.startsWith("a-level") ? "a-level" : slug.startsWith("cbse-") ? "cbse" : "ib";
}

export function isQualificationId(value: unknown): value is QualificationId {
  return typeof value === "string" && (QUALIFICATION_IDS as readonly string[]).includes(value);
}

/** "IGCSE Mathematics 0580", "IB Mathematics AA Higher Level", "A Level Mathematics 9709", "CBSE Class 10 Mathematics". */
export function qualifiedBankTitle(bank: { qualification: string; title: string }): string {
  return `${qualificationInfo(bank.qualification).namePrefix}${bank.title}`;
}
