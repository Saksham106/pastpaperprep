import type { Article } from "@/lib/articles";

/**
 * Guides for the three newest banks (added 2026-11-24): Cambridge A Level Computer Science 9618, Cambridge A Level
 * Further Mathematics 9231 and IB Business Management HL/SL. Before this, none of them had an article or an article
 * link pointing at it.
 *
 * Topics come from research done the same day: Google autocomplete (strongest clusters: "9618 paper 2 insert",
 * "9618 pseudocode guide", "9618 topical past papers"; "9231 threshold 2026", "9231 topical", "9231 syllabus";
 * "ib business management past papers by topic", "ib business management 10 mark question structure"), r/IBO threads
 * on BM 10-markers, Paper 1 case studies and the HL Paper 3 17-marker (r/alevel was rate-limited, so the A Level
 * guides make no Reddit claims), and competitor pages fetched on 24 November 2026 (no logins).
 *
 * Facts: Cambridge 9618 syllabus 2027-2029 (v3) and its pseudocode guide; a May/June 2023 9618/21 insert; Cambridge
 * 9231 syllabus 2026-2027 (v5) and the 9231 grade threshold tables pinned in the 9231 content workspace
 * (data/extras/9231-*-gt.pdf); the IB Business Management guide (first assessment 2024). Question counts are from
 * production bank data on 2026-11-24.
 *
 * Explanation coverage: none of these banks has worked explanations yet, so nothing here mentions them.
 */

const CIE = (slug: string, label: string) => ({ href: `https://www.cambridgeinternational.org/programmes-and-qualifications/${slug}/`, label: `Cambridge International: ${label}` });
const SYLLABUS_9618 = CIE("cambridge-international-as-and-a-level-computer-science-9618", "AS & A Level Computer Science 9618");
const SYLLABUS_9618_PDF = { href: "https://www.cambridgeinternational.org/Images/721397-2027-2029-syllabus.pdf", label: "Cambridge International: 9618 syllabus for 2027 to 2029" };
const PSEUDOCODE_GUIDE_9618 = { href: "https://www.cambridgeinternational.org/Images/721401-2027-2029-pseudocode-guide.pdf", label: "Cambridge International: 9618 pseudocode guide for 2027 to 2029" };
const SYLLABUS_9231 = CIE("cambridge-international-as-and-a-level-mathematics-further-9231", "AS & A Level Further Mathematics 9231");
const THRESHOLD_TABLES = CIE("cambridge-advanced/cambridge-international-as-and-a-levels/grade-threshold-tables", "AS & A Level grade threshold tables");
const IB_BM = { href: "https://www.ibo.org/programmes/diploma-programme/curriculum/individuals-and-societies/business-management/", label: "International Baccalaureate: DP Business Management" };

const SME_9618 = { href: "https://www.savemyexams.com/a-level/computer-science/cie/19/", label: "Save My Exams: CIE A Level Computer Science" };
const PASTOPIC_9618 = { href: "https://pastopic.com/cambridge/computer-science-9618", label: "Pastopic: Computer Science 9618" };
const PAPA_9618 = { href: "https://pastpapers.papacambridge.com/papers/caie/as-and-a-level-computer-science-9618", label: "PapaCambridge: Computer Science 9618" };
const SME_9231 = { href: "https://www.savemyexams.com/a-level/further-maths/cie/", label: "Save My Exams: CIE A Level Further Maths" };
const PASTOPIC_9231 = { href: "https://pastopic.com/cambridge/further-mathematics-9231", label: "Pastopic: Further Mathematics 9231" };
const CAMBRIDGE_ASSISTANT_9231 = { href: "https://cambridgeassistant.com/topicalpastpapers/9231", label: "Cambridge Assistant: 9231 topical questions" };
const PAPA_9231 = { href: "https://pastpapers.papacambridge.com/papers/caie/as-and-a-level-mathematics-further-9231", label: "PapaCambridge: Further Mathematics 9231" };
const RV_BM_HL = { href: "https://www.revisionvillage.com/ib-business/hl/questionbank/", label: "Revision Village: IB Business Management HL questionbank" };
const PPP_PRICING = { href: "https://pastpaperprep.com/pricing", label: "PastPaperPrep pricing" };

