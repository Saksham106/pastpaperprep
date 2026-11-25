# Site-wide study helper — design (2026-11-24)

Builds on the per-question helper (`2026-11-24-ai-helper-design.md`, PR #522). The name "Pepper" is still a stand-in in `HELPER_NAME`.

## Why

Today Pepper only lives on a question card. Students also get lost one step earlier: which bank, which topic, which year, where the full paper is. A Pepper they can open from any page can take "show me 2023 Paper 2 vectors questions" or "open the May 2024 Paper 1 for AA HL" and do it: set the bank filters and open the page. It also answers general study questions ("what's the difference between speed and velocity?").

## What students get

- **A floating "Ask Pepper" button** in the bottom-right corner of every page (the owner picked it over a header button and a header ask box, 2026-11-24). On phones it shrinks to the face. It opens the same "study sheet" panel as the question helper, with the face, colours and type, and hides while any helper sheet is open.
- **Navigation that happens for them.** When Pepper finds the right place it opens it: the bank with filters applied, a topic page, a full paper, My worksheets, notes. The panel stays open across the page change, and each opened page shows as a small link card in the chat ("Opened: IB Math AA HL · Vectors · 2023"), so the student can go back to it.
- **Study questions.** Plain explanations, no question materials loaded. For a specific question, Pepper points them to the question's own **Ask Pepper** button, which has the mark scheme.
- **Same chips idea, site flavour:** "Find questions", "Find a past paper", "Explain a topic". Each pre-fills the box rather than sending, because each needs a subject.
- **Signed-out visitors** see the same sign-in card as the question helper.

## Tools the agent gets

All tools run on the server, read build-time metadata only, and never return question text, images or mark schemes. That's the main safety line: nothing paid can leak through the site helper, whatever the user asks.

| Tool | What it does | Data |
|---|---|---|
| `search_site` | Subjects, topics and subtopics matching words ("vectors", "0625 electricity"), with counts and links | `public/search/index.json` via the existing `searchSite` / `matchTopics` |
| `bank_details` | One bank's topics (with subtopics and counts), years, papers, sessions, Core/Extended or paper routes | `index.json` + new `public/search/facets.json` + `routeConfigFor` |
| `find_past_papers` | Full papers in `/past-papers` matching a description ("AA HL May 2024 paper 1 TZ2") | `public/search/papers.json` via `searchSite` |
| `open_bank` | Opens a bank with filters: topics, subtopics, years, papers, sessions, route, search words, free only | Validated against `bank_details`; URL built with `serializeExplorerState` |
| `open_page` | Opens any other site page: a full paper, topic page, notes, My worksheets, dashboard, pricing | Path checked against an allowlist |

The data files are read with `fs` from `public/search/`, shipped to the function with `outputFileTracingIncludes`, and cached per instance. `facets.json` is new: written by `scripts/generate-search-index.mts` next to the other two, with each bank's years, papers and sessions.

Question-level text search ("questions about the photoelectric effect") goes through `open_bank`'s search words: the bank page's own search does the matching, with the student's own access. The agent doesn't read the question search corpus, because it holds premium text.

## How navigation happens

1. The agent calls `open_bank` or `open_page`. The server validates the input, builds a path, and checks it:
   - It must be a same-site path, with no protocol, `//`, backslashes or control characters.
   - Its first segment must be on the allowlist: `banks`, `past-papers`, `revision-notes`, `worksheets`, `dashboard`, `pricing`, `syllabus`, `grade-thresholds`, `articles`, `cambridge-igcse`, `cambridge-a-level`, `ib`, `faq`, `updates`.
   - Never `api`, `auth`, `account`, `login`, `r`, `invite` or `helper`.
2. The tool result tells the model the page was opened. The server sends a structured action to the browser on the same stream: `{ type: "navigate", path, label }`.
3. The browser checks the path again with the same allowlist, then calls `router.push(path)`. The panel is mounted in the root layout, so it survives client-side navigation. The conversation is also kept in `sessionStorage`, so a full reload doesn't lose it.
4. At most **2 navigations per message**, followed as they arrive. Each one also stays in the chat as a link card.
5. On phones the sheet covers the whole screen, so once a reply has opened a page, the sheet closes to show it. The conversation is kept, and the button reopens it.

**Wire format:** newline-delimited JSON (`application/x-ndjson`): `{"type":"text","text":"…"}`, `{"type":"navigate","path":"…","label":"…"}`, `{"type":"done"}`. The question helper keeps its plain-text stream.

## What it must never do

- **No purchases, plan changes or account changes.** No tool can reach checkout, billing, account or auth routes. `/pricing` can be opened to look at; buying is always the student's own click.
- **No paid content to people without access.** The tools return metadata only. Pages it opens enforce access exactly as they do today: free-question gates, the free-only default and locked cards are unchanged.
- **No coursework.** IA / EE / TOK writing is declined, as in the question helper.
- **No following instructions found in page paths, search results or messages.** The same rule as the question helper.
- **No invented links.** Every path comes from a tool, never from the model's text. Links in the model's text aren't rendered as links.

## Rules before AI

The owner asked for a decision layer where one fits (2026-11-24). Before any model call, `siteShortcut` (`src/lib/helper/site-shortcut.ts`) checks the message against the same search index.

**It opens the page directly**, with no model call and no helper message used, when the message:

- names exactly one full paper: subject or code, year, session, and paper or component, e.g. "0580 may june 2024 paper 22"
- is exactly one topic name, alone or after its subject: "number", or "ib aa hl calculus"
- is exactly one subject: "IB Physics HL"

On a bank page, a bare topic means that bank's topic.

**Everything else goes to the model:**

- questions and explanations: "why", "how", "explain", "?"
- anything ambiguous: two banks, a missing year or paper
- anything longer than about ten words

Mid-conversation only the unambiguous rules apply: a full paper, or a topic on its own bank page. That way "calculus" after a chat about one subject isn't sent to a different one.

**Why:** most navigation requests are short and exact, and parsing them costs nothing. Open-ended requests ("I keep losing marks on vectors, what should I do") need language understanding, so they stay with the model. The rules only pick from the search index, so they can open nothing the tools couldn't. Rule answers are logged as `helper_usage` with `rules: true`, and `helper_result` carries `rules`, so we can see how much traffic they absorb.

## Cost limits

- **Model:** the same `HELPER_MODEL` (default `claude-opus-5-5`), effort `low`, adaptive thinking (always on for Opus 5.5).
- **Up to 4 tool rounds per message.** After the fourth round the model must answer in text. `max_tokens` is 4000 per call.
- **Caching:** the system prompt and tool list are cached (stable bytes, no dates or user data before the breakpoint). History is the visible text only: tool calls and results from earlier messages aren't resent. Up to 12 earlier turns are sent.
- **Rough cost:** about $0.01–0.04 per message (1–3 calls, mostly cached input).
- **Logging:** a `helper_usage` log line per call with token counts and `surface: "site"`, never text.

## Shared daily allowance

One site message is one use from the same `consume_helper_allowance` counter: 5 a day free, 30 paid. It doesn't matter how many tool rounds the message took. A failed first call gives the use back (`release_helper_allowance`), as today. No migration is needed.

## Boards

The site helper works for every board, IB included. The owner switched IB on for the question helper too (2026-11-24). The site helper only ever handles metadata that is already public in the site search index (subject names, topic labels, paper names) and the student's own words. `HELPER_SITE_BOARDS` can hide a board from the tools on its own, separately from the question helper's `HELPER_BOARDS`.

## Where it shows

It shows on every page where `helperConfigured()` is true, except `/helper/*` (the phone page), `/login` and `/auth/*`. On bank pages the question cards keep their own **Ask Pepper** buttons. Only one panel is open at a time, using the same `pastpaperprep:helper-open` event.

## Analytics

Events, never with message text:

- `helper_open` with `surface: "site"` and `page` (route group only: `bank`, `paper`, `home`, …)
- `helper_send` with `surface: "site"`
- `helper_navigate` with `kind` (`bank` / `page`) and `bank` when known
- `helper_result`
- `helper_limit`
- `helper_error`

## Not in v1

- Reading the page the student is looking at beyond its path
- Saving worksheets or exporting PDFs for them (both are account actions; maybe later with a confirm step)
- Voice
- Cross-device history

## Calls I made (owner can overrule)

- Navigation is automatic, not "tap to open". The student asked for it, it's undoable with Back, and a link card stays in the chat.
- Signed-in only, sharing the existing counter. No separate site quota.
- IB on (the owner also switched it on for the question helper).
- Chips pre-fill the box rather than sending.
- Rule-answered messages are free: they don't use the daily allowance, because they cost nothing.
