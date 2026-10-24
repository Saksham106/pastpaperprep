import { preconnect } from "react-dom";
import { QuestionExplorer } from "@/components/QuestionExplorer";
import { assetOriginsForBank } from "@/lib/asset-origins";
import type { loadBankExplorer } from "@/lib/bank-explorer";
import type { BankSlug } from "@/lib/banks";
import type { ExplorerSearchParams } from "@/lib/explorer-state";
import { localPreviewBankIndexUrl, publicBankIndexUrl } from "@/lib/question-index";

type BankExplorerData = NonNullable<Awaited<ReturnType<typeof loadBankExplorer>>>;

/** The public question-bank explorer, shared by bank, topic, and paper routes. */
export function BankQuestionExplorer({ slug, explorer, routePreset, fullPaperHrefs }: { slug: BankSlug; explorer: BankExplorerData; routePreset?: ExplorerSearchParams; fullPaperHrefs?: Record<string, string> }) {
  const { localPreview, initialState, initialQuestions } = explorer;
  // Question images come from signed Storage/R2 URLs; open those connections while JS loads.
  for (const origin of assetOriginsForBank(slug)) preconnect(origin);
  return (
    <QuestionExplorer
      questions={initialQuestions}
      bankSlug={slug}
      localPreview={localPreview}
      indexUrl={localPreview ? localPreviewBankIndexUrl(slug) : publicBankIndexUrl(slug)}
      access={{ authenticated: false, bankAccess: localPreview, canExportPdf: localPreview }}
      initialState={initialState}
      bootstrapUrl={localPreview ? undefined : `/api/banks/bootstrap?bank=${encodeURIComponent(slug)}`}
      hydrateFromLocation
      routePreset={routePreset}
      fullPaperHrefs={fullPaperHrefs}
    />
  );
}
