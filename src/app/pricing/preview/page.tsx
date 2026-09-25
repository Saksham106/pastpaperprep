import Link from "next/link";
import { notFound } from "next/navigation";
import { PricingContent } from "@/components/PricingContent";
import type { ProductId } from "@/lib/access";
import { getBillingBanks, type BankSlug } from "@/lib/banks";

export const dynamic = "force-dynamic";
export const metadata = { title: "Local pricing preview", robots: { index: false, follow: false } };

const VIEWS = [
  { id: "one-bank", label: "One bank", products: ["bank_ib_sl"], banks: ["ib-sl"], name: "IB Mathematics AA SL", complimentary: false },
  { id: "two-banks", label: "Two separate banks", products: ["bank_ib_sl", "bank_ib_hl"], banks: ["ib-sl", "ib-hl"], name: "IB Mathematics AA SL, IB Mathematics AA HL", complimentary: false },
  { id: "bundle", label: "Two-bank bundle", products: ["bundle_custom"], banks: ["ib-sl", "ib-hl"], name: "Build Your Plan (2 banks)", complimentary: false },
  { id: "all", label: "Complimentary All Access", products: ["bundle_all"], banks: [], name: "All Access", complimentary: true },
] as const;

export default async function PricingPreviewPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  if (process.env.NODE_ENV !== "development") notFound();
  const { view } = await searchParams;
  const selected = VIEWS.find((entry) => entry.id === view) ?? VIEWS[0];
  const availableBanks = getBillingBanks();
  const ownedBankIds: BankSlug[] = selected.id === "all" ? availableBanks.map((bank) => bank.slug) : [...selected.banks];
  return <>
    <nav className="pricing-preview-nav" aria-label="Subscriber views">
      {VIEWS.map((entry) => <Link key={entry.id} href={`/pricing/preview?view=${entry.id}`} aria-current={entry.id === selected.id ? "page" : undefined}>{entry.label}</Link>)}
    </nav>
    <PricingContent authenticated hasPaidAccess previewOnly complimentaryAccess={selected.complimentary} currentPlanNames={[selected.name]} currentPlanProductIds={[...selected.products] as ProductId[]} ownedBankIds={ownedBankIds} availableBanks={availableBanks} />
  </>;
}
