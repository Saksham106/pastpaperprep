import type { Article } from "@/lib/articles";

/**
 * Cambridge International AS & A Level articles added 2026-11-21. Topics were chosen from search research done the
 * same day: Google autocomplete (strong "<code> topical past papers p1/p4", "9708 topical mcqs", "9701 data
 * booklet", "9709 mf19", "9702 formula sheet", "cie a level grade boundaries 2026", "znotes vs save my exams"),
 * r/alevel threads ("best websites for free A-Level topical past paper questions", "is savemyexams worth it for a
 * level", "Mechanics or Statistics?", "help me understand the grade thresholds"), Bing Copilot grounding queries
 * (comparison and "by topic" pages cited most) and PostHog article sessions (IB "past papers by topic" and
 * "alternatives" guides lead). Evidence is in the PR body.
 *
 * Facts: syllabuses pinned in research/a-level-scoping/sources; Cambridge grade threshold tables for Nov 2025 and
 * June 2026 pinned in the content workspaces (data/extras/*-gt.pdf); the 9701/9700 2019→2022 concordances in the
 * content workspaces, re-checked against syllabus text; the 9708 June 2023 Principal Examiner Report; production bank
 * data on 2026-11-21. Competitor pages were checked on 21 November 2026 (curl and Ego Browser, no logins); notes in
 * side-session-notes/…/a-level-competitor-checks-2026-11-21.md.
 *
 * Explanation coverage: only 9709 Pure 1–3 have worked explanations, so nothing here claims more.
 */

const CIE = (slug: string, label: string) => ({ href: `https://www.cambridgeinternational.org/programmes-and-qualifications/${slug}/`, label: `Cambridge International: ${label}` });
const SYLLABUS_9709 = CIE("cambridge-international-as-and-a-level-mathematics-9709", "AS & A Level Mathematics 9709");
const SYLLABUS_9702 = CIE("cambridge-international-as-and-a-level-physics-9702", "AS & A Level Physics 9702");
const SYLLABUS_9701 = CIE("cambridge-international-as-and-a-level-chemistry-9701", "AS & A Level Chemistry 9701");
const SYLLABUS_9700 = CIE("cambridge-international-as-and-a-level-biology-9700", "AS & A Level Biology 9700");
const SYLLABUS_9708 = CIE("cambridge-international-as-and-a-level-economics-9708", "AS & A Level Economics 9708");
const THRESHOLD_TABLES = CIE("cambridge-advanced/cambridge-international-as-and-a-levels/grade-threshold-tables", "AS & A Level grade threshold tables");
const CAMBRIDGE_9701_PAPERS = { href: "https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-international-as-and-a-level-chemistry-9701/past-papers/", label: "Cambridge International: 9701 past papers (a selection)" };

const SME_PLANS = { href: "https://www.savemyexams.com/learning-hub/support/why-pay-for-save-my-exams/", label: "Save My Exams: Free, Essential and Premium" };
const SME_JOIN = { href: "https://www.savemyexams.com/join/", label: "Save My Exams: plans and prices" };
const SME_CIE_MATHS = { href: "https://www.savemyexams.com/a-level/maths/cie/20/", label: "Save My Exams: CIE A Level Maths" };
const SME_CIE_PAPERS = { href: "https://www.savemyexams.com/a-level/maths/cie/past-papers/", label: "Save My Exams: CIE A Level Maths past papers" };
const SME_CIE_ECON = { href: "https://www.savemyexams.com/a-level/economics/cie/23/", label: "Save My Exams: CIE A Level Economics" };
const ZNOTES_9709 = { href: "https://znotes.org/caie/as-level/mathematics-9709/", label: "ZNotes: AS Level Mathematics 9709" };
const ZNOTES_9701 = { href: "https://znotes.org/caie/as-level/chemistry-9701/", label: "ZNotes: AS Level Chemistry 9701" };
const ZNOTES_BOOST = { href: "https://znotes.org/boost/", label: "ZNotes: free plan and Boost" };
const PMT_9709 = { href: "https://www.physicsandmathstutor.com/a-level-maths-papers/cie-paper-1/", label: "Physics & Maths Tutor: CAIE Pure 1 (9709) papers" };
const PMT_9702 = { href: "https://www.physicsandmathstutor.com/past-papers/a-level-physics/cie-paper-1/", label: "Physics & Maths Tutor: CAIE Physics 9702 Paper 1" };
const PAPA_DIRECTORY = { href: "https://pastpapers.papacambridge.com/papers/caie/as-and-a-level", label: "PapaCambridge: CAIE AS & A Level past papers" };
const PAPA_9709 = { href: "https://pastpapers.papacambridge.com/papers/caie/as-and-a-level-mathematics-9709", label: "PapaCambridge: Mathematics 9709" };
const PAPA_9709_TOPICAL = { href: "https://pastpapers.papacambridge.com/papers/caie/as-and-a-level-mathematics-9709-topical-past-papers", label: "PapaCambridge: 9709 topical past papers" };
const PAPA_TOPICAL_SHOP = { href: "https://papacambridge.com/category/past-papers/unsolved-past-papers/topical-past-papers-unsolved-past-papers/caie-topical-past-papers-unsolved-past-papers/as-a-level-caie-topical-past-papers-unsolved-past-papers/", label: "PapaCambridge shop: AS & A Level topical papers" };
const EXAM_MATE_PRICING = { href: "https://www.exam-mate.com/topicalpastpapers/pricing", label: "Exam-Mate: topical pricing" };
const EXAM_MATE_9700 = { href: "https://www.exam-mate.com/topicalpastpapers/CIE%20A-Level-5/Biology(9700)-47", label: "Exam-Mate: CIE A Level topical questions" };
const PENGUIN_9709 = { href: "https://pastpaperpenguin.com/9709-pure-1-topical-exam-questions-and-worked-solutions/", label: "Past Paper Penguin: 9709 Pure 1 questions by topic" };
const TUTORCHASE_CIE = { href: "https://www.tutorchase.com/resources/a-level", label: "TutorChase: A Level resources" };
const MATHSGENIE_A_LEVEL = { href: "https://mathsgenie.co.uk/a-level/maths", label: "MathsGenie: A Level Maths" };
const PPP_PRICING = { href: "https://pastpaperprep.com/pricing", label: "PastPaperPrep pricing" };

