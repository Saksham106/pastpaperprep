import type { Article } from "@/lib/articles";
import { freeAccessSection } from "@/lib/article-clusters/free-access-section";

/**
 * Subject and competitor guides added 2026-11-08 for courses and searches the earlier guides
 * didn't cover. PastPaperPrep facts come from the catalogue and access rules on that date;
 * competitor facts come from each provider's own pages, opened on 2026-11-08 (see sources).
 * Research notes: docs/audits/2026-11-08-backlinks/README.md.
 */
const ADD_MATHS_0606: Article = {
  draft: false,
  slug: "best-igcse-additional-maths-0606-resources",
  title: "Best IGCSE Additional Maths 0606 Resources: Past Papers, Topic Questions and Notes",
  description: "The best Cambridge IGCSE Additional Maths 0606 resources: free past papers, topic-sorted questions with worked answers, notes and grade thresholds.",
  eyebrow: "Cambridge IGCSE Additional Mathematics 0606",
  answer: "For 0606, start with free whole past papers and their mark schemes, then drill weak topics with real past-paper questions. PastPaperPrep has 147 Additional Maths papers from 2016 to 2026 and 1,656 questions sorted by topic, each with a worked explanation. Use ZNotes for free summary notes, Save My Exams for teacher-written notes and exam-style questions, and Cambridge's own page for the current syllabus.",
  answerLink: { href: "/past-papers/igcse-additional-maths-0606", label: "Open a free 0606 past paper" },
  publishedAt: "2026-11-08",
  updatedAt: "2026-11-08",
  readingMinutes: 6,
  comparison: {
    caption: "Additional Maths 0606 resources by job",
    headings: ["Resource", "Best for", "What to check"],
    rows: [
      { label: "PastPaperPrep", pastPaperPrep: "Whole papers, topic-sorted real questions, worked explanations", competitor: "Papers free without sign-up; topic questions from 2016 to 2018 free, newer years paid" },
      { label: "Cambridge International", pastPaperPrep: "The current syllabus and specimen papers", competitor: "The public page shows a selection of papers, not the full archive" },
      { label: "ZNotes", pastPaperPrep: "Free summary notes (14 chapters, 2025 to 2027 syllabus)", competitor: "Notes, not a question bank" },
      { label: "Save My Exams", pastPaperPrep: "Teacher-written notes, exam questions by topic, target tests", competitor: "Free account with limits; full access is paid" },
    ],
  },
  sections: [
    {
      heading: "Know the two papers first",
      paragraphs: [
        "On the 2025 to 2027 syllabus, every candidate sits two written papers, each 2 hours, 80 marks and 50% of the grade. Paper 1 is non-calculator and Paper 2 allows a scientific calculator. That split matters for practice: do Paper 1 questions without a calculator even when they come from an older paper.",
        "Older papers are still useful. Most topics carry across syllabus cycles, and questions on content that has since left the syllabus are labelled as earlier-syllabus topics so you can skip them.",
      ],
      links: [{ href: "/syllabus/igcse-additional", label: "0606 syllabus and paper guide" }],
    },
    {
      heading: "PastPaperPrep: papers, topics and worked answers in one place",
      paragraphs: [
        "Every 0606 paper we hold opens free, with its mark scheme, a timer and question-by-question self-marking. The topic bank sorts 1,656 real questions into the syllabus topics, so you can work through, say, only Calculus (the most-tested area, with 424 questions) or only Trigonometry.",
        "Every question has a step-by-step worked explanation showing which mark-scheme points each step earns. On free-year papers those explanations are printed on the paper page itself. Cambridge's grade thresholds for recent 0606 sessions are on the grade thresholds page.",
      ],
      links: [
        { href: "/past-papers/igcse-additional-maths-0606", label: "0606 past papers" },
        { href: "/banks/igcse-additional?topic=Calculus", label: "0606 Calculus questions" },
        { href: "/grade-thresholds/igcse-additional-maths-0606", label: "0606 grade thresholds" },
      ],
    },
    freeAccessSection([
      { href: "/banks/igcse-additional?free=1", label: "Free 0606 topic questions" },
    ]),
    {
      heading: "Notes: ZNotes and Save My Exams",
      paragraphs: [
        "ZNotes has free Additional Maths notes for the 2025 to 2027 syllabus, in 14 chapters, plus two past-paper walkthrough videos. They are written by student contributors and work well as a quick summary before practice.",
        "Save My Exams' Cambridge Additional Maths course lists revision notes, exam questions organised by topic (past-paper, exam-style and quiz questions), target tests and past papers. A free account gets limited access; the full course is part of its paid plans.",
      ],
    },
    {
      heading: "A simple 0606 routine",
      paragraphs: [
        "Sit one recent paper under timed conditions and mark it. List the topics where you dropped marks, then do 10 to 15 topic questions on each, reading the worked explanation for any you get wrong. Finish with another timed paper. Keep Paper 1 practice calculator-free.",
      ],
    },
  ],
  faqs: [
    { question: "Where can I find free IGCSE Additional Maths 0606 past papers?", answer: "PastPaperPrep has 147 Additional Maths 0606 papers from 2016 to 2026, each free with its mark scheme and no sign-up. Cambridge's own subject page also shows a selection of recent papers." },
    { question: "Is 0606 Paper 1 non-calculator?", answer: "Yes. On the 2025 to 2027 syllabus, Paper 1 is non-calculator and Paper 2 allows a scientific calculator. Both are 2 hours, 80 marks and 50% of the grade." },
    { question: "Which 0606 topic comes up most?", answer: "In our archive of 1,656 questions, Calculus has the most (424), followed by Trigonometry and Logarithmic and exponential functions. That is past frequency, not a prediction." },
    { question: "Are there worked solutions for 0606 past papers?", answer: "Yes. Every 0606 question on PastPaperPrep has a step-by-step worked explanation. Explanations follow the same free or paid access as the question; on free-year papers they are printed on the paper page." },
  ],
  relatedBanks: [
    { href: "/banks/igcse-additional", label: "Additional Maths 0606 by topic" },
    { href: "/syllabus/igcse-additional", label: "0606 syllabus and papers" },
  ],
  sources: [
    { href: "https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-igcse-mathematics-additional-0606/", label: "Cambridge IGCSE Additional Mathematics 0606" },
    { href: "https://znotes.org/caie/igcse/additional-mathematics-0606/", label: "ZNotes 0606 notes" },
    { href: "https://www.savemyexams.com/igcse/further-maths/cie/additional-maths/25/", label: "Save My Exams CIE Additional Maths" },
  ],
};

