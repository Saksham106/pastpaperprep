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
  draft?: boolean;
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

export function isPublicArticle(article: Pick<Article, "draft">): boolean {
  return article.draft !== true;
}

export const ALL_ARTICLES: readonly Article[] = [
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
    updatedAt: "2026-09-01",
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
        heading: "Use free resources without building a resource pile",
        paragraphs: [
          "A free resource is useful when it has one clear job in your revision loop. MathsGenie organises Cambridge IGCSE Maths questions and exam booklets into topic-based practice, while Cambridge publishes the official 0580 past papers, mark schemes, examiner reports, and related material that show the real assessment standard.",
          "You do not need to collect every free worksheet on the internet. Use one topic source to repair a precise weakness, then use Cambridge material or a PastPaperPrep mixed set to check whether the method transfers when the topic is no longer announced. Keep the source attached to each saved mistake so you can return to the original question and mark scheme rather than relying on a copied answer with no context.",
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
      { href: "https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-igcse-mathematics-0580/past-papers/", label: "Cambridge IGCSE Mathematics 0580 past papers" },
      { href: "https://mathsgenie.co.uk/igcse/maths/cie", label: "MathsGenie CIE IGCSE Maths resources" },
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
        { label: "Broadest listed plan", pastPaperPrep: "$12 monthly for all twelve banks; $96 billed annually", competitor: "$499 billed once for the Complete Learning Suite" },
        { label: "Free access", pastPaperPrep: "Complete older exam years", competitor: "A subset of topics within one course" },
        { label: "Core strength", pastPaperPrep: "Real past-paper questions with granular filters and PDF set building", competitor: "Full learning suite with questionbank, lessons and broader exam preparation" },
        { label: "Worked support", pastPaperPrep: "Answers and source-linked practice", competitor: "Mark schemes and video solutions, plus key concepts and bootcamps" },
        { label: "Course breadth", pastPaperPrep: "Cambridge IGCSE Maths, IB Maths AA/AI, IB Chemistry, and IB Physics", competitor: "A broad range of IBDP subjects" },
      ],
    },
    sections: [
      {
        heading: "The short verdict",
        paragraphs: [
          "Choose PastPaperPrep if your main job is finding the right real IB Maths questions quickly, practising weak topics, and exporting focused sets without paying for a full learning platform. Its plans are organised around one bank, a related subject pair, or all twelve available banks.",
          "Choose Revision Village if you want teaching content around the questions. Its official Gold page lists a questionbank, practice exams, past papers, key concepts, prediction exams, Newton AI, bootcamps, a mobile app, and video solutions. That is a materially broader product, not simply a more expensive version of the same tool.",
        ],
      },
      {
        heading: "Price comparison",
        paragraphs: [
          "Pricing checked 7 September 2026. PastPaperPrep lists one bank at $5 monthly or $48 billed annually, a subject pair at $8 monthly or $72 annually, and all twelve banks at $12 monthly or $96 annually. Complete older exam years are available free.",
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
          "Its Complete Learning Suite also spans many IB subjects. A student who wants one platform for Mathematics, sciences, humanities, and languages may get more value from that breadth than from PastPaperPrep’s narrower Mathematics, Chemistry, and Physics catalogue.",
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
        { label: "Annual price", pastPaperPrep: "$48 one bank; $72 a subject pair; $96 all twelve banks", competitor: "$96 for 12 months after a 7-day free trial" },
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
          "Pricing checked 7 September 2026. PastPaperPrep lists monthly plans at $5 for one bank, $8 for a related subject pair, and $12 for all twelve banks. Annual billing is $48, $72, or $96 respectively, and complete older exam years can be practised free.",
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
          "Its one membership model is also simpler for households or students revising several subjects. PastPaperPrep currently concentrates on 12 Mathematics, Chemistry, Physics, and Biology banks, so it is not a substitute for a broad science, humanities, or English revision library.",
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
    description: "Compare PastPaperPrep and Exam-Mate for topical IGCSE, IB Maths, Chemistry, and Physics past papers, current prices, free access, filters, PDF building, and schools.",
    eyebrow: "Topical past-paper comparison",
    answer: "PastPaperPrep and Exam-Mate are the closest match in this comparison because both help students practise past papers topically. PastPaperPrep is simpler and cheaper for its 12 supported Mathematics, Chemistry, Physics, and Biology banks, with granular filters and PDF set building in the core product. Exam-Mate supports a much wider curriculum catalogue and sells discounted school accounts, while some quiz and exam-building tools sit in separate services or plans.",
    publishedAt: "2026-08-30",
    updatedAt: "2026-08-30",
    readingMinutes: 6,
    comparison: {
      caption: "PastPaperPrep vs Exam-Mate at a glance",
      headings: ["Feature", "PastPaperPrep", "Exam-Mate Topical Past Papers"],
      rows: [
        { label: "One-month price", pastPaperPrep: "$5 one bank; $8 a subject pair; $12 all twelve banks", competitor: "$12 individual subscription" },
        { label: "Twelve-month price", pastPaperPrep: "$48 one bank; $72 a subject pair; $96 all twelve banks", competitor: "$120 individual subscription" },
        { label: "Free access", pastPaperPrep: "Complete older exam years", competitor: "Topical and online MCQ access through 2019" },
        { label: "PDF building", pastPaperPrep: "Included with relevant paid access", competitor: "Free tier lists one PDF with five questions; Individual topical plan says Build Exam not included" },
        { label: "Core strength", pastPaperPrep: "Deep filtering across 12 Mathematics, Chemistry, Physics, and Biology banks", competitor: "Wide curriculum and subject catalogue" },
        { label: "Schools", pastPaperPrep: "No public school-volume table", competitor: "Public annual per-account tiers for 20–500 accounts" },
      ],
    },
    sections: [
      {
        heading: "The short verdict",
        paragraphs: [
          "Choose PastPaperPrep if you study one of its Cambridge IGCSE, IB Mathematics, IB Chemistry, or IB Physics banks and care most about fast, precise filtering, clear source details, answers, and building printable practice. Its narrower catalogue lets the product stay centred on that workflow.",
          "Choose Exam-Mate if you need subjects or curricula outside PastPaperPrep's current twelve banks, or if a school needs published volume pricing. Its site offers topical and yearly papers alongside separate MCQ, Build Exam, notes, solved-paper, and AI products.",
        ],
      },
      {
        heading: "Price comparison",
        paragraphs: [
          "Pricing checked 7 September 2026. PastPaperPrep costs $5 monthly for one bank, $8 for a subject pair, or $12 for all twelve banks. Annual prices are $48, $72, and $96. Complete older exam years are available free.",
          "Exam-Mate's Topical Past Papers page lists individual access at $12 for one month, $65 for six months, $120 for twelve months, and $220 for twenty-four months. Its free tier lists topical and MCQ access through 2019. Verify the official pages before purchase because packages and coverage dates can change.",
        ],
      },
      {
        heading: "Where PastPaperPrep wins",
        paragraphs: [
          "For the supported courses, PastPaperPrep offers a more focused product and lower listed prices. Filters go beyond a broad topic label so a learner can control course, subtopic, source year, paper, session, marks, and other exam-specific properties.",
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
      { question: "Is PastPaperPrep cheaper than Exam-Mate?", answer: "For the listed individual topical plans on 7 September 2026, PastPaperPrep is cheaper for one bank and for all twelve on an annual basis. Exam-Mate lists $120 for twelve months; PastPaperPrep lists $48 to $96 annually depending on coverage." },
      { question: "Does Exam-Mate include Build Exam with Topical Past Papers?", answer: "Its official Topical Past Papers pricing page says Build Exam is not included in the Individual plan and says users with a Build Exam subscription already receive the topical service. Check the current package details before buying." },
      { question: "Which has more subjects?", answer: "Exam-Mate has the broader catalogue. PastPaperPrep currently focuses on Cambridge IGCSE Mathematics 0580 and 0606, IB Mathematics AA and AI at HL and SL, and IB Chemistry, Physics, and Biology at HL and SL." },
    ],
    relatedBanks: [
      { href: "/banks/igcse", label: "Cambridge IGCSE Mathematics 0580 question bank" },
      { href: "/banks/ib-hl", label: "IB Mathematics AA HL question bank" },
      { href: "/banks/ib-physics-hl", label: "IB Physics HL question bank" },
      { href: "/pricing", label: "See PastPaperPrep pricing" },
    ],
    sources: [
      { href: "https://pastpaperprep.com/pricing", label: "PastPaperPrep pricing" },
      { href: "https://www.exam-mate.com/topicalpastpapers/pricing", label: "Exam-Mate Topical Past Papers pricing" },
    ],
  },
  {
    slug: "how-to-mark-maths-past-paper-mistake-log",
    draft: false,
    title: "How to Mark a Maths Past Paper and Build a Mistake Log",
    description: "A precise way to mark maths past papers, classify recurring errors, repair them, and retest without turning your notebook into a list of regrets.",
    eyebrow: "Past-paper improvement",
    answer: "Do not use a past-paper mark only as a score. Mark each lost mark to the first point where your reasoning stopped working, classify the cause, write a repair action, and retest that exact skill later. A useful mistake log is short enough to review and specific enough to change what you do next time.",
    publishedAt: "2026-09-01",
    updatedAt: "2026-09-01",
    readingMinutes: 8,
    sections: [
      {
        heading: "Mark evidence, not just answers",
        paragraphs: [
          "Finish under the intended conditions: record the qualification, course or tier, paper/component, session, time limit, calculator status, and date. Before opening the mark scheme, write your raw score and flag guesses. A guessed correct answer is not secure evidence.",
          "Then mark against the official mark scheme for that exact paper. For Cambridge IGCSE Mathematics 0580, the current syllabus describes both mathematical techniques and the analysis, interpretation and communication of mathematics as assessment objectives; its command-word guidance also explains what prompts such as calculate, show, determine and sketch expect. For IB Maths AA or AI, identify the exact course, level and paper before using the corresponding official guide and markscheme; do not import a rule from a different course or session.",
          "For every question, record marks earned, marks available, and the first line at which your work diverged from a valid route. If later lines are wrong only because they carry forward an earlier value, log the first cause and note the dependent marks. Accept equivalent methods or answers allowed by the scheme; compare with the published standard, not a model solution's wording."
        ],
        bullets: [
          "Use one colour for missing or invalid work and another for corrections; never overwrite the original attempt.",
          "Circle command words, units, rounding instructions, diagram labels and calculator requirements that you missed.",
          "Write a one-sentence diagnosis before reading a full solution: “I used ___ when the question required ___.”"
        ]
      },
      {
        heading: "Use four error labels, not one vague ‘careless’ label",
        paragraphs: [
          "These four labels are a study tool, not official Cambridge or IB categories. They stop “careless mistake” from hiding a fixable cause. Give each error one primary label and, if useful, one secondary label.",
          "Knowledge (K): you cannot recall or explain a definition, identity, theorem, formula, notation or prerequisite. With the paper closed, can you state what the symbols mean and produce a simple example? If not, repair with retrieval and basic questions, not another full paper.",
          "Method (M): the ingredients are familiar, but you chose the wrong representation or strategy—for example, expanding when factorisation is needed, or applying a trigonometric rule to the wrong triangle. Name the feature that should have triggered the better method.",
          "Execution (E): the plan was sound but a sign, arithmetic, algebra, transcription, graph or calculator-entry error broke it. Rework from the last correct line and add a check aimed at that failure. A calculator can reproduce wrong input, so “the calculator gave…” is not a diagnosis.",
          "Exam technique (T): the mathematics may be available, but the response missed the task: wrong command word, omitted reasoning, early rounding, missing units, misread scale, unauthorised calculator mode, time loss or wrong final form. Cambridge’s syllabus includes communication, accuracy and command-word conventions; check current official material rather than treating a private checklist as a rule."
        ],
        bullets: [
          "K = cannot explain or start the underlying idea.",
          "M = knows relevant ideas but selects the wrong route.",
          "E = route is right; an operation, transcription or calculation breaks it.",
          "T = route may be right; the exam response misses the instruction, format or constraint."
        ]
      },
      {
        heading: "Build a log that forces a next action",
        paragraphs: [
          "One row should describe one repairable event, not an entire bad question. Keep the question number and enough wording to find it again. Cause and prevention are the valuable columns: they turn review into a decision about your next attempt.",
          "Use this template in a notebook, spreadsheet or database:",
          "Date | Bank/course | Paper and question | Topic/skill | Marks lost | Primary tag (K/M/E/T) | First invalid line | Why I did it | Correct principle or trigger | Repair action | Retest date | Result/status",
          "Example: 01 Sep | 0580 Extended Paper 4, Q12b | similarity | 2 | M | chose area ratio before checking corresponding lengths | saw a triangle and used a memorised formula | establish the scale factor, then square it for area | solve two unseen similarity questions and write the trigger first | 04 Sep | pending. This beats “revise similarity”: it specifies what to retrieve, practise and verify.",
          "Add frequency only if it changes your decision. Three identical sign errors justify an intervention; a tally of every lost mark does not. Group rows by tag and skill after marking, then choose at most two high-frequency or high-cost repairs for the next study block."
        ],
        bullets: [
          "Do not log a solution you copied without first writing your own diagnosis.",
          "Separate ‘not attempted’, ‘guessed’, ‘wrong’, and ‘correct but insecure’ where that distinction affects the repair.",
          "Keep a ‘proof of repair’ link or paper/question reference beside each row so a claim of improvement can be checked."
        ]
      },
      {
        heading: "Run the correction loop immediately",
        paragraphs: [
          "A mark scheme is feedback, not a substitute for solving. For each meaningful error, close the scheme and run this six-step loop:",
          "1. Reconstruct: cover the answer and write the givens, target and first step. 2. Locate: compare with the scheme and mark the first invalid line. 3. Explain: state the cause and attach K, M, E or T. 4. Repair: write the smallest rule, micro-example or checklist that prevents this error. 5. Retrieve: solve a close variant without notes, then a less familiar one if correct. 6. Update: record the result and schedule a delayed retest.",
          "For an execution error, do not automatically reread the whole chapter. Recalculate the same expression with an estimation check, reverse operation or substitution. For a method error, compare two candidate methods and write why one fits the structure of the question. For technique, rewrite only the final response in the required form and annotate the trigger you missed.",
          "A correction is not complete when the answer looks familiar. You must produce the reasoning from a blank page and explain why the wrong route was tempting. Retrieval practice can improve later retention, not merely measure it; Roediger and Karpicke found the advantage most clearly on delayed rather than immediate tests."
        ]
      },
      {
        heading: "Retest on a schedule, but do not worship the dates",
        paragraphs: [
          "Use spacing as a default, not a universal prescription. A practical starting sequence is: one close variant in the same session; a fresh question after roughly 2–3 days; a mixed question after about 7–10 days; and a final check 2–4 weeks later. Move the next attempt earlier if the skill is foundational or the first retest fails. Stretch the interval when the answer is produced fluently twice and the error does not recur in mixed practice.",
          "These intervals are an implementation heuristic, not an official Cambridge or IB timetable or a promise that every learner needs four attempts. Reviews support distributed practice, while showing that the best gap depends on the desired retention interval, material and learner. The key contrast is spaced retrieval versus rereading a correction while it remains in working memory.",
          "At each retest, hide the old solution, change at least one surface feature, and record a binary result plus a confidence note: solved independently, solved with a prompt, or failed. A prompt is useful evidence but not a pass. If you fail, preserve the same row, add the new first-invalid line, shorten the next gap and change the intervention. If you pass one near-identical question but fail a mixed one, the repair is not yet generalised."
        ],
        bullets: [
          "Pass standard: correct method, accurate execution, and the required final form without looking.",
          "Promotion rule: remove a skill from the urgent list only after it survives at least one delayed mixed retest.",
          "Review the log weekly by recurrence and mark loss, not by how recently a row was written."
        ]
      },
      {
        heading: "Know when to ask a teacher or tutor",
        paragraphs: [
          "Escalation is part of the method, not an admission of failure. Ask for help when the same tagged error appears in three independent questions, when you still cannot start after a closed-book retrieval attempt, when two official materials seem to conflict, or when your score is flat after two correction–retest cycles. Also ask sooner if time pressure, anxiety, vision, motor or reading difficulties make the pattern broader than a single topic.",
          "Bring the original attempt, the exact paper and markscheme, the relevant log rows, your corrected solution, and the retest results. Ask a narrow question: “What is the first invalid inference here?”, “What feature should trigger this method?”, or “What response does this command word require in this course?” Ask the teacher to watch one fresh question rather than simply showing you another finished solution.",
          "Afterwards, write the agreed rule in your own words and test it on an unseen question. If uncertainty concerns a syllabus, calculator policy, command word, permitted method or assessment requirement, verify current official Cambridge or IB documentation and your school’s instructions; do not let an old forum post become your marking standard."
        ]
      }
    ],
    faqs: [
      {
        question: "Should I record every mark I lose?",
        answer: "Record lost marks initially, but promote repeatable causes into active rows. A recurring sign, method or command-word failure needs a full correction loop."
      },
      {
        question: "What if I get the final answer right for the wrong reason?",
        answer: "Log it as correct but insecure, write the valid reasoning, and retest with a changed question. A lucky answer needs investigation."
      },
      {
        question: "How many past papers should I do before reviewing my log?",
        answer: "Do not wait for a fixed number. Review after each paper and choose one or two recurring repairs before the next. Full papers diagnose; targeted retests repair."
      },
      {
        question: "Should I use the mark scheme before attempting a question?",
        answer: "Not for a diagnostic attempt. Use it after recording independent work and a first diagnosis. For targeted learning, study a step if needed, then close it and retrieve the method before counting the question as repaired."
      }
    ],
    relatedBanks: [
      { href: "/banks/igcse", label: "Cambridge IGCSE Mathematics 0580 question bank" },
      { href: "/banks/igcse-additional", label: "Cambridge IGCSE Additional Mathematics 0606 question bank" },
      { href: "/banks/ib-hl", label: "IB Mathematics AA HL question bank" },
      { href: "/banks/ib-sl", label: "IB Mathematics AA SL question bank" },
      { href: "/banks/ib-ai-hl", label: "IB Mathematics AI HL question bank" },
      { href: "/banks/ib-ai-sl", label: "IB Mathematics AI SL question bank" },
    ],
    sources: [
      { href: "https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-igcse-mathematics-0580/", label: "Cambridge IGCSE Mathematics (0580) qualification page" },
      { href: "https://www.cambridgeinternational.org/Images/662466-2025-2027-syllabus.pdf", label: "Cambridge IGCSE Mathematics 0580 syllabus for 2025, 2026 and 2027" },
      { href: "https://www.ibo.org/programmes/diploma-programme/curriculum/mathematics/", label: "IB Diploma Programme Mathematics" },
      { href: "https://www.ibo.org/globalassets/new-structure/programmes/dp/pdfs/mathematics-analysis-and-approaches-en.pdf", label: "IB Mathematics: analysis and approaches official PDF" },
      { href: "https://www.ibo.org/globalassets/new-structure/programmes/dp/pdfs/mathematics-applications-and-interpretation-en.pdf", label: "IB Mathematics: applications and interpretation official PDF" },
      { href: "https://doi.org/10.1111/j.1467-9280.2006.01693.x", label: "Roediger & Karpicke (2006), Test-Enhanced Learning" },
      { href: "https://doi.org/10.1037/0033-2909.132.3.354", label: "Cepeda et al. (2006), Distributed practice in verbal recall tasks" },
      { href: "https://doi.org/10.1177/1529100612453266", label: "Dunlosky et al. (2013), Improving Students’ Learning With Effective Learning Techniques" }
    ]
  },
  {
    slug: "topic-questions-vs-full-past-papers",
    draft: false,
    title: "Topic Questions vs Full Past Papers: When to Use Each",
    description: "Know when to leave topic practice, move into mixed questions, or sit a full paper—using visible readiness signals and calm fallback rules.",
    eyebrow: "Revision decision guide",
    answer: "Use topic questions when you can name a specific gap or keep repeating one mistake. Move to mixed questions when you can solve that skill without a topic label and choose the method from unfamiliar wording. Use a full timed paper when your main risk is switching between topics, following the correct paper rules, or managing time. If the paper exposes a gap, do not treat the score as a verdict: pull out the smallest weak skill, repair it, and return through mixed practice before timing yourself again.",
    publishedAt: "2026-09-02",
    updatedAt: "2026-09-02",
    readingMinutes: 8,
    sections: [
      {
        heading: "Choose the practice mode that matches the problem",
        paragraphs: [
          "When you are stressed, “do more past papers” sounds sensible but is not a decision. A full paper tests several things at once: recognising what a question is asking, switching methods, working under the clock, using the permitted tools, and presenting enough working. Topic questions isolate one skill. That makes them better when you already know what is going wrong and need useful repetitions rather than another discouraging score.",
        ],
        bullets: [
          "Choose topic questions when your error is repeatable and specific: for example, setting up a simultaneous equation or interpreting a cumulative-frequency graph.",
          "Choose mixed questions when you can do the method with a heading but not when the question is disguised inside a longer problem.",
          "Choose a full paper when switching, pacing, calculator discipline, and sustained concentration—not one missing method—are the main risks.",
        ],
      },
      {
        heading: "The readiness signals that tell you to switch",
        paragraphs: [
          "You are ready to leave a focused topic set when you can state the trigger for the method in your own words, solve representative questions without looking at an example, and check whether an answer is sensible. Try the same skill with changed numbers or wording. If the topic title is the only reason you know what to do, stay focused a little longer.",
        ],
        bullets: [
          "Focused-to-mixed signal: your last short sets contain mostly correct methods, and any misses can be explained as a precise execution or wording issue rather than “I do not know this.”",
          "Mixed-to-timed signal: you begin unfamiliar questions without waiting for a topic label, use sensible time checkpoints, and still have a plan for checking or returning to a hard part.",
        ],
      },
      {
        heading: "A three-stage progression: focused, mixed, timed",
        paragraphs: [
          "Stage 1 — Focused: pick one narrow skill from your error pattern. Work through a small, varied set with the answer hidden. Include a straightforward example, a changed presentation, and a multi-step version. After each miss, identify the first decision that failed. The session has done its job when you can reproduce the method independently and explain what clue should trigger it next time.",
          "Stage 2 — Mixed: combine that repaired skill with nearby and unrelated topics. Remove headings and do not arrange questions in a helpful order. Before calculating, write a tiny plan. This tests transfer: can you select the method when the page does not tell you which chapter you are in? Add a time limit to a short block once selection becomes less hesitant.",
          "Stage 3 — Timed: sit the exact paper component that matches your qualification, level, tier, calculator rules, and current syllabus. Use a realistic start-to-finish block, keep your phone away, and record time checkpoints. Mark the paper as a diagnostic of performance under conditions. The useful output is not only a score; it is a map of whether marks disappeared through knowledge, method choice, execution, reading, or time.",
        ],
        bullets: [
          "Focused: support is visible—the topic label and examples help you choose the method.",
          "Mixed: support is reduced—you choose among methods and practise transfer.",
          "Timed: support is removed—you manage the whole paper, including its rules and pacing.",
        ],
      },
      {
        heading: "If a full paper exposes gaps, use a controlled fallback",
        paragraphs: [
          "Use the smallest fallback that addresses the cause. If one question contains an isolated slip, correct that question and continue with the next planned mode. If several questions test the same narrow skill, pause full papers and return to a focused set on that skill. Once you can solve changed versions independently, test it in a short mixed block before returning to a full paper.",
          "If many unrelated topics fail, check the basics before doing another paper: are you using the correct course, level or tier, syllabus version, paper component, mark scheme, and calculator conditions? A format mismatch can make a fair diagnostic look worse than it is. Cambridge IGCSE Mathematics 0580's 2025–2027 syllabus, for example, specifies a dedicated non-calculator paper at each tier and separate calculator papers, so practise the component you will actually sit.",
        ],
        bullets: [
          "One isolated error: patch it, write the prevention cue, and keep the plan.",
          "A repeated narrow error: return to focused questions, then re-enter through mixed practice.",
          "Many gaps early in the paper: stop spending whole sessions on simulations; rebuild a short priority list and use targeted sets.",
          "Strong accuracy but poor timing: use timed sections, time checkpoints, and question triage before consuming another full paper.",
          "Wrong calculator or paper conditions: repeat the same skill under the correct rules; do not compare that score with a valid simulation.",
        ],
      },
      {
        heading: "Respect the paper format you are preparing for",
        paragraphs: [
          "“Full paper” only means realistic if it matches your exam. For Cambridge IGCSE Mathematics 0580, check whether you are preparing for Core or Extended and whether the selected component permits a calculator; the official syllabus says the 2025–2027 assessment includes a non-calculator paper at each tier and explains that the updated specimen materials reflect those requirements.",
          "For IB, do not transfer a rule from one maths course to another. The IB curriculum page distinguishes Mathematics: analysis and approaches from Mathematics: applications and interpretation, and the official guides publish course-specific assessment details. Before a timed session, check your exact course and level, the paper component, technology requirements, permitted materials, and the time allowed by the current guide. PastPaperPrep can organise practice; the awarding organisation's current document decides the rules.",
        ],
      },
      {
        heading: "A short, adaptable pre-exam timeline",
        paragraphs: [
          "About 2–4 weeks out: establish your format and make a priority list from recent work. Use focused questions for the biggest repeatable gaps, then mix repaired skills with other topics. Include calculator and non-calculator practice when your qualification requires both.",
          "About 7–10 days out: let mixed work do more of the day-to-day testing. Add timed sections and one realistic simulation when you need evidence about stamina or pacing. If the simulation still shows a concentrated gap, use the fallback rule; do not stack simulations on top of an unaddressed weakness.",
          "About 2–3 days out: practise the errors that are still active, do a short mixed set, and rehearse the exact paper routine: materials, calculator settings if permitted, time checkpoints, and how you will skip and return. Avoid a novel full-paper marathon if it will produce noise rather than a fix.",
          "The day before and exam morning: keep work light and familiar. Review cues, formulas or definitions that your course permits you to use, and your personal error reminders. Prioritise sleep, food, travel, and the correct equipment. Adapt the volume to your concentration; more questions are not automatically better revision.",
        ],
        bullets: [
          "More time: add another focused/mixed cycle for gaps that return, not an arbitrary quota of papers. Less time: shorten each block but keep the order—repair, transfer, then simulate only if it answers a live pacing question.",
        ],
      },
    ],
    faqs: [
      {
        question: "Should I do topic questions or a full paper first?",
        answer: "Use the mode that matches your current bottleneck. If you can name a repeated skill gap, start with focused topic questions. If you do not know where marks are going, a diagnostic paper or mixed set can locate the problem, but switch out of full-paper mode when its gaps become specific.",
      },
      {
        question: "How do I know I am ready for a timed paper?",
        answer: "You are ready when mixed questions show that you can choose methods without a topic label, recover from unfamiliar wording, and work to time checkpoints. You do not need perfect confidence; you need enough independent control for the paper to measure pacing and whole-course switching.",
      },
      {
        question: "What if my full-paper score is much lower than expected?",
        answer: "Classify the misses before reacting. Check for a repeated skill, a format or calculator mismatch, method-selection hesitation, execution slips, and time loss. Return only as far as needed—focused for a narrow gap, mixed for transfer, timed for pacing—then reassess.",
      },
      {
        question: "How many full past papers should I complete?",
        answer: "There is no useful universal number. Stop when another paper would answer no live question. Choose enough timed work to expose and retest your real pacing or stamina issues, while protecting time for focused repair and mixed transfer practice.",
      },
    ],
    relatedBanks: [
      { href: "/banks/igcse", label: "Cambridge IGCSE Mathematics question bank" },
      { href: "/banks/igcse-additional", label: "Cambridge IGCSE Additional Mathematics question bank" },
      { href: "/banks/ib-hl", label: "IB Mathematics HL question bank" },
      { href: "/banks/ib-sl", label: "IB Mathematics SL question bank" },
      { href: "/banks/ib-ai-hl", label: "IB Mathematics AI HL question bank" },
      { href: "/banks/ib-ai-sl", label: "IB Mathematics AI SL question bank" },
    ],
    sources: [
      { href: "https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-igcse-mathematics-0580/", label: "Cambridge IGCSE Mathematics (0580) syllabus overview" },
      { href: "https://www.cambridgeinternational.org/Images/662466-2025-2027-syllabus.pdf", label: "Cambridge IGCSE Mathematics (0580) syllabus for 2025, 2026 and 2027" },
      { href: "https://www.ibo.org/programmes/diploma-programme/curriculum/mathematics/", label: "IBO: Maths in the DP" },
      { href: "https://www.ibo.org/globalassets/new-structure/programmes/dp/pdfs/maths-analysis-and-approaches-2021-en.pdf", label: "IB Mathematics: analysis and approaches guide" },
      { href: "https://www.ibo.org/globalassets/new-structure/programmes/dp/pdfs/maths-applications-and-interpretation-2021-en.pdf", label: "IB Mathematics: applications and interpretation guide" },
    ],
  },
  {
    slug: "best-free-ib-maths-aa-hl-resources",
    draft: false,
    title: "Best Free IB Maths AA HL Practice Resources",
    description: "A careful comparison of official IB materials, Christos Nikolaidis, Revision Village, and PastPaperPrep for affordable Maths AA HL practice.",
    eyebrow: "IB Mathematics AA HL",
    answer: "The best free IB Mathematics: Analysis and Approaches HL stack combines official IB sample materials, Christos Nikolaidis, and PastPaperPrep. Use the official curriculum and samples to confirm the course and exam format, Christos for free topic notes and exercises, and PastPaperPrep for real questions organised by topic and paper. Revision Village is useful, but its free tier is a sample rather than a free copy of the full Questionbank: the live AA HL index labels a small set of Functions subtopics “RV Free” and most other listed subtopics “RV Gold.” If you can spend a little, start with the free layer and add one targeted paid resource only when you know what is missing. Do not use random “IB past paper PDF” repositories. Many are unauthorised, their files can be incomplete or altered, and downloading them is not a sound study or copyright practice. Ask your teacher or IB coordinator for school-licensed materials, or use the official IB/Follett channels.",
    publishedAt: "2026-09-03",
    updatedAt: "2026-09-03",
    readingMinutes: 9,
    sections: [
      {
        heading: "Official IB materials: the authority, not the biggest free bank",
        paragraphs: [
          "Start with the IB’s Mathematics curriculum page and its Analysis and Approaches page. Use them to confirm the current course identity and separate AA from AI before trusting a third-party “Math HL” page.",
          "The official sample exam papers page is the best free way to see intended paper structure and style. Sample materials are finite, not a complete archive or topical questionbank. Use one as a diagnostic or timed paper, then repair its weaknesses with topic practice.",
          "The IB Questionbank is a licensed assessment resource, not a public student download. Check the IB Questionbank information and ask your teacher or coordinator about school access; the Follett IB Store is the relevant retail channel. School access is not permission to repost files. Official IB wins on authority and assessment authenticity, but not on free, topical breadth.",
        ],
      },
      {
        heading: "Christos Nikolaidis: the strongest genuinely free topic toolkit",
        paragraphs: [
          "Christos Nikolaidis’s Math AA hub links to free lecture notes, formula booklets, exercises, HL Paper 3 questions, and HL tests.",
          "For learning and rebuilding, this is the standout free option. The lecture-note page provides PDFs for all five AA topics and GDC use. The exercise page provides a 2024-edition set organised by AA topic, with HL-only material, “eco” versions, separate solutions, difficulty notation, and short and long exam-style questions.",
          "The HL tests page adds teacher-created topic tests and solutions, including newer AA HL tests since 2019 and older pre-2019 Mathematics HL material. Treat the older tests as extra practice, not proof of current AA HL alignment. The HL Paper 3 page targets connected modelling, calculus, trigonometry, limits, recursion, and complex-number reasoning with worked solutions.",
          "One boundary matters: the “Mock exam 2026” page asks for a small donation and emails the 2026 mock papers. That is separate from the free notes, exercises, and tests; the page says 2025 solutions are posted while 2026 papers and solutions go to donors. Christos wins on free explanatory coverage and printable topic practice, but not on official provenance or digital filtering.",
        ],
      },
      {
        heading: "Revision Village: what is actually free and what is Gold",
        paragraphs: [
          "Revision Village is often recommended because it combines topic questions, markschemes, video solutions, past-paper walkthroughs, practice exams, and progress features. Its current AA HL Questionbank index shows the important free/paid boundary rather than implying that the whole bank is free. In the version checked on 2026-09-01, eight AA HL subtopic cards carried an “RV Free” label, concentrated in Functions, while most of the remaining visible question sets were marked “RV Gold.” The page still lets visitors browse the topic structure, which is useful for planning even if most questions require Gold.",
          "The RV Gold pricing page describes the free plan as $0 forever with no credit card and access to “a subset of topics within a course.” It lists the Questionbank, Practice Exams, Past Papers, Key Concepts, Prediction Exams, Newton AI, and Bootcamps among the Gold features. On the same page checked date, Single Course Gold was shown as $249 billed once; prices and offers can change, so treat that as a dated observation rather than a promise.",
          "The past-paper page is helpful for seeing which current-curriculum sessions and papers RV covers, and for its worked video explanations. It also tells students to ask a mathematics teacher or IB coordinator for PDF copies, or purchase them through the Follett IB Store, rather than presenting unofficial mirrors as acceptable. The practice-exams page explains the roles of Popular Quizzes, the Revision Ladder, and full mock papers; these are useful features, but they are not evidence that the underlying full set is free.",
          "Revision Village wins when you want polished, guided explanations and a large all-in-one revision ecosystem. Its free tier wins as a trial and for the labelled free Functions material, not as a complete free AA HL solution.",
        ],
      },
      {
        heading: "PastPaperPrep: honest value for topical real-question practice",
        paragraphs: [
          "PastPaperPrep is an independent practice platform, not the IB and not a replacement for official assessment documents. Counts and pricing checked 7 September 2026. Its home page lists twelve question banks, 12,332 curated questions, 853 indexed papers, and 841 questions in IB Math AA HL. It describes real exam questions with source context, filters for course, topic, year, paper, marks, and calculator rules, and printable PDF set building.",
          "That is where PastPaperPrep wins: it turns the “I need AA HL past papers by topic” problem into a bounded practice workflow. Choose AA HL first, filter to a weak topic or paper type, attempt the original question, review the answer or markscheme where available, and then build a mixed set so you have to choose the method yourself. The existing AA and AI topical-practice guide makes the same distinction: focused sets repair a known gap, while mixed and timed sets test transfer, pacing, and method selection.",
          "PastPaperPrep’s free boundary should also be read literally. Its pricing page says students can practise complete older exam years for free. It does not promise that every question in the AA HL inventory is free. The same page currently shows $5/month for one bank, $8/month for a two-bank subject pair, and $12/month for all twelve banks, with annual billing advertised as saving up to 33%. The sensible low-cost choice, if you need newer AA HL inventory, is one bank rather than an all-library plan.",
          "PastPaperPrep wins on course-specific filtering, topical diagnosis, and printable sets. It loses to Christos on free explanatory notes and to Revision Village Gold on video-heavy guided support. It should never claim to be official IB material; its value is organisation and practice convenience.",
        ],
      },
      {
        heading: "A minimal low-cost AA HL stack",
        paragraphs: [
          "Use this sequence before buying a large subscription:",
          "Keep the official sample paper for a diagnostic and full-paper rehearsal, Christos for instruction, and PastPaperPrep for repeated, topic-aware attempts. This division prevents the common mistake of collecting PDFs without learning, timing, or reviewing.",
        ],
        bullets: [
          "**$0: verify the target.** Read the official AA curriculum page and sample-paper page. Download only from official or clearly authorised links, and check your school’s current paper requirements.",
          "**$0: learn and rebuild.** Use Christos Nikolaidis’s lecture notes, formula booklet, topic exercise, solution, and one matching HL test. Start with the exact weak section rather than printing the whole site.",
          "**$0: practise real questions.** Use PastPaperPrep’s free older exam years and its AA HL filters. Move from a single topic to a mixed set, then to a timed paper.",
          "**Optional one-month spend.** If the free inventory is exhausted or you need newer papers and PDF set building, try PastPaperPrep’s one-bank plan at the current listed $5/month. Cancel when the diagnostic gap is repaired; do not buy all twelve banks for one AA HL course.",
          "**Optional guided layer.** Use Revision Village’s labelled free questions to test whether its interface and explanations suit you. Pay only if the video solutions, practice-exam ecosystem, or progress tools solve a problem the free stack did not.",
        ],
      },
      {
        heading: "What to avoid",
        paragraphs: [
          "Avoid sites that offer “all IB past papers” as anonymous downloads, especially when they do not identify an authorised source or reproduce the IB’s access terms. A link being easy to find does not make it legitimate, complete, current, or safe. Do not recommend Telegram folders, scraped questionbanks, file mirrors, or uploads of paid Revision Village or official IB materials. If a paper is unavailable publicly, ask the teacher or coordinator, use the official IB/Follett route, or practise with legitimately published teacher-created material such as Christos Nikolaidis’s own resources.",
          "Also avoid treating every old Mathematics HL test as current AA HL preparation. Use older papers selectively for algebraic fluency, calculus, or proof, then anchor exam-format practice in current official samples and current-course resources.",
        ],
      },
    ],
    faqs: [
      {
        question: "What is the best completely free IB Maths AA HL resource?",
        answer: "For free teaching notes, exercises, solutions, and topic tests, Christos Nikolaidis is the strongest standalone option. Pair it with official IB sample materials and PastPaperPrep’s free older exam years for real-question practice.",
      },
      {
        question: "Is the Revision Village AA HL Questionbank free?",
        answer: "Not in full. On the AA HL index checked 2026-09-01, eight subtopic cards were labelled RV Free, while most of the remaining visible question sets were labelled RV Gold. Revision Village describes the free plan as access to a subset of topics; the full Questionbank and other major features are Gold.",
      },
      {
        question: "Can I get official IB past papers for free?",
        answer: "Official sample assessment materials are publicly available through IB’s sample-exam page. A complete archive is a different matter: ask your school or IB coordinator about licensed access, or use the Follett IB Store. Do not rely on unauthorised mirrors.",
      },
      {
        question: "Is PastPaperPrep free for IB Math AA HL?",
        answer: "PastPaperPrep advertises complete older exam years for free. Its pricing page does not say that the entire AA HL inventory is free; the current paid options start at $5/month for one bank. Check the bank’s live free filter for the exact available years.",
      },
      {
        question: "What should I pay for first?",
        answer: "Pay for one AA HL bank only after the free stack shows a real gap. PastPaperPrep’s one-bank plan is the lowest listed paid option in this comparison; Revision Village is worth considering when guided video solutions and its wider ecosystem matter more than minimum cost.",
      },
    ],
    relatedBanks: [
      {
        href: "/banks/ib-hl",
        label: "IB Mathematics AA HL question bank",
      },
      {
        href: "/banks/ib-sl",
        label: "IB Mathematics AA SL question bank",
      },
      {
        href: "/banks/ib-ai-hl",
        label: "IB Mathematics AI HL question bank",
      },
      {
        href: "/banks/ib-ai-sl",
        label: "IB Mathematics AI SL question bank",
      },
      {
        href: "/pricing",
        label: "See PastPaperPrep pricing",
      },
    ],
    sources: [
      {
        href: "https://www.ibo.org/programmes/diploma-programme/curriculum/mathematics/",
        label: "IB Diploma Programme mathematics",
      },
      {
        href: "https://www.ibo.org/programmes/diploma-programme/curriculum/mathematics/mathematics-analysis-and-approaches/",
        label: "IB Mathematics: analysis and approaches",
      },
      {
        href: "https://www.ibo.org/programmes/diploma-programme/assessment-and-exams/sample-exam-papers/",
        label: "IB sample exam papers",
      },
      {
        href: "https://www.ibo.org/ib-questionbank/",
        label: "IB Questionbank",
      },
      {
        href: "https://www.follettibstore.com/",
        label: "Follett IB Store",
      },
      {
        href: "https://www.christosnikolaidis.com/en/maa/",
        label: "Christos Nikolaidis: Mathematics AA",
      },
      {
        href: "https://www.christosnikolaidis.com/en/maa-lecture-notes/",
        label: "Christos Nikolaidis: Math AA lecture notes",
      },
      {
        href: "https://www.christosnikolaidis.com/en/maa-exercise/",
        label: "Christos Nikolaidis: Math AA exercise",
      },
      {
        href: "https://www.christosnikolaidis.com/en/maa-hl-p3/",
        label: "Christos Nikolaidis: Math AA HL P3 questions",
      },
      {
        href: "https://www.christosnikolaidis.com/en/maa-tests/",
        label: "Christos Nikolaidis: Math AA HL tests",
      },
      {
        href: "https://www.christosnikolaidis.com/en/mock-exam/",
        label: "Christos Nikolaidis: Mock exam 2026",
      },
      {
        href: "https://www.revisionvillage.com/ib-math/analysis-and-approaches-hl/questionbank/",
        label: "Revision Village: AA HL Questionbank",
      },
      {
        href: "https://www.revisionvillage.com/revision-village-gold/",
        label: "Revision Village Gold pricing",
      },
      {
        href: "https://www.revisionvillage.com/ib-math/analysis-and-approaches-hl/past-papers/",
        label: "Revision Village: AA HL past papers",
      },
      {
        href: "https://www.revisionvillage.com/ib-math/analysis-and-approaches-hl/practice-exams/",
        label: "Revision Village: AA HL practice exams",
      },
      {
        href: "https://pastpaperprep.com/",
        label: "PastPaperPrep home",
      },
      {
        href: "https://pastpaperprep.com/articles/ib-math-past-papers-by-topic",
        label: "PastPaperPrep: IB Math past papers by topic",
      },
      {
        href: "https://pastpaperprep.com/banks/ib-hl",
        label: "PastPaperPrep: IB Math AA HL bank",
      },
      {
        href: "https://pastpaperprep.com/pricing",
        label: "PastPaperPrep pricing",
      },
    ],
  },
  {
    slug: "ib-biology-past-papers-by-topic",
    title: "IB Biology Past Papers by Topic",
    description: "Use IB Biology HL and SL past-paper questions by topic, paper, session, and year to diagnose gaps before moving to timed practice.",
    eyebrow: "IB Biology revision guide",
    answer: "The fastest way to use IB Biology past papers is to filter a short set by topic, attempt the original questions, compare the markscheme, and then retest the same skill in a mixed set. PastPaperPrep includes IB Biology HL and SL banks with real papers from 2020 to 2025.",
    publishedAt: "2026-09-08",
    updatedAt: "2026-09-08",
    readingMinutes: 5,
    sections: [
      {
        heading: "Start with one Biology topic",
        paragraphs: [
          "Choose the topic where your last test or paper exposed a gap: molecules and cells, organisms and body systems, information and inheritance, or populations and ecosystems. A focused set makes the missing idea easier to name than a full paper does.",
          "Practise HL and SL from the bank that matches your course. Do not treat a familiar-looking question as mastered until you can explain the biological process and apply it to unfamiliar data.",
        ],
      },
      {
        heading: "Use the markscheme precisely",
        paragraphs: [
          "Biology marks often depend on a named structure, relationship, comparison, or command term. After attempting the question, identify the first missing marking point rather than only checking the final conclusion.",
          "Record the correction in one sentence, then save the question for a later mixed set. Move from topic practice to a paper or session filter once the same error stops recurring.",
        ],
      },
      {
        heading: "Build toward timed papers",
        paragraphs: [
          "Use the complete 2020 exam year as a free preview, then add newer papers when you need the full bank. Mix topics before a timed paper so you must select the relevant concept without being prompted by a topic label.",
        ],
      },
      {
        heading: "Close the loop",
        paragraphs: [
          "After marking, write the missed idea in your own words and return to a small mixed set a few days later. Keep a record of recurring command-term, data-analysis, and biological-process errors so your next paper tests a repaired weakness rather than repeating it.",
        ],
      },
    ],
    faqs: [
      { question: "Does the Biology bank include HL and SL?", answer: "Yes. IB Biology HL and IB Biology SL are separate banks with their own questions, papers, topics, and access controls." },
      { question: "Which Biology years are available?", answer: "The sealed runtime banks cover 2020 through 2025, including actual November 2020 papers. The 2020 year is the explicit free preview policy for both levels." },
      { question: "Can I practise Biology questions by topic?", answer: "Yes. Filter by the controlled Biology topic and subtopic taxonomy, then narrow by year, session, paper, marks, and other available metadata." },
    ],
    relatedBanks: [
      { href: "/banks/ib-biology-hl", label: "IB Biology HL past papers by topic" },
      { href: "/banks/ib-biology-sl", label: "IB Biology SL past papers by topic" },
    ],
  }
] as const;

export const ARTICLES: readonly Article[] = ALL_ARTICLES
  .filter(isPublicArticle)
  .slice()
  .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));

export function getArticle(slug: string): Article | undefined {
  return ARTICLES.find((article) => article.slug === slug);
}