const BEST_A_LEVEL_SITES: Article = {
  draft: false,
  slug: "best-cambridge-a-level-past-paper-websites",
  title: "Best Websites for Cambridge A Level Past Papers and Topical Questions (2026)",
  description: "Where to get Cambridge A Level past papers and topical questions in 2026, free and paid, for 9709, 9702, 9701, 9700 and 9708, and what each site is good for.",
  eyebrow: "Cambridge A Level resource comparison",
  answer: "For whole past papers, PastPaperPrep, PapaCambridge and Physics & Maths Tutor are all free. For topical questions, PastPaperPrep sorts every 9709, 9702, 9701, 9700 and 9708 question from 2020 to 2026 by paper and topic, Exam-Mate does the same across more subjects, and PapaCambridge has free topical PDFs for 9709. For notes, use ZNotes (free) or Save My Exams (paid).",
  answerLink: { href: "/cambridge-a-level", label: "Practise A Level questions by topic" },
  publishedAt: "2026-11-21",
  updatedAt: "2026-11-21",
  readingMinutes: 8,
  comparison: {
    caption: "Cambridge A Level revision websites, checked 21 November 2026",
    headings: ["Website", "Best for", "Worth knowing"],
    rows: [
      { label: "PastPaperPrep", pastPaperPrep: "Topical questions for 9709, 9702, 9701, 9700 and 9708, plus free whole papers", competitor: "2020 and 2021 topical questions are free; newer years from $6 a month" },
      { label: "PapaCambridge", pastPaperPrep: "Free yearly papers for every CAIE code", competitor: "Free 9709 topical PDFs; other topical books are sold, from $20" },
      { label: "Physics & Maths Tutor", pastPaperPrep: "Free CAIE papers listed by paper number", competitor: "No CAIE topic questions or notes" },
      { label: "Exam-Mate", pastPaperPrep: "Topical questions across many CAIE subjects", competitor: "Free up to 2019; newer years from USD 12 a month" },
      { label: "Save My Exams", pastPaperPrep: "Notes, exam-style questions and mocks", competitor: "Essential from $96 a year; no topic questions for 9708" },
      { label: "ZNotes", pastPaperPrep: "Free notes and past-paper walkthrough videos", competitor: "Notes, not a question bank" },
    ],
  },
  sections: [
    {
      heading: "First, what are you actually looking for?",
      paragraphs: [
        "Every few weeks someone on r/alevel asks for good free sites for topical past papers, and the replies are a different list every time. That's because people mean three different things: whole papers for timed practice, topical questions for drilling one weak area, and notes for learning a topic in the first place. No single site is best at all three.",
        "Below is what we found on each site on 21 November 2026, for the five subjects most Cambridge A Level students take: Maths 9709, Physics 9702, Chemistry 9701, Biology 9700 and Economics 9708.",
      ],
    },
    {
      heading: "PastPaperPrep: topical questions you can filter and print",
      paragraphs: [
        "Full disclosure: this is our site. We took every question from the 2020 to 2026 papers for those five subjects and sorted it by paper and topic: 2,118 in Maths, 2,627 in Physics, 2,220 in Chemistry, 2,680 in Biology and 3,207 in Economics. So you can open 9709 Paper 4 kinematics, or 9700 Paper 4 homeostasis, and get only those questions, each with Cambridge's mark scheme underneath. You can turn a set into a printable PDF worksheet too.",
        "Questions from 2020 and 2021 are free. Newer years cost $6 a month for one subject, or $25 a month for everything (IGCSE and IB included). All 911 whole papers are free to read with no account, and supported papers can be self-marked. Pure Maths questions have worked explanations as well as the mark scheme.",
        "What we don't do: subjects beyond these five, the science practical papers (3 and 5), or teaching notes for every topic.",
      ],
      links: [
        { href: "/cambridge-a-level", label: "A Level topic banks" },
        { href: "/past-papers/a-level", label: "Free A Level whole papers" },
      ],
    },
    {
      heading: "PapaCambridge: the biggest free archive",
      paragraphs: [
        "PapaCambridge lists every CAIE AS & A Level code under free yearly past papers, with question papers, mark schemes and grade thresholds as separate downloads. It's quick to update: its 9709 folders already had October/November 2025 when we looked.",
        "It also has a free topical section for 9709, with a PDF per topic for Papers 1 to 5. For other subjects, topical and solved books are paid products in its shop: topical papers from $20 to $50 a subject, solved yearly papers from $20 to $150.",
      ],
    },
    {
      heading: "Physics & Maths Tutor: free papers, sorted by paper",
      paragraphs: [
        "PMT is famous for UK boards, but it has free CAIE pages for all five subjects, listed by paper number: every Pure 1 paper on one page, every Physics Paper 4 on another. That's handy if you want to sit one paper type again and again.",
        "Two catches. We couldn't find CAIE topic questions or notes, only papers and mark schemes. And its Physics, Chemistry and Biology hub pages didn't link to the CAIE paper pages, so bookmark those directly.",
      ],
    },
    {
      heading: "Exam-Mate: topical questions across lots of subjects",
      paragraphs: [
        "Exam-Mate sorts real CAIE questions by topic for all five codes, with 9709 split into Pure 1, Pure 2 and 3, Mechanics and Statistics, and it covers other A Level subjects too. It shows official mark schemes alongside AI-generated solutions.",
        "Free access stops at 2019. Its topical subscription is listed at USD 12 for a month, 65 for six months or 120 for a year, and questions are practised online.",
      ],
    },
    {
      heading: "Save My Exams and ZNotes: for learning the content",
      paragraphs: [
        "Save My Exams has CIE A Level courses with revision notes, exam-style topic questions written by its team, flashcards and mock exams. Students on r/alevel mostly praise the notes for being easier than the textbook. Essential costs $96 a year or $40 a month in US dollars, and Premium $192 a year, with a 7-day trial. The 9708 Economics course had notes and flashcards but no topic questions.",
        "ZNotes is the free alternative for notes. Its CAIE pages cover all five subjects at AS and A2, with past-paper walkthrough videos, unlimited PDF downloads and no paywall. Boost, $2.99 a month, adds more AI tutor use.",
      ],
      links: [
        { href: "/articles/best-save-my-exams-alternatives-cie-a-level", label: "Save My Exams alternatives for CIE A Level" },
        { href: "/articles/znotes-vs-save-my-exams-a-level", label: "ZNotes vs Save My Exams" },
      ],
    },
    {
      heading: "Smaller sites students recommend",
      bullets: [
        "Past Paper Penguin: 9709 Pure 1 questions by topic, with worked solutions.",
        "TutorChase: CIE A Level notes, practice questions and past papers for all five subjects; some sections are marked Premium.",
        "Cambridge International: the official syllabus, specimen papers and a selection of recent papers; schools get more through the School Support Hub.",
        "Avoid old GCE Guide bookmarks: its paper addresses now redirect to an unrelated games site. And MathsGenie's A Level pages are for UK boards, not 9709.",
      ],
      paragraphs: [],
    },
    {
      heading: "A setup that works",
      paragraphs: [
        "Learn a topic from your notes (ZNotes, Save My Exams or your textbook), drill it with real topical questions, then sit a whole paper under time every week or two. When a paper shows a weak topic, go back to topicals for that topic only. That loop beats doing paper after paper and repeating the same mistakes.",
      ],
      links: [
        { href: "/articles/a-level-maths-9709-past-papers-by-topic", label: "9709 past papers by topic" },
        { href: "/articles/cambridge-a-level-grade-boundaries", label: "What score gets an A* in 2026" },
      ],
    },
  ],
  faqs: [
    { question: "What is the best website for Cambridge A Level topical past papers?", answer: "For 9709, 9702, 9701, 9700 and 9708, PastPaperPrep sorts every 2020 to 2026 question by paper and topic, with 2020 and 2021 free. Exam-Mate covers more subjects but its free access stops at 2019. PapaCambridge has free 9709 topical PDFs." },
    { question: "Where can I get free CAIE A Level past papers?", answer: "PapaCambridge, Physics & Maths Tutor and PastPaperPrep all have free whole papers with mark schemes. PastPaperPrep opens them in the browser with no account." },
    { question: "Is Save My Exams worth it for A Level?", answer: "If you use its notes and exam-style questions every week, many students think so. If you mainly want past papers, they are free elsewhere. Essential is $96 a year in US dollars." },
    { question: "Is GCE Guide still working?", answer: "When we checked on 21 November 2026, its paper addresses redirected to an unrelated games site." },
  ],
  relatedBanks: [
    { href: "/cambridge-a-level", label: "Cambridge A Level question banks" },
    { href: "/banks/a-level-maths-9709", label: "A Level Maths 9709 question bank" },
    { href: "/banks/a-level-physics-9702", label: "A Level Physics 9702 question bank" },
    { href: "/banks/a-level-chemistry-9701", label: "A Level Chemistry 9701 question bank" },
    { href: "/banks/a-level-biology-9700", label: "A Level Biology 9700 question bank" },
    { href: "/banks/a-level-economics-9708", label: "A Level Economics 9708 question bank" },
  ],
  sources: [PAPA_DIRECTORY, PAPA_9709, PAPA_9709_TOPICAL, PAPA_TOPICAL_SHOP, PMT_9709, PMT_9702, EXAM_MATE_9700, EXAM_MATE_PRICING, SME_CIE_MATHS, SME_CIE_ECON, SME_JOIN, ZNOTES_9709, ZNOTES_BOOST, PENGUIN_9709, TUTORCHASE_CIE, CAMBRIDGE_9701_PAPERS, MATHSGENIE_A_LEVEL, PPP_PRICING],
};