const CS_0478: Article = {
  draft: false,
  slug: "best-igcse-computer-science-0478-resources",
  title: "Best IGCSE Computer Science 0478 Resources: Past Papers, Topic Questions and Notes",
  description: "The best Cambridge IGCSE Computer Science 0478 resources: free past papers, real questions by topic with worked code explanations, and free notes.",
  eyebrow: "Cambridge IGCSE Computer Science 0478",
  answer: "Start with free 0478 past papers and mark schemes, then practise the topics you lose marks on. PastPaperPrep has 105 Computer Science papers from 2019 to 2026 and 847 questions sorted by topic, each with a worked explanation that lays out code and trace tables properly. Use ZNotes for free notes on the 2026 to 2028 syllabus, Save My Exams for teacher-written notes and exam questions, and Cambridge's page for syllabus changes.",
  answerLink: { href: "/past-papers/igcse-computer-science-0478", label: "Open a free 0478 past paper" },
  publishedAt: "2026-11-08",
  updatedAt: "2026-11-08",
  readingMinutes: 6,
  comparison: {
    caption: "Computer Science 0478 resources by job",
    headings: ["Resource", "Best for", "What to check"],
    rows: [
      { label: "PastPaperPrep", pastPaperPrep: "Whole papers, real questions by topic, worked explanations with code", competitor: "Papers free without sign-up; topic questions from 2019 to 2021 free, newer years paid" },
      { label: "Cambridge International", pastPaperPrep: "Current syllabus and the published 2029 to 2031 syllabus", competitor: "0478 is the paper route; 0265 is the same content on screen" },
      { label: "ZNotes", pastPaperPrep: "Free theory and practical notes (2026 to 2028 syllabus)", competitor: "Notes, not a question bank" },
      { label: "Save My Exams", pastPaperPrep: "Notes, exam questions by topic, target tests, past papers", competitor: "Free account with limits; full access is paid" },
    ],
  },
  sections: [
    {
      heading: "Check which syllabus you are on",
      paragraphs: [
        "Cambridge offers this course as 0478 (paper exams) and 0265 (the same content, examined on screen). The current syllabus runs 2026 to 2028, and Cambridge has already published the 2029 to 2031 syllabus with a summary of changes. Read that summary if you start the course in 2027 or later.",
        "Past papers from 2019 onward are still good practice for most topics. Our topic bank uses the current syllabus topics and labels the few questions that no longer fit as earlier-syllabus topics.",
      ],
    },
    {
      heading: "PastPaperPrep: real questions, sorted, with readable code",
      paragraphs: [
        "Every 0478 paper we hold opens free with its mark scheme. The topic bank sorts 847 real questions into the ten syllabus topics. Algorithm design and problem-solving has the most (217), then Hardware (123), Programming and The internet and its uses.",
        "Each question has a worked explanation. For programming and algorithm questions, pseudocode, program code and trace tables are shown as monospaced blocks, line for line, so you can follow the logic rather than a paragraph describing it.",
      ],
      links: [
        { href: "/past-papers/igcse-computer-science-0478", label: "0478 past papers" },
        { href: "/banks/igcse-computer-science-0478?topic=Algorithm%20design%20and%20problem-solving", label: "Algorithm design questions" },
        { href: "/syllabus/igcse-computer-science-0478", label: "0478 topics and archive frequency" },
      ],
    },
    freeAccessSection([
      { href: "/banks/igcse-computer-science-0478?free=1", label: "Free 0478 topic questions" },
    ]),
    {
      heading: "Notes and other practice",
      paragraphs: [
        "ZNotes has free 0478 notes for the 2026 to 2028 syllabus: six theory chapters, four practical chapters and a topic video. Save My Exams' Cambridge Computer Science course lists revision notes, exam questions by topic, target tests and past papers, with full access on its paid plans.",
        "Craig'n'Dave covers IGCSE Computer Science among its courses, with free video series and a Smart Revise quiz tool that has a free tier. Check that any resource you use says Cambridge 0478 rather than a UK GCSE board.",
      ],
    },
    {
      heading: "How to practise programming questions",
      paragraphs: [
        "Write your answer on paper first, the way the exam expects. Then compare it with the mark scheme and the worked explanation line by line. For trace tables, fill in every row yourself before checking; the marks are for each correct row, not the final output.",
      ],
    },
  ],
  faqs: [
    { question: "Where can I find free IGCSE Computer Science 0478 past papers?", answer: "PastPaperPrep has 105 Computer Science 0478 papers from 2019 to 2026, each free with its mark scheme and no sign-up. Cambridge's subject page also lists a selection of papers." },
    { question: "What is the difference between 0478 and 0265?", answer: "Cambridge says 0265 has the same content as 0478 but is examined on screen; 0478 is the paper-based route." },
    { question: "Which 0478 topic has the most past-paper questions?", answer: "In our archive, Algorithm design and problem-solving has the most questions (217 of 847), followed by Hardware (123). That is past frequency, not a prediction." },
    { question: "Are 0478 topic questions free?", answer: "Questions from 2019 to 2021 are free in the topic bank; a free account opens the full free selection. Newer years need a paid plan. Whole past papers are free for every year." },
  ],
  relatedBanks: [
    { href: "/banks/igcse-computer-science-0478", label: "Computer Science 0478 by topic" },
    { href: "/syllabus/igcse-computer-science-0478", label: "0478 syllabus and topics" },
  ],
  sources: [
    { href: "https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-igcse-computer-science-0478/", label: "Cambridge IGCSE Computer Science 0478" },
    { href: "https://znotes.org/caie/igcse/computer-science-0478/", label: "ZNotes 0478 notes" },
    { href: "https://www.savemyexams.com/igcse/computer-science/cie/23/", label: "Save My Exams CIE IGCSE Computer Science" },
    { href: "https://www.craigndave.org/", label: "Craig'n'Dave" },
  ],
};

