import type { Metadata } from "next";
import { PricingPageClient } from "@/components/PricingPageClient";
import { getBillingBanks } from "@/lib/banks";
import { PRICING_INTENT_HINT_SCRIPT } from "@/lib/pricing-intent";
import { socialPreview } from "@/lib/seo";
import { formatUpdateDate, lastUpdated } from "@/lib/updates";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Choose one PastPaperPrep question bank across IGCSE and IB Maths, Biology, Chemistry, Physics and Economics; build an exact bundle of two to five, or unlock every current bank.",
  alternates: { canonical: "/pricing" },
  openGraph: {
    title: "PastPaperPrep Pricing",
    description: "Choose one bank, build your exact bundle, or get All Access across every PastPaperPrep question bank.",
    url: "/pricing",
    type: "website",
    ...socialPreview(),
  },
};

// Served from the CDN: no cookies, headers or searchParams here. The URL's selection and the
// signed-in plan state are applied in the browser (PricingPageClient, /api/pricing/account).
// "error" fails the build if a request-time API is ever reintroduced.
export const dynamic = "error";

export default function PricingPage() {
  const updated = lastUpdated();
  return <>
    <script dangerouslySetInnerHTML={{ __html: PRICING_INTENT_HINT_SCRIPT }} />
    <PricingPageClient availableBanks={getBillingBanks()} updated={updated ? { date: updated, label: formatUpdateDate(updated) } : undefined} />
  </>;
}
