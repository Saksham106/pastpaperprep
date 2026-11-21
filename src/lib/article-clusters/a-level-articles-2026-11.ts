import type { Article } from "@/lib/articles";
import { A_LEVEL_ACCESS } from "@/lib/article-clusters/a-level-guides-2026-11";

/**
 * Cambridge International AS & A Level articles added 2026-11-21: subject guides, technique, grade thresholds and
 * free-paper method. Syllabus facts come from the pinned syllabuses in research/a-level-scoping/sources (9701 and
 * 9700 2022–2024 and 2025–2027, 9709 2026–2027 v5, 9708 2026–2028 v2). Removed and newly named 9701/9700 content
 * comes from the content workspaces' 2019→2022 concordances, re-checked by term search against the 2022–2024 and
 * 2025–2027 syllabus text. Grade thresholds are Cambridge's June and November 2025 tables pinned in the content
 * workspaces (data/extras/*-gt.pdf). 9708 examiner-report figures are from Cambridge's June 2023 Principal Examiner
 * Report. Archive figures (question counts, mark shares) are from the production bank data on 2026-11-21.
 *
 * Explanation coverage: only 9709 Pure 1–3 have worked explanations, so nothing here claims more.
 */

const SYLLABUS_9701 = { href: "https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-international-as-and-a-level-chemistry-9701/", label: "Cambridge International: AS & A Level Chemistry 9701" };
const SYLLABUS_9700 = { href: "https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-international-as-and-a-level-biology-9700/", label: "Cambridge International: AS & A Level Biology 9700" };
const SYLLABUS_9709 = { href: "https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-international-as-and-a-level-mathematics-9709/", label: "Cambridge International: AS & A Level Mathematics 9709" };
const SYLLABUS_9702 = { href: "https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-international-as-and-a-level-physics-9702/", label: "Cambridge International: AS & A Level Physics 9702" };
const SYLLABUS_9708 = { href: "https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-international-as-and-a-level-economics-9708/", label: "Cambridge International: AS & A Level Economics 9708" };
const THRESHOLD_TABLES = { href: "https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-advanced/cambridge-international-as-and-a-levels/grade-threshold-tables/", label: "Cambridge International: AS & A Level grade threshold tables" };

const SCIENCE_PAPERS = {
  headings: ["Paper", "Time and marks", "Weighting"] as const,
  rows: [
    { label: "Paper 1 Multiple Choice", pastPaperPrep: "1 h 15 min, 40 marks", competitor: "31% of AS, 15.5% of A Level" },
    { label: "Paper 2 AS Level Structured Questions", pastPaperPrep: "1 h 15 min, 60 marks", competitor: "46% of AS, 23% of A Level" },
    { label: "Paper 3 Advanced Practical Skills", pastPaperPrep: "2 h, 40 marks", competitor: "23% of AS, 11.5% of A Level" },
    { label: "Paper 4 A Level Structured Questions", pastPaperPrep: "2 h, 100 marks", competitor: "38.5% of A Level" },
    { label: "Paper 5 Planning, Analysis and Evaluation", pastPaperPrep: "1 h 15 min, 30 marks", competitor: "11.5% of A Level" },
  ],
};

const CHEMISTRY_9701: Article = {
  draft: false,
  slug: "a-level-chemistry-9701-guide",
  title: "A Level Chemistry 9701: Papers, Topics and the 2022 Changes",
  description: "Cambridge A Level Chemistry 9701 explained: the five papers, the 37 topics, where Paper 2 and Paper 4 marks go, what changed in 2022, and how to practise.",
  eyebrow: "Cambridge A Level Chemistry 9701",
  answer: "AS Chemistry is Papers 1, 2 and 3; A Level adds Papers 4 and 5. The syllabus has 37 topics: AS covers 1 to 22, and A Level adds 23 to 37. Since 2022 there is no separate Data Booklet: each paper prints its own data table and Periodic Table. Paper 4 alone is 38.5% of the A Level, and transition elements took the most Paper 4 marks from 2022 to 2026.",
  answerLink: { href: "/banks/a-level-chemistry-9701", label: "Practise 9701 by paper" },
  publishedAt: "2026-11-21",
  updatedAt: "2026-11-21",
  readingMinutes: 6,
  comparison: { caption: "The five 9701 papers (2025–2027 syllabus)", ...SCIENCE_PAPERS },
  sections: [
    {
      heading: "How 9701 is assessed",
      paragraphs: [
        "AS Level is Papers 1, 2 and 3. A Level is all five. You can sit everything in one series, or take AS first and add Papers 4 and 5 later. Papers 1 and 2 test AS content. Paper 4 tests A Level content, and the syllabus says AS knowledge will be required.",
        "Papers 1, 2 and 4 split their marks evenly between knowledge with understanding (AO1) and handling information and solving problems (AO2). Papers 3 and 5 test experimental skills only (AO3). Paper 1 is 40 four-option multiple-choice questions in 1 hour 15 minutes.",
      ],
    },
    {
      heading: "The 37 topics",
      paragraphs: [
        "AS topics 1 to 22 run through physical chemistry (atomic structure to reaction kinetics), inorganic chemistry (periodicity, Group 2, Group 17, nitrogen and sulfur), organic chemistry (hydrocarbons to organic synthesis) and analytical techniques.",
        "A Level topics 23 to 37 return to the same areas in more depth: energetics, electrochemistry, equilibria and kinetics, Group 2, then a new topic on the chemistry of transition elements, more organic chemistry and analysis. Lattice energy and Born–Haber cycles sit in topic 23, at A Level.",
      ],
    },
    {
      heading: "Where the marks go",
      paragraphs: [
        "Across the 2022 to 2026 papers in our bank, Paper 2 marks leaned on chemical periodicity (14.0%), atomic structure (11.9%) and hydrocarbons (11.4%), then equilibria (9.0%) and carbonyl compounds (7.7%). In Paper 4, the chemistry of transition elements led clearly (19.4%), followed by A Level chemical energetics (12.5%), nitrogen compounds (10.6%) and equilibria (10.3%).",
        "Paper 1 is spread thin: no topic took more than 8% of its marks. Treat it as a test of the whole AS course rather than a few favourite topics. These are past patterns, not predictions.",
      ],
    },
    {
      heading: "What changed in 2022",
      paragraphs: [
        "The 2022–2024 syllabus was a full revision. The Data Booklet is no longer given with Papers 1, 2 and 4; instead every paper contains a data table of common constants and a Periodic Table, and any other data you need is printed in the question. Paper 1 lost its Section B, so it is now all standard four-option questions, and it grew by 15 minutes.",
        "Some content went and some became explicit. Fuel cells and rechargeable batteries, CFCs and the ozone layer, and enzymes as catalysts no longer appear in the syllabus. Percentage yield and limiting reagents, the Boltzmann distribution, and thin-layer and gas chromatography terms are now named outcomes. The 2025–2027 syllabus only updates the reagents in 15.1(c) and 16.2(b).",
      ],
    },
    {
      heading: "Are 2020 and 2021 papers still useful?",
      paragraphs: [
        "Yes, for most questions. The bank tags the few 2020 and 2021 questions on removed content with named earlier-syllabus topics, so you can skip them. Watch for older AS questions on content that has since moved to A Level, such as lattice energy: the bank files those under the current A Level topic.",
      ],
    },
    {
      heading: "How to practise",
      paragraphs: [
        "The 9701 bank has 2,220 questions from 123 papers, 2020 to 2026: 1,720 Paper 1 multiple-choice questions, 201 Paper 2 and 299 Paper 4 structured questions, sorted by paper and topic. Each shows Cambridge's mark scheme. Repair one topic, then sit a whole Paper 2 or Paper 4 against the clock.",
        "Papers 3 and 5, the practical and planning papers, aren't in the bank or the free archive. Prepare for those through your school's practical work and Cambridge's own materials.",
      ],
      links: [
        { href: "/banks/a-level-chemistry-9701?topic=Chemistry%20of%20transition%20elements", label: "Transition elements questions" },
        { href: "/past-papers/a-level-chemistry-9701/paper-4", label: "Free Paper 4 whole papers" },
        { href: "/articles/a-level-grade-thresholds-explained", label: "What score gets an A in 9701" },
      ],
    },
    A_LEVEL_ACCESS,
  ],
  faqs: [
    { question: "Is a data booklet given in 9701 exams?", answer: "Not since 2022. Each paper includes a data table of common constants and a Periodic Table, and other data you need is given in the question." },
    { question: "How many topics are in A Level Chemistry 9701?", answer: "37. AS students study topics 1 to 22, and A Level students study all 37." },
    { question: "How long is 9701 Paper 1?", answer: "1 hour 15 minutes for 40 multiple-choice questions. It grew by 15 minutes in 2022 when Section B was removed." },
    { question: "Does PastPaperPrep have 9701 Paper 3 and Paper 5?", answer: "No. The bank and free archive cover Papers 1, 2 and 4." },
  ],
  relatedBanks: [
    { href: "/banks/a-level-chemistry-9701", label: "A Level Chemistry 9701 past papers by topic" },
    { href: "/syllabus/a-level-chemistry-9701", label: "9701 course guide" },
    { href: "/articles/igcse-to-a-level-guide", label: "IGCSE to A Level: what changes" },
  ],
  sources: [SYLLABUS_9701],
};