const IB_ECONOMICS: Article = {
  draft: false,
  slug: "best-ib-economics-resources",
  title: "Best IB Economics Resources: Past Papers, Questions and Revision (HL and SL)",
  description: "The best IB Economics resources for HL and SL: free past papers with markschemes, real questions by topic with worked answers, and revision options compared.",
  eyebrow: "IB Diploma Economics HL and SL",
  answer: "For IB Economics, practise with real past-paper questions and their markschemes, then compare your answer with a worked one. PastPaperPrep has free IB Economics papers with markschemes and real HL and SL questions by topic, each with a worked explanation. Revision Village adds a topic question bank with video solutions and mocks; Save My Exams adds notes, flashcards and exam-style questions.",
  answerLink: { href: "/past-papers/ib-economics-hl", label: "Open a free IB Economics paper" },
  publishedAt: "2026-11-08",
  updatedAt: "2026-11-08",
  readingMinutes: 6,
  comparison: {
    caption: "IB Economics resources by job",
    headings: ["Resource", "Best for", "What to check"],
    rows: [
      { label: "PastPaperPrep", pastPaperPrep: "Real past-paper questions by topic, markschemes, worked explanations", competitor: "Papers free without sign-up; topic questions from 2021 free, newer years paid" },
      { label: "Revision Village", pastPaperPrep: "Topic question bank with video solutions, mocks, IA guidance", competitor: "Exam-style questions; full access on its paid Gold plan" },
      { label: "Save My Exams", pastPaperPrep: "Teacher-written notes, flashcards, exam-style questions", competitor: "Free account with limits; full access is paid" },
    ],
  },
  sections: [
    {
      heading: "Know the papers you are practising for",
      paragraphs: [
        "On the course first assessed in 2022, SL sits Paper 1 (extended response, 1 hour 15 minutes, 30%) and Paper 2 (data response, 1 hour 45 minutes, 40%), plus a commentary portfolio (30%). HL adds Paper 3 (quantitative work and policy advice, 1 hour 45 minutes), with weightings of 20%, 30%, 30% and 20% for the portfolio.",
        "Paper 3 is HL only, and it rewards calculation practice that essay revision won't give you. Plan separate practice for it.",
      ],
      links: [
        { href: "/syllabus/ib-economics-hl", label: "IB Economics HL papers and topics" },
        { href: "/syllabus/ib-economics-sl", label: "IB Economics SL papers and topics" },
      ],
    },
    {
      heading: "PastPaperPrep: real questions with worked answers",
      paragraphs: [
        "Every IB Economics paper we hold opens free with its markscheme: 49 HL and 38 SL papers from 2021 to 2026. The topic banks sort the questions into Microeconomics, Macroeconomics and the Global economy, so you can practise one unit at a time.",
        "Each question has a worked explanation that shows how the answer earns the markscheme's credit, which is the part students most often miss in data-response and policy questions.",
      ],
      links: [
        { href: "/past-papers/ib-economics-hl", label: "IB Economics HL papers" },
        { href: "/past-papers/ib-economics-sl", label: "IB Economics SL papers" },
        { href: "/banks/ib-economics-hl?topic=Microeconomics", label: "HL Microeconomics questions" },
      ],
    },
    freeAccessSection([
      { href: "/banks/ib-economics-hl?free=1", label: "Free IB Economics HL questions" },
      { href: "/banks/ib-economics-sl?free=1", label: "Free IB Economics SL questions" },
    ]),
    {
      heading: "Revision Village and Save My Exams",
      paragraphs: [
        "Revision Village's IB Economics course has a question bank sorted by topic and difficulty with markschemes and video solutions, practice exams and mocks, worked solutions to past-paper questions, flashcards and IA guidance. Its question bank is exam-style practice rather than actual session questions, and full access is on its paid Gold plan.",
        "Save My Exams' IB Economics pages offer teacher-written revision notes, flashcards, exam-style questions and past papers. A free account has limited access.",
      ],
    },
  ],
  faqs: [
    { question: "Where can I find IB Economics past papers with markschemes?", answer: "PastPaperPrep has IB Economics HL and SL papers from 2021 to 2026, free with their markschemes and no sign-up. The IB also sells official papers through its store." },
    { question: "Is Paper 3 only for HL?", answer: "Yes. On the course first assessed in 2022, Paper 3 (quantitative work and policy advice) is sat by HL students only." },
    { question: "Are there free IB Economics practice questions?", answer: "Yes. Questions from 2021 are free in PastPaperPrep's HL and SL topic banks, each with a worked explanation. Newer years need a paid plan." },
  ],
  relatedBanks: [
    { href: "/banks/ib-economics-hl", label: "IB Economics HL by topic" },
    { href: "/banks/ib-economics-sl", label: "IB Economics SL by topic" },
  ],
  sources: [
    { href: "https://www.revisionvillage.com/ib-economics/", label: "Revision Village IB Economics" },
    { href: "https://www.savemyexams.com/dp/economics/", label: "Save My Exams IB Economics" },
  ],
};

