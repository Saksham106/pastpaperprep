import Image from "next/image";
import { useEffect, useState, type ReactEventHandler } from "react";
import type { BankSlug } from "@/lib/banks";
import { matchesReviewedDisplayCrop, type VisibleImageCrop } from "@/lib/reviewed-blank-tails";
import { fetchVerifiedImageBlob } from "@/lib/verified-asset-bytes";

/** Clips only a signed, reviewed furniture tail; never changes the image width. */
export function SourceCropImage({ src, alt, crop, bankSlug, questionId, onError }: {
  src: string;
  alt: string;
  bankSlug: BankSlug;
  questionId: string;
  crop?: VisibleImageCrop | null;
  onError?: ReactEventHandler<HTMLImageElement>;
}) {
  if (!crop || !matchesReviewedDisplayCrop(bankSlug, questionId, crop)) {
    return <Image unoptimized width={1400} height={1000} src={src} alt={alt} onError={onError} />;
  }
  return <VerifiedCrop key={`${src}:${crop.imageSha256}`} src={src} alt={alt} crop={crop} onError={onError} />;
}

function VerifiedCrop({ src, alt, crop, onError }: { src: string; alt: string; crop: VisibleImageCrop; onError?: ReactEventHandler<HTMLImageElement> }) {
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
  if (failed) return <Image unoptimized width={crop.fullWidthPx} height={crop.fullHeightPx} src={src} alt={alt} onError={onError} />;
  if (!verifiedUrl) return <div role="status" aria-label="Verifying original image" />;
  return <div className="source-tail-clipped" style={{ aspectRatio: `${crop.fullWidthPx} / ${crop.visibleHeightPx}` }}>
    <Image unoptimized width={crop.fullWidthPx} height={crop.fullHeightPx} src={verifiedUrl} alt={alt} onError={onError} />
  </div>;
}
