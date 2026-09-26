import type { Metadata } from "next";
import { Geist, IBM_Plex_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { SiteFooter } from "@/components/SiteFooter";
import { SessionAwareSiteHeader } from "@/components/SessionAwareSiteHeader";
import { SiteTelemetry } from "@/components/SiteTelemetry";
import { SOCIAL_IMAGE, SOCIAL_IMAGE_URL } from "@/lib/seo";
import "./globals.css";

const geist = Geist({ variable: "--font-geist", subsets: ["latin"] });
const mono = IBM_Plex_Mono({ variable: "--font-mono", subsets: ["latin"], weight: ["400", "500", "600"] });

export const metadata: Metadata = {
  metadataBase: new URL("https://pastpaperprep.com"),
  applicationName: "PastPaperPrep",
  title: { default: "PastPaperPrep | IGCSE & IB Maths, Sciences and Economics Past Papers", template: "%s | PastPaperPrep" },
  description: "Practise Cambridge IGCSE and IB Mathematics, Biology, Chemistry, Physics, Co-ordinated Sciences, and Economics past-paper questions by topic, then build printable revision sets.",
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
    siteName: "PastPaperPrep",
    title: "PastPaperPrep | IGCSE & IB Maths, Sciences and Economics Past Papers",
    description: "Topic-by-topic practice across Cambridge IGCSE and IB Mathematics, Biology, Chemistry, Physics, Co-ordinated Sciences, and Economics.",
    type: "website",
    locale: "en_US",
    images: [SOCIAL_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: "PastPaperPrep | IGCSE & IB Maths, Sciences and Economics Past Papers",
    description: "Topic-by-topic practice across Cambridge IGCSE and IB Mathematics, Biology, Chemistry, Physics, Co-ordinated Sciences, and Economics.",
    images: [SOCIAL_IMAGE_URL],
  },
  verification: process.env.GOOGLE_SITE_VERIFICATION
    ? { google: process.env.GOOGLE_SITE_VERIFICATION }
    : undefined,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geist.variable} ${mono.variable}`} suppressHydrationWarning>
      <body data-build-revision={process.env.NEXT_PUBLIC_BUILD_REVISION ?? "local"}>
        <ThemeProvider attribute="data-theme" defaultTheme="system" enableSystem enableColorScheme storageKey="pastpaperprep-theme" disableTransitionOnChange>
          <SessionAwareSiteHeader />
          <main>{children}</main>
          <SiteFooter />
          <SiteTelemetry />
        </ThemeProvider>
      </body>
    </html>
  );
}
