import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ANALYTICS_CONSENT_COOKIE, ANALYTICS_CONSENT_VERSION, analyticsConsentCookieValue } from "@/lib/analytics-consent";

const MAX_AGE = 180 * 24 * 60 * 60;

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return json({ error: "Invalid origin" }, 403);
  const length = Number(request.headers.get("content-length") ?? "0");
  if (length > 1024) return json({ error: "Invalid request" }, 400);
  let body: unknown;
  try {
    const text = await request.text();
    if (text.length > 1024) return json({ error: "Invalid request" }, 400);
    body = JSON.parse(text);
  } catch { return json({ error: "Invalid request" }, 400); }
  if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).length !== 1 || typeof (body as { accepted?: unknown }).accepted !== "boolean") return json({ error: "Invalid request" }, 400);
  const accepted = (body as { accepted: boolean }).accepted;
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    const anonymous = authError?.name === "AuthSessionMissingError";
    if (authError && !anonymous) return json({ error: "Could not save preference" }, 500);
    if (user) {
      const prior = user.user_metadata?.analytics_consent;
      const priorValid = prior && prior.version === ANALYTICS_CONSENT_VERSION && typeof prior.accepted === "boolean" && typeof prior.updated_at === "string";
      const updatedAt = priorValid && prior.accepted === accepted && Date.now() - Date.parse(prior.updated_at) <= MAX_AGE * 1000 && Date.now() - Date.parse(prior.updated_at) >= -120_000
        ? prior.updated_at : new Date().toISOString();
      const { error } = await supabase.auth.updateUser({ data: { ...user.user_metadata, analytics_consent: { accepted, version: ANALYTICS_CONSENT_VERSION, updated_at: updatedAt } } });
      if (error) return json({ error: "Could not save preference" }, 500);
    }
    const response = json({ accepted, version: ANALYTICS_CONSENT_VERSION });
    response.cookies.set(ANALYTICS_CONSENT_COOKIE, analyticsConsentCookieValue(accepted), { httpOnly: false, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: MAX_AGE });
    return response;
  } catch { return json({ error: "Could not save preference" }, 500); }
}
