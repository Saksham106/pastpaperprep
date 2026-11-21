import type { Article, ArticleSection } from "@/lib/articles";

/**
 * Cambridge International AS & A Level guides added 2026-11-20, after the five A Level banks launched
 * (2026-11-18 to 2026-11-20). Syllabus facts come from the pinned Cambridge syllabuses in
 * research/a-level-scoping/sources (9709 2026–2027 v5, 9702 2025–2027, 9708 2026–2028, and the 2022–2024
 * science syllabuses for the 2022 changes). Archive figures (question counts, mark shares) come from the
 * production bank data on 2026-11-20. Levels-marking detail for 9708 comes from Cambridge's published
 * mark schemes for 9708/42 May/June 2025 and 9708/22 Oct/Nov 2025.
 *
 * Explanation coverage: only 9709 Pure 1–3 have worked explanations, so no guide here claims more.
 */

const A_LEVEL_ACCESS: ArticleSection = {
  heading: "What is free on PastPaperPrep",
  paragraphs: [
    "Whole A Level past papers and their mark schemes are free to read, with no account. Each paper page has a timer, and supported papers let you mark your own answers.",
    "In the topic banks, questions from 2020 and 2021 are free to practise, with the official mark scheme under each question. Newer years and PDF worksheets need a plan.",
  ],
  links: [
    { href: "/past-papers/a-level", label: "Free A Level past papers" },
    { href: "/cambridge-a-level", label: "All A Level question banks" },
  ],
};

const SYLLABUS_9709 = { href: "https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-international-as-and-a-level-mathematics-9709/", label: "Cambridge International: AS & A Level Mathematics 9709" };
const SYLLABUS_9702 = { href: "https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-international-as-and-a-level-physics-9702/", label: "Cambridge International: AS & A Level Physics 9702" };
const SYLLABUS_9708 = { href: "https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-international-as-and-a-level-economics-9708/", label: "Cambridge International: AS & A Level Economics 9708" };

