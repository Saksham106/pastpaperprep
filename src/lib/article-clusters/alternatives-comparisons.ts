import type { Article } from "@/lib/articles";
import { freeAccessSection } from "@/lib/article-clusters/free-access-section";

export const ALTERNATIVES_COMPARISONS = [
  {
    draft: false,
    slug: "best-exam-mate-alternatives",
    title: "Best Exam-Mate Alternatives for IB and IGCSE: Free and Paid Topical Practice",
    description: "Compare Exam-Mate alternatives for IB and IGCSE topical practice: real questions, exam-style sets, answers, printable options, and free limits.",
    eyebrow: "IB and IGCSE topical practice",
    answer: "Start with PastPaperPrep for free whole papers without signup and topic-filtered real Cambridge IGCSE or IB questions. Its older topical free selection is separate from paid newer inventory and custom export. PMT offers a broad free resource library, while Revision Village offers IB exam-style practice with videos. Check your subject, provenance and the help you need after attempting a question.",
    publishedAt: "2026-10-05",
    updatedAt: "2026-10-16",
    readingMinutes: 8,
    answerLink: { href: "/#question-banks", label: "PastPaperPrep" },
    comparison: {
      caption: "Exam-Mate alternatives by practice need",
      headings: ["What you need", "Best fit", "Trade-off"],
      rows: [
        { label: "Real IB or IGCSE questions by topic, printable selection", pastPaperPrep: "PastPaperPrep", competitor: "Supported banks; free whole papers and separate free topical selection, with newer inventory and export requiring eligible access" },
        { label: "Free downloadable papers and mark schemes", pastPaperPrep: "PMT", competitor: "Broad resource pages; you select, assemble, and print files yourself" },
        { label: "IB exam-style topic sets with worked support", pastPaperPrep: "Revision Village", competitor: "Exam-style questions, mark schemes and video solutions; not a substitute for authentic session questions" },
        { label: "Practice inside Exam-Mate's topical interface", pastPaperPrep: "Exam-Mate", competitor: "Newest topical questions require a subscription; questions are not downloadable" },
        { label: "Free first attempt", pastPaperPrep: "Compare each provider's current access gate", competitor: "A visible sample or free account does not mean unlimited recent questions or marking" },
      ],
    },
    sections: [
      {
        heading: "Start with PastPaperPrep for real questions by topic",
        paragraphs: [
          "If you want focused real questions from actual exam sessions, try PastPaperPrep’s topical free selection. Guests see up to 20 matching free questions and a free account unlocks the rest of that selection. For a full timed sitting instead, its paired whole-paper workspace is free without signup. Custom worksheet export has separate access and allowance rules.",
          "PastPaperPrep is not a universal Exam-Mate replacement. Its current catalogue covers Mathematics, sciences, and Economics across supported Cambridge IGCSE and IB Diploma banks; it does not claim to cover every Exam-Mate curriculum, board, or subject. Confirm the exact course and level in the live catalogue before choosing. The advantage is a direct path from a topic filter to a curated set of authentic questions. PDF export requires eligible bank access and follows your plan’s download allowance.",
          "If you're comparing subscriptions, use the separate pricing and access comparison rather than treating this alternatives guide as a second price list. This article is about choosing a practice workflow, not repeating every plan and term.",
        ],
        links: [{ href: "/articles/pastpaperprep-vs-exam-mate", label: "Exam-Mate pricing and access comparison" }],
      },
      freeAccessSection([
        { href: "/past-papers/igcse-maths-0580", label: "IGCSE Maths 0580 whole papers" },
        { href: "/past-papers/ib-math-aa-hl", label: "IB Maths AA HL whole papers" },
        { href: "/banks/igcse?free=1", label: "PastPaperPrep IGCSE 0580 bank: free topic practice" },
        { href: "/banks/ib-hl?free=1", label: "IB Mathematics AA HL question bank: free topic practice" },
        { href: "/articles/best-free-igcse-past-paper-websites", label: "Compare free IGCSE paper websites across subjects" },
      ], "For free papers across Cambridge subjects, compare the archive websites in the linked guide. Check the subject code and syllabus before using an older paper."),
      {
        heading: "PMT: a free library when you do not mind assembling the set",
        paragraphs: [
          "Physics & Maths Tutor lists past papers and mark schemes across AQA, CAIE, Edexcel, OCR, Eduqas, and WJEC, including GCSE and IGCSE subjects. Its pages are useful when you know the subject and board and want a complete paper, a mark scheme, or organised downloadable resources without starting with a paid topical subscription.",
          "The trade-off is the work after you find the files. PMT is a library of pages and downloads, not one unified cross-bank question picker. You may need to open papers, identify the relevant question, and prepare your own topic worksheet. Check each resource's label and source: a worksheet or practice set is not automatically an authentic past-paper question, and the presence of an old paper does not guarantee current-syllabus alignment.",
        ],
      },
      {
        heading: "Revision Village: IB exam-style practice and explanation",
        paragraphs: [
          "Revision Village is worth comparing if you are an IB student who values topic organisation plus explanation. Its IB Mathematics question-bank pages describe exam-style questions arranged by topic, subtopic, and difficulty, with mark schemes and video tutorials. Its broader IB course resources include other study tools, though access depends on the resource and plan.",
          "Be precise about provenance. Revision Village describes these as exam-style questions; that is useful practice, but it does not mean each item is from an actual examination session. Choose it when guided solutions or an IB-specific teaching layer matter. Choose an authentic past-paper bank when your goal is to practise questions that appeared in a real session. Its paid and free access vary, so check the relevant current course page rather than assuming every question or video is open.",
        ],
      },
      {
        heading: "Exam-Mate may still fit if its breadth is what you need",
        paragraphs: [
          "Exam-Mate's topical-papers page lists several curricula, including Cambridge IGCSE and IB Diploma, and lets students refine practice by subject, topic, paper type, year, and season. It says topical questions are not downloadable. The pricing page says its individual topical subscription is separate from Build Exam; topical access is included with Build Exam, so those are different purchase choices, not interchangeable price labels.",
          "Its free access does not include the most recent years: the Exam-Mate FAQ says free subscribers cannot access the newest years, and its topical pricing page labels access through 2019 separately. If you want Exam-Mate's wider curriculum coverage or its online practice interface, it may remain the right option. Compare actual access for your curriculum and the current billed term before paying; do not infer unlimited access from a free account.",
          "The individual Topical Past Papers subscription starts at USD $12 for one month. Build Exam is a separate purchase with a different workflow; do not assume a topical subscription includes it. Price and access checked 5 October 2026; use the dedicated pricing guide for longer billing terms.",
        ],
      },
      {
        heading: "Compare the practice itself, not just the question count",
        paragraphs: [
          "Before switching, inspect a sample in your own subject and level. Ask whether questions are authentic session questions or authored exam-style practice; whether you can check a worked answer or only a mark scheme; whether the exact topic and course match your syllabus; and whether a set can be printed or only completed online. Those details decide whether a platform helps with diagnosis, explanation, or exam simulation.",
          "A mark scheme and a teaching explanation are not identical. A mark scheme indicates the credited answer and method; a video or worked solution may explain why the method works. Likewise, a printable resource is not necessarily customisable, and a topic label does not guarantee that every question suits your level or current syllabus. Check one or two representative questions before committing to a longer plan.",
        ],
      },
      {
        heading: "A practical choice by student",
        paragraphs: [
          "Choose PastPaperPrep when you are studying one of its supported IB or Cambridge IGCSE courses and want to select real questions by topic, then create a printable practice set. Choose PMT when free papers, mark schemes, and broad board coverage matter more than automated set-building. Choose Revision Village when IB exam-style drills plus video explanations fit your study habits. Keep Exam-Mate when its curriculum breadth, online topical interface, or Build Exam workflow is the feature you actually use.",
          "There is no single best platform for every subject. A sensible sequence is to diagnose with a real paper, practise the specific gap, and return to mixed or timed questions to see whether the method transfers. Check the bank or provider's current free rules and course coverage before buying; no question bank guarantees a grade.",
        ],
      },
    ],
    faqs: [
      { question: "What is the best free Exam-Mate alternative for IB or IGCSE?", answer: "PastPaperPrep offers free whole papers without signup and a separate older free topical selection in supported Cambridge IGCSE and IB courses. Guests see up to 20 matching free questions; a free account unlocks the remaining free selection. PMT also offers broad free downloadable papers and mark schemes." },
      { question: "Are PastPaperPrep questions real past-paper questions?", answer: "Its supported banks are organised from real past-paper questions. Check the chosen bank and question context; this differs from a provider's authored exam-style questions, which may resemble an exam without coming from an actual session." },
      { question: "Does Exam-Mate let students download topical questions?", answer: "Exam-Mate's topical-papers page says questions are not downloadable. If printable custom selection matters, check PastPaperPrep's eligible bank access and PDF workflow, or use a downloadable library such as PMT and assemble your own set." },
      { question: "Are Exam-Mate topical questions free?", answer: "Exam-Mate says free subscribers cannot access the most recent years, and the pricing page separates topical access through 2019 from newer access. The individual topical plan is paid; Build Exam includes the service, while the individual topical subscription does not include Build Exam." },
      { question: "Does Revision Village use actual IB past-paper questions?", answer: "Its question-bank pages describe exam-style questions, mark schemes, and video solutions. Exam-style means designed to practise the assessment style; it should not be assumed to mean an actual question from a past examination session." },
    ],
    relatedBanks: [
      { href: "/#question-banks", label: "PastPaperPrep IB and IGCSE question banks" },
      { href: "/articles/pastpaperprep-vs-exam-mate", label: "Exam-Mate pricing and access comparison" },
      { href: "/pricing", label: "PastPaperPrep plans and access" },
    ],
    sources: [
      { href: "https://www.exam-mate.com/topicalpastpapers", label: "Exam-Mate topical past-paper questions" },
      { href: "https://www.exam-mate.com/topicalpastpapers/pricing", label: "Exam-Mate topical pricing and access" },
      { href: "https://www.exam-mate.com/faq/TOPICAL%20PAST%20PAPER%20QUESTIONS", label: "Exam-Mate topical papers FAQ" },
      { href: "https://www.physicsandmathstutor.com/past-papers/", label: "PMT past papers and mark schemes" },
      { href: "https://www.revisionvillage.com/ib-math/questionbank", label: "Revision Village IB Math question bank" },
      { href: "https://pastpaperprep.com/pricing", label: "PastPaperPrep catalogue and pricing" },
    ],
  },
  {
    "draft": false,
    "slug": "best-save-my-exams-alternatives-topical-past-papers",
    title: "Best Save My Exams Alternatives for Topical Past Papers",
    description: "Compare legitimate Save My Exams alternatives for topical past papers, including PMT, MathsGenie, Cognito, and PastPaperPrep.",
    eyebrow: "Topical past-paper resources",
    answer: "PastPaperPrep is a useful Save My Exams alternative for free Cambridge IGCSE and IB whole papers and topic-filtered real questions. Its whole-paper workspace needs no signup, while topical free access and paid worksheet export have separate rules. PMT offers broad free paper and topic resources; MathsGenie is useful for matching maths courses, and Cognito for GCSE science and maths teaching. Keep Save My Exams if you want its broad written notes, model answers and plan-dependent feedback tools.",
    publishedAt: "2026-09-15",
    updatedAt: "2026-10-16",
    readingMinutes: 8,
    comparison: {
      caption: "Save My Exams alternatives at a glance",
      headings: ["What you need", "Best fit", "Trade-off"],
      rows: [
        { label: "Free downloadable papers and mark schemes", pastPaperPrep: "PMT", competitor: "Large board and subject index; you organise the files yourself" },
        { label: "Free maths topic practice", pastPaperPrep: "MathsGenie", competitor: "Strong GCSE and A-level maths workflow; narrower subject scope" },
        { label: "Free GCSE science explanations", pastPaperPrep: "Cognito", competitor: "Videos, quizzes, and exam questions; not a full replacement for every course" },
        { label: "Granular real-question filtering and printable sets", pastPaperPrep: "PastPaperPrep", competitor: "Free whole papers and an older free topical selection; newer inventory and custom export require eligible access" },
        { label: "Broad notes, model answers, and revision tools", pastPaperPrep: "Save My Exams", competitor: "Premium unlocks the broadest in-site feature set; not the cheapest topical-only route" },
      ],
    },
    sections: [
      {
        heading: "First decide whether you need papers or a revision platform",
        paragraphs: [
          "Save My Exams is more than a paper index. Its current Free, Essential and Premium guide offers limited free notes and practice, core revision resources on Essential and additional model-answer and feedback tools on Premium. Available past-paper downloads are included in Free. Check course coverage rather than assuming every feature exists for every subject.",
          "For that narrower job, compare the workflow. A file library gives breadth but leaves selection and printing to you. A topical bank reduces admin. Choose the one that removes your bottleneck.",
        ],
      },
      freeAccessSection([
        { href: "/articles/best-free-igcse-past-paper-websites", label: "Compare free IGCSE paper websites across subjects" },
        { href: "/past-papers/igcse-maths-0580", label: "IGCSE Maths 0580 whole papers" },
        { href: "/past-papers/igcse-additional-maths-0606", label: "IGCSE Additional Maths 0606 whole papers" },
        { href: "/banks/igcse?free=1", label: "PastPaperPrep IGCSE 0580 bank: free topic practice" },
        { href: "/banks/igcse-additional?free=1", label: "PastPaperPrep IGCSE Additional 0606 bank: free topic practice" },
      ], "For Biology, Chemistry, Physics and other Cambridge subjects, use the cross-subject free archive comparison below."),
      {
        heading: "PMT: the best free paper library for many UK courses",
        paragraphs: [
          "Physics & Maths Tutor says its past-paper area covers AQA, CAIE, Edexcel, OCR, Eduqas, and WJEC papers and mark schemes across GCSE, IGCSE, A-level, and International A-level subjects. Its maths revision index also links notes, cheatsheets, worksheets, questions by topic, model solutions, and past papers by exam board.",
          "PMT works well when you know the board and paper, can download PDFs, and do not need a question builder. Its topic pages provide practice, but the experience is linked resources rather than one cross-bank filter-and-print workflow.",
          "Choose PMT before paying if your immediate need is a free paper, mark scheme, or worksheet. Choose something more structured when assembling files costs more time than the practice itself.",
        ],
      },
      {
        heading: "MathsGenie: a strong free maths alternative",
        paragraphs: [
          "MathsGenie describes its GCSE question bank as a place to browse every topic, drill into past-paper questions, and check working. Its exam-board pages expose topic-by-topic questions, booklets, solutions, revision guides, lessons, past papers, and a mock-exam builder. The site describes its maths revision as free, though its broader product may also offer paid or account-based tools, so check the live page before assuming every feature has the same access rule.",
          "MathsGenie is a sensible Save My Exams alternative for a student whose subject is GCSE or A-level maths and whose main requirement is accessible explanations plus topic practice. It is less suitable as a direct substitute for an IB Biology or IB Physics bank, because its core organisation is maths-led. It also does not solve the same provenance question as a curated real-question bank unless the individual page clearly identifies whether a set is a past-paper question or a teacher-created exam-style item.",
        ],
      },
      {
        heading: "Cognito: free teaching support with exam practice",
        paragraphs: [
          "Cognito’s GCSE page lists video lessons, quizzes, flashcards, exam questions, and past papers mapped to exam boards for GCSE Maths, Biology, Chemistry, Physics, and Combined Science. Its FAQ says most services are free, including videos, lessons, Exam Questions by Topic, and Past Exam Papers, while Quiz and Flashcard sections require Cognito Pro.",
          "That makes Cognito useful when the problem is partly understanding and partly practising. Use a lesson, attempt the questions, then check with a past paper. Verify course coverage before making it your only resource.",
        ],
      },
      {
        heading: "PastPaperPrep: free papers and focused topic practice",
        paragraphs: [
          "PastPaperPrep now lists live banks across Cambridge IGCSE Mathematics, Additional Mathematics, Biology, Chemistry, Physics, Co-ordinated Sciences and Economics, plus IB Maths, Chemistry, Physics, Biology and Economics at HL and SL. Its paid value is not a claim that free PDFs are unavailable. It is the time saved by filtering the bank by course, topic, paper, year, marks, and other available metadata, then building a custom printable set from real questions.",
          "The current pricing structure is one bank at $6 per month or $48 per year; two to five banks start at $10 per month for two, plus $4 per additional bank, or $84 per year for two, plus $36 per additional bank; six or more banks are $25 per month or $216 per year. Complete older exam years can be practised free. Prices and access can change, so confirm the live pricing page before purchase.",
          "PastPaperPrep is useful both for a free full paper and for repairing a known weak topic without hunting through PDF folders. Its worked explanations cover many questions, but it is not a full lesson library across all subjects.",
        ],
      },
      {
        heading: "A practical decision rule",
        paragraphs: [
          "Use PastPaperPrep’s free whole-paper workspace or PMT for a full paper and matching mark scheme. Check Cambridge’s official pages for syllabus context. Use MathsGenie for matching maths courses and Cognito for GCSE teaching. Choose a topical bank for precise real-question selection, and keep Save My Exams when its notes and broader learning tools fill a separate gap.",
          "Whichever route you choose, do not confuse a topical label with mastery. Attempt without help, mark against the scheme, record the first failed step, and retest later in a mixed set.",
        ],
      },
    ],
    faqs: [
      { question: "What is the best free Save My Exams alternative?", answer: "PastPaperPrep is a useful free option for supported Cambridge IGCSE and IB whole papers without signup, plus a separate free topical selection. PMT offers broad free paper and topic resources. MathsGenie and Cognito fit matching maths and GCSE science teaching needs." },
      { question: "Is PastPaperPrep free?", answer: "PastPaperPrep’s whole-paper archives are free without signup. In topical banks, guests see up to 20 matching free questions and a free account unlocks the older free selection. Newer inventory and custom PDF worksheets require eligible access; worksheet exports follow plan allowances." },
      { question: "Does PMT have topical questions?", answer: "Yes. PMT’s maths revision pages link questions by topic, notes, worksheets, model solutions, and papers by exam board. The workflow is more file-and-page based than a single custom question-set builder." },
      { question: "Which alternative is best for IB Maths?", answer: "PastPaperPrep offers free IB Maths whole-paper archives and topical real-question practice in separate AA and AI HL and SL banks. Worked explanations appear on available published questions, not every question. Revision Village remains useful for videos; Save My Exams for written notes. Check current-course compatibility on older papers." },
    ],
    relatedBanks: [
      { href: "/banks/igcse", label: "IGCSE Mathematics 0580 question bank" },
      { href: "/banks/igcse-additional", label: "IGCSE Additional Mathematics 0606 question bank" },
      { href: "/banks/ib-hl", label: "IB Mathematics AA HL question bank" },
      { href: "/pricing", label: "PastPaperPrep pricing" },
    ],
    sources: [
      { href: "https://savemyexams.com/learning-hub/support/why-pay-for-save-my-exams", label: "Save My Exams: Free vs Premium" },
      { href: "https://www.physicsandmathstutor.com/past-papers/", label: "PMT: Past Papers" },
      { href: "https://www.physicsandmathstutor.com/maths-revision/", label: "PMT: Maths Revision" },
      { href: "https://mathsgenie.co.uk/gcse/questions", label: "MathsGenie: GCSE Question Bank" },
      { href: "https://go.cognitoedu.org/gcse", label: "Cognito: GCSE Revision" },
      { href: "https://pastpaperprep.com/", label: "PastPaperPrep home and bank overview" },
      { href: "https://pastpaperprep.com/pricing", label: "PastPaperPrep pricing" },
    ],
  },
  {
    draft: false,
    slug: "pastpaperprep-vs-physics-and-maths-tutor",
    title: "PastPaperPrep vs PMT: Free PDFs or Custom Practice Sets?",
    description: "Both have free past papers. Compare PMT’s downloadable PDFs with PastPaperPrep’s free online papers, topic filters and worked explanations.",
    eyebrow: "Practice platform comparison",
    answer: "PastPaperPrep offers free whole-paper practice without signup and targeted real-question filtering in supported Cambridge IGCSE and IB banks. PMT offers broad free downloadable papers, mark schemes, notes and topic resources across exam boards. Choose by the workflow: a paired whole-paper workspace, a broad file library, or a custom topical worksheet with eligible access. They can complement each other.",
    publishedAt: "2026-09-15",
    updatedAt: "2026-10-16",
    readingMinutes: 7,
    comparison: {
      caption: "PastPaperPrep and PMT at a glance",
      headings: ["Decision point", "PastPaperPrep", "PMT"],
      rows: [
        { label: "Price model", pastPaperPrep: "Free whole papers without signup; separate free topical selection and paid newer inventory/export", competitor: "Free website and downloadable resources" },
        { label: "Core workflow", pastPaperPrep: "Filter curated real questions and build printable sets", competitor: "Browse organised pages and download PDFs" },
        { label: "Best supported scope", pastPaperPrep: "live Cambridge IGCSE and IB banks spanning Maths, Biology, Chemistry, Physics, Co-ordinated Sciences and Economics", competitor: "Broad UK and international board/resource index" },
        { label: "Best for", pastPaperPrep: "A precise weak-topic set without manual PDF assembly", competitor: "A full paper, mark scheme, worksheet, or free topic resource" },
        { label: "Main limitation", pastPaperPrep: "Supported banks only; newer topical inventory and custom export need eligible access", competitor: "You do more of the searching, choosing, and printing" },
      ],
    },
    sections: [
      {
        heading: "The short answer: free PDFs versus less admin",
        paragraphs: [
          "This comparison is not “which site has more questions?” PMT is excellent at making a large set of downloadable resources easy to find. PastPaperPrep is built around a different job: turning a known need such as “IB Physics HL electricity, short questions, recent sessions” into a bounded practice set.",
          "If you are happy to open several PDFs, extract relevant questions, and keep track of mark schemes, PMT may be all you need. If that setup work is the reason you keep postponing topical practice, PastPaperPrep’s paid workflow can be rational. You are paying for retrieval, metadata, selection, and set building, not for a promise of better grades.",
        ],
      },
      freeAccessSection([
        { href: "/past-papers/igcse-maths-0580", label: "IGCSE Maths 0580 whole papers" },
        { href: "/past-papers/ib-physics-hl", label: "IB Physics HL whole papers" },
        { href: "/banks/igcse?free=1", label: "PastPaperPrep IGCSE 0580 bank: free topic practice" },
        { href: "/banks/ib-physics-hl?free=1", label: "IB Physics question bank: free topic practice" },
        { href: "/articles/best-free-igcse-past-paper-websites", label: "Compare free IGCSE paper websites across subjects" },
      ], "For free papers across Cambridge subjects, compare the archive websites in the linked guide. Check the subject code and syllabus before using an older paper."),
      {
        heading: "What PMT does unusually well for free",
        paragraphs: [
          "PMT’s main past-paper page says it provides AQA, CAIE, Edexcel, OCR, Eduqas, and WJEC past papers and mark schemes for GCSEs, IGCSEs, A-levels, and International A-levels. Its maths revision page links revision notes, cheatsheets, worksheets, questions by topic, model solutions, and past papers by exam board.",
          "That organisation is its strength. A student can identify the board, open the relevant subject page, download a paper, attempt it offline, and check the mark scheme. PMT also offers material beyond original exam papers, including worksheets and practice resources. That is enough for many revision plans, especially when the goal is a timed full paper rather than a highly specific topical drill.",
          "PMT’s free status does not mean every linked file has identical provenance or current-spec relevance. Read the page labels, check the exam board and specification, and treat practice papers and older-spec material as different from a current official paper.",
        ],
      },
      {
        heading: "Where PastPaperPrep earns its price",
        paragraphs: [
          "PastPaperPrep currently covers live banks: Cambridge IGCSE Mathematics, Additional Mathematics, Biology, Chemistry, Physics, Co-ordinated Sciences and Economics, plus IB Mathematics, Chemistry, Physics, Biology and Economics at HL and SL. Its proposition is narrower than PMT’s overall resource catalogue, but deeper for the supported banks: questions can be narrowed by course, topic, year, paper, marks, and other available metadata, then selected into a printable set.",
          "That matters when a full paper gives you a diagnosis but not enough repetition. You can practise the same weak skill across several real questions, review the mark scheme or answer, and later remove the topic label in a mixed set. The value is speed and consistency. A learner who only needs two papers a month may not recover the subscription cost in saved time; a tutor or busy student assembling repeated targeted sets may.",
          "PastPaperPrep’s worked explanations can help you review many of its questions. They are separate from the official mark scheme and do not form a full teaching course. PMT’s notes and other teaching resources can still help when you need to learn the method.",
        ],
      },
      {
        heading: "Pricing and access boundaries",
        paragraphs: [
          "PastPaperPrep currently lists one bank at $6 per month or $48 per year. The two-to-five-bank tier starts at $10 per month for two banks, plus $4 per additional bank, or $84 per year for two, plus $36 per additional bank. Six or more banks are $25 per month or $216 per year. Complete older exam years are available free. Confirm the live pricing and the exact free inventory before subscribing, because prices and access rules can change.",
          "PMT’s core resources are free to browse and download. PastPaperPrep’s whole-paper workspace is free too, so try the workflow you prefer before paying. A bank plan becomes useful when you need newer topical inventory or custom worksheet export, not simply permission to attempt a full paper.",
        ],
      },
      {
        heading: "Which workflow should you use?",
        paragraphs: [
          "Choose PMT for a timed paper, a mark scheme, a broad board-specific resource search, or free worksheets and topic pages. Choose PastPaperPrep for a narrow diagnostic, a set with a chosen question count or mark range, or a printable worksheet that combines selected real questions without copying them manually from multiple PDFs.",
          "Use PastPaperPrep, PMT or official board materials for a full paper. Mark it and identify the gap, then try the relevant free topical selection. Consider paid bank access only when newer inventory or custom export is the missing feature. Return to a mixed or timed paper to test transfer.",
        ],
      },
      {
        heading: "The verdict without marketing language",
        paragraphs: [
          "PMT is useful for broad free resources you download and organise yourself. PastPaperPrep adds free paired whole-paper workspaces and focused real-question retrieval on supported courses. Paid access adds newer topical inventory and custom worksheets, not a full notes or video library.",
          "Neither service is a guarantee of a result, and neither should be judged by how many PDFs you collect. Judge the workflow by whether you attempt questions independently, review the first failed step, and can solve the skill later in a mixed context.",
        ],
      },
    ],
    faqs: [
      { question: "Is PMT free?", answer: "PMT’s core past-paper and maths-revision pages are free to browse, with downloadable papers, mark schemes, notes, worksheets, topic questions, and model solutions listed across its resources." },
      { question: "Why pay for PastPaperPrep if PMT is free?", answer: "Pay only if its granular filtering and custom printable-set workflow saves enough manual searching and PDF assembly for you. If downloading and organising PMT files is easy, PMT may be the better value." },
      { question: "Does PastPaperPrep include all PMT subjects?", answer: "No. PastPaperPrep currently lists live banks across Cambridge IGCSE Maths, sciences and Economics plus IB Maths, Chemistry, Physics, Biology and Economics at HL and SL. Check the live bank list for exact course coverage." },
      { question: "Can I use PMT and PastPaperPrep together?", answer: "Yes. Use PMT for free full papers and broad resources, then use PastPaperPrep for a targeted set when a specific weakness needs repeated real-question practice. Return to a mixed or timed PMT paper afterward." },
    ],
    relatedBanks: [
      { href: "/banks/igcse", label: "IGCSE Mathematics question bank" },
      { href: "/banks/ib-hl", label: "IB Mathematics AA HL question bank" },
      { href: "/banks/ib-physics-hl", label: "IB Physics HL question bank" },
      { href: "/pricing", label: "PastPaperPrep pricing" },
    ],
    sources: [
      { href: "https://www.physicsandmathstutor.com/past-papers/", label: "PMT: Past Papers" },
      { href: "https://www.physicsandmathstutor.com/maths-revision/", label: "PMT: Maths Revision" },
      { href: "https://pastpaperprep.com/", label: "PastPaperPrep home and bank overview" },
      { href: "https://pastpaperprep.com/pricing", label: "PastPaperPrep pricing" },
    ],
  },
  {
    draft: false,
    slug: "best-revision-village-alternatives",
    title: "Best Revision Village Alternatives for IB Students: Free and Paid Options",
    description: "Compare free and paid Revision Village alternatives for IB students, from PastPaperPrep and RevisionDojo to Save My Exams and official IB materials.",
    eyebrow: "IB revision platform alternatives",
    answer: "Choose PastPaperPrep as a focused Revision Village alternative for free whole papers and topic-filtered real IB questions, with worked explanations on many questions. Choose RevisionDojo for its wider mix of notes, lessons and AI tools, or Save My Exams for written revision notes across qualifications. Keep Revision Village if video walkthroughs and guided IB practice are the features you use. There is no one-for-one replacement for its full mix of courses and teaching tools.",
    publishedAt: "2026-10-04",
    updatedAt: "2026-10-16",
    readingMinutes: 7,
    comparison: {
      caption: "Revision Village alternatives by revision need",
      headings: ["If you need…", "Best fit", "What to know"],
      rows: [
        { label: "Focused practice from real questions", pastPaperPrep: "PastPaperPrep", competitor: "Free whole papers without signup; separate free topical selection, with eligible access needed for newer inventory and export" },
        { label: "Broad free-to-start IB practice", pastPaperPrep: "RevisionDojo", competitor: "Questionbank is advertised as free; some feedback, AI and study tools have limits" },
        { label: "Notes plus questions across IB subjects", pastPaperPrep: "Save My Exams", competitor: "IB revision notes and exam resources; free access is limited, paid access unlocks more" },
        { label: "Free authentic exam practice", pastPaperPrep: "School-licensed IB papers and official sample assessments", competitor: "Full past examination papers are sold through the IB store; school access varies" },
        { label: "Video walkthroughs and guided IB revision", pastPaperPrep: "Revision Village", competitor: "Often the better fit if its teaching layer is the reason you are looking" },
      ],
    },
    sections: [
      {
        heading: "First decide what you want to replace",
        paragraphs: [
          "PastPaperPrep helps you turn real past-paper questions into focused, printable practice sets. The right alternative depends on whether Revision Village is too expensive for one course, too focused on digital guided practice, or simply more platform than you need.",
          "Revision Village’s Gold page lists a free tier and paid course or broader-suite access; its IB Math Questionbank describes topic-based exam-style questions with mark schemes and video solutions. Those features are a real advantage when you want a worked explanation after an attempt. They are not the same thing as practising only questions from actual exam sessions. Decide which distinction matters before comparing subscriptions.",
          "If you need the next authentic paper, ask your IB teacher or coordinator what your school licenses. The IB says past examination papers and markschemes can be purchased through its store. Public specimen or sample material is useful, but it is not a free public archive of every past session.",
        ],
      },
      freeAccessSection([
        { href: "/articles/revisiondojo-vs-save-my-exams", label: "Compare RevisionDojo and Save My Exams: notes, questions and free limits" },
        { href: "/past-papers/ib-math-aa-hl", label: "IB Maths AA HL whole papers" },
        { href: "/past-papers/ib-math-ai-sl", label: "IB Maths AI SL whole papers" },
        { href: "/banks/ib-hl?free=1", label: "IB Mathematics AA HL question bank: free topic practice" },
        { href: "/banks/ib-ai-sl?free=1", label: "IB Maths AI SL question bank: free topic practice" },
      ], "Compare RevisionDojo with Save My Exams below if written notes and AI-tool allowances are your deciding factors."),
      {
        heading: "PastPaperPrep: real past-paper practice by topic",
        paragraphs: [
          "Choose PastPaperPrep when you know the subject and weak topic and want to assemble more real questions without manually searching through whole papers. Its live IB banks cover Mathematics, Chemistry, Physics, Biology and Economics at HL and SL. Within those banks, available filters help narrow by topic and source details, and selected questions can be turned into printable worksheets.",
          "PastPaperPrep does not provide Revision Village’s video lesson ecosystem, key concepts or bootcamps. It does publish worked explanations on many questions. Start with the free whole-paper workspace or the topical free selection, then check paid bank access and worksheet allowances only if those are the missing features.",
          "Best for: students who want real questions selected by topic and can use a published explanation or official mark scheme to review an attempt. If you need a full lesson sequence or prefer videos, compare the teaching resources as well.",
        ],
      },
      {
        heading: "RevisionDojo: broad IB practice with free-plan limits",
        paragraphs: [
          "RevisionDojo is worth checking if you want an IB-specific alternative with a question bank and more study tools under one roof. Its help page says a free account does not expire and lists allowances for notes, lessons, flashcards, essay marking and question walkthroughs. It also says the question bank and past papers can be browsed and answered for free, while marking an answer uses energy. That is useful access, but “free question bank” does not mean every feedback or tutoring feature is unlimited.",
          "Choose it if breadth and trying several tools matter more than a paper-only workflow. Before subscribing, inspect the current plan page and checkout: features, caps, billing period and promotions can change. Do not compare a monthly equivalent with a one-time or multi-year charge as if they were the same payment.",
        ],
      },
      {
        heading: "Save My Exams: notes and practice across subjects",
        paragraphs: [
          "Save My Exams’ IB pages bring together written revision notes, exam-style questions, flashcards and mock or practice exams where available. Its current plan guide distinguishes Free, Essential and Premium access. Free accounts have resource limits; paid plans add core revision access and, on Premium, more model-answer and feedback tools. Check the exact course before paying.",
          "Pick Save My Exams if readable notes and structured topic materials matter more than building a custom worksheet from real questions. It is not automatically a cheaper substitute: compare the current price, renewal term and number of subjects you will use, not only the prominent monthly figure.",
        ],
      },
      {
        heading: "Official IB and school resources: best for the assessment target",
        paragraphs: [
          "Use teacher-provided, school-licensed resources and official IB specimen or sample assessments to check the course requirements and assessment format. The IB identifies past examination papers and markschemes as purchasable resources. Access for students may depend on the school; ask your coordinator rather than relying on anonymous file-sharing sites or uploads of paid question banks.",
          "Official material is not a full revision platform. It will not necessarily give you the topic-by-topic volume, videos or progress tools you want. Pair a legitimate paper with a separate resource for explanations or targeted repetition.",
        ],
      },
      {
        heading: "Keep Revision Village if the teaching layer is the point",
        paragraphs: [
          "An alternative is not better just because it is cheaper. If video solutions help you understand the step you missed, and you will use the platform’s wider course coverage and exam-preparation tools, Revision Village may still be the strongest fit for you. Its own pricing page distinguishes a free tier from Gold plans; check the current course availability and exact billed amount directly before buying.",
          "A sensible low-risk test is to try the free resources first, then pay only for the missing job. Use a school-licensed or official sample paper to diagnose a gap, a teaching resource when you do not understand the method, and a focused question bank when you need repetition. No subscription guarantees a grade.",
        ],
      },
    ],
    faqs: [
      { question: "What is the best free alternative to Revision Village for IB?", answer: "PastPaperPrep offers free whole-paper practice without signup and a separate free topical selection. Guests see up to 20 matching free questions; a free account unlocks the older free selection. Worked explanations are available on published supported questions. RevisionDojo is another free-to-start option, with limits on marking, AI and study tools." },
      { question: "Does the IB provide free past papers?", answer: "Do not assume full past examination papers are freely available to everyone. The IB says past papers and markschemes can be purchased through its store; your school may also provide licensed access. Public sample or specimen papers are a different resource." },
      { question: "Is PastPaperPrep a Revision Village replacement?", answer: "PastPaperPrep can replace the real-question practice part of your routine and supports worked explanations where published. It does not replace Revision Village’s videos or broader teaching resources. Compare the exact course and the kind of help you need." },
      { question: "Which alternative is best for IB notes and explanations?", answer: "Save My Exams is a better fit when you want structured written notes and practice across courses. RevisionDojo and Revision Village offer broader study tools and feedback in different forms. Check the specific subject, free limits and current paid terms before choosing." },
    ],
    relatedBanks: [
      { href: "/banks/ib-hl", label: "IB Mathematics AA HL question bank" },
      { href: "/banks/ib-physics-hl", label: "IB Physics HL question bank" },
      { href: "/banks/ib-chemistry-hl", label: "IB Chemistry HL question bank" },
      { href: "/pricing", label: "PastPaperPrep pricing and access" },
    ],
    sources: [
      { href: "https://www.savemyexams.com/learning-hub/support/why-pay-for-save-my-exams/", label: "Save My Exams: Free, Essential and Premium access" },
      { href: "https://pastpaperprep.com/pricing", label: "PastPaperPrep pricing and access" },
      { href: "https://www.revisionvillage.com/revision-village-gold/", label: "Revision Village Gold plans and pricing" },
      { href: "https://www.revisionvillage.com/ib-math/questionbank/", label: "Revision Village IB Math Questionbank" },
      { href: "https://revisiondojo.com/help-center/whats-free", label: "RevisionDojo: What do I get for free?" },
      { href: "https://www.savemyexams.com/dp/", label: "Save My Exams IB revision resources" },
      { href: "https://ibpublishing.ibo.org/extendedessay/apps/dpapp/guide.html?doc=d_0_eeyyy_gui_1602_1_e&part=6&chapter=1&section=1", label: "IB: Assessment in the Diploma Programme" },
    ],
  },
  {
    draft: true,
    slug: "real-past-papers-vs-exam-style-questions",
    title: "Real Past Papers vs Exam-Style Questions: What Works Better?",
    description: "Real past papers test authentic assessment decisions; exam-style questions add targeted repetition. Use both in the right order.",
    eyebrow: "Revision strategy",
    answer: "Neither is universally better. Real past papers are the strongest test of authentic exam wording, structure, timing, and mark-scheme expectations. Exam-style questions are often better for repairing one weak skill because they provide more repetition and can be arranged by topic or difficulty. Use exam-style questions to learn and target, real past papers to validate and simulate, then return to targeted practice when the paper reveals a gap.",
    publishedAt: "2026-09-30",
    updatedAt: "2026-09-12",
    readingMinutes: 7,
    comparison: {
      caption: "Real papers and exam-style questions serve different jobs",
      headings: ["Revision job", "Real past papers", "Exam-style questions"],
      rows: [
        { label: "Authentic exam format", pastPaperPrep: "Strongest evidence of the assessment as actually set", competitor: "Can imitate format, but is not the same sitting" },
        { label: "Target one weak topic", pastPaperPrep: "Possible only if organised or manually selected", competitor: "Usually easier to group and repeat" },
        { label: "Timing and stamina", pastPaperPrep: "Best test of the complete paper experience", competitor: "Useful in short drills, weaker as a full simulation" },
        { label: "Learning a method", pastPaperPrep: "Can diagnose, but may give too little repetition", competitor: "More repetition and controlled progression" },
        { label: "Final readiness check", pastPaperPrep: "Use several papers under realistic conditions", competitor: "Use to repair gaps before the check" },
      ],
    },
    sections: [
      {
        heading: "Start with the distinction, not a slogan",
        paragraphs: [
          "A real past-paper question was used in an actual examination session. It carries the original context: the paper structure, instructions, permitted tools, timing, mark allocation, and the mark scheme created for that assessment. An exam-style question is written to resemble that kind of assessment. It may be excellent, carefully reviewed, and useful without being an actual past-paper question.",
          "That provenance difference matters when you want to know what the exam really feels like. It does not make authored questions fake, inferior, or useless. A well-designed exam-style question can isolate a skill that a real paper happens to test only once. The two formats answer different questions about readiness.",
        ],
      },
      {
        heading: "What real past papers do better",
        paragraphs: [
          "Real papers are the best available rehearsal for exam decisions. They show how topics are combined, how much information is given, how command words are used, how marks are distributed, and how quickly you must move between easy and demanding parts. They also test selection: you must recognise the method without a topic heading announcing it.",
          "Use them under realistic conditions once you have learned the core methods. Do not look at the mark scheme after every line. Complete a section or paper, mark it carefully, and classify lost marks by knowledge, method, execution, or exam decision. One score is noisy; a pattern across several papers is more informative.",
          "Official papers can also carry course-specific instructions that matter. Cambridge examiner reports, for example, repeatedly stress that unsupported calculator answers may not receive marks where working is required. The paper and mark scheme together reveal expectations that a generic worksheet may not capture.",
        ],
      },
      {
        heading: "What exam-style questions do better",
        paragraphs: [
          "Exam-style questions are efficient when you already know the gap. If simultaneous equations, data interpretation, stoichiometry, or a particular proof step keeps failing, a full paper may offer too few examples to repair it. A topical set can give you several attempts in one session, with progression from direct applications to unfamiliar wording and combined skills.",
          "This is also where a curated platform can help. PastPaperPrep’s supported banks use real questions organised by course and available metadata, while other resources such as MathsGenie, PMT, and Cognito offer topic practice that may include a mixture of past-paper and authored material. Read the label and source context. “Exam-style” describes resemblance, not provenance.",
          "The risk is over-prompting. If every question has the same topic label, you may learn to execute a method without learning to select it. After a focused set, remove the label and mix the skill with competing topics.",
        ],
      },
      {
        heading: "A sequence that uses both",
        paragraphs: [
          "Use this four-stage loop. First, take a diagnostic section or paper. Second, identify the smallest skill behind recurring lost marks. Third, practise a short topical set, using real or exam-style questions and reviewing the first failed step. Fourth, return to a mixed or timed real paper and check whether the improvement transfers.",
          "If the same issue returns, do not simply take another full paper. Go back to a smaller set and make the missing distinction explicit. If the issue is timing, presentation, or method selection rather than subject knowledge, practise that behaviour directly under a time limit.",
        ],
        bullets: [
          "Learning a new method: start with explanations and a few guided exam-style questions.",
          "Repairing a known weakness: use a topical set with enough repetition to expose the pattern.",
          "Testing transfer: use a mixed set with no topic labels.",
          "Simulating the exam: use a complete real paper with the correct timing and permitted tools.",
        ],
      },
      {
        heading: "How to judge an exam-style resource",
        paragraphs: [
          "A question can be valuable for skill practice while still not being evidence of what an upcoming paper will contain.",
          "Prefer transparent resources. PMT distinguishes past papers, practice papers, topic questions, notes, and model solutions. MathsGenie labels question-bank and past-paper areas separately, while Cognito describes exam questions and past papers as different resources. That lets you choose a source for the job instead of treating all PDFs as equivalent.",
        ],
      },
      {
        heading: "The verdict: sequence beats loyalty",
        paragraphs: [
          "If you can only do one real paper before an exam, choose the real paper for the most authentic check. If you have a weak topic and only a few questions from it in the paper, choose exam-style or topical practice for the repair session. In a normal revision cycle, use both: authored questions for volume and controlled focus, real papers for authenticity, transfer, pacing, and final validation.",
          "Past papers are not a teaching substitute, and exam-style questions are not a prediction of the next paper. The productive question is not “which type wins?” It is “what decision am I trying to practise today?”",
        ],
      },
    ],
    faqs: [
      { question: "Are exam-style questions as good as real past papers?", answer: "They can be excellent for targeted learning and repetition, but they do not provide the same evidence as a real paper about authentic wording, structure, timing, and mark-scheme expectations. Use each for its proper job." },
      { question: "Should I do past papers or topical questions first?", answer: "Use a diagnostic paper or section first when you do not know your gaps. Then use topical questions to repair the specific weakness, and return to a mixed or timed real paper to test transfer." },
      { question: "Are authored exam-style questions fake?", answer: "No. They are authored practice questions rather than questions taken from a live past examination. Their value depends on alignment, clarity, and solution quality, not on pretending to be official past papers." },
      { question: "How many real past papers should I do?", answer: "There is no useful universal number. Do enough to see recurring patterns, mark and correct them, and retest the underlying skills. Several carefully reviewed papers are more useful than a large unreviewed pile." },
    ],
    relatedBanks: [
      { href: "/banks/igcse", label: "IGCSE Mathematics real-question bank" },
      { href: "/banks/ib-hl", label: "IB Mathematics AA HL real-question bank" },
      { href: "/articles/how-to-use-maths-past-papers-effectively", label: "How to use maths past papers effectively" },
    ],
    sources: [
      { href: "https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-igcse-mathematics-0580/past-papers/", label: "Cambridge IGCSE Mathematics past papers" },
      { href: "https://www.cambridgeinternational.org/Images/567737-june-2024-examiner-report.pdf", label: "Cambridge Mathematics examiner report" },
      { href: "https://www.physicsandmathstutor.com/maths-revision/", label: "PMT: Maths Revision resources" },
      { href: "https://mathsgenie.co.uk/gcse/questions", label: "MathsGenie: GCSE Question Bank" },
      { href: "https://go.cognitoedu.org/gcse", label: "Cognito: GCSE Revision" },
      { href: "https://pastpaperprep.com/", label: "PastPaperPrep bank overview" },
    ],
  },
] satisfies readonly Article[];