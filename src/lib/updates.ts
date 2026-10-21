import type { BankSlug } from "@/lib/catalog";
import { subjectSlugForBank } from "@/lib/past-paper-catalog";

/** Public changelog for /updates. Newest first; write for students, not for the codebase. */
export type UpdateTag = "New bank" | "New papers" | "Feature" | "Improvement";
export type UpdateTone = "math" | "chemistry" | "physics" | "biology" | "economics" | "coordinated" | "computer-science";

/** A plain link, or one subject with several level links ("Biology  HL · SL"). */
export type UpdateLink = { label: string; href: string } | { label: string; options: readonly { label: string; href: string }[] };

export type Update = {
  date: string; // YYYY-MM-DD
  tag: UpdateTag;
  title: string;
  body: string;
  tone?: UpdateTone;
  links?: readonly UpdateLink[];
};

export const COMING_SOON: readonly string[] = [
  "Ask AI for help on any question you're stuck on",
  "Worked explanations for the remaining banks",
];

const pair = (label: string, slug: string, suffix = "") => ({ label, options: [{ label: "HL", href: `${slug}-hl${suffix}` }, { label: "SL", href: `${slug}-sl${suffix}` }] });
const ib2026 = (label: string, slug: string) => pair(label, `/past-papers/${slug}`, "/2026");
const ibBank = (label: string, slug: string) => pair(label, `/banks/${slug}`);
const CHATGPT_APP = "https://chatgpt.com/plugins/plugin_asdk_app_6abec4a63a288191937b45f8a7adca79";
const bank = (label: string, slug: string) => ({ label, href: `/banks/${slug}` });

