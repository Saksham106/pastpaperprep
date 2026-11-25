import { hasFreeTier, isPreviewQuestion } from "@/lib/access";
import { isLocalEconomicsBank, isLocalEconomicsPreviewEnabled, type BankSlug } from "@/lib/banks";
import { matchesCourseRoute } from "@/lib/course-route";
import { EXPLORER_PAGE_SIZE, parseExplorerState, type ExplorerSearchParams } from "@/lib/explorer-state";
import { filterQuestions } from "@/lib/question-filter";
import { getQuestionRichDetails } from "@/lib/question-delivery";
import { mergeQuestionRichDetails, publicMetadataToQuestion, toPublicQuestionMetadata } from "@/lib/question-index";
import { loadQuestionImageShapes } from "@/lib/question-image-shapes";
import { loadBankQuestions } from "@/lib/question-loader";
import { FEED_TEASER_LIMIT, feedTeaserPool, type FeedTeaser } from "@/lib/upgrade-copy";

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
  const initialState = parseExplorerState(routePreset, { defaultFreeOnly: !localPreview && hasFreeTier(slug), defaultPartialTopics: Boolean(routePreset.topic), bank: slug });
  const routeMatches = filterQuestions(filterableQuestions, {
    ...initialState.filters,
    mainTopicOnly: !initialState.partialTopics,
    search: undefined,
    sort: initialState.sort,
  });
  // Banks that open on one route (A Level paper tabs) pre-render that route's questions.
  const initialMatches = routeMatches
    .filter((question) => matchesCourseRoute(question.syllabusRoute, initialState.courseRoute))
    .filter((question) => !initialState.freeOnly || isPreviewQuestion(slug, question.id))
    .filter(() => !initialState.savedOnly);
  const sourceById = new Map(allQuestions.map((question) => [question.id, question]));
  // The same image sizes the public bank index carries, so first-page placeholders hold each image's shape.
  const shapesOf = await loadQuestionImageShapes(slug);
  const initialQuestions = initialMatches.slice(0, EXPLORER_PAGE_SIZE).map((question) => {
    const sourceQuestion = sourceById.get(question.id);
    const imageSizes = shapesOf(question.id);
    const sized = imageSizes?.length === question.questionImageCount ? { ...question, imageSizes } : question;
    return sourceQuestion
      ? mergeQuestionRichDetails(sized, getQuestionRichDetails(sourceQuestion, [], new Date(), localPreview))
      : sized;
  });
  // The page's paid-question teasers, so the feed cards are in the HTML instead of arriving with the full index.
  const initialTeasers = initialState.freeOnly
    ? feedTeaserPool(routeMatches.filter((question) => matchesCourseRoute(question.syllabusRoute, initialState.courseRoute)))
      .slice(0, FEED_TEASER_LIMIT)
      .map(({ id, year, session, paper, number, marks, primaryTopic }): FeedTeaser => ({ id, year, session, paper, number, marks, primaryTopic }))
    : [];
  return { localPreview, initialState, initialQuestions, initialTeasers, routeMatches };
}
