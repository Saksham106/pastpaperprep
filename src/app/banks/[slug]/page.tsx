import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { QuestionExplorer } from "@/components/QuestionExplorer";
import { BankSeoContent } from "@/components/BankSeoContent";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd } from "@/components/JsonLd";
import { isPreviewQuestion } from "@/lib/access";
import { getAvailableBanks, getBank, isLocalEconomicsBank, isLocalEconomicsPreviewEnabled, isPrivateBankIndexEnabled, type BankSlug } from "@/lib/banks";
import { EXPLORER_PAGE_SIZE, parseExplorerState } from "@/lib/explorer-state";
import { filterQuestions } from "@/lib/question-filter";
import { getQuestionRichDetails } from "@/lib/question-delivery";
import { localPreviewBankIndexUrl, mergeQuestionRichDetails, publicBankIndexUrl, publicMetadataToQuestion, toPublicQuestionMetadata } from "@/lib/question-index";
import { loadBankQuestions } from "@/lib/question-loader";
import { SOCIAL_IMAGE, SOCIAL_IMAGE_URL } from "@/lib/seo";

export const dynamicParams = false;
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
      images: [SOCIAL_IMAGE],
    },
    twitter: { card: "summary_large_image", title, description, images: [SOCIAL_IMAGE_URL] },
  };
}

export default async function BankPage({ params }: { params: Promise<{ slug: string }> }) {
  const slug = (await params).slug as BankSlug;
  const bank = getBank(slug);
  if (!bank) notFound();
  const localPreview = isLocalEconomicsPreviewEnabled() && isLocalEconomicsBank(slug);
  // One choke point decides whether this bank's metadata index is private; it is served
  // anonymously, so an advertised ?free=1 link always has a question list to browse.
  const privateIndex = isPrivateBankIndexEnabled(slug);
  // A catalog entry is not proof that a bank is runnable. A gated bank whose sealed
  // runtime is not promoted yet (or a corrupt artifact) fails closed as a 404 instead of
  // advertising a route that renders an error boundary, which would return HTTP 200.
  const allQuestions = await loadBankQuestions(slug).catch(() => null);
  if (!allQuestions) notFound();
  const filterableQuestions = allQuestions.map((question) => publicMetadataToQuestion(toPublicQuestionMetadata(question), slug));
  // Request-specific URL and member state hydrate in the client. Keeping them out of this
  // route lets Next pre-render every bank once at build time instead of parsing a full corpus
  // for every crawler and visitor request.
  const initialState = parseExplorerState({}, { defaultFreeOnly: !localPreview });
  const initialMatches = filterQuestions(filterableQuestions, {
    ...initialState.filters,
    search: undefined,
    sort: initialState.sort,
  })
    .filter((question) => !initialState.freeOnly || isPreviewQuestion(slug, question.id))
    .filter(() => !initialState.savedOnly);
  const sourceById = new Map(allQuestions.map((question) => [question.id, question]));
  const initialQuestions = initialMatches.slice(0, EXPLORER_PAGE_SIZE).map((question) => {
    const sourceQuestion = sourceById.get(question.id);
    return sourceQuestion
      ? mergeQuestionRichDetails(question, getQuestionRichDetails(sourceQuestion, [], new Date(), localPreview))
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
        <QuestionExplorer questions={initialQuestions} bankSlug={slug} localPreview={localPreview} indexUrl={localPreview ? localPreviewBankIndexUrl(slug) : privateIndex ? `/api/private-bank-index/${slug}` : publicBankIndexUrl(slug)} access={{ authenticated: false, bankAccess: localPreview, canExportPdf: localPreview }} initialState={initialState} bootstrapUrl={localPreview ? undefined : `/api/banks/bootstrap?bank=${encodeURIComponent(slug)}`} hydrateFromLocation />
        <BankSeoContent bank={bank} />
      </div>
    </>
  );
}