const SME_ALTERNATIVES_A_LEVEL: Article = {
  draft: false,
  slug: "best-save-my-exams-alternatives-cie-a-level",
  title: "Best Save My Exams Alternatives for CIE A Level (Free and Cheaper)",
  description: "Is Save My Exams worth it for CIE A Level? Free and cheaper alternatives for notes, real topical questions and past papers, with 2026 prices.",
  eyebrow: "CIE A Level revision alternatives",
  answer: "Save My Exams costs $96 a year for Essential or $192 for Premium (US prices, November 2026). Free alternatives cover most of it: ZNotes for notes, PapaCambridge or Physics & Maths Tutor for past papers, and PastPaperPrep for real topical questions in 9709, 9702, 9701, 9700 and 9708, free for 2020 and 2021. Keep Save My Exams if you rely on its notes and model answers together.",
  answerLink: { href: "/cambridge-a-level", label: "Try PastPaperPrep's A Level banks" },
  publishedAt: "2026-11-21",
  updatedAt: "2026-11-21",
  readingMinutes: 7,
  comparison: {
    caption: "Save My Exams alternatives for CIE A Level, by what you use it for",
    headings: ["You use Save My Exams for", "Try instead", "Cost"],
    rows: [
      { label: "Revision notes", pastPaperPrep: "ZNotes", competitor: "Free; Boost $2.99 a month" },
      { label: "Topic questions", pastPaperPrep: "PastPaperPrep (real Cambridge questions)", competitor: "2020–2021 free; $6 a month a subject" },
      { label: "Past papers", pastPaperPrep: "PapaCambridge, PMT or PastPaperPrep", competitor: "Free" },
      { label: "Model answers and marking feedback", pastPaperPrep: "Keep Save My Exams", competitor: "Premium, $192 a year" },
    ],
  },
  sections: [
    {
      heading: "Is Save My Exams worth it for A Level?",
      paragraphs: [
        "It's one of the most asked questions on r/alevel. The honest answer from students who use it: the notes are clear, often clearer than the textbook, and the topic questions are good when a whole paper feels like too much. The common complaint is that you're paying for past papers you can get free elsewhere.",
        "The prices on its plans page on 21 November 2026, in US dollars: Essential is $96 a year, $48 for three months or $40 for a single month. Premium is $192 a year, $96 for three months or $80 a month, and the annual plan has a 7-day free trial. A free account gets a weekly allowance of notes and can download past papers. Premium adds unlimited model answers, feedback on your answers and PDF downloads.",
        "So it's worth it if you'll use the notes and questions most weeks. If you mostly want papers and practice, there are cheaper ways.",
      ],
    },
    {
      heading: "Notes: ZNotes",
      paragraphs: [
        "ZNotes is the free option most CIE students already know. Its pages cover all five of these subjects at AS and A2: for 9709 AS, Pure 1, Mechanics and Statistics 1 notes with past-paper walkthrough videos; for 9701 AS, 22 theory chapters plus practical notes. The free plan includes unlimited PDF downloads, and Boost costs $2.99 a month for more AI tutor use.",
        "TutorChase is another option, with CIE notes and practice questions for all five subjects, though some sections are marked Premium.",
      ],
      links: [{ href: "/articles/znotes-vs-save-my-exams-a-level", label: "ZNotes vs Save My Exams in detail" }],
    },
    {
      heading: "Topic questions: real ones instead of exam-style",
      paragraphs: [
        "Save My Exams writes its own exam-style questions for each topic. If you'd rather practise questions Cambridge actually set, use a topical bank. PastPaperPrep sorts every question from 2020 to 2026 by paper and topic: 2,118 in Maths, 2,627 in Physics, 2,220 in Chemistry, 2,680 in Biology and 3,207 in Economics, each with the official mark scheme. 2020 and 2021 are free; after that it's $6 a month for one subject, $22 for all five, or $25 for every bank we have.",
        "Exam-Mate also sorts real questions by topic across more subjects, free up to 2019 and listed at USD 12 a month after that. For 9709 Pure 1, Past Paper Penguin has topic sets with worked solutions.",
        "One gap to know about: our worked explanations cover Pure Maths only. Physics, Chemistry, Biology, Economics and applied Maths questions show Cambridge's mark scheme.",
      ],
      links: [{ href: "/cambridge-a-level", label: "A Level topic banks" }],
    },
    {
      heading: "Past papers: don't pay for these",
      paragraphs: [
        "PapaCambridge, Physics & Maths Tutor and PastPaperPrep all have free CIE A Level papers with mark schemes. Save My Exams' own CIE past-paper pages listed papers up to 2024 when we checked, while PapaCambridge and PastPaperPrep already had 2025.",
      ],
      links: [
        { href: "/past-papers/a-level", label: "Free A Level papers" },
        { href: "/articles/best-cambridge-a-level-past-paper-websites", label: "All A Level revision sites compared" },
      ],
    },
    {
      heading: "When to keep Save My Exams",
      paragraphs: [
        "If you take several subjects, like having notes, questions and mocks in one place, or want feedback on written answers, it does something the free sites don't. A cheap middle path: ZNotes for notes, free papers to find weak topics, and a topical bank for the subjects where you lose the most marks.",
      ],
    },
  ],
  faqs: [
    { question: "Is Save My Exams worth it for A Level?", answer: "If you'll use its notes and exam-style questions most weeks, yes for many students. If you mostly want past papers, those are free on PapaCambridge, PMT and PastPaperPrep." },
    { question: "How much does Save My Exams cost?", answer: "On 21 November 2026, in US dollars: Essential $96 a year or $40 a month, Premium $192 a year or $80 a month. Premium's annual plan has a 7-day free trial." },
    { question: "What is the best free alternative to Save My Exams for CIE A Level?", answer: "ZNotes for notes, and PapaCambridge, PMT or PastPaperPrep for past papers. PastPaperPrep's 2020 and 2021 topical questions are free too." },
    { question: "Does Save My Exams use real past paper questions?", answer: "Its topic questions are exam-style questions written for the course. Real past papers are on its separate past-paper pages." },
  ],
  relatedBanks: [
    { href: "/cambridge-a-level", label: "Cambridge A Level question banks" },
    { href: "/articles/best-save-my-exams-alternatives-topical-past-papers", label: "Save My Exams alternatives for IGCSE and IB" },
    { href: "/pricing", label: "PastPaperPrep pricing" },
  ],
  sources: [SME_JOIN, SME_PLANS, SME_CIE_MATHS, SME_CIE_ECON, SME_CIE_PAPERS, ZNOTES_9709, ZNOTES_9701, ZNOTES_BOOST, TUTORCHASE_CIE, EXAM_MATE_9700, EXAM_MATE_PRICING, PENGUIN_9709, PAPA_DIRECTORY, PMT_9709, PPP_PRICING],
};

const ZNOTES_VS_SME: Article = {
  draft: false,
  slug: "znotes-vs-save-my-exams-a-level",
  title: "ZNotes vs Save My Exams for CIE A Level: Which Should You Use?",
  description: "ZNotes and Save My Exams compared for Cambridge A Level: notes, questions, videos, what's free and what it costs in 2026, and when you need neither.",
  eyebrow: "CIE A Level revision comparison",
  answer: "ZNotes is free, student-written notes with walkthrough videos; Save My Exams is a paid library of notes, exam-style questions and mock exams. For CIE A Level, start with ZNotes for the theory and pay for Save My Exams only if you want its questions and model answers. Neither gives you real past-paper questions sorted by topic, which is the part that most improves your marks.",
  answerLink: { href: "/cambridge-a-level", label: "Practise real questions by topic" },
  publishedAt: "2026-11-21",
  updatedAt: "2026-11-21",
  readingMinutes: 6,
  comparison: {
    caption: "ZNotes and Save My Exams for CIE A Level, checked 21 November 2026",
    headings: ["", "ZNotes", "Save My Exams"],
    rows: [
      { label: "Price", pastPaperPrep: "Free; Boost $2.99 a month", competitor: "Free tier; Essential $96 a year, Premium $192 a year (USD)" },
      { label: "Notes", pastPaperPrep: "Condensed notes for AS and A2, all five subjects", competitor: "Full revision notes for all five subjects" },
      { label: "Questions", pastPaperPrep: "Chapter-wise quiz questions", competitor: "Exam-style topic questions (none for 9708), mocks" },
      { label: "Videos", pastPaperPrep: "Past-paper walkthroughs and topic explainers", competitor: "Not a video course" },
      { label: "Downloads", pastPaperPrep: "Unlimited PDFs on the free plan", competitor: "PDF downloads on Premium" },
    ],
  },
  sections: [
    {
      heading: "The short version",
      paragraphs: [
        "If money is tight, ZNotes covers the theory for free and does it well. If you learn best from fuller explanations and want lots of practice questions in one place, Save My Exams is the stronger product, and you pay for it.",
        "Both are mainly about learning content. The step that turns knowledge into marks is practising real Cambridge questions and checking them against the mark scheme, and neither site is built around that.",
      ],
    },
    {
      heading: "ZNotes",
      paragraphs: [
        "ZNotes started as a student project and still feels like one in a good way: short, exam-focused notes. For CIE A Level it has pages for 9709, 9702, 9701, 9700 and 9708 at both AS and A2. For example, 9709 AS has Pure 1, Mechanics and Statistics 1 notes with 27 past-paper walkthrough videos, and 9701 AS has 22 theory chapters plus 11 on practical skills. 9708 AS includes model answers.",
        "The free plan includes its notes, chapter quizzes and unlimited PDF downloads, with no ads. Boost, $2.99 a month or less if paid yearly, mainly adds more AI tutor and study-planner use. One thing to watch: the 9709 AS page was still labelled with the 2023–2025 syllabus, though 9709 hasn't changed, so the content still applies.",
      ],
    },
    {
      heading: "Save My Exams",
      paragraphs: [
        "Save My Exams has CIE A Level courses for all five subjects: revision notes, exam-style topic questions sorted by difficulty, flashcards, target tests and mock exams. The 9708 Economics course is thinner, with notes and flashcards but no topic questions.",
        "Prices on 21 November 2026 (USD): Essential is $96 a year or $40 a month; Premium, which adds model answers, feedback on your answers and PDF downloads, is $192 a year or $80 a month, with a 7-day trial on the annual plan. The free account gives a weekly allowance of notes.",
      ],
    },
    {
      heading: "What neither does: real questions by topic",
      paragraphs: [
        "Exam-style questions are useful, but they aren't the questions Cambridge set. For that, PastPaperPrep sorts every 2020 to 2026 question for these five subjects by paper and topic, with the official mark scheme under each. 2020 and 2021 are free, and the rest is $6 a month a subject. Pure Maths questions also have worked explanations.",
        "A sensible combination: ZNotes or Save My Exams to learn a topic, real topical questions to practise it, and a whole timed paper every week or two to check it sticks.",
      ],
      links: [
        { href: "/cambridge-a-level", label: "A Level topic banks" },
        { href: "/articles/best-save-my-exams-alternatives-cie-a-level", label: "More Save My Exams alternatives" },
      ],
    },
  ],
  faqs: [
    { question: "Is ZNotes better than Save My Exams for A Level?", answer: "ZNotes is better value: it's free and its notes are concise. Save My Exams has fuller notes and many more practice questions, for $96 a year or more." },
    { question: "Is ZNotes free?", answer: "Yes. Notes, chapter quizzes and unlimited PDF downloads are free. Boost is $2.99 a month for extra AI tools." },
    { question: "Does ZNotes cover CIE A Level Maths 9709?", answer: "Yes: Pure 1, Mechanics and Statistics 1 at AS, and Pure 3 and Statistics 2 at A2, with past-paper walkthrough videos." },
    { question: "Where can I practise real CIE A Level questions by topic?", answer: "PastPaperPrep sorts every 2020 to 2026 question for 9709, 9702, 9701, 9700 and 9708 by topic; 2020 and 2021 are free." },
  ],
  relatedBanks: [
    { href: "/cambridge-a-level", label: "Cambridge A Level question banks" },
    { href: "/articles/best-znotes-alternatives", label: "ZNotes alternatives for IGCSE and IB" },
  ],
  sources: [ZNOTES_9709, ZNOTES_9701, ZNOTES_BOOST, SME_JOIN, SME_PLANS, SME_CIE_MATHS, SME_CIE_ECON, PPP_PRICING],
};