const MATHS_9709_ROUTES: Article = {
  draft: false,
  slug: "a-level-maths-9709-paper-routes",
  title: "A Level Maths 9709: Which Papers Do You Sit?",
  description: "Every Cambridge A Level Maths 9709 route explained: the three AS pairs, the two A Level combinations, why Papers 4 and 6 can't be combined, and what each paper tests.",
  eyebrow: "Cambridge A Level Mathematics 9709",
  answer: "AS Level Maths is two papers: Pure 1 plus one of Pure 2, Mechanics or Probability & Statistics 1. A Level is four papers: Pure 1 and Pure 3, plus either Mechanics and Statistics 1, or Statistics 1 and Statistics 2. Pure 2 is AS only, and Mechanics can't be paired with Statistics 2. Ask your school which route it enters you for, then practise those papers only.",
  answerLink: { href: "/banks/a-level-maths-9709", label: "Practise 9709 by paper" },
  publishedAt: "2026-11-20",
  updatedAt: "2026-11-20",
  readingMinutes: 5,
  comparison: {
    caption: "The six 9709 papers (2026–2027 syllabus)",
    headings: ["Paper", "Time and marks", "Where it counts"],
    rows: [
      { label: "Paper 1 Pure Mathematics 1", pastPaperPrep: "1 h 50 min, 75 marks", competitor: "Every AS and A Level route: 60% of AS, 30% of A Level" },
      { label: "Paper 2 Pure Mathematics 2", pastPaperPrep: "1 h 15 min, 50 marks", competitor: "AS only (40%); can't count towards A Level" },
      { label: "Paper 3 Pure Mathematics 3", pastPaperPrep: "1 h 50 min, 75 marks", competitor: "Every A Level route: 30%" },
      { label: "Paper 4 Mechanics", pastPaperPrep: "1 h 15 min, 50 marks", competitor: "AS (40%) or A Level (20%)" },
      { label: "Paper 5 Probability & Statistics 1", pastPaperPrep: "1 h 15 min, 50 marks", competitor: "AS (40%) or A Level (20%); needed for every A Level route" },
      { label: "Paper 6 Probability & Statistics 2", pastPaperPrep: "1 h 15 min, 50 marks", competitor: "A Level only (20%)" },
    ],
  },
  sections: [
    {
      heading: "The AS Level routes",
      paragraphs: [
        "AS Level Mathematics is two papers sat in the same series. Paper 1 is always one of them. The second is Paper 2 (Pure Mathematics 2), Paper 4 (Mechanics) or Paper 5 (Probability & Statistics 1).",
        "The Pure-only route, Papers 1 and 2, is a dead end for A Level: the syllabus says it cannot count towards A Level, so you can't carry that AS result forward. If you might continue to the full A Level, take Paper 1 with Paper 4 or Paper 5 instead.",
      ],
    },
    {
      heading: "The two A Level combinations",
      paragraphs: [
        "A Level is four papers. Everyone takes Paper 1 and Paper 3, then either Papers 4 and 5 (Mechanics with Statistics 1) or Papers 5 and 6 (both Statistics papers).",
        "Mechanics with Statistics 2 is not allowed, because Paper 6 depends on Paper 5 content. Pure 2 and Pure 3 can't be sat in the same series either: Pure 2 is for AS only, and its content is largely a subset of Pure 3.",
      ],
      bullets: [
        "Papers 1, 3, 4 and 5: Pure, Mechanics and Statistics 1.",
        "Papers 1, 3, 5 and 6: Pure and both Statistics papers.",
      ],
    },
    {
      heading: "Staged or all at once",
      paragraphs: [
        "You can sit all four papers in one series, or take AS first and carry the result forward. The staged routes in the syllabus are Papers 1 and 4 then 3 and 5, Papers 1 and 5 then 3 and 4, or Papers 1 and 5 then 3 and 6. Carry-forward time limits are set in the Cambridge Handbook, so check them with your exams officer.",
      ],
    },
    {
      heading: "What each paper builds on",
      paragraphs: [
        "Pure 1 is the foundation for everything else. Pure 3 assumes Pure 1 and can test it directly. Mechanics uses only Pure 1 calculus, and Statistics 1 needs no algebra beyond Pure 1. Statistics 2 assumes Statistics 1 and the calculus from Pure 3, so it suits students taking Pure 3 at the same time or later.",
        "Every paper allows a scientific calculator but not a graphical one, and the MF19 list of formulae and statistical tables is supplied in the exam. Non-exact answers go to three significant figures, or one decimal place for angles in degrees, unless the question says otherwise.",
      ],
      links: [
        { href: "/articles/a-level-maths-9709-pure-1-topics", label: "Pure 1 topics and how to revise them" },
      ],
    },
    {
      heading: "How to practise for your route",
      paragraphs: [
        "Practise only the papers you will sit. The 9709 bank on PastPaperPrep has 2,118 questions from 2020 to 2026, split into tabs for Pure 1, Pure 2, Pure 3, Mechanics, Stats 1 and Stats 2, so a Mechanics student never wades through Statistics 2.",
        "Pure 1, Pure 2 and Pure 3 questions in the bank have worked explanations as well as the mark scheme. Mechanics and Statistics questions show the official mark scheme.",
      ],
      links: [
        { href: "/banks/a-level-maths-9709", label: "9709 questions by paper and topic" },
        { href: "/past-papers/a-level-maths-9709", label: "Free 9709 whole papers" },
      ],
    },
    A_LEVEL_ACCESS,
  ],
  faqs: [
    { question: "Is Paper 1 compulsory for 9709?", answer: "Yes. Pure Mathematics 1 is in every AS and every A Level route." },
    { question: "Can I take Mechanics and Statistics 2 for A Level Maths?", answer: "No. Paper 6 depends on Paper 5, so the A Level combinations are 1, 3, 4 and 5, or 1, 3, 5 and 6." },
    { question: "Does AS Pure 1 and Pure 2 count towards A Level?", answer: "No. The syllabus says the Paper 1 and Paper 2 route cannot count towards A Level." },
    { question: "Is a formula sheet given in 9709 exams?", answer: "Yes. The MF19 list of formulae and statistical tables is supplied in every 9709 exam." },
  ],
  relatedBanks: [
    { href: "/banks/a-level-maths-9709", label: "A Level Maths 9709 past papers by topic" },
    { href: "/syllabus/a-level-maths-9709", label: "9709 course guide" },
    { href: "/articles/igcse-to-a-level-guide", label: "IGCSE to A Level: what changes" },
  ],
  sources: [SYLLABUS_9709],
};

