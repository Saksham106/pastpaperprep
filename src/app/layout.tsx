import type { Metadata } from "next";
import { Geist, IBM_Plex_Mono, Young_Serif } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { SiteFooter } from "@/components/SiteFooter";
import { SessionAwareSiteHeader } from "@/components/SessionAwareSiteHeader";
import { AnnualSaleBanner } from "@/components/AnnualSaleBanner";
import { ANNUAL_SALE_HINT_SCRIPT, annualSaleConfigured } from "@/lib/annual-sale";
import { SiteHelper } from "@/components/helper/SiteHelper";
import { notesNavVisible } from "@/lib/course-notes/visibility";
import { pastPaperLinksEnabled } from "@/lib/past-paper-nav";
import { SiteTelemetry } from "@/components/SiteTelemetry";
import { BankNavigationFeedback } from "@/components/BankNavigationFeedback";
import { PageTransition } from "@/components/PageTransition";
import { SOCIAL_IMAGE_URL, socialPreview } from "@/lib/seo";
import "./globals.css";
import "./motion.css";
import { SESSION_HINT_SCRIPT } from "@/lib/supabase/auth-cookie";

const geist = Geist({ variable: "--font-geist", subsets: ["latin"] });
const youngSerif = Young_Serif({ variable: "--font-young-serif", subsets: ["latin"], weight: "400" });
// Small labels only: three weights preloaded at high priority competed with the CSS and the LCP
// image on every page. They still load (swap, with size-matched fallback metrics), just not first.
const mono = IBM_Plex_Mono({ variable: "--font-mono", subsets: ["latin"], weight: ["400", "500", "600"], preload: false });

export const metadata: Metadata = {
  metadataBase: new URL("https://pastpaperprep.com"),
  applicationName: "PastPaperPrep",
  title: { default: "PastPaperPrep | IGCSE, A Level & IB Maths, Sciences and Economics Past Papers", template: "%s | PastPaperPrep" },
  description: "Practise Cambridge IGCSE, Cambridge A Level and IB Mathematics, Biology, Chemistry, Physics, Co-ordinated Sciences, and Economics past-paper questions by topic, then build printable revision sets.",
  keywords: [
    "IGCSE maths past papers",
    "IGCSE Biology past papers",
    "IGCSE Chemistry past papers",
    "IGCSE Physics past papers",
    "IGCSE Economics past papers",
    "IB Mathematics past papers",
    "IB Chemistry past papers",
    "IB Physics past papers",
    "IB Biology past papers",
    "IB Economics past papers",
    "past papers by topic",
    "topical past paper questions",
  ],
  authors: [{ name: "PastPaperPrep Team" }],
  creator: "PastPaperPrep",
  publisher: "PastPaperPrep",
  category: "education",
  openGraph: {
    title: "PastPaperPrep | IGCSE, A Level & IB Maths, Sciences and Economics Past Papers",
    description: "Topic-by-topic practice across Cambridge IGCSE, Cambridge A Level and IB Mathematics, Biology, Chemistry, Physics, Co-ordinated Sciences, and Economics.",
    type: "website",
    ...socialPreview(),
  },
  twitter: {
    card: "summary_large_image",
    title: "PastPaperPrep | IGCSE, A Level & IB Maths, Sciences and Economics Past Papers",
    description: "Topic-by-topic practice across Cambridge IGCSE, Cambridge A Level and IB Mathematics, Biology, Chemistry, Physics, Co-ordinated Sciences, and Economics.",
    images: [SOCIAL_IMAGE_URL],
  },
  verification: process.env.GOOGLE_SITE_VERIFICATION
    ? { google: process.env.GOOGLE_SITE_VERIFICATION }
    : undefined,
};

// Read once at build time (pages are static): the banner ships only while a sale coupon is configured.
const annualSale = annualSaleConfigured(process.env, Date.now());

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    // globals.css makes in-page scrolling smooth. Next 16 only switches that off for route changes
    // when this attribute is set; without it, opening a page from deep in a list animated part-way
    // and left the new page scrolled down (e.g. a bank opened from the home page's bank list).
    <html lang="en" className={`${geist.variable} ${mono.variable} ${youngSerif.variable}`} data-scroll-behavior="smooth" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: SESSION_HINT_SCRIPT }} />{annualSale ? <script dangerouslySetInnerHTML={{ __html: ANNUAL_SALE_HINT_SCRIPT }} /> : null}</head>
      <body data-build-revision={process.env.NEXT_PUBLIC_BUILD_REVISION ?? "local"}>
        <ThemeProvider attribute="data-theme" defaultTheme="light" enableColorScheme storageKey="pastpaperprep-theme" disableTransitionOnChange>
          {annualSale ? <AnnualSaleBanner /> : null}
          <SessionAwareSiteHeader pastPapers={pastPaperLinksEnabled()} notes={notesNavVisible()} />
          <BankNavigationFeedback />
          <main><PageTransition>{children}</PageTransition></main>
          <SiteFooter />
          <SiteTelemetry />
          <SiteHelper />
        </ThemeProvider>
      </body>
    </html>
  );
}