const MATHS_9709_BY_TOPIC: Article = {
  draft: false,
  slug: "a-level-maths-9709-past-papers-by-topic",
  title: "A Level Maths 9709 Past Papers by Topic (Pure 1 to Statistics 2)",
  description: "Practise Cambridge 9709 past paper questions by topic for every paper, from Pure 1 to Statistics 2, with the topics that carry the most marks and a plan that works.",
  eyebrow: "Cambridge A Level Mathematics 9709",
  answer: "Pick the paper you sit, then practise one topic at a time with real questions. In 2020 to 2026 papers, series and differentiation carried the most Pure 1 marks, integration led Pure 3, kinematics took 38% of Mechanics, the normal distribution led Statistics 1 and hypothesis tests led Statistics 2. Once a topic holds, go back to whole timed papers.",
  answerLink: { href: "/banks/a-level-maths-9709", label: "Open 9709 by topic" },
  publishedAt: "2026-11-21",
  updatedAt: "2026-11-21",
  readingMinutes: 6,
  comparison: {
    caption: "9709 topics with the most marks, 2020–2026 papers",
    headings: ["Paper", "Top topics by share of marks", "Questions in our bank"],
    rows: [
      { label: "Pure 1 (Paper 1)", pastPaperPrep: "Series 17.5%, differentiation 16.1%, functions 14.9%", competitor: "502" },
      { label: "Pure 2 (Paper 2)", pastPaperPrep: "Algebra 23.4%, differentiation 23.4%, integration 19.0%", competitor: "239" },
      { label: "Pure 3 (Paper 3)", pastPaperPrep: "Integration 14.5%, algebra 14.1%, complex numbers 13.5%", competitor: "477" },
      { label: "Mechanics (Paper 4)", pastPaperPrep: "Kinematics 38.0%, forces and equilibrium 20.6%, energy 20.0%", competitor: "321" },
      { label: "Statistics 1 (Paper 5)", pastPaperPrep: "Normal distribution 26.0%, discrete random variables 21.5%", competitor: "307" },
      { label: "Statistics 2 (Paper 6)", pastPaperPrep: "Hypothesis tests 27.6%, Poisson distribution 23.6%", competitor: "272" },
    ],
  },
  sections: [
    {
      heading: "Topicals or full papers?",
      paragraphs: [
        "Students argue about this a lot. Some say just spam past papers; others can't face a whole paper until a topic makes sense. Both are right at different times. Topical questions are for fixing something specific: you see the same idea asked six different ways, and the pattern clicks. Full papers check that you can spot which method a question wants when nobody tells you the topic.",
        "So use topicals early and whenever a paper shows a weak spot, and full papers to test yourself. If your exam is weeks away and nothing is obviously weak, do mostly full papers.",
      ],
    },
    {
      heading: "Practise only your papers",
      paragraphs: [
        "9709 has six papers and you sit two (AS) or four (A Level). Pure 1 is in every route; A Level adds Pure 3, Statistics 1, and either Mechanics or Statistics 2. There's no point drilling Statistics 2 if you sit Mechanics, so start from your school's route.",
      ],
      links: [
        { href: "/articles/a-level-maths-9709-paper-routes", label: "Which 9709 papers you sit" },
        { href: "/articles/a-level-maths-9709-mechanics-vs-statistics", label: "Mechanics or Statistics?" },
      ],
    },
    {
      heading: "Where the marks are",
      paragraphs: [
        "The table counts each question's marks under its main topic across every 2020 to 2026 paper in our bank. A few things stand out. In Pure 1, the big three (series, differentiation, functions) are nearly half the paper. In Pure 3, marks are spread evenly across integration, algebra, complex numbers and vectors, so you can't skip any of them. Mechanics is dominated by straight-line kinematics, while momentum only took about 6%.",
        "That's a guide to where an hour of practice goes furthest, not a prediction of the next paper.",
      ],
    },
    {
      heading: "A topical session that works",
      bullets: [
        "Choose one topic from your last paper, not the one you already like.",
        "Do 6 to 10 questions without notes, roughly timed at about 1.5 minutes a mark.",
        "Mark against the mark scheme line by line: method marks are where most 9709 marks hide.",
        "Write down the exact step you got wrong, and redo that question a few days later.",
        "When a topic stops costing marks, mix it into a full paper.",
      ],
      paragraphs: [],
    },
    {
      heading: "Free and paid 9709 topical sources",
      paragraphs: [
        "PapaCambridge has free topical PDFs for 9709 Papers 1 to 5, and Past Paper Penguin has Pure 1 questions by topic with worked solutions. Those are great if you're happy working from PDFs.",
        "PastPaperPrep's 9709 bank has all 2,118 questions from 2020 to 2026, sorted by paper and topic, with a tab per paper. 2020 and 2021 are free, and Pure 1, 2 and 3 questions come with worked explanations as well as the mark scheme; Mechanics and Statistics show the mark scheme. You can also build a printable PDF from any selection.",
      ],
      links: [
        { href: "/banks/a-level-maths-9709?topic=Series", label: "Pure 1 series questions" },
        { href: "/banks/a-level-maths-9709?topic=Complex%20numbers", label: "Pure 3 complex numbers questions" },
        { href: "/past-papers/a-level-maths-9709", label: "Free 9709 whole papers" },
      ],
    },
  ],
  faqs: [
    { question: "Where can I find 9709 topical past papers?", answer: "PastPaperPrep sorts every 2020 to 2026 9709 question by paper and topic, with 2020 and 2021 free. PapaCambridge has free topical PDFs for Papers 1 to 5, and Past Paper Penguin has Pure 1 by topic." },
    { question: "Which 9709 Pure 1 topic has the most marks?", answer: "Across 2020 to 2026 papers, series (17.5%), then differentiation (16.1%) and functions (14.9%)." },
    { question: "Should I do topicals or full past papers for 9709?", answer: "Topicals to fix a specific weak topic, full papers to test method selection and timing. Most students need both, with more full papers close to the exam." },
    { question: "Are 9709 papers from 2020 still relevant?", answer: "Yes. The 9709 syllabus content hasn't changed since 2020." },
  ],
  relatedBanks: [
    { href: "/banks/a-level-maths-9709", label: "A Level Maths 9709 past papers by topic" },
    { href: "/syllabus/a-level-maths-9709", label: "9709 course guide" },
  ],
  sources: [SYLLABUS_9709, PAPA_9709_TOPICAL, PENGUIN_9709],
};

const PHYSICS_9702_BY_TOPIC: Article = {
  draft: false,
  slug: "a-level-physics-9702-past-papers-by-topic",
  title: "A Level Physics 9702 Past Papers by Topic: Papers 1, 2 and 4",
  description: "Practise Cambridge 9702 past paper questions by topic for Paper 1 multiple choice, Paper 2 and Paper 4, with where the marks go since the 2022 syllabus.",
  eyebrow: "Cambridge A Level Physics 9702",
  answer: "Practise 9702 by topic within each paper. Since the 2022 syllabus, Paper 1 multiple choice spreads evenly across the AS topics, Paper 2 leans on dynamics, particle physics and D.C. circuits, and Paper 4 is led by magnetic fields. Skip 2020 and 2021 questions on removed topics like electronics, and sit whole papers once a topic holds.",
  answerLink: { href: "/banks/a-level-physics-9702", label: "Open 9702 by topic" },
  publishedAt: "2026-11-21",
  updatedAt: "2026-11-21",
  readingMinutes: 5,
  comparison: {
    caption: "9702 topics with the most marks, 2022–2026 papers",
    headings: ["Paper", "Top topics by share of marks", "Questions in our bank, 2020–2026"],
    rows: [
      { label: "Paper 1 Multiple Choice", pastPaperPrep: "Waves 11.6%, forces, density and pressure 10.8%, dynamics 10.6%", competitor: "1,920" },
      { label: "Paper 2 AS Structured", pastPaperPrep: "Dynamics 13.2%, particle physics 11.4%, D.C. circuits 11.2%", competitor: "324" },
      { label: "Paper 4 A Level Structured", pastPaperPrep: "Magnetic fields 11.2%, nuclear physics 9.0%, oscillations 8.8%", competitor: "383" },
    ],
  },
  sections: [
    {
      heading: "Why topicals help so much in Physics",
      paragraphs: [
        "Physics questions repeat ideas more than they repeat wording. A capacitor question might be about energy one year and discharge curves the next. Doing ten capacitor questions in a row shows you every angle Cambridge uses, which is hard to see when the topic turns up once a paper.",
        "Do topicals while you learn a topic and whenever a paper exposes one, and whole papers to practise switching between topics against the clock.",
      ],
    },
    {
      heading: "Paper 1: the multiple-choice paper",
      paragraphs: [
        "Paper 1 is 40 questions in 1 hour 15 minutes, all on AS content. Marks are spread thin: no topic took more than about 12% since 2022. Waves, superposition, forces and dynamics edge ahead, and physical quantities and units (9.7%), with its unit and uncertainty questions, holds some of the easiest marks to secure.",
        "Multiple choice is ideal for topical drilling because each question takes a minute or two. Do 20 on one topic, then go through every wrong answer until you can say why the right option is right.",
      ],
    },
    {
      heading: "Papers 2 and 4",
      paragraphs: [
        "Paper 2 (AS, 60 marks) leans on dynamics, particle physics and D.C. circuits. Paper 4 (A Level, 100 marks) is led by magnetic fields, with nuclear physics, oscillations, electric and gravitational fields close behind, and it can still use AS knowledge.",
      ],
      links: [{ href: "/articles/a-level-physics-9702-paper-2-vs-paper-4", label: "9702 Paper 2 vs Paper 4 in detail" }],
    },
    {
      heading: "Old papers: what to skip",
      paragraphs: [
        "The syllabus changed in 2022. Communication, electronics, band theory and NMRI went; astronomy and cosmology came in; electric fields moved to A Level. 2020 and 2021 papers are still useful for most topics, and our bank tags the removed content as earlier-syllabus topics so you can skip it.",
      ],
    },
    {
      heading: "Where to practise",
      paragraphs: [
        "PastPaperPrep's 9702 bank has all 2,627 questions from Papers 1, 2 and 4, 2020 to 2026, sorted by paper and topic with Cambridge's mark scheme. 2020 and 2021 are free. The practical papers (3 and 5) aren't included, so practise those with your school's lab work.",
      ],
      links: [
        { href: "/banks/a-level-physics-9702?topic=Magnetic%20fields", label: "Magnetic fields questions" },
        { href: "/past-papers/a-level-physics-9702/paper-1", label: "Free Paper 1 whole papers" },
        { href: "/articles/cambridge-a-level-formula-sheets-data-booklets", label: "What's on the 9702 formula sheet" },
      ],
    },
  ],
  faqs: [
    { question: "Where can I find 9702 topical past papers?", answer: "PastPaperPrep sorts every 2020 to 2026 question from Papers 1, 2 and 4 by topic, with 2020 and 2021 free. Exam-Mate also has topical 9702 questions, free up to 2019." },
    { question: "Which 9702 Paper 4 topic has the most marks?", answer: "Since 2022, magnetic fields (11.2% of marks in our bank), then nuclear physics and oscillations." },
    { question: "Are 2020 and 2021 9702 papers still useful?", answer: "Yes for most topics. Skip questions on communication, electronics and other content removed in 2022." },
  ],
  relatedBanks: [
    { href: "/banks/a-level-physics-9702", label: "A Level Physics 9702 past papers by topic" },
    { href: "/syllabus/a-level-physics-9702", label: "9702 course guide" },
  ],
  sources: [SYLLABUS_9702],
};

