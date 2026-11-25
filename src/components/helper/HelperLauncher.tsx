"use client";

import { HelperFace } from "@/components/helper/HelperFace";
import { HELPER_NAME } from "@/lib/helper/config";
import { PEPPER_OPEN_EVENT, type PepperOpenDetail } from "@/lib/helper/site-config";
import styles from "./helper.module.css";

/**
 * A question's Ask Pepper button. It opens the one Pepper (SiteHelper, in the root layout) with this question attached,
 * so the conversation carries on if Pepper opens another page; pressing it again closes Pepper.
 */
export function HelperLauncher({ bank, questionId, questionLabel, freePreview }: {
  bank: string;
  questionId: string;
  questionLabel: string;
  authenticated: boolean;
  freePreview: boolean;
}) {
  return <button
    type="button"
    className={styles.launcher}
    aria-haspopup="dialog"
    onClick={(event) => {
      window.dispatchEvent(new CustomEvent<PepperOpenDetail>(PEPPER_OPEN_EVENT, {
        detail: { question: { bank, questionId, label: questionLabel, freePreview }, opener: event.currentTarget },
      }));
    }}
  ><HelperFace size={24} />Ask {HELPER_NAME}</button>;
}
