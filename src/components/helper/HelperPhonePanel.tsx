"use client";

import { useEffect } from "react";
import { HelperPanel, type HelperPanelProps } from "@/components/helper/HelperPanel";
import { trackProductEvent } from "@/lib/product-analytics";

export function HelperPhonePanel(props: Omit<HelperPanelProps, "variant" | "onClose">) {
  useEffect(() => {
    trackProductEvent("helper_open", { bank: props.bank, freePreview: props.freePreview, surface: "phone" });
  }, [props.bank, props.freePreview]);
  return <HelperPanel {...props} variant="page" />;
}
