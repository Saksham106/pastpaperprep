import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getBank } from "@/lib/banks";
import { loadBankQuestions } from "@/lib/question-loader";
import { hasBankAccess } from "@/lib/access";
import { normalizeEntitlements } from "@/lib/entitlements";
import { validateWorksheet } from "@/lib/worksheets";

async function identity() {
  const client = await createClient();
  const { data } = await client.auth.getClaims();
  return { client, userId: typeof data?.claims?.sub === "string" ? data.claims.sub : null };
}

export async function GET() {
  const { client, userId } = await identity();
  if (!userId) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { data, error } = await client.from("saved_worksheets").select("id,bank_slug,title,question_ids,content_mode,revision,created_at,updated_at").eq("user_id", userId).order("updated_at", { ascending: false });
  if (error) return NextResponse.json({ error: "Worksheets unavailable" }, { status: 503 });
  return NextResponse.json({ worksheets: data ?? [] });
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  let definition;
  try { definition = validateWorksheet({ bank: body.bank, name: body.name ?? body.title, questionIds: body.questionIds, contentMode: body.contentMode }); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid worksheet" }, { status: 400 }); }
  const { client, userId } = await identity();
  if (!userId) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const bank = getBank(definition.bank);
  if (!bank) return NextResponse.json({ error: "Invalid bank" }, { status: 400 });
  const [entitlementsResult, questions] = await Promise.all([
    client.from("entitlements").select("product_id, selected_bank_ids, status, starts_at, expires_at").eq("user_id", userId),
    loadBankQuestions(definition.bank),
  ]);
  if (entitlementsResult.error) return NextResponse.json({ error: "Access could not be verified" }, { status: 503 });
  if (!hasBankAccess(definition.bank, normalizeEntitlements(entitlementsResult.data ?? []))) return NextResponse.json({ error: "A current bank subscription is required" }, { status: 403 });
  const canonical = new Set(questions.map((question) => question.id));
  if (definition.questionIds.some((id) => !canonical.has(id))) return NextResponse.json({ error: "One or more questions are no longer available" }, { status: 400 });
  const { data, error } = await client.from("saved_worksheets").insert({ user_id: userId, bank_slug: definition.bank, title: definition.name, question_ids: definition.questionIds, content_mode: definition.contentMode }).select("id,bank_slug,title,question_ids,content_mode,revision,created_at,updated_at").single();
  if (error) return NextResponse.json({ error: "Worksheet could not be saved" }, { status: 503 });
  return NextResponse.json({ worksheet: data }, { status: 201 });
}
