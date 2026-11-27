import type { Metadata } from "next";
import type { Qualification } from "@/lib/catalog";
import { qualificationInfo } from "@/lib/qualifications";
import type { PastPaperQualification } from "@/lib/past-paper-catalog";

export const PRIVATE_ROBOTS: Metadata["robots"] = {
  index: false,
  follow: false,
  nocache: true,
  googleBot: {
    index: false,
    follow: false,
    noimageindex: true,
  },
};

// metadataBase resolves og:image but not og:video, and Messages only plays an absolute video URL.
const SITE = "https://pastpaperprep.com";

const SOCIAL_PREVIEWS = {
  igcse: {
    image: { url: "/social/do-better-igcse.png", width: 1200, height: 630, alt: "PastPaperPrep: a marked practice paper with the grade rising from C to A*" },
    video: { url: `${SITE}/social/do-better-igcse.mp4`, secureUrl: `${SITE}/social/do-better-igcse.mp4`, type: "video/mp4", width: 1200, height: 630 },
  },
  ib: {
    image: { url: "/social/do-better-ib.png", width: 1200, height: 630, alt: "PastPaperPrep: a marked practice paper with the grade rising from 4 to 7" },
    video: { url: `${SITE}/social/do-better-ib.mp4`, secureUrl: `${SITE}/social/do-better-ib.mp4`, type: "video/mp4", width: 1200, height: 630 },
  },
} as const;

export const SOCIAL_IMAGE = SOCIAL_PREVIEWS.igcse.image;

export const SOCIAL_IMAGE_URL = SOCIAL_IMAGE.url;

/**
 * Link-preview image plus looping video (Messages autoplays og:video; WhatsApp shows the image).
 * IB pages get the 1–7 grade scale. A page-level openGraph replaces the layout's, so spread this into each one.
 */
export function socialPreview(qualification?: Qualification | PastPaperQualification) {
  const preview = SOCIAL_PREVIEWS[qualificationInfo(qualification).socialPreview];
  // siteName and locale are repeated here because a page-level openGraph drops the layout's.
  return { siteName: "PastPaperPrep", locale: "en_US", images: [preview.image], videos: [preview.video] };
}

/**
 * What a bank or syllabus page is about: the exam syllabus, named as a plain Thing. These pages are PastPaperPrep
 * resources about a Cambridge or IB course, not the course itself, so they don't use Course markup (Google's
 * course structured data is for real curricula from their actual provider).
 */
export function syllabusSubjectJsonLd(name: string) {
  return { "@type": "Thing", name };
}