const CHEMISTRY_9701_BY_TOPIC: Article = {
  draft: false,
  slug: "a-level-chemistry-9701-past-papers-by-topic",
  title: "A Level Chemistry 9701 Past Papers by Topic: What Comes Up Most",
  description: "Practise Cambridge 9701 past paper questions by topic for Papers 1, 2 and 4, with the topics that carry the most marks and what changed in 2022.",
  eyebrow: "Cambridge A Level Chemistry 9701",
  answer: "Practise 9701 one topic at a time within the paper you're revising. Since 2022, transition elements took the most Paper 4 marks (19.4%), Paper 2 leaned on periodicity, atomic structure and hydrocarbons, and Paper 1 multiple choice spread across all 22 AS topics. Skip the few 2020–2021 questions on removed content, then move on to whole papers.",
  answerLink: { href: "/banks/a-level-chemistry-9701", label: "Open 9701 by topic" },
  publishedAt: "2026-11-21",
  updatedAt: "2026-11-21",
  readingMinutes: 6,
  comparison: {
    caption: "9701 topics with the most marks, 2022–2026 papers",
    headings: ["Paper", "Top topics by share of marks", "Questions in our bank, 2020–2026"],
    rows: [
      { label: "Paper 1 Multiple Choice", pastPaperPrep: "Intro to AS organic 7.8%, stoichiometry 6.4%, bonding 6.2%", competitor: "1,720" },
      { label: "Paper 2 AS Structured", pastPaperPrep: "Periodicity 14.0%, atomic structure 11.9%, hydrocarbons 11.4%", competitor: "201" },
      { label: "Paper 4 A Level Structured", pastPaperPrep: "Transition elements 19.4%, A Level energetics 12.5%, nitrogen compounds 10.6%", competitor: "299" },
    ],
  },
  sections: [
    {
      heading: "How 9701 is set up",
      paragraphs: [
        "AS is Papers 1, 2 and 3: 40 multiple-choice questions, a 60-mark structured paper and the practical. A Level adds Paper 4, the 100-mark structured paper worth 38.5% on its own, and Paper 5 on planning and analysis. The syllabus has 37 topics: AS is 1 to 22, A Level adds 23 to 37.",
      ],
    },
    {
      heading: "Where the marks go",
      paragraphs: [
        "If you only have time to drill a few Paper 4 topics, start with transition elements: nearly a fifth of the marks across the 2022 to 2026 papers in our bank. A Level energetics (lattice energy, Born–Haber cycles and the rest), nitrogen compounds and equilibria come next.",
        "Paper 2 rewards periodicity and atomic structure, then hydrocarbons and equilibria. Paper 1 is different: no topic passed 8% of its marks, so it tests breadth. Drill multiple choice by topic until you stop making the same mistakes, then do whole Paper 1s.",
      ],
    },
    {
      heading: "What changed in 2022",
      paragraphs: [
        "There's no separate Data Booklet on Papers 1, 2 and 4 any more. Each paper prints a table of constants and a Periodic Table, and any other data is given in the question. Paper 1 lost its Section B and gained 15 minutes.",
        "Some content went, including fuel cells and rechargeable batteries, CFCs and the ozone layer, and enzymes. Some became explicit, like percentage yield, the Boltzmann distribution and chromatography terms. 2020 and 2021 papers are still worth doing; the bank tags removed content as earlier-syllabus topics, and files old AS questions on lattice energy under the A Level topic where it now sits.",
      ],
      links: [{ href: "/articles/cambridge-a-level-formula-sheets-data-booklets", label: "What data you get in a 9701 exam" }],
    },
    {
      heading: "How to run a topical session",
      bullets: [
        "Pick the topic that cost you most on your last paper.",
        "Do the questions closed-book, then mark them against the mark scheme.",
        "In Chemistry, wording matters: compare your answer with the exact phrase the scheme credits.",
        "Keep a list of reactions and conditions you got wrong, and test yourself on it weekly.",
      ],
      paragraphs: [],
    },
    {
      heading: "Where to practise",
      paragraphs: [
        "PastPaperPrep's 9701 bank has all 2,220 questions from Papers 1, 2 and 4, 2020 to 2026, sorted by paper and topic with Cambridge's mark scheme. 2020 and 2021 are free. Papers 3 and 5 aren't included; practise those with your school's lab work.",
      ],
      links: [
        { href: "/banks/a-level-chemistry-9701?topic=Chemistry%20of%20transition%20elements", label: "Transition elements questions" },
        { href: "/past-papers/a-level-chemistry-9701/paper-4", label: "Free Paper 4 whole papers" },
        { href: "/articles/cambridge-a-level-grade-boundaries", label: "9701 grade boundaries 2026" },
      ],
    },
  ],
  faqs: [
    { question: "Where can I find 9701 topical past papers?", answer: "PastPaperPrep sorts every 2020 to 2026 question from 9701 Papers 1, 2 and 4 by topic, with 2020 and 2021 free." },
    { question: "Which 9701 Paper 4 topic comes up most?", answer: "Chemistry of transition elements, with 19.4% of Paper 4 marks across 2022 to 2026 in our bank." },
    { question: "Is a data booklet given in 9701 exams?", answer: "Not since 2022. Each paper has a data table of constants and a Periodic Table, and other data is given in the question." },
    { question: "How many topics are in 9701?", answer: "37: AS covers 1 to 22, and A Level adds 23 to 37." },
  ],
  relatedBanks: [
    { href: "/banks/a-level-chemistry-9701", label: "A Level Chemistry 9701 past papers by topic" },
    { href: "/syllabus/a-level-chemistry-9701", label: "9701 course guide" },
    { href: "/articles/igcse-to-a-level-guide", label: "IGCSE to A Level: what changes" },
  ],
  sources: [SYLLABUS_9701],
};

