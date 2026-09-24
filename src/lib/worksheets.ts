import { getBank, type BankSlug } from "@/lib/banks";

export type WorksheetContentMode = "questions" | "answers" | "both";
export type WorksheetDefinition = { bank: BankSlug; name: string; questionIds: string[]; contentMode: WorksheetContentMode };

export function validateWorksheet(input: { bank: unknown; name: unknown; questionIds: unknown; contentMode: unknown }): WorksheetDefinition {
  if (typeof input.bank !== "string" || !getBank(input.bank)) throw new Error("Invalid bank");
  if (typeof input.name !== "string") throw new Error("Invalid name");
  const name = input.name.trim();
  if (!name || name.length > 80) throw new Error("Name must be 1–80 characters");
  if (!Array.isArray(input.questionIds) || input.questionIds.length < 1 || input.questionIds.length > 50 || input.questionIds.some((id) => typeof id !== "string" || !id.trim()) || new Set(input.questionIds).size !== input.questionIds.length) throw new Error("Select 1–50 unique questions");
  if (input.contentMode !== "questions" && input.contentMode !== "answers" && input.contentMode !== "both") throw new Error("Invalid content mode");
  return { bank: input.bank as BankSlug, name, questionIds: [...input.questionIds] as string[], contentMode: input.contentMode };
}
