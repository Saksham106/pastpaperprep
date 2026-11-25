import Image from "next/image";
import { useEffect, useState, type ReactEventHandler } from "react";
import type { BankSlug } from "@/lib/banks";
import type { ImageSize } from "@/lib/image-sizes";
import { matchesReviewedDisplayCrop, type VisibleImageCrop } from "@/lib/reviewed-blank-tails";
import { fetchVerifiedImageBlob } from "@/lib/verified-asset-bytes";

/**
 * The box a question image takes before it loads when its real size is unknown. Placeholders use
 * the same box, so swapping one for the other moves nothing.
 */
export const UNSIZED_QUESTION_IMAGE: ImageSize = [1400, 1000];

/** Width and height an image (or its placeholder) reserves: its real pixel size when known. */
export function questionImageBox(size: ImageSize | null | undefined): ImageSize {
  return size ?? UNSIZED_QUESTION_IMAGE;
}

/** A loading box exactly the shape of the image that replaces it. */
export function AssetPlaceholder({ size, label }: { size?: ImageSize | null; label?: string }) {
  const [width, height] = questionImageBox(size);
  return <div className="asset-placeholder" style={{ aspectRatio: `${width} / ${height}` }} {...(label ? { role: "status" } : { "aria-hidden": true })}>
    {label ? <><span className="placeholder-shimmer" aria-hidden="true" /><span className="placeholder-bars" aria-hidden="true"><i /><i /><i /><i /></span><span className="sr-only">{label}</span></> : null}
  </div>;
}

/**
 * A mark-scheme crop at its natural size (never enlarged). With a known size the box is set
 * before the image loads: the same width it would take once loaded, and the height from its shape.
 */
export function MarkSchemeImage({ src, alt, size, onError }: { src: string; alt: string; size?: ImageSize | null; onError?: ReactEventHandler<HTMLImageElement> }) {
  if (!size) return <Image unoptimized width={0} height={0} src={src} alt={alt} onError={onError} />;
  return <Image unoptimized width={size[0]} height={size[1]} style={{ width: size[0], height: "auto" }} src={src} alt={alt} onError={onError} />;
}

/** Clips only a signed, reviewed furniture tail; never changes the image width. */
export function SourceCropImage({ src, alt, crop, size, bankSlug, questionId, onError, priority = false }: {
  src: string;
  alt: string;
  bankSlug: BankSlug;
  questionId: string;
  crop?: VisibleImageCrop | null;
  /** Real pixel [width, height] from the asset response, so the image holds its final box before it loads. */
  size?: ImageSize | null;
  onError?: ReactEventHandler<HTMLImageElement>;
  /** The first question image on the page: fetch it before anything else below the fold. */
  priority?: boolean;
}) {
  const loading = { loading: priority ? "eager" : "lazy", fetchPriority: priority ? "high" : "auto" } as const;
  if (!crop || !matchesReviewedDisplayCrop(bankSlug, questionId, crop)) {
    const [width, height] = questionImageBox(size);
    return <Image unoptimized width={width} height={height} src={src} alt={alt} onError={onError} {...loading} />;
  }
  return <VerifiedCrop key={`${src}:${crop.imageSha256}`} src={src} alt={alt} crop={crop} onError={onError} loading={loading} />;
}

function VerifiedCrop({ src, alt, crop, onError, loading }: { src: string; alt: string; crop: VisibleImageCrop; onError?: ReactEventHandler<HTMLImageElement>; loading: { loading: "eager" | "lazy"; fetchPriority: "high" | "auto" } }) {
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