const BIOLOGY_9700_BY_TOPIC: Article = {
  draft: false,
  slug: "a-level-biology-9700-past-papers-by-topic",
  title: "A Level Biology 9700 Past Papers by Topic: Papers 1, 2 and 4",
  description: "Practise Cambridge 9700 past paper questions by topic, see which topics carry the most marks on each paper, and know what changed in 2022.",
  eyebrow: "Cambridge A Level Biology 9700",
  answer: "Practise 9700 by topic within each paper. Since 2022, Paper 1 leaned on biological molecules and cell structure, Paper 2 on transport in mammals, and Paper 4 spread almost evenly across all eight A Level topics, from homeostasis to photosynthesis. Formulae for chi-squared, the t-test and Hardy–Weinberg are given, so practise using them rather than memorising them.",
  answerLink: { href: "/banks/a-level-biology-9700", label: "Open 9700 by topic" },
  publishedAt: "2026-11-21",
  updatedAt: "2026-11-21",
  readingMinutes: 6,
  comparison: {
    caption: "9700 topics with the most marks, 2022–2026 papers",
    headings: ["Paper", "Top topics by share of marks", "Questions in our bank, 2020–2026"],
    rows: [
      { label: "Paper 1 Multiple Choice", pastPaperPrep: "Biological molecules 15.3%, cell structure 14.5%, transport in mammals 10.7%", competitor: "1,957" },
      { label: "Paper 2 AS Structured", pastPaperPrep: "Transport in mammals 15.3%, immunity 10.9%, enzymes 10.3%", competitor: "294" },
      { label: "Paper 4 A Level Structured", pastPaperPrep: "Homeostasis 15.4%, selection and evolution 13.4%, inheritance 13.3%", competitor: "429" },
    ],
  },
  sections: [
    {
      heading: "Why Biology suits topical practice",
      paragraphs: [
        "Biology mark schemes reward specific words: partially permeable, complementary shape, active site. You only learn which words Cambridge wants by seeing the same kind of question many times. Ten questions on transport in mammals in a row teach you the phrasing faster than ten whole papers.",
      ],
    },
    {
      heading: "Where the marks go",
      paragraphs: [
        "Paper 1 is weighted towards the early AS topics: biological molecules and cell structure together were nearly 30% of marks across the 2022 to 2026 papers in our bank. Paper 2 leaned hardest on transport in mammals, then immunity and enzymes.",
        "Paper 4 is the most even paper we've counted: homeostasis led with 15.4%, and even photosynthesis, the smallest, took 11.2%. There's no safe topic to skip at A Level.",
      ],
    },
    {
      heading: "Formulae you're given",
      paragraphs: [
        "The syllabus says these are provided in the exam: the chi-squared test, the t-test, the two Hardy–Weinberg equations, the Lincoln index, Spearman's rank and Pearson's correlation, and Simpson's index of diversity. You still need to know when to use each and how to interpret the result, which is where marks are lost.",
      ],
    },
    {
      heading: "What changed in 2022",
      paragraphs: [
        "Paper 1 got 15 minutes longer, and Paper 4 lost its optional Section B, so you answer everything. Content on smoking, myasthenia gravis, C4 plants and the menstrual cycle hormones was removed, and gene editing, the chloride shift and the Lincoln index became explicit. 2020 and 2021 papers are still useful; the bank tags removed content as earlier-syllabus topics.",
      ],
    },
    {
      heading: "Where to practise",
      paragraphs: [
        "PastPaperPrep's 9700 bank has all 2,680 questions from Papers 1, 2 and 4, 2020 to 2026, sorted by paper and topic, with Cambridge's mark scheme under each. 2020 and 2021 are free. Papers 3 and 5 aren't included, so practise those with your school's practical work.",
      ],
      links: [
        { href: "/banks/a-level-biology-9700?topic=Homeostasis", label: "Homeostasis questions" },
        { href: "/past-papers/a-level-biology-9700/paper-4", label: "Free Paper 4 whole papers" },
        { href: "/articles/cambridge-a-level-grade-boundaries", label: "9700 grade boundaries 2026" },
      ],
    },
  ],
  faqs: [
    { question: "Where can I find 9700 topical past papers?", answer: "PastPaperPrep sorts every 2020 to 2026 question from 9700 Papers 1, 2 and 4 by topic, with 2020 and 2021 free." },
    { question: "Which 9700 Paper 4 topic comes up most?", answer: "Homeostasis (15.4% of marks, 2022 to 2026), but every A Level topic took at least 11%." },
    { question: "Is the chi-squared formula given in 9700?", answer: "Yes, along with the t-test, Hardy–Weinberg equations, Lincoln index, correlation formulae and Simpson's index." },
    { question: "Does 9700 Paper 4 have optional questions?", answer: "No. Section B was removed in 2022, so you answer every question." },
  ],
  relatedBanks: [
    { href: "/banks/a-level-biology-9700", label: "A Level Biology 9700 past papers by topic" },
    { href: "/syllabus/a-level-biology-9700", label: "9700 course guide" },
    { href: "/articles/igcse-to-a-level-guide", label: "IGCSE to A Level: what changes" },
  ],
  sources: [SYLLABUS_9700],
};

const ECONOMICS_9708_MCQ: Article = {
  draft: false,
  slug: "a-level-economics-9708-topical-mcqs",
  title: "A Level Economics 9708 Topical MCQs: How to Score on Papers 1 and 3",
  description: "Practise Cambridge 9708 multiple choice by topic, see which topics carry the questions, and avoid the traps examiners report every year on Papers 1 and 3.",
  eyebrow: "Cambridge A Level Economics 9708",
  answer: "9708 Papers 1 and 3 are 30 multiple-choice questions each and together make up 34% of the A Level. Drill them by topic: the price system and microeconomy carries the most questions on both. Examiner reports show the same traps every year, elasticity and revenue, short run versus long run, and marginal versus average cost, so practise those until they're automatic.",
  answerLink: { href: "/banks/a-level-economics-9708", label: "Open 9708 MCQs by topic" },
  publishedAt: "2026-11-21",
  updatedAt: "2026-11-21",
  readingMinutes: 6,
  comparison: {
    caption: "9708 multiple-choice papers (2026–2028 syllabus)",
    headings: ["", "Paper 1", "Paper 3"],
    rows: [
      { label: "Level", pastPaperPrep: "AS", competitor: "A Level, with AS content assumed" },
      { label: "Time and questions", pastPaperPrep: "1 hour, 30 questions (2 minutes each)", competitor: "1 hour 15 minutes, 30 questions (2.5 minutes each)" },
      { label: "Weighting", pastPaperPrep: "33% of AS, 17% of A Level", competitor: "17% of A Level" },
      { label: "Most questions, 2023–2026", pastPaperPrep: "Price system and microeconomy (21%)", competitor: "A Level price system and microeconomy (29%)" },
      { label: "A boundary, June 2026", pastPaperPrep: "23 of 30 (Paper 12)", competitor: "22 of 30 (Paper 32)" },
    ],
  },
  sections: [
    {
      heading: "Why topical MCQs work for 9708",
      paragraphs: [
        "Multiple choice punishes half-understood ideas. You can write a decent essay paragraph on elasticity and still pick the wrong option when a question asks what happens to revenue. Doing 20 elasticity MCQs in a row exposes exactly which version of the idea you've got wrong.",
        "Both papers are 30 compulsory one-mark questions. Calculators are allowed and no formulae are given. Nearly half the marks test knowledge, 40% analysis and the rest evaluation, so expect tables and diagrams, not just definitions.",
      ],
    },
    {
      heading: "Which topics carry the questions",
      paragraphs: [
        "In the 2023 to 2026 Paper 1s in our bank, the price system and microeconomy had the most questions (21%), then international issues, the macroeconomy and basic economic ideas, all around 17 to 19%. No AS topic fell below 10%.",
        "Paper 3 is more concentrated: A Level price system and microeconomy took 29%, led by externalities, costs and market structures. Then came the macroeconomy (20%), international issues (19%) and government microeconomic intervention (18%).",
      ],
    },
    {
      heading: "The traps examiners keep reporting",
      paragraphs: [
        "Cambridge's June 2023 examiner report shows how many candidates chose each option. On one AS paper, almost half the questions were answered correctly by fewer than half the candidates. These ideas came up again and again:",
      ],
      bullets: [
        "Elasticity and total revenue: only 24% and 27% got two AS questions right; on one, 36% picked a partly true option that ignored elasticity.",
        "Short run versus long run: in the short run a firm must cover variable cost, in the long run all costs. Across three A Level variants, only 23% to 31% got it right.",
        "Marginal and average cost: average variable cost falls whenever marginal cost is below it, even if marginal cost is rising. 38% answered correctly.",
        "Pareto improvements: someone better off and nobody worse off. 42% chose a change that left one consumer worse off.",
      ],
    },
    {
      heading: "A routine for 30 questions",
      bullets: [
        "Underline the condition in the question: short run or long run, elastic or inelastic, real or nominal.",
        "Work out your answer before you read the options.",
        "On diagram questions, label the areas yourself first.",
        "Check a tempting option against the exact question; true isn't the same as correct.",
        "Don't look for patterns in the letters. Our Paper 1 keys split 22%, 26%, 27% and 25% across A to D.",
      ],
      paragraphs: [
        "If a question stalls you, move on and come back. In June 2026, 23 out of 30 was an A on Paper 12 and 22 on Paper 32, so you can drop a few and still do well.",
      ],
    },
    {
      heading: "Where to practise",
      paragraphs: [
        "PastPaperPrep's 9708 bank has 2,752 multiple-choice questions from 2020 to 2026 (1,492 from Paper 1, 1,260 from Paper 3), sorted by topic with the answer key, and 2020 and 2021 are free. The syllabus changed in 2023, so 2020 to 2022 questions are tagged to the earlier syllabus, but only a handful test content that's gone. Most free multiple-choice paper pages support self-marking for a timed run.",
      ],
      links: [
        { href: "/banks/a-level-economics-9708?topic=The%20price%20system%20and%20the%20microeconomy", label: "AS price system MCQs" },
        { href: "/past-papers/a-level-economics-9708/paper-1", label: "Free Paper 1 whole papers" },
        { href: "/articles/a-level-economics-9708-essay-technique", label: "9708 essays and levels marking" },
      ],
    },
  ],
  faqs: [
    { question: "Where can I find 9708 topical MCQs?", answer: "PastPaperPrep has 2,752 Paper 1 and Paper 3 questions from 2020 to 2026, sorted by topic with answer keys; 2020 and 2021 are free." },
    { question: "How many questions are in 9708 Paper 1?", answer: "30 multiple-choice questions in 1 hour. Paper 3 also has 30, in 1 hour 15 minutes." },
    { question: "What score is an A in 9708 Paper 1?", answer: "In June 2026, 23 out of 30 on Paper 12. It changes each series and variant." },
    { question: "Are formulae given in 9708 multiple choice?", answer: "No. Calculators are allowed, but formulae are not given." },
  ],
  relatedBanks: [
    { href: "/banks/a-level-economics-9708", label: "A Level Economics 9708 past papers by topic" },
    { href: "/syllabus/a-level-economics-9708", label: "9708 course guide" },
  ],
  sources: [SYLLABUS_9708, THRESHOLD_TABLES],
};

