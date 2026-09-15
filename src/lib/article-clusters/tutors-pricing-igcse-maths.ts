import type { Article } from "@/lib/articles";

export const TUTORS_PRICING_IGCSE_MATHS: readonly Article[] = [
  {
    draft: false,
    slug: "pastpaperprep-for-tutors-printable-practice-sets",
    title: "PastPaperPrep for Tutors: Build Printable Practice Sets",
    description: "Build printable past-paper practice sets for tutoring sessions by syllabus, topic, paper, year, and marks, then download questions and answers.",
    eyebrow: "Tutor workflow",
    answer: "PastPaperPrep helps tutors turn a live past-paper bank into a focused printable set. Choose the bank, filter for the syllabus and skill you are teaching, select questions, download the set, and keep the available answers or mark schemes ready for review. It is a question-selection and printable-practice workflow, not an LMS or automatic marking system.",
    publishedAt: "2026-09-15",
    updatedAt: "2026-09-15",
    readingMinutes: 6,
    sections: [
      {
        heading: "Start with the live bank that matches the learner",
        paragraphs: [
          "Open the relevant PastPaperPrep bank before planning the worksheet. The bank is the source of truth for the questions currently available, so begin with the exact qualification rather than searching by a broad subject name. For Cambridge IGCSE Maths, use the IGCSE bank for 0580 or the IGCSE Additional bank for 0606.",
          "This first choice prevents a common tutoring problem: handing a learner a plausible-looking question from the wrong syllabus, paper, or tier. If the learner is preparing for a particular exam series, keep the syllabus version and paper structure in view while you filter.",
        ],
        bullets: [
          "Confirm the qualification and subject before choosing questions.",
          "Match Core, Extended, or Additional content where the bank provides that distinction.",
          "Use the live bank rather than assuming every year or paper is available.",
        ],
      },
      {
        heading: "Filter for the lesson objective",
        paragraphs: [
          "A printable set works best when every question has a reason to be there. Filter by topic or subtopic for a skills lesson, then narrow by paper, year, session, marks, or other available metadata. A short set on simultaneous equations should feel different from a mixed diagnostic set, even if both come from the same bank.",
          "For a first session, choose a manageable spread: a couple of accessible questions, several that require the target method, and one or two that test transfer. For exam rehearsal, reduce topic prompting and select a mixed set that asks the learner to decide which method applies.",
          "Do not promise a filter the bank does not show. Available controls can vary by bank, and the practical workflow is to use the fields currently offered on the bank page.",
        ],
      },
      {
        heading: "Select questions, then check the set as a tutor",
        paragraphs: [
          "Review the selected questions before downloading. Look for repeated wording, a jump in difficulty that is too sharp, or a set that tests the same narrow technique several times. A good tutoring sheet has a clear purpose and enough variety to reveal whether the learner can use the idea independently.",
          "Keep the session length realistic. Ten carefully chosen questions may be enough for a one-hour lesson when the student must explain methods and correct errors. A longer set can become homework or a follow-up check, but it should not crowd out discussion.",
          "If the bank exposes paper and mark information, use it to balance the selection. Marks are a useful proxy for demand, but they are not a complete difficulty rating. Read the question, not just its metadata.",
        ],
      },
      {
        heading: "Build and download the printable set",
        paragraphs: [
          "Once the questions fit the lesson, build the set and download the printable version. Give the learner the question pages without answers when you want an independent attempt. Keep the available answer or mark-scheme material separate so it can support marking after the attempt rather than becoming a prompt during the work.",
          "Before printing, check page order, diagrams, question numbering, and whether any supporting material is included as intended. If the downloaded set is being sent digitally, name it with the topic, paper or year range, and date so you can find the same session again.",
        ],
      },
      {
        heading: "Use answers and mark schemes to guide the discussion",
        paragraphs: [
          "PastPaperPrep can put the available answers or mark schemes alongside your practice workflow, but the tutor still leads the feedback. Ask the learner to show working, identify the first point where the method changed, and compare that step with the marking points. A final answer alone rarely explains why a mark was lost.",
          "Record one concrete correction for the next lesson: a missing unit, an incorrect substitution, an unlabelled graph, or a command word that was misread. Then build the next set around that correction. This creates a simple loop of select, practise, mark, and retest.",
        ],
      },
      {
        heading: "A repeatable tutor routine",
        paragraphs: [
          "Use the same five-step routine each time: choose the live bank, filter to the lesson goal, select a balanced set, download and print, then review against the available answers or mark scheme. Save the lesson notes separately if you need a record of what was covered.",
          "The value is not in producing the longest worksheet. It is in making the next set more relevant than the last one. A focused printable set gives you a concrete starting point for the lesson and a clean set of questions to revisit when the learner is ready for mixed or timed practice.",
        ],
      },
    ],
    faqs: [
      { question: "Can PastPaperPrep automatically mark my student's work?", answer: "No. It provides questions and the available answers or mark schemes for review. The tutor or learner checks the work and discusses the corrections." },
      { question: "Can I use PastPaperPrep as an LMS or class-management system?", answer: "No. The supported workflow is to filter questions, build and download a printable set, and use the available answers or mark schemes. It does not claim LMS, class-management, or institutional administration features." },
      { question: "Can I make a set for a specific topic?", answer: "Yes, when the selected bank exposes that topic or subtopic filter. You can combine it with other available filters such as paper, year, session, or marks." },
      { question: "Which Cambridge Maths banks can tutors use?", answer: "Use the live IGCSE bank for Cambridge 0580 and the live IGCSE Additional bank for Cambridge 0606. Check the bank page for the current question and answer coverage." },
    ],
    relatedBanks: [
      { href: "/banks/igcse", label: "Browse IGCSE past papers" },
      { href: "/banks/igcse-additional", label: "Browse IGCSE Additional past papers" },
    ],
    sources: [
      { href: "https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-igcse-mathematics-0580/past-papers/", label: "Cambridge IGCSE Mathematics 0580 past papers" },
      { href: "https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-igcse-mathematics-additional-0606/past-papers/", label: "Cambridge IGCSE Additional Mathematics 0606 past papers" },
    ],
  },
  {
    draft: false,
    slug: "pastpaperprep-pricing-which-plan",
    title: "PastPaperPrep Pricing: Which Plan Is Right for You?",
    description: "Compare PastPaperPrep one-bank, Build Your Plan, and All Access pricing by the number of subjects you actually need.",
    eyebrow: "Pricing guide",
    answer: "Choose the cheapest PastPaperPrep plan that covers the banks you will use. One bank costs $6 per month or $48 per year, Build Your Plan covers two to five banks at $10 per month for two plus $4 per extra bank, and All Access covers six or more banks at $25 per month or $216 per year. There is no cart or preselection step, and old subscriptions remain grandfathered.",
    publishedAt: "2026-09-15",
    updatedAt: "2026-09-15",
    readingMinutes: 6,
    sections: [
      {
        heading: "Pick by the number of banks, not by the label",
        paragraphs: [
          "The right plan depends on how many subject banks you genuinely need. Count the banks you expect to use during the subscription, then compare that number with the price bands. A learner preparing for one subject should not pay for broad access, while someone switching among several qualifications may save by using the multi-bank option.",
          "Bank count is the useful starting point because PastPaperPrep access is organized around banks. Make a short list before subscribing: for example, Cambridge IGCSE Maths 0580, IGCSE Additional Maths 0606, and one science bank. Do not count a bank just because it might be useful someday.",
        ],
      },
      {
        heading: "One bank: $6 monthly or $48 yearly",
        paragraphs: [
          "Choose the one-bank plan when you need one subject bank. It costs $6 per month or $48 per year, with the annual option shown as $4 per month. The annual price is the lower-cost choice for a full year of planned use, while monthly billing keeps the commitment shorter when your revision window is uncertain.",
          "This is the simple fit for a single-subject learner, a parent supporting one exam, or a tutor who only needs one bank for a particular student. If your needs expand, compare the new bank count before changing plans rather than assuming the broadest option is better.",
        ],
      },
      {
        heading: "Build Your Plan: two to five banks",
        paragraphs: [
          "Build Your Plan is for two to five banks. The monthly price is $10 for two banks, then $4 per additional bank. The annual price is $84 for two banks, shown as $7 per month, then $36 per additional bank. In other words, monthly totals are $10 for two, $14 for three, $18 for four, or $22 for five; annual totals are $84 for two, $120 for three, $156 for four, or $192 for five.",
          "Choose this tier when you can name a small set of subjects but do not need six or more. It is especially useful for a mixed exam timetable, such as Maths plus two sciences, because you can pay for the banks that are actually on the plan rather than buying a larger bundle.",
        ],
      },
      {
        heading: "All Access: six or more banks",
        paragraphs: [
          "All Access costs $25 per month or $216 per year, with the annual option shown as $18 per month. It is the fit for six or more banks or for a study plan that genuinely needs wide coverage. At five banks, Build Your Plan is $22 per month or $192 per year, so moving to All Access makes sense when you need the sixth bank or expect to use broad coverage throughout the year.",
          "Do not choose All Access simply because it is the largest tier. If you only need one, two, three, four, or five banks, the smaller option is cheaper and should be the recommendation.",
        ],
      },
      {
        heading: "Monthly versus annual billing",
        paragraphs: [
          "Use monthly billing when you are testing your study plan, have an exam close ahead, or do not know how long you will need access. Use annual billing when you have a clear year-long revision schedule and the lower effective monthly price is worth paying upfront.",
          "The annual comparisons are straightforward: one bank is $48 instead of twelve monthly payments of $72; two banks are $84 instead of $120; and All Access is $216 instead of $300. These are price comparisons, not a reason to buy more banks than you need.",
        ],
      },
      {
        heading: "What to expect at checkout",
        paragraphs: [
          "PastPaperPrep does not use a cart or preselection flow for choosing banks. Select the plan that matches your intended bank count and confirm the current plan details in the product flow. Existing subscribers on older plans are grandfathered, so their previous subscription terms are not silently replaced by these current prices.",
          "The practical rule is simple: one bank, choose one bank; two to five, calculate Build Your Plan; six or more, compare All Access. Recheck the count if your subjects change, and keep the cheaper fit when it still covers your work.",
        ],
      },
    ],
    faqs: [
      { question: "What is the cheapest PastPaperPrep option for one bank?", answer: "The one-bank plan is $6 per month or $48 per year, with the annual price shown as $4 per month." },
      { question: "How much does Build Your Plan cost?", answer: "It is $10 per month for two banks, plus $4 per month for each extra bank. Annual pricing is $84 for two banks, plus $36 per extra bank." },
      { question: "When is All Access worth it?", answer: "All Access is for six or more banks and costs $25 per month or $216 per year, shown as $18 per month. Choose it only when you need that breadth." },
      { question: "Can I preselect banks in a cart?", answer: "No. PastPaperPrep does not use a cart or preselection step. Choose the current plan that matches the number of banks you need." },
      { question: "What happens to an older subscription?", answer: "Old subscriptions are grandfathered. Current pricing does not erase the terms of an existing older subscription." },
    ],
    relatedBanks: [
      { href: "/banks/igcse", label: "Browse IGCSE past papers" },
      { href: "/banks/igcse-additional", label: "Browse IGCSE Additional past papers" },
    ],
    sources: [
      { href: "/pricing", label: "PastPaperPrep pricing" },
    ],
  },
  {
    draft: false,
    slug: "best-igcse-maths-past-paper-websites",
    title: "Best IGCSE Maths Past-Paper Websites for 0580 and 0606",
    description: "Compare official Cambridge PDFs, PMT, MathsGenie, and PastPaperPrep for Cambridge IGCSE Maths 0580 and Additional Maths 0606.",
    eyebrow: "Buyer guide",
    answer: "For Cambridge IGCSE Maths 0580 and Additional Maths 0606, start with Cambridge International for official PDFs and syllabus context. Use Physics & Maths Tutor for a broad free archive of papers and mark schemes, and MathsGenie for free practice where its coverage matches your course. Choose PastPaperPrep when you want live-bank filtering by topic, paper, year, marks, and other available metadata instead of manually opening many PDFs.",
    publishedAt: "2026-09-15",
    updatedAt: "2026-09-15",
    readingMinutes: 7,
    sections: [
      {
        heading: "First check the exact Cambridge code",
        paragraphs: [
          "0580 and 0606 are not interchangeable. Cambridge IGCSE Mathematics 0580 has its own syllabus and paper structure; Cambridge IGCSE Additional Mathematics 0606 is a separate qualification with different content and assessment materials. Start with the code on your entry or syllabus before choosing a website.",
          "Cambridge's public pages include a selection of question papers, mark schemes, examiner reports, and specimen exams. Cambridge also warns that the public selection is not the full teacher resource collection, and older papers may not reflect the current syllabus. Treat the syllabus and specimen materials as your alignment check.",
        ],
      },
      {
        heading: "Cambridge International: the official reference",
        paragraphs: [
          "Cambridge is the first stop when accuracy of qualification, paper, and syllabus matters most. Its 0580 and 0606 past-paper pages identify the qualification, show the available public PDFs, and pair question papers with mark schemes and examiner reports where provided. The 0606 page, for example, lists 2024 question papers and mark schemes plus 2025 specimen materials.",
          "The limitation is convenience. The public site is a document library, not a filtering workspace for building a custom topic set. Some teaching and examination resources are restricted to registered Cambridge schools through the School Support Hub.",
        ],
      },
      {
        heading: "Physics & Maths Tutor: broad free archives",
        paragraphs: [
          "Physics & Maths Tutor is useful when you want a large, familiar archive of downloadable PDFs and mark schemes without paying. Its Cambridge IGCSE Maths pages organize papers by paper number and include 0580 materials, with question papers and mark schemes listed across years and sessions. This makes it a practical source for full-paper practice and manual download.",
          "The trade-off is that you do the sorting. Finding a small set on one topic can mean opening papers, reading question numbers, and keeping a separate list. PMT is therefore strong for free breadth, but less direct for a tutor who wants ten questions on one skill in a printable order.",
        ],
      },
      {
        heading: "MathsGenie: useful free practice, with a coverage check",
        paragraphs: [
          "MathsGenie offers free IGCSE revision materials, past papers, mark schemes, and worksheets. Its visible IGCSE revision hub is centered on Edexcel IGCSE Maths, so it can be useful when that is your specification, but it should not be treated as a universal Cambridge 0580 or 0606 archive without checking the exact qualification and paper code.",
          "Use MathsGenie for practice and explanations when the course match is explicit. If your learner is taking Cambridge 0580 or 0606, verify that the resource is aligned before spending a revision session on it. A free PDF is only useful when it tests the content and paper style the learner will actually meet.",
        ],
      },
      {
        heading: "PastPaperPrep: filtering instead of PDF hunting",
        paragraphs: [
          "PastPaperPrep is the paid option in this comparison. Its value is the live-bank workflow: open /banks/igcse for 0580 or /banks/igcse-additional for 0606, filter using the controls available on that bank, select questions, and build or download a practice set. The bank can make topic, paper, year, marks, and similar metadata easier to use than a folder of PDFs.",
          "Choose it when your main problem is selection rather than access to any paper at all. A tutor can make a focused worksheet, and a learner can move from topic practice to mixed or timed work without manually assembling every question. It does not replace Cambridge's official syllabus check, and it does not make a free archive unnecessary for every user.",
        ],
      },
      {
        heading: "A practical choice by use case",
        paragraphs: [
          "Choose Cambridge International when you need the authoritative syllabus context, official public PDFs, specimen papers, examiner reports, or a final check that a paper belongs to 0580 or 0606. Choose PMT when you want a broad free archive for full papers and mark schemes. Choose MathsGenie when its clearly labelled specification matches your learner. Choose PastPaperPrep when you want searchable, filterable selection and printable-set building.",
          "Many learners can use more than one. A sensible combination is Cambridge for alignment, PMT for free full-paper volume, and PastPaperPrep for targeted sets between full papers. The best website is the one that matches the job you need done, not the one with the longest list of PDFs.",
        ],
      },
    ],
    faqs: [
      { question: "Where should I get official 0580 past papers?", answer: "Use Cambridge International's Cambridge IGCSE Mathematics 0580 past-paper page for the official public selection, mark schemes, examiner reports, and specimen materials." },
      { question: "Where should I get official 0606 past papers?", answer: "Use Cambridge International's Cambridge IGCSE Additional Mathematics 0606 past-paper page. Check the syllabus and specimen materials because older papers may not reflect the current syllabus." },
      { question: "Is PMT free for Cambridge IGCSE Maths?", answer: "PMT provides a broad free archive of downloadable Cambridge IGCSE Maths papers and mark schemes. Check the paper code and session before using a file." },
      { question: "Does MathsGenie cover Cambridge 0580 and 0606?", answer: "Check the exact qualification on each resource. Its visible IGCSE hub is centered on Edexcel IGCSE Maths, so do not assume every resource matches Cambridge 0580 or 0606." },
      { question: "Why pay for PastPaperPrep if official PDFs are free?", answer: "Pay for the filtering workflow if you need to select questions by available metadata, build focused printable sets, and spend less time hunting through separate PDF files. Free official sources remain useful for alignment and full-paper practice." },
    ],
    relatedBanks: [
      { href: "/banks/igcse", label: "PastPaperPrep IGCSE 0580 bank" },
      { href: "/banks/igcse-additional", label: "PastPaperPrep IGCSE Additional 0606 bank" },
    ],
    sources: [
      { href: "https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-igcse-mathematics-0580/past-papers/", label: "Cambridge IGCSE Mathematics 0580 past papers" },
      { href: "https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-igcse-mathematics-additional-0606/past-papers/", label: "Cambridge IGCSE Additional Mathematics 0606 past papers" },
      { href: "https://www.physicsandmathstutor.com/past-papers/gcse-maths/cie-igcse-paper-4", label: "Physics & Maths Tutor Cambridge IGCSE Maths papers" },
      { href: "https://www.mathsgenie.co.uk/igcse.html", label: "MathsGenie IGCSE revision hub" },
    ],
  },
] as const;