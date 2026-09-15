export type BillingInterval = "monthly" | "annual";

export const PRICING_MODEL = {
  oneBank: { monthlyCents: 600, annualCents: 4800, label: "One bank", description: "Focus on one syllabus." },
  builder: { baseMonthlyCents: 1000, baseAnnualCents: 8400, incrementMonthlyCents: 400, incrementAnnualCents: 3600, minBanks: 2, maxBanks: 5, label: "Build your plan", description: "Choose the banks you actually study." },
  allAccess: { monthlyCents: 2500, annualCents: 21600, minBanks: 6, label: "All access", description: "Every enabled question bank." },
} as const;

export function priceForBankCount(interval: BillingInterval, count: number): number {
  if (!Number.isSafeInteger(count) || count < 1) throw new Error("Bank count must be positive");
  if (count === 1) return interval === "monthly" ? PRICING_MODEL.oneBank.monthlyCents : PRICING_MODEL.oneBank.annualCents;
  if (count >= PRICING_MODEL.allAccess.minBanks) return interval === "monthly" ? PRICING_MODEL.allAccess.monthlyCents : PRICING_MODEL.allAccess.annualCents;
  const base = interval === "monthly" ? PRICING_MODEL.builder.baseMonthlyCents : PRICING_MODEL.builder.baseAnnualCents;
  const increment = interval === "monthly" ? PRICING_MODEL.builder.incrementMonthlyCents : PRICING_MODEL.builder.incrementAnnualCents;
  return base + (count - PRICING_MODEL.builder.minBanks) * increment;
}

export const formatPrice = (cents: number): string => `$${cents / 100}`;
export const annualSavingPercent = (monthlyCents: number, annualCents: number): number => Math.round(((monthlyCents * 12 - annualCents) / (monthlyCents * 12)) * 100);
export const maximumAnnualSavingPercent = (): number => Math.max(
  annualSavingPercent(PRICING_MODEL.oneBank.monthlyCents, PRICING_MODEL.oneBank.annualCents),
  annualSavingPercent(PRICING_MODEL.builder.baseMonthlyCents, PRICING_MODEL.builder.baseAnnualCents),
  annualSavingPercent(PRICING_MODEL.allAccess.monthlyCents, PRICING_MODEL.allAccess.annualCents),
);