const CS_9618_PAPER_2: Article = {
  draft: false,
  slug: "a-level-computer-science-9618-paper-2-pseudocode",
  title: "9618 Paper 2: The Insert, Pseudocode and How to Practise",
  description: "What the Cambridge 9618 Paper 2 insert gives you, what pseudocode you still have to know by heart, and how to practise Paper 2 with real past-paper questions.",
  eyebrow: "Cambridge A Level Computer Science 9618",
  answer: "9618 Paper 2 is a two-hour, 75-mark paper answered in Cambridge pseudocode. The insert lists the built-in functions (string, character, number, date and EOF) and the operators, so you don't need to memorise LEFT, MID or NUM_TO_STR. It doesn't give you the syntax for declarations, loops, procedures or file handling, so learn those from Cambridge's pseudocode guide and practise writing them on real Paper 2 questions.",
  answerLink: { href: "/banks/a-level-computer-science-9618/papers/paper-2", label: "Practise real Paper 2 questions" },
  publishedAt: "2026-11-24",
  updatedAt: "2026-11-24",
  readingMinutes: 7,
  sections: [
    {
      heading: "What Paper 2 is",
      paragraphs: [
        "Paper 2, Fundamental Problem-solving and Programming Skills, is one of the two AS papers. It lasts 2 hours, is worth 75 marks and covers syllabus sections 9 to 12: algorithm design, data types and structures, programming and software development. It's 50% of the AS and 25% of the full A Level, and calculators aren't allowed.",
        "You write your answers in pseudocode, not in Python or Java. That catches people out: the syllabus says you won't be asked to write program code, but most of the marks still come from writing working algorithms, just in Cambridge's pseudocode style.",
        "In our bank of 238 Paper 2 questions from 2021 to 2026, about half (116) ask you to write or complete pseudocode. Programming is the biggest topic by far, with 103 questions, then Data Types and Structures, Software Development and Algorithm Design at 41 to 47 each.",
      ],
    },
    {
      heading: "What the insert gives you",
      paragraphs: [
        "Every Paper 2 comes with a separate insert. Cambridge says it \"contains all the resources referred to in the questions\", and you can annotate it but not write answers on it. The May/June 2023 insert for 9618/21, for example, listed:",
      ],
      bullets: [
        "String and character functions: LEFT, RIGHT, MID, LENGTH, TO_UPPER, TO_LOWER, NUM_TO_STR, STR_TO_NUM, IS_NUM, ASC and CHR, each with its parameters, return type and an example.",
        "Numeric functions: INT and RAND.",
        "Date functions: DAY, MONTH, YEAR, DAYINDEX, SETDATE and TODAY.",
        "The text file function EOF.",
        "Operators such as & for joining strings, and AND and OR.",
      ],
    },
    {
      heading: "What you still need to know by heart",
      paragraphs: [
        "The insert only covers functions and operators. Everything else is on you, and it's where students lose easy marks:",
      ],
      bullets: [
        "DECLARE with the right data types, CONSTANT, and 1D and 2D arrays with their bounds.",
        "IF ... THEN ... ELSE ... ENDIF, CASE OF ... OTHERWISE ... ENDCASE, and the three loops: FOR ... NEXT, WHILE ... ENDWHILE and REPEAT ... UNTIL.",
        "PROCEDURE and FUNCTION headers, BYREF and BYVAL, RETURNS and RETURN, and CALL.",
        "File handling: OPENFILE ... FOR READ, WRITE or APPEND, READFILE, WRITEFILE and CLOSEFILE. EOF is in the insert, but these commands aren't, and dozens of Paper 2 questions use a text file.",
        "User-defined record types (TYPE ... ENDTYPE) and how to access their fields.",
      ],
    },
    {
      heading: "Use Cambridge's pseudocode guide",
      paragraphs: [
        "Cambridge publishes a Pseudocode Guide for Teachers for each syllabus period. The 2027 to 2029 edition is 44 pages and sets out the exact style examiners expect: keywords in capitals, the ← assignment arrow, indentation, and every statement listed above. It also says string functions \"will always be provided in examinations\", which is why they're in the insert.",
        "Read it once properly, then keep a one-page summary of the statements the insert leaves out. That summary is the thing to memorise.",
      ],
      links: [
        { href: "https://www.cambridgeinternational.org/Images/721401-2027-2029-pseudocode-guide.pdf", label: "9618 pseudocode guide (Cambridge, PDF)" },
      ],
    },
    {
      heading: "How to practise Paper 2",
      paragraphs: [
        "Write answers by hand, the way you will in the exam. Typing into an editor that autocompletes hides the mistakes examiners mark down, like a missing ENDWHILE or an undeclared variable.",
        "Work by question type first. Do a set of file-handling questions, then a set of string-processing questions that use MID and LENGTH, then trace tables, then structure charts and state-transition diagrams. Once each type feels routine, sit a full Paper 2 in two hours.",
        "When you mark, check the logic against the mark scheme rather than the exact wording. Mark schemes give credit for the steps, so note which step you missed, not just the score.",
      ],
      links: [
        { href: "/banks/a-level-computer-science-9618/topics/programming", label: "9618 Programming questions" },
        { href: "/past-papers/a-level-computer-science-9618/paper-2", label: "Free 9618 Paper 2 whole papers" },
      ],
    },
    {
      heading: "Where to practise",
      paragraphs: [
        "Full disclosure: PastPaperPrep is our site. Our 9618 bank sorts all 750 questions from Papers 1 to 3 (2021 to 2026) by paper and syllabus topic, so you can pull up only the Paper 2 file-handling or array questions and print them as a worksheet. Questions from 2021 and 2022 are free; newer years cost $6 a month for the bank. Whole papers with mark schemes are free to read. We don't cover Paper 4, the practical.",
        "Other options we checked on 24 November 2026: Save My Exams has a CIE Computer Science course with notes, topic questions and an exam-skills section on writing pseudocode and trace tables. Pastopic is free and sorts 9618 questions by topic. PapaCambridge has the free yearly papers and mark schemes.",
      ],
    },
  ],
  faqs: [
    { question: "Is 9618 Paper 2 in Python or pseudocode?", answer: "Pseudocode. You answer in Cambridge's pseudocode style; Paper 4, the practical, is where you write real program code." },
    { question: "What is in the 9618 Paper 2 insert?", answer: "The built-in string, character, numeric, date and file (EOF) functions with examples, plus the operators. It does not include loops, declarations, procedures or file commands like OPENFILE." },
    { question: "Can I write on the insert?", answer: "You can annotate it and use it for planning, but answers go in the question paper." },
    { question: "How long is 9618 Paper 2?", answer: "2 hours for 75 marks. It's 50% of the AS Level and 25% of the A Level." },
  ],
  relatedBanks: [
    { href: "/banks/a-level-computer-science-9618", label: "A Level Computer Science 9618 by topic" },
    { href: "/articles/a-level-computer-science-9618-past-papers-by-topic", label: "9618 past papers by topic" },
    { href: "/banks/igcse-computer-science-0478", label: "IGCSE Computer Science 0478 by topic" },
  ],
  sources: [SYLLABUS_9618_PDF, PSEUDOCODE_GUIDE_9618, SYLLABUS_9618, SME_9618, PASTOPIC_9618, PAPA_9618, PPP_PRICING],
};

