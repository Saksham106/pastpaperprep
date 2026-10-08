import Link from "next/link";
import { notFound } from "next/navigation";
import { PricingContent } from "@/components/PricingContent";
import type { ProductId } from "@/lib/access";
import { getBillingBanks, type BankSlug } from "@/lib/banks";

export const dynamic = "force-dynamic";
export const metadata = { title: "Local pricing preview", robots: { index: false, follow: false } };

const VIEWS = [
  { id: "free", label: "Free account", products: [], banks: [], name: "Free", complimentary: false, stacked: false },
  { id: "one-bank", label: "One bank", products: ["bank_ib_sl"], banks: ["ib-sl"], name: "IB Mathematics AA SL", complimentary: false, stacked: false },
  { id: "two-banks", label: "Two-bank subscription", products: ["bank_ib_sl"], banks: ["ib-sl", "ib-hl"], name: "Build Your Plan (2 banks)", complimentary: false, stacked: false },
  { id: "stacked", label: "Stacked subscriptions", products: ["bank_ib_sl", "bank_ib_hl"], banks: ["ib-sl", "ib-hl"], name: "Two separately billed subscriptions", complimentary: false, stacked: true },
  { id: "bundle", label: "Two-bank bundle", products: ["bundle_custom"], banks: ["ib-sl", "ib-hl"], name: "Build Your Plan (2 banks)", complimentary: false, stacked: false },
  { id: "all", label: "Complimentary All Access", products: ["bundle_all"], banks: [], name: "All Access", complimentary: true, stacked: false },
  { id: "lifetime", label: "Lifetime owner", products: ["lifetime_all_access"], banks: [], name: "Lifetime All Access", complimentary: false, stacked: false },
] as const;

export default async function PricingPreviewPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  if (process.env.NODE_ENV !== "development") notFound();
  const { view } = await searchParams;
  const selected = VIEWS.find((entry) => entry.id === view) ?? VIEWS[0];
  const availableBanks = getBillingBanks();
  const ownedBankIds: BankSlug[] = selected.id === "all" ? availableBanks.map((bank) => bank.slug) : [...selected.banks];
  return <>
    <PricingContent authenticated hasPaidAccess={selected.products.length > 0} previewOnly complimentaryAccess={selected.complimentary} previewStacked={selected.stacked} initialLifetimeSelected={selected.id === "lifetime"} currentPlanNames={[selected.name]} currentPlanProductIds={[...selected.products] as ProductId[]} ownedBankIds={ownedBankIds} availableBanks={availableBanks} />
    <nav className="pricing-preview-nav" aria-label="Subscriber views">
      {VIEWS.map((entry) => <Link key={entry.id} href={`/pricing/preview?view=${entry.id}`} aria-current={entry.id === selected.id ? "page" : undefined}>{entry.label}</Link>)}
    </nav>
  </>;
}
