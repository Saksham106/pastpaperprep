"use client";

import { useEffect } from "react";
import { PepperPanel } from "@/components/helper/PepperPanel";
import { trackProductEvent } from "@/lib/product-analytics";

/** The phone page opened from a question's QR code: the same Pepper, full screen, with that question attached. */
export function HelperPhonePanel({ bank, questionId, questionLabel, freePreview }: { bank: string; questionId: string; questionLabel: string; freePreview: boolean; authenticated?: boolean }) {
  useEffect(() => {
    trackProductEvent("helper_open", { bank, freePreview, surface: "phone" });
  }, [bank, freePreview]);
  return <PepperPanel question={{ bank, questionId, label: questionLabel, freePreview }} variant="page" />;
}
