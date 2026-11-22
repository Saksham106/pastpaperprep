/**
 * Cambridge International AS & A Level Computer Science 9618, 2021 series onward: Papers 1-3. Paper 1 (Theory
 * Fundamentals) and Paper 2 (Fundamental Problem-solving and Programming Skills) are AS; Paper 3 (Advanced Theory) is
 * A Level. Paper 4 (practical, on a computer) is not in the bank. Each paper is its own tab, ordered as students sit them.
 * Pure and client-safe.
 */
export const A_LEVEL_COMPUTER_SCIENCE_9618 = "a-level-computer-science-9618" as const;

export type ComputerScience9618Paper = { paper: 1 | 2 | 3; route: string; label: string; name: string; marks: 75 };

/** Names and totals: the 2026 syllabus assessment overview, p. 11 (same in 2021-2023 and 2024-2025). */
export const COMPUTER_SCIENCE_9618_PAPERS: readonly ComputerScience9618Paper[] = [
  { paper: 1, route: "as-theory", label: "AS theory", name: "Theory Fundamentals", marks: 75 },
  { paper: 2, route: "as-problem-solving", label: "AS problem-solving", name: "Fundamental Problem-solving and Programming Skills", marks: 75 },
  { paper: 3, route: "a-level-theory", label: "A Level theory", name: "Advanced Theory", marks: 75 },
];

/**
 * Syllabus sections 1-20 in order: AS 1-12 (Paper 1 assesses 1-8, Paper 2 9-12), A Level 13-20 (Paper 3). Section 16
 * reuses section 5's title, so it says "(A Level)" and every label is unique.
 */
export const COMPUTER_SCIENCE_9618_TOPICS: readonly string[] = [
  "Information representation",
  "Communication",
  "Hardware",
  "Processor Fundamentals",
  "System Software",
  "Security, privacy and data integrity",
  "Ethics and Ownership",
  "Databases",
  "Algorithm Design and Problem-solving",
  "Data Types and Structures",
  "Programming",
  "Software Development",
  "Data Representation",
  "Communication and internet technologies",
  "Hardware and Virtual Machines",
  "System Software (A Level)",
  "Security",
  "Artificial Intelligence (AI)",
  "Computational thinking and Problem-solving",
  "Further Programming",
];

/**
 * Each section's subsections, in syllabus order (source taxonomy.json). The subtopic picker shows these under the
 * selected topic. Subsection 19.1 reuses 9.2's title and says "(A Level)". The test keeps this equal to
 * src/data/a-level-computer-science-9618-taxonomy.json.
 */
export const COMPUTER_SCIENCE_9618_SUBTOPICS: Readonly<Record<string, readonly string[]>> = {
  "Information representation": ["Data Representation", "Multimedia", "Compression"],
  "Communication": ["Networks including the internet"],
  "Hardware": ["Computers and their components", "Logic Gates and Logic Circuits"],
  "Processor Fundamentals": ["Central Processing Unit (CPU) Architecture", "Assembly Language", "Bit manipulation"],
  "System Software": ["Operating Systems", "Language Translators"],
  "Security, privacy and data integrity": ["Data Security", "Data Integrity"],
  "Ethics and Ownership": ["Ethics and Ownership"],
  "Databases": ["Database Concepts", "Database Management Systems (DBMS)", "Data Definition Language (DDL) and Data Manipulation Language (DML)"],
  "Algorithm Design and Problem-solving": ["Computational Thinking Skills", "Algorithms"],
  "Data Types and Structures": ["Data Types and Records", "Arrays", "Files", "Introduction to Abstract Data Types (ADT)"],
  "Programming": ["Programming Basics", "Constructs", "Structured Programming"],
  "Software Development": ["Program Development Life cycle", "Program Design", "Program Testing and Maintenance"],
  "Data Representation": ["User-defined data types", "File organisation and access", "Floating-point numbers, representation and manipulation"],
  "Communication and internet technologies": ["Protocols", "Circuit switching, packet switching"],
  "Hardware and Virtual Machines": ["Processors, Parallel Processing and Virtual Machines", "Boolean Algebra and Logic Circuits"],
  "System Software (A Level)": ["Purposes of an Operating System (OS)", "Translation Software"],
  "Security": ["Encryption, Encryption Protocols and Digital Certificates"],
  "Artificial Intelligence (AI)": ["Artificial Intelligence (AI)"],
  "Computational thinking and Problem-solving": ["Algorithms (A Level)", "Recursion"],
  "Further Programming": ["Programming Paradigms", "File Processing and Exception Handling"],
};

export const COMPUTER_SCIENCE_9618_TOPIC_ORDER: readonly string[] = COMPUTER_SCIENCE_9618_TOPICS;
