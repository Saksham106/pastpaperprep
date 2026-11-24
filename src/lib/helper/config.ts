// Browser-safe settings for the AI study helper. Code, routes and analytics say "helper"; the character's name is only
// HELPER_NAME, so renaming it is a one-line change.

/** Stand-in name, not final. */
export const HELPER_NAME = "Pepper";

/** Helper messages per user per day (one message, photo or not, is one use). */
export const HELPER_DAILY_LIMITS = { free: 5, paid: 30 } as const;

export type HelperBoard = "igcse" | "a-level" | "ib";
/**
 * Boards the helper runs on. IB stays off until the owner has checked the IB's terms on its content being sent to AI
 * tools; switching it on is this one line.
 */
export const HELPER_BOARDS: Readonly<Record<HelperBoard, boolean>> = { igcse: true, "a-level": true, ib: false };

export function helperBoard(bank: string): HelperBoard {
  if (bank.startsWith("ib-")) return "ib";
  if (bank.startsWith("a-level-")) return "a-level";
  return "igcse";
}

export const HELPER_MODES = ["hint", "explain", "mark", "chat"] as const;
export type HelperMode = (typeof HELPER_MODES)[number];

/** The chips under the panel's greeting: each sends a ready-made request. */
export const HELPER_CHIPS = [
  { mode: "mark", label: "Mark my photo" },
  { mode: "hint", label: "Give me a hint" },
  { mode: "explain", label: "Explain the whole answer" },
] as const satisfies ReadonlyArray<{ mode: HelperMode; label: string }>;

/** The text shown as the student's own message when a chip is used. */
export const HELPER_CHIP_PROMPTS: Readonly<Record<Exclude<HelperMode, "chat">, string>> = {
  mark: "Mark my working.",
  hint: "Give me a hint.",
  explain: "Explain the whole answer.",
};

/** Added to earlier student turns that carried a photo: photos are sent only with their own message. */
export const HELPER_PHOTO_NOTE = "[I attached a photo of my working with this message.]";

export const HELPER_MAX_TURNS = 12;
export const HELPER_MAX_TEXT = 2000;
/** Data-URL length cap for one photo (about 1.5 MB of JPEG); the browser resizes to fit well under it. */
export const HELPER_MAX_IMAGE_CHARS = 2_100_000;
export const HELPER_IMAGE_MAX_EDGE = 1600;

/** Inlined at build time: true when the deployment has an Anthropic API key. The key itself never reaches the browser. */
export function helperConfigured(): boolean {
  return process.env.NEXT_PUBLIC_HELPER_ENABLED === "1";
}

export function helperEnabledForBank(bank: string): boolean {
  return helperConfigured() && HELPER_BOARDS[helperBoard(bank)];
}

/** The phone page for a question, opened from the QR code. */
export function helperPhonePath(bank: string, questionId: string): string {
  return `/helper/${encodeURIComponent(bank)}/${encodeURIComponent(questionId)}`;
}