const IB_CS: Article = {
  draft: false,
  slug: "best-ib-computer-science-resources",
  title: "Best IB Computer Science Resources: Past Papers and Practice for the New Course",
  description: "IB Computer Science HL and SL resources: free past papers with markschemes and past-paper questions mapped onto the new course's topics, with worked answers.",
  eyebrow: "IB Diploma Computer Science HL and SL",
  answer: "Few revision sites cover IB Computer Science, and the course changed with the new guide examined from 2027. PastPaperPrep has free IB Computer Science papers from 2019 to 2026 with markschemes, plus 506 HL and 391 SL questions sorted by the new course's topics where they map cleanly, each with a worked explanation. Use your school's IB materials for the guide itself.",
  answerLink: { href: "/past-papers/ib-computer-science-hl", label: "Open a free IB Computer Science paper" },
  publishedAt: "2026-11-08",
  updatedAt: "2026-11-08",
  readingMinutes: 5,
  sections: [
    {
      heading: "Old papers, new course",
      paragraphs: [
        "The new IB Computer Science guide reorganises the course into themes such as A1 Computer fundamentals, A2 Networks, A3 Databases, A4 Machine learning and B2 Programming. There are no new-course past papers yet, so old-syllabus papers are the main source of real exam practice.",
        "The useful question is which old questions still fit. In PastPaperPrep's banks, a question takes a new-course topic only where it maps cleanly. Everything else keeps its old topic, labelled \"earlier syllabus\", so you can see at a glance what is still examinable.",
      ],
      links: [
        { href: "/syllabus/ib-computer-science-hl", label: "IB CS HL topics" },
        { href: "/syllabus/ib-computer-science-sl", label: "IB CS SL topics" },
      ],
    },
    {
      heading: "PastPaperPrep: papers, mapped questions and worked answers",
      paragraphs: [
        "Every paper we hold opens free with its markscheme: 32 HL and 32 SL papers from 2019 to 2026. The topic banks hold 506 HL and 391 SL questions. B2 Programming and A1 Computer fundamentals have the most mapped questions.",
        "Each question has a worked explanation, with pseudocode and code laid out line by line.",
      ],
      links: [
        { href: "/past-papers/ib-computer-science-hl", label: "IB CS HL papers" },
        { href: "/past-papers/ib-computer-science-sl", label: "IB CS SL papers" },
        { href: "/banks/ib-computer-science-hl?topic=B2%20Programming", label: "HL B2 Programming questions" },
      ],
    },
    freeAccessSection([
      { href: "/banks/ib-computer-science-hl?free=1", label: "Free IB CS HL questions" },
      { href: "/banks/ib-computer-science-sl?free=1", label: "Free IB CS SL questions" },
    ]),
    {
      heading: "What else is out there",
      paragraphs: [
        "Coverage is thin. In our check, Revision Village's IB subject list didn't include Computer Science, and Save My Exams' IB Computer Science link went to its general Computer Science page. Your school's IB Programme Resource Centre has the official guide and specimen materials; ask your teacher for them.",
      ],
    },
  ],
  faqs: [
    { question: "Are there past papers for the new IB Computer Science course?", answer: "Not yet: the new guide is first examined in 2027. Old-syllabus papers are the main real practice; PastPaperPrep maps each old question onto a new-course topic where it fits cleanly." },
    { question: "Where can I find free IB Computer Science past papers?", answer: "PastPaperPrep has IB Computer Science HL and SL papers from 2019 to 2026, free with their markschemes and no sign-up." },
    { question: "Are IB Computer Science topic questions free?", answer: "Questions from 2019 and 2020 are free in the HL and SL topic banks, each with a worked explanation. Newer years need a paid plan." },
  ],
  relatedBanks: [
    { href: "/banks/ib-computer-science-hl", label: "IB Computer Science HL by topic" },
    { href: "/banks/ib-computer-science-sl", label: "IB Computer Science SL by topic" },
  ],
  sources: [
    { href: "https://www.revisionvillage.com/", label: "Revision Village subjects" },
    { href: "https://www.savemyexams.com/subjects/computer-science/", label: "Save My Exams Computer Science" },
  ],
};

