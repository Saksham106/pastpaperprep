import type { Metadata } from "next";
import { Geist, IBM_Plex_Mono } from "next/font/google";
import Script from "next/script";
import { SiteFooter } from "@/components/SiteFooter";
import { SessionAwareSiteHeader } from "@/components/SessionAwareSiteHeader";
import { SiteTelemetry } from "@/components/SiteTelemetry";
import { THEME_INIT_SCRIPT } from "@/components/ThemeInitScript";
import { SOCIAL_IMAGE, SOCIAL_IMAGE_URL } from "@/lib/seo";
import "./globals.css";

const geist = Geist({ variable: "--font-geist", subsets: ["latin"] });
const mono = IBM_Plex_Mono({ variable: "--font-mono", subsets: ["latin"], weight: ["400", "500", "600"] });

export const metadata: Metadata = {
  metadataBase: new URL("https://pastpaperprep.com"),
  applicationName: "PastPaperPrep",
  title: { default: "PastPaperPrep | IGCSE Maths & IB Maths and Science Past Papers", template: "%s | PastPaperPrep" },
  description: "Practise Cambridge IGCSE Maths and IB Mathematics, Chemistry, Physics, and Biology past-paper questions by topic, then build printable revision sets.",
  keywords: [
    "IGCSE maths past papers",
    "IB math past papers",
    "IB Chemistry past papers",
    "IB Physics past papers",
    "IB Biology past papers",
    "past papers by topic",
    "topical past paper questions",
  ],
  authors: [{ name: "PastPaperPrep Team" }],
  creator: "PastPaperPrep",
  publisher: "PastPaperPrep",
  category: "education",
  openGraph: {
    siteName: "PastPaperPrep",
    title: "PastPaperPrep | IGCSE Maths & IB Maths and Science Past Papers",
    description: "Topic-by-topic practice for Cambridge IGCSE Maths and IB Mathematics, Chemistry, Physics, and Biology.",
    type: "website",
    locale: "en_US",
    images: [SOCIAL_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: "PastPaperPrep | IGCSE Maths & IB Maths and Science Past Papers",
    description: "Topic-by-topic practice for Cambridge IGCSE Maths and IB Mathematics, Chemistry, Physics, and Biology.",
    images: [SOCIAL_IMAGE_URL],
  },
  verification: process.env.GOOGLE_SITE_VERIFICATION
    ? { google: process.env.GOOGLE_SITE_VERIFICATION }
    : undefined,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geist.variable} ${mono.variable}`} suppressHydrationWarning>
      <body>
        <Script id="pastpaperprep-theme" strategy="beforeInteractive">{THEME_INIT_SCRIPT}</Script>
        <SessionAwareSiteHeader />
        <main>{children}</main>
        <SiteFooter />
        <SiteTelemetry />
      </body>
    </html>
  );
}
