// Compact metadata only. Real local sample; no answer text or protected asset paths.
// Topics are the current 0620 runtime projector's distinct official topic labels.
export const PAPER_MARKING_PREVIEW = {
  id: "0620-2023-w-42",
  version: "question-topic-review-v1",
  bankSlug: "igcse-chemistry-0620",
  title: "Chemistry 0620 · October/November 2023 · Paper 42",
  maxMarks: 80,
  durationMinutes: 75,
  provenance: {
    questionPdfSha256: "338254d776580e6fd37e62b2bb5611850d0162387e70e3c51a74e6b36a9c9477",
    markschemePdfSha256: "ae5cea821014c2eb91ad2a81f390d75126d6bfdd8d0438cf912c54814f0d58c7",
    runtimeSha256: "403a872b48552446edb4614536b6ac0ae6845e863f22b876ac5e15ae995c55db",
    projectorSha256: "37842bb74a513163d2158791ae697ca388b93a98e4deb4ca6927107a8436def1",
    scoringGrain: "whole-question",
    classificationSource: "Existing runtime topic classifications; recommendations, not exact topic scoring",
  },
  questions: [
    { id: "0620-2023-w-42-q1", number: 1, maxMarks: 8, questionPage: 2, topics: ["Atoms, elements and compounds", "The Periodic Table"] },
    { id: "0620-2023-w-42-q2", number: 2, maxMarks: 14, questionPage: 3, topics: ["Atoms, elements and compounds", "The Periodic Table", "Acids, bases and salts", "Chemistry of the environment", "Chemical reactions"] },
    { id: "0620-2023-w-42-q3", number: 3, maxMarks: 17, questionPage: 5, topics: ["Metals", "Chemical reactions"] },
    { id: "0620-2023-w-42-q4", number: 4, maxMarks: 14, questionPage: 7, topics: ["Stoichiometry", "Acids, bases and salts", "Experimental techniques and chemical analysis", "Electrochemistry"] },
    { id: "0620-2023-w-42-q5", number: 5, maxMarks: 16, questionPage: 9, topics: ["Chemical energetics", "Chemical reactions"] },
    { id: "0620-2023-w-42-q6", number: 6, maxMarks: 11, questionPage: 12, topics: ["Organic chemistry", "Stoichiometry"] },
  ],
} as const;
