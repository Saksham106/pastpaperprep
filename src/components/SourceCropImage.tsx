import Image from "next/image";
import { useEffect, useState, type ReactEventHandler, type SyntheticEvent } from "react";
import { assetHost } from "@/lib/asset-host";
import type { BankSlug } from "@/lib/banks";
import { trackProductEvent } from "@/lib/product-analytics";
import { matchesReviewedDisplayCrop, type VisibleImageCrop } from "@/lib/reviewed-blank-tails";
import { fetchVerifiedImageBlob } from "@/lib/verified-asset-bytes";

/** Clips only a signed, reviewed furniture tail; never changes the image width. */
export function SourceCropImage({ src, alt, crop, bankSlug, questionId, onError, priority = false }: {
  src: string;
  alt: string;
  bankSlug: BankSlug;
  questionId: string;
  crop?: VisibleImageCrop | null;
  onError?: ReactEventHandler<HTMLImageElement>;
  /** The first question image on the page: fetch it before anything else below the fold. */
  priority?: boolean;
}) {
  const loading = { loading: priority ? "eager" : "lazy", fetchPriority: priority ? "high" : "auto", ...(priority ? { onLoad: reportFirstQuestionImage(bankSlug) } : {}) } as const;
  if (!crop || !matchesReviewedDisplayCrop(bankSlug, questionId, crop)) {
    return <Image unoptimized width={1400} height={1000} src={src} alt={alt} onError={onError} {...loading} />;
  }
  return <VerifiedCrop key={`${src}:${crop.imageSha256}`} src={src} alt={alt} crop={crop} onError={onError} loading={loading} />;
}

// The bank page's core moment: how long after navigation start the first question image was on screen.
let firstQuestionImageReported = false;
function reportFirstQuestionImage(bank: BankSlug) {
  return (event: SyntheticEvent<HTMLImageElement>) => {
    if (firstQuestionImageReported || typeof performance === "undefined") return;
    firstQuestionImageReported = true;
    // ms counts from the document's load, so it is only a page-load time when this page was the one loaded.
    let navigation: "load" | "client" = "client";
    try {
      const entry = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
      if (entry && new URL(entry.name).pathname === window.location.pathname) navigation = "load";
    } catch { /* keep "client" */ }
    trackProductEvent("question_image_first_load", { bank, ms: Math.round(performance.now()), navigation, host: assetHost(event.currentTarget.currentSrc || event.currentTarget.src) });
  };
}

type ImageLoading = { loading: "eager" | "lazy"; fetchPriority: "high" | "auto"; onLoad?: (event: SyntheticEvent<HTMLImageElement>) => void };

function VerifiedCrop({ src, alt, crop, onError, loading }: { src: string; alt: string; crop: VisibleImageCrop; onError?: ReactEventHandler<HTMLImageElement>; loading: ImageLoading }) {
  const [verifiedUrl, setVerifiedUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    void (async () => {
      try {
        const blob = await fetchVerifiedImageBlob(src, crop.imageSha256);
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setVerifiedUrl(objectUrl);
      } catch { if (active) setFailed(true); }
    })();
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [src, crop.imageSha256]);
  if (failed) return <Image unoptimized width={crop.fullWidthPx} height={crop.fullHeightPx} src={src} alt={alt} onError={onError} {...loading} />;
  const box = { aspectRatio: `${crop.fullWidthPx} / ${crop.visibleHeightPx}` };
  // Verifying holds the clipped image's box, so the image lands without moving anything.
  if (!verifiedUrl) return <div className="source-tail-clipped" style={box} role="status" aria-label="Verifying original image" />;
  return <div className="source-tail-clipped" style={box}>
    <Image unoptimized width={crop.fullWidthPx} height={crop.fullHeightPx} src={verifiedUrl} alt={alt} onError={onError} {...loading} />
  </div>;
}
