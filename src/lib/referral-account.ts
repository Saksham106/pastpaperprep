import "server-only";
import { decodeReferral, REFERRAL_WINDOW_SECONDS } from "@/lib/referral";
import { createAdminClient } from "@/lib/supabase/admin";

export async function getCheckoutReferral(userId: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data: attribution, error } = await admin.from("referral_attributions")
    .select("partner_code, attributed_at").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  if (!attribution) return null;
  const attributedAt = Date.parse(attribution.attributed_at);
  if (!Number.isFinite(attributedAt) || attributedAt > Date.now() || Date.now() - attributedAt > REFERRAL_WINDOW_SECONDS * 1000) return null;
  const { data: partner, error: partnerError } = await admin.from("referral_partners")
    .select("code").eq("code", attribution.partner_code).eq("active", true).maybeSingle();
  if (partnerError) throw partnerError;
  return partner?.code ?? null;
}

export async function bindReferralToAuthenticatedUser(userId: string, userCreatedAt: string, cookieValue?: string): Promise<boolean> {
  const referral = decodeReferral(cookieValue);
  if (!referral) return false;
  const createdAt = Date.parse(userCreatedAt);
  if (!Number.isFinite(createdAt) || createdAt < referral.attributedAt) return false;

  const admin = createAdminClient();
  if (/^c_[a-f0-9]{24}$/.test(referral.code)) {
    const { data, error } = await admin.rpc("bind_new_customer_referral", {
      p_user_id: userId,
      p_code: referral.code,
      p_attributed_at: new Date(referral.attributedAt).toISOString(),
    });
    return !error && data === true;
  }
  const { data, error } = await admin.rpc("bind_new_referral_attribution", {
    p_user_id: userId,
    p_partner_code: referral.code,
    p_attributed_at: new Date(referral.attributedAt).toISOString(),
  });
  return !error && data === true;
}
