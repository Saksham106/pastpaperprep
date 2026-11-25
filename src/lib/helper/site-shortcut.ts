import { looksLikePaper, matchSubjects, searchSite, type SearchTopic } from "@/lib/site-search";
import { parsePaperQuery } from "@/lib/past-paper-catalog";
import type { SiteData, SiteNavigation } from "@/lib/helper/site-tools";

// Rules before AI: a message that names exactly one paper, topic or subject is opened straight away, with no model
// call and no helper message used. Anything vaguer or wordier (a question, two candidates, a follow-up) goes to the
// model. The rules only ever pick from the search index, so they can't open anything the tools couldn't.

export type SiteShortcut = { navigation: SiteNavigation; reply: string };

const MAX_CHARS = 90;
const MAX_WORDS = 10;
/** Words that mean the student wants an explanation or a conversation, not a page. */
const CONVERSATIONAL = /\?|\b(?:why|how|what|when|which|explain|help|hint|difference|mean|means|define|solve|mark|check|compare|vs|versus|best|should|can|could|is|are|does|do)\b/i;
/** Polite and navigational filler around the thing they want. */
const FILLER = new Set(["open", "show", "me", "take", "go", "to", "the", "find", "get", "practise", "practice", "practicing", "practising", "questions", "question", "on", "about", "for", "please", "pls", "i", "want", "some", "topic", "topics", "bank", "page", "a", "an", "of", "in"]);

const normalise = (value: string) => value.toLowerCase().replace(/[^a-z0-9/\s]/g, " ").replace(/\s+/g, " ").trim();
const meaningful = (value: string) => normalise(value).split(" ").filter((word) => word && !FILLER.has(word)).join(" ");

/** The bank the student is looking at, from a /banks/<slug>... page. */
function pageBank(page: string): string | null {
  const match = /^\/banks\/([a-z0-9-]+)/.exec(page);
  return match ? match[1] : null;
}

function paperShortcut(data: SiteData, text: string): SiteShortcut | null {
  if (!looksLikePaper(text) || !data.papers.papers.length) return null;
  const query = parsePaperQuery(text);
  // A paper is named only by year, session and its paper/component together; otherwise the model asks which.
  if (!query.year || !query.session || !(query.component || query.paper)) return null;
  const results = searchSite(data.index, data.papers, text);
  if (results.papers.length !== 1) return null;
  const paper = results.papers[0];
  return { navigation: { kind: "page", path: paper.href, label: paper.title, bank: paper.bankSlug }, reply: `Here's ${paper.title}, with its mark scheme.` };
}

function topicShortcut(data: SiteData, text: string, page: string, followUp: boolean): SiteShortcut | null {
  const wanted = meaningful(text);
  if (!wanted) return null;
  const candidates: SearchTopic[] = [];
  for (const topic of data.index.topics) {
    const label = meaningful(topic.label);
    if (!label || !wanted.endsWith(label)) continue;
    const rest = wanted.slice(0, wanted.length - label.length).trim();
    if (!rest) { candidates.push(topic); continue; }
    // "igcse physics electricity": the words before the topic must name this topic's bank and only it.
    const subjects = matchSubjects(data.index.subjects, rest);
    if (subjects.length === 1 && subjects[0].bank === topic.bank) candidates.push(topic);
  }
  if (!candidates.length) return null;
  // A bare topic name on a bank page means that bank's topic.
  const here = pageBank(page);
  const local = here ? candidates.filter((topic) => topic.bank === here) : [];
  // Mid-conversation, a bare topic may refer to the subject being discussed: only the page's own bank settles it.
  if (followUp && !local.length) return null;
  const pool = local.length ? local : candidates;
  // Prefer whole-topic matches over subtopics only when that settles it.
  const topLevel = pool.filter((topic) => !topic.parent);
  const pick = pool.length === 1 ? pool[0] : topLevel.length === 1 ? topLevel[0] : null;
  if (!pick) return null;
  const subject = data.index.subjects.find((s) => s.bank === pick.bank);
  const label = subject ? `${subject.name} · ${pick.label}` : pick.label;
  return { navigation: { kind: "bank", path: pick.href, label, bank: pick.bank }, reply: `Here are the ${pick.label} questions.` };
}

function subjectShortcut(data: SiteData, text: string): SiteShortcut | null {
  const wanted = meaningful(text);
  if (!wanted) return null;
  const subjects = matchSubjects(data.index.subjects, wanted).filter((s) => s.practiceHref);
  if (subjects.length !== 1) return null;
  // Every word must be part of the subject's name, so "physics electricity" isn't read as just "physics".
  if (!wanted.split(" ").every((word) => subjects[0].terms.some((term) => term.startsWith(word)))) return null;
  const subject = subjects[0];
  return { navigation: { kind: "bank", path: subject.practiceHref, label: subject.name, bank: subject.bank }, reply: `Here's ${subject.name}. Pick a topic on the left, or tell me what to filter.` };
}

/** The page to open without AI, or null when the message needs the model. A follow-up only takes unambiguous rules. */
export function siteShortcut(data: SiteData, text: string, page: string, followUp = false): SiteShortcut | null {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > MAX_CHARS || trimmed.split(/\s+/).length > MAX_WORDS || CONVERSATIONAL.test(trimmed)) return null;
  return paperShortcut(data, trimmed) ?? topicShortcut(data, trimmed, page, followUp) ?? (followUp ? null : subjectShortcut(data, trimmed));
}