export const UPDATES: readonly Update[] = [
  { date: "2026-10-20", tag: "New bank", tone: "computer-science", title: "IB Computer Science HL and SL", body: "506 HL and 391 SL questions from 2019 to 2026, sorted by topic and matched to the new syllabus where they fit.", links: [ibBank("Practise by topic", "ib-computer-science")] },
  { date: "2026-10-20", tag: "New bank", tone: "computer-science", title: "IGCSE Computer Science 0478", body: "847 questions from 105 papers (2019–2026), sorted by topic, each with a worked explanation that shows code properly.", links: [{ label: "Practise by topic", href: "/banks/igcse-computer-science-0478" }, { label: "Full past papers", href: "/past-papers/igcse-computer-science-0478" }] },
  { date: "2026-10-20", tag: "Improvement", tone: "chemistry", title: "Chemistry 2024 explanations", body: "All 704 Chemistry 0620 questions from 2024 now have worked explanations.", links: [bank("Chemistry 0620", "igcse-chemistry-0620")] },
  { date: "2026-10-20", tag: "Improvement", title: "Smoother PDF downloads", body: "Downloading the same worksheet again is free, big exports ask first, and you choose where the answers go after pressing Download.", links: [{ label: "My worksheets", href: "/worksheets" }] },
  { date: "2026-10-19", tag: "Feature", tone: "computer-science", title: "Computer Science in ChatGPT", body: "The PastPaperPrep app in ChatGPT now covers IGCSE Computer Science too.", links: [{ label: "PastPaperPrep in ChatGPT", href: CHATGPT_APP }] },
  { date: "2026-10-19", tag: "Improvement", title: "More Maths and Biology explanations", body: "Worked explanations for Maths 0580 2022 and 2023, Biology 0610 2024 and Additional Maths 0606 2024.", links: [bank("Maths 0580", "igcse"), bank("Biology 0610", "igcse-biology-0610"), bank("Additional Maths 0606", "igcse-additional")] },
  { date: "2026-10-19", tag: "Improvement", title: "IB 2024 explanations", body: "1,020 more worked explanations for IB sciences and Economics, mostly from 2024.", links: [ibBank("Biology", "ib-biology"), ibBank("Chemistry", "ib-chemistry"), ibBank("Physics", "ib-physics"), ibBank("Economics", "ib-economics")] },
  { date: "2026-10-19", tag: "Improvement", title: "Figures shown with IB questions", body: "When several IB questions share a figure, each of them now shows it." },
  { date: "2026-10-18", tag: "Improvement", title: "Explanations for 2024 and 2025", body: "Worked explanations for Biology 0610 2025, Maths 0580 2024, the IB sciences 2020 free year, and Chemistry and Physics 2025.", links: [bank("Biology 0610", "igcse-biology-0610"), bank("Maths 0580", "igcse"), bank("Physics 0625", "igcse-physics-0625")] },
  { date: "2026-10-17", tag: "Improvement", title: "290 mark schemes repaired", body: "Cut-off mark schemes in Co-ordinated Sciences, Chemistry and Physics now show in full.", links: [bank("Co-ordinated Sciences 0654", "igcse-coordinated-sciences-0654"), bank("Chemistry 0620", "igcse-chemistry-0620"), bank("Physics 0625", "igcse-physics-0625")] },
  { date: "2026-10-17", tag: "Improvement", title: "1,458 more explanations", body: "Worked explanations added across Co-ordinated Sciences, Economics, Biology, Chemistry, Additional Maths and Physics.", links: [bank("Economics 0455", "igcse-economics-0455"), bank("Co-ordinated Sciences 0654", "igcse-coordinated-sciences-0654")] },
  { date: "2026-10-16", tag: "Improvement", title: "3,081 more explanations", body: "Most 2026 papers now have worked explanations, plus more for the IB and IGCSE sciences." },
  { date: "2026-10-16", tag: "Feature", tone: "chemistry", title: "Periodic Table button", body: "Open the Periodic Table beside any Chemistry or Co-ordinated Sciences question.", links: [bank("Chemistry 0620", "igcse-chemistry-0620"), bank("Co-ordinated Sciences 0654", "igcse-coordinated-sciences-0654")] },
  { date: "2026-10-16", tag: "Improvement", title: "Blank pages removed", body: "1,065 blank-page images no longer appear in the science banks." },
  { date: "2026-10-16", tag: "Improvement", title: "Fewer download limits", body: "Members are much less likely to hit a daily limit when exporting PDFs.", links: [{ label: "My worksheets", href: "/worksheets" }] },
  { date: "2026-10-16", tag: "Improvement", title: "Cleaner PDF worksheets", body: "A clearer title block, bigger question numbers, sensible file names and a “1 mark” label where it applies." },
  { date: "2026-10-16", tag: "Improvement", title: "Marks match the printed papers", body: "Question totals in Physics, Chemistry, Co-ordinated Sciences and Biology now match the printed papers." },
  { date: "2026-10-15", tag: "New papers", title: "IB May 2026 papers", body: "Official May 2026 papers for Biology, Chemistry, Physics, Economics and Maths AI — 942 new questions.", links: [ib2026("Biology", "ib-biology"), ib2026("Chemistry", "ib-chemistry"), ib2026("Physics", "ib-physics"), ib2026("Economics", "ib-economics"), ib2026("Maths AI", "ib-math-ai")] },
  { date: "2026-10-15", tag: "Feature", title: "Build a paper on one screen", body: "Pick topics and years, watch the paper build live, then save or download it in place.", links: [{ label: "Build a paper", href: "/worksheets/build" }] },
  { date: "2026-10-15", tag: "Improvement", title: "2,125 explanations for the latest years", body: "Worked explanations for Maths 0580 2025–26, Additional Maths, IB Chemistry, Economics, Biology, Physics SL and Physics 0625.", links: [bank("Maths 0580", "igcse"), bank("Additional Maths 0606", "igcse-additional")] },
  { date: "2026-10-15", tag: "Feature", title: "PastPaperPrep in ChatGPT", body: "Ask ChatGPT for past-paper questions on a topic and get practice cards that link back to the full set here.", links: [{ label: "PastPaperPrep in ChatGPT", href: CHATGPT_APP }] },
  { date: "2026-10-15", tag: "New papers", tone: "math", title: "More exam-style practice", body: "New sets on Indices and Advanced Trigonometry for Maths 0580, Sets and Probability for AA SL, and four Functions booklets for AA HL.", links: [{ label: "Maths 0580", href: "/banks/igcse/exam-style" }, { label: "AA SL", href: "/banks/ib-sl/exam-style" }, { label: "AA HL", href: "/banks/ib-hl/exam-style" }] },
  { date: "2026-10-14", tag: "New papers", title: "More 2026 IGCSE papers", body: "Biology 0610 May/June, Economics 0455, Maths 0580 Core and Additional Maths 0606 Feb/March.", links: [{ label: "Biology 0610", href: "/past-papers/igcse-biology-0610/2026" }, { label: "Economics 0455", href: "/past-papers/igcse-economics-0455/2026" }, { label: "Maths 0580", href: "/past-papers/igcse-maths-0580/2026" }, { label: "Additional Maths 0606", href: "/past-papers/igcse-additional-maths-0606/2026" }] },
  { date: "2026-10-14", tag: "New papers", tone: "math", title: "IB Maths AA May 2026", body: "The official May 2026 Maths AA papers are in.", links: [ib2026("Maths AA", "ib-math-aa")] },
  { date: "2026-10-14", tag: "Improvement", title: "Cut-off questions repaired", body: "273 clipped Additional Maths answers, 20 Biology questions and 13 Economics questions now show in full.", links: [bank("Additional Maths 0606", "igcse-additional"), bank("Biology 0610", "igcse-biology-0610"), bank("Economics 0455", "igcse-economics-0455")] },
  { date: "2026-10-14", tag: "Feature", title: "Smarter search", body: "One search box understands paper codes, topics and subjects, with a switch between topic practice and full papers.", links: [{ label: "Try it", href: "/" }] },
  { date: "2026-10-14", tag: "Improvement", title: "Clearer answers", body: "Multiple-choice answers show as a letter, and mark schemes appear at their natural size." },
  { date: "2026-10-13", tag: "Feature", title: "Free full past papers", body: "Whole past papers for every bank, free — read them here, use a timer and mark your own work.", links: [{ label: "Full past papers", href: "/past-papers" }] },
  { date: "2026-10-13", tag: "Feature", title: "Report a problem", body: "Spot a wrong mark or a cut-off image? Flag it from the question card and we'll fix it." },
  { date: "2026-10-12", tag: "Feature", title: "Worked explanations", body: "An Explanation button with step-by-step solutions, starting with 2,088 IB Maths questions and 1,875 IB Physics HL questions.", links: [ibBank("Maths AA", "ib"), bank("Physics HL", "ib-physics-hl")] },
  { date: "2026-10-12", tag: "Improvement", title: "Easier sign-in", body: "Continue with Google, or type the code from your email instead of clicking a link.", links: [{ label: "Log in", href: "/login" }] },
  { date: "2026-10-11", tag: "Improvement", title: "A new homepage", body: "A quick-start picker, pastel subject cards, smoother page changes and a simpler phone menu.", links: [{ label: "Home", href: "/" }] },
  { date: "2026-10-10", tag: "Improvement", title: "Refreshed bank pages", body: "Save PDF straight from a bank page, and find saved sets faster in My worksheets.", links: [{ label: "My worksheets", href: "/worksheets" }] },
  { date: "2026-10-10", tag: "Improvement", title: "Clearer pricing", body: "Plans explain themselves, and the free plan has its own card.", links: [{ label: "Pricing", href: "/pricing" }] },
  { date: "2026-10-09", tag: "Improvement", title: "Exam-size printing", body: "Multi-page questions now print at exam size on A4 without being cut off." },
  { date: "2026-10-08", tag: "Feature", tone: "math", title: "Exam-style worksheets by course", body: "Eleven exam-style worksheets for AA SL, Maths 0580 and Additional Maths 0606, ready to open and print.", links: [{ label: "Maths 0580", href: "/banks/igcse/exam-style" }, { label: "Additional Maths 0606", href: "/banks/igcse-additional/exam-style" }, { label: "AA SL", href: "/banks/ib-sl/exam-style" }] },
  { date: "2026-10-07", tag: "Feature", title: "Lifetime All Access", body: "Pay once for All Access with no renewals.", links: [{ label: "Pricing", href: "/pricing" }] },
  { date: "2026-10-05", tag: "Improvement", tone: "math", title: "Maths filters follow the syllabus", body: "Maths 0580 and Additional Maths 0606 filter by syllabus section, and missing questions such as surds are back.", links: [bank("Maths 0580", "igcse"), bank("Additional Maths 0606", "igcse-additional")] },
  { date: "2026-10-02", tag: "Improvement", title: "Missing mark schemes restored", body: "Brought back 2,007 Maths answers and 2,180 IGCSE science written answers." },
  { date: "2026-09-30", tag: "Improvement", title: "Syllabus filters for six banks", body: "Six IGCSE banks now filter by their syllabus topics.", links: [{ label: "IGCSE banks", href: "/cambridge-igcse" }] },
  { date: "2026-09-29", tag: "Feature", title: "Choose where answers go", body: "Put answers after each question or at the end of your PDF.", links: [{ label: "My worksheets", href: "/worksheets" }] },
  { date: "2026-09-28", tag: "Feature", title: "Generate a practice paper", body: "Pick topics and years, choose a question count or exact marks, and preview the paper before saving.", links: [{ label: "Build a paper", href: "/worksheets/build" }] },
  { date: "2026-09-28", tag: "Feature", title: "Referral rewards", body: "Share your link. Eligible referrals can earn bill credits after review." },
  { date: "2026-09-28", tag: "Improvement", title: "Focus view for exam-style PDFs", body: "Exam-style PDFs open in a distraction-free page view." },
  { date: "2026-09-27", tag: "Improvement", title: "Science filters restored", body: "Missing questions are back in the Biology, Physics, Chemistry and Co-ordinated Sciences filters, including 2026 Physics." },
  { date: "2026-09-26", tag: "Feature", title: "Dark mode", body: "Switch to a dark theme from the menu." },
  { date: "2026-09-26", tag: "Feature", title: "Manage your plan", body: "See what you own, switch plans and remove banks from your Account page.", links: [{ label: "My account", href: "/account" }] },
  { date: "2026-09-25", tag: "Feature", title: "Add a single bank", body: "Members can add one more bank later without changing their plan.", links: [{ label: "Pricing", href: "/pricing" }] },
  { date: "2026-09-25", tag: "Feature", title: "Share question sets", body: "Send a friend the exact set of questions you picked." },
  { date: "2026-09-25", tag: "New papers", tone: "math", title: "More AA HL practice", body: "Exam-style practice for AA HL on proof by induction, binomial and counting.", links: [{ label: "AA HL", href: "/banks/ib-hl/exam-style" }] },
  { date: "2026-09-24", tag: "Feature", title: "Save and edit worksheets", body: "Save worksheets to your library, reopen them and edit them later.", links: [{ label: "My worksheets", href: "/worksheets" }] },
  { date: "2026-09-24", tag: "New papers", tone: "math", title: "Maths 0580 Core papers", body: "Core papers from 2021 to 2025, with Core and Extended filters on the same page.", links: [bank("Maths 0580", "igcse")] },
  { date: "2026-09-23", tag: "Feature", tone: "math", title: "Exam-style practice (beta)", body: "AA SL Trigonometry with five practice sets and worked solutions.", links: [{ label: "AA SL", href: "/banks/ib-sl/exam-style" }] },
  { date: "2026-09-23", tag: "Improvement", tone: "chemistry", title: "Better Chemistry filters", body: "Chemistry 0620 topic filters corrected.", links: [bank("Chemistry 0620", "igcse-chemistry-0620")] },
  { date: "2026-09-22", tag: "Improvement", title: "Filters follow the syllabus", body: "IB Maths AA, IB Biology and IGCSE Biology filters rebuilt from their syllabuses with student-friendly names.", links: [bank("Biology 0610", "igcse-biology-0610"), ibBank("IB Biology", "ib-biology")] },
  { date: "2026-09-21", tag: "New papers", title: "IB sciences back to 2016", body: "IB Chemistry, Physics and Biology now cover papers from 2016.", links: [ibBank("Chemistry", "ib-chemistry"), ibBank("Physics", "ib-physics"), ibBank("Biology", "ib-biology")] },
  { date: "2026-09-20", tag: "New papers", title: "Biology and Economics expanded", body: "Biology 0610 now covers 2019–2026 and Economics 0455 covers 2019–2025.", links: [bank("Biology 0610", "igcse-biology-0610"), bank("Economics 0455", "igcse-economics-0455")] },
  { date: "2026-09-20", tag: "Improvement", title: "Sign-in links that work", body: "Email security scanners no longer use up your sign-in link before you click it.", links: [{ label: "Log in", href: "/login" }] },
  { date: "2026-09-15", tag: "New bank", tone: "coordinated", title: "Co-ordinated Sciences 0654", body: "A new IGCSE bank for Co-ordinated Sciences, sorted by topic.", links: [bank("Co-ordinated Sciences 0654", "igcse-coordinated-sciences-0654")] },
  { date: "2026-09-15", tag: "Improvement", title: "Redesigned site", body: "A new homepage, easier bank browsing and a more consistent look." },
  { date: "2026-09-14", tag: "New bank", title: "Chemistry 0620 and Physics 0625", body: "Two new IGCSE science banks, sorted by topic.", links: [bank("Chemistry 0620", "igcse-chemistry-0620"), bank("Physics 0625", "igcse-physics-0625")] },
  { date: "2026-09-13", tag: "New bank", title: "Biology 0610 and Economics 0455", body: "Two new IGCSE banks, sorted by topic.", links: [bank("Biology 0610", "igcse-biology-0610"), bank("Economics 0455", "igcse-economics-0455")] },
  { date: "2026-09-12", tag: "Feature", title: "Pick your banks", body: "Choose exactly which banks you want, with a bundle for two.", links: [{ label: "Pricing", href: "/pricing" }] },
  { date: "2026-09-11", tag: "New bank", tone: "economics", title: "IB Economics", body: "New IB Economics banks for HL and SL, from 2021 onwards.", links: [ibBank("Economics", "ib-economics")] },
  { date: "2026-09-08", tag: "New bank", title: "IB Chemistry, Physics and Biology", body: "Three new IB science banks at HL and SL.", links: [ibBank("Chemistry", "ib-chemistry"), ibBank("Physics", "ib-physics"), ibBank("Biology", "ib-biology")] },
  { date: "2026-08-31", tag: "Improvement", tone: "math", title: "Sharper Maths topics", body: "Maths 0580, Additional Maths 0606 and IB Maths AA and AI questions were re-checked and tagged to more accurate topics.", links: [bank("Maths 0580", "igcse"), bank("Additional Maths 0606", "igcse-additional")] },
];