const CS_9618_BY_TOPIC: Article = {
  draft: false,
  slug: "a-level-computer-science-9618-past-papers-by-topic",
  title: "A Level Computer Science 9618 Past Papers by Topic",
  description: "Which topics come up on 9618 Papers 1, 2 and 3, how many past questions each has, and a simple way to practise Computer Science by topic before full papers.",
  eyebrow: "Cambridge A Level Computer Science 9618",
  answer: "Practise 9618 by topic within each paper. Paper 1 is theory (hardware, data representation, processors, databases), Paper 2 is pseudocode problem-solving, and Paper 3 is advanced theory. Across 750 questions from 2021 to 2026, Programming is the biggest topic (103 Paper 2 questions), with Data Representation (55) leading Paper 3 and Hardware (53) leading Paper 1. Drill those first, then sit timed papers.",
  answerLink: { href: "/banks/a-level-computer-science-9618", label: "Open 9618 by topic" },
  publishedAt: "2026-11-24",
  updatedAt: "2026-11-24",
  readingMinutes: 6,
  sections: [
    {
      heading: "How 9618 is examined",
      paragraphs: [
        "AS Level is Papers 1 and 2. The full A Level adds Papers 3 and 4, and each of the four papers is 25% of it. Exams run in the June and November series only.",
      ],
      bullets: [
        "Paper 1, Theory Fundamentals: 1 hour 30 minutes, 75 marks, syllabus sections 1 to 8.",
        "Paper 2, Fundamental Problem-solving and Programming Skills: 2 hours, 75 marks, sections 9 to 12, answered in pseudocode.",
        "Paper 3, Advanced Theory: 1 hour 30 minutes, 75 marks, sections 13 to 20.",
        "Paper 4, Practical: 2 hours 30 minutes, 75 marks, programming on a computer.",
      ],
    },
    {
      heading: "Which topics carry the questions",
      paragraphs: [
        "These counts are from our bank of every Paper 1, 2 and 3 question from 2021 to 2026, grouped by each question's main syllabus topic.",
      ],
      bullets: [
        "Paper 1 (254 questions): Hardware 53, Information representation 47, Processor Fundamentals 40, Databases 30, System Software 29, Communication 22, Security, privacy and data integrity 20, Ethics and Ownership 13.",
        "Paper 2 (238): Programming 103, Data Types and Structures 47, Software Development 47, Algorithm Design and Problem-solving 41.",
        "Paper 3 (258): Data Representation 55, System Software 40, Hardware and Virtual Machines 38, Further Programming 36, Communication and internet technologies 28, Computational thinking and Problem-solving 24, Artificial Intelligence 19, Security 18.",
      ],
    },
    {
      heading: "A topic order that works",
      paragraphs: [
        "For Paper 1, start with Information representation (binary, hexadecimal, two's complement, images and sound) because the calculations are quick marks once they're automatic. Then Hardware and Processor Fundamentals, which share a lot of vocabulary. Databases is worth doing as one block: it came up in all 11 series from June 2021 to June 2026.",
        "For Paper 2, do Programming and Data Types and Structures side by side, since most questions mix them: arrays, records and files inside a procedure. Leave Software Development (testing, structure charts, state-transition diagrams) for later; it's shorter to learn.",
        "For Paper 3, Data Representation (floating point, user-defined types, file organisation) is the largest and most mechanical topic. Further Programming and Computational thinking overlap with what you practised for Paper 2, so they go faster than they look.",
      ],
    },
    {
      heading: "Running a topic session",
      paragraphs: [
        "Pick one topic on one paper and do 8 to 10 questions without notes. Mark them against the mark scheme straight away, and write down the exact point you lost each mark: a definition you half-knew, a calculation step, a missing ENDIF. Next session, start with two of those again before moving on.",
        "Every couple of weeks, sit a whole paper under time. Topic practice finds and fixes gaps; full papers check you can switch between topics at exam pace.",
      ],
      links: [
        { href: "/banks/a-level-computer-science-9618/topics/programming", label: "Programming questions" },
        { href: "/banks/a-level-computer-science-9618/topics/data-types-and-structures", label: "Data Types and Structures questions" },
        { href: "/articles/a-level-computer-science-9618-paper-2-pseudocode", label: "Paper 2 pseudocode and the insert" },
      ],
    },
    {
      heading: "Where to find 9618 questions by topic",
      paragraphs: [
        "Full disclosure: PastPaperPrep is our site. Our bank has all 750 questions from Papers 1 to 3 for 2021 to 2026, sorted by paper, topic and year, with the official mark scheme for each. You can build a printable worksheet from any filter. Questions from 2021 and 2022 (218 of them) are free; newer years cost $6 a month for the bank, or $25 a month for every bank. Whole papers are free to read. We don't cover Paper 4.",
        "Other options we checked on 24 November 2026: Pastopic is free and lists 9618 questions by topic with notes. Save My Exams has a CIE Computer Science course with revision notes, its own topic questions and mocks. PapaCambridge has free yearly papers.",
      ],
    },
  ],
  faqs: [
    { question: "Which 9618 papers are AS Level?", answer: "Papers 1 and 2. Papers 3 and 4 are only taken for the full A Level." },
    { question: "What is the biggest topic in 9618?", answer: "Programming. It is the main topic of 103 of the 238 Paper 2 questions from 2021 to 2026." },
    { question: "Has the 9618 syllabus changed for 2027?", answer: "Cambridge's 2027 to 2029 syllabus lists no content changes. Its updates only clarify which papers each level takes and calculator use, and fix a weblink." },
    { question: "Can I use a calculator in 9618?", answer: "No. Calculators are not allowed in any 9618 paper." },
  ],
  relatedBanks: [
    { href: "/banks/a-level-computer-science-9618", label: "A Level Computer Science 9618 by topic" },
    { href: "/cambridge-a-level", label: "All Cambridge A Level banks" },
    { href: "/articles/best-igcse-computer-science-0478-resources", label: "IGCSE Computer Science 0478 resources" },
  ],
  sources: [SYLLABUS_9618_PDF, SYLLABUS_9618, PASTOPIC_9618, SME_9618, PAPA_9618, PPP_PRICING],
};

