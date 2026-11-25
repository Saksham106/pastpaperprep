import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HelperPhonePanel } from "@/components/helper/HelperPhonePanel";
import { isPreviewQuestion } from "@/lib/access";
import { getBank, type BankSlug } from "@/lib/banks";
import { HELPER_NAME, helperEnabledForBank } from "@/lib/helper/config";
import { currentQuestionId } from "@/lib/question-id-aliases";
import { loadBankQuestionMap } from "@/lib/question-loader";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: `${HELPER_NAME} · Mark my working`, robots: { index: false, follow: false } };

/** The phone page opened from a question's QR code: the helper full screen, camera first. */
export default async function HelperPhonePage({ params }: { params: Promise<{ bank: string; question: string }> }) {
  const { bank: bankParam, question } = await params;
  const bank = getBank(bankParam);
  if (!bank || !helperEnabledForBank(bank.slug)) notFound();
  const slug = bank.slug as BankSlug;
  const questionId = currentQuestionId(slug, decodeURIComponent(question));
  const record = (await loadBankQuestionMap(slug)).get(questionId);
  if (!record) notFound();

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const authenticated = typeof data?.claims?.sub === "string";

  return (
    <main>
      <HelperPhonePanel
        bank={slug}
        questionId={questionId}
        questionLabel={`${bank.shortName} · ${record.year} ${record.session} · Paper ${record.paper} · Question ${record.number}`}
        authenticated={authenticated}
        freePreview={isPreviewQuestion(slug, questionId)}
      />
    </main>
  );
}