const BIOLOGY_9700: Article = {
  draft: false,
  slug: "a-level-biology-9700-guide",
  title: "A Level Biology 9700: Papers, Topics and the 2022 Changes",
  description: "Cambridge A Level Biology 9700 explained: the five papers, the 19 topics, which formulae are given, what changed in 2022, and how to practise.",
  eyebrow: "Cambridge A Level Biology 9700",
  answer: "AS Biology is Papers 1, 2 and 3; A Level adds Papers 4 and 5. There are 19 topics: AS covers 1 to 11, from cell structure to immunity, and A Level adds 12 to 19, from respiration to genetic technology. Formulae for statistical tests such as chi-squared and the t-test are given in the exam. Paper 4 is 38.5% of the A Level, and its marks spread almost evenly across all eight A Level topics.",
  answerLink: { href: "/banks/a-level-biology-9700", label: "Practise 9700 by paper" },
  publishedAt: "2026-11-21",
  updatedAt: "2026-11-21",
  readingMinutes: 6,
  comparison: { caption: "The five 9700 papers (2025–2027 syllabus)", ...SCIENCE_PAPERS },
  sections: [
    {
      heading: "How 9700 is assessed",
      paragraphs: [
        "AS Level is Papers 1, 2 and 3; A Level is all five, in one series or with AS first. Papers 1 and 2 test AS content. Paper 4 tests A Level content and, in the syllabus's words, knowledge of AS material will be required. Since 2022, Paper 4 has no optional section: you answer every question.",
        "Papers 1, 2 and 4 split marks evenly between knowledge with understanding (AO1) and handling information and solving problems (AO2). Papers 3 and 5 test experimental skills (AO3).",
      ],
    },
    {
      heading: "The 19 topics",
      paragraphs: [
        "AS topics 1 to 11: cell structure, biological molecules, enzymes, cell membranes and transport, the mitotic cell cycle, nucleic acids and protein synthesis, transport in plants, transport in mammals, gas exchange, infectious diseases and immunity.",
        "A Level topics 12 to 19: energy and respiration, photosynthesis, homeostasis, control and coordination, inheritance, selection and evolution, classification, biodiversity and conservation, and genetic technology.",
      ],
    },
    {
      heading: "Formulae you are given",
      paragraphs: [
        "The syllabus says these formulae will be provided, so learn when and how to use each one rather than memorising it:",
      ],
      bullets: [
        "The chi-squared test, for observed against expected results in genetic crosses.",
        "The t-test, to compare the means of two samples.",
        "The two Hardy–Weinberg equations, for allele and genotype frequencies.",
        "The Lincoln index, for mark-release-recapture.",
        "Spearman's rank and Pearson's correlation, and Simpson's index of diversity.",
      ],
    },
    {
      heading: "Where the marks go",
      paragraphs: [
        "Across the 2022 to 2026 papers in our bank, Paper 1 leaned on biological molecules (15.3% of marks) and cell structure (14.5%). Paper 2 marks went most to transport in mammals (15.3%), then immunity (10.9%) and enzymes (10.3%).",
        "Paper 4 is the most even paper we have counted. Homeostasis led with 15.4%, and the smallest share, photosynthesis, still took 11.2%. No A Level topic is safe to skip. These are past patterns, not predictions.",
      ],
    },
    {
      heading: "What changed in 2022",
      paragraphs: [
        "The 2022–2024 syllabus added 15 minutes to Paper 1 and removed Section B from Paper 4. Some content went: the effects of smoking, myasthenia gravis, C4 plants and the menstrual cycle hormones no longer appear in the syllabus. Some became explicit, including gene editing, the chloride shift and the Lincoln index.",
        "The 2025–2027 syllabus made only small changes: an addition to the Paper 3 materials list and one to the command words. The bank tags 2020 and 2021 questions on removed content with named earlier-syllabus topics, so you can skip them.",
      ],
    },
    {
      heading: "How to practise",
      paragraphs: [
        "The 9700 bank has 2,680 questions from 141 papers, 2020 to 2026: 1,957 Paper 1 multiple-choice questions, 294 Paper 2 and 429 Paper 4 structured questions, sorted by paper and topic, each with Cambridge's mark scheme. Biology marks reward precise terms, so compare your wording with the mark scheme line by line.",
        "Papers 3 and 5 aren't in the bank or the free archive; practise those through school practical work and Cambridge's own materials.",
      ],
      links: [
        { href: "/banks/a-level-biology-9700?topic=Homeostasis", label: "Homeostasis questions" },
        { href: "/past-papers/a-level-biology-9700/paper-4", label: "Free Paper 4 whole papers" },
        { href: "/articles/a-level-grade-thresholds-explained", label: "What score gets an A in 9700" },
      ],
    },
    A_LEVEL_ACCESS,
  ],
  faqs: [
    { question: "How many topics are in A Level Biology 9700?", answer: "19. AS students study topics 1 to 11, and A Level students study all 19." },
    { question: "Is the chi-squared formula given in 9700?", answer: "Yes. The syllabus says the chi-squared formula is provided, as are the t-test, Hardy–Weinberg equations, Lincoln index, correlation formulae and Simpson's index." },
    { question: "Does 9700 Paper 4 have optional questions?", answer: "No. Section B was removed in 2022, so candidates answer all questions." },
    { question: "Does PastPaperPrep have 9700 Paper 3 and Paper 5?", answer: "No. The bank and free archive cover Papers 1, 2 and 4." },
  ],
  relatedBanks: [
    { href: "/banks/a-level-biology-9700", label: "A Level Biology 9700 past papers by topic" },
    { href: "/syllabus/a-level-biology-9700", label: "9700 course guide" },
    { href: "/articles/igcse-to-a-level-guide", label: "IGCSE to A Level: what changes" },
  ],
  sources: [SYLLABUS_9700],
};