const FM_9231_GUIDE: Article = {
  draft: false,
  slug: "a-level-further-maths-9231-papers-and-topics",
  title: "Cambridge Further Maths 9231: Papers, AS Routes and Topics",
  description: "The four Cambridge 9231 Further Maths papers, which ones make AS or A Level, how much 9709 you need first, and which topics come up most on each paper.",
  eyebrow: "Cambridge A Level Further Mathematics 9231",
  answer: "Cambridge Further Maths 9231 has four papers: Further Pure 1 and 2 (2 hours, 75 marks each), Further Mechanics and Further Probability & Statistics (1 hour 30 minutes, 50 marks each). AS is Paper 1 plus Paper 3 or Paper 4; the A Level is all four. Cambridge strongly recommends studying 9709 first or alongside, and every 9231 paper assumes 9709 Pure 1 and Pure 3.",
  answerLink: { href: "/banks/a-level-further-maths-9231", label: "Practise 9231 by topic" },
  publishedAt: "2026-11-24",
  updatedAt: "2026-11-24",
  readingMinutes: 7,
  sections: [
    {
      heading: "The four papers",
      paragraphs: [
        "Every question on every paper is compulsory; there are no optional questions. Exams run in June and November.",
      ],
      bullets: [
        "Paper 1, Further Pure Mathematics 1: 2 hours, 75 marks, 6 to 8 questions. 60% of AS, 30% of A Level.",
        "Paper 2, Further Pure Mathematics 2: 2 hours, 75 marks, 7 to 9 questions. A Level only, 30%.",
        "Paper 3, Further Mechanics: 1 hour 30 minutes, 50 marks, 5 to 7 questions. 40% of AS, 20% of A Level.",
        "Paper 4, Further Probability & Statistics: 1 hour 30 minutes, 50 marks, 5 to 7 questions. 40% of AS, 20% of A Level.",
      ],
    },
    {
      heading: "AS or A Level: which papers you sit",
      paragraphs: [
        "AS Further Maths is Paper 1 plus either Paper 3 (Mechanics) or Paper 4 (Statistics). The full A Level is all four papers, sat in one series or staged over two, carrying your AS forward. Paper 2 can't be taken for AS.",
        "Choosing between Papers 3 and 4 for AS? Pick the one that builds on what you've done in 9709. Cambridge lists the prior knowledge: Paper 3 assumes 9709 Papers 1, 3 and 4 (Mechanics), and Paper 4 assumes 9709 Papers 1, 3, 5 and 6 (both Statistics papers).",
      ],
    },
    {
      heading: "Do you need A Level Maths 9709?",
      paragraphs: [
        "Not formally, but in practice yes. The syllabus strongly recommends that you have studied, or are studying, 9709 or an equivalent, and says most 9709 content should come first. Papers 1 and 2 assume 9709 Pure 1 and Pure 3.",
        "You can enter 9709 and 9231 in the same series. But Cambridge notes the AS syllabuses aren't designed for sitting AS 9709 and AS 9231 together after one year, because AS Further Maths can assume Pure 3 content.",
        "Both subjects share one formula list, MF19, and you use a scientific calculator.",
      ],
    },
    {
      heading: "What comes up on each paper",
      paragraphs: [
        "These counts are from our bank of every question from 2020 to 2026, grouped by each question's main syllabus topic. Within a paper, the topics are spread fairly evenly, with a few heavyweights.",
      ],
      bullets: [
        "Paper 1 (203 questions): rational functions and graphs 31, summation of series 30, matrices 30, vectors 29, polar coordinates 29, roots of polynomial equations 28, proof by induction 26.",
        "Paper 2 (233): integration 63, differential equations 58, matrices (eigenvalues and eigenvectors) 39, differentiation 37, complex numbers 32. Hyperbolic functions mostly appear inside calculus questions.",
        "Paper 3 (202): circular motion 51, Hooke's law 32, projectile motion 31, equilibrium of a rigid body 30, linear motion under a variable force 29, momentum 29.",
        "Paper 4 (175): inference using normal and t-distributions 59, then chi-squared tests, non-parametric tests, continuous random variables and probability generating functions at 29 each.",
      ],
    },
    {
      heading: "Why 2020 onwards is what matters",
      paragraphs: [
        "9231 was rebuilt for first exams in 2020: two papers became four, the AS was introduced, old Further Mechanics was largely replaced, and hyperbolic functions, continuous random variables, non-parametric tests and probability generating functions were added. Bivariate data was dropped.",
        "The 2023 to 2025 and 2026 to 2027 syllabuses made no significant content changes. So papers from 2020 to 2026 all match what you'll sit, while older papers mix in topics that are gone. If a topical site goes back to 2008, check the year on each question.",
      ],
    },
    {
      heading: "Where to practise 9231 by topic",
      paragraphs: [
        "Full disclosure: PastPaperPrep is our site. Our 9231 bank has all 813 questions from 2020 to 2026, sorted by paper, topic and year with the official mark scheme. Questions from 2020 and 2021 (225) are free; newer years cost $6 a month for the bank. Whole papers are free to read, with a timer and self-marking.",
        "Other options we checked on 24 November 2026: Pastopic is free and lists 9231 questions by topic with notes. Cambridge Assistant has 9231 topical questions going back to 2008 with a free preview. Save My Exams has a CIE Further Maths course with notes and exam-style questions. PapaCambridge has free yearly papers.",
      ],
      links: [
        { href: "/banks/a-level-further-maths-9231/topics/integration", label: "9231 integration questions" },
        { href: "/banks/a-level-further-maths-9231/topics/matrices", label: "9231 matrices questions" },
        { href: "/past-papers/a-level-further-maths-9231", label: "Free 9231 whole papers" },
      ],
    },
  ],
  faqs: [
    { question: "How many papers are in Cambridge Further Maths 9231?", answer: "Four: Further Pure 1, Further Pure 2, Further Mechanics and Further Probability & Statistics." },
    { question: "Which papers make AS Further Maths?", answer: "Paper 1 plus either Paper 3 (Mechanics) or Paper 4 (Statistics)." },
    { question: "Do I have to take 9709 to do 9231?", answer: "It isn't compulsory, but Cambridge strongly recommends studying 9709 first or alongside, and every 9231 paper assumes 9709 Pure 1 and Pure 3." },
    { question: "Which formula list does 9231 use?", answer: "MF19, the same list as A Level Maths 9709." },
  ],
  relatedBanks: [
    { href: "/banks/a-level-further-maths-9231", label: "A Level Further Maths 9231 by topic" },
    { href: "/banks/a-level-maths-9709", label: "A Level Maths 9709 by topic" },
    { href: "/articles/a-level-further-maths-9231-grade-thresholds", label: "9231 grade thresholds" },
  ],
  sources: [SYLLABUS_9231, PASTOPIC_9231, CAMBRIDGE_ASSISTANT_9231, SME_9231, PAPA_9231, PPP_PRICING],
};