const FREE_IB_PAPERS: Article = {
  draft: false,
  slug: "best-free-ib-past-paper-websites",
  title: "Best Free IB Past Paper Websites: Papers, Markschemes and Practice by Subject",
  description: "Where to find IB past papers with markschemes for Maths, sciences, Economics and Computer Science, and which sites give real papers versus exam-style questions.",
  eyebrow: "IB Diploma free resource guide",
  answer: "For IB Maths AA and AI, Biology, Chemistry, Physics, Economics and Computer Science, PastPaperPrep has free whole papers with markschemes, no sign-up, plus real questions by topic with worked explanations. The IB sells official papers through its store. Revision Village and Save My Exams mostly offer exam-style questions and notes, with full access on paid plans.",
  answerLink: { href: "/past-papers/ib", label: "Choose a free IB paper" },
  publishedAt: "2026-11-08",
  updatedAt: "2026-11-08",
  readingMinutes: 6,
  comparison: {
    caption: "IB past-paper sources: real papers or exam-style practice",
    headings: ["Website", "What you get", "What to check"],
    rows: [
      { label: "PastPaperPrep", pastPaperPrep: "Real IB papers with markschemes; real questions by topic with worked explanations", competitor: "Papers free without sign-up; newer topic questions paid" },
      { label: "IB store (Follett)", pastPaperPrep: "Official papers and markschemes", competitor: "Paid, per paper or pack" },
      { label: "Revision Village", pastPaperPrep: "Exam-style question banks with video solutions; worked solutions to past-paper questions", competitor: "Full access on its paid Gold plan" },
      { label: "Save My Exams", pastPaperPrep: "Notes, exam-style questions, flashcards", competitor: "Free account with limits; varies by subject" },
    ],
  },
  sections: [
    {
      heading: "Real papers and exam-style questions are different",
      paragraphs: [
        "A real past paper is what students actually sat in a session, with the IB's markscheme. Exam-style questions are written by a provider to resemble the exam. Both help, but only real papers show you how the IB words questions and awards marks, and only they give a fair timed mock.",
        "Many free-looking IB sites mostly offer exam-style questions. Check which one you are getting before relying on it as a mock.",
      ],
    },
    {
      heading: "PastPaperPrep: free whole papers in seven IB subjects",
      paragraphs: [
        "Every IB paper we hold opens free with its markscheme, a timer and self-marking, with no account. Papers run from 2016 for the sciences, 2017 for Maths AA, 2019 for Computer Science and 2021 for Maths AI and Economics, up to May 2026. Each subject page shows exactly which sessions are there.",
        "For topic practice, the banks sort the same real questions by syllabus topic, and every question has a worked explanation. Free-year questions are open to everyone; on free-year paper pages, the worked answers are printed below the paper.",
      ],
      links: [
        { href: "/past-papers/ib-math-aa-hl", label: "IB Maths AA HL papers" },
        { href: "/past-papers/ib-chemistry-hl", label: "IB Chemistry HL papers" },
        { href: "/past-papers/ib-physics-hl", label: "IB Physics HL papers" },
        { href: "/past-papers/ib-biology-hl", label: "IB Biology HL papers" },
        { href: "/past-papers/ib-economics-hl", label: "IB Economics HL papers" },
        { href: "/past-papers/ib-computer-science-hl", label: "IB Computer Science HL papers" },
      ],
    },
    freeAccessSection([
      { href: "/past-papers/ib", label: "All IB past papers" },
      { href: "/ib", label: "IB question banks" },
    ]),
    {
      heading: "Other options",
      paragraphs: [
        "The IB sells official past papers and markschemes through its Follett store; schools also get them through the IB's resource centre. Revision Village covers IB Maths, the sciences, Economics and more with exam-style question banks, video solutions and worked solutions to past-paper questions; most of it is on the paid Gold plan. Save My Exams' IB pages offer revision notes, exam questions and flashcards, varying by subject.",
        "IB Maths Revision links to the IB's free official specimen papers for Maths AA and AI, which show the current exam format.",
      ],
    },
  ],
  faqs: [
    { question: "Where can I get free IB past papers with markschemes?", answer: "PastPaperPrep has free IB papers with markschemes for Maths AA and AI, Biology, Chemistry, Physics, Economics and Computer Science, with no sign-up. Official copies are sold through the IB's store." },
    { question: "Are Revision Village questions real IB past papers?", answer: "Its question banks are exam-style questions written to resemble the exam. It also offers worked solutions to past-paper questions. Check which one you are using." },
    { question: "Which IB years are available?", answer: "On PastPaperPrep, up to May 2026, starting from 2016 for the sciences, 2017 for Maths AA, 2019 for Computer Science and 2021 for Maths AI and Economics. Each subject page lists the exact sessions." },
  ],
  relatedBanks: [
    { href: "/ib", label: "IB question banks" },
    { href: "/banks/ib-hl", label: "IB Maths AA HL by topic" },
  ],
  sources: [
    { href: "https://www.revisionvillage.com/", label: "Revision Village" },
    { href: "https://www.savemyexams.com/ib/", label: "Save My Exams IB" },
    { href: "https://ibmathrevision.com/past-papers", label: "IB Maths Revision: specimen papers and official store" },
  ],
};