const MATHS_9709_APPLIED: Article = {
  draft: false,
  slug: "a-level-maths-9709-mechanics-vs-statistics",
  title: "A Level Maths 9709 Mechanics vs Statistics: Paper 4, 5 or 6?",
  description: "Cambridge 9709 Mechanics (Paper 4), Statistics 1 (Paper 5) and Statistics 2 (Paper 6) compared: what each tests, where the marks go, and how to choose.",
  eyebrow: "Cambridge A Level Mathematics 9709",
  answer: "Statistics 1 (Paper 5) is in every A Level route, so the real A Level choice is Mechanics (Paper 4) or Statistics 2 (Paper 6). Mechanics needs only Pure 1 calculus and suits Physics students. Statistics 2 builds on Statistics 1 and Pure 3 calculus. All three are 1 hour 15 minutes for 50 marks. At AS, you pair Pure 1 with Mechanics or Statistics 1.",
  answerLink: { href: "/banks/a-level-maths-9709", label: "Practise 9709 by paper" },
  publishedAt: "2026-11-21",
  updatedAt: "2026-11-21",
  readingMinutes: 5,
  comparison: {
    caption: "9709 applied papers: topics with the most marks, 2020–2026",
    headings: ["Paper", "Builds on", "Most marks in our bank"],
    rows: [
      { label: "Paper 4 Mechanics", pastPaperPrep: "Pure 1; calculus limited to Pure 1", competitor: "Straight-line kinematics 38.0%, forces and equilibrium 20.6%, energy, work and power 20.0%" },
      { label: "Paper 5 Probability & Statistics 1", pastPaperPrep: "Pure 1; mainly numerical", competitor: "Normal distribution 26.0%, discrete random variables 21.5%, permutations and combinations 19.5%" },
      { label: "Paper 6 Probability & Statistics 2", pastPaperPrep: "Statistics 1, plus Pure 3 calculus", competitor: "Hypothesis tests 27.6%, Poisson distribution 23.6%, continuous random variables 17.6%" },
    ],
  },
  sections: [
    {
      heading: "Where the choice actually is",
      paragraphs: [
        "AS Maths is Pure 1 plus one more paper: Pure 2, Mechanics or Statistics 1. Pure 1 with Pure 2 can't count towards A Level, so if you might continue, the AS choice is Mechanics or Statistics 1.",
        "A Level is Pure 1, Pure 3 and Statistics 1, plus either Mechanics or Statistics 2. Mechanics with Statistics 2 isn't allowed, because Paper 6 depends on Paper 5. Your school usually decides the route, so check before you choose what to revise.",
      ],
      links: [{ href: "/articles/a-level-maths-9709-paper-routes", label: "Every 9709 route explained" }],
    },
    {
      heading: "Paper 4 Mechanics",
      paragraphs: [
        "Five topics: forces and equilibrium, straight-line kinematics, momentum, Newton's laws, and energy, work and power. Calculus is limited to Pure 1 techniques, vector notation is not used in the questions, and bodies are treated as particles.",
        "Kinematics carries the most weight: 38.0% of Paper 4 marks across the 46 papers from 2020 to 2026 in our bank, Momentum took only 5.6%. If you study Physics 9702, the AS topics on kinematics, dynamics, forces and work overlap heavily.",
      ],
    },
    {
      heading: "Paper 5 Statistics 1",
      paragraphs: [
        "Five topics: representation of data, permutations and combinations, probability, discrete random variables and the normal distribution. Questions are mainly numerical and need no algebra beyond Pure 1. The normal distribution took the largest share, 26.0% of marks across 46 papers.",
        "Because Paper 5 is in every A Level route, it is worth securing early. It is also the foundation for Paper 6.",
      ],
    },
    {
      heading: "Paper 6 Statistics 2",
      paragraphs: [
        "Five topics: the Poisson distribution, linear combinations of random variables, continuous random variables, sampling and estimation, and hypothesis tests. The syllabus assumes Statistics 1 and the calculus from Pure 3, which continuous random variables use directly.",
        "Hypothesis tests (27.6%) and the Poisson distribution (23.6%) took over half the marks across the 40 Paper 6 papers in our bank. Paper 6 suits students who are comfortable with Pure 3 integration and enjoyed Statistics 1.",
      ],
    },
    {
      heading: "Does the route change the grade boundary?",
      paragraphs: [
        "Barely. In June 2025, variant 2 of both A Level routes needed 224 of 250 for an A* and 198 for an A. In other variants the two routes differed by a few marks. Pick the route that fits your strengths, not one you think is graded more kindly.",
      ],
      links: [{ href: "/articles/a-level-grade-thresholds-explained", label: "How 9709 grade thresholds work" }],
    },
    {
      heading: "How to practise",
      paragraphs: [
        "The 9709 bank has separate Mechanics, Stats 1 and Stats 2 tabs: 321 Paper 4, 307 Paper 5 and 272 Paper 6 questions from 2020 to 2026, each with Cambridge's mark scheme. Worked explanations in the bank cover Pure 1, Pure 2 and Pure 3 only, so use the mark scheme to review applied questions.",
      ],
      links: [
        { href: "/banks/a-level-maths-9709?topic=Kinematics%20of%20motion%20in%20a%20straight%20line", label: "Mechanics kinematics questions" },
        { href: "/banks/a-level-maths-9709?topic=The%20normal%20distribution", label: "Statistics 1 normal distribution questions" },
        { href: "/past-papers/a-level-maths-9709/paper-4", label: "Free Paper 4 whole papers" },
        { href: "/past-papers/a-level-maths-9709/paper-5", label: "Free Paper 5 whole papers" },
      ],
    },
    A_LEVEL_ACCESS,
  ],
  faqs: [
    { question: "Is Statistics 1 compulsory for A Level Maths 9709?", answer: "Yes. Both A Level combinations, Papers 1, 3, 4 and 5 or Papers 1, 3, 5 and 6, include Paper 5." },
    { question: "Can I take Mechanics and Statistics 2 for 9709?", answer: "No. Paper 6 depends on Paper 5, so the syllabus does not allow Papers 4 and 6 together." },
    { question: "Is 9709 Mechanics easier than Statistics?", answer: "Neither is easier in general. Mechanics uses only Pure 1 calculus and overlaps with Physics; Statistics 2 needs Pure 3 calculus. Grade boundaries for the two A Level routes were within a few marks in June 2025." },
    { question: "Which 9709 applied topic has the most marks?", answer: "In our bank's 2020 to 2026 papers: straight-line kinematics in Paper 4 (38.0%), the normal distribution in Paper 5 (26.0%) and hypothesis tests in Paper 6 (27.6%)." },
  ],
  relatedBanks: [
    { href: "/banks/a-level-maths-9709", label: "A Level Maths 9709 past papers by topic" },
    { href: "/syllabus/a-level-maths-9709", label: "9709 course guide" },
  ],
  sources: [SYLLABUS_9709, THRESHOLD_TABLES],
};

