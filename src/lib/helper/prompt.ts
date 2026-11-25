import type Anthropic from "@anthropic-ai/sdk";
import type { Explanation } from "@/lib/explanation-format";
import type { HelperMode } from "@/lib/helper/config";
import type { HelperContext } from "@/lib/helper/context";

type ContentBlock = Anthropic.Beta.BetaContentBlockParam;

export const HELPER_MODE_INSTRUCTIONS: Readonly<Record<HelperMode, string>> = {
  hint: "The student wants a hint. Give one short nudge towards the next step: the idea or method to try, not the working. Do not give the answer, final values, or the mark scheme's wording. End by inviting them to try it.",
  explain: "The student wants the whole answer explained. Walk through it part by part in the order of the mark scheme, showing where each mark is earned, then give the final answer. Point out the most common mistake if there is one. Keep it as short as a clear explanation allows.",
  mark: `The student wants their answer marked. Their working is in the attached photo or their message.
1. If the photo is unreadable, blank, or clearly a different question, say so in one or two sentences, give no marks, and ask for a clearer photo. Stop there.
2. Otherwise mark it strictly against the official mark scheme. Credit correct alternative methods the mark scheme allows; apply follow-through marks only where the mark scheme allows them.
3. Your reply must start with exactly one line in this form: Mark: X / Y (Y is the question's total marks; if they only attempted some parts, still mark out of the full total).
4. Then list every mark point, one per line, starting with ✓ (earned) or ✗ (lost), then the mark code, then a short reason, e.g. "✗ A1 (b) the bracket was expanded with the wrong sign". Label parts like (a), (b) when the question has them.
5. Finish with one line starting "Fix:" giving the single most useful thing to change. Do not rewrite their whole answer unless they ask.`,
  chat: "Answer the student's message about this question. If they share working, respond to it. If they ask for the answer outright, you may give it, with the reasoning.",
};

/** Used instead of the marking rules when the official mark scheme couldn't be sent in full. */
export const HELPER_INCOMPLETE_MARKING = `The student wants their answer marked, but you do not have the complete official mark scheme for this question, so you must not give a score.
Do not write a "Mark:" line or any total. Start by saying in one sentence that you can't give an official mark for this question here. Then give feedback on their working against what you can see: what looks right, what looks wrong and why, using ✓ and ✗ lines without mark codes. Finish with one line starting "Fix:".`;

/** True when the full official mark scheme (or MCQ key) reached the model, so it may give a score. */
export function canScore(context: HelperContext): boolean {
  return context.omitted.question === 0 && context.omitted.markscheme === 0 && Boolean(context.mcqAnswer || context.markschemeImages.length);
}

function explanationText(explanation: Explanation): string {
  const lines = [`Worked solution (PastPaperPrep, checked against the mark scheme; total ${explanation.totalMarks} marks):`];
  for (const part of explanation.parts) {
    if (part.withdrawn) continue;
    lines.push(`\nPart ${part.label || "(whole question)"} [${part.marks} marks]`, `Approach: ${part.approach}`);
    part.steps.forEach((step, index) => {
      const extras = [step.math ? `$$${step.math}$$` : "", step.code ? `Code:\n${step.code}` : ""].filter(Boolean).join("\n");
      lines.push(`${index + 1}. ${step.text}${extras ? `\n${extras}` : ""}${step.marks.length ? ` [${step.marks.join(", ")}]` : ""}`);
    });
    lines.push(`Answer: ${part.answer}`);
    if (part.mistake) lines.push(`Common mistake: ${part.mistake}`);
  }
  return lines.join("\n");
}

function image(data: string, mediaType: "image/webp" | "image/jpeg" | "image/png" = "image/webp"): ContentBlock {
  return { type: "image", source: { type: "base64", media_type: mediaType, data } };
}

/** The question's materials as one user turn, cached so follow-ups about the same question are cheap. */
export function contextBlocks(context: HelperContext): ContentBlock[] {
  const blocks: ContentBlock[] = [{
    type: "text",
    text: `Question: ${context.qualification} ${context.subject}, ${context.label}${context.marks !== null ? ` (${context.marks} marks)` : ""}.\nOfficial question paper crop(s):`,
  }];
  for (const data of context.questionImages) blocks.push(image(data));
  if (context.omitted.question) blocks.push({ type: "text", text: `(${context.omitted.question} further question crop(s) could not be included.)` });
  if (context.mcqAnswer) {
    blocks.push({ type: "text", text: `Official multiple-choice key: ${context.mcqAnswer}` });
  } else if (context.markschemeImages.length) {
    blocks.push({ type: "text", text: "Official mark scheme crop(s):" });
    for (const data of context.markschemeImages) blocks.push(image(data));
    if (context.omitted.markscheme) blocks.push({ type: "text", text: `(${context.omitted.markscheme} further mark scheme crop(s) could not be included, so this mark scheme is incomplete.)` });
  } else {
    blocks.push({ type: "text", text: "No official mark scheme crop is available for this question." });
  }
  blocks.push({
    type: "text",
    text: context.explanation ? explanationText(context.explanation) : "No worked solution is available; work from the question and the official mark scheme.",
    cache_control: { type: "ephemeral" },
  });
  return blocks;
}
