import type { BankSlug } from "@/lib/catalog";
import { rankedTopicLabels } from "@/lib/pdf-labels";

type TitleQuestion = { bankSlug: BankSlug; primaryTopic: string; paper: number };
const MAX_TITLE = 80;
const joinList = (items: string[]) => items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} & ${items.at(-1)}`;

/** A default worksheet name drawn from its content, numbered when the user already has one like it. */
export function suggestWorksheetTitle(questions: readonly TitleQuestion[], existingTitles: readonly string[] = []): string {
  const topics = rankedTopicLabels(questions);
  const papers = [...new Set(questions.map((question) => question.paper))].sort((a, b) => a - b);
  const base = topics.length === 1 ? topics[0]
    : topics.length === 2 ? `${topics[0]} & ${topics[1]}`
      : topics.length > 2 ? `${topics[0]}, ${topics[1]} & more`
        : papers.length ? `Paper ${joinList(papers.map(String))} mix` : "Practice set";
  const taken = new Set(existingTitles.map((title) => title.trim().toLocaleLowerCase()));
  const fit = (suffix: string) => `${base.slice(0, MAX_TITLE - suffix.length).trimEnd()}${suffix}`;
  for (let copy = 1; ; copy += 1) {
    const title = fit(copy === 1 ? "" : ` ${copy}`);
    if (!taken.has(title.toLocaleLowerCase())) return title;
  }
}