const ECONOMICS_9708_MCQ: Article = {
  draft: false,
  slug: "a-level-economics-9708-multiple-choice",
  title: "A Level Economics 9708 Multiple Choice: How to Score on Papers 1 and 3",
  description: "How Cambridge 9708 Papers 1 and 3 work, which topics carry the questions, the traps examiners report most often, and a routine for 30 questions.",
  eyebrow: "Cambridge A Level Economics 9708",
  answer: "9708 has two 30-question multiple-choice papers: Paper 1 (AS, 1 hour) and Paper 3 (A Level, 1 hour 15 minutes). Together they are 34% of the A Level. Examiner reports show the same traps every year: elasticity and total revenue, and short-run versus long-run cost conditions. Work each answer before reading the options, and practise by topic until those ideas are automatic.",
  answerLink: { href: "/banks/a-level-economics-9708", label: "Practise 9708 multiple choice" },
  publishedAt: "2026-11-21",
  updatedAt: "2026-11-21",
  readingMinutes: 6,
  comparison: {
    caption: "9708 multiple-choice papers (2026–2028 syllabus)",
    headings: ["", "Paper 1", "Paper 3"],
    rows: [
      { label: "Level", pastPaperPrep: "AS Level", competitor: "A Level, with AS content assumed" },
      { label: "Time and questions", pastPaperPrep: "1 hour, 30 questions", competitor: "1 hour 15 minutes, 30 questions" },
      { label: "Time per question", pastPaperPrep: "2 minutes", competitor: "2.5 minutes" },
      { label: "Weighting", pastPaperPrep: "33% of AS, 17% of A Level", competitor: "17% of A Level" },
      { label: "Most questions, 2023–2026", pastPaperPrep: "Price system and microeconomy (21%)", competitor: "A Level price system and microeconomy (29%)" },
    ],
  },
  sections: [
    {
      heading: "How the papers work",
      paragraphs: [
        "Both papers have 30 compulsory questions, one mark each. Paper 1 tests AS content. Paper 3 tests A Level content and treats AS content as assumed knowledge. Calculators are allowed, and no formulae are given.",
        "Multiple choice is not just recall. In the syllabus, 47% of these papers' marks are knowledge and understanding, 40% analysis and 13% evaluation, so expect questions where you read a table or diagram and work something out.",
      ],
    },
    {
      heading: "Which topics carry the questions",
      paragraphs: [
        "In the 2023 to 2026 Paper 1s in our bank, the price system and the microeconomy had the most questions (21%), then international economic issues (19%), the macroeconomy (18%) and basic economic ideas (17%). No AS topic had fewer than 10%.",
        "Paper 3 is more concentrated. A Level price system and microeconomy took 29% of questions, led by externalities, costs and market structures. Then came the macroeconomy (20%), international issues (19%) and government microeconomic intervention (18%).",
      ],
    },
    {
      heading: "The traps examiners keep reporting",
      paragraphs: [
        "Cambridge's June 2023 examiner report gives the share of candidates choosing each answer. On one AS paper, almost half the questions were answered correctly by fewer than half the candidates. The same few ideas cause most of the damage:",
      ],
      bullets: [
        "Elasticity and total revenue. Only 24% and 27% answered two such AS questions correctly; on one, 36% chose a partly true option that ignored elasticity.",
        "Short run versus long run. In the short run a firm must cover variable cost; in the long run, all costs. Three A Level variants tested this, and only 23% to 31% got it right.",
        "Marginal and average cost. Average variable cost falls whenever marginal cost is below it, even if marginal cost is rising. 38% answered correctly.",
        "Pareto improvements. One person better off and nobody worse off: 42% picked a change that left one consumer worse off.",
      ],
    },
    {
      heading: "A routine for 30 questions",
      bullets: [
        "Underline the condition in the stem: short run or long run, elastic or inelastic, real or nominal, ceteris paribus.",
        "Work out your answer before reading the options, so a plausible distractor can't lead you.",
        "On diagram questions, label the areas or points yourself before matching them to the options.",
        "Check a tempting option against the exact question. A statement can be true and still not answer it.",
        "Don't hunt for patterns in the answer letters. In our bank, Paper 1 keys split 22%, 26%, 27% and 25% across A to D.",
      ],
      paragraphs: [
        "With 2 minutes a question on Paper 1 and 2.5 on Paper 3, move on from a question that stalls and come back at the end.",
      ],
    },
    {
      heading: "How many marks is an A?",
      paragraphs: [
        "In June 2025, 23 of 30 was the A boundary on both Paper 12 and Paper 32. Boundaries move between series and variants, so treat that as a rough guide when you score a practice paper.",
      ],
      links: [{ href: "/articles/a-level-grade-thresholds-explained", label: "How A Level grade thresholds work" }],
    },
    {
      heading: "Practise by topic, then by paper",
      paragraphs: [
        "The 9708 bank has 2,752 multiple-choice questions from 2020 to 2026: 1,492 from Paper 1 and 1,260 from Paper 3, sorted by topic with the answer key. The syllabus changed in 2023, so papers from 2020 to 2022 are tagged to the earlier syllabus; most of their questions still test current content.",
        "Drill one topic until the traps above stop catching you, then sit a full paper in time. Most free Paper 1 and Paper 3 pages support self-marking.",
      ],
      links: [
        { href: "/banks/a-level-economics-9708?topic=The%20price%20system%20and%20the%20microeconomy", label: "AS price system questions" },
        { href: "/past-papers/a-level-economics-9708/paper-1", label: "Free Paper 1 whole papers" },
        { href: "/past-papers/a-level-economics-9708/paper-3", label: "Free Paper 3 whole papers" },
        { href: "/articles/a-level-economics-9708-essay-technique", label: "9708 essays and levels marking" },
      ],
    },
    A_LEVEL_ACCESS,
  ],
  faqs: [
    { question: "How many questions are in 9708 Paper 1?", answer: "30 multiple-choice questions in 1 hour. Paper 3 also has 30, in 1 hour 15 minutes." },
    { question: "How much of 9708 A Level is multiple choice?", answer: "34%: Paper 1 and Paper 3 are 17% each." },
    { question: "Are formulae given in 9708 multiple choice?", answer: "No. Calculators are allowed, but the syllabus says formulae are not given in the question papers." },
    { question: "What do students get wrong most in 9708 multiple choice?", answer: "Cambridge's June 2023 examiner report highlights elasticity and total revenue, short-run versus long-run cost conditions, marginal and average cost, and Pareto improvements." },
  ],
  relatedBanks: [
    { href: "/banks/a-level-economics-9708", label: "A Level Economics 9708 past papers by topic" },
    { href: "/syllabus/a-level-economics-9708", label: "9708 course guide" },
  ],
  sources: [SYLLABUS_9708, THRESHOLD_TABLES],
};