const MATHS_9709_PURE_1: Article = {
  draft: false,
  slug: "a-level-maths-9709-pure-1-topics",
  title: "A Level Maths 9709 Pure 1 Topics: What Comes Up and How to Revise",
  description: "The eight Cambridge 9709 Pure Mathematics 1 topics, how many marks each took in 46 papers from 2020 to 2026, and a revision order that works.",
  eyebrow: "Cambridge A Level Mathematics 9709",
  answer: "Pure 1 has eight topics: quadratics, functions, coordinate geometry, circular measure, trigonometry, series, differentiation and integration. Across 46 Pure 1 papers from 2020 to 2026, series, differentiation and functions took the most marks. Revise each topic with real questions, then sit full 1 hour 50 minute papers.",
  answerLink: { href: "/banks/a-level-maths-9709?topic=Series", label: "Practise Pure 1 Series" },
  publishedAt: "2026-11-20",
  updatedAt: "2026-11-20",
  readingMinutes: 5,
  comparison: {
    caption: "Share of Pure 1 marks by main topic, 46 papers, 2020–2026",
    headings: ["Topic", "Share of marks", "What it covers"],
    rows: [
      { label: "Series", pastPaperPrep: "17.5%", competitor: "Binomial expansion, arithmetic and geometric progressions, sum to infinity" },
      { label: "Differentiation", pastPaperPrep: "16.1%", competitor: "Chain rule, tangents and normals, rates of change, stationary points" },
      { label: "Functions", pastPaperPrep: "14.9%", competitor: "Domain and range, inverses, composites, graph transformations" },
      { label: "Integration", pastPaperPrep: "13.0%", competitor: "Definite integrals, areas, volumes of revolution" },
      { label: "Coordinate geometry", pastPaperPrep: "11.8%", competitor: "Lines, circles, intersections, tangents" },
      { label: "Circular measure", pastPaperPrep: "9.4%", competitor: "Radians, arc length, sector area" },
      { label: "Trigonometry", pastPaperPrep: "9.2%", competitor: "Graphs, exact values, identities, equations in an interval" },
      { label: "Quadratics", pastPaperPrep: "8.0%", competitor: "Completing the square, discriminant, inequalities" },
    ],
  },
  sections: [
    {
      heading: "What Pure 1 is",
      paragraphs: [
        "Paper 1 Pure Mathematics 1 is 1 hour 50 minutes and 75 marks, with 10 to 12 structured questions, all compulsory. It is in every AS and A Level route: 60% of AS and 30% of A Level. Pure 3, Mechanics and both Statistics papers all assume its content.",
        "The syllabus assumes IGCSE Mathematics 0580 Extended or O Level. You should already handle surds and know the shapes of graphs like y = kxⁿ before you start.",
      ],
    },
    {
      heading: "Where the marks go",
      paragraphs: [
        "The table counts each question's marks under its main topic, across the 46 Pure 1 papers from 2020 to 2026 in our bank. No topic is safe to skip: the smallest, quadratics, still averaged about 6 of 75 marks a paper, and quadratic methods turn up inside coordinate geometry and functions questions too.",
        "This is the pattern of past papers, not a forecast of the next one.",
      ],
    },
    {
      heading: "A revision order that works",
      paragraphs: [
        "Start with quadratics and functions: completing the square, the discriminant and inverse functions come back in almost every other topic. Then coordinate geometry, circular measure and trigonometry. Finish with series, differentiation and integration, which carry the most marks and often join together in the longer questions at the end of the paper.",
      ],
      bullets: [
        "Quadratics: discriminant conditions for a line meeting a curve are a favourite.",
        "Functions: say why a function is one-one before finding its inverse.",
        "Trigonometry: solutions must lie in the interval given; general solutions are not on the syllabus.",
        "Differentiation: points of inflexion are not on the syllabus; use the second derivative for nature.",
        "Integration: volumes of revolution and areas between a curve and a line are both in scope.",
      ],
    },
    {
      heading: "Practise by topic, then by paper",
      paragraphs: [
        "The 9709 bank opens on the Pure 1 tab, with 502 Pure 1 questions from 2020 to 2026 sorted by topic. Pure 1 questions come with a worked explanation as well as the mark scheme, so you can see the step you missed. Once a topic holds up, sit a whole Pure 1 paper against the clock.",
      ],
      links: [
        { href: "/banks/a-level-maths-9709?topic=Differentiation", label: "Pure 1 Differentiation questions" },
        { href: "/past-papers/a-level-maths-9709/paper-1", label: "Free Pure 1 whole papers" },
        { href: "/articles/a-level-maths-9709-paper-routes", label: "Which 9709 papers you sit" },
      ],
    },
    A_LEVEL_ACCESS,
  ],
  faqs: [
    { question: "How many topics are in 9709 Pure 1?", answer: "Eight: quadratics, functions, coordinate geometry, circular measure, trigonometry, series, differentiation and integration." },
    { question: "How long is 9709 Paper 1?", answer: "1 hour 50 minutes, for 75 marks." },
    { question: "Is implicit differentiation in Pure 1?", answer: "No. The syllabus excludes it from Pure 1; it is in Pure 2 and Pure 3." },
    { question: "Which Pure 1 topic is worth the most?", answer: "In the 46 papers from 2020 to 2026 we hold, series took the largest share of marks (17.5%), then differentiation (16.1%) and functions (14.9%)." },
  ],
  relatedBanks: [
    { href: "/banks/a-level-maths-9709", label: "A Level Maths 9709 past papers by topic" },
    { href: "/syllabus/a-level-maths-9709", label: "9709 course guide" },
  ],
  sources: [SYLLABUS_9709],
};