const FM_9231_THRESHOLDS: Article = {
  draft: false,
  slug: "a-level-further-maths-9231-grade-thresholds",
  title: "9231 Further Maths Grade Thresholds: June 2026 and Earlier",
  description: "Cambridge 9231 Further Maths grade thresholds for June 2026, November 2025 and earlier: what an A* took, how AS routes differ, and how to use them.",
  eyebrow: "Cambridge A Level Further Mathematics 9231",
  answer: "In June 2026, an A* in Cambridge Further Maths 9231 took 214 of 250 on the variant 1 papers (11, 21, 31, 41), and an A took 181. The total is simply your raw marks added up: 75 + 75 + 50 + 50. For AS, an a took 79 of 125 with Mechanics (11, 31) but 90 with Statistics (11, 41), because the Mechanics paper scored lower.",
  answerLink: { href: "/past-papers/a-level-further-maths-9231", label: "Score a free 9231 paper" },
  publishedAt: "2026-11-24",
  updatedAt: "2026-11-24",
  readingMinutes: 6,
  comparison: {
    caption: "9231 A Level thresholds out of 250, variant 1 papers (11, 21, 31, 41)",
    headings: ["Series", "A* / A", "C / E"],
    rows: [
      { label: "June 2026", pastPaperPrep: "214 / 181", competitor: "125 / 81" },
      { label: "November 2025", pastPaperPrep: "209 / 178", competitor: "123 / 75" },
      { label: "June 2025", pastPaperPrep: "210 / 175", competitor: "117 / 71" },
      { label: "June 2024", pastPaperPrep: "216 / 182", competitor: "117 / 71" },
      { label: "June 2023", pastPaperPrep: "224 / 199", competitor: "140 / 84" },
      { label: "June 2022", pastPaperPrep: "215 / 186", competitor: "128 / 70" },
    ],
  },
  sections: [
    {
      heading: "How 9231 thresholds work",
      paragraphs: [
        "Cambridge sets thresholds after each series is marked: the minimum mark for each grade, for every paper and for every combination of papers. Your grade comes from your total across your papers, not from the paper-by-paper thresholds.",
        "9231 is easy to add up because the weighting matches the raw marks. The A Level is 75 + 75 + 50 + 50 = 250, and the AS is 75 + 50 = 125. A* exists only for the full A Level; AS grades run from a to e.",
      ],
    },
    {
      heading: "June 2026 in detail",
      paragraphs: [
        "On the variant 1 papers, the A Level needed 214 for A*, 181 for A, 148 for B, 125 for C, 103 for D and 81 for E. Variant 2 was identical. Variant 4 (14, 24, 34, 44) was a few marks higher: 217 for A* and 185 for A.",
        "Paper by paper, an A on Paper 11 took 51 of 75, Paper 21 took 63 of 75, Paper 31 took 28 of 50 and Paper 41 took 39 of 50.",
      ],
    },
    {
      heading: "AS: Mechanics or Statistics changes the number",
      paragraphs: [
        "In June 2026 an AS grade a took 79 of 125 with Papers 11 and 31 (Mechanics), and 90 of 125 with Papers 11 and 41 (Statistics). For an e, it was 30 and 38. November 2025 showed the same gap: 74 against 87 for an a.",
        "That doesn't make Mechanics the easy route. The Mechanics paper's own A threshold was 28 of 50 against 39 for Statistics, which means candidates scored lower on it. Choose the option that matches the 9709 papers you've studied.",
      ],
    },
    {
      heading: "Thresholds move between series",
      paragraphs: [
        "The A boundary on the variant 1 papers fell from 199 in June 2023 to 182 in June 2024 and 175 in June 2025, then rose to 181 in June 2026. A* moved from 224 to 210 and back up to 214 over the same years.",
        "So a mark that was an A one year might be a B the next, or the other way round. Don't aim for last year's number; aim to be comfortably above it.",
      ],
    },
    {
      heading: "Using thresholds with past papers",
      paragraphs: [
        "When you mark a practice paper, compare it with that paper's own component threshold from the same series, not a single number for all years. Track your marks on each topic as you go: if circular motion or chi-squared tests keep costing you marks, those are your next topic sessions.",
        "Our whole 9231 papers are free to read, with a timer and self-marking, and the topical bank lets you drill the weak topics afterwards.",
      ],
      links: [
        { href: "/past-papers/a-level-further-maths-9231", label: "Free 9231 whole papers" },
        { href: "/banks/a-level-further-maths-9231", label: "9231 questions by topic" },
        { href: "/articles/cambridge-a-level-grade-boundaries", label: "Other A Level grade boundaries" },
      ],
    },
  ],
  faqs: [
    { question: "What was the 9231 A* threshold in June 2026?", answer: "214 out of 250 for Papers 11, 21, 31 and 41, and 217 for Papers 14, 24, 34 and 44." },
    { question: "Is there an A* in AS Further Maths?", answer: "No. AS grades run from a to e; A* is only awarded for the full A Level." },
    { question: "Why is the AS threshold lower with Mechanics?", answer: "Because candidates scored lower on the Further Mechanics paper, its thresholds were lower. The grade is no easier to get." },
    { question: "Where does Cambridge publish 9231 grade thresholds?", answer: "On its AS & A Level grade threshold tables page, with a document for each series." },
  ],
  relatedBanks: [
    { href: "/banks/a-level-further-maths-9231", label: "A Level Further Maths 9231 by topic" },
    { href: "/articles/a-level-further-maths-9231-papers-and-topics", label: "9231 papers, AS routes and topics" },
    { href: "/articles/cambridge-a-level-grade-boundaries", label: "Cambridge A Level grade boundaries 2026" },
  ],
  sources: [THRESHOLD_TABLES, SYLLABUS_9231],
};