const GRADE_BOUNDARIES: Article = {
  draft: false,
  slug: "cambridge-a-level-grade-boundaries",
  title: "Cambridge A Level Grade Boundaries 2026: 9709, 9702, 9701, 9700, 9708",
  description: "June 2026 Cambridge A Level grade boundaries for Maths, Physics, Chemistry, Biology and Economics, what an A* took, and how the thresholds actually work.",
  eyebrow: "Cambridge A Level grade thresholds",
  answer: "In June 2026, an A* on the variant 2 papers took 222 of 250 in Maths 9709 (Mechanics route), 203 of 260 in Physics 9702, 201 in Chemistry 9701, 201 in Biology 9700 and 119 of 180 in Economics 9708. Your grade comes from your total across all papers, so a weak paper can be made up elsewhere. Boundaries change every series.",
  answerLink: { href: "/past-papers/a-level", label: "Score a free A Level paper" },
  publishedAt: "2026-11-21",
  updatedAt: "2026-11-21",
  readingMinutes: 6,
  comparison: {
    caption: "June 2026 A Level boundaries, variant 2 papers",
    headings: ["Subject (papers)", "A* / A", "C / E"],
    rows: [
      { label: "Maths 9709 (12, 32, 42, 52)", pastPaperPrep: "222 / 194 of 250", competitor: "124 / 52" },
      { label: "Maths 9709 (12, 32, 52, 62)", pastPaperPrep: "223 / 196 of 250", competitor: "131 / 61" },
      { label: "Physics 9702 (12, 22, 33, 42, 52)", pastPaperPrep: "203 / 177 of 260", competitor: "126 / 76" },
      { label: "Chemistry 9701 (12, 22, 33, 42, 52)", pastPaperPrep: "201 / 168 of 260", competitor: "110 / 62" },
      { label: "Biology 9700 (12, 22, 33, 42, 52)", pastPaperPrep: "201 / 176 of 260", competitor: "130 / 89" },
      { label: "Economics 9708 (12, 22, 32, 42)", pastPaperPrep: "119 / 106 of 180", competitor: "82 / 60" },
    ],
  },
  sections: [
    {
      heading: "What a grade boundary is",
      paragraphs: [
        "Cambridge calls them grade thresholds: the minimum mark needed for each grade. They're set after each series is marked, separately for every paper, so a harder paper gets lower boundaries and an easier one higher.",
        "Each table has two parts. First, every component (paper and variant) with its maximum mark and the minimum for A to E. Second, the overall boundaries for each combination of papers. A* only appears in the second part; Cambridge says there's no A* for a single component.",
      ],
    },
    {
      heading: "I bombed one paper. Is my A* gone?",
      paragraphs: [
        "This comes up on r/alevel after every exam, and the answer is usually no. Your A Level grade comes from your total across all your papers, compared with the overall boundary for your combination. The component boundaries are there for reference; you don't need an A on each paper to get an A overall.",
        "So 40 out of 50 on Statistics 1 and 70 out of 75 on Pure 3 add up just like 50 and 60 would. Strong papers carry weak ones.",
      ],
    },
    {
      heading: "Why the totals are 250, 260 and 180",
      paragraphs: [
        "Maths 9709 is simply the raw total: 75 + 75 + 50 + 50 = 250 at A Level, 125 at AS. Economics 9708 is too: 180 at A Level, 90 at AS.",
        "The sciences are weighted. Raw marks add up to 270, but the overall total is 260, which matches the syllabus weightings once Paper 3's 40 raw marks count as 30. AS is out of 130.",
      ],
    },
    {
      heading: "Boundaries move, sometimes a lot",
      paragraphs: [
        "The same Maths combination (12, 32, 42, 52) needed 205 for an A* in November 2025 and 222 in June 2026, a 17-mark swing. Biology moved from 191 to 201, Chemistry from 199 to 201, Physics from 201 to 203, and Economics went down from 124 to 119.",
        "In percentage terms, June 2026 A*s ranged from about 66% in Economics to 89% in Maths. That says more about how each subject's papers are marked than about difficulty, so don't compare across subjects.",
      ],
    },
    {
      heading: "AS boundaries, June 2026",
      paragraphs: [
        "On variant 2, an AS grade a took 101 of 125 in Maths with Pure 2, 102 with Statistics 1 and 99 with Mechanics; 95 of 130 in Physics, 79 in Chemistry and 86 in Biology; and 48 of 90 in Economics. AS grades run from a to e, with no a*.",
      ],
    },
    {
      heading: "Using boundaries with past papers",
      paragraphs: [
        "When you mark a practice paper, compare it with that paper's own component boundaries. In June 2026, an A on 9709 Paper 12 was 61 of 75; on Paper 42, 38 of 50. In the sciences, Paper 42 needed 62 (Physics), 66 (Chemistry) and 71 (Biology) out of 100.",
        "Treat it as a rough reading, not a prediction. Track your marks by topic across several papers and spend most of your time on the topics that keep costing you.",
      ],
      links: [
        { href: "/past-papers/a-level", label: "Free A Level past papers" },
        { href: "/articles/best-cambridge-a-level-past-paper-websites", label: "Where to practise by topic" },
      ],
    },
  ],
  faqs: [
    { question: "What was the 9709 A* boundary in June 2026?", answer: "222 out of 250 for Papers 12, 32, 42 and 52, and 223 for Papers 12, 32, 52 and 62." },
    { question: "Do I need an A on every paper to get an A overall?", answer: "No. Your grade is based on your total across all papers, compared with the overall boundary for your combination." },
    { question: "Is there an A* for a single A Level paper?", answer: "No. Cambridge awards A* only on the overall A Level total." },
    { question: "Where does Cambridge publish grade thresholds?", answer: "On its AS & A Level grade threshold tables page, with a table for each series." },
  ],
  relatedBanks: [
    { href: "/banks/a-level-maths-9709", label: "A Level Maths 9709 question bank" },
    { href: "/banks/a-level-physics-9702", label: "A Level Physics 9702 question bank" },
    { href: "/banks/a-level-chemistry-9701", label: "A Level Chemistry 9701 question bank" },
    { href: "/banks/a-level-biology-9700", label: "A Level Biology 9700 question bank" },
    { href: "/banks/a-level-economics-9708", label: "A Level Economics 9708 question bank" },
  ],
  sources: [THRESHOLD_TABLES],
};

const MATHS_9709_APPLIED: Article = {
  draft: false,
  slug: "a-level-maths-9709-mechanics-vs-statistics",
  title: "9709 Mechanics or Statistics? How to Choose Paper 4, 5 or 6",
  description: "Should you take Mechanics or Statistics in Cambridge A Level Maths 9709? What each paper tests, which keeps your options open, and where the marks are.",
  eyebrow: "Cambridge A Level Mathematics 9709",
  answer: "If you're choosing for AS, Statistics 1 (Paper 5) keeps both A Level routes open, because Statistics 1 is in every A Level route and is needed for Statistics 2. For A Level, the choice is Mechanics (Paper 4) or Statistics 2 (Paper 6). Mechanics suits Physics students and uses only Pure 1 calculus; Statistics 2 builds on Statistics 1 and Pure 3.",
  answerLink: { href: "/banks/a-level-maths-9709", label: "Practise 9709 by paper" },
  publishedAt: "2026-11-21",
  updatedAt: "2026-11-21",
  readingMinutes: 5,
  comparison: {
    caption: "9709 applied papers: topics with the most marks, 2020–2026",
    headings: ["Paper", "Builds on", "Most marks in our bank"],
    rows: [
      { label: "Paper 4 Mechanics", pastPaperPrep: "Pure 1; calculus limited to Pure 1", competitor: "Kinematics 38.0%, forces and equilibrium 20.6%, energy, work and power 20.0%" },
      { label: "Paper 5 Statistics 1", pastPaperPrep: "Pure 1; mainly numerical", competitor: "Normal distribution 26.0%, discrete random variables 21.5%, permutations 19.5%" },
      { label: "Paper 6 Statistics 2", pastPaperPrep: "Statistics 1, plus Pure 3 calculus", competitor: "Hypothesis tests 27.6%, Poisson 23.6%, continuous random variables 17.6%" },
    ],
  },
  sections: [
    {
      heading: "Choosing for AS: why most students take Statistics 1",
      paragraphs: [
        "It's a common r/alevel question, and the usual advice is right: take Statistics 1 with Pure 1 at AS. The staged routes in the syllabus show why. If you take Pure 1 and Statistics 1 first, you can finish A Level with either Mechanics or Statistics 2. If you take Pure 1 and Mechanics first, you must do Statistics 1 next and Statistics 2 is ruled out.",
        "The exception: if you also study Physics and like mechanics, Pure 1 with Mechanics at AS is fine. Just know it fixes your A Level route as Pure 3 plus Statistics 1.",
      ],
      links: [{ href: "/articles/a-level-maths-9709-paper-routes", label: "Every 9709 route explained" }],
    },
    {
      heading: "Choosing for A Level: Mechanics or Statistics 2",
      paragraphs: [
        "A Level is Pure 1, Pure 3 and Statistics 1, plus one of Mechanics or Statistics 2. The two can't be combined, because Statistics 2 needs Statistics 1. All three applied papers are 1 hour 15 minutes for 50 marks.",
        "The boundaries won't decide it for you. In June 2026, on variant 2, the Mechanics route needed 222 of 250 for an A* and the Statistics 2 route 223. Pick the paper you'll actually score better on.",
      ],
    },
    {
      heading: "Paper 4 Mechanics",
      paragraphs: [
        "Forces and equilibrium, straight-line kinematics, momentum, Newton's laws, and energy, work and power. Calculus is limited to Pure 1, vector notation isn't used, and everything is treated as a particle. Kinematics alone took 38% of the marks across 46 papers in our bank, while momentum took under 6%.",
        "It suits you if you take Physics 9702, whose AS topics on kinematics, dynamics, forces and work overlap heavily, and if you like drawing force diagrams.",
      ],
    },
    {
      heading: "Papers 5 and 6: Statistics 1 and 2",
      paragraphs: [
        "Statistics 1 covers data representation, permutations and combinations, probability, discrete random variables and the normal distribution, mostly with numerical work. The normal distribution took the biggest share, 26%.",
        "Statistics 2 adds the Poisson distribution, linear combinations, continuous random variables, sampling and hypothesis tests; hypothesis tests and Poisson together took over half its marks. Continuous random variables use Pure 3 integration, so Statistics 2 suits students who are comfortable with Pure 3.",
      ],
    },
    {
      heading: "How to practise",
      paragraphs: [
        "The 9709 bank has separate tabs for Mechanics, Statistics 1 and Statistics 2: 321, 307 and 272 questions from 2020 to 2026, each with Cambridge's mark scheme. Worked explanations cover the Pure papers, so use the mark scheme to review applied questions.",
      ],
      links: [
        { href: "/banks/a-level-maths-9709?topic=Kinematics%20of%20motion%20in%20a%20straight%20line", label: "Mechanics kinematics questions" },
        { href: "/banks/a-level-maths-9709?topic=The%20normal%20distribution", label: "Statistics 1 normal distribution questions" },
        { href: "/articles/a-level-maths-9709-past-papers-by-topic", label: "9709 past papers by topic" },
      ],
    },
  ],
  faqs: [
    { question: "Should I take Mechanics or Statistics for AS Maths 9709?", answer: "Statistics 1 keeps both A Level routes open. Mechanics at AS rules out Statistics 2 later." },
    { question: "Can I take Mechanics and Statistics 2 together?", answer: "No. Statistics 2 depends on Statistics 1, so the A Level combinations are Papers 1, 3, 4 and 5, or 1, 3, 5 and 6." },
    { question: "Is 9709 Mechanics easier than Statistics?", answer: "Neither is easier in general. Mechanics overlaps with Physics; Statistics 2 needs Pure 3 calculus. Their A* boundaries in June 2026 were one mark apart." },
    { question: "Which 9709 applied topic has the most marks?", answer: "Kinematics in Mechanics (38%), the normal distribution in Statistics 1 (26%) and hypothesis tests in Statistics 2 (27.6%)." },
  ],
  relatedBanks: [
    { href: "/banks/a-level-maths-9709", label: "A Level Maths 9709 past papers by topic" },
    { href: "/syllabus/a-level-maths-9709", label: "9709 course guide" },
  ],
  sources: [SYLLABUS_9709, THRESHOLD_TABLES],
};