const PHYSICS_9702_P2_P4: Article = {
  draft: false,
  slug: "a-level-physics-9702-paper-2-vs-paper-4",
  title: "A Level Physics 9702 Paper 2 vs Paper 4: What's the Difference?",
  description: "Cambridge 9702 Paper 2 and Paper 4 compared: timing, marks, which topics each tests, what changed in 2022, and how to practise for both.",
  eyebrow: "Cambridge A Level Physics 9702",
  answer: "Paper 2 is the AS structured paper: 1 hour 15 minutes, 60 marks, on topics 1 to 11. Paper 4 is the A Level structured paper: 2 hours, 100 marks, on topics 12 to 25, and it can still need AS knowledge. Paper 2 counts for 23% of the full A Level and Paper 4 for 38.5%, the largest single share.",
  answerLink: { href: "/banks/a-level-physics-9702", label: "Practise 9702 by paper" },
  publishedAt: "2026-11-20",
  updatedAt: "2026-11-20",
  readingMinutes: 5,
  comparison: {
    caption: "9702 Paper 2 and Paper 4 (2025–2027 syllabus)",
    headings: ["", "Paper 2", "Paper 4"],
    rows: [
      { label: "Name", pastPaperPrep: "AS Level Structured Questions", competitor: "A Level Structured Questions" },
      { label: "Time and marks", pastPaperPrep: "1 h 15 min, 60 marks", competitor: "2 h, 100 marks" },
      { label: "Weighting", pastPaperPrep: "46% of AS, 23% of A Level", competitor: "38.5% of A Level" },
      { label: "Content", pastPaperPrep: "AS topics 1–11", competitor: "A Level topics 12–25, with AS knowledge assumed" },
      { label: "Most marks, 2020–2026", pastPaperPrep: "Dynamics, D.C. circuits, particle physics", competitor: "Magnetic fields, oscillations, medical and nuclear physics" },
    ],
  },
  sections: [
    {
      heading: "Where the two papers sit",
      paragraphs: [
        "AS Physics is Papers 1, 2 and 3: multiple choice, AS structured questions and the practical. A Level adds Paper 4, A Level structured questions, and Paper 5, planning, analysis and evaluation.",
        "Paper 2 tests AS topics 1 to 11, from physical quantities and units to particle physics. Paper 4 tests A Level topics 12 to 25, from motion in a circle to astronomy and cosmology. The syllabus warns that Paper 4 can still require AS knowledge, so a magnetic fields question may lean on your D.C. circuits.",
      ],
    },
    {
      heading: "Different lengths, different questions",
      paragraphs: [
        "Paper 2 is short: 60 marks in 75 minutes leaves little time to think twice. Paper 4 is 100 marks in two hours, with longer multi-part questions that chain ideas together. Both give a list of data and formulae on page 2, and Paper 4 adds more formulae on page 3.",
        "Both papers split marks evenly between knowledge with understanding (AO1) and handling and applying information (AO2), so recall alone is never enough.",
      ],
    },
    {
      heading: "Which topics carry the marks",
      paragraphs: [
        "Across the Paper 2 questions from 2020 to 2026 in our bank, dynamics (11.5% of marks), D.C. circuits (10.5%), particle physics (10.2%) and work, energy and power (10.1%) took the most marks. In Paper 4, magnetic fields led clearly (12.2%), then oscillations (8.9%), medical physics and nuclear physics (8.2% each).",
        "These are past patterns, not predictions, but they show where an hour of practice goes furthest.",
      ],
    },
    {
      heading: "What changed in 2022",
      paragraphs: [
        "The 2022–2024 syllabus was a major revision. Communication and electronics were removed and astronomy and cosmology was added. Electric fields moved from AS to A Level, so they now belong to Paper 4. Band theory and NMRI went, and PET scanning and discharging a capacitor came in. The 2025–2027 syllabus only rewords a few learning outcomes.",
        "So 2020 and 2021 papers still help for most topics, but skip questions on removed content. The bank tags those as earlier-syllabus topics so you can spot them.",
      ],
    },
    {
      heading: "How to practise both",
      paragraphs: [
        "The 9702 bank has separate tabs for multiple choice, AS structured and A Level structured, with 324 Paper 2 and 383 Paper 4 questions from 2020 to 2026, each with its official mark scheme. Repair a weak topic there, then sit a whole Paper 2 or Paper 4 against the clock.",
      ],
      links: [
        { href: "/past-papers/a-level-physics-9702/paper-2", label: "Free Paper 2 whole papers" },
        { href: "/past-papers/a-level-physics-9702/paper-4", label: "Free Paper 4 whole papers" },
      ],
    },
    A_LEVEL_ACCESS,
  ],
  faqs: [
    { question: "Is 9702 Paper 4 harder than Paper 2?", answer: "It is longer (2 hours and 100 marks against 75 minutes and 60), covers the A Level topics, and can also test AS content, so most students find it more demanding." },
    { question: "Does Paper 4 test AS topics?", answer: "Its questions are on A Level topics 12 to 25, but the syllabus says AS knowledge will be required." },
    { question: "Is a formula sheet given in 9702?", answer: "Yes. Papers 1, 2 and 4 print data and formulae on page 2, and Paper 4 adds more on page 3." },
    { question: "Are 2020 and 2021 9702 papers still useful?", answer: "Yes for most topics. Skip questions on content removed in 2022, such as communication and electronics." },
  ],
  relatedBanks: [
    { href: "/banks/a-level-physics-9702", label: "A Level Physics 9702 past papers by topic" },
    { href: "/syllabus/a-level-physics-9702", label: "9702 course guide" },
  ],
  sources: [SYLLABUS_9702],
};