type Href = { href: string };
/** Drops links to banks that aren't live and to the past-paper library while it's off. */
export function linkResolver({ pastPapers, liveBanks }: { pastPapers: boolean; liveBanks: ReadonlySet<string> }) {
  const live = ({ href }: Href) => href.startsWith("/past-papers") ? pastPapers : href.startsWith("/banks/") ? liveBanks.has(href.split("/")[2]) : true;
  return (links: readonly UpdateLink[] = []): UpdateLink[] => links.flatMap((link): UpdateLink[] => {
    if (!("options" in link)) return live(link) ? [link] : [];
    const options = link.options.filter(live);
    return options.length ? [{ ...link, options }] : [];
  });
}

/** Stable anchor for an entry, e.g. "2026-10-15-ib-may-2026-papers". */
export const updateId = ({ date, title }: Pick<Update, "date" | "title">) => `${date}-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;

export type UpdateNews = { date: string; tag: UpdateTag; title: string; body: string; href: string };
const NEWS_MAX_AGE_DAYS = 30;

/** The newest banks, papers and features (not fixes) from the last month, for the homepage and dashboard.
 *  Empty once everything is over a month old, so those places never advertise stale news. */
export function recentNews(count: number, now = new Date()): UpdateNews[] {
  const cutoff = now.getTime() - NEWS_MAX_AGE_DAYS * 86_400_000;
  const shipped = (update: Update) => { const at = new Date(`${update.date}T00:00:00Z`).getTime(); return at >= cutoff && at <= now.getTime(); };
  return UPDATES
    .filter((update) => update.tag !== "Improvement" && shipped(update))
    .slice(0, count)
    .map((update) => ({ date: update.date, tag: update.tag, title: update.title, body: update.body, href: `/updates#${updateId(update)}` }));
}

const linkHrefs = (update: Update) => (update.links ?? []).flatMap((link) => "href" in link ? [link.href] : link.options.map((option) => option.href));

/**
 * The date content last changed, read from the public changelog so "Updated" lines are never a build stamp.
 * With paths, only updates linking to one of them (or a page beneath it) count.
 */
export function lastUpdated(paths?: readonly string[]): string | undefined {
  const matches = (href: string) => paths!.some((path) => href === path || href.startsWith(`${path}/`) || href.startsWith(`${path}?`));
  return UPDATES.filter((update) => !paths || linkHrefs(update).some(matches)).map(({ date }) => date).sort().at(-1);
}

/** "20 Oct 2026": unambiguous for readers in every country. */
export const formatUpdateDate = (date: string) => new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** Last change to a bank's topic questions or its full-paper library. */
export const bankLastUpdated = (bankSlug: BankSlug) => lastUpdated([`/banks/${bankSlug}`, `/past-papers/${subjectSlugForBank(bankSlug)}`]);