const ZNOTES_ALTERNATIVES: Article = {
  draft: false,
  slug: "best-znotes-alternatives",
  title: "Best ZNotes Alternatives for IGCSE and IB: Past Papers and Practice Questions",
  description: "ZNotes is great for free notes. These alternatives add what notes don't: real past papers, topic-sorted questions and worked answers for IGCSE and IB.",
  eyebrow: "IGCSE and IB revision",
  answer: "ZNotes is a strong free source of summary notes. When you need practice rather than notes, use PastPaperPrep for free whole past papers and real questions sorted by topic with worked explanations, Save My Exams for teacher-written notes plus exam questions, and Revision Village for IB exam-style questions with video solutions.",
  answerLink: { href: "/past-papers", label: "Open a free past paper" },
  publishedAt: "2026-11-08",
  updatedAt: "2026-11-08",
  readingMinutes: 5,
  comparison: {
    caption: "ZNotes and alternatives by job",
    headings: ["Resource", "Best for", "What to check"],
    rows: [
      { label: "ZNotes", pastPaperPrep: "Free student-written summary notes, chapter quizzes, Discord community", competitor: "Notes and quizzes, not a past-paper question bank; Boost is paid" },
      { label: "PastPaperPrep", pastPaperPrep: "Free whole papers; real questions by topic with worked explanations", competitor: "Newer topic questions and PDF worksheets are paid" },
      { label: "Save My Exams", pastPaperPrep: "Teacher-written notes, exam questions by topic, flashcards", competitor: "Free account with limits; full access is paid" },
      { label: "Revision Village", pastPaperPrep: "IB exam-style questions with video solutions", competitor: "Mostly IB; full access on its paid Gold plan" },
    ],
  },
  sections: [
    {
      heading: "What ZNotes is for",
      paragraphs: [
        "ZNotes started as a student project in 2014 and publishes free notes across Cambridge, IB, Edexcel and other boards, written by student contributors and reviewers. It also has chapter quizzes, a large Discord community and a paid Boost upgrade for extras such as unlimited PDFs.",
        "Notes help you learn the content. Marks come from answering exam questions the way the mark scheme wants, which is where the alternatives below come in.",
      ],
    },
    {
      heading: "PastPaperPrep: from notes to real exam questions",
      paragraphs: [
        "Pair ZNotes with real practice. PastPaperPrep has free whole past papers with mark schemes for eight Cambridge IGCSE courses and seven IB subjects, and topic banks that sort the same real questions by syllabus topic, each with a worked explanation.",
        "PastPaperPrep also has its own free course notes for IB Maths AA, IGCSE Maths 0580 and IB Chemistry, each lesson linked to past-paper questions on that topic.",
      ],
      links: [
        { href: "/past-papers/igcse", label: "Free IGCSE papers" },
        { href: "/past-papers/ib", label: "Free IB papers" },
        { href: "/revision-notes", label: "PastPaperPrep revision notes" },
      ],
    },
    freeAccessSection([
      { href: "/#question-banks", label: "All question banks" },
    ]),
    {
      heading: "Save My Exams and Revision Village",
      paragraphs: [
        "Save My Exams combines teacher-written notes with exam questions by topic, flashcards and past papers across many boards; a free account gets limited access. Revision Village is IB-focused, with exam-style question banks, video solutions and mocks, mostly on its paid Gold plan.",
      ],
    },
  ],
  faqs: [
    { question: "Is ZNotes free?", answer: "ZNotes notes are free. Its Boost upgrade adds extras such as unlimited PDFs and is paid." },
    { question: "Does ZNotes have past papers by topic?", answer: "ZNotes focuses on notes and chapter quizzes. For real past-paper questions sorted by topic, use a topic question bank such as PastPaperPrep's." },
    { question: "What is the best free alternative to ZNotes for practice?", answer: "For practice rather than notes, PastPaperPrep's whole past papers are free with mark schemes and no sign-up, and older-year topic questions are free with worked explanations." },
  ],
  relatedBanks: [
    { href: "/#question-banks", label: "PastPaperPrep question banks" },
    { href: "/cambridge-igcse", label: "Cambridge IGCSE banks" },
    { href: "/ib", label: "IB banks" },
  ],
  sources: [
    { href: "https://znotes.org/", label: "ZNotes" },
    { href: "https://znotes.org/our-story/", label: "ZNotes: our story" },
    { href: "https://www.savemyexams.com/", label: "Save My Exams" },
    { href: "https://www.revisionvillage.com/", label: "Revision Village" },
  ],
};

