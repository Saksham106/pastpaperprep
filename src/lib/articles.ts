export type ArticleSection = {
  heading: string;
  paragraphs: readonly string[];
  bullets?: readonly string[];
};

export type ArticleFaq = {
  question: string;
  answer: string;
};

export type Article = {
  slug: string;
  title: string;
  description: string;
  eyebrow: string;
  answer: string;
  publishedAt: string;
  updatedAt: string;
  readingMinutes: number;
  sections: readonly ArticleSection[];
  faqs: readonly ArticleFaq[];
  relatedBanks: readonly { href: string; label: string }[];
  comparison?: {
    caption: string;
    headings: readonly [string, string, string];
    rows: readonly { label: string; pastPaperPrep: string; competitor: string }[];
  };
  sources?: readonly { href: string; label: string }[];
};

export const ARTICLES: readonly Article[] = [
  {
    slug: "how-to-use-maths-past-papers-effectively",
    title: "How to Use Maths Past Papers Effectively",
    description: "Use maths past papers to find weak topics, practise deliberately, check the mark scheme, and retest mistakes instead of just collecting scores.",
    eyebrow: "Revision method",
    answer: "The most effective way to use maths past papers is to diagnose a weak topic, practise a short set of related questions, mark the work honestly, record the exact mistake, and retest that skill later. Full timed papers matter, but they work best after targeted practice has repaired the gaps they expose.",
    publishedAt: "2026-08-30",
    updatedAt: "2026-08-30",
    readingMinutes: 7,
    sections: [
      {
        heading: "Start with a diagnostic, not a marathon",
        paragraphs: [
          "A full paper can tell you where marks are leaking, but doing full paper after full paper often repeats the same mistakes. Begin with one paper or a mixed diagnostic set. Mark it, then group every lost mark by topic and by mistake type.",
          "Keep the categories concrete. “Algebra” is too broad to guide the next session. “Changing the subject when the variable appears twice” or “forgetting the final inequality sign after dividing by a negative” gives you something you can actually practise.",
        ],
        bullets: [
          "Knowledge gap: you did not know the method or fact.",
          "Method gap: you knew the topic but chose the wrong approach.",
          "Execution error: arithmetic, notation, units, or copying went wrong.",
          "Exam error: you misread the command, skipped a part, or managed time badly.",
        ],
      },
      {
        heading: "Practise one weak skill in a focused set",
        paragraphs: [
          "Once a gap is clear, switch from whole papers to questions from that topic. A useful set is long enough to reveal a pattern but short enough to review properly in the same session. Six well-chosen questions with careful corrections beat twenty rushed questions that you never revisit.",
          "Mix easier and harder versions of the skill. Start by rebuilding the method, then include unfamiliar wording or multi-step questions so you learn to recognize when the method applies rather than memorizing one visual pattern.",
        ],
      },
      {
        heading: "Use the mark scheme as feedback, not a script",
        paragraphs: [
          "Finish the attempt before opening the answer. Then compare each line of your work with the mark scheme or worked solution. Do not stop at whether the final answer matches. Find the first line where your reasoning diverged and write one short correction beside it.",
          "If the mark scheme uses a different valid method, check whether yours would still earn the method marks. If you cannot tell, ask a teacher or tutor. The goal is to understand what a complete, creditworthy solution needs to show.",
        ],
        bullets: [
          "Write the missing step in your own words.",
          "Redo the question from a blank page without copying.",
          "Save the question if the mistake is likely to recur.",
          "Record one rule for next time, not a vague note to “be careful.”",
        ],
      },
      {
        heading: "Retest mistakes on a delay",
        paragraphs: [
          "A corrected answer can feel obvious while the mark scheme is still open. That is not the same as being able to solve it independently. Return to the question after a delay, hide the previous work, and solve it again from scratch.",
          "If the same mistake returns, narrow the skill further or use an easier example before trying the exam question again. If the method holds, mix that question with other topics so you must identify the right approach without a topic label giving it away.",
        ],
      },
      {
        heading: "Move back to timed papers when the gaps are smaller",
        paragraphs: [
          "Use full papers to test selection, stamina, and timing after focused practice has improved the weak areas. Sit them under realistic conditions, keep a record of marks by topic, and compare the pattern across several papers rather than obsessing over one score.",
          "The loop is simple: diagnose, target, review, retest, then simulate. A past paper is not just a mock exam. It is a map of what to practise next.",
        ],
      },
    ],
    faqs: [
      {
        question: "Should I do past papers by topic or by year?",
        answer: "Use questions by topic to repair a specific weakness and full papers by year to test timing, question selection, and performance across the whole course. Most students need both modes at different points in the same revision cycle.",
      },
      {
        question: "How many past papers should I do?",
        answer: "There is no useful universal number. Stop counting papers and track whether recurring mistakes are disappearing. A smaller number of papers that you mark, correct, and retest is more useful than a large stack completed without review.",
      },
      {
        question: "When should I look at the mark scheme?",
        answer: "Look after you have made a complete attempt or reached a genuine stopping point. Opening it too early turns problem solving into copying; waiting until the end lets the mark scheme explain exactly where your independent method broke down.",
      },
    ],
    relatedBanks: [
      { href: "/banks/igcse", label: "Cambridge IGCSE Mathematics 0580 question bank" },
      { href: "/#question-banks", label: "IB Mathematics question banks" },
    ],
  },
  {
    slug: "igcse-maths-0580-past-papers-by-topic",
    title: "IGCSE Maths 0580 Past Papers by Topic",
    description: "Practise Cambridge IGCSE Maths 0580 past-paper questions by topic, then combine them into mixed and timed sets as your weak areas improve.",
    eyebrow: "Cambridge IGCSE Mathematics 0580",
    answer: "For IGCSE Maths 0580, topic-based past-paper practice is best used to repair specific gaps before returning to mixed Core or Extended papers. Filter a narrow skill, attempt several real questions without help, review the first point of failure, and retest the skill in a mixed set so the topic label no longer gives away the method.",
    publishedAt: "2026-08-30",
    updatedAt: "2026-08-30",
    readingMinutes: 6,
    sections: [
      {
        heading: "Why practise 0580 questions by topic?",
        paragraphs: [
          "A yearly paper mixes many parts of the syllabus. That makes it useful for an exam simulation, but inefficient when you already know the exact skill costing you marks. Topic filtering lets you see several ways the same idea has been examined and notice the details that change from question to question.",
          "The aim is not to stay in comfortable topic blocks forever. Use the label while learning the pattern, then remove that clue by moving the same skill into a mixed set.",
        ],
      },
      {
        heading: "Build a focused 0580 practice set",
        paragraphs: [
          "Choose one specific gap from a recent paper or class assessment. Filter questions by topic and, when useful, by paper, year, marks, or calculator rules. Select a sequence that begins with a direct version of the skill and ends with a question that combines it with another idea.",
          "Attempt the set on paper and show the algebra, units, constructions, or reasoning that the question requires. Keep the source information attached so you can find the original paper and mark scheme when you review it.",
        ],
        bullets: [
          "One narrow target for the session.",
          "Several question styles, not repeated clones.",
          "A clear stopping time for marking and correction.",
          "At least one later retest without the topic label.",
        ],
      },
      {
        heading: "Separate Core and Extended needs",
        paragraphs: [
          "Use questions that match the route you are preparing for. If you are working toward Extended, secure the underlying Core methods instead of jumping straight to the hardest available questions. Weak foundations turn multi-step questions into avoidable arithmetic and algebra errors.",
          "If you are preparing for Core, do not let an unrelated hard question distort the diagnosis. Focus on the content and demand that belong to your course, then use timed papers from the correct components to check the full exam experience.",
        ],
      },
      {
        heading: "Turn mistakes into the next filter",
        paragraphs: [
          "After marking, record the exact cause of each lost mark. If a trigonometry answer failed because the diagram was read incorrectly, the next set should include interpreting diagrams, not simply every trigonometry question in the bank. If the method was sound but rounding was wrong, practise the required accuracy and final presentation.",
          "PastPaperPrep supports granular filters because useful revision depends on finding materially relevant questions, not just placing every item under one broad chapter. Use the narrowest filter that matches the error, then widen the set once the method is stable.",
        ],
      },
      {
        heading: "Finish with a mixed or timed paper",
        paragraphs: [
          "Topic practice proves that you can execute a method when prompted. A mixed set tests whether you can identify the method yourself. A timed paper then adds pacing, sequencing, and pressure.",
          "Move through those stages instead of treating topic questions and full papers as competing revision methods. Topic sets repair the parts; mixed and timed papers test whether the whole system works.",
        ],
      },
    ],
    faqs: [
      {
        question: "Where can I practise IGCSE Maths 0580 past papers by topic?",
        answer: "PastPaperPrep has a Cambridge IGCSE Mathematics 0580 question bank that can be filtered by topic and other paper details. Full exam years are available to practise free, and selected questions can be assembled into printable sets with the relevant access.",
      },
      {
        question: "Are topical questions enough for IGCSE Maths 0580?",
        answer: "No. Topical questions are useful for repairing weak skills, but you should also complete mixed and timed papers so you practise choosing methods, managing time, and switching between topics without labels.",
      },
      {
        question: "Should I start with easy or hard 0580 questions?",
        answer: "Start at the level that reveals the method clearly. Once you can complete it independently, add questions with unfamiliar wording, more steps, or combined topics. Difficulty should progress with understanding rather than being used as a substitute for it.",
      },
    ],
    relatedBanks: [
      { href: "/banks/igcse", label: "Open the IGCSE Mathematics 0580 question bank" },
      { href: "/banks/igcse-additional", label: "Practise IGCSE Additional Mathematics 0606" },
    ],
    sources: [
      { href: "https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-igcse-mathematics-0580/", label: "Cambridge IGCSE Mathematics (0580)" },
    ],
  },
  {
    slug: "ib-math-past-papers-by-topic",
    title: "IB Math Past Papers by Topic: AA and AI",
    description: "Use IB Math AA and AI past-paper questions by topic to repair weak skills, then move into mixed and timed practice for your exact level.",
    eyebrow: "IB Mathematics AA and AI",
    answer: "IB Math past papers by topic work best as a bridge between learning a concept and sitting a complete paper. Choose the exact AA or AI course and level, practise a narrow skill across several real questions, review the reasoning and mark scheme, then test the skill again in a mixed set where you must recognize the method yourself.",
    publishedAt: "2026-08-30",
    updatedAt: "2026-08-30",
    readingMinutes: 6,
    sections: [
      {
        heading: "Choose the correct IB Math course and level first",
        paragraphs: [
          "Keep AA and AI, and Standard and Higher Level, separate when you build a practice set. A broad search for “IB maths questions” can mix material with different emphasis and demand. Start from the bank that matches your course, then narrow by topic, paper, session, or skill.",
          "The course label is not decoration. It is the boundary that keeps your practice aligned with what you are actually preparing to sit.",
        ],
      },
      {
        heading: "Use topic practice to expose reasoning gaps",
        paragraphs: [
          "IB Mathematics questions often require several connected decisions. A wrong final answer may come from selecting the wrong model, misusing technology, losing an algebraic condition, or failing to communicate a conclusion. Topic practice gives you enough related examples to see which decision keeps breaking.",
          "Mark the first unsupported step rather than only circling the final answer. Your next question should test that decision again, not merely repeat the same surface wording.",
        ],
        bullets: [
          "Identify the mathematical idea the question is testing.",
          "Attempt the full reasoning before opening a solution.",
          "Compare method, notation, and conclusion with the mark scheme.",
          "Save a representative mistake for a delayed retest.",
        ],
      },
      {
        heading: "Do not confuse recognition with mastery",
        paragraphs: [
          "When every question in a set carries the same topic label, the page has already told you which tool to reach for. That is useful while rebuilding a method, but it removes one decision that the exam will demand.",
          "After a focused set, place the same skill among questions from other topics. If you can still identify and execute the method, the practice is transferring. If not, return to the point where recognition failed and make the contrast between the competing methods explicit.",
        ],
      },
      {
        heading: "Review technology use and written communication",
        paragraphs: [
          "Where calculator or technology use is permitted, review more than the number on the screen. Check the setup, the values entered, the accuracy carried through, and the mathematical statement written in the response. Technology can accelerate a correct model; it cannot repair a wrong one.",
          "Your written work should make the logic visible enough to earn the available method and reasoning marks. Use the official mark scheme as evidence of what needs to be communicated, not as a script to memorize.",
        ],
      },
      {
        heading: "Return to full IB papers deliberately",
        paragraphs: [
          "A complete paper tests pacing, transitions, sustained concentration, and decisions across the syllabus. Schedule it after a block of targeted work, then use its mistakes to choose the next topic sets.",
          "That creates a productive loop: full paper, precise diagnosis, topic repair, mixed retest, and another full paper. Each mode has a job; using all of them is stronger than repeating whichever one feels easiest.",
        ],
      },
    ],
    faqs: [
      {
        question: "Can I filter IB Math AA and AI past papers by topic?",
        answer: "Yes. PastPaperPrep keeps separate question banks for IB Mathematics AA HL, AA SL, AI HL, and AI SL, with filters for topic and other source details so your set stays aligned with your course and level.",
      },
      {
        question: "Should I practise IB Math by topic or complete full papers?",
        answer: "Use topic sets to repair a known gap and full papers to test method selection, timing, and endurance. Move from focused to mixed to timed practice rather than choosing only one format.",
      },
      {
        question: "How should I review an IB Math mark scheme?",
        answer: "Find the first place your method stopped earning credit, identify the missing decision or statement, redo the question without copying, and retest the same skill later in a different question. Focus on the reasoning that earns marks, not only the final answer.",
      },
    ],
    relatedBanks: [
      { href: "/banks/ib-hl", label: "IB Mathematics AA HL question bank" },
      { href: "/banks/ib-sl", label: "IB Mathematics AA SL question bank" },
      { href: "/banks/ib-ai-hl", label: "IB Mathematics AI HL question bank" },
      { href: "/banks/ib-ai-sl", label: "IB Mathematics AI SL question bank" },
    ],
    sources: [
      { href: "https://www.ibo.org/programmes/diploma-programme/curriculum/mathematics/", label: "IB Diploma Programme mathematics" },
    ],
  },
  {
    slug: "pastpaperprep-vs-revision-village",
    title: "PastPaperPrep vs Revision Village: Price and Features",
    description: "Compare PastPaperPrep and Revision Village for IB Maths by current price, question practice, worked support, course breadth, and best-fit student.",
    eyebrow: "IB Maths platform comparison",
    answer: "PastPaperPrep is the better fit when you mainly want a lower-cost, filterable bank of real IB Maths past-paper questions and printable practice sets. Revision Village is the broader learning platform: it costs more, but adds video solutions, key concepts, practice and prediction exams, bootcamps, AI support, and other IB subjects. The right choice depends on whether you need focused exam-question practice or a complete teaching-and-revision suite.",
    publishedAt: "2026-08-30",
    updatedAt: "2026-08-30",
    readingMinutes: 6,
    comparison: {
      caption: "PastPaperPrep vs Revision Village at a glance",
      headings: ["Feature", "PastPaperPrep", "Revision Village"],
      rows: [
        { label: "Starting paid price", pastPaperPrep: "$5 monthly for one bank; $48 billed annually", competitor: "$249 billed once for one Gold course" },
        { label: "Broadest listed plan", pastPaperPrep: "$12 monthly for all six maths banks; $96 billed annually", competitor: "$499 billed once for the Complete Learning Suite" },
        { label: "Free access", pastPaperPrep: "Complete older exam years", competitor: "A subset of topics within one course" },
        { label: "Core strength", pastPaperPrep: "Real past-paper questions with granular filters and PDF set building", competitor: "Full learning suite with questionbank, lessons and broader exam preparation" },
        { label: "Worked support", pastPaperPrep: "Answers and source-linked practice", competitor: "Mark schemes and video solutions, plus key concepts and bootcamps" },
        { label: "Course breadth", pastPaperPrep: "Cambridge IGCSE Maths and IB Maths AA/AI", competitor: "A broad range of IBDP subjects" },
      ],
    },
    sections: [
      {
        heading: "The short verdict",
        paragraphs: [
          "Choose PastPaperPrep if your main job is finding the right real IB Maths questions quickly, practising weak topics, and exporting focused sets without paying for a full learning platform. Its plans are organised around one, two, or all six available mathematics banks.",
          "Choose Revision Village if you want teaching content around the questions. Its official Gold page lists a questionbank, practice exams, past papers, key concepts, prediction exams, Newton AI, bootcamps, a mobile app, and video solutions. That is a materially broader product, not simply a more expensive version of the same tool.",
        ],
      },
      {
        heading: "Price comparison",
        paragraphs: [
          "Pricing checked 30 August 2026. PastPaperPrep lists one bank at $5 monthly or $48 billed annually, a subject pair at $8 monthly or $72 annually, and all six banks at $12 monthly or $96 annually. Complete older exam years are available free.",
          "Revision Village lists Free at $0, Single Course Gold at $249 billed once, and its Complete Learning Suite Gold at $499 billed once. Its page displays monthly equivalents, but payment is shown as a one-time charge. Prices and promotions can change, so verify both official pricing pages before buying.",
        ],
      },
      {
        heading: "Where PastPaperPrep wins",
        paragraphs: [
          "PastPaperPrep is purpose-built for targeted past-paper practice. Students can narrow real questions by course, topic, subtopic, year, paper, session, marks, and other useful exam details instead of working through a generic sequence.",
          "It is also much cheaper at the listed prices. That matters if you already learn from a teacher, textbook, or class notes and do not need another full content library. PDF export makes it practical for tutors and teachers building a focused worksheet.",
        ],
      },
      {
        heading: "Where Revision Village wins",
        paragraphs: [
          "Revision Village offers far more instructional support. Its questionbank is arranged by topic and difficulty and advertises mark schemes and video solutions for every question. Key concepts, bootcamps, practice exams, prediction exams, flashcards, AI features, and a mobile app cover more of the learning journey.",
          "Its Complete Learning Suite also spans many IB subjects. A student who wants one platform for Mathematics, sciences, humanities, and languages may get more value from that breadth than from a mathematics-only practice tool.",
        ],
      },
    ],
    faqs: [
      { question: "Is PastPaperPrep cheaper than Revision Village?", answer: "At the prices displayed on 30 August 2026, yes. PastPaperPrep starts at $5 monthly or $48 annually for one bank, while Revision Village lists Single Course Gold at $249 billed once. The products differ substantially in scope, so price alone is not a complete comparison." },
      { question: "Does PastPaperPrep replace Revision Village?", answer: "Not for every student. PastPaperPrep covers focused, filterable past-paper practice and printable sets. Revision Village adds a much broader layer of instruction, video solutions, exam-preparation products, and other IB subjects." },
      { question: "Which is better for an IB Maths tutor?", answer: "PastPaperPrep is useful for quickly assembling targeted real-question sets. Revision Village may suit tutors who also want ready-made explanatory content and video solutions. The better fit depends on what the tutor already provides." },
    ],
    relatedBanks: [
      { href: "/banks/ib-hl", label: "IB Mathematics AA HL question bank" },
      { href: "/banks/ib-sl", label: "IB Mathematics AA SL question bank" },
      { href: "/pricing", label: "See PastPaperPrep pricing" },
    ],
    sources: [
      { href: "https://pastpaperprep.com/pricing", label: "PastPaperPrep pricing" },
      { href: "https://www.revisionvillage.com/revision-village-gold/", label: "Revision Village Gold pricing" },
    ],
  },
  {
    slug: "pastpaperprep-vs-save-my-exams",
    title: "PastPaperPrep vs Save My Exams: Price and Features",
    description: "Compare PastPaperPrep and Save My Exams on pricing, maths past-paper practice, revision notes, videos, subject coverage, and the best use for each.",
    eyebrow: "Revision platform comparison",
    answer: "PastPaperPrep is the focused choice for building precise Cambridge IGCSE and IB Maths practice from real past-paper questions. Save My Exams is the broader revision membership: it costs more per month, but includes syllabus-aligned study guides, step-by-step exam practice, videos, visuals, downloads, and many subjects. Pick PastPaperPrep for targeted maths drilling; pick Save My Exams when you also need teaching and revision content across courses.",
    publishedAt: "2026-08-30",
    updatedAt: "2026-08-30",
    readingMinutes: 6,
    comparison: {
      caption: "PastPaperPrep vs Save My Exams at a glance",
      headings: ["Feature", "PastPaperPrep", "Save My Exams"],
      rows: [
        { label: "Lowest listed paid plan", pastPaperPrep: "$5 monthly for one bank", competitor: "$40 for one month" },
        { label: "Annual price", pastPaperPrep: "$48 one bank; $72 two banks; $96 all six banks", competitor: "$96 for 12 months after a 7-day free trial" },
        { label: "Free access", pastPaperPrep: "Complete older exam years", competitor: "Join page offers a 7-day free trial" },
        { label: "Core strength", pastPaperPrep: "Granular real-question filtering and PDF practice sets", competitor: "Study guides and exam practice across many subjects" },
        { label: "Learning content", pastPaperPrep: "Answers attached to focused exam practice", competitor: "Expert study guides, step-by-step answers, videos, visuals and downloads" },
        { label: "Subject breadth", pastPaperPrep: "Cambridge IGCSE Maths and IB Maths AA/AI", competitor: "Maths plus sciences, humanities, English and more" },
      ],
    },
    sections: [
      {
        heading: "The short verdict",
        paragraphs: [
          "PastPaperPrep is narrower by design. It helps a student or teacher find materially relevant mathematics questions, combine them into a practice set, check answers, and return to weak areas. It makes the most sense when the explanation already comes from school, tutoring, or another resource.",
          "Save My Exams is closer to an all-purpose revision library. Its official join page advertises syllabus-aligned study guides, exam practice with step-by-step answers, real past exams, explainer videos, visuals, PDF downloads, and access across its courses under one membership.",
        ],
      },
      {
        heading: "Price comparison",
        paragraphs: [
          "Pricing checked 30 August 2026. PastPaperPrep lists monthly plans at $5 for one bank, $8 for two related banks, and $12 for all six. Annual billing is $48, $72, or $96 respectively, and complete older exam years can be practised free.",
          "Save My Exams lists $40 for one month, $48 for three months, and $96 for twelve months, with a seven-day free trial shown on the join page. The annual prices meet at $96 only when comparing Save My Exams with PastPaperPrep's all-bank plan; their coverage and feature sets remain different.",
        ],
      },
      {
        heading: "Where PastPaperPrep wins",
        paragraphs: [
          "The maths workflow is more direct. Instead of navigating a broad content library, you can open the exact bank and filter real questions by topic, subtopic, source year, paper, session, marks, and related properties. That supports deliberate practice rather than passive review.",
          "The lower monthly entry price is useful when exams are near or a student needs only one course. Tutors can also use PDF export to turn a precise filter into a printable set without buying a cross-subject learning membership.",
        ],
      },
      {
        heading: "Where Save My Exams wins",
        paragraphs: [
          "Save My Exams covers more subjects and more stages of learning. A student who still needs concepts explained may benefit from its study guides, worked steps, videos, and visuals before attempting exam questions.",
          "Its one membership model is also simpler for households or students revising several subjects. PastPaperPrep currently concentrates on six mathematics banks, so it is not a substitute for a broad science, humanities, or English revision library.",
        ],
      },
    ],
    faqs: [
      { question: "Is PastPaperPrep cheaper than Save My Exams?", answer: "For monthly access, yes at the prices checked on 30 August 2026: PastPaperPrep starts at $5 monthly and Save My Exams lists $40 for one month. Both list a $96 annual option, but those plans include very different products." },
      { question: "Which is better for IGCSE Maths past papers?", answer: "PastPaperPrep is stronger when the goal is granular, real-question filtering and custom practice sets. Save My Exams is stronger when the student also needs notes, videos, worked explanations, and other subjects." },
      { question: "Can I use both?", answer: "Yes. A sensible division is to learn or review a concept in Save My Exams, then use PastPaperPrep to find and retest real mathematics questions that expose whether the skill transfers to exam conditions." },
    ],
    relatedBanks: [
      { href: "/banks/igcse", label: "Cambridge IGCSE Mathematics 0580 question bank" },
      { href: "/banks/igcse-additional", label: "Cambridge IGCSE Additional Mathematics 0606" },
      { href: "/pricing", label: "See PastPaperPrep pricing" },
    ],
    sources: [
      { href: "https://pastpaperprep.com/pricing", label: "PastPaperPrep pricing" },
      { href: "https://www.savemyexams.com/join/", label: "Save My Exams membership pricing" },
    ],
  },
  {
    slug: "pastpaperprep-vs-exam-mate",
    title: "PastPaperPrep vs Exam-Mate: Price and Features",
    description: "Compare PastPaperPrep and Exam-Mate for topical IGCSE and IB Maths past papers, current prices, free access, filters, PDF building, and schools.",
    eyebrow: "Topical past-paper comparison",
    answer: "PastPaperPrep and Exam-Mate are the closest match in this comparison because both help students practise past papers topically. PastPaperPrep is simpler and cheaper for its six supported maths banks, with granular filters and PDF set building in the core product. Exam-Mate supports a much wider curriculum catalogue and sells discounted school accounts, while some quiz and exam-building tools sit in separate services or plans.",
    publishedAt: "2026-08-30",
    updatedAt: "2026-08-30",
    readingMinutes: 6,
    comparison: {
      caption: "PastPaperPrep vs Exam-Mate at a glance",
      headings: ["Feature", "PastPaperPrep", "Exam-Mate Topical Past Papers"],
      rows: [
        { label: "One-month price", pastPaperPrep: "$5 one bank; $8 two banks; $12 all six banks", competitor: "$12 individual subscription" },
        { label: "Twelve-month price", pastPaperPrep: "$48 one bank; $72 two banks; $96 all six banks", competitor: "$120 individual subscription" },
        { label: "Free access", pastPaperPrep: "Complete older exam years", competitor: "Topical and online MCQ access through 2019" },
        { label: "PDF building", pastPaperPrep: "Included with relevant paid access", competitor: "Free tier lists one PDF with five questions; Individual topical plan says Build Exam not included" },
        { label: "Core strength", pastPaperPrep: "Deep filtering across six maths banks", competitor: "Wide curriculum and subject catalogue" },
        { label: "Schools", pastPaperPrep: "No public school-volume table", competitor: "Public annual per-account tiers for 20–500 accounts" },
      ],
    },
    sections: [
      {
        heading: "The short verdict",
        paragraphs: [
          "Choose PastPaperPrep if you study one of its Cambridge IGCSE or IB Mathematics banks and care most about fast, precise filtering, clear source details, answers, and building printable practice. Its narrower catalogue lets the product stay centred on that workflow.",
          "Choose Exam-Mate if you need subjects or curricula outside PastPaperPrep's current six banks, or if a school needs published volume pricing. Its site offers topical and yearly papers alongside separate MCQ, Build Exam, notes, solved-paper, and AI products.",
        ],
      },
      {
        heading: "Price comparison",
        paragraphs: [
          "Pricing checked 30 August 2026. PastPaperPrep costs $5 monthly for one bank, $8 for a subject pair, or $12 for all six banks. Annual prices are $48, $72, and $96. Complete older exam years are available free.",
          "Exam-Mate's Topical Past Papers page lists individual access at $12 for one month, $65 for six months, $120 for twelve months, and $220 for twenty-four months. Its free tier lists topical and MCQ access through 2019. Verify the official pages before purchase because packages and coverage dates can change.",
        ],
      },
      {
        heading: "Where PastPaperPrep wins",
        paragraphs: [
          "For the supported mathematics courses, PastPaperPrep offers a more focused product and lower listed prices. Filters go beyond a broad topic label so a learner can control course, subtopic, source year, paper, session, marks, and other exam-specific properties.",
          "PDF export belongs to the same question-bank workflow. Exam-Mate's individual Topical Past Papers plan explicitly says Build Exam is not included, while its free tier lists one small PDF. Users should compare the exact package they need rather than assuming every tool in Exam-Mate's navigation comes with one subscription.",
        ],
      },
      {
        heading: "Where Exam-Mate wins",
        paragraphs: [
          "Exam-Mate has broader curriculum and subject reach. Its pricing page exposes curriculum and subject selectors, and the surrounding product includes yearly papers, MCQ papers, Build Exam, notes, solved papers, and AI tools. Those services may require separate access, but the overall catalogue is wider.",
          "It also publishes school pricing: annual per-account rates decrease across bands from 20 to 500 accounts, with custom contact available. PastPaperPrep does not currently publish an equivalent institutional-volume table.",
        ],
      },
    ],
    faqs: [
      { question: "Is PastPaperPrep cheaper than Exam-Mate?", answer: "For the listed individual topical plans on 30 August 2026, PastPaperPrep is cheaper for one bank and for all six on an annual basis. Exam-Mate lists $120 for twelve months; PastPaperPrep lists $48 to $96 annually depending on coverage." },
      { question: "Does Exam-Mate include Build Exam with Topical Past Papers?", answer: "Its official Topical Past Papers pricing page says Build Exam is not included in the Individual plan and says users with a Build Exam subscription already receive the topical service. Check the current package details before buying." },
      { question: "Which has more subjects?", answer: "Exam-Mate has the broader catalogue. PastPaperPrep currently focuses on Cambridge IGCSE Mathematics 0580 and 0606 plus IB Mathematics AA and AI at HL and SL." },
    ],
    relatedBanks: [
      { href: "/banks/igcse", label: "Cambridge IGCSE Mathematics 0580 question bank" },
      { href: "/banks/ib-hl", label: "IB Mathematics AA HL question bank" },
      { href: "/pricing", label: "See PastPaperPrep pricing" },
    ],
    sources: [
      { href: "https://pastpaperprep.com/pricing", label: "PastPaperPrep pricing" },
      { href: "https://www.exam-mate.com/topicalpastpapers/pricing", label: "Exam-Mate Topical Past Papers pricing" },
    ],
  },
] as const;

export function getArticle(slug: string): Article | undefined {
  return ARTICLES.find((article) => article.slug === slug);
}