const BM_BY_TOPIC: Article = {
  draft: false,
  slug: "ib-business-management-past-papers-by-topic",
  title: "IB Business Management Past Papers by Topic (HL and SL)",
  description: "How the three IB Business Management papers work under the 2024 guide, which units each paper leans on, and how to practise past papers by topic at HL and SL.",
  eyebrow: "IB Business Management",
  answer: "Practise IB Business Management by unit within each paper. Paper 1 (SL and HL) is built on a case study and leans on Unit 1; Paper 2 is quantitative and is dominated by Unit 3, Finance and accounts; HL Paper 3 is one social-enterprise question worth 2, 6 and 17 marks. Drill finance calculations and 10-mark answers by topic, then sit timed papers.",
  answerLink: { href: "/banks/ib-business-management-hl", label: "Practise IB Business Management by topic" },
  publishedAt: "2026-11-24",
  updatedAt: "2026-11-24",
  readingMinutes: 7,
  sections: [
    {
      heading: "The papers under the 2024 guide",
      paragraphs: [
        "The current guide was first assessed in 2024. Every paper starts with 5 minutes of reading time.",
      ],
      bullets: [
        "Paper 1 (SL and HL, the same paper): 1 hour 30 minutes, 30 marks. Section A is 20 marks of structured questions; Section B is one 10-mark extended response from two. It's based on a case study and counts for 35% at SL and 25% at HL.",
        "Paper 2: unseen, mostly quantitative stimulus. SL is 1 hour 30 minutes for 40 marks (35%); HL is 1 hour 45 minutes for 50 marks (30%) and includes the HL extension topics. Section B is one 20-mark question from two at both levels.",
        "Paper 3 (HL only): 1 hour 15 minutes, 25 marks, 25%. One compulsory question on a social enterprise.",
      ],
    },
    {
      heading: "Paper 1 and the pre-released statement",
      paragraphs: [
        "About three months before the exam, the IB releases a statement with the start of the case study (roughly 200 words) and a few contemporary topics to research for around 5 hours. The full case, about 800 to 1,000 words, is only seen in the exam. Teachers receive the statement from the IB; if you can't find it, ask your teacher.",
        "Because the case changes every session, practising Paper 1 by topic means using old cases to rehearse the question types: definitions, short explanations, simple calculations and the 10-mark evaluation.",
      ],
    },
    {
      heading: "Which units each paper leans on",
      paragraphs: [
        "These counts are from our HL bank of 260 questions from November 2020 to May 2026, grouped by each question's main unit.",
      ],
      bullets: [
        "Paper 1 (134 questions): Unit 1 Introduction to business management 38, Unit 2 Human resource management 27, Unit 3 Finance and accounts 26, Unit 4 Marketing 26, Unit 5 Operations management 15.",
        "Paper 2 (105): Unit 3 Finance and accounts 43, Unit 5 Operations management 27, then Units 1, 2 and 4 at 10 to 12 each.",
        "Paper 3 (21): every question is set on a social enterprise; Human resource management is the most common main unit.",
      ],
    },
    {
      heading: "How to practise",
      paragraphs: [
        "Paper 2 rewards drilling. Ratio analysis, break-even, investment appraisal, cash flow and final accounts come back every session, and the formulae are in the guide. Do a set of Unit 3 calculations each week until they're automatic, then do Unit 5's (stock control, capacity utilisation, productivity).",
        "For both papers, practise the 10-mark question as its own skill: a short plan, then an argued answer that uses a business management tool and the case. Our guide to the 10-marker covers what the markbands ask for.",
        "HL students should treat Paper 3 separately: the 2-mark and 6-mark questions are quick, but the 17-mark plan for the social enterprise is most of the paper, so time it.",
      ],
      links: [
        { href: "/banks/ib-business-management-hl/topics/unit-3-finance-and-accounts", label: "HL Finance and accounts questions" },
        { href: "/banks/ib-business-management-hl/papers/paper-2", label: "HL Paper 2 questions" },
        { href: "/articles/ib-business-management-10-mark-questions", label: "How to write the 10-marker" },
      ],
    },
    {
      heading: "Which past papers still count",
      paragraphs: [
        "The 2024 guide changed the format. The old Paper 1 used a pre-seen case booklet released months ahead, and the old Paper 2 had a concept essay in Section C. Business content carries over well, so older questions are still useful topic practice, but use papers from May 2024 onwards when you rehearse the current format and timing.",
      ],
    },
    {
      heading: "Where to practise by topic",
      paragraphs: [
        "Full disclosure: PastPaperPrep is our site. Our IB Business Management banks hold real IB questions from November 2020 to May 2026, 260 at HL and 218 at SL, each sorted by unit and paper with its official markscheme. Questions from the 2020 and 2021 sessions are free; newer years cost $6 a month for a bank.",
        "Revision Village has separate HL and SL questionbanks organised by unit and toolkit; when we checked on 24 November 2026, Unit 1 carried no label and Units 2 to 5 and the toolkit were marked RV Gold, its paid tier.",
      ],
    },
  ],
  faqs: [
    { question: "Is IB Business Management Paper 1 the same for SL and HL?", answer: "Yes. Paper 1 is the same 30-mark, 1 hour 30 minute paper at both levels; it counts for 35% at SL and 25% at HL." },
    { question: "Which unit comes up most on Paper 2?", answer: "Unit 3, Finance and accounts. It's the main unit of 43 of our 105 HL Paper 2 questions from 2020 to 2026." },
    { question: "How is HL Paper 3 structured?", answer: "One compulsory social-enterprise question in three parts worth 2, 6 and 17 marks, 25 marks in 1 hour 15 minutes." },
    { question: "Are pre-2024 Business Management papers still useful?", answer: "For topic practice, yes, as most content carries over. For timing and format, use May 2024 onwards." },
  ],
  relatedBanks: [
    { href: "/banks/ib-business-management-hl", label: "IB Business Management HL by topic" },
    { href: "/banks/ib-business-management-sl", label: "IB Business Management SL by topic" },
    { href: "/ib", label: "All IB banks" },
  ],
  sources: [IB_BM, RV_BM_HL, PPP_PRICING],
};

