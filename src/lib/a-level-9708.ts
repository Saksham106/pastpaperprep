/**
 * Cambridge International AS & A Level Economics 9708, 2020 series onward: all four papers. Papers 1 and 3 are
 * multiple choice (AS and A Level), Papers 2 and 4 are data response and essays (AS and A Level). There is no
 * practical or coursework component. Each paper is its own tab, ordered as students sit them: AS first, then A Level,
 * multiple choice before written. Pure and client-safe.
 */
export const A_LEVEL_ECONOMICS_9708 = "a-level-economics-9708" as const;

export type Economics9708Paper = { paper: 1 | 2 | 3 | 4; route: string; label: string; name: string; marks: 30 | 60 };

/** Names and totals: the 2026-2028 syllabus assessment overview, p. 11 (source workspace data/paper-facts.json). */
export const ECONOMICS_9708_PAPERS: readonly Economics9708Paper[] = [
  { paper: 1, route: "as-multiple-choice", label: "AS multiple choice", name: "AS Level Multiple Choice", marks: 30 },
  { paper: 2, route: "as-written", label: "AS written", name: "AS Level Data Response and Essays", marks: 60 },
  { paper: 3, route: "a-level-multiple-choice", label: "A Level multiple choice", name: "A Level Multiple Choice", marks: 30 },
  { paper: 4, route: "a-level-written", label: "A Level written", name: "A Level Data Response and Essays", marks: 60 },
];

/**
 * Topics 1-11 of the 2023 revision (unchanged in the 2026-2028 syllabus): AS 1-6, A Level 7-11. A Level topics 7-11
 * reuse the titles of AS topics 2-6; those say "(A Level)" so every label is unique.
 */
export const ECONOMICS_9708_TOPICS: readonly string[] = [
  "Basic economic ideas and resource allocation",
  "The price system and the microeconomy",
  "Government microeconomic intervention",
  "The macroeconomy",
  "Government macroeconomic intervention",
  "International economic issues",
  "The price system and the microeconomy (A Level)",
  "Government microeconomic intervention (A Level)",
  "The macroeconomy (A Level)",
  "Government macroeconomic intervention (A Level)",
  "International economic issues (A Level)",
];

/**
 * Content the 2023 revision removed, used only on 2020-2022 papers: one named topic each, never a generic bucket,
 * after topics 1-11.
 */
export const ECONOMICS_9708_EARLIER_TOPICS: readonly string[] = [
  "Canons of taxation (earlier syllabus)",
  "Labour force size and components (earlier syllabus)",
  "Keynesian and Monetarist schools (earlier syllabus)",
  "Corruption and the legal framework (earlier syllabus)",
];

export const ECONOMICS_9708_TOPIC_ORDER: readonly string[] = [...ECONOMICS_9708_TOPICS, ...ECONOMICS_9708_EARLIER_TOPICS];

/**
 * Each current topic's subtopic sections, in syllabus order (2026-2028 syllabus; source taxonomy.json). The subtopic
 * picker shows these under the selected topic. Two A Level sections that reuse an AS section's title say "(A Level)".
 * Earlier-syllabus topics have no sections. The test keeps this equal to src/data/a-level-economics-9708-taxonomy.json.
 */
export const ECONOMICS_9708_SUBTOPICS: Readonly<Record<string, readonly string[]>> = {
  "Basic economic ideas and resource allocation": ["Scarcity, choice and opportunity cost", "Economic methodology", "Factors of production", "Resource allocation in different economic systems", "Production possibility curves", "Classification of goods and services"],
  "The price system and the microeconomy": ["Demand and supply curves", "Price elasticity, income elasticity and cross elasticity of demand", "Price elasticity of supply", "The interaction of demand and supply", "Consumer and producer surplus"],
  "Government microeconomic intervention": ["Reasons for government intervention in markets", "Methods and effects of government intervention in markets", "Addressing income and wealth inequality"],
  "The macroeconomy": ["National income statistics", "Introduction to the circular flow of income", "Aggregate Demand and Aggregate Supply analysis", "Economic growth", "Unemployment", "Price stability"],
  "Government macroeconomic intervention": ["Government macroeconomic policy objectives", "Fiscal policy", "Monetary policy", "Supply-side policy"],
  "International economic issues": ["The reasons for international trade", "Protectionism", "Current account of the balance of payments", "Exchange rates", "Policies to correct imbalances in the current account of the balance of payments"],
  "The price system and the microeconomy (A Level)": ["Utility", "Indifference curves and budget lines", "Efficiency and market failure", "Private costs and benefits, externalities and social costs and benefits", "Types of cost, revenue and profit, short-run and long-run production", "Different market structures", "Growth and survival of firms", "Differing objectives and policies of firms"],
  "Government microeconomic intervention (A Level)": ["Government policies to achieve efficient resource allocation and correct market failure", "Equity and redistribution of income and wealth", "Labour market forces and government intervention"],
  "The macroeconomy (A Level)": ["The circular flow of income", "Economic growth and sustainability", "Employment/unemployment", "Money and banking"],
  "Government macroeconomic intervention (A Level)": ["Government macroeconomic policy objectives (A Level)", "Links between macroeconomic problems and their interrelatedness", "Effectiveness of policy options to meet all macroeconomic objectives"],
  "International economic issues (A Level)": ["Policies to correct disequilibrium in the balance of payments", "Exchange rates (A Level)", "Economic development", "Characteristics of countries at different levels of development", "Relationship between countries at different levels of development", "Globalisation"],
};
