import type { Metadata } from "next";

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

export const SOCIAL_IMAGE = {
  url: "/pastpaperprep-share.png",
  width: 1200,
  height: 630,
  alt: "PastPaperPrep — exact past-paper questions by topic",
};

export const SOCIAL_IMAGE_URL = SOCIAL_IMAGE.url;
