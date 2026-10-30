import { hasFreeTier, isPreviewQuestion } from "@/lib/access";
import { isLocalEconomicsBank, isLocalEconomicsPreviewEnabled, type BankSlug } from "@/lib/banks";
import { EXPLORER_PAGE_SIZE, parseExplorerState, type ExplorerSearchParams } from "@/lib/explorer-state";
import { filterQuestions } from "@/lib/question-filter";
import { getQuestionRichDetails } from "@/lib/question-delivery";
import { mergeQuestionRichDetails, publicMetadataToQuestion, toPublicQuestionMetadata } from "@/lib/question-index";
import { loadBankQuestions } from "@/lib/question-loader";

/**
 * Static first page of a bank explorer, optionally narrowed by a route preset (a topic or
 * paper landing). Request-specific URL and member state hydrate in the client, so Next can
 * pre-render each route once at build time. Only free questions carry rich text here.
 */
export async function loadBankExplorer(slug: BankSlug, routePreset: ExplorerSearchParams = {}) {
  const localPreview = isLocalEconomicsPreviewEnabled() && isLocalEconomicsBank(slug);
  // A catalog entry is not proof that a bank is runnable. A gated bank whose sealed
  // runtime is not promoted yet (or a corrupt artifact) fails closed instead of
  // advertising a route that renders an error boundary, which would return HTTP 200.
  const allQuestions = await loadBankQuestions(slug).catch(() => null);
  if (!allQuestions) return null;
  const filterableQuestions = allQuestions.map((question) => publicMetadataToQuestion(toPublicQuestionMetadata(question), slug));
  // Banks without a free tier (e.g. Computer Science 0478) open on the full, locked bank.
  const initialState = parseExplorerState(routePreset, { defaultFreeOnly: !localPreview && hasFreeTier(slug), defaultPartialTopics: Boolean(routePreset.topic) });
  const routeMatches = filterQuestions(filterableQuestions, {
    ...initialState.filters,
    mainTopicOnly: !initialState.partialTopics,
    search: undefined,
    sort: initialState.sort,
  });
  const initialMatches = routeMatches
    .filter((question) => !initialState.freeOnly || isPreviewQuestion(slug, question.id))
    .filter(() => !initialState.savedOnly);
  const sourceById = new Map(allQuestions.map((question) => [question.id, question]));
  const initialQuestions = initialMatches.slice(0, EXPLORER_PAGE_SIZE).map((question) => {
    const sourceQuestion = sourceById.get(question.id);
    return sourceQuestion
      ? mergeQuestionRichDetails(question, getQuestionRichDetails(sourceQuestion, [], new Date(), localPreview))
      : question;
  });
  return { localPreview, initialState, initialQuestions, routeMatches };
}
