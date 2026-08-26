import { NextResponse } from "next/server";
import { getBank, type BankSlug } from "@/lib/banks";
import { loadBankQuestions } from "@/lib/questions";
import { createClient } from "@/lib/supabase/server";

type StudyAction = "save" | "unsave" | "attempt";
type StudyRequest = { bank?: unknown; questionId?: unknown; action?: unknown };
const ACTIONS = new Set<StudyAction>(["save", "unsave", "attempt"]);

export async function POST(request: Request) {
  let body: StudyRequest;
  try {
    body = await request.json() as StudyRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body) ||
    typeof body.bank !== "string" ||
    !getBank(body.bank) ||
    typeof body.questionId !== "string" ||
    typeof body.action !== "string" ||
    !ACTIONS.has(body.action as StudyAction)
  ) {
    return NextResponse.json({ error: "Invalid study update" }, { status: 400 });
  }

  const bank = body.bank as BankSlug;
  const questionId = body.questionId;
  if (!loadBankQuestions(bank).some((question) => question.id === questionId)) {
    return NextResponse.json({ error: "Unknown question" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = typeof claimsData?.claims?.sub === "string" ? claimsData.claims.sub : null;
  if (!userId) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  const record = { user_id: userId, bank_slug: bank, question_id: questionId };
  let error: { message?: string } | null = null;

  if (body.action === "save") {
    ({ error } = await supabase.from("saved_questions").upsert(record, {
      onConflict: "user_id,bank_slug,question_id",
      ignoreDuplicates: true,
    }));
  } else if (body.action === "unsave") {
    ({ error } = await supabase
      .from("saved_questions")
      .delete()
      .eq("user_id", userId)
      .eq("bank_slug", bank)
      .eq("question_id", questionId));
  } else {
    ({ error } = await supabase.from("attempts").upsert(record, {
      onConflict: "user_id,bank_slug,question_id",
      ignoreDuplicates: true,
    }));
  }

  if (error) return NextResponse.json({ error: "Study progress could not be updated" }, { status: 503 });
  return NextResponse.json({ saved: body.action === "save", attempted: body.action === "attempt" });
}
