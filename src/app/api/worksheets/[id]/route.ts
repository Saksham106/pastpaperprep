import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadBankQuestions } from "@/lib/question-loader";
import { hasBankAccess } from "@/lib/access";
import { normalizeEntitlements } from "@/lib/entitlements";
import { validateWorksheet } from "@/lib/worksheets";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const client = await createClient();
  const { data: claims } = await client.auth.getClaims();
  const userId = typeof claims?.claims?.sub === "string" ? claims.claims.sub : null;
  if (!userId) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { data, error } = await client.from("saved_worksheets").select("id,bank_slug,title,question_ids,content_mode,revision,created_at,updated_at").eq("id", id).eq("user_id", userId).maybeSingle();
  if (error) return NextResponse.json({ error: "Worksheet unavailable" }, { status: 503 });
  if (!data) return NextResponse.json({ error: "Worksheet not found" }, { status: 404 });
  const entitlementResult = await client.from("entitlements").select("product_id, selected_bank_ids, status, starts_at, expires_at").eq("user_id", userId);
  if (entitlementResult.error) return NextResponse.json({ error: "Access could not be verified" }, { status: 503 });
  if (!hasBankAccess(data.bank_slug, normalizeEntitlements(entitlementResult.data ?? []))) return NextResponse.json({ error: "A current bank subscription is required" }, { status: 403 });
  return NextResponse.json({ worksheet: data });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  if (!Number.isInteger(body.revision) || Number(body.revision) < 1) return NextResponse.json({ error: "Invalid revision" }, { status: 400 });
  let definition;
  try { definition = validateWorksheet({ bank: body.bank, name: body.name, questionIds: body.questionIds, contentMode: body.contentMode }); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid worksheet" }, { status: 400 }); }
  const client = await createClient();
  const { data: claims } = await client.auth.getClaims();
  const userId = typeof claims?.claims?.sub === "string" ? claims.claims.sub : null;
  if (!userId) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const current = await client.from("saved_worksheets").select("id,bank_slug").eq("id", id).eq("user_id", userId).maybeSingle();
  if (current.error) return NextResponse.json({ error: "Worksheet unavailable" }, { status: 503 });
  if (!current.data) return NextResponse.json({ error: "Worksheet not found" }, { status: 404 });
  if (current.data.bank_slug !== definition.bank) return NextResponse.json({ error: "A worksheet cannot change banks" }, { status: 400 });
  const access = await client.from("entitlements").select("product_id, selected_bank_ids, status, starts_at, expires_at").eq("user_id", userId);
  if (access.error) return NextResponse.json({ error: "Access could not be verified" }, { status: 503 });
  if (!hasBankAccess(definition.bank, normalizeEntitlements(access.data ?? []))) return NextResponse.json({ error: "A current bank subscription is required" }, { status: 403 });
  const canonical = new Set((await loadBankQuestions(definition.bank)).map((question) => question.id));
  if (definition.questionIds.some((questionId) => !canonical.has(questionId))) return NextResponse.json({ error: "One or more questions are no longer available" }, { status: 400 });
  const { data, error } = await client.from("saved_worksheets").update({ title: definition.name, question_ids: definition.questionIds, content_mode: definition.contentMode, revision: Number(body.revision) + 1, updated_at: new Date().toISOString() }).eq("id", id).eq("user_id", userId).eq("revision", Number(body.revision)).select("id,bank_slug,title,question_ids,content_mode,revision,created_at,updated_at").maybeSingle();
  if (error) return NextResponse.json({ error: "Worksheet could not be updated" }, { status: 503 });
  if (!data) return NextResponse.json({ error: "Worksheet changed elsewhere; reload before saving" }, { status: 409 });
  return NextResponse.json({ worksheet: data });
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const client = await createClient();
  const { data: claims } = await client.auth.getClaims();
  const userId = typeof claims?.claims?.sub === "string" ? claims.claims.sub : null;
  if (!userId) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { error } = await client.from("saved_worksheets").delete().eq("id", id).eq("user_id", userId);
  if (error) return NextResponse.json({ error: "Worksheet could not be deleted" }, { status: 503 });
  return new NextResponse(null, { status: 204 });
}