const ECONOMICS_9708_ESSAYS: Article = {
  draft: false,
  slug: "a-level-economics-9708-essay-technique",
  title: "A Level Economics 9708 Essays: How Levels Marking Works",
  description: "How Cambridge marks 9708 Paper 2 and Paper 4 essays: the two levels tables, what moves an answer up a level, and how to plan a 20-mark essay.",
  eyebrow: "Cambridge A Level Economics 9708",
  answer: "9708 essays are marked with two levels tables. One rewards knowledge and analysis, up to 14 of 20 marks on a Paper 4 essay. The other rewards evaluation, up to 6. Reaching the top evaluation level needs a justified conclusion and developed, well-supported judgement. Explain fully, use accurate diagrams, and end by answering the question.",
  answerLink: { href: "/banks/a-level-economics-9708", label: "Practise 9708 essay questions" },
  publishedAt: "2026-11-20",
  updatedAt: "2026-11-20",
  readingMinutes: 6,
  comparison: {
    caption: "Levels tables in two 2025 mark schemes (9708/42 May/June, 9708/22 Oct/Nov)",
    headings: ["Level", "Paper 4 essay (20 marks)", "Paper 2 part (b) (12 marks)"],
    rows: [
      { label: "Knowledge and analysis, Level 3", pastPaperPrep: "11–14", competitor: "6–8" },
      { label: "Knowledge and analysis, Level 2", pastPaperPrep: "6–10", competitor: "3–5" },
      { label: "Knowledge and analysis, Level 1", pastPaperPrep: "1–5", competitor: "1–2" },
      { label: "Evaluation, Level 2", pastPaperPrep: "4–6", competitor: "3–4" },
      { label: "Evaluation, Level 1", pastPaperPrep: "1–3", competitor: "1–2" },
    ],
  },
  sections: [
    {
      heading: "Where the essays are",
      paragraphs: [
        "Papers 2 (AS) and 4 (A Level) are both 2 hours and 60 marks. Each has a compulsory data response question in Section A, then one essay from a choice of two in Section B, mainly microeconomics, and one from a choice of two in Section C, mainly macroeconomics. Each essay is worth 20 marks.",
        "Paper 2 essays have two parts. In the October/November 2025 paper the split was 8 marks then 12. Paper 4 essays are a single unstructured question. Papers from 2020 to 2022 in our bank had 25-mark Paper 4 essays; the 20-mark format runs from 2023.",
      ],
    },
    {
      heading: "The two levels tables",
      paragraphs: [
        "Cambridge marks a whole essay against two tables. Table A covers knowledge, understanding and analysis (AO1 and AO2) in three levels. Table B covers evaluation (AO3) in two levels. On a Paper 4 essay, Table A is out of 14 and Table B out of 6, so evaluation is 30% of the marks.",
        "In Table A, Level 3 needs detailed knowledge, fully developed explanations and diagrams that are fully explained. Level 2 explanations are limited, over-generalised or not fully developed. Level 1 is a few relevant points with largely descriptive analysis.",
        "In Table B, Level 2 needs a justified conclusion or judgement backed by developed, reasoned, well-supported evaluation. A vague conclusion or simple, undeveloped comments stay in Level 1.",
      ],
    },
    {
      heading: "What moves an answer up a level",
      paragraphs: [
        "Examiners mark positively and use the full range, so a strong answer can earn full marks. The mark schemes give indicative content as a guide, not a checklist, and accept any valid evaluation.",
      ],
      bullets: [
        "Develop each point as a chain: cause, mechanism, effect. One developed chain beats three assertions.",
        "Draw the diagram the question needs, label it fully and explain it in your text. One 2025 scheme capped answers without a monopoly diagram at 8 marks.",
        "Answer the exact question. Another 2025 scheme capped answers that ignored a key condition in the question at mid-Level 2.",
        "Evaluate as you go, then finish with a judgement that answers the question and says what it depends on.",
      ],
    },
    {
      heading: "Planning a 20-mark essay",
      paragraphs: [
        "Spend a few minutes on a plan: define the key terms, choose two or three lines of analysis, and decide your judgement before you write. Then build the analysis, add evaluation to each strand, and close with the conclusion you planned. With three 20-mark questions in two hours, aim for about 40 minutes each.",
        "Use the command words as your guide. The syllabus defines assess as making an informed judgement, and evaluate as judging the quality, importance or value of something; both need that final judgement.",
      ],
    },
    {
      heading: "Practise with real questions",
      paragraphs: [
        "The 9708 bank has 3,207 questions from 2020 to 2026, including 215 Paper 2 and 240 Paper 4 questions, each with Cambridge's mark scheme so you can compare your answer with the levels descriptors. Paper 1 and Paper 3 multiple-choice questions are in the same bank for quick topic checks.",
      ],
      links: [
        { href: "/past-papers/a-level-economics-9708/paper-4", label: "Free Paper 4 whole papers" },
        { href: "/past-papers/a-level-economics-9708/paper-2", label: "Free Paper 2 whole papers" },
      ],
    },
    A_LEVEL_ACCESS,
  ],
  faqs: [
    { question: "How are 9708 essays marked?", answer: "Against two levels tables: one for knowledge, understanding and analysis, and one for evaluation. On a 20-mark Paper 4 essay, the 2025 schemes give 14 and 6 marks." },
    { question: "How many essays are in 9708 Paper 4?", answer: "Two: one from a choice of two in Section B and one from a choice of two in Section C, after the compulsory data response question." },
    { question: "What does a Level 2 evaluation need in 9708?", answer: "A justified conclusion or judgement, backed by developed, reasoned and well-supported evaluative comments." },
    { question: "Are diagrams required in 9708 essays?", answer: "The syllabus encourages clearly labelled diagrams, and some mark schemes cap answers that leave out the diagram a question needs." },
  ],
  relatedBanks: [
    { href: "/banks/a-level-economics-9708", label: "A Level Economics 9708 past papers by topic" },
    { href: "/syllabus/a-level-economics-9708", label: "9708 course guide" },
  ],
  sources: [SYLLABUS_9708],
};