const FORMULA_SHEETS: Article = {
  draft: false,
  slug: "cambridge-a-level-formula-sheets-data-booklets",
  title: "9709 MF19, 9702 Formula Sheet and 9701 Data: What You Get in the Exam",
  description: "What Cambridge gives you in A Level Maths, Physics, Chemistry and Biology exams: the 9709 MF19 list, the 9702 data and formulae pages, 9701 data and 9700 formulae.",
  eyebrow: "Cambridge A Level formula sheets",
  answer: "9709 gives you MF19, a list of formulae and statistical tables. 9702 prints data and formulae on page 2 of Papers 1, 2 and 4, with extra A Level formulae on page 3 of Paper 4. 9701 has had no separate data booklet in Papers 1, 2 and 4 since 2022: each paper prints a data table and Periodic Table. 9700 gives the statistics formulae. Anything not listed, you must learn.",
  answerLink: { href: "/cambridge-a-level", label: "Practise with real questions" },
  publishedAt: "2026-11-21",
  updatedAt: "2026-11-21",
  readingMinutes: 5,
  comparison: {
    caption: "What each A Level exam gives you (current syllabuses)",
    headings: ["Subject", "What you get", "Where"],
    rows: [
      { label: "Maths 9709", pastPaperPrep: "MF19 list of formulae and statistical tables", competitor: "Supplied in every exam" },
      { label: "Physics 9702", pastPaperPrep: "Constants and AS formulae; extra A Level formulae", competitor: "Page 2 of Papers 1, 2 and 4; page 3 of Paper 4" },
      { label: "Chemistry 9701", pastPaperPrep: "Data table of constants and a Periodic Table; other data in the question", competitor: "Inside every paper" },
      { label: "Biology 9700", pastPaperPrep: "Formulae for chi-squared, t-test, Hardy–Weinberg, Lincoln index, correlation, Simpson's index", competitor: "Provided in the exam" },
    ],
  },
  sections: [
    {
      heading: "Maths 9709: MF19",
      paragraphs: [
        "Every 9709 exam comes with MF19, Cambridge's list of formulae and statistical tables. It's shared with Further Maths 9231, so it includes sections you'll never use; ignore anything labelled Further Pure, Further Mechanics or Further Probability & Statistics.",
        "The useful parts: algebra (including the binomial series), mensuration such as arc length and sector area, trigonometry, a table of derivatives and integrals, vectors, the uniformly accelerated motion equations for Mechanics, and the statistics formulae and tables. Look at it while you practise, so in the exam you know where things are rather than discovering them.",
        "It won't give you methods: completing the square, finding stationary points or setting up a hypothesis test are on you. And your calculator must be scientific, not graphical.",
      ],
    },
    {
      heading: "Physics 9702: data and formulae pages",
      paragraphs: [
        "Papers 1, 2 and 4 print data and formulae on page 2: constants such as g, c, e and the Planck and Avogadro constants, plus AS formulae including the uniformly accelerated motion equations, hydrostatic pressure, upthrust, the Doppler effect, I = Anvq and resistors in series and parallel. Paper 4 adds a page 3 of A Level formulae: gravitational and electric potential, ideal gas pressure, simple harmonic motion, capacitors, Hall voltage and radioactive decay.",
        "Plenty isn't there. The syllabus asks you to recall and use formulae like kinetic energy, Hooke's law, v = fλ and the double-slit equation, so those have to be in your head.",
      ],
    },
    {
      heading: "Chemistry 9701: the data booklet question",
      paragraphs: [
        "You'll see 9701 data booklet PDFs online, but since 2022 the separate Data Booklet isn't given with Papers 1, 2 and 4. Each paper instead contains a data table of commonly used constants and a Periodic Table, and any other data you need is printed in the question. The syllabus's own Data section lists the tables Cambridge works from: constants, ionisation energies, bond energies, electrode potentials, electronegativities, NMR shifts, infrared absorptions and the Periodic Table.",
        "So practise with real papers rather than with the booklet open, learn the values you use often, and get used to finding data in the question.",
      ],
    },
    {
      heading: "Biology 9700: statistics formulae",
      paragraphs: [
        "The syllabus says the formulae for chi-squared, the t-test, the Hardy–Weinberg equations, the Lincoln index, Spearman's rank and Pearson's correlation, and Simpson's index of diversity will be provided. The marks are in choosing the right test, substituting correctly and interpreting the answer, so practise those questions until it's routine.",
      ],
    },
    {
      heading: "Practise with the real thing",
      paragraphs: [
        "The best way to learn a formula sheet is to use it on real questions. The free Physics and Chemistry whole papers on PastPaperPrep include their data pages as printed, and the topic banks let you drill the questions that use them, from 9709 kinematics to 9702 capacitors.",
      ],
      links: [
        { href: "/past-papers/a-level", label: "Free A Level whole papers" },
        { href: "/banks/a-level-physics-9702?topic=Capacitance", label: "9702 capacitance questions" },
        { href: "/articles/a-level-chemistry-9701-past-papers-by-topic", label: "9701 past papers by topic" },
      ],
    },
  ],
  faqs: [
    { question: "What is MF19 in 9709?", answer: "Cambridge's list of formulae and statistical tables, supplied in every 9709 exam and shared with Further Maths 9231." },
    { question: "Is there a formula sheet in 9702 Physics?", answer: "Yes. Data and formulae are on page 2 of Papers 1, 2 and 4, and Paper 4 adds A Level formulae on page 3." },
    { question: "Is the 9701 data booklet given in the exam?", answer: "Not since 2022 for Papers 1, 2 and 4. Each paper has a data table and Periodic Table, and other data is in the question." },
    { question: "Which formulae are given in 9700 Biology?", answer: "Chi-squared, the t-test, Hardy–Weinberg, the Lincoln index, Spearman's and Pearson's correlation, and Simpson's index." },
  ],
  relatedBanks: [
    { href: "/banks/a-level-maths-9709", label: "A Level Maths 9709 question bank" },
    { href: "/banks/a-level-physics-9702", label: "A Level Physics 9702 question bank" },
    { href: "/banks/a-level-chemistry-9701", label: "A Level Chemistry 9701 question bank" },
    { href: "/banks/a-level-biology-9700", label: "A Level Biology 9700 question bank" },
  ],
  sources: [SYLLABUS_9709, SYLLABUS_9702, SYLLABUS_9701, SYLLABUS_9700],
};

export const A_LEVEL_ARTICLES: readonly Article[] = [
  BEST_A_LEVEL_SITES,
  SME_ALTERNATIVES_A_LEVEL,
  ZNOTES_VS_SME,
  MATHS_9709_BY_TOPIC,
  PHYSICS_9702_BY_TOPIC,
  CHEMISTRY_9701_BY_TOPIC,
  BIOLOGY_9700_BY_TOPIC,
  ECONOMICS_9708_MCQ,
  GRADE_BOUNDARIES,
  MATHS_9709_APPLIED,
  FORMULA_SHEETS,
];