const GRADE_THRESHOLDS: Article = {
  draft: false,
  slug: "a-level-grade-thresholds-explained",
  title: "Cambridge A Level Grade Thresholds Explained (9709, 9702, 9701, 9700, 9708)",
  description: "How Cambridge AS & A Level grade thresholds work, what an A* took in June 2025 in Maths, Physics, Chemistry, Biology and Economics, and how to use them.",
  eyebrow: "Cambridge A Level grade thresholds",
  answer: "A grade threshold is the minimum mark Cambridge sets for each grade after marking, for every paper and every series. A* exists only for the whole A Level, not for single papers. In June 2025, an A* took 224 of 250 in Maths 9709, 203 of 260 in Physics 9702, 206 in Chemistry 9701, 188 in Biology 9700 and 120 of 180 in Economics 9708, on the variant 2 papers.",
  answerLink: { href: "/past-papers/a-level", label: "Score a free A Level paper" },
  publishedAt: "2026-11-21",
  updatedAt: "2026-11-21",
  readingMinutes: 6,
  comparison: {
    caption: "June 2025 A Level thresholds, variant 2 papers",
    headings: ["Subject (papers)", "A* / A", "E"],
    rows: [
      { label: "Maths 9709 (12, 32, 42, 52)", pastPaperPrep: "224 / 198 of 250", competitor: "72" },
      { label: "Maths 9709 (12, 32, 52, 62)", pastPaperPrep: "224 / 198 of 250", competitor: "59" },
      { label: "Physics 9702 (12, 22, 33, 42, 52)", pastPaperPrep: "203 / 178 of 260", competitor: "78" },
      { label: "Chemistry 9701 (12, 22, 33, 42, 52)", pastPaperPrep: "206 / 174 of 260", competitor: "68" },
      { label: "Biology 9700 (12, 22, 33, 42, 52)", pastPaperPrep: "188 / 163 of 260", competitor: "74" },
      { label: "Economics 9708 (12, 22, 32, 42)", pastPaperPrep: "120 / 107 of 180", competitor: "60" },
    ],
  },
  sections: [
    {
      heading: "What a threshold is",
      paragraphs: [
        "Cambridge defines a grade threshold as the minimum number of marks needed for a grade. Thresholds are set after each series is marked, separately for every paper, so they absorb differences in difficulty between papers and years.",
        "Each table has two parts. The first lists every component with its maximum raw mark and the minimum for A to E. The second gives the overall thresholds for each combination of components. A* appears only in the second part: Cambridge says grade A* does not exist for an individual component.",
      ],
    },
    {
      heading: "Reading component codes",
      paragraphs: [
        "A component code is the paper number followed by the variant. Component 42 is Paper 4, variant 2. In May/June most subjects sit variants 1, 2 and 3, which are different papers with their own thresholds.",
        "The overall table lists options: one code per combination of components. In June 2025, Physics option AY meant components 12, 22, 33, 42 and 52. Find the row that matches the papers you sat, or the papers you practised.",
      ],
    },
    {
      heading: "Why the totals are 250, 260 and 180",
      paragraphs: [
        "Overall thresholds use the maximum mark after weighting. In Maths 9709 that is just the raw total: 75 + 75 + 50 + 50 = 250 for A Level, and 125 for AS. Economics 9708 is also a raw total: 180 for A Level and 90 for AS.",
        "The sciences are weighted. Their raw marks add up to 270, but the A Level total is 260, which matches the syllabus weightings once Paper 3's 40 raw marks count as 30. AS is out of 130.",
      ],
    },
    {
      heading: "Thresholds move between series",
      paragraphs: [
        "The same Maths combination (12, 32, 42, 52) needed 224 for an A* in June 2025 and 205 in November 2025. Chemistry moved from 206 to 199, Physics from 203 to 201, Biology from 188 to 191 and Economics from 120 to 124. A paper that is harder than usual gets a lower threshold, and an easier one a higher threshold.",
        "That is why no fixed percentage guarantees a grade. Compare like with like: the same paper, same variant, same series.",
      ],
    },
    {
      heading: "AS thresholds, June 2025",
      paragraphs: [
        "On the variant 2 AS options, an A took 99 of 125 in Maths with Pure 2 and 100 with Statistics 1, 97 of 130 in Physics, 83 of 130 in Chemistry, 85 of 130 in Biology and 49 of 90 in Economics. AS grades run from a to e; there is no a*.",
      ],
    },
    {
      heading: "Using thresholds with past papers",
      paragraphs: [
        "When you mark a practice paper, compare your score with that paper's own component thresholds, not a general rule. For example, an A on 9709 component 12 in June 2025 was 61 of 75, and on 9702 component 42 it was 60 of 100.",
        "Treat the result as a rough reading. One paper is a small sample, and a timed sitting at home isn't exam conditions. Track your score by topic over several papers, and spend most of your time on the topics that keep losing marks.",
      ],
      links: [
        { href: "/past-papers/a-level", label: "Free A Level past papers" },
        { href: "/articles/free-cambridge-a-level-past-papers-by-topic", label: "Using A Level past papers by topic" },
      ],
    },
    A_LEVEL_ACCESS,
  ],
  faqs: [
    { question: "What is the A* threshold for 9709 Maths?", answer: "In June 2025 it was 224 of 250 on the variant 2 papers for both A Level routes, and 205 for Papers 12, 32, 42 and 52 in November 2025. It changes every series." },
    { question: "Is there an A* for a single A Level paper?", answer: "No. Cambridge says A* does not exist at the level of an individual component; it is awarded on the overall A Level total." },
    { question: "Why is the science A Level total 260 and not 270?", answer: "The overall threshold uses marks after weighting. Matching the syllabus weightings, Paper 3's 40 raw marks count as 30." },
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

const FREE_PAPERS_BY_TOPIC: Article = {
  draft: false,
  slug: "free-cambridge-a-level-past-papers-by-topic",
  title: "Free Cambridge A Level Past Papers by Topic: Where to Find Them and How to Use Them",
  description: "Where to get free Cambridge AS & A Level past papers and mark schemes for 9709, 9702, 9701, 9700 and 9708, and a plan for using them topic by topic.",
  eyebrow: "Cambridge A Level revision method",
  answer: "Free Cambridge A Level papers and mark schemes are on Cambridge's own subject pages (a selection), on archive sites, and on PastPaperPrep, which has 911 whole papers for 9709, 9702, 9701, 9700 and 9708 from 2020 to 2026 with no account. Use whole papers to find weak topics, practise those topics with real questions, then return to timed papers.",
  answerLink: { href: "/past-papers/a-level", label: "Open free A Level papers" },
  publishedAt: "2026-11-21",
  updatedAt: "2026-11-21",
  readingMinutes: 6,
  comparison: {
    caption: "PastPaperPrep's free A Level archive, 2020–2026",
    headings: ["Subject", "Whole papers", "Papers covered"],
    rows: [
      { label: "Mathematics 9709", pastPaperPrep: "276", competitor: "Papers 1 to 6" },
      { label: "Physics 9702", pastPaperPrep: "147", competitor: "Papers 1, 2 and 4" },
      { label: "Chemistry 9701", pastPaperPrep: "147", competitor: "Papers 1, 2 and 4" },
      { label: "Biology 9700", pastPaperPrep: "144", competitor: "Papers 1, 2 and 4" },
      { label: "Economics 9708", pastPaperPrep: "197", competitor: "Papers 1 to 4" },
    ],
  },
  sections: [
    {
      heading: "Where the free papers are",
      paragraphs: [
        "Cambridge's subject pages publish a selection of recent papers, mark schemes and examiner reports; registered schools get wider access through Cambridge's School Support Hub. Archive sites such as PapaCambridge and Physics & Maths Tutor list many more years as downloadable PDFs.",
        "PastPaperPrep's archive opens each paper beside its mark scheme in the browser, with a timer, and supported papers can be self-marked. For the sciences it covers Papers 1, 2 and 4; the practical Papers 3 and 5 aren't included.",
      ],
      links: [
        { href: "/past-papers/a-level-maths-9709", label: "9709 whole papers" },
        { href: "/past-papers/a-level-physics-9702", label: "9702 whole papers" },
        { href: "/past-papers/a-level-chemistry-9701", label: "9701 whole papers" },
        { href: "/past-papers/a-level-biology-9700", label: "9700 whole papers" },
        { href: "/past-papers/a-level-economics-9708", label: "9708 whole papers" },
        { href: "/articles/best-cambridge-a-level-past-paper-websites", label: "Compare A Level past paper websites" },
      ],
    },
    {
      heading: "Match the paper to what you sit",
      paragraphs: [
        "A file name like 9701_s25_qp_42 means Chemistry, May/June 2025, question paper, Paper 4 variant 2. Pair it with 9701_s25_ms_42, not another variant: variants are different papers. May/June usually has three variants and February/March one.",
        "In Maths, practise only the papers in your route. In the sciences and Economics, AS students need Papers 1 and 2 (and the practical, Paper 3, in the sciences); A Level adds the rest.",
      ],
      links: [{ href: "/articles/a-level-maths-9709-paper-routes", label: "Which 9709 papers you sit" }],
    },
    {
      heading: "Check the syllabus year",
      paragraphs: [
        "Older papers can test content that has since gone. The sciences were revised for 2022 and Economics for 2023, so 2020 and 2021 science papers, and 2020 to 2022 Economics papers, include some questions you can skip. Maths 9709 is unchanged since 2020.",
      ],
      links: [
        { href: "/articles/a-level-chemistry-9701-guide", label: "What changed in 9701" },
        { href: "/articles/a-level-biology-9700-guide", label: "What changed in 9700" },
        { href: "/articles/a-level-physics-9702-paper-2-vs-paper-4", label: "What changed in 9702" },
      ],
    },
    {
      heading: "A plan that uses papers by topic",
      bullets: [
        "Sit one recent paper under time to see where you stand.",
        "Mark it and list each lost mark by topic and by cause: knowledge, method, wording or time.",
        "Pick the two topics that cost the most and practise 6 to 10 real questions on each.",
        "Mark against the mark scheme line by line, and redo anything you got wrong a few days later.",
        "Sit another whole paper and compare topic by topic, not just the total.",
      ],
      paragraphs: [
        "Topic practice repairs a gap; a whole paper tests whether the repair holds when the topic isn't labelled. Alternate them through the year, and save the newest papers for timed mocks near the exam.",
      ],
    },
    {
      heading: "Practise by topic on PastPaperPrep",
      paragraphs: [
        "The A Level banks hold every question from those papers, sorted by paper and topic: 2,118 in Maths, 2,627 in Physics, 2,220 in Chemistry, 2,680 in Biology and 3,207 in Economics. Questions from 2020 and 2021 are free to practise; in the sciences those years predate the 2022 syllabus, so check the earlier-syllabus tags.",
        "Every question shows Cambridge's mark scheme. Worked explanations so far cover 9709 Pure 1, Pure 2 and Pure 3 only.",
      ],
      links: [
        { href: "/cambridge-a-level", label: "All A Level question banks" },
        { href: "/articles/a-level-grade-thresholds-explained", label: "Turn a paper score into a grade" },
      ],
    },
    A_LEVEL_ACCESS,
  ],
  faqs: [
    { question: "Where can I get free Cambridge A Level past papers?", answer: "Cambridge publishes a selection on each subject page. Archive sites list more years as PDFs, and PastPaperPrep has 911 free whole papers with mark schemes for 9709, 9702, 9701, 9700 and 9708, 2020 to 2026, without an account." },
    { question: "What do 11, 12 and 13 mean on Cambridge papers?", answer: "The paper number and variant: 12 is Paper 1, variant 2. Variants are different papers, each with its own mark scheme and thresholds." },
    { question: "Are A Level past papers from 2020 still useful?", answer: "Yes for most questions. Skip content removed in the 2022 science revisions or the 2023 Economics syllabus; 9709 Maths has not changed." },
    { question: "Does PastPaperPrep have the science practical papers?", answer: "No. It covers Papers 1, 2 and 4 for 9702, 9701 and 9700." },
  ],
  relatedBanks: [
    { href: "/cambridge-a-level", label: "Cambridge A Level question banks" },
  ],
  sources: [SYLLABUS_9709, SYLLABUS_9702, SYLLABUS_9701, SYLLABUS_9700, SYLLABUS_9708],
};

/*
 * Competitor pages below were checked on 21 November 2026 (headless fetches, no logins). Notes with URLs and quotes:
 * side-session-notes/local_d4de1a99…/a-level-competitor-checks-2026-11-21.md. Save My Exams plan prices are left out
 * because the visible plan cards render client-side and couldn't be confirmed; ZNotes note content couldn't be read.
 */
const SME_PLANS = { href: "https://www.savemyexams.com/learning-hub/support/why-pay-for-save-my-exams/", label: "Save My Exams: Free, Essential and Premium" };
const SME_CIE_MATHS = { href: "https://www.savemyexams.com/a-level/maths/cie/20/", label: "Save My Exams: CIE A Level Maths" };
const SME_CIE_PAPERS = { href: "https://www.savemyexams.com/a-level/maths/cie/past-papers/", label: "Save My Exams: CIE A Level Maths past papers" };
const SME_CIE_ECON = { href: "https://www.savemyexams.com/a-level/economics/cie/23/", label: "Save My Exams: CIE A Level Economics" };
const PMT_9709 = { href: "https://www.physicsandmathstutor.com/a-level-maths-papers/cie-paper-1/", label: "Physics & Maths Tutor: CAIE Pure 1 (9709) papers" };
const PMT_9702 = { href: "https://www.physicsandmathstutor.com/past-papers/a-level-physics/cie-paper-1/", label: "Physics & Maths Tutor: CAIE Physics 9702 Paper 1" };
const PMT_9708 = { href: "https://www.physicsandmathstutor.com/past-papers/a-level-economics/cie-paper-1/", label: "Physics & Maths Tutor: CAIE Economics 9708 Paper 1" };
const PAPA_DIRECTORY = { href: "https://pastpapers.papacambridge.com/papers/caie/as-and-a-level", label: "PapaCambridge: CAIE AS & A Level past papers" };
const PAPA_9709 = { href: "https://pastpapers.papacambridge.com/papers/caie/as-and-a-level-mathematics-9709", label: "PapaCambridge: Mathematics 9709" };
const PAPA_TOPICAL = { href: "https://papacambridge.com/category/past-papers/unsolved-past-papers/topical-past-papers-unsolved-past-papers/caie-topical-past-papers-unsolved-past-papers/as-a-level-caie-topical-past-papers-unsolved-past-papers/", label: "PapaCambridge shop: AS & A Level topical papers" };
const PAPA_SOLVED = { href: "https://papacambridge.com/category/past-papers/solved-past-papers/yearly-past-papers-solved-past-papers/caie-yearly-past-papers-solved-past-papers/as-a-level-caie-yearly-past-papers-solved-past-papers/", label: "PapaCambridge shop: AS & A Level solved papers" };
const EXAM_MATE_PRICING = { href: "https://www.exam-mate.com/topicalpastpapers/pricing", label: "Exam-Mate: topical pricing" };
const EXAM_MATE_9700 = { href: "https://www.exam-mate.com/topicalpastpapers/CIE%20A-Level-5/Biology(9700)-47", label: "Exam-Mate: CIE A Level topical questions" };
const TUTORCHASE_CIE = { href: "https://www.tutorchase.com/resources/a-level", label: "TutorChase: A Level resources" };
const CAMBRIDGE_9701_PAPERS = { href: "https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-international-as-and-a-level-chemistry-9701/past-papers/", label: "Cambridge International: 9701 past papers (a selection)" };
const MATHSGENIE_A_LEVEL = { href: "https://mathsgenie.co.uk/a-level/maths", label: "MathsGenie: A Level Maths" };
const PPP_PRICING = { href: "https://pastpaperprep.com/pricing", label: "PastPaperPrep pricing" };

const BEST_A_LEVEL_SITES: Article = {
  draft: false,
  slug: "best-cambridge-a-level-past-paper-websites",
  title: "Best Cambridge A Level Past Paper Websites (2026): Free and Paid Compared",
  description: "The best Cambridge (CAIE) A Level past paper websites in 2026 for 9709, 9702, 9701, 9700 and 9708, compared on what is free, topic practice and the catches.",
  eyebrow: "Cambridge A Level resource comparison",
  answer: "For free whole papers with mark schemes, use PastPaperPrep (9709, 9702, 9701, 9700 and 9708, 2020 to 2026, no account), PapaCambridge (every CAIE code) or Physics & Maths Tutor. Use Cambridge's site for syllabuses and its official selection. For notes and exam-style questions, Save My Exams is the main paid option. For real questions by topic, PastPaperPrep and Exam-Mate both charge for recent years.",
  answerLink: { href: "/past-papers/a-level", label: "Free A Level past papers" },
  publishedAt: "2026-11-21",
  updatedAt: "2026-11-21",
  readingMinutes: 8,
  comparison: {
    caption: "Cambridge A Level past paper websites, checked 21 November 2026",
    headings: ["Website", "Best for", "What to know"],
    rows: [
      { label: "PastPaperPrep", pastPaperPrep: "Free whole papers beside their mark schemes in the browser, plus real questions sorted by paper and topic", competitor: "Five subjects only; science practicals not included; topical practice beyond 2020–2021 needs a plan" },
      { label: "Cambridge International", pastPaperPrep: "Syllabuses, specimen papers and an official selection of past papers", competitor: "Says it is only a selection; registered schools get more through the School Support Hub" },
      { label: "PapaCambridge", pastPaperPrep: "Free yearly papers for every CAIE AS & A Level code", competitor: "Topical and solved papers are sold separately, from $20" },
      { label: "Physics & Maths Tutor", pastPaperPrep: "Free CAIE papers and mark schemes listed by paper number", competitor: "We found no CAIE topic questions or notes" },
      { label: "Save My Exams", pastPaperPrep: "Revision notes, exam-style topic questions and mock exams", competitor: "Full access is paid; Economics 9708 has notes and flashcards but no topic questions" },
      { label: "Exam-Mate", pastPaperPrep: "Real past-paper questions by topic, Maths split by paper", competitor: "Free topical access stops at 2019; newer years from USD 12 a month" },
    ],
  },
  sections: [
    {
      heading: "The short answer",
      paragraphs: [
        "Most students need two things: whole papers with mark schemes for timed practice, and a way to practise weak topics with real questions. Several sites give the first away. The second is where the paid options differ.",
        "Start free. Use one whole-paper source, then pay only if topic practice, notes or model answers would save you real time. Prices and coverage below were checked on 21 November 2026.",
      ],
    },
    {
      heading: "PastPaperPrep",
      paragraphs: [
        "PastPaperPrep has 911 free whole papers for Maths 9709, Physics 9702, Chemistry 9701, Biology 9700 and Economics 9708, from 2020 to 2026. Each opens beside its mark scheme with a timer, no account needed, and supported papers can be self-marked.",
        "The topic banks hold every question from those papers, sorted by paper and topic, with Cambridge's mark scheme under each. Questions from 2020 and 2021 are free; newer years and PDF worksheets need a plan, from $6 a month for one bank or $25 a month for every bank. The limits: five subjects so far, no science practical papers, and worked explanations only for 9709 Pure 1 to 3.",
      ],
      links: [
        { href: "/past-papers/a-level", label: "Free A Level papers" },
        { href: "/cambridge-a-level", label: "A Level topic banks" },
      ],
    },
    {
      heading: "Cambridge International",
      paragraphs: [
        "Cambridge's subject pages are where to check the syllabus, specimen papers and the assessment you will actually sit. Each subject's past-papers tab offers some recent papers, mark schemes and an examiner report, but Cambridge says it is only a selection; registered schools get wider access through the School Support Hub.",
        "Use it for authority, not volume. Ask your school if you need older official papers.",
      ],
    },
    {
      heading: "PapaCambridge",
      paragraphs: [
        "PapaCambridge lists all five codes under free yearly past papers, with question papers, mark schemes and grade thresholds as separate downloads. Its 9709 folders already include October/November 2025.",
        "Its shop sells topical unsolved papers, listed from $20 to $50 per subject, and solved yearly papers, from $20 to $150. Those are separate from the free archive. Match file codes carefully: 9709_w25_qp_12 needs 9709_w25_ms_12.",
      ],
    },
    {
      heading: "Physics & Maths Tutor",
      paragraphs: [
        "PMT has free CAIE pages for all five subjects, organised by paper number: Pure 1, Mechanics and so on for 9709, and Papers 1 onwards for the sciences and Economics, each with mark schemes.",
        "PMT is best known for UK boards. We found no CAIE topic questions or notes, and its Physics, Chemistry and Biology hub pages didn't link to the CAIE paper pages, so go to the paper-number pages directly.",
      ],
    },
    {
      heading: "Save My Exams",
      paragraphs: [
        "Save My Exams has CIE A Level courses for all five codes. Maths, Physics, Chemistry and Biology include revision notes, exam-style topic questions, flashcards, target tests and mock exams; the 9708 Economics course had notes and flashcards but no topic questions. Its CIE past-paper pages listed papers up to 2024.",
        "A free account gets a weekly allowance of notes and can download past papers. Essential unlocks notes and exam questions; Premium adds unlimited model answers and PDF downloads, with a 7-day trial. Check the current price on its plans page.",
      ],
    },
    {
      heading: "Exam-Mate",
      paragraphs: [
        "Exam-Mate sorts real CAIE A Level questions by topic for all five codes, with Maths split into Pure 1, Pure 2 and 3, Mechanics and Statistics. It shows official mark schemes and AI-generated solutions.",
        "Free topical access covers questions up to 2019. Newer years need a topical subscription; its pricing page lists USD 12 for one month, 65 for six months, 120 for a year or 220 for two years, without a separate A Level price. Topical questions are practised online.",
      ],
    },
    {
      heading: "Also worth knowing",
      bullets: [
        "TutorChase has CIE A Level notes, practice questions and past papers for all five subjects, with some sections marked Premium.",
        "ZNotes lists AS and A2 notes pages for all five codes; we couldn't read the notes themselves in our check.",
        "MathsGenie's A Level Maths pages cover UK boards only, not Cambridge 9709.",
        "GCE Guide's old paper addresses redirected to an unrelated games site when we checked. Don't follow old bookmarks there.",
      ],
      paragraphs: [],
    },
    {
      heading: "How to choose",
      bullets: [
        "Timed whole papers: PastPaperPrep, PapaCambridge or PMT, all free.",
        "Real questions on one weak topic: PastPaperPrep or Exam-Mate; both charge for recent years.",
        "Learning a topic from scratch: Save My Exams, TutorChase or ZNotes notes.",
        "The exact syllabus and official papers: Cambridge International and your school.",
      ],
      paragraphs: [],
      links: [{ href: "/articles/best-save-my-exams-alternatives-cie-a-level", label: "Save My Exams alternatives for CIE A Level" }],
    },
    A_LEVEL_ACCESS,
  ],
  faqs: [
    { question: "What is the best free website for Cambridge A Level past papers?", answer: "For 9709, 9702, 9701, 9700 and 9708, PastPaperPrep has free whole papers with mark schemes from 2020 to 2026, no account needed. PapaCambridge covers every CAIE code as downloads, and PMT lists CAIE papers by paper number." },
    { question: "Does Save My Exams have CIE A Level past papers?", answer: "Yes. Its CIE A Level past-paper pages list papers and mark schemes, up to 2024 when we checked, and a free account can download them." },
    { question: "Is Exam-Mate free for A Level?", answer: "Topical questions up to 2019 are free. Questions from 2020 onwards need a topical subscription, from USD 12 for one month." },
    { question: "Is GCE Guide still working?", answer: "When we checked on 21 November 2026, its paper addresses redirected to an unrelated games site, so use another archive." },
  ],
  relatedBanks: [
    { href: "/cambridge-a-level", label: "Cambridge A Level question banks" },
    { href: "/banks/a-level-maths-9709", label: "A Level Maths 9709 question bank" },
    { href: "/banks/a-level-physics-9702", label: "A Level Physics 9702 question bank" },
    { href: "/banks/a-level-chemistry-9701", label: "A Level Chemistry 9701 question bank" },
    { href: "/banks/a-level-biology-9700", label: "A Level Biology 9700 question bank" },
    { href: "/banks/a-level-economics-9708", label: "A Level Economics 9708 question bank" },
  ],
  sources: [CAMBRIDGE_9701_PAPERS, PAPA_DIRECTORY, PAPA_9709, PAPA_TOPICAL, PAPA_SOLVED, PMT_9709, PMT_9702, SME_CIE_MATHS, SME_CIE_ECON, SME_CIE_PAPERS, SME_PLANS, EXAM_MATE_9700, EXAM_MATE_PRICING, TUTORCHASE_CIE, MATHSGENIE_A_LEVEL, PPP_PRICING],
};

const SME_ALTERNATIVES_A_LEVEL: Article = {
  draft: false,
  slug: "best-save-my-exams-alternatives-cie-a-level",
  title: "Best Save My Exams Alternatives for CIE A Level (2026)",
  description: "Save My Exams alternatives for Cambridge AS & A Level, matched to what you use it for: past papers, real topic questions, notes or model answers.",
  eyebrow: "CIE A Level revision alternatives",
  answer: "It depends which part of Save My Exams you use. For past papers, PastPaperPrep, PapaCambridge and Physics & Maths Tutor are free. For real past-paper questions by topic, PastPaperPrep and Exam-Mate are cheaper focused options. For notes, TutorChase and ZNotes offer free CIE A Level notes. Keep Save My Exams if you rely on its notes, exam-style questions and model answers together.",
  answerLink: { href: "/cambridge-a-level", label: "Try PastPaperPrep's A Level banks" },
  publishedAt: "2026-11-21",
  updatedAt: "2026-11-21",
  readingMinutes: 7,
  comparison: {
    caption: "Save My Exams alternatives for CIE A Level, by job",
    headings: ["What you use Save My Exams for", "Alternative", "Trade-off"],
    rows: [
      { label: "Downloading past papers", pastPaperPrep: "PastPaperPrep, PapaCambridge or PMT (free)", competitor: "PastPaperPrep covers five subjects; PapaCambridge and PMT are downloads you organise" },
      { label: "Topic questions", pastPaperPrep: "PastPaperPrep or Exam-Mate", competitor: "Real Cambridge questions, not exam-style ones; recent years are paid on both" },
      { label: "Revision notes", pastPaperPrep: "TutorChase or ZNotes", competitor: "Free notes with paid extras; check your syllabus code" },
      { label: "Model answers and marking feedback", pastPaperPrep: "Keep Save My Exams", competitor: "No like-for-like free replacement" },
    ],
  },
  sections: [
    {
      heading: "What Save My Exams gives CIE A Level students",
      paragraphs: [
        "Save My Exams has CIE A Level courses for 9709, 9702, 9701, 9700 and 9708. The Maths and science courses include revision notes, exam-style topic questions, flashcards, target tests and mock exams. The Economics 9708 course had notes and flashcards but no topic questions when we checked on 21 November 2026.",
        "A free account gets a weekly allowance of notes and can download past papers. Essential unlocks notes and exam questions; Premium adds unlimited model answers, Smart Mark feedback where available and PDF downloads, with a 7-day trial. Check its plans page for the current price.",
      ],
    },
    {
      heading: "For past papers: free options",
      paragraphs: [
        "If you mainly download papers, you don't need a subscription. PastPaperPrep has 911 free whole papers for the five subjects, 2020 to 2026, opened beside the mark scheme with no account. PapaCambridge lists every CAIE code as free yearly downloads, and Physics & Maths Tutor lists CAIE papers by paper number.",
        "Save My Exams' own CIE past-paper pages listed papers up to 2024 when we checked; PastPaperPrep and PapaCambridge already include 2025.",
      ],
      links: [
        { href: "/past-papers/a-level", label: "Free A Level papers" },
        { href: "/articles/best-cambridge-a-level-past-paper-websites", label: "Compare A Level past paper websites" },
      ],
    },
    {
      heading: "For topic questions: real ones instead of exam-style",
      paragraphs: [
        "Save My Exams writes exam-style questions for each topic. If you would rather practise questions Cambridge actually set, use a topical bank. PastPaperPrep sorts every question from 2020 to 2026 by paper and topic, with Cambridge's mark scheme under each: 2,118 in Maths, 2,627 in Physics, 2,220 in Chemistry, 2,680 in Biology and 3,207 in Economics. Questions from 2020 and 2021 are free, and you can turn a selection into a PDF worksheet on a plan.",
        "Exam-Mate also sorts real CAIE questions by topic, with official mark schemes and AI-generated solutions. Its free access stops at 2019; its topical pricing page lists USD 12 for a month or 120 for a year, practised online.",
        "PastPaperPrep is $6 a month for one bank, $22 a month for all five A Level banks, or $25 a month for All Access, which adds the IGCSE and IB banks. Worked explanations cover 9709 Pure 1 to 3 only; other A Level questions show the official mark scheme.",
      ],
      links: [{ href: "/cambridge-a-level", label: "A Level topic banks" }],
    },
    {
      heading: "For notes: free CIE A Level notes",
      paragraphs: [
        "TutorChase has CIE A Level notes, practice questions and past papers for all five subjects; some sections, such as its Pure 2 and 3 and Mechanics notes, are marked Premium. ZNotes lists AS and A2 notes pages for all five codes, though we couldn't read the notes themselves in our check. Compare a topic you know well before relying on either.",
        "If you take Maths, note that MathsGenie's A Level pages cover UK boards only, not Cambridge 9709.",
      ],
    },
    {
      heading: "When to keep Save My Exams",
      paragraphs: [
        "Keep it if you use its notes, exam-style questions and model answers together, take several subjects, or want feedback tools on written answers. No single free site replaces that mix.",
        "A cheaper setup for many students is free papers to diagnose, a topic bank for the weak areas, and free notes for the theory. Try the free tiers first and pay only for the part you keep opening.",
      ],
    },
    A_LEVEL_ACCESS,
  ],
  faqs: [
    { question: "What is the best free alternative to Save My Exams for CIE A Level?", answer: "For past papers, PastPaperPrep, PapaCambridge and Physics & Maths Tutor are free. For notes, TutorChase and ZNotes have free CIE A Level notes with paid extras." },
    { question: "Does Save My Exams use real past paper questions?", answer: "Its topic questions are exam-style questions written for the course. Real past papers are available separately on its past-paper pages." },
    { question: "Which alternative has real CIE A Level questions by topic?", answer: "PastPaperPrep and Exam-Mate both sort real Cambridge questions by topic. PastPaperPrep's 2020 and 2021 questions are free; Exam-Mate's free access stops at 2019." },
    { question: "How much is PastPaperPrep for A Level?", answer: "$6 a month for one bank, $22 a month for all five A Level banks, or $25 a month for All Access. Whole past papers are free." },
  ],
  relatedBanks: [
    { href: "/cambridge-a-level", label: "Cambridge A Level question banks" },
    { href: "/articles/best-save-my-exams-alternatives-topical-past-papers", label: "Save My Exams alternatives for IGCSE and IB" },
    { href: "/pricing", label: "PastPaperPrep pricing" },
  ],
  sources: [SME_CIE_MATHS, SME_CIE_ECON, SME_CIE_PAPERS, SME_PLANS, PAPA_DIRECTORY, PMT_9709, EXAM_MATE_9700, EXAM_MATE_PRICING, TUTORCHASE_CIE, MATHSGENIE_A_LEVEL, PPP_PRICING],
};

const PAPACAMBRIDGE_VS_PMT: Article = {
  draft: false,
  slug: "papacambridge-vs-physics-and-maths-tutor-a-level",
  title: "PapaCambridge vs Physics & Maths Tutor for Cambridge A Level Papers",
  description: "PapaCambridge and Physics & Maths Tutor compared for CAIE AS & A Level: subject coverage, how papers are organised, what is free, and what each sells.",
  eyebrow: "Cambridge A Level archive comparison",
  answer: "Both give Cambridge A Level past papers and mark schemes free for 9709, 9702, 9701, 9700 and 9708. PapaCambridge covers every CAIE code, organised by year and series, and sells topical and solved papers on the side. Physics & Maths Tutor organises CAIE papers by paper number, which suits practising one paper type, but has no CAIE topic questions or notes. Use PapaCambridge for breadth and PMT for paper-by-paper practice.",
  answerLink: { href: "/past-papers/a-level", label: "Or open papers in the browser" },
  publishedAt: "2026-11-21",
  updatedAt: "2026-11-21",
  readingMinutes: 6,
  comparison: {
    caption: "PapaCambridge and PMT for CAIE A Level, checked 21 November 2026",
    headings: ["", "PapaCambridge", "Physics & Maths Tutor"],
    rows: [
      { label: "Free papers and mark schemes", pastPaperPrep: "Yes, labelled free yearly past papers", competitor: "Yes, plain download links" },
      { label: "CAIE A Level coverage", pastPaperPrep: "Every CAIE AS & A Level code, including all five here", competitor: "9709, 9702, 9701, 9700 and 9708, among others" },
      { label: "Organised by", pastPaperPrep: "Subject, then year and series", competitor: "Subject, then paper number (Pure 1, Paper 4 and so on)" },
      { label: "Extras", pastPaperPrep: "Grade thresholds in the same folders", competitor: "None found for CAIE beyond papers" },
      { label: "What it sells", pastPaperPrep: "Topical papers ($20–$50) and solved papers ($20–$150)", competitor: "UK-board courses and tutoring" },
    ],
  },
  sections: [
    {
      heading: "Two free archives, organised differently",
      paragraphs: [
        "PapaCambridge files papers by series. For 9709 you open a folder like October/November 2025 and find every variant's question paper and mark scheme, plus the grade thresholds. That is handy for sitting a full series, or checking what came out recently.",
        "PMT files papers by paper number. Its CAIE Pure 1 page lists every Pure 1 paper it holds, year after year, each with its mark scheme. That suits a student who wants to sit Paper 4 after Paper 4 without hunting through folders.",
      ],
    },
    {
      heading: "Coverage",
      paragraphs: [
        "PapaCambridge's AS & A Level directory lists every CAIE code, so it is the safer bet if you also take a subject outside these five. Its 9709 folders already include October/November 2025.",
        "PMT covers the five codes here among its international A Levels, but it is built around UK boards. Its Physics, Chemistry and Biology hub pages didn't link to the CAIE paper pages when we checked, so bookmark those pages directly.",
      ],
    },
    {
      heading: "What each one charges for",
      paragraphs: [
        "PapaCambridge's free yearly archive sits beside a shop. Topical unsolved papers for each A Level subject are listed from $20 to $50, and solved yearly papers from $20 to $150. Those are paid products, separate from the free archive.",
        "PMT's papers are free links. The paid side of the brand is tutoring and revision courses, which on the pages we checked were for UK boards. We found no CAIE topic questions or notes on PMT.",
      ],
    },
    {
      heading: "Which to use",
      bullets: [
        "Sitting a full recent series, or a subject outside these five: PapaCambridge.",
        "Practising one paper type again and again: PMT.",
        "Real questions on one topic across many years: neither, for free. Use a topical bank such as PastPaperPrep or Exam-Mate.",
        "Opening a paper beside its mark scheme without downloading: PastPaperPrep's free archive, for these five subjects.",
      ],
      paragraphs: [
        "Whichever you use, check the syllabus year. The sciences changed in 2022 and Economics in 2023, so older papers include some content you can skip.",
      ],
      links: [
        { href: "/articles/best-cambridge-a-level-past-paper-websites", label: "All A Level past paper websites compared" },
        { href: "/articles/free-cambridge-a-level-past-papers-by-topic", label: "Using A Level past papers by topic" },
      ],
    },
    A_LEVEL_ACCESS,
  ],
  faqs: [
    { question: "Is PapaCambridge free for A Level?", answer: "Its yearly past papers are labelled free. Topical and solved papers are sold separately in its shop." },
    { question: "Does Physics & Maths Tutor have CIE A Level papers?", answer: "Yes. It lists CAIE papers and mark schemes by paper number for 9709, 9702, 9701, 9700 and 9708." },
    { question: "Does PMT have CIE A Level topic questions?", answer: "We didn't find any. Its topic questions and notes are for UK boards." },
    { question: "Which is better for 9709 Maths, PapaCambridge or PMT?", answer: "Both have free 9709 papers. PMT lists them by paper, such as Pure 1 or Mechanics; PapaCambridge by series, with grade thresholds alongside." },
  ],
  relatedBanks: [
    { href: "/cambridge-a-level", label: "Cambridge A Level question banks" },
    { href: "/articles/physics-and-maths-tutor-vs-save-my-exams", label: "PMT vs Save My Exams" },
  ],
  sources: [PAPA_DIRECTORY, PAPA_9709, PAPA_TOPICAL, PAPA_SOLVED, PMT_9709, PMT_9702, PMT_9708],
};

export const A_LEVEL_ARTICLES: readonly Article[] = [
  BEST_A_LEVEL_SITES,
  SME_ALTERNATIVES_A_LEVEL,
  PAPACAMBRIDGE_VS_PMT,
  CHEMISTRY_9701,
  BIOLOGY_9700,
  MATHS_9709_APPLIED,
  ECONOMICS_9708_MCQ,
  GRADE_THRESHOLDS,
  FREE_PAPERS_BY_TOPIC,
];