const PAPACAMBRIDGE_ALTERNATIVES: Article = {
  draft: false,
  slug: "best-papacambridge-alternatives",
  title: "Best PapaCambridge Alternatives: Cambridge Past Papers and Topical Questions",
  description: "Alternatives to PapaCambridge for Cambridge IGCSE past papers and topical questions, including free topic practice with worked answers.",
  eyebrow: "Cambridge IGCSE past papers",
  answer: "PapaCambridge is a large free archive of Cambridge past papers, with paid topical and solved packs. For free topic-sorted questions with worked explanations, use PastPaperPrep; for teacher-written notes and exam questions, Save My Exams; for free paper lists by board, Physics & Maths Tutor.",
  answerLink: { href: "/past-papers/igcse", label: "Open a free IGCSE paper" },
  publishedAt: "2026-11-08",
  updatedAt: "2026-11-08",
  readingMinutes: 5,
  comparison: {
    caption: "PapaCambridge and alternatives by job",
    headings: ["Resource", "Best for", "What to check"],
    rows: [
      { label: "PapaCambridge", pastPaperPrep: "Free yearly papers across many Cambridge codes", competitor: "Topical and solved packs are paid; its topical packs say worked solutions are not included" },
      { label: "PastPaperPrep", pastPaperPrep: "Free whole papers; real questions by topic with worked explanations", competitor: "Eight IGCSE courses and seven IB subjects; newer topic questions paid" },
      { label: "Save My Exams", pastPaperPrep: "Notes, exam questions by topic, past papers", competitor: "Free account with limits; full access is paid" },
      { label: "Physics & Maths Tutor", pastPaperPrep: "Free paper lists and topic notes by board", competitor: "No IB; check your exact code is listed" },
    ],
  },
  sections: [
    {
      heading: "What PapaCambridge offers",
      paragraphs: [
        "PapaCambridge covers Cambridge IGCSE, O Level and AS and A Level with free yearly past papers, plus notes and syllabuses. Its shop sells topical papers and solved papers: in our check, topical unsolved packs ran from $20 to $50 and solved packs from $20 to $150, and its topical listings say worked solutions are not included.",
      ],
    },
    {
      heading: "PastPaperPrep: free topical practice with worked answers",
      paragraphs: [
        "If you came to PapaCambridge for topical questions, PastPaperPrep sorts real Cambridge questions by syllabus topic for Maths 0580, Additional Maths 0606, Biology 0610, Chemistry 0620, Physics 0625, Co-ordinated Sciences 0654, Economics 0455 and Computer Science 0478. Every question has a worked explanation, and older years are free.",
        "Whole past papers are free for every year we hold, with the mark scheme beside the paper, a timer and self-marking.",
      ],
      links: [
        { href: "/past-papers/igcse", label: "Free IGCSE papers" },
        { href: "/banks/igcse-chemistry-0620?topic=Stoichiometry", label: "Example: 0620 Stoichiometry questions" },
      ],
    },
    freeAccessSection([
      { href: "/#question-banks", label: "All question banks" },
    ]),
    {
      heading: "Save My Exams and Physics & Maths Tutor",
      paragraphs: [
        "Save My Exams pairs notes with exam questions by topic and past papers; full access is paid. Physics & Maths Tutor lists papers and topic notes for Cambridge IGCSE sciences, Maths and other subjects, free, but has no IB section.",
      ],
    },
  ],
  faqs: [
    { question: "Is PapaCambridge free?", answer: "Its yearly past papers are free. Topical papers, solved papers and other premium packs are sold in its shop." },
    { question: "Where can I get free Cambridge topical questions with answers?", answer: "PastPaperPrep's topic banks have free older-year questions for eight IGCSE courses, each with the mark scheme and a worked explanation." },
    { question: "Does PapaCambridge have worked solutions?", answer: "Its paid solved packs do. Its topical unsolved packs say worked solutions are not included." },
  ],
  relatedBanks: [
    { href: "/#question-banks", label: "PastPaperPrep question banks" },
    { href: "/cambridge-igcse", label: "Cambridge IGCSE banks" },
  ],
  sources: [
    { href: "https://pastpapers.papacambridge.com/", label: "PapaCambridge past papers" },
    { href: "https://papacambridge.com/category/past-papers/", label: "PapaCambridge shop: past-paper packs" },
    { href: "https://www.physicsandmathstutor.com/past-papers/", label: "Physics & Maths Tutor past papers" },
  ],
};

