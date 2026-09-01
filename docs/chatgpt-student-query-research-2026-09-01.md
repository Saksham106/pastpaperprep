# PastPaperPrep: ChatGPT student-query research

Date: 2026-09-01

## Method

Used anonymous ChatGPT in Ego Browser with Web Search enabled. Prompts were intentionally written like real students, not as SEO or operator instructions. Captured the full anonymous `conversation/updates` network response streams from DevTools/CDP.

The anonymous lightweight endpoint returned the complete response and source payloads but did **not** expose a literal `queries` field. Therefore this report preserves the actual prompts, searched source titles/URLs, and visible search themes rather than pretending inferred phrases are exact hidden queries.

Raw captures are retained locally outside the repository because they are generated network payloads, not publishable site content:

- `/Users/sakshamgoel/Documents/ProjectsInternships/pastpaperprep-chatgpt-igcse-stream.html` — SHA-256 `30af2be50b2d996f37971f86c1fa369d982945f629b35098fcb1f62a80d5df7f`
- `/Users/sakshamgoel/Documents/ProjectsInternships/pastpaperprep-chatgpt-ib-stream.html` — SHA-256 `b5acd860a89bbd47c718874f7695ab1e753901c213880f53987726e4f69676f5`

## Student prompt 1: Cambridge IGCSE Mathematics 0580

> i keep losing marks on the same topics in cambridge igcse maths 0580 even after doing loads of past papers. can you search for the best free topic questions and tell me exactly how to use them so i stop repeating the same mistakes?

### What ChatGPT searched and surfaced

- MathsGenie CIE IGCSE Maths resources and topic-question pages
- Cambridge IGCSE Mathematics 0580 past papers
- Cambridge 0580 Resource Plus demo and skills packs

### Demand themes visible in the response

- Free topic questions for exact weak areas
- Why full papers do not fix repeated mistakes
- How to build and use a mistake/error tracker
- Easy → medium → hard progression
- Spaced re-testing rather than one-and-done practice
- When to use topic practice versus full papers
- A practical weekly revision system

## Student prompt 2: IB Mathematics AA HL

> i do ib maths aa hl and i'm overwhelmed by past papers. i only want questions on the topics i'm weak at and i need to know if i'm using them properly. can you search and show me the best way to revise and which sites are actually worth using without spending loads?

### What ChatGPT searched and surfaced

Official/product sources:

- IB Mathematics: Analysis and Approaches curriculum pages
- Revision Village AA HL Questionbank
- Christos Nikolaidis Maths resources
- Official IB Questionbank
- IB sample examination papers

Community result titles surfaced by ChatGPT:

- “which resources”
- “Resources”
- “Math AA HL resources needed (anything honestly)”
- “Please recommend niche free resources”
- “AA math HL - where to find past papers?”
- “MATH AA practice”

### Demand themes visible in the response

- Best free or low-cost IB Maths AA HL resources
- Topic-specific practice for weak areas
- How to use question banks without passively reading solutions
- Weak-topic repair → mixed practice → exam simulation
- When full papers become useful
- How to keep an error log and retest mistakes

## Editorial decision

Do not mass-produce a page for every phrase. Existing PastPaperPrep pages already cover topical-question banks and direct competitor comparisons. The highest-value, non-cannibalizing additions are:

1. **Past Paper Mistake Log: Stop Repeating the Same Errors** — serves both IGCSE and IB students and directly answers the repeated-mistake problem.
2. **Topic Questions vs Full Past Papers: When to Use Each** — answers the progression and exam-timing problem without duplicating the existing “how to use past papers” guide.
3. **Best Free IB Maths AA HL Practice Resources** — addresses explicit low-cost resource demand, with an honest comparison and a clear workflow rather than a link dump.

The existing IGCSE 0580 topical-questions article should be strengthened with the free-resource and mistake-loop insights instead of creating a near-duplicate page.
