import type { Metadata } from "next";
import { Geist, IBM_Plex_Mono } from "next/font/google";
import Script from "next/script";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteTelemetry } from "@/components/SiteTelemetry";
import { createThemeInitScript } from "@/components/ThemeInitScript";
import { createClient } from "@/lib/supabase/server";
import "./globals.css";

const geist = Geist({ variable: "--font-geist", subsets: ["latin"] });
const mono = IBM_Plex_Mono({ variable: "--font-mono", subsets: ["latin"], weight: ["400", "500", "600"] });

export const metadata: Metadata = {
  metadataBase: new URL("https://pastpaperprep.com"),
  applicationName: "PastPaperPrep",
  title: { default: "PastPaperPrep | IGCSE & IB Maths Past Papers", template: "%s | PastPaperPrep" },
  description: "Practise IGCSE and IB Mathematics past-paper questions by topic, build focused sets, check answers, and export printable revision PDFs.",
  keywords: [
    "IGCSE maths past papers",
    "IB math past papers",
    "past papers by topic",
    "topical maths questions",
  ],
  authors: [{ name: "PastPaperPrep Team" }],
  creator: "PastPaperPrep",
  publisher: "PastPaperPrep",
  category: "education",
  openGraph: {
    siteName: "PastPaperPrep",
    title: "PastPaperPrep | IGCSE & IB Maths Past Papers",
    description: "Topic-by-topic past-paper practice for Cambridge IGCSE and IB Mathematics.",
    type: "website",
    locale: "en_US",
    images: [{
      url: "/pastpaperprep-workspace.webp",
      width: 1280,
      height: 650,
      alt: "PastPaperPrep topic-filtered mathematics question workspace",
    }],
  },
  twitter: {
    card: "summary_large_image",
    title: "PastPaperPrep | IGCSE & IB Maths Past Papers",
    description: "Topic-by-topic past-paper practice for Cambridge IGCSE and IB Mathematics.",
    images: ["/pastpaperprep-workspace.webp"],
  },
  verification: process.env.GOOGLE_SITE_VERIFICATION
    ? { google: process.env.GOOGLE_SITE_VERIFICATION }
    : undefined,
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const authenticated = typeof claimsData?.claims?.sub === "string";

  return (
    <html lang="en" className={`${geist.variable} ${mono.variable}`} suppressHydrationWarning>
      <body>
        <Script id="pastpaperprep-theme" strategy="beforeInteractive">{createThemeInitScript(authenticated)}</Script>
        <SiteHeader authenticated={authenticated} />
        <main>{children}</main>
        <SiteFooter />
        <SiteTelemetry />
      </body>
    </html>
  );
}