const PMT_ALTERNATIVES: Article = {
  draft: false,
  slug: "best-physics-and-maths-tutor-alternatives",
  title: "Best Physics & Maths Tutor Alternatives for IGCSE and IB",
  description: "Physics & Maths Tutor alternatives for Cambridge IGCSE and IB: free past papers, topic-sorted real questions with worked answers, and IB coverage PMT doesn't have.",
  eyebrow: "IGCSE and IB revision",
  answer: "Physics & Maths Tutor is a strong free library for UK GCSE, IGCSE and A-level, but it has no IB section and leaves you to assemble topic practice yourself. PastPaperPrep covers both Cambridge IGCSE and IB with free whole papers and real questions sorted by topic, each with a worked explanation. Save My Exams and Revision Village are paid options with notes and exam-style questions.",
  answerLink: { href: "/past-papers", label: "Open a free past paper" },
  publishedAt: "2026-11-08",
  updatedAt: "2026-11-08",
  readingMinutes: 5,
  comparison: {
    caption: "Physics & Maths Tutor and alternatives",
    headings: ["Resource", "Best for", "What to check"],
    rows: [
      { label: "Physics & Maths Tutor", pastPaperPrep: "Free papers, notes and topic questions for UK boards and CAIE IGCSE", competitor: "No IB; you assemble topic practice from separate files" },
      { label: "PastPaperPrep", pastPaperPrep: "IGCSE and IB papers free; real questions by topic with worked explanations", competitor: "Newer topic questions and PDF worksheets are paid" },
      { label: "Save My Exams", pastPaperPrep: "Notes, exam questions by topic, flashcards across many boards", competitor: "Free account with limits; full access is paid" },
      { label: "Revision Village", pastPaperPrep: "IB exam-style questions with video solutions", competitor: "Full access on its paid Gold plan" },
    ],
  },
  sections: [
    {
      heading: "Where PMT is strong, and where it stops",
      paragraphs: [
        "Physics & Maths Tutor covers GCSE, IGCSE, AS and A-level, with past papers, notes and questions by topic for many boards, including Cambridge IGCSE sciences and Maths. It carries ads and sells tuition and courses separately.",
        "It has no IB section, and its topic questions are separate files rather than one searchable bank, so building a set on one weak topic takes manual work.",
      ],
    },
    {
      heading: "PastPaperPrep: IGCSE and IB, sorted by topic",
      paragraphs: [
        "PastPaperPrep has free whole papers with mark schemes for eight Cambridge IGCSE courses and seven IB subjects. Its topic banks sort the same real questions by syllabus topic, and every question has a worked explanation, so you can drill one weak area and check your method question by question.",
      ],
      links: [
        { href: "/past-papers/igcse", label: "Free IGCSE papers" },
        { href: "/past-papers/ib", label: "Free IB papers" },
        { href: "/banks/igcse-physics-0625?topic=Motion%2C%20forces%20and%20energy", label: "Example: 0625 Motion, forces and energy" },
      ],
    },
    freeAccessSection([
      { href: "/#question-banks", label: "All question banks" },
    ]),
    {
      heading: "Save My Exams and Revision Village",
      paragraphs: [
        "Save My Exams adds teacher-written notes, exam questions by topic and flashcards across many boards, with full access on paid plans. Revision Village is the main IB-specific option, with exam-style question banks and video solutions, mostly on its paid Gold plan.",
      ],
    },
  ],
  faqs: [
    { question: "Does Physics & Maths Tutor have IB resources?", answer: "Its site lists GCSE, IGCSE, AS and A-level resources, with no IB section. For IB past papers and topic practice, use an IB-specific resource such as PastPaperPrep or Revision Village." },
    { question: "Is Physics & Maths Tutor free?", answer: "Its revision resources and past papers are free to use; it carries ads and sells tuition and courses separately." },
    { question: "What is the best PMT alternative for topic practice?", answer: "PastPaperPrep sorts real IGCSE and IB past-paper questions by topic with a worked explanation for each; older years are free." },
  ],
  relatedBanks: [
    { href: "/#question-banks", label: "PastPaperPrep question banks" },
    { href: "/cambridge-igcse", label: "Cambridge IGCSE banks" },
    { href: "/ib", label: "IB banks" },
  ],
  sources: [
    { href: "https://www.physicsandmathstutor.com/", label: "Physics & Maths Tutor" },
    { href: "https://www.physicsandmathstutor.com/past-papers/", label: "PMT past papers" },
    { href: "https://www.savemyexams.com/", label: "Save My Exams" },
    { href: "https://www.revisionvillage.com/", label: "Revision Village" },
  ],
};

export const SUBJECT_GAP_GUIDES: readonly Article[] = [
  ADD_MATHS_0606,
  CS_0478,
  IB_ECONOMICS,
  IB_CS,
  FREE_IB_PAPERS,
  ZNOTES_ALTERNATIVES,
  PAPACAMBRIDGE_ALTERNATIVES,
  PMT_ALTERNATIVES,
];
