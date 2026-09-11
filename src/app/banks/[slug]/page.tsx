import { createHash } from "node:crypto";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { QuestionExplorer } from "@/components/QuestionExplorer";
import { BankSeoContent } from "@/components/BankSeoContent";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd } from "@/components/JsonLd";
import { canExportPdf, hasBankAccess, isPreviewQuestion } from "@/lib/access";
import { getAvailableBanks, getBank, isEconomicsProductionEnabled, isLocalEconomicsBank, isLocalEconomicsPreviewEnabled, type BankSlug } from "@/lib/banks";
import { EXPLORER_PAGE_SIZE, parseExplorerState, type ExplorerSearchParams } from "@/lib/explorer-state";
import { filterQuestions } from "@/lib/question-filter";
import { normalizeEntitlements } from "@/lib/entitlements";
import { getQuestionRichDetails } from "@/lib/question-delivery";
import { localPreviewBankIndexUrl, mergeQuestionRichDetails, privateEconomicsBankIndexUrl, publicBankIndexUrl, publicMetadataToQuestion, toPublicQuestionMetadata } from "@/lib/question-index";
import { loadBankQuestions } from "@/lib/question-loader";
import { searchQuestionIds } from "@/lib/question-search";
import { hasSupabaseAuthCookie } from "@/lib/supabase/proxy";
import { createClient } from "@/lib/supabase/server";

export function generateStaticParams() { return getAvailableBanks().map(({ slug }) => ({ slug })); }

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const bank = getBank((await params).slug);
  if (!bank) return {};
  const path = `/banks/${bank.slug}`;
  const title = `${bank.shortName} Past Papers by Topic`;
  const description = `Practise ${bank.title} past-paper questions by topic, year, paper, marks, and more. Check answers and build focused revision sets.`;
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title: `${title} | PastPaperPrep`,
      description,
      url: path,
      type: "website",
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function BankPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<ExplorerSearchParams> }) {
  const slug = (await params).slug as BankSlug;
  const rawSearchParams = await searchParams;
  const bank = getBank(slug);
  if (!bank) notFound();
  const localPreview = isLocalEconomicsPreviewEnabled() && isLocalEconomicsBank(slug);
  const productionEconomics = isEconomicsProductionEnabled() && isLocalEconomicsBank(slug);
  const hasAuthCookie = hasSupabaseAuthCookie((await cookies()).getAll());
  const supabase = !localPreview && hasAuthCookie ? await createClient() : null;
  const claimsData = supabase ? (await supabase.auth.getClaims()).data : null;
  const userId = claimsData?.claims?.sub;
  const exportMarker = typeof userId === "string"
    ? createHash("sha256").update(userId).digest("hex").slice(0, 10).toUpperCase()
    : undefined;
  const [{ data: entitlementRows }, { data: savedRows }, { data: attemptRows }] = userId && supabase
    ? await Promise.all([
      supabase.from("entitlements").select("product_id, selected_bank_ids, status, starts_at, expires_at").eq("user_id", userId),
      supabase.from("saved_questions").select("question_id").eq("user_id", userId).eq("bank_slug", slug),
      supabase.from("attempts").select("question_id").eq("user_id", userId).eq("bank_slug", slug),
    ])
    : [{ data: [] }, { data: [] }, { data: [] }];
  const entitlements = normalizeEntitlements(entitlementRows ?? []);
  const bankAccess = localPreview || hasBankAccess(slug, entitlements);
  const allQuestions = await loadBankQuestions(slug);
  const filterableQuestions = allQuestions.map((question) => publicMetadataToQuestion(toPublicQuestionMetadata(question), slug));
  const initialState = parseExplorerState(rawSearchParams, { defaultFreeOnly: !bankAccess });
  const savedIdSet = new Set((savedRows ?? []).map((row) => row.question_id));
  const initialSearchIds = initialState.search
    ? new Set(searchQuestionIds(allQuestions, initialState.search, entitlements))
    : null;
  const initialMatches = filterQuestions(filterableQuestions, {
    ...initialState.filters,
    search: undefined,
    sort: initialState.sort,
  })
    .filter((question) => !initialSearchIds || initialSearchIds.has(question.id))
    .filter((question) => !initialState.freeOnly || isPreviewQuestion(slug, question.id))
    .filter((question) => !initialState.savedOnly || savedIdSet.has(question.id));
  const sourceById = new Map(allQuestions.map((question) => [question.id, question]));
  const initialQuestions = initialMatches.slice(0, EXPLORER_PAGE_SIZE).map((question) => {
    const sourceQuestion = sourceById.get(question.id);
    return sourceQuestion
      ? mergeQuestionRichDetails(question, getQuestionRichDetails(sourceQuestion, entitlements, new Date(), localPreview))
      : question;
  });

  return (
    <>
      <JsonLd data={{
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "CollectionPage",
            "@id": `https://pastpaperprep.com/banks/${bank.slug}#page`,
            url: `https://pastpaperprep.com/banks/${bank.slug}`,
            name: `${bank.shortName} Past Papers by Topic`,
            description: bank.description,
            isPartOf: { "@id": "https://pastpaperprep.com/#website" },
            about: {
              "@type": "Course",
              name: bank.title,
              educationalLevel: bank.qualification,
            },
          },
          {
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "PastPaperPrep", item: "https://pastpaperprep.com/" },
              { "@type": "ListItem", position: 2, name: bank.shortName, item: `https://pastpaperprep.com/banks/${bank.slug}` },
            ],
          },
        ],
      }} />
      <section className={`bank-hero ${bank.accent}`}>
        <div className="shell">
          <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: bank.shortName }]} />
          <p className="eyebrow">{bank.qualification}</p>
          <h1>{bank.title}</h1>
          <p>{bank.description}</p>
          <div className="bank-hero-stats"><span><strong>{bank.questionCount.toLocaleString()}</strong> questions</span><span><strong>{bank.paperCount}</strong> papers</span><span><strong>{bank.years}</strong> coverage</span></div>
        </div>
      </section>
      <div className="shell">
        <QuestionExplorer questions={initialQuestions} bankSlug={slug} localPreview={localPreview} indexUrl={localPreview ? localPreviewBankIndexUrl(slug) : productionEconomics ? privateEconomicsBankIndexUrl(slug) : publicBankIndexUrl(slug)} access={{ authenticated: Boolean(userId), bankAccess, canExportPdf: localPreview || canExportPdf(slug, entitlements) }} exportMarker={exportMarker} initialState={initialState} studyState={{ savedIds: (savedRows ?? []).map((row) => row.question_id), attemptedIds: (attemptRows ?? []).map((row) => row.question_id) }} />
        <BankSeoContent bank={bank} />
      </div>
    </>
  );
}