const IGCSE_TO_A_LEVEL: Article = {
  draft: false,
  slug: "igcse-to-a-level-guide",
  title: "IGCSE to A Level: What Changes in Maths, Sciences and Economics",
  description: "Moving from Cambridge IGCSE to Cambridge International A Level: which course follows which, what the syllabuses assume, how the papers change, and how to start.",
  eyebrow: "Cambridge IGCSE to A Level",
  answer: "Cambridge A Level picks up where IGCSE stops. Maths 9709 assumes IGCSE Maths 0580 Extended; Physics 9702, Chemistry 9701 and Biology 9700 recommend an IGCSE course in the subject or Co-ordinated Sciences. Papers get longer, the course splits into AS and A Level papers, and in Maths you choose some papers. Start with the paper you sit first.",
  answerLink: { href: "/cambridge-a-level", label: "See the A Level banks" },
  publishedAt: "2026-11-20",
  updatedAt: "2026-11-20",
  readingMinutes: 5,
  comparison: {
    caption: "From IGCSE to A Level",
    headings: ["IGCSE course", "A Level course", "What the A Level syllabus expects"],
    rows: [
      { label: "Maths 0580 or Additional Maths 0606", pastPaperPrep: "Mathematics 9709", competitor: "0580 Extended or O Level content" },
      { label: "Physics 0625", pastPaperPrep: "Physics 9702", competitor: "An IGCSE or O Level course in Physics, or Co-ordinated Science" },
      { label: "Chemistry 0620", pastPaperPrep: "Chemistry 9701", competitor: "An IGCSE or O Level course in Chemistry, or Co-ordinated Science" },
      { label: "Biology 0610", pastPaperPrep: "Biology 9700", competitor: "An IGCSE or O Level course in Biology, or Co-ordinated Science" },
      { label: "Co-ordinated Sciences 0654", pastPaperPrep: "9702, 9701 or 9700", competitor: "Accepted as the science background for all three" },
      { label: "Economics 0455", pastPaperPrep: "Economics 9708", competitor: "Maths to IGCSE Extended or O Level; no Economics required" },
    ],
  },
  sections: [
    {
      heading: "What A Level assumes",
      paragraphs: [
        "The 9709 Maths syllabus assumes the content of IGCSE Mathematics 0580 Extended or O Level, including simple surds and the shapes of graphs like y = kxⁿ. Additional Maths 0606 isn't required, but much of it, such as functions, series, circular measure and basic calculus, reappears in Pure 1, so 0606 students start ahead.",
        "The three science syllabuses recommend an IGCSE or O Level course in the subject, or Co-ordinated Science. Economics 9708 recommends maths to IGCSE Extended or O Level standard and does not require IGCSE Economics.",
      ],
    },
    {
      heading: "How the papers change",
      paragraphs: [
        "At IGCSE you sit one set of papers at the end. At A Level, AS papers cover the first half of the course and A Level papers the second, and you can sit them in one series or AS first. Later papers assume the earlier content: 9702 Paper 4 says AS knowledge will be required, and 9708 Papers 3 and 4 treat AS content as assumed.",
        "Papers are longer. A 9709 Pure 1 paper is 1 hour 50 minutes for 75 marks, a 9702 Paper 4 is 2 hours for 100 marks, and 9708 Papers 2 and 4 each have two 20-mark essays.",
        "In Maths you also choose papers: AS is Pure 1 plus Pure 2, Mechanics or Statistics 1, and A Level adds Pure 3 and a second applied paper.",
      ],
      links: [
        { href: "/articles/a-level-maths-9709-paper-routes", label: "Which 9709 papers you sit" },
        { href: "/articles/a-level-physics-9702-paper-2-vs-paper-4", label: "9702 Paper 2 vs Paper 4" },
        { href: "/articles/a-level-economics-9708-essay-technique", label: "9708 essays and levels marking" },
      ],
    },
    {
      heading: "What carries over",
      paragraphs: [
        "The habits that worked at IGCSE still work: learn a topic, practise it with real questions, check against the mark scheme, then sit whole papers under time. The difference is depth. Command words like assess and evaluate ask for a judgement, and multi-step problems leave fewer marks for recall alone.",
        "If something from IGCSE is shaky, such as algebra for Maths and Physics or diagrams for Economics, fix it in the first weeks rather than waiting for it to cost marks later.",
      ],
    },
    {
      heading: "Start practising on PastPaperPrep",
      paragraphs: [
        "PastPaperPrep has banks for Maths 9709, Physics 9702, Chemistry 9701, Biology 9700 and Economics 9708, with real questions from 2020 to 2026 sorted by paper and topic. They sit beside the IGCSE banks you may already use, and an All Access plan covers both boards.",
      ],
      links: [
        { href: "/cambridge-a-level", label: "Cambridge A Level banks" },
        { href: "/cambridge-igcse", label: "Cambridge IGCSE banks" },
      ],
    },
    A_LEVEL_ACCESS,
  ],
  faqs: [
    { question: "Do I need Additional Maths 0606 for A Level Maths 9709?", answer: "No. The 9709 syllabus assumes IGCSE Maths 0580 Extended or O Level. 0606 helps, because much of it reappears in Pure 1." },
    { question: "Can I take A Level Physics after IGCSE Co-ordinated Sciences?", answer: "Yes. The 9702, 9701 and 9700 syllabuses all accept Co-ordinated Science as the background course." },
    { question: "Do I need IGCSE Economics for A Level Economics 9708?", answer: "No. The 9708 syllabus recommends maths to IGCSE Extended or O Level standard, not prior Economics." },
    { question: "Is A Level much harder than IGCSE?", answer: "The papers are longer, later papers build on earlier content, and more marks go to analysis and judgement, so expect a step up in depth." },
  ],
  relatedBanks: [
    { href: "/cambridge-a-level", label: "Cambridge A Level question banks" },
    { href: "/cambridge-igcse", label: "Cambridge IGCSE question banks" },
  ],
  sources: [SYLLABUS_9709, SYLLABUS_9702, SYLLABUS_9708],
};

export const A_LEVEL_GUIDES: readonly Article[] = [
  IGCSE_TO_A_LEVEL,
  MATHS_9709_ROUTES,
  MATHS_9709_PURE_1,
  PHYSICS_9702_P2_P4,
  ECONOMICS_9708_ESSAYS,
];
