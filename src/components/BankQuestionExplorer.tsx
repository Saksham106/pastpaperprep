import { preconnect, preload } from "react-dom";
import { QuestionExplorer } from "@/components/QuestionExplorer";
import { hasFreeTier } from "@/lib/access";
import { assetOriginsForBank } from "@/lib/asset-origins";
import type { loadBankExplorer } from "@/lib/bank-explorer";
import type { BankSlug } from "@/lib/banks";
import { freeAssetIndexPath } from "@/lib/free-asset-index";
import type { ExplorerSearchParams } from "@/lib/explorer-state";
import { localPreviewBankIndexUrl, publicBankIndexUrl } from "@/lib/question-index";

type BankExplorerData = NonNullable<Awaited<ReturnType<typeof loadBankExplorer>>>;

/** The public question-bank explorer, shared by bank, topic, and paper routes. */
export function BankQuestionExplorer({ slug, explorer, routePreset, fullPaperHrefs, notesLinks }: { slug: BankSlug; explorer: BankExplorerData; routePreset?: ExplorerSearchParams; fullPaperHrefs?: Record<string, string>; notesLinks?: Record<string, { href: string; label: string }> }) {
  const { localPreview, initialState, initialQuestions, initialTeasers } = explorer;
  // Question images come from signed Storage/R2 URLs; open those connections while JS loads.
  for (const origin of assetOriginsForBank(slug)) preconnect(origin);
  // Free questions get their image links from this static index. Fetching it while the scripts
  // load, instead of after hydration, takes a round trip off the first question image (LCP).
  // Same URL and credentials mode as the plain fetch() in signed-assets.ts, so the browser reuses it.
  if (!localPreview && hasFreeTier(slug)) preload(freeAssetIndexPath(slug), { as: "fetch", crossOrigin: "anonymous" });
  return (
    <QuestionExplorer
      questions={initialQuestions}
      bankSlug={slug}
      localPreview={localPreview}
      indexUrl={localPreview ? localPreviewBankIndexUrl(slug) : publicBankIndexUrl(slug)}
      access={{ authenticated: false, bankAccess: localPreview, canExportPdf: localPreview }}
      initialState={initialState}
      initialTeasers={initialTeasers}
      bootstrapUrl={localPreview ? undefined : `/api/banks/bootstrap?bank=${encodeURIComponent(slug)}`}
      hydrateFromLocation
      routePreset={routePreset}
      fullPaperHrefs={fullPaperHrefs}
      notesLinks={notesLinks}
    />
  );
}
