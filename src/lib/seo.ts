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
 * schema.org Course for the exam course a page is about (the syllabus, not a PastPaperPrep product).
 * Google's course structured data requires a description; the provider is the exam board that runs the course.
 */
export function examCourseJsonLd({ name, qualification, url }: { name: string; qualification: string; url?: string }) {
  const ib = /^(IB|International Baccalaureate)/i.test(qualification);
  return {
    "@type": "Course",
    name,
    description: `${name} (${qualification}). PastPaperPrep sorts this course's past-paper questions by syllabus topic, year and paper.`,
    educationalLevel: qualification,
    provider: ib
      ? { "@type": "Organization", name: "International Baccalaureate Organization", sameAs: "https://www.ibo.org" }
      : { "@type": "Organization", name: "Cambridge International Education", sameAs: "https://www.cambridgeinternational.org" },
    ...(url ? { url } : {}),
  };
}