const BM_TEN_MARKER: Article = {
  draft: false,
  slug: "ib-business-management-10-mark-questions",
  title: "How to Write the IB Business Management 10-Marker",
  description: "What the IB Business Management markbands ask for in a 10-mark answer, a structure that hits every band descriptor, and how the HL Paper 3 17-marker differs.",
  eyebrow: "IB Business Management",
  answer: "A top-band IB Business Management 10-marker answers the exact question, uses a relevant business tool or theory accurately, weaves in evidence from the case, argues both sides with support, and explains the limitations of the case or data. A simple structure: define the key term, two supported points for, two against, a limitation, then a justified conclusion.",
  answerLink: { href: "/banks/ib-business-management-hl", label: "Practise real 10-mark questions" },
  publishedAt: "2026-11-24",
  updatedAt: "2026-11-24",
  readingMinutes: 6,
  sections: [
    {
      heading: "Where the 10-markers are",
      paragraphs: [
        "Paper 1 Section B is one 10-mark extended response, chosen from two, and Paper 2 has 10-mark questions too. Together they're a big share of the course: 105 of the 260 questions in our HL bank from 2020 to 2026 are worth 10 marks, and 91 of the 218 at SL.",
        "The guide marks Section B of Papers 1 and 2 with an analytic markscheme plus markbands, so the band descriptors tell you exactly what to aim for.",
      ],
    },
    {
      heading: "What the top band asks for",
      paragraphs: [
        "In the guide, the 9 to 10 band has four parts. Use them as a checklist when you plan:",
      ],
      bullets: [
        "A clear focus on the demands of the question: answer what's asked, with its command term (discuss, evaluate, recommend).",
        "Relevant and accurate use of business management tools and theories, such as SWOT, STEEPLE, the Ansoff matrix or a decision tree, picked because they fit the question.",
        "Information from the case or stimulus integrated to support the argument, beyond just naming the company or the people.",
        "Arguments that are substantiated and balanced, with an explanation of the limitations of the case study or stimulus material.",
      ],
    },
    {
      heading: "A structure that works",
      paragraphs: [
        "Teachers and examiners on r/IBO give much the same advice, and it maps straight onto the band descriptors:",
      ],
      bullets: [
        "One or two sentences: define the key term and say what you'll weigh up.",
        "Two points for, each explained and tied to a fact from the case.",
        "Two points against, done the same way.",
        "One limitation: what the case doesn't tell you, how reliable the data is, or what you'd want to know.",
        "A conclusion that answers the question, says which side wins and why, and when that might change.",
      ],
    },
    {
      heading: "Common ways to drop a band",
      paragraphs: [],
      bullets: [
        "One-sided answers. The 5 to 6 band is \"substantiated but mostly one-sided\".",
        "Using the case only for names. The 3 to 4 band describes use that doesn't go beyond the name of the person or organisation.",
        "A tool dropped in without using it. A SWOT table with no argument built from it earns little.",
        "A conclusion that just repeats the points instead of making a judgement.",
      ],
    },
    {
      heading: "The HL Paper 3 17-marker is different",
      paragraphs: [
        "Paper 3 is one compulsory question about a social enterprise, worth 25 marks in three parts: 2, 6 and 17 marks. The stimulus is a short introduction, a product visual and five or six documents such as emails, social media posts or newspaper articles.",
        "The final part asks you to recommend a plan for the enterprise, and it's marked with assessment criteria rather than the 10-mark markbands. Treat it as a short business plan: use the documents as evidence, recommend clearly, and spend most of the 75 minutes on it.",
      ],
    },
    {
      heading: "Practise with real questions",
      paragraphs: [
        "Write one 10-marker a week under 20 minutes, then mark it against the official markscheme and the band descriptors above. Take questions from the units you're weakest in, and rotate between Paper 1 and Paper 2.",
        "Full disclosure: PastPaperPrep is our site. Our IB Business Management banks let you filter real questions by unit, paper and marks, each with its official markscheme. Questions from the 2020 and 2021 sessions are free; newer years cost $6 a month for a bank.",
      ],
      links: [
        { href: "/banks/ib-business-management-hl", label: "HL questions by unit" },
        { href: "/banks/ib-business-management-sl", label: "SL questions by unit" },
        { href: "/articles/ib-business-management-past-papers-by-topic", label: "Business Management past papers by topic" },
      ],
    },
  ],
  faqs: [
    { question: "How long should a Business Management 10-marker take?", answer: "About 20 minutes including a short plan. It's a third of Paper 1's marks in a 90-minute paper." },
    { question: "Do I have to use a business tool in a 10-marker?", answer: "The top band expects relevant and accurate use of business management tools and theories, so use one when it helps your argument." },
    { question: "What does \"limitations of the case study\" mean?", answer: "Explain what the case or data can't tell you, or how reliable it is, and how that affects your conclusion." },
    { question: "How many marks is the Paper 3 final question?", answer: "17 of Paper 3's 25 marks. The other parts are worth 2 and 6." },
  ],
  relatedBanks: [
    { href: "/banks/ib-business-management-hl", label: "IB Business Management HL by topic" },
    { href: "/banks/ib-business-management-sl", label: "IB Business Management SL by topic" },
    { href: "/articles/ib-business-management-past-papers-by-topic", label: "Business Management past papers by topic" },
  ],
  sources: [IB_BM, PPP_PRICING],
};

export const NEW_SUBJECT_ARTICLES: readonly Article[] = [
  CS_9618_PAPER_2,
  CS_9618_BY_TOPIC,
  FM_9231_GUIDE,
  FM_9231_THRESHOLDS,
  BM_BY_TOPIC,
  BM_TEN_MARKER,
];
